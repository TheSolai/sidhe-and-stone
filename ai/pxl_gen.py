#!/usr/bin/env python3
"""
pxl_gen: generate pixel art as CODE with local models, then polish it.

The key realisation from the pipeline work: tracing a rendered photograph
into a sprite produces mush, because a photograph has no pixel grid to
recover. Pixel art has to be DRAWN at sprite resolution.

pxl is a drawing language, so the right pipeline is:

    qwen3-coder:30b  WRITES  pxl source for the sprite
         |
         v
    pxl build        parses + renders it
         |            ^ on a syntax/runtime error, the error text goes
         |              back to the model for a repair
         v
    pxl lint        critiques the pixels (orphans, jaggies, pillow
         |            shading, near-duplicate colours, palette bloat)
         |            ^ findings also go back to the model for a repair
         v
    llava:34b       LOOKS at the built PNG and judges it as a human
         |            would: silhouette, palette, mood, readability
         v
    final source + PNG + Godot SpriteFrames

Everything runs locally. No API keys, no network, no per-image cost.

Usage:
    python pxl_gen.py --brief "a lucky shamrock charm" --name charm
    python pxl_gen.py --batch briefs.json --out ../art
"""

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
PXL_DIR = HERE.parent / "tools" / "pxl"
NODE = "/Users/amre/.openclaw/tools/node-v24.21.0/bin/node"

# ---------------------------------------------------------------- pxl cheatsheet

PXL_DOCS = """pxl is a pixel-art DSL. Art files are plain JavaScript (or TypeScript)
evaluated with the DSL as globals. Nothing draws at definition time.

THE ONLY PALETTE KEYS YOU MAY USE WITH use("pico8")
  0 = #000000   1 = #1d2b53   2 = #7e2553   3 = #008751
  4 = #ab5236   5 = #5f574f   6 = #c2c3c7   7 = #fff1e8
  8 = #ff004d   9 = #ffa300   a = #ffec27   b = #00e436
  c = #29adff   d = #83769c   e = #ff77a8   f = #ffccaa
That is EXACTLY 16 keys: 0-9 and a-f. There is no key "g", "k", "u", "D" or
anything else. Using an undefined key is a BUILD ERROR.

COLOUR RULES - SIMPLE, FOLLOW EXACTLY
  1. Start the file with use("pico8").
  2. Colour your shapes with HEX STRINGS, not palette keys:
       rect(2, 3, 6, 6, "#2d6a4f")     <- always valid, no key errors
     Hex is ALWAYS safe. Palette keys are NOT.
  3. If you want named shorthand, define it first with SINGLE-CHARACTER keys:
       pal({ L: "#2d6a4f", H: "#52b788", D: "#1b4332", G: "#ffaa5e" })
     then: rect(2, 3, 6, 6, "L")
     "pal" keys must be exactly ONE character. "leaf" is a BUILD ERROR.
     Single uppercase letters are the safest choice.
  4. DO NOT use shades() or ramps(). They are easy to get wrong and the
     sprite does not need them. Draw explicit highlight and shadow shapes
     instead - that is flat cel shading, which is exactly the target look.

A COMPLETE, VALID, WORKING EXAMPLE (structure to imitate)

  use("pico8")
  pal({ S: "#5f574f", C: "#ab5236", H: "#d08159", D: "#fff1e8", K: "#1b1630" })

  sprite("mushroom", { w: 16, h: 16, outline: "K" },
    rect(7, 10, 3, 5, "S"),                // stem
    ellipse(8, 8, 6, 4, "C"),              // cap
    ellipse(6, 7, 2, 1, "H"),              // highlight on the cap
    rect(6, 6, 1, 1, "D"),                 // spot
    rect(10, 9, 1, 1, "D")
  )

OUTLINE - IMPORTANT
  The outline colour must be a key that EXISTS. Under use("pico8") the only
  keys are 0-9 and a-f. "k" is NOT one of them, so outline: "k" is a BUILD
  ERROR. Either use a valid pico8 key (e.g. outline: "5", the dark grey
  #5f574f) or define your own dark key and use that (e.g. pal({ K: "#1b1630" })
  then outline: "K").

Note: no comments other than //, hex or pal()-defined colours, ops only.

ASSETS
  sprite(name, opts?, ...items)
  scene(name, { w, h, bg? }, ...items)
  layer(name, layerOpts?, ...items)      only as an item of a sprite/scene
  group(name, ["a", "b"])                random pick per placement
  sheet(name, ["slime*", "heart"], { cols?, pad? })
  include("other.px.js")

SPRITE OPTIONS
  w, h                   canvas size
  base: "name"           start from a copy of another asset
  outline: "k"           1px outline around opaque pixels (grows canvas 1px)
  outline8               also fills diagonals
  selout: "k"            selective outline that follows the shading
  crop: true             trim to opaque bounds
  mx: true               mirror left half onto right
  swap: { g: "r" }       recolor after drawing
  flip / rot / rflip     transforms

ITEMS (run in order)
  "grid string"          one char per pixel; "." keeps, "_" erases
  rect(x,y,w,h,c)        filled rectangle
  box(x,y,w,h,c)         1px border
  line(x0,y0,x1,y1,c)    line (width>1 = round brush)
  hline(x,y,len,c)       vline(x,y,len,c)
  circ(cx,cy,r,c)        ring(cx,cy,r,c)     1px circle border
  ellipse(cx,cy,rx,ry,c)
  poly([x0,y0,x1,y1,...], c)   filled polygon
  fill(x,y,c)            4-connected flood fill
  text(x,y,"str",c,{scale})
  px(x,y,c)              single pixel
  stamp(name,x,y)        place another asset
  tile / pattern / scatter / clip / tilemap

TEXTURE AND TONE
  dither(x,y,w,h,c1,c2,density)     Bayer 4x4 ordered dither
  grad(x,y,w,h,"abc","v"|"h")       bands with dithered seams
  noise(x,y,w,h,"ab",density,seed)
  shade(where?, steps, density)     step colours darker along the ramps
  light(where?, steps, density)     step colours lighter along the ramps
  recolor({ a: "b" }, where?)
  where = undefined (everywhere) | [cx,cy,r] | [x,y,w,h] | polygon | fn

COLOURS
  a hex string ("#1b1630") - PREFERRED, a pal()-defined name, a palette key
  ("3"), "." to skip, "_" to erase.

SILHOUETTE DISCIPLINE
  * Keep the sprite SIMPLE. A 16x16 sprite is 256 pixels total. KairoSoft-style
    art is 3-8 shapes, not 20. Do not draw every detail.
  * Do not fill the canvas. Leave a transparent margin of 1-2px on each side.
  * Do not draw a single giant filled blob. Break the subject into distinct
    parts, and keep visible background gaps BETWEEN parts.
  * Use at most 4-6 distinct colours per sprite.
  * A grid string is only good for very simple shapes. Prefer ops
    (rect/ellipse/poly/line) so you can position things deliberately.

HOW TO KNOW IT IS GOOD
  * The subject is recognisable in silhouette alone, in black and white.
  * Every pixel either belongs to a deliberate shape or is "." (transparent).
  * There is exactly one dark outline colour (outline: "k").

CRITICAL RULES
  * Use JavaScript comments (//) ONLY. "--" is not a comment and is a syntax error.
  * Use ONLY the palette keys listed above, or hex strings. Undefined key = build error.
  * Every sprite needs an explicit { w: N, h: N }.
  * Build with: pxl build file.px.js --out DIR --godot
  * Lint with:   pxl lint file.px.js
  * Lint flags: orphan pixels (isolated specks = noise), jaggies (doubled
    corners in 1px lines), pillow shading, near-duplicate colours, too many
    colours. Fix every finding before you are done.
  * Prefer fewer colours. 8-12 is plenty for a sprite.
  * Leave transparent gaps between shapes so the silhouette reads.
"""

# ---------------------------------------------------------------- ollama helper

def ollama_chat(prompt, model="qwen3-coder:30b", system=None, images=None,
                temperature=0.5, num_predict=2000, timeout=420, base_url=None):
    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    content = prompt
    if images:
        content = prompt
    msgs.append({"role": "user", "content": content})
    payload = {
        "model": model,
        "messages": msgs,
        "stream": False,
        "options": {"temperature": temperature, "num_predict": num_predict},
    }
    if images:
        payload["messages"][-1]["images"] = images
    url = (base_url or "http://localhost:11434") + "/api/chat"
    try:
        out = subprocess.run(
            ["curl", "-s", "--max-time", str(timeout), url, "-d", json.dumps(payload)],
            capture_output=True, text=True, timeout=timeout + 30)
        data = json.loads(out.stdout)
        return data.get("message", {}).get("content", "")
    except Exception as exc:  # noqa: BLE001
        print(f"    ! ollama failed: {exc}", flush=True)
        return ""


# ---------------------------------------------------------------- code hygiene

def sanitise(code: str) -> str:
    """Strip markdown fences and fix the SQL-style comments models emit."""
    code = re.sub(r"^```[a-zA-Z]*\s*\n?", "", code)
    code = re.sub(r"\n```\s*$", "", code)
    # "-- comment" -> "// comment" (only at start of a line / after whitespace)
    code = re.sub(r"(?m)^(\s*)--\s?", r"\1// ", code)
    code = re.sub(r"(?m)(\s)--\s", r"\1// ", code)
    return code.strip()


# ---------------------------------------------------------------- pxl driver

def pxl_build(src: Path, out_dir: Path):
    cmd = [NODE, "bin/pxl.js", "build", str(src), "--out", str(out_dir), "--no-preview"]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=300,
                         cwd=str(PXL_DIR))
    return res.returncode == 0, (res.stdout or "") + (res.stderr or "")


def pxl_lint(src: Path):
    cmd = [NODE, "bin/pxl.js", "lint", str(src)]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=300,
                         cwd=str(PXL_DIR))
    return (res.stdout or "") + (res.stderr or "")


def pxl_ascii(src: Path, name: str) -> str:
    """Render an asset as a text grid.

    This is the reliable critique channel. llava:34b is unreliable at 16x16
    - it calls a shamrock a tree and sometimes returns grounding JSON - but a
    CODE model reads a character grid perfectly well. Handing the model its
    own rendered output as text lets it critique and repair the sprite
    without a vision model in the loop at all.
    """
    cmd = [NODE, "bin/pxl.js", "ascii", str(Path(src).resolve()), name]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=180,
                         cwd=str(PXL_DIR))
    return (res.stdout or "") + (res.stderr or "")


def pxl_serve_check(src: Path):
    """Confirm pxl can parse the file at all (cheap syntax gate)."""
    cmd = [NODE, "bin/pxl.js", "list", str(src)]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=180,
                         cwd=str(PXL_DIR))
    return res.returncode == 0, (res.stdout or "") + (res.stderr or "")


def extract_error(output: str) -> str:
    """Pull the useful one-line error out of pxl output."""
    for line in output.splitlines():
        if line.strip().lower().startswith("error:"):
            return line.strip()
    return output.strip()[:400]


# ---------------------------------------------------------------- preflight
#
# A model will happily write a file that pxl then rejects, and the repair
# round-trip costs a full model call each time. Cheap static checks catch
# the most common failures BEFORE the build, so the repair loop only fires
# for things that genuinely need a model to fix.

PICO8_KEYS = set("0123456789abcdef")


def _pal_keys(code: str) -> list:
    """Every key used in a pal({...}) call."""
    keys = []
    for m in re.finditer(r"pal\(\s*\{(.*?)\}", code, re.S):
        for km in re.finditer(r"([A-Za-z0-9_]+)\s*:", m.group(1)):
            keys.append(km.group(1))
    return keys


def _grids(code: str) -> list:
    """Every backtick grid literal in the file."""
    return re.findall(r"`([^`]*)`", code)


def _name_args_removed(code: str) -> str:
    """Strip asset-name arguments so they are not mistaken for colour keys.

    sprite("vessel", ...) names an asset; "vessel" is not a palette key. Only
    colour positions should be checked against the palette.
    """
    out = code
    for fn in ("sprite", "scene", "layer", "include", "stamp"):
        out = re.sub(rf'\b{fn}\(\s*"[^"]*"', f"{fn}(", out)
    return out


def preflight(code: str) -> list:
    """Static validation of generated pxl source.

    Returns a list of human-readable problems. Empty means the file is worth
    handing to pxl. These are the failures that local models hit most often
    and that cost a wasted build+repair round trip each time.
    """
    problems = []

    if not code.strip():
        return ["file is empty"]

    # --- SQL-style comments are a syntax error in JavaScript
    for i, line in enumerate(code.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("--") or " --" in stripped:
            problems.append(f"line {i}: SQL-style comment '--' is not valid "
                            f"JavaScript, use '//'")
            break

    # --- pal() keys must be exactly one character
    for key in _pal_keys(code):
        if len(key) != 1:
            problems.append(f"pal() key '{key}' is {len(key)} characters; "
                            f"palette keys must be exactly 1 character")

    # --- work out which colour keys actually exist
    defined = {k for k in _pal_keys(code) if len(k) == 1}
    uses_pico8 = 'use("pico8")' in code or "use('pico8')" in code
    allowed = set(defined)
    if uses_pico8:
        allowed |= PICO8_KEYS

    colour_code = _name_args_removed(code)

    # --- quoted single-character colour keys must exist.
    # Hex colours ("#1b1630") are fine; a bare key that is not in the palette
    # is a build error. With use("pico8") the built-ins are ONLY 0-9 and a-f,
    # so a key like "k" is undefined unless the file declares it itself.
    for m in re.finditer(r'"([^"]*)"', colour_code):
        val = m.group(1)
        if len(val) != 1 or not val.isalnum():
            continue
        if val not in allowed:
            problems.append(
                f"colour key '{val}' is not defined; with use(\"pico8\") only "
                f"0-9 a-f exist plus keys you declare yourself in pal()")

    # --- grid characters must all be real palette keys
    for g in _grids(code):
        rows = [r.strip() for r in g.splitlines() if r.strip()]
        for r in rows:
            for ch in r:
                if ch in ". _\t":
                    continue
                if ch not in allowed:
                    problems.append(
                        f"grid uses character '{ch}' which is not a defined "
                        f"palette key")
                    break
            else:
                continue
            break

    # --- ramps()/shades() need multi-character ramp strings
    # reference.md: ramps("kDdu", "kTtq") - dark to light, 2+ keys each.
    # shades("kDdlL", "#58a845", {...}) - 2+ NEW keys.
    for fn in ("ramps", "shades"):
        for m in re.finditer(rf"\b{fn}\(([^)]*)\)", code):
            for arg in re.findall(r'"([^"]*)"', m.group(1)):
                if len(arg) < 2:
                    problems.append(
                        f"{fn}() needs a ramp string of 2+ characters "
                        f"(dark to light), got '{arg}'")

    # --- every sprite needs an explicit canvas size
    for m in re.finditer(r"sprite\(\s*\"([^\"]+)\"", code):
        snippet = code[m.start():m.start() + 220]
        if not re.search(r"\bw\s*:", snippet) and not re.search(r"\bh\s*:", snippet):
            problems.append(f"sprite '{m.group(1)}' has no explicit "
                            f"{{ w: N, h: N }} canvas size")

    # --- degenerate filled-blob silhouettes
    # A sprite where almost every pixel is opaque is not a sprite, it is a
    # rectangle. Real sprites leave a transparent margin and gaps between
    # separate parts.
    for g in _grids(code):
        rows = [r.strip() for r in g.splitlines() if r.strip()]
        if len(rows) < 6:
            continue
        total = sum(len(r) for r in rows)
        if total == 0:
            continue
        opaque = sum(1 for r in rows for ch in r if ch not in ". _")
        fill = opaque / float(total)
        if fill > 0.92:
            problems.append(
                f"grid is {fill:.0%} opaque - that is a filled blob, not a "
                f"sprite; leave a transparent margin and gaps between parts")
            break

    return problems


def summarise_lint(lint_out: str) -> str:
    """Compact the lint report down to the actionable findings."""
    lines = [ln for ln in lint_out.splitlines()
             if ln.strip() and not ln.strip().startswith("at ")]
    return "\n".join(lines[-24:])


# ---------------------------------------------------------------- generation

BRIEF_TEMPLATE = """Create a pixel-art game sprite for a cozy Irish-folklore management game.

SUBJECT: {subject}

{detail}

ART DIRECTION
  - Canvas {size}. Use {{ w: {size}, h: {size} }} on the sprite.
  - Silhouette first: the subject must be instantly readable at {size}x{size}.
  - Flat cel shading, 2-3 tones per material. NO gradients, NO anti-aliasing.
  - A clean 1px dark outline via {{ outline: "k" }} (or selout for softer edges).
  - Limited palette: {colors} colours maximum. Build ramps with shades().
  - Transparent background: do not fill the whole canvas.
  - Leave clear gaps between separate parts so shapes do not merge.
  - Name the sprite exactly "{name}".

{pxl_docs}

Return ONLY the pxl source file. No markdown fence, no commentary."""


def generate_source(subject, name, size, colors, detail, model, docs, temp=0.6):
    prompt = BRIEF_TEMPLATE.format(
        subject=subject, detail=detail or "One clear hero object, centred.",
        size=size, colors=colors, name=name, pxl_docs=docs)
    raw = ollama_chat(prompt, model=model, temperature=temp, num_predict=2200)
    return sanitise(raw)


REPAIR_TEMPLATE = """Your pxl pixel-art file does not build.

ERROR:
{error}

{finding_block}

Here is your current file:
```
{code}
```

Fix it. If the error is a syntax error, fix the syntax. If pxl lint reported
findings, fix EVERY finding by changing the drawing code: remove orphan
pixels (isolated specks), step 1px lines diagonally instead of doubling
corners, and reduce the colour count.

{pxl_docs}

Return ONLY the corrected pxl source file. No markdown fence, no commentary."""


def repair_source(code, error, lint_findings, model, docs, grid=""):
    block = ""
    if lint_findings:
        block = (f"\npxl lint ALSO reported these findings to fix:\n"
                 f"{lint_findings}\n")
    grid_block = ""
    if grid:
        grid_block = (
            "\nHere is how your sprite ACTUALLY renders, one character per "
            "pixel ('.' is transparent):\n\n"
            f"{grid}\n\n"
            "Read that grid carefully. Every defect below is visible in it: a "
            "shape that reads as a flat bar instead of a crown, a solid "
            "slab where a hollow shape belongs, a detail painted over in the "
            "wrong colour. Fix the DRAWING CODE so the rendered grid matches "
            "the intended subject.\n")
    prompt = REPAIR_TEMPLATE.format(error=error, finding_block=block,
                                    code=code, pxl_docs=docs) + grid_block
    raw = ollama_chat(prompt, model=model, temperature=0.35, num_predict=2200)
    return sanitise(raw)


# ---------------------------------------------------------------- vision critique

CRITIQUE_PROMPT = """You are the art director of a cozy KairoSoft-style management
game with Irish folklore themes. You are shown a pixel-art game sprite.

Be specific and harsh. Judge:
1. SILHOUETTE - is the subject instantly readable, or does it blob together?
2. PIXEL CRAFT - does this look like deliberate pixel art, or like a photo
   shrunk down? Are the edges hard? Are the tones flat and deliberate?
3. PALETTE - muddy, too many hues, or a coherent limited ramp?
4. MOOD - does it read as cosy Irish folklore charm, or generic fantasy?
5. THE SINGLE HIGHEST-IMPACT FIX.

Then write a REPLACEMENT BRIEF for the sprite. One paragraph, under 60 words,
describing exactly what the sprite should show: subject, pose, palette
colours, shading, and outline. Start it with "Create a pixel-art game sprite".

Reply in exactly this format:
CRITIQUE: <3-5 short lines>
BRIEF: <the replacement brief>"""


# --- ASCII self-critique -------------------------------------------------
#
# The critique a code model gives of its own rendered output. This is the
# channel that actually works at 16x16: the grid is exact, and a text model
# can reason about a character grid in a way a vision model at this
# resolution cannot. It is what caught the crown rendering as a flat bar and
# the display case as a solid white slab - defects the linter passed.

ASCII_CRITIQUE_PROMPT = """You are the art director of a cozy KairoSoft-style
management game with Irish folklore themes. You are reviewing a pixel-art
sprite that has ALREADY BEEN RENDERED.

Here is the rendered sprite, one character per pixel. '.' is transparent:

{grid}

The intended subject was: {subject}

Judge what you can SEE in that grid:
1. SILHOUETTE - does the shape read as the subject at a glance, or does it
   collapse into a flat bar, a solid slab, or a blob?
2. SHAPE FIDELITY - are the parts actually the right shape? A hollow thing
   must be hollow. A crown must have points on top. A wheel must have a ring
   and spokes, not a solid field.
3. COLOUR FAULTS - is any detail painted over in the wrong colour? Any
   feature invisible because it matches its neighbour?
4. NOISE - stray isolated pixels, or shapes that float free of the subject.
5. BALANCE - is the subject centred and readable, with a transparent margin?

Then write the fixes as a short list of CONCRETE drawing changes. Name the
parts and say what shape they should be. Be specific and brief.

Reply in exactly this format:
PROBLEMS: <one line per problem>
FIXES: <what to change in the drawing code>"""


def ascii_critique(src: Path, name: str, subject: str, model="qwen3-coder:30b",
                    timeout=420):
    """Critique a rendered sprite from its own text grid."""
    grid = pxl_ascii(src, name)
    if not grid.strip() or "." not in grid:
        print(f"    ! ascii grid empty for {name}", flush=True)
        return None, ""
    prompt = ASCII_CRITIQUE_PROMPT.format(grid=grid, subject=subject)
    text = ollama_chat(prompt, model=model, temperature=0.3,
                       num_predict=700, timeout=timeout)
    problems, fixes = None, ""
    for line in text.splitlines():
        s = line.strip()
        if s.upper().startswith("PROBLEMS:"):
            problems = s.split(":", 1)[1].strip()
        elif s.upper().startswith("FIXES:"):
            fixes = s.split(":", 1)[1].strip()
    # The model sometimes ignores the requested labels. Fall back to using
    # the whole reply as the fix list rather than silently dropping it -
    # an unparsed critique is a wasted critique.
    if not problems and not fixes and text.strip():
        problems = text.strip()[:600]
        fixes = text.strip()[:1200]
    return problems, fixes


def brief_has_drift(original_subject: str, brief: str) -> bool:
    """Does the revised brief describe a DIFFERENT subject?

    The vision critique is advisory and untrusted: at 16x16 it hallucinates.
    Observed failure - a stone relic came back as "a friendly leprechaun"
    and a museum display case as "a cozy Irish pub". Regenerating from a
    brief that drifted to another subject replaces good art with nonsense,
    so a drifted brief is discarded rather than used.
    """
    if not brief.strip():
        return True
    stop = {"a", "an", "the", "of", "with", "and", "or", "in", "on", "to",
            "game", "sprite", "pixel", "pixel-art", "art", "create", "that",
            "is", "it", "for", "from", "small", "one", "should", "its",
            "charming", "irish", "folklore", "charm"}
    subj = {w for w in re.findall(r"[a-z]{4,}", original_subject.lower())
            if w not in stop}
    br = {w for w in re.findall(r"[a-z]{4,}", brief.lower()) if w not in stop}
    if not subj:
        return False
    return not (subj & br)


def vision_critique(png_path: Path, model="llava:34b", timeout=420):
    import base64
    with open(png_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    text = ollama_chat(CRITIQUE_PROMPT, model=model, images=[b64],
                       temperature=0.3, num_predict=500, timeout=timeout)
    critique, brief = None, None
    for line in text.splitlines():
        s = line.strip()
        if s.upper().startswith("CRITIQUE:"):
            critique = s.split(":", 1)[1].strip()
        elif s.upper().startswith("BRIEF:"):
            brief = s.split(":", 1)[1].strip()
    return critique, brief


# ---------------------------------------------------------------- main loop

def build_asset(subject, name, out_root, size=16, colors=10, detail="",
                model="qwen3-coder:30b", vision_model="llava:34b",
                max_repairs=3, use_vision=True, docs=PXL_DOCS, verbose=True,
                ascii_review=True, ascii_model="qwen3-coder:30b",
                ascii_rounds=1):
    art_dir = (Path(out_root) / name).resolve()
    art_dir.mkdir(parents=True, exist_ok=True)
    src = art_dir / f"{name}.px.js"
    out_dir = art_dir / "out"

    print(f"\n=== {name}: {subject} ===", flush=True)
    code = generate_source(subject, name, size, colors, detail, model, docs)
    if not code.strip():
        print("  ! model returned nothing", flush=True)
        return None

    # Preflight BEFORE any build attempt: cheap static checks catch the
    # failures that would otherwise cost a full model repair round trip.
    issues = preflight(code)
    if issues:
        print(f"  [preflight] {len(issues)} issue(s):", flush=True)
        for p in issues:
            print(f"     - {p}", flush=True)
        history.append("preflight:\n" + "\n".join(issues))
        code = repair_source(code, "static validation failed:\n"
                             + "\n".join(issues), "", model, docs)
        issues2 = preflight(code)
        if issues2:
            print(f"  [preflight] still {len(issues2)} issue(s) after repair",
                  flush=True)
    src.write_text(code)

    lint_out = ""
    history = []
    for attempt in range(max_repairs + 1):
        ok, output = pxl_build(src, out_dir)
        if not ok:
            err = extract_error(output)
            print(f"  [build] attempt {attempt}: {err}", flush=True)
            history.append(f"build error: {err}")
            code = repair_source(code, err, "", model, docs)
            src.write_text(code)
            continue

        lint_out = pxl_lint(src)
        findings = summarise_lint(lint_out)
        clean = "0 findings" in lint_out or "clean" in findings.lower()
        print(f"  [lint] attempt {attempt}: "
              f"{'CLEAN' if clean else findings[:200]}", flush=True)
        if clean or attempt == max_repairs:
            break
        history.append(f"lint findings:\n{findings}")
        code = repair_source(code, "lint reported findings (no build error)",
                             findings, model, docs)
        src.write_text(code)

    # --- ASCII self-critique and repair --------------------------------
    # The linter only checks that the code is VALID. It says nothing about
    # whether the drawing READS as the subject. The rendered grid does.
    grid = ""
    if ascii_review:
        print("  [ascii] critiquing rendered grid", flush=True)
        problems, fixes = ascii_critique(src, name, subject,
                                         model=ascii_model)
        grid = pxl_ascii(src, name)
        result["ascii_problems"] = problems
        result["ascii_fixes"] = fixes
        result["ascii_grid"] = grid
        print(f"  [ascii] {problems or 'no problems found'}", flush=True)

        if fixes and ascii_rounds > 0:
            print("  [ascii] repairing from grid critique", flush=True)
            code = repair_source(
                code,
                "your sprite does not read as the intended subject:\n"
                + (problems or ""),
                "", model, docs, grid=grid)
            src.write_text(code)
            for attempt in range(max_repairs + 1):
                ok, output = pxl_build(src, out_dir)
                if not ok:
                    err = extract_error(output)
                    code = repair_source(code, err, "", model, docs, grid=grid)
                    src.write_text(code)
                    continue
                lint_out = pxl_lint(src)
                findings = summarise_lint(lint_out)
                clean = "0 findings" in lint_out or "clean" in findings.lower()
                if clean or attempt == max_repairs:
                    break
                code = repair_source(code, "lint reported findings",
                                     findings, model, docs, grid=grid)
                src.write_text(code)
            pxl_build(src, out_dir)
            grid = pxl_ascii(src, name)
            result["ascii_grid"] = grid
            # second look at the repaired grid
            problems2, fixes2 = ascii_critique(src, name, subject,
                                               model=ascii_model)
            result["ascii_problems_after"] = problems2
            print(f"  [ascii] after repair: {problems2 or 'no problems found'}",
                  flush=True)

    # final build so the PNG on disk matches the final source
    pxl_build(src, out_dir)

    sprite_png = out_dir / "sprites" / f"{name}.png"
    result = {
        "name": name, "subject": subject, "source": str(src),
        "sprite": str(sprite_png) if sprite_png.exists() else None,
        "lint": lint_out.strip(), "history": history,
    }

    if use_vision and sprite_png.exists():
        print("  [vision] critiquing sprite", flush=True)
        critique, brief = vision_critique(sprite_png, vision_model)
        result["critique"] = critique
        result["revised_brief"] = brief
        print(f"  [vision] {critique}", flush=True)

        # A brief that drifted to a different subject is worse than no brief.
        # llava at 16x16 hallucinates freely: a stone relic came back as
        # "a friendly leprechaun" and a museum case as "a cozy Irish pub".
        # Regenerating from a drifted brief replaces good art with nonsense,
        # so it is discarded.
        if brief and brief_has_drift(subject, brief):
            print("  [vision] brief drifted to another subject - DISCARDED",
                  flush=True)
            result["vision_brief_rejected"] = "drift"
            brief = None
        elif not brief:
            print("  [vision] empty critique - no regeneration", flush=True)
            result["vision_brief_rejected"] = "empty"

        if brief:
            print("  [vision] regenerating from revised brief", flush=True)
            code2 = generate_source(f"{subject}\n\nREVISED BRIEF: {brief}",
                                    name, size, colors, detail, model, docs)
            src2 = art_dir / f"{name}_v2.px.js"
            src2.write_text(code2)
            for attempt in range(max_repairs + 1):
                ok, output = pxl_build(src2, art_dir / "out_v2")
                if not ok:
                    err = extract_error(output)
                    code2 = repair_source(code2, err, "", model, docs)
                    src2.write_text(code2)
                    continue
                lint2 = pxl_lint(src2)
                findings = summarise_lint(lint2)
                clean = "0 findings" in lint2 or "clean" in findings.lower()
                if clean or attempt == max_repairs:
                    break
                code2 = repair_source(code2, "lint reported findings",
                                      findings, model, docs)
                src2.write_text(code2)
            pxl_build(src2, art_dir / "out_v2")
            result["v2_source"] = str(src2)
            result["v2_lint"] = pxl_lint(src2).strip()

    with open(art_dir / "report.json", "w") as f:
        json.dump(result, f, indent=2)
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--brief")
    ap.add_argument("--name", default="sprite")
    ap.add_argument("--size", type=int, default=16)
    ap.add_argument("--colors", type=int, default=10)
    ap.add_argument("--detail", default="")
    ap.add_argument("--out", default=str(HERE.parent / "art"))
    ap.add_argument("--model", default="qwen3-coder:30b")
    ap.add_argument("--vision-model", default="llava:34b")
    ap.add_argument("--no-vision", action="store_true")
    ap.add_argument("--batch")
    args = ap.parse_args()

    briefs = []
    if args.batch:
        with open(args.batch) as f:
            briefs = json.load(f)
    elif args.brief:
        briefs = [{"subject": args.brief, "name": args.name,
                   "size": args.size, "colors": args.colors,
                   "detail": args.detail}]
    else:
        ap.error("need --brief or --batch")

    results = []
    for b in briefs:
        r = build_asset(
            b.get("subject", ""), b.get("name", "sprite"), args.out,
            size=b.get("size", 16), colors=b.get("colors", 10),
            detail=b.get("detail", ""), model=args.model,
            vision_model=args.vision_model, use_vision=not args.no_vision)
        if r:
            results.append(r)
    print("\n" + "=" * 60)
    print(f"generated {len(results)}/{len(briefs)} assets")
    for r in results:
        print(f"  {r['name']}: {r['source']}")


if __name__ == "__main__":
    sys.exit(main())
