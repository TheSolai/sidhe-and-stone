#!/usr/bin/env python3
"""Build every sprite in art/ and stage it into assets/sprites.

This used to embed the eight sprite sources inside the script, which meant
there were two copies of the art: the .px.js file on disk and the string in
this file. They drifted, and then they drifted apart from each other, which
is exactly how a sprite set ends up looking assembled rather than drawn.

Now there is ONE source of truth: art/<name>/<name>.px.js. This script
discovers every sprite in art/, builds it with pxl, and stages the PNG into
assets/sprites/. Nothing is embedded here, so a source file is edited in
place and never has to be copied anywhere.

pxl build output is drawn ON the pixel grid: grid-native, binary alpha, and
a fixed palette. So there is no grid inconsistency to fix, and no snapping
or resampling is applied. Sprite Fusion Pixel Snapper resamples pxl-native
art rather than snapping it — measured on 2026-11-10, it shrank an 18x18
sprite to 13x14 and altered opaque pixels even when handed the exact source
palette, which destroys hand-placed detail. The snapper belongs to the
raster path in ai/art_pipeline.py, where a rendered image genuinely does
need quantising and grid-fitting before it is traced back into pxl source.

Run: python3 ai/regen_sprites.py [--build]
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ART = ROOT / "art"
ASSETS = ROOT / "assets" / "sprites"
WEB_SPRITES = ROOT / "web" / "public" / "sprites"
PXL_DIR = ROOT / "tools" / "pxl"
NODE = "/Users/amre/.openclaw/tools/node-v24.21.0/bin/node"


def discover() -> list:
    """Every sprite source in art/, sorted."""
    names = []
    for src in sorted(ART.glob("*/*.px.js")):
        # "artefact_clay.px.js" -> stem is "artefact_clay.px", so the ".px"
        # suffix has to come off too before comparing with the directory.
        stem = src.name[: -len(".px.js")]
        if stem == src.parent.name:
            names.append(stem)
    return names


def png_size(path: Path) -> tuple:
    """(w, h) of a PNG, read straight from the IHDR chunk.

    No Pillow: the sprite PNGs are palette-indexed, and reading the header
    is a few lines of struct.
    """
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path} is not a PNG")
    # IHDR is always the first chunk: length(4) type(4) w(4) h(4)
    w = int.from_bytes(data[16:20], "big")
    h = int.from_bytes(data[20:24], "big")
    return w, h


def build_and_stage(name: str) -> bool:
    """pxl build the source, then copy the sprite into assets/sprites.

    The web copy is made from the SAME bytes as the assets copy, so the
    two are byte-identical by construction. That is what ai/verify_sprites.py
    checks, and it is why the copy happens here rather than being left to
    a separate manual step that can be forgotten.
    """
    src = ART / name / f"{name}.px.js"
    out_dir = ART / name / "out"
    res = subprocess.run(
        [NODE, "bin/pxl.js", "build", str(src), "--out", str(out_dir),
         "--no-preview"],
        capture_output=True, text=True, timeout=300, cwd=str(PXL_DIR))
    if res.returncode != 0:
        print(f"  [build] FAILED {name}: {(res.stderr or res.stdout)[:300]}")
        return False
    built = out_dir / "sprites" / f"{name}.png"
    if not built.exists():
        print(f"  [build] no sprite produced for {name}")
        return False
    ASSETS.mkdir(parents=True, exist_ok=True)
    WEB_SPRITES.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(built, ASSETS / f"{name}.png")
    shutil.copyfile(built, WEB_SPRITES / f"{name}.png")
    print(f"  [build] {name} -> assets/sprites + web/public/sprites")
    return True


def write_atlas(names: list) -> None:
    """Regenerate web/public/sprites/atlas.json from the real PNGs.

    The atlas is a manifest, so it is generated from the files that are
    actually on disk rather than hand-maintained. A hand-maintained
    manifest drifts the moment a sprite is resized, and then the web
    build scales the wrong thing.
    """
    atlas = {}
    for name in names:
        png = ASSETS / f"{name}.png"
        if not png.exists():
            continue
        w, h = png_size(png)
        atlas[name] = {"file": f"{name}.png", "w": w, "h": h}
    path = WEB_SPRITES / "atlas.json"
    path.write_text(json.dumps(atlas, indent=2, sort_keys=True) + "\n")
    print(f"\nwrote {path} ({len(atlas)} sprites)")


def main() -> int:
    args = sys.argv[1:]
    build = "--build" in args or not args
    names = discover()

    if not names:
        print("no sprite sources found in art/")
        return 1

    print(f"\n{len(names)} sprite sources in art/")
    for name in names:
        print(f"  {name}")

    if not build:
        print("\n(sources only; pass --build to render and stage)")
        return 0

    print("\nbuilding and staging")
    failures = [n for n in names if not build_and_stage(n)]
    if failures:
        print(f"\nFAILED: {', '.join(failures)}")
        return 1
    write_atlas(names)
    print(f"\nstaged {len(names)} sprites to assets/sprites + web/public/sprites")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
