#!/usr/bin/env python3
"""Normalise the pixel grids in art/*/*.px.js.

Hand-drawn grid rows drift: one row comes out 15 columns, the next 17. pxl
pads short rows and crops long ones, so the shape silently changes and the
sprite no longer matches what was authored.

This fixes them the way an artist would: the shape is kept EXACTLY as drawn
(the distance of each row's content from the left edge is preserved relative
to the others) and the whole sprite is centred in its canvas. Every row is
then padded to the declared width.

Rows that are wider than the canvas are reported and left alone — those are
real mistakes that need a human decision about what to cut.

Usage: python3 tools/fix_grids.py [--dry]
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "art"

DRY = "--dry" in sys.argv


def normalise(grid: list, width: int):
    """Centre the shape and pad every row to `width`."""
    spans = []
    for row in grid:
        body = row.strip(".")
        if not body:
            spans.append(None)
            continue
        first = row.index(body[0])
        last = len(row) - 1 - row[::-1].index(body[-1])
        spans.append((first, last))

    live = [s for s in spans if s]
    if not live:
        return grid, []

    shape_w = max(l for _, l in live) - min(f for f, _ in live) + 1
    if shape_w > width:
        return grid, [f"shape is {shape_w} wide, canvas is {width}"]

    min_first = min(f for f, _ in live)
    shift = (width - shape_w) // 2 - min_first

    out = []
    for row, span in zip(grid, spans):
        if span is None:
            out.append("." * width)
            continue
        first, last = span
        first += shift
        last += shift
        if first < 0 or last >= width:
            return grid, [f"row {row!r} falls outside the canvas after centring"]
        out.append("." * first + row[span[0]:span[1] + 1] + "." * (width - last - 1))
    return out, []


def main() -> int:
    problems = 0
    for src in sorted(ART.glob("*/*.px.js")):
        stem = src.name[: -len(".px.js")]
        if stem != src.parent.name:
            continue
        text = src.read_text()
        m = re.search(r'sprite\(\s*"[^"]+"\s*,\s*\{\s*w:\s*(\d+)\s*,\s*h:\s*(\d+)', text)
        if not m:
            continue
        width = int(m.group(1))

        blocks = list(re.finditer(r"`([^`]*)`", text))
        target = None
        for b in blocks:
            lines = [ln.strip() for ln in b.group(1).splitlines() if ln.strip()]
            if lines and all(set(ln) <= set(".ABCDEFGHIJKLMNOPQRSTUVWXYZ") for ln in lines):
                target = b
                break
        if target is None:
            continue

        grid = [ln.strip() for ln in target.group(1).splitlines() if ln.strip()]
        fixed, errs = normalise(grid, width)
        if errs:
            print(f"{stem}: SKIPPED - {'; '.join(errs)}")
            problems += 1
            continue
        if fixed == grid:
            continue

        body = "\n".join("  " + r for r in fixed)
        new_text = text[:target.start(1)] + "\n" + body + "\n" + text[target.end(1):]
        if not DRY:
            src.write_text(new_text)
        print(f"{stem}: {len(grid)} rows centred to {width} cols")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
