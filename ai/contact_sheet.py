#!/usr/bin/env python3
"""Build a labelled contact sheet from the generated sprites.

Visual QA needs to see the sprites TOGETHER, not one at a time: sprites are
judged as a set, and the set is where palette drift shows up. One sheet also
costs one image in the model's context instead of eight.

The sheet is also where the "does this read as deliberate pixel art" question
gets answered honestly, because the sprites are shown at the size the player
will actually see them: small.

Usage:
    python3 ai/contact_sheet.py --in art/sprites --out art/contact_sheet.png
"""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

# The player's palette. Checkerboard shows transparency honestly.
BG = (22, 18, 15)
CELL = 96
PAD = 8
LABEL_H = 14


def checker(size, a=(45, 38, 30), b=(32, 27, 22)):
    w, h = size
    img = Image.new("RGB", size, a)
    d = ImageDraw.Draw(img)
    s = 8
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2 == 0:
                d.rectangle([x, y, x + s - 1, y + s - 1], fill=b)
    return img


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="indir", default="art/sprites")
    ap.add_argument("--out", default="art/contact_sheet.png")
    ap.add_argument("--scale", type=int, default=6)
    args = ap.parse_args()

    files = sorted(Path(args.indir).glob("*.png"))
    if not files:
        print("no sprites found in %s" % args.indir)
        return 1

    cols = 4
    rows = (len(files) + cols - 1) // cols
    sheet_w = cols * (CELL + PAD) + PAD
    sheet_h = rows * (CELL + LABEL_H + PAD) + PAD

    sheet = Image.new("RGB", (sheet_w, sheet_h), BG)
    draw = ImageDraw.Draw(sheet)

    for i, f in enumerate(files):
        r, c = divmod(i, cols)
        x = PAD + c * (CELL + PAD)
        y = PAD + r * (CELL + LABEL_H + PAD)

        # checkerboard behind, so alpha is visible
        sheet.paste(checker((CELL, CELL)), (x, y))

        try:
            sp = Image.open(f).convert("RGBA")
        except Exception as exc:  # noqa: BLE001
            print("skip %s: %s" % (f.name, exc))
            continue

        # Scale by integer factor so pixels stay hard-edged and square.
        scale = max(1, min(args.scale,
                           max(1, min(CELL // max(1, sp.width),
                                      CELL // max(1, sp.height)))))
        big = sp.resize((sp.width * scale, sp.height * scale), Image.NEAREST)
        ox = x + (CELL - big.width) // 2
        oy = y + (CELL - big.height) // 2
        sheet.paste(big, (ox, oy), big)

        draw.text((x + 2, y + CELL + 2), f.stem[:16], fill=(200, 180, 150))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print("wrote %s (%dx%d, %d sprites)" % (out, sheet.width, sheet.height, len(files)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
