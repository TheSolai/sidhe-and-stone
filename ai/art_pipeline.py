#!/usr/bin/env python3
"""
GameStewKit local art pipeline. Every stage runs on this machine.
No API keys, no network calls, no per-image cost.

THE CHAIN
    1. SDXL-Turbo (local diffusers, MPS) renders a concept image.
    2. Sprite Fusion Pixel Snapper snaps it onto a true pixel grid and
       quantises to a strict palette, preserving dithering detail.
    3. pxl trace converts the snapped PNG into EDITABLE pxl source (.px.js),
       so the result is not a dead raster: it is art-as-code that can be
       tweaked, re-ramped, re-lit and re-linted.
    4. pxl lint critiques the built pixels (orphan pixels, jaggies, pillow
       shading, near-duplicate colours, palette bloat) and writes an overlay
       PNG marking exactly which pixels are wrong.
    5. A local Ollama vision model (llava:34b) looks at the art and writes a
       replacement prompt for a second pass, which is re-traced and re-built.

    pxl build --godot writes Godot 4 SpriteFrames .tres beside every sheet,
    so the output drops straight into the engine.

Usage:
    python art_pipeline.py --concept "lucky shamrock charm" --name charm
    python art_pipeline.py --batch concepts.json
    python art_pipeline.py --critique-only
"""

import argparse
import base64
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
OUT_DIR = HERE / "art"
PXL_DIR = HERE.parent / "tools" / "pxl"
NODE = shutil.which("node") or "/Users/amre/.openclaw/tools/node-v24.21.0/bin/node"
SNAPPER = shutil.which("spritefusion-pixel-snapper") or "spritefusion-pixel-snapper"

# Curated Irish-cozy palette. Constraining output to a palette is the single
# biggest visual win for Kairosoft-adjacent art: it forces the greens and
# golds of the Irish palette to actually appear instead of wandering into
# generic fantasy purples.
IRISH_PALETTE = [
    "0d2b45", "203c56", "344966", "4c6b8a",
    "8d697a", "d08159", "ffaa5e", "ffd4a3",
    "ffecd6", "1b4332", "2d6a4f", "40916c",
    "52b788", "74c69d", "95d5b2", "b7e4c7",
]


# ------------------------------------------------------------------ helpers

def run(cmd, timeout=600, cwd=None):
    print(f"    $ {' '.join(str(c) for c in cmd[:4])} ...", flush=True)
    try:
        res = subprocess.run([str(c) for c in cmd], capture_output=True,
                             text=True, timeout=timeout, cwd=cwd)
    except subprocess.TimeoutExpired:
        print("    ! timed out", flush=True)
        return None
    if res.returncode != 0:
        print(f"    ! exit {res.returncode}: {(res.stderr or res.stdout or '')[:300]}",
              flush=True)
        return res
    return res


# ------------------------------------------------------------------ stage 1

def load_pipeline(model="stabilityai/sdxl-turbo"):
    import torch
    from diffusers import AutoPipelineForText2Image

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    dtype = torch.float16 if device == "mps" else torch.float32

    print(f"[1] loading {model} on {device} ({dtype})", flush=True)
    pipe = AutoPipelineForText2Image.from_pretrained(
        model, torch_dtype=dtype,
        variant="fp16" if device == "mps" else None,
        use_safetensors=True,
    )
    pipe.to(device)
    pipe.set_progress_bar_config(disable=True)
    print("[1] pipeline ready", flush=True)
    return pipe


def generate_raw(pipe, prompt, out_path, size=1024, steps=4, seed=0):
    import torch

    g = torch.Generator(device="cpu").manual_seed(seed)
    result = pipe(prompt=prompt, num_inference_steps=steps, guidance_scale=0.0,
                  width=size, height=size, generator=g)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    result.images[0].save(out_path)
    print(f"[1] rendered {out_path.name}", flush=True)
    return out_path


# ------------------------------------------------------------------ stage 2

def snap(input_path, output_path, colors=16, pixel_size=8, palette=None):
    cmd = [SNAPPER, str(input_path), str(output_path), str(colors)]
    if pixel_size:
        cmd += ["--pixel-size", str(pixel_size)]
    if palette:
        cmd += ["--palette", ",".join(palette)]
    res = run(cmd, timeout=180)
    return res is not None and res.returncode == 0


# ------------------------------------------------------------------ stage 3

def pxl_trace(input_png, out_js, name="traced", colors=16, palette="pico8",
              dither=0.0, width=32):
    cmd = [NODE, "bin/pxl.js", "trace", str(input_png), "--name", name,
           "--out", str(out_js), "--colors", str(colors), "--dither", str(dither)]
    if palette and palette != "auto":
        cmd += ["--palette", palette]
    if width:
        cmd += ["--w", str(width)]
    res = run(cmd, timeout=300, cwd=str(PXL_DIR))
    return out_js.exists()


def pxl_cleanup(art_js, passes=4):
    """Absorb isolated noise pixels in the traced grid (see pxl_cleanup.py)."""
    res = run([sys.executable, str(HERE / "pxl_cleanup.py"), str(art_js),
               "--passes", str(passes)], timeout=180)
    return (res.stdout or "").strip() if res else ""


def pxl_build(art_js, out_dir, godot=True):
    cmd = [NODE, "bin/pxl.js", "build", str(art_js), "--out", str(out_dir)]
    if godot:
        cmd.append("--godot")
    res = run(cmd, timeout=300, cwd=str(PXL_DIR))
    return res is not None and res.returncode == 0


def pxl_lint(art_js, out_dir=None):
    cmd = [NODE, "bin/pxl.js", "lint", str(art_js)]
    res = run(cmd, timeout=300, cwd=str(PXL_DIR))
    return (res.stdout or "").strip() if res else ""


# ------------------------------------------------------------------ stage 5

CRITIQUE_PROMPT = """You are a senior pixel artist art-directing a Kairosoft-style \
cozy management game with Irish folklore themes. You are shown a generated game asset.

Critique it HARD and SPECIFICALLY. Judge:
1. READABILITY - at small size, is the silhouette instantly clear? What merges into what?
2. PALETTE - is it muddy, or too many competing hues? Name the exact problem.
3. PIXEL CRAFT - does it look like deliberate pixel art, or a painterly image shrunk down?
4. MOOD - does it read as cosy Irish folklore charm, or generic fantasy?
5. ONE SPECIFIC FIX - the single highest-impact change.

Then write a REPLACEMENT PROMPT that fixes all of the above. One paragraph, under \
60 words, describing exactly what the image should look like. It must start with \
"pixel art game asset" and include palette colours, lighting, and subject.

Reply in this exact format:
CRITIQUE: <3-5 short lines>
PROMPT: <the replacement prompt>"""


def critique_with_ollama(image_path, model="llava:34b", timeout=420):
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": CRITIQUE_PROMPT, "images": [b64]}],
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 400},
    }
    try:
        out = subprocess.run(
            ["curl", "-s", "--max-time", str(timeout),
             "http://localhost:11434/api/chat", "-d", json.dumps(payload)],
            capture_output=True, text=True, timeout=timeout + 30)
        data = json.loads(out.stdout)
        content = data.get("message", {}).get("content", "")
    except Exception as exc:  # noqa: BLE001
        print(f"[5] critique FAILED ({exc})", flush=True)
        return None, None
    if not content.strip():
        return None, None
    critique, new_prompt = None, None
    for line in content.splitlines():
        s = line.strip()
        if s.upper().startswith("CRITIQUE:"):
            critique = s.split(":", 1)[1].strip()
        elif s.upper().startswith("PROMPT:"):
            new_prompt = s.split(":", 1)[1].strip()
    if not new_prompt:
        new_prompt = content.strip().split("\n")[-1].strip()
    return critique, new_prompt


# ------------------------------------------------------------------ main

def build_one(pipe, name, prompt, out_dir, seed, size, steps, colors,
              pixel_size, palette, do_critique, critique_model, sprite_w=32):
    art_dir = out_dir / name
    art_dir.mkdir(parents=True, exist_ok=True)

    base = (f"{prompt}, pixel art game asset, irish folklore charm, cozy game "
            f"art, limited palette, crisp hard pixel edges, flat cel shading, "
            f"no anti-aliasing, simple readable silhouette, centered subject, "
            f"plain light background")

    print(f"\n=== {name} ===", flush=True)
    print(f"[1] generate (seed {seed})", flush=True)
    raw = art_dir / f"{name}_raw.png"
    generate_raw(pipe, base, raw, size, steps, seed)

    print("[2] snap to pixel grid", flush=True)
    snapped = art_dir / f"{name}_snapped.png"
    if not snap(raw, snapped, colors, pixel_size, palette):
        print("[2] snap failed, using raw", flush=True)
        snapped = raw

    print("[3] trace to pxl source", flush=True)
    js = art_dir / f"{name}.px.js"
    if not pxl_trace(snapped, js, name=name, colors=16, width=sprite_w):
        print("[3] trace failed", flush=True)
        return None

    print("[4] clean grid + build + lint", flush=True)
    cleanup_log = pxl_cleanup(js)
    build_dir = art_dir / "out"
    pxl_build(js, build_dir, godot=True)
    lint_report = pxl_lint(js)
    print("[4] lint:\n" + (lint_report or "(clean)"), flush=True)

    result = {"name": name, "px_source": str(js), "lint": lint_report,
              "cleanup": cleanup_log}

    if do_critique:
        print("[5] vision critique", flush=True)
        built = build_dir / "sprites" / f"{name}.png"
        target = built if built.exists() else snapped
        critique, new_prompt = critique_with_ollama(target, critique_model)
        if new_prompt:
            result["critique"] = critique
            result["revised_prompt"] = new_prompt
            print("[5]", (critique or "")[:300], flush=True)
            print("[5] pass 2 with revised prompt", flush=True)
            raw2 = art_dir / f"{name}_raw2.png"
            generate_raw(pipe, new_prompt, raw2, size, steps, seed + 1000)
            snapped2 = art_dir / f"{name}_snapped2.png"
            if snap(raw2, snapped2, colors, pixel_size, palette):
                js2 = art_dir / f"{name}_v2.px.js"
                if pxl_trace(snapped2, js2, name=f"{name}_v2", colors=16,
                             width=sprite_w):
                    pxl_cleanup(js2)
                    pxl_build(js2, art_dir / "out_v2", godot=True)
                    result["v2_px_source"] = str(js2)
                    result["v2_lint"] = pxl_lint(js2)

    with open(art_dir / "report.json", "w") as f:
        json.dump(result, f, indent=2)
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--concept")
    ap.add_argument("--name", default="concept")
    ap.add_argument("--batch")
    ap.add_argument("--out", default=str(OUT_DIR))
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument("--steps", type=int, default=4)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--colors", type=int, default=16)
    ap.add_argument("--pixel-size", type=int, default=8)
    ap.add_argument("--sprite-width", type=int, default=32)
    ap.add_argument("--irish-palette", action="store_true")
    ap.add_argument("--critique-model", default="llava:34b")
    ap.add_argument("--no-critique", action="store_true")
    ap.add_argument("--critique-only", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    palette = IRISH_PALETTE if args.irish_palette else None

    if args.critique_only:
        for png in sorted(out_dir.rglob("*.png")):
            if "_raw" in png.name or "_snapped" in png.name:
                continue
            c, p = critique_with_ollama(png, args.critique_model)
            print(f"\n=== {png} ===")
            print("CRITIQUE:", c)
            print("PROMPT:", p)
        return

    concepts = []
    if args.batch:
        with open(args.batch) as f:
            concepts = json.load(f)
    elif args.concept:
        concepts = [{"name": args.name, "prompt": args.concept}]
    else:
        ap.error("need --concept or --batch")

    pipe = load_pipeline()
    for i, item in enumerate(concepts):
        build_one(
            pipe,
            item.get("name", f"concept_{i}"),
            item.get("prompt", ""),
            out_dir,
            item.get("seed", args.seed + i),
            args.size, args.steps, args.colors, args.pixel_size,
            palette, not args.no_critique, args.critique_model,
            args.sprite_width,
        )


if __name__ == "__main__":
    sys.exit(main())
