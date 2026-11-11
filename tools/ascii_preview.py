#!/usr/bin/env python3
"""Render exported sprites as coloured ASCII in the terminal.

Visual QA for pixel art has to happen somewhere. If the model reading this
cannot see images, the next best thing is a text rendering where every
palette key maps to a letter, so the shape and the shading can both be read
directly.

Usage:
    python3 tools/ascii_preview.py artefact_clay
    python3 tools/ascii_preview.py --all
    python3 tools/ascii_preview.py --all --grid
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ai"))

from verify_sprites import ASSETS, HEX_TO_KEY, read_png  # noqa: E402

# One letter per palette key, chosen so similar tones do not collide.
GLYPH = {
    "K": "#", "D": "d", "P": "p",
    "N": "n", "S": "s", "Z": "z",
    "X": "x", "C": "c", "W": "w",
    "A": "a", "Y": "y", "G": "g", "H": "h",
    "T": "t", "M": "m", "L": "l", "E": "e", "I": "i", "U": "u", "R": "r",
}


def render(name: str, grid: bool = False) -> None:
    path = ASSETS / f"{name}.png"
    if not path.exists():
        print(f"{name}: MISSING")
        return
    width, height, rgba = read_png(path)
    print(f"--- {name}  {width}x{height} ---")
    for y in range(height):
        row = []
        for x in range(width):
            i = (y * width + x) * 4
            if rgba[i + 3] == 0:
                row.append(".")
                continue
            hexv = "#%02x%02x%02x" % (rgba[i], rgba[i + 1], rgba[i + 2])
            key = HEX_TO_KEY.get(hexv)
            row.append(GLYPH.get(key, "?") if key else "?")
        line = "".join(row)
        print(line)
    if grid:
        print("    " + "".join(str(x % 10) for x in range(width)))


def main() -> int:
    args = sys.argv[1:]
    grid = "--grid" in args
    args = [a for a in args if not a.startswith("--")]
    names = args or ["artefact_clay"]
    if names == ["--all"] or names == ["all"]:
        names = sorted(p.stem for p in ASSETS.glob("*.png"))
    for name in names:
        render(name, grid)
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
