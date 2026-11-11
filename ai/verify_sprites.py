#!/usr/bin/env python3
"""Verify the sprite set: shared palette, sync, and pixel integrity.

This is the check that keeps the set coherent. It asserts, for every
sprite:

  1. SOURCE RULES
     - the source includes the shared palette (art/palette.px.js)
     - it does NOT call use("pico8") or declare its own pal({...})
     - it uses only legal palette keys, and never "I"
  2. SOURCE/EXPORT AGREEMENT
     - the declared sprite dimensions match the grid in the source
     - the staged PNG has exactly grid + 1px outline margin per side
  3. PIXEL INTEGRITY
     - every opaque pixel is an exact entry of the shared palette
     - alpha is binary (0 or 255) — no semi-transparent edges
     - the opaque shape is a SINGLE 8-connected region, with no detached
       islands (an orphan speck is a lint failure waiting to happen)
  4. ART DIRECTION (art/ART_DIRECTION.md)
     - the canvas is 16x16 or 24x24, nothing else
     - the sprite uses between three and seven distinct colours
     - the sprite is lit from the top-left: the top-left quadrant of its
       opaque pixels is brighter on average than the bottom-right quadrant
  5. DEPLOYMENT SYNC
     - web/public/sprites/<name>.png is byte-identical to
       assets/sprites/<name>.png
     - atlas.json lists every sprite with its true dimensions

No Pillow: the PNGs are palette-indexed (colour type 3), so they are
decoded directly with zlib. That keeps this runnable on a bare Python.

Run: python3 ai/verify_sprites.py
"""

import json
import re
import struct
import sys
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ART = ROOT / "art"
ASSETS = ROOT / "assets" / "sprites"
WEB_SPRITES = ROOT / "web" / "public" / "sprites"

# The shared palette, mirrored from art/palette.px.js.
PALETTE_HEX = {
    "K": "#1e1a16", "D": "#362a21", "P": "#46382a",
    "N": "#716855", "S": "#c17c50", "Z": "#c69a6b",
    "X": "#d6d4c8", "C": "#e8dcc5", "W": "#f7f2e3",
    "A": "#b98053", "Y": "#dda742", "G": "#e5b63d", "H": "#efd788",
    "T": "#c3613d", "M": "#82a156", "L": "#5f9f90",
    "E": "#6fd8e4", "I": "#a8e8ef", "U": "#8896a3", "R": "#aca496",
}
LEGAL_KEYS = set(PALETTE_HEX)
HEX_TO_KEY = {v.lower(): k for k, v in PALETTE_HEX.items()}

SPRITES = [
    "artefact_clay", "artefact_crown", "artefact_mask", "artefact_relic",
    "artefact_rubble", "artefact_tablet",
    "curator", "dig_site", "gallery_case", "reel_wheel",
    "icon_charm", "icon_coin", "icon_demand",
    "symbol_blight", "symbol_bog", "symbol_clover", "symbol_honey",
    "symbol_moon", "symbol_star",
    "visitor_a", "visitor_b", "visitor_c",
    # The one dig site, seen five ways.
    "dig_test_pit", "dig_trench", "dig_cutting", "dig_shaft",
    "dig_deepworks",
    # One icon per upgrade in the shop.
    "upgrade_site", "upgrade_curator", "upgrade_gallery", "upgrade_omen",
    "upgrade_diggers", "upgrade_excavators", "upgrade_guides",
    "upgrade_archivists", "upgrade_wards",
]

# The only canvas sizes the art direction allows.
ALLOWED_CANVASES = {(16, 16), (24, 24)}

# A sprite must use at least three colours (a silhouette is not a drawing)
# and at most seven (one shared palette means you cannot invent shades).
MIN_COLOURS = 3
MAX_COLOURS = 7


def luminance(hexv: str) -> float:
    """Relative luminance of a palette hex, 0.0 to 1.0."""
    r = int(hexv[1:3], 16) / 255.0
    g = int(hexv[3:5], 16) / 255.0
    b = int(hexv[5:7], 16) / 255.0
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


class Fail(Exception):
    pass


def read_png(path: Path):
    """Decode a non-interlaced palette-indexed PNG into (w, h, rgba)."""
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise Fail("not a PNG")
    pos = 8
    width = height = depth = ctype = interlace = None
    plte = b""
    trns = b""
    idat = b""
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        ctag = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        if ctag == b"IHDR":
            (width, height, depth, ctype, _comp, _filt,
             interlace) = struct.unpack(">IIBBBBB", chunk)
        elif ctag == b"PLTE":
            plte = chunk
        elif ctag == b"tRNS":
            trns = chunk
        elif ctag == b"IDAT":
            idat += chunk
        elif ctag == b"IEND":
            break
        pos += 12 + length

    if depth != 8 or ctype != 3:
        raise Fail(f"expected 8-bit palette PNG, got depth={depth} type={ctype}")
    if interlace != 0:
        raise Fail("interlaced PNG")

    raw = zlib.decompress(idat)
    bpp = 1
    stride = width
    out = []
    prev = bytearray(stride)
    pos = 0
    for _ in range(height):
        ftype = raw[pos]
        pos += 1
        line = bytearray(raw[pos:pos + stride])
        pos += stride
        if ftype == 1:
            for i in range(bpp, stride):
                line[i] = (line[i] + line[i - bpp]) & 0xFF
        elif ftype == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ftype == 3:
            for i in range(stride):
                left = line[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        elif ftype != 0:
            raise Fail(f"bad filter type {ftype}")
        out.append(bytes(line))
        prev = line

    # tRNS gives the alpha of each palette index, in order. A missing
    # entry means opaque. Without this, the transparent index reads as
    # opaque black and every sprite looks full of off-palette pixels.
    alpha = [255] * (len(plte) // 3)
    for i, a in enumerate(trns):
        if i < len(alpha):
            alpha[i] = a

    rgba = bytearray()
    for line in out:
        for idx in line:
            r, g, b = plte[idx * 3:idx * 3 + 3]
            rgba += bytes((r, g, b, alpha[idx]))
    return width, height, bytes(rgba)


def parse_source(path: Path):
    """Pull the declared size and the grid body out of a .px.js source."""
    text = path.read_text()
    m = re.search(r'sprite\(\s*"([^"]+)"\s*,\s*\{\s*w:\s*(\d+)\s*,\s*h:\s*(\d+)', text)
    if not m:
        raise Fail("no sprite() declaration found")
    name, w, h = m.group(1), int(m.group(2)), int(m.group(3))
    grid = None
    for block in re.findall(r"`([^`]*)`", text):
        lines = [ln for ln in block.splitlines() if ln.strip()]
        if lines and all(set(ln.strip()) <= set(".ABCDEFGHIJKLMNOPQRSTUVWXYZ")
                          for ln in lines):
            grid = [ln.strip() for ln in lines]
            break
    return name, w, h, grid, text


def check_source(name: str) -> list:
    problems = []
    path = ART / name / f"{name}.px.js"
    if not path.exists():
        return [f"missing source {path}"]

    declared, w, h, grid, text = parse_source(path)

    if declared != name:
        problems.append(f"declares sprite name {declared!r}")
    if 'include("../palette.px.js")' not in text:
        problems.append("does not include the shared palette")
    if 'use("pico8")' in text:
        problems.append('calls use("pico8") instead of the shared palette')
    if re.search(r"^\s*pal\(\{", text, re.M):
        problems.append("declares its own pal({...})")

    # Only legal palette keys may be used in the grid, and never "I".
    if grid:
        for row in grid:
            for ch in row:
                if ch == ".":
                    continue
                if ch not in LEGAL_KEYS:
                    problems.append(f"uses illegal palette key {ch!r}")
                if ch == "I":
                    problems.append("uses palette key 'I'")
        if len(grid) != h:
            problems.append(f"grid has {len(grid)} rows, declared h={h}")
        for row in grid:
            if len(row) != w:
                problems.append(f"grid row has {len(row)} cols, declared w={w}")

    # Keys used in the body (poly/rect/px calls) must be legal too.
    for key in re.findall(r'[,(\s]"([A-Z])"', text):
        if key not in LEGAL_KEYS:
            problems.append(f"uses illegal palette key {key!r} in a draw call")

    return problems


def check_pixels(name: str) -> list:
    problems = []
    path = ASSETS / f"{name}.png"
    if not path.exists():
        return [f"missing staged PNG {path}"]

    width, height, rgba = read_png(path)
    _, w, h, grid, _ = parse_source(ART / name / f"{name}.px.js")

    # The export is the grid plus a 1px outline margin on each side.
    if grid:
        exp_w, exp_h = w + 2, h + 2
        if (width, height) != (exp_w, exp_h):
            problems.append(
                f"PNG is {width}x{height}, expected {exp_w}x{exp_h} "
                f"(grid {w}x{h} + 1px outline margin)"
            )

    opaque = set()
    for y in range(height):
        for x in range(width):
            i = (y * width + x) * 4
            r, g, b, a = rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]
            if a == 0:
                continue
            # Alpha must be binary: a semi-transparent edge pixel would
            # blend against whatever is behind it and produce a colour
            # that is not in the palette.
            if a != 255:
                problems.append(
                    f"pixel ({x},{y}) has alpha {a}, expected 0 or 255"
                )
                continue
            hexv = "#%02x%02x%02x" % (r, g, b)
            if hexv not in HEX_TO_KEY:
                problems.append(f"pixel ({x},{y}) is off-palette {hexv}")
            opaque.add((x, y))

    # A single 8-connected opaque region: no detached islands.
    if opaque:
        start = next(iter(opaque))
        seen = {start}
        stack = [start]
        while stack:
            cx, cy = stack.pop()
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    n = (cx + dx, cy + dy)
                    if n in opaque and n not in seen:
                        seen.add(n)
                        stack.append(n)
        if len(seen) != len(opaque):
            problems.append(
                f"opaque shape has detached islands: {len(opaque) - len(seen)} "
                f"pixel(s) not reachable from the main body"
            )
    return problems


def check_style(name: str) -> list:
    """The mechanical half of the art direction.

    Three rules, all of them checkable:
      - the canvas is one of the two allowed sizes
      - the colour budget is respected
      - the sprite is lit from the top-left
    """
    problems = []
    _, w, h, grid, _ = parse_source(ART / name / f"{name}.px.js")

    if (w, h) not in ALLOWED_CANVASES:
        problems.append(
            f"canvas is {w}x{h}; the art direction allows only 16x16 and 24x24"
        )

    width, height, rgba = read_png(ASSETS / f"{name}.png")

    # Collect the opaque pixels, by colour key.
    lum_by_key = {k: luminance(v) for k, v in PALETTE_HEX.items()}
    colours = set()
    tl = []
    br = []
    mid_x = width / 2.0
    mid_y = height / 2.0

    for y in range(height):
        for x in range(width):
            i = (y * width + x) * 4
            if rgba[i + 3] == 0:
                continue
            hexv = "#%02x%02x%02x" % (rgba[i], rgba[i + 1], rgba[i + 2])
            key = HEX_TO_KEY.get(hexv)
            if key is None:
                continue
            colours.add(key)
            lum = lum_by_key[key]
            if x < mid_x and y < mid_y:
                tl.append(lum)
            elif x >= mid_x and y >= mid_y:
                br.append(lum)

    if len(colours) < MIN_COLOURS:
        problems.append(
            f"uses {len(colours)} colour(s); the art direction requires at "
            f"least {MIN_COLOURS} — a silhouette is not a drawing"
        )
    if len(colours) > MAX_COLOURS:
        problems.append(
            f"uses {len(colours)} colours ({''.join(sorted(colours))}); the "
            f"budget is {MAX_COLOURS} — one shared palette means no new shades"
        )

    # Light from the top-left. If either quadrant is empty there is nothing
    # to compare, and a symmetric sprite (a wheel, a coin) has no direction
    # to violate anyway.
    if tl and br:
        tl_mean = sum(tl) / len(tl)
        br_mean = sum(br) / len(br)
        if tl_mean <= br_mean:
            problems.append(
                f"is lit from the wrong side: top-left quadrant averages "
                f"{tl_mean:.3f} luminance against {br_mean:.3f} for the "
                f"bottom-right — the light comes from the top-left"
            )

    return problems


def check_sync(name: str) -> list:
    problems = []
    a = ASSETS / f"{name}.png"
    b = WEB_SPRITES / f"{name}.png"
    if not b.exists():
        return [f"missing web sprite {b}"]
    if a.read_bytes() != b.read_bytes():
        problems.append("web/public copy differs from assets/sprites copy")
    return problems


def main() -> int:
    failures = 0
    checks = 0

    atlas_path = WEB_SPRITES / "atlas.json"
    atlas = {}
    if atlas_path.exists():
        atlas = json.loads(atlas_path.read_text())

    for name in SPRITES:
        problems = (check_source(name) + check_pixels(name)
                    + check_style(name) + check_sync(name))

        if name in atlas:
            checks += 1
            width, height, _ = read_png(ASSETS / f"{name}.png")
            if atlas[name].get("w") != width or atlas[name].get("h") != height:
                problems.append(
                    f"atlas.json says {atlas[name].get('w')}x{atlas[name].get('h')}, "
                    f"PNG is {width}x{height}"
                )
            if atlas[name].get("file") != f"{name}.png":
                problems.append("atlas.json has the wrong file name")
        else:
            problems.append("not listed in atlas.json")

        checks += 1
        if problems:
            failures += 1
            print(f"  FAIL {name}:")
            for p in problems:
                print(f"       - {p}")
        else:
            print(f"  ok   {name}")

    print(f"\nSprite verification: {checks} checks, {failures} failures")
    if failures:
        print("SPRITE VERIFICATION FAILED")
        return 1
    print("ALL CHECKS PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
