#!/usr/bin/env python3
"""Print per-quadrant luminance and the colour set for one exported sprite.

Fast feedback loop while fixing the verifier's "lit from the wrong side"
check: shows the actual top-left / bottom-right means plus which palette
keys dominate each quadrant, so shading can be tuned by arithmetic rather
than by guessing.

Usage: python3 tools/light_check.py artefact_clay [name ...]
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ai"))

from verify_sprites import (  # noqa: E402
    ASSETS,
    HEX_TO_KEY,
    PALETTE_HEX,
    luminance,
    read_png,
)


def report(name: str) -> None:
    path = ASSETS / f"{name}.png"
    if not path.exists():
        print(f"{name}: MISSING {path}")
        return
    width, height, rgba = read_png(path)
    mid_x = width / 2.0
    mid_y = height / 2.0
    lum_by_key = {k: luminance(v) for k, v in PALETTE_HEX.items()}

    tl: list[float] = []
    br: list[float] = []
    tl_c: dict[str, int] = {}
    br_c: dict[str, int] = {}
    colours: set[str] = set()

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
                tl_c[key] = tl_c.get(key, 0) + 1
            elif x >= mid_x and y >= mid_y:
                br.append(lum)
                br_c[key] = br_c.get(key, 0) + 1

    def fmt(counts: dict[str, int]) -> str:
        return ", ".join(f"{k}:{v}" for k, v in sorted(counts.items()))

    if tl and br:
        tl_mean = sum(tl) / len(tl)
        br_mean = sum(br) / len(br)
        verdict = "OK" if tl_mean > br_mean else "FAIL"
        print(
            f"{name}: {verdict}  tl={tl_mean:.3f} (n={len(tl)})  "
            f"br={br_mean:.3f} (n={len(br)})  colours={''.join(sorted(colours))} "
            f"({len(colours)})"
        )
        print(f"    tl mix: {fmt(tl_c)}")
        print(f"    br mix: {fmt(br_c)}")
    else:
        print(f"{name}: quadrant empty  colours={''.join(sorted(colours))}")


def main() -> int:
    for name in sys.argv[1:] or ["artefact_clay"]:
        report(name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
