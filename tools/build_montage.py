#!/usr/bin/env python3
"""Build the delivery montages from the real captured frames.

The model cannot look at the pictures, so the pictures have to be
arranged so that one image carries the whole story: the title, the
gameplay, and every system screen, in one sheet with labels.

Everything here is stitched from PNGs that were captured from the
ACTUAL builds -- the Godot frames from tests/ui_capture.gd running the
real project, and the web frames from the real dist/ bundle driven in a
real browser. Nothing is redrawn or mocked.

Usage:
    .venv/bin/python3 tools/build_montage.py godot
    .venv/bin/python3 tools/build_montage.py web
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
WORKSPACE = Path("/Users/amre/.openclaw/workspace")

# The palette, so the montage chrome matches the game.
INK = (28, 24, 18)
PAPER = (247, 240, 222)
EDGE = (60, 48, 36)
RULE = (196, 182, 158)
LABEL = (92, 76, 58)

TITLE_FONT = 22
LABEL_FONT = 15


def _font(size):
    """A PIL font, preferring one that is actually installed."""
    from PIL import ImageFont

    for path in (
        "/System/Library/Fonts/Supplemental/Courier New Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def _label(draw, x, y, text, font, fill=LABEL):
    draw.text((x, y), text, font=font, fill=fill)


def build(name, sources, out_path, columns):
    """Stitch the given (label, path) pairs into a labelled sheet."""
    frames = []
    for label, path in sources:
        p = Path(path)
        if not p.exists():
            print(f"  skip (missing): {label}")
            continue
        frames.append((label, Image.open(p).convert("RGB")))

    if not frames:
        print(f"{name}: nothing to build")
        return None

    label_font = _font(LABEL_FONT)
    title_font = _font(TITLE_FONT)

    # The cell is sized to the biggest frame, so every frame sits in a
    # uniform cell and the sheet reads as a grid rather than a collage.
    cell_w = max(f.width for _, f in frames)
    cell_h = max(f.height for _, f in frames)
    pad = 14
    caption = 26
    header = 54

    rows = (len(frames) + columns - 1) // columns
    sheet_w = columns * (cell_w + pad) + pad
    sheet_h = header + rows * (cell_h + caption + pad) + pad

    sheet = Image.new("RGB", (sheet_w, sheet_h), PAPER)
    draw = ImageDraw.Draw(sheet)

    draw.rectangle([0, 0, sheet_w - 1, header - 1], fill=EDGE)
    _label(draw, pad, 16, name, title_font, fill=PAPER)

    for i, (label, frame) in enumerate(frames):
        col = i % columns
        row = i // columns
        x = pad + col * (cell_w + pad)
        y = header + row * (cell_h + caption + pad)

        # The frame is centred in its cell, never scaled, so the montage
        # cannot hide a layout defect by shrinking it.
        sheet.paste(frame, (x + (cell_w - frame.width) // 2, y))

        draw.rectangle([x, y, x + frame.width - 1, y + frame.height - 1], outline=RULE)
        _label(draw, x, y + frame.height + 6, label, label_font)

    sheet.save(out_path)
    print(f"wrote {out_path} ({sheet.width}x{sheet.height}, {len(frames)} frames)")
    return out_path


GODOT_FRAMES = [
    ("first run", "/tmp/gsk_validate/01_first_run.png"),
    ("gallery", "/tmp/gsk_validate/02_gallery.png"),
    ("vault", "/tmp/gsk_validate/03_vault.png"),
    ("dig site", "/tmp/gsk_validate/04_digs.png"),
    ("staff", "/tmp/gsk_validate/05_staff.png"),
    ("goals", "/tmp/gsk_validate/06_goals.png"),
    ("ledger", "/tmp/gsk_validate/07_ledger.png"),
    ("day report", "/tmp/gsk_validate/08_day_report.png"),
    ("the reel", "/tmp/gsk_validate/09_odds.png"),
]

WEB_FRAMES = [
    ("title", "art/shots/01-title.png"),
    ("tutorial", "art/shots/02-tutorial.png"),
    ("gameplay", "art/shots/03-gameplay.png"),
    ("dig site", "art/shots/04-dig.png"),
    ("dig result", "art/shots/05-dig-result.png"),
    ("curator", "art/shots/06-curator.png"),
    ("gallery", "art/shots/06-gallery.png"),
    ("goals", "art/shots/06-goals.png"),
    ("ledger", "art/shots/06-ledger.png"),
    ("the reel", "art/shots/06-reel.png"),
    ("shop", "art/shots/06-shop.png"),
    ("vault", "art/shots/06-vault.png"),
]


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "all"

    if which in ("godot", "all"):
        out = WORKSPACE / "godot_montage.png"
        build("SIDHE & STONE - Godot build", GODOT_FRAMES, out, columns=5)
        proof = WORKSPACE / "proof" / "godot_montage.png"
        proof.parent.mkdir(parents=True, exist_ok=True)
        proof.write_bytes(out.read_bytes())
        print(f"wrote {proof}")

    if which in ("web", "all"):
        out = WORKSPACE / "sidhe_montage.png"
        build(
            "SIDHE & STONE - web build",
            [(label, ROOT / path) for label, path in WEB_FRAMES],
            out,
            columns=4,
        )
        proof = WORKSPACE / "proof" / "sidhe_montage.png"
        proof.parent.mkdir(parents=True, exist_ok=True)
        proof.write_bytes(out.read_bytes())
        print(f"wrote {proof}")


if __name__ == "__main__":
    main()
