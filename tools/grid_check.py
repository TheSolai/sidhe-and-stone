#!/usr/bin/env python3
"""Fast pre-flight check for sprite grids, before running the slow pxl build.

This mirrors the mechanical rules in ai/verify_sprites.py — colour budget,
top-left lighting, single connected silhouette, grid/canvas agreement — but
it works on the source grid directly. It simulates the 1px K outline that
pxl adds on export, because the outline pixels count toward the lighting
quadrants, and it gets the luminance numbers from the shared palette.

It is a writing aid, not the gate. ai/verify_sprites.py still checks the
real PNGs; this exists so a bad grid is caught in a second rather than
after a full build of every sprite in the set.

The palette, the luminance function and the source parser are IMPORTED from
ai/verify_sprites.py rather than copied. They used to be duplicated here,
which meant a palette change had to be made in two places by hand and a
missed copy reported phantom failures. Now there is one Python source of
truth for the shared palette, and the two tools cannot drift apart.

Run: python3 tools/grid_check.py <sprite-name> [...]
       python3 tools/grid_check.py --all
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "art"

sys.path.insert(0, str(ROOT / "ai"))

from verify_sprites import (  # noqa: E402
    LEGAL_KEYS,
    PALETTE_HEX,
    luminance,
    parse_source,
)

MIN_COLOURS = 3
MAX_COLOURS = 7
ALLOWED_CANVASES = {(16, 16), (24, 24)}


def with_outline(grid, w, h):
    """The exported canvas: grid plus a 1px K outline on every side.

    The outline is 4-connected, matching pxl's Img.outline() with
    diagonal=false (tools/pxl/src/core/image.ts). Getting this wrong
    changes the lighting quadrants, because the K outline is dark and
    lands unevenly across the sprite.
    """
    ew, eh = w + 2, h + 2
    canvas = [["." for _ in range(ew)] for _ in range(eh)]
    for y in range(h):
        for x in range(w):
            canvas[y + 1][x + 1] = grid[y][x]
    opaque = {(x, y) for y in range(eh) for x in range(ew)
              if canvas[y][x] != "."}
    for (x, y) in opaque:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < ew and 0 <= ny < eh and canvas[ny][nx] == ".":
                canvas[ny][nx] = "K"
    return canvas, ew, eh


def check(name: str):
    path = ART / name / f"{name}.px.js"
    if not path.exists():
        return [f"missing source {path}"]
    problems = []
    declared, w, h, grid, text = parse_source(path)

    if declared != name:
        problems.append(f"declares sprite name {declared!r}")
    if 'include("../palette.px.js")' not in text:
        problems.append("does not include the shared palette")
    if 'use("pico8")' in text:
        problems.append('calls use("pico8")')
    if re.search(r"^\s*pal\(\{", text, re.M):
        problems.append("declares its own pal({...})")
    # A sprite built from ops (ring/line/circ) has no grid string. The
    # real verifier skips its grid checks in that case, so this does too.
    if grid is None:
        return problems
    if (w, h) not in ALLOWED_CANVASES:
        problems.append(f"canvas is {w}x{h}; only 16x16 and 24x24 are allowed")
    if len(grid) != h:
        problems.append(f"grid has {len(grid)} rows, declared h={h}")
    for i, row in enumerate(grid):
        if len(row) != w:
            problems.append(f"row {i} has {len(row)} cols, declared w={w}")
        for ch in row:
            if ch != "." and ch not in PALETTE_HEX:
                problems.append(f"row {i} uses illegal palette key {ch!r}")
            if ch == "I":
                problems.append(f"row {i} uses the forbidden key 'I'")
    # Keys used in the body (rect/px/poly calls) must be legal too. A grid
    # string is not the only way a colour reaches the canvas.
    for key in re.findall(r'[,(\s]"([A-Z])"', text):
        if key not in LEGAL_KEYS:
            problems.append(f"uses illegal palette key {key!r} in a draw call")
        if key == "I":
            problems.append("uses the forbidden key 'I' in a draw call")
    if problems:
        return problems

    canvas, ew, eh = with_outline(grid, w, h)
    colours = {c for row in canvas for c in row if c != "."}
    if not (MIN_COLOURS <= len(colours) <= MAX_COLOURS):
        problems.append(
            f"uses {len(colours)} colours ({''.join(sorted(colours))}); "
            f"the budget is {MIN_COLOURS}-{MAX_COLOURS}")

    lum = {k: luminance(v) for k, v in PALETTE_HEX.items()}
    tl, br = [], []
    mx, my = ew / 2.0, eh / 2.0
    for y in range(eh):
        for x in range(ew):
            c = canvas[y][x]
            if c == ".":
                continue
            if x < mx and y < my:
                tl.append(lum[c])
            elif x >= mx and y >= my:
                br.append(lum[c])
    if tl and br:
        tlm, brm = sum(tl) / len(tl), sum(br) / len(br)
        if tlm <= brm:
            problems.append(
                f"lit from the wrong side: top-left averages {tlm:.3f} against "
                f"{brm:.3f} for the bottom-right")

    opaque = {(x, y) for y in range(eh) for x in range(ew)
              if canvas[y][x] != "."}
    if opaque:
        start = next(iter(opaque))
        seen, stack = {start}, [start]
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
            problems.append(f"{len(opaque) - len(seen)} detached island pixel(s)")
    return problems


def main() -> int:
    args = sys.argv[1:]
    if not args or args[0] == "--all":
        names = sorted(p.parent.name for p in ART.glob("*/*.px.js"))
    else:
        names = args
    failures = 0
    for name in names:
        problems = check(name)
        if problems:
            failures += 1
            print(f"  FAIL {name}:")
            for p in problems:
                print(f"       - {p}")
        else:
            print(f"  ok   {name}")
    print(f"\nGrid check: {len(names)} sprites, {failures} failures")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
