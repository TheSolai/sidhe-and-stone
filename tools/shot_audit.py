#!/usr/bin/env python3
"""Audit the captured screenshots.

The agent cannot look at the images, so the images have to be MEASURED.
This reads the real PNGs from art/shots/ and reports, per frame:

  - how many distinct colours there are, and how many are off-palette
  - the share of the frame taken up by each colour
  - the foreground/background contrast of the main text roles
  - whether any region is a large flat field (a sign of missing art)

The palette is read from art/palette.px.js, the ONE source of truth, so
the audit follows a re-solved palette automatically.
"""
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PALETTE_FILE = ROOT / "art" / "palette.px.js"
SHOTS = ROOT / "art" / "shots"


def load_palette():
    """The shared palette, as {letter: (r, g, b)}."""
    source = PALETTE_FILE.read_text(encoding="utf-8")
    out = {}
    for m in re.finditer(r'^\s*([A-Za-z])\s*:\s*"(#[0-9a-fA-F]{6})"', source, re.M):
        h = m.group(2)
        out[m.group(1)] = tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
    if len(out) < 8:
        raise SystemExit(f"palette parse failed: only {len(out)} colours")
    return out


def luminance(rgb):
    """WCAG relative luminance."""
    def channel(c):
        s = c / 255.0
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4
    r, g, b = (channel(x) for x in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def main():
    palette = load_palette()
    legal = set(palette.values())
    by_letter = {k: v for k, v in palette.items()}

    files = sorted(SHOTS.glob("*.png"))
    if not files:
        raise SystemExit(f"no screenshots in {SHOTS}")

    total_fail = 0
    print(f"Palette: {len(palette)} colours from {PALETTE_FILE.name}")
    print(f"Frames:  {len(files)}\n")

    for path in files:
        img = Image.open(path).convert("RGB")
        w, h = img.size
        counts = {}
        for px in img.getdata():
            counts[px] = counts.get(px, 0) + 1

        total = w * h
        off = {c: n for c, n in counts.items() if c not in legal}
        off_total = sum(off.values())

        # The biggest colour and how much of the frame it covers.
        biggest, biggest_n = max(counts.items(), key=lambda kv: kv[1])
        biggest_share = biggest_n / total

        # The colour names, for the report.
        names = {v: k for k, v in by_letter.items()}

        status = "ok"
        problems = []
        if off_total:
            top = sorted(off.items(), key=lambda kv: -kv[1])[:3]
            problems.append(
                f"{len(off)} off-palette colours, {off_total} px "
                f"({off_total / total * 100:.3f}%) e.g. "
                + ", ".join(f"#{c[0]:02x}{c[1]:02x}{c[2]:02x}x{n}" for c, n in top)
            )
            status = "FAIL"
        if biggest_share > 0.55:
            problems.append(
                f"one flat field: {names.get(biggest, '?')} covers "
                f"{biggest_share * 100:.1f}% of the frame"
            )
            if status == "ok":
                status = "WARN"

        if problems:
            total_fail += 1 if status == "FAIL" else 0

        print(f"{path.name}  {w}x{h}")
        print(
            f"  {len(counts)} distinct colours, "
            f"{len(off)} off-palette, "
            f"dominant {names.get(biggest, '?')} at {biggest_share * 100:.1f}%"
        )
        top5 = sorted(counts.items(), key=lambda kv: -kv[1])[:5]
        print(
            "  top: "
            + ", ".join(
                f"{names.get(c, '#%02x%02x%02x' % c)} {n / total * 100:.1f}%"
                for c, n in top5
            )
        )
        for p in problems:
            print(f"  {status}: {p}")

    # Contrast of the roles the interface actually leans on.
    print("\nContrast of the interface roles (WCAG ratio):")
    roles = [
        ("D", "C", "body text on the panel cream"),
        ("D", "W", "body text on a raised card"),
        ("N", "C", "secondary text on the panel cream"),
        ("K", "W", "the outline ink on paper"),
        ("Y", "K", "gold on near-black"),
        ("M", "C", "the good-news moss on cream"),
        ("T", "C", "the rust accent on cream"),
        ("A", "C", "the money clay on cream"),
        ("G", "D", "the title gold on the dark banner"),
        ("U", "C", "the slate on cream"),
    ]
    for fg, bg, label in roles:
        ratio = contrast(by_letter[fg], by_letter[bg])
        mark = "ok " if ratio >= 4.5 else ("warn" if ratio >= 3.0 else "LOW")
        print(f"  {mark} {fg} on {bg}: {ratio:5.2f}  ({label})")

    print(f"\nOff-palette failures: {total_fail}")
    return 1 if total_fail else 0


if __name__ == "__main__":
    sys.exit(main())
