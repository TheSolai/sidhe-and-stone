#!/usr/bin/env python3
"""Build the macOS .icns application icon for Sidhe & Stone.

The icon is the crown artefact — the game's prestige goal — sitting on a
stone mound, drawn on the shared palette and scaled up as hard pixel art.
Nothing here is a gradient or a soft shadow: every pixel is a palette entry,
because the same rule that governs the in-game sprites should govern the
thing a player sees in their Dock.

The emblem is authored on a 32x32 logical pixel grid and scaled by an
integer factor, so the edges stay hard at every size. Output is an
`.iconset` directory plus the `.icns` that Godot's macOS export expects.

Run: python3 tools/make_app_icon.py
"""

import struct
import subprocess
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SPRITES = ROOT / "assets" / "sprites"
OUT = ROOT / "build" / "icons"
ICONSET = OUT / "SidheAndStone.iconset"
ICNS = ROOT / "icon.icns"

GRID = 32          # logical pixel grid of the emblem
MASTER = 1024      # rendered master size

# The shared palette, mirrored from art/palette.px.js. The icon obeys the
# same rule as the sprites: no colour that the game does not already use.
PAL = {
    "K": "#1e1a16", "D": "#362a21", "P": "#46382a",
    "N": "#716855", "S": "#c17c50", "Z": "#c69a6b",
    "X": "#d6d4c8", "C": "#e8dcc5", "W": "#f7f2e3",
    "A": "#b98053", "Y": "#dda742", "G": "#e5b63d", "H": "#efd788",
    "T": "#c3613d", "M": "#82a156", "L": "#5f9f90",
    "E": "#6fd8e4", "I": "#a8e8ef", "U": "#8896a3", "R": "#aca496",
}


def rgb(key):
    h = PAL[key].lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def read_png(path):
    """Minimal reader for the palette-indexed PNGs this repo exports."""
    data = path.read_bytes()
    pos, plte, trns, idat = 8, b"", b"", b""
    width = height = depth = ctype = None
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        ctag = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        if ctag == b"IHDR":
            width, height, depth, ctype, _, _, interlace = struct.unpack(
                ">IIBBBBB", chunk)
            assert depth == 8 and ctype == 3 and interlace == 0, path
        elif ctag == b"PLTE":
            plte = chunk
        elif ctag == b"tRNS":
            trns = chunk
        elif ctag == b"IDAT":
            idat += chunk
        elif ctag == b"IEND":
            break
        pos += 12 + length

    raw = zlib.decompress(idat)
    stride = width
    out, prev, p = [], bytearray(stride), 0
    for _ in range(height):
        ftype = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        if ftype == 1:
            for x in range(1, stride):
                line[x] = (line[x] + line[x - 1]) & 255
        elif ftype == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif ftype == 3:
            for x in range(stride):
                a = line[x - 1] if x else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif ftype == 4:
            for x in range(stride):
                a = line[x - 1] if x else 0
                b = prev[x]
                c = prev[x - 1] if x else 0
                pp = a + b - c
                pa, pb, pc = abs(pp - a), abs(pp - b), abs(pp - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out.append(bytes(line))
        prev = line

    palette = [tuple(plte[i:i + 3]) for i in range(0, len(plte), 3)]
    alphas = list(trns) + [255] * (len(palette) - len(trns))
    rows = []
    for line in out:
        row = []
        for idx in line:
            r, g, b = palette[idx]
            row.append((r, g, b, alphas[idx]))
        rows.append(row)
    return width, height, rows


def load_crown():
    """The 16x16 crown artwork, lifted out of its exported PNG.

    The export is the grid plus a 1px outline margin on each side, so the
    artwork itself starts one pixel in.
    """
    _, _, rows = read_png(SPRITES / "artefact_crown.png")
    return [row[1:17] for row in rows[1:17]]


def emblem():
    """Compose the 32x32 logical emblem: a stone mound with the crown on it.

    A cell holds either a palette key (a string) or a resolved RGBA tuple
    lifted from the crown artwork.
    """
    grid = [[None] * GRID for _ in range(GRID)]

    # --- the mound: a wide dome of earth and stone, lit from the top-left.
    cx, cy = 16, 27
    for y in range(GRID):
        for x in range(GRID):
            dx = (x - cx) / 13.0
            dy = (y - cy) / 8.0
            if dx * dx + dy * dy <= 1.0:
                grid[y][x] = "N"
    for y in range(GRID):
        for x in range(GRID):
            if grid[y][x] != "N":
                continue
            if x < cx and y < cy:
                grid[y][x] = "Z"
            elif x > cx and y > cy:
                grid[y][x] = "S"
    # a dark ground line so the mound sits on something
    for x in range(GRID):
        for y in range(GRID):
            if grid[y][x] == "N" and y >= 30:
                grid[y][x] = "D"
    # outline the mound in K
    for y in range(GRID):
        for x in range(GRID):
            if grid[y][x] is not None:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < GRID and 0 <= ny < GRID and grid[ny][nx] is not None:
                    grid[y][x] = "K"
                    break

    # --- the crown, sitting on the crest of the mound.
    crown = load_crown()
    ox, oy = 8, 5
    for y, row in enumerate(crown):
        for x, px in enumerate(row):
            if px[3] == 0:
                continue
            grid[oy + y][ox + x] = px

    return grid


def render(grid, size):
    """Scale the logical grid by an integer factor into an RGBA raster."""
    factor = size // GRID
    rows = []
    for y in range(size):
        src = grid[y // factor]
        row = []
        for x in range(size):
            cell = src[x // factor]
            if cell is None:
                row.append((0, 0, 0, 0))
            elif isinstance(cell, str):
                row.append(rgb(cell) + (255,))
            else:
                row.append(cell)
        rows.append(row)
    return rows


def squircle_mask(size):
    """A macOS-style rounded square, as a boolean coverage mask."""
    r = size * 0.2237  # the system's own corner radius
    inside = [[False] * size for _ in range(size)]
    for y in range(size):
        for x in range(size):
            dx = max(r - x, x - (size - 1 - r), 0)
            dy = max(r - y, y - (size - 1 - r), 0)
            inside[y][x] = (dx * dx + dy * dy) <= r * r
    return inside


def write_png(path, rows):
    height = len(rows)
    width = len(rows[0])
    raw = bytearray()
    for row in rows:
        raw.append(0)
        for px in row:
            raw.extend(px)

    def chunk(tag, payload):
        return (struct.pack(">I", len(payload)) + tag + payload +
                struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def downscale(rows, size, factor):
    """Box-filter the master down to `size`, keeping hard edges.

    A plain average would blend two palette entries into a colour that is in
    neither, so the darkest opaque sample in each block wins instead: the
    outline stays a hard outline all the way down to 16px.
    """
    small = []
    for y in range(size):
        row = []
        for x in range(size):
            best = None
            for dy in range(factor):
                for dx in range(factor):
                    px = rows[y * factor + dy][x * factor + dx]
                    if px[3] == 0:
                        continue
                    if best is None or sum(px[:3]) < sum(best[:3]):
                        best = px
            row.append(best if best is not None else (0, 0, 0, 0))
        small.append(row)
    return small


def main():
    grid = emblem()
    emblem_rows = render(grid, MASTER)
    mask = squircle_mask(MASTER)

    # Flatten the emblem onto the dark squircle. The emblem is opaque; the
    # squircle edge is the only transparency, and it is hard-edged because
    # the mask is boolean - no anti-aliasing anywhere.
    rows = []
    for y in range(MASTER):
        row = []
        for x in range(MASTER):
            if not mask[y][x]:
                row.append((0, 0, 0, 0))
                continue
            px = emblem_rows[y][x]
            row.append(rgb("K") + (255,) if px[3] == 0 else px)
        rows.append(row)

    OUT.mkdir(parents=True, exist_ok=True)
    ICONSET.mkdir(parents=True, exist_ok=True)

    sizes = {
        "icon_16x16.png": 16,
        "icon_16x16@2x.png": 32,
        "icon_32x32.png": 32,
        "icon_32x32@2x.png": 64,
        "icon_128x128.png": 128,
        "icon_128x128@2x.png": 256,
        "icon_256x256.png": 256,
        "icon_256x256@2x.png": 512,
        "icon_512x512.png": 512,
        "icon_512x512@2x.png": 1024,
    }
    for name, size in sizes.items():
        factor = MASTER // size
        write_png(ICONSET / name, downscale(rows, size, factor))

    subprocess.run(["iconutil", "-c", "icns", str(ICONSET), "-o", str(ICNS)],
                   check=True)
    print(f"wrote {ICNS} ({ICNS.stat().st_size} bytes)")
    print(f"iconset at {ICONSET}")


if __name__ == "__main__":
    main()
