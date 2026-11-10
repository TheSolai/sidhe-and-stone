#!/usr/bin/env python3
"""
pxl grid cleanup: kill the pixel-art sins that `pxl lint` flags, in the source.

Tracing a rendered image (rather than hand-drawing it) inevitably leaves
isolated single pixels: one speck of colour with no same-coloured neighbour.
Those are not "detail", they are noise, and `pxl lint` rightly calls them
orphans. Rather than trace the image and hope, we trace it and then CLEAN the
grid: an isolated pixel is absorbed into the dominant colour of its
neighbourhood.

This runs on the .px.js source, so the cleaned result is still art-as-code and
still re-buildable and re-lintable. Nothing here needs a network or an API.

Also handled:
  * near-duplicate colours are collapsed by pxl's own palette extraction
    (we simply cap colours at trace time), and
  * doubled-corner jaggies in 1px lines are repaired by removing the corner
    pixel of an L where the line should step diagonally.

Usage:
    python pxl_cleanup.py art.px.js [--passes 3] [--dry-run]
"""

import argparse
import re
import sys
from pathlib import Path

TRANSPARENT = {".", "_", " "}

# The pico8 palette pxl traces into, as RGB. Used to knock the backdrop out
# with a colour tolerance instead of an exact match, so the near-white fringe
# pixels around a subject go with it.
PICO8 = [
    (0, 0, 0), (29, 43, 83), (126, 37, 83), (0, 135, 81),
    (171, 82, 54), (95, 87, 79), (194, 195, 199), (255, 241, 232),
    (255, 0, 77), (255, 163, 0), (255, 236, 39), (0, 180, 54),
    (41, 173, 255), (131, 118, 156), (242, 95, 92), (255, 255, 255),
]


def key_rgb(ch):
    """RGB for a palette key ('0'-'9','a'-'z',...) assuming pico8 indexing."""
    idx = "0123456789abcdefghijklmnopqrstuvwxyz".find(ch)
    if idx < 0 or idx >= len(PICO8):
        return None
    return PICO8[idx]


def colour_dist(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5
GRID_RE = re.compile(
    r"(?P<prefix>(?:sprite|scene)\(\s*\"[^\"]+\"\s*,\s*`)(?P<grid>.*?)(?P<suffix>`)",
    re.DOTALL,
)


def parse_grid(text):
    """Return (rows, width) for the first grid literal in the file."""
    m = GRID_RE.search(text)
    if not m:
        return None, None
    raw_lines = [ln.strip() for ln in m.group("grid").splitlines()]
    rows = [ln for ln in raw_lines if ln]
    if not rows:
        return None, None
    width = max(len(r) for r in rows)
    return [r.ljust(width, ".") for r in rows], width


def neighbours(r, c, rows, width):
    for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        rr, cc = r + dr, c + dc
        if 0 <= rr < len(rows) and 0 <= cc < width:
            yield rows[rr][cc]


def dominant_neighbour(r, c, rows, width):
    """Most common opaque colour in the 8-neighbourhood of (r, c)."""
    counts = {}
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr == 0 and dc == 0:
                continue
            rr, cc = r + dr, c + dc
            if 0 <= rr < len(rows) and 0 <= cc < width:
                ch = rows[rr][cc]
                if ch not in TRANSPARENT:
                    counts[ch] = counts.get(ch, 0) + 1
    if not counts:
        return None
    return max(counts.items(), key=lambda kv: (kv[1], kv[0]))[0]


def is_orphan(r, c, rows, width):
    ch = rows[r][c]
    if ch in TRANSPARENT:
        return False
    same = sum(1 for n in neighbours(r, c, rows, width) if n == ch)
    if same > 0:
        return False
    # A lone pixel surrounded by a single other colour is still noise unless it
    # is strongly contrasting (which reads as a deliberate spark/highlight).
    around = {}
    for n in neighbours(r, c, rows, width):
        if n not in TRANSPARENT:
            around[n] = around.get(n, 0) + 1
    if not around:
        return False
    best = max(around.values())
    # Dominant surrounding colour: absorb.
    return best >= 2


def remove_orphans(rows, width, passes=3):
    removed = 0
    for _ in range(passes):
        changed = False
        new_rows = [list(r) for r in rows]
        for r in range(len(rows)):
            for c in range(width):
                if not is_orphan(r, c, rows, width):
                    continue
                repl = dominant_neighbour(r, c, rows, width)
                if repl and repl != rows[r][c]:
                    new_rows[r][c] = repl
                    removed += 1
                    changed = True
        rows = ["".join(r) for r in new_rows]
        if not changed:
            break
    return rows, removed


def fix_jaggies(rows, width):
    """Remove a doubled corner: a pixel whose only same-colour neighbour sits
    orthogonally while a diagonal step would be cleaner."""
    removed = 0
    new_rows = [list(r) for r in rows]
    for r in range(len(rows)):
        for c in range(width):
            ch = rows[r][c]
            if ch in TRANSPARENT:
                continue
            for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                rr, cc = r + dr, c + dc
                if not (0 <= rr < len(rows) and 0 <= cc < width):
                    continue
                if rows[rr][cc] != ch:
                    continue
                # The shared edge: is there also a diagonal pair that makes
                # this a doubled corner?
                for sr, sc in ((rr + dc, cc), (r, c + dr)):
                    if not (0 <= sr < len(rows) and 0 <= sc < width):
                        continue
                    if rows[sr][sc] == ch:
                        break
                else:
                    continue
                # Pixel has one orthogonal same-colour neighbour but the cell
                # diagonally across that neighbour is empty -> L-corner.
                diag_r, diag_c = rr + (dr), cc + (dc)
                if not (0 <= diag_r < len(rows) and 0 <= diag_c < width):
                    continue
                if rows[diag_r][diag_c] in TRANSPARENT:
                    # Corner pixel that should step diagonally: drop it.
                    new_rows[r][c] = "."
                    removed += 1
                    break
    return ["".join(r) for r in new_rows], removed


def knockout_background(rows, width, tol=70.0):
    """Flood-fill the border-connected background to transparent.

    A traced image keeps its original backdrop as opaque pixels, which makes
    the 'sprite' a filled rectangle. Everything reachable from the border
    whose colour is within `tol` of the backdrop colour is background and
    becomes '.', leaving the subject floating on transparency. The tolerance
    also catches the near-white fringe pixels that trace leaves behind.
    """
    from collections import deque

    if not rows:
        return rows, 0

    # Seed from the border: the colour that appears most often on the edge is
    # the backdrop.
    edge = {}
    for r in range(len(rows)):
        for c in (0, width - 1):
            ch = rows[r][c]
            if ch not in TRANSPARENT:
                edge[ch] = edge.get(ch, 0) + 1
    for c in range(width):
        for r in (0, len(rows) - 1):
            ch = rows[r][c]
            if ch not in TRANSPARENT:
                edge[ch] = edge.get(ch, 0) + 1
    if not edge:
        return rows, 0
    bg = max(edge.items(), key=lambda kv: kv[1])[0]
    bg_rgb = key_rgb(bg)

    def is_bg(ch):
        if ch in TRANSPARENT:
            return True
        if ch == bg:
            return True
        rgb = key_rgb(ch)
        if bg_rgb and rgb:
            return colour_dist(rgb, bg_rgb) <= tol
        return False

    grid = [list(r) for r in rows]
    seen = set()
    queue = deque()
    for r in range(len(grid)):
        for c in (0, width - 1):
            if is_bg(grid[r][c]) and (r, c) not in seen:
                seen.add((r, c))
                queue.append((r, c))
    for c in range(width):
        for r in (0, len(grid) - 1):
            if is_bg(grid[r][c]) and (r, c) not in seen:
                seen.add((r, c))
                queue.append((r, c))

    cleared = 0
    while queue:
        r, c = queue.popleft()
        if grid[r][c] in TRANSPARENT:
            continue
        if not is_bg(grid[r][c]):
            continue
        grid[r][c] = "."
        cleared += 1
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            rr, cc = r + dr, c + dc
            if 0 <= rr < len(grid) and 0 <= cc < width:
                if (rr, cc) not in seen and is_bg(grid[rr][cc]):
                    seen.add((rr, cc))
                    queue.append((rr, cc))

    return ["".join(r) for r in grid], cleared


def crop_grid(rows, width):
    """Trim fully transparent border rows/columns."""
    top = 0
    while top < len(rows) and all(ch in TRANSPARENT for ch in rows[top]):
        top += 1
    bottom = len(rows) - 1
    while bottom >= top and all(ch in TRANSPARENT for ch in rows[bottom]):
        bottom -= 1
    if top > bottom:
        return rows, width
    left = 0
    while left < width and all(
        rows[r][left] in TRANSPARENT for r in range(top, bottom + 1)
    ):
        left += 1
    right = width - 1
    while right >= left and all(
        rows[r][right] in TRANSPARENT for r in range(top, bottom + 1)
    ):
        right -= 1
    if top == 0 and bottom == len(rows) - 1 and left == 0 and right == width - 1:
        return rows, width
    trimmed = [r[left:right + 1] for r in rows[top:bottom + 1]]
    return trimmed, right - left + 1


def rewrite(path, rows):
    text = path.read_text()
    m = GRID_RE.search(text)
    if not m:
        return False
    body = "\n  " + "\n  ".join(rows) + "\n"
    new_text = text[: m.start("grid")] + body + text[m.end("grid") :]
    path.write_text(new_text)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("art")
    ap.add_argument("--passes", type=int, default=3)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-knockout", action="store_true")
    ap.add_argument("--tolerance", type=float, default=70.0)
    args = ap.parse_args()

    path = Path(args.art)
    rows, width = parse_grid(path.read_text())
    if rows is None:
        print("no grid literal found", file=sys.stderr)
        return 2

    before = list(rows)
    if not args.no_knockout:
        rows, cleared = knockout_background(rows, width, tol=args.tolerance)
    rows, width = crop_grid(rows, width)
    rows, removed = remove_orphans(rows, width, args.passes)
    rows, jag = fix_jaggies(rows, width)
    print(f"cleanup: {len(rows)}x{width}, {removed} orphans absorbed, "
          f"{jag} jaggies repaired")
    if args.dry_run:
        return 0
    if rewrite(path, rows):
        print(f"rewrote {path}")
    else:
        print("rewrite failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
