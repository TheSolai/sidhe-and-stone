#!/usr/bin/env python3
"""Rewrite the eight slice sprites against the vision critique.

The critique (view_image on the contact sheet) said:
  - crown, gallery_case: good
  - relic: flat slab, glyphs look like stickers
  - rubble: blob, stray highlight pixels
  - curator: unreadable, magnifier is a giant green square
  - dig_site: L-shape, no hole, no depth
  - reel_wheel: messy internals, uneven rim
  - clay: blobby, no neck or rim
  - set-wide: palette drift (saturated emerald, bright cream/orange) and
    scale inconsistency

Fixes applied here:
  - ONE palette shared by the whole set, taken from the game's own UI
    colours (GRADE_COL / COL_* in src/main.gd) so the sprites cannot drift
    from the interface.
  - real silhouettes: a neck on the pot, a carved groove on the relic,
    angular facets on the stone, a pit with a far wall and a spoil heap.
  - the magnifier shrinks to a 3x3 lens with a handle.

SNAPPING: pxl output is drawn ON the pixel grid. It is already grid-native,
with binary alpha and a fixed palette, so there is no grid inconsistency for
Sprite Fusion Pixel Snapper to fix. Measured on 2026-11-10: the snapper
RESAMPLES pxl-native art rather than snapping it, shrinking an 18x18 sprite
to 13x14 and altering opaque pixels even when handed the exact source
palette. That destroys hand-placed detail (the relic's engraved cross, the
clay pot's neck, the curator's magnifier).

So the snapper is NOT applied to pxl-authored art. It belongs to the
raster path in ai/art_pipeline.py, where a rendered image genuinely does
need quantising and grid-fitting before it is traced back into pxl source.
This script is the pxl-native path: pxl build output goes straight to
assets/sprites.

Run: python3 ai/regen_sprites.py [--build]
"""

import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ART = ROOT / "art"
ASSETS = ROOT / "assets" / "sprites"
PXL_DIR = ROOT / "tools" / "pxl"
NODE = "/Users/amre/.openclaw/tools/node-v24.21.0/bin/node"

SOURCES = {}

SOURCES["artefact_rubble"] = '''use("pico8")
pal({ G: "#8a8378", L: "#b8b1a4", S: "#5f574f", D: "#16120f" })

sprite("artefact_rubble", { w: 16, h: 16, outline: "D" },
  // angular hewn stone, not a rounded blob
  poly([3, 9, 4, 6, 7, 4, 9, 5, 12, 7, 12, 11, 8, 13, 5, 13, 3, 11], "G"),
  // shaded lower-right facet
  poly([12, 7, 12, 11, 8, 13, 6, 11], "S"),
  // lit upper-left facet
  poly([7, 4, 9, 5, 7, 8, 4, 9, 4, 6], "L"),
  // a chipped corner
  px(11, 5, "D"),
  px(12, 6, "D")
)
'''

SOURCES["artefact_clay"] = '''use("pico8")
pal({ C: "#b4794a", H: "#e0a878", S: "#7d4f2e", D: "#16120f" })

sprite("artefact_clay", { w: 16, h: 16, outline: "D" },
  // flared rim at the top of the neck
  rect(6, 3, 4, 1, "H"),
  // the mouth, dark because it is a hole
  rect(7, 4, 2, 1, "D"),
  // narrow neck
  rect(6, 5, 4, 2, "C"),
  // belly, tapering to a narrow foot
  poly([6, 7, 10, 7, 11, 10, 10, 13, 5, 13, 4, 10], "C"),
  // lit edge on the left of the belly
  hline(5, 9, 3, "H"),
  px(5, 8, "H"),
  // shadow on the right of the belly
  hline(10, 9, 1, "S"),
  px(10, 10, "S"),
  // foot
  rect(5, 13, 6, 1, "S")
)
'''

SOURCES["artefact_relic"] = '''use("pico8")
pal({ G: "#8a8378", L: "#b8b1a4", S: "#5f574f", T: "#5f9e8f", D: "#16120f" })

sprite("artefact_relic", { w: 16, h: 16, outline: "D" },
  // a standing carved stone, tapered toward the top
  poly([5, 14, 4, 9, 5, 3, 8, 1, 11, 4, 11, 10, 10, 14], "G"),
  // shaded right face
  poly([11, 4, 11, 10, 10, 14, 8, 14], "S"),
  // lit top-left face
  poly([5, 3, 8, 1, 8, 3, 5, 5], "L"),
  // carved groove, cut INTO the stone so it is darker than the surface
  vline(7, 6, 5, "D"),
  hline(6, 8, 3, "D"),
  // a single rune still holding its glow
  px(7, 8, "T")
)
'''

SOURCES["dig_site"] = '''use("pico8")
pal({ E: "#8a7d6b", L: "#a99a80", S: "#5f574f", G: "#7d9a52", D: "#16120f" })

sprite("dig_site", { w: 24, h: 24, outline: "D" },
  // the patch of turned earth
  ellipse(12, 13, 10, 7, "E"),
  // the hole
  ellipse(12, 14, 6, 4, "D"),
  // far wall of the pit, catching a little light
  ellipse(12, 12, 6, 3, "S"),
  // spoil heaped at the near edge
  ellipse(12, 19, 7, 3, "L"),
  ellipse(12, 19, 5, 2, "E"),
  // grass tufts at the edge of the dug patch
  px(2, 9, "G"),
  px(3, 8, "G"),
  px(21, 10, "G"),
  px(20, 9, "G"),
  px(3, 18, "G")
)
'''

SOURCES["artefact_crown"] = '''use("pico8")
pal({ G: "#e0b23c", H: "#f2d98a", D: "#a8762a", K: "#16120f" })

sprite("artefact_crown", { w: 16, h: 16, outline: "K" },
  // three points rising from the band
  poly([2, 12, 4, 4, 6, 12], "G"),
  poly([6, 12, 8, 2, 10, 12], "G"),
  poly([10, 12, 12, 4, 14, 12], "G"),
  // the band the points sit on
  rect(1, 12, 14, 3, "G"),
  // shaded lower lip of the band
  rect(1, 14, 14, 1, "D"),
  // shadow at the right end, so the band reads as a curve
  rect(13, 12, 2, 2, "D"),
  // centre jewel set into the band
  rect(7, 13, 2, 2, "H")
)
'''

SOURCES["gallery_case"] = '''use("pico8")
pal({ W: "#b4794a", G: "#8b99a6", L: "#d9a441", D: "#16120f", S: "#e8dcc4" })

sprite("gallery_case", { w: 24, h: 24, outline: "D" },
  // pedestal foot
  rect(4, 20, 16, 2, "L"),
  // pedestal column
  rect(8, 16, 8, 4, "W"),
  // brass label plate on the column
  rect(10, 17, 4, 2, "L"),
  // display table top
  rect(3, 13, 18, 3, "W"),
  // shadow under the table top
  rect(3, 15, 18, 1, "D"),
  // glass vitrine: corner posts
  rect(5, 4, 2, 9, "G"),
  rect(17, 4, 2, 9, "G"),
  // vitrine cap
  rect(4, 3, 16, 2, "G"),
  // brass top rail
  rect(4, 2, 16, 1, "L"),
  // a glint on the glass
  px(7, 6, "S"),
  px(8, 7, "S")
)
'''

SOURCES["reel_wheel"] = '''use("pico8")
pal({ C: "#e8dcc4", H: "#d9a441", R: "#8a7d6b", D: "#16120f" })

// A fortune wheel reads as a DISC with alternating segments, not as open
// spokes. Open spokes leave transparent gaps between them, and the outline
// op then traces every gap - the wheel came out as speckle. Filling the
// disc first and cutting solid wedges over it keeps the silhouette one
// connected shape.

sprite("reel_wheel", { w: 24, h: 24, outline: "D" },
  // the wheel face
  circ(12, 12, 10, "C"),
  // four bold segments. Eight thinner wedges read as noise at this size:
  // the diagonal edges become 1px staircases and the wheel turns to mush.
  poly([12, 12, 19, 5, 5, 5], "H"),
  poly([12, 12, 19, 19, 19, 5], "C"),
  poly([12, 12, 5, 19, 19, 19], "H"),
  poly([12, 12, 5, 5, 5, 19], "C"),
  // the rim, an even ring right around the face
  ring(12, 12, 10, "R"),
  // hub
  circ(12, 12, 2, "R"),
  px(12, 12, "C")
)
'''

SOURCES["curator"] = '''use("pico8")
pal({ C: "#c05f3c", H: "#5f574f", S: "#e8dcc4", M: "#7d9a52", L: "#8b99a6", D: "#16120f" })

sprite("curator", { w: 16, h: 16, outline: "D" },
  // flat cap
  rect(6, 1, 4, 1, "H"),
  rect(5, 2, 4, 1, "H"),
  // head
  rect(6, 3, 4, 3, "S"),
  // eye
  px(8, 4, "D"),
  // coat
  rect(5, 6, 6, 4, "C"),
  // lapel
  vline(7, 6, 3, "H"),
  // arm reaching out to the lens
  hline(10, 8, 2, "C"),
  // magnifier: a small lens held clear of the head, not a lantern
  ring(13, 4, 1, "M"),
  px(13, 4, "L"),
  // handle down to the hand
  vline(13, 6, 2, "M"),
  // hand
  px(12, 7, "S"),
  // legs
  rect(6, 10, 1, 4, "H"),
  rect(9, 10, 1, 4, "H"),
  // shoes
  rect(5, 14, 2, 1, "D"),
  rect(8, 14, 2, 1, "D")
)
'''


def build_and_stage(name: str) -> bool:
    """pxl build the source, then copy the sprite into assets/sprites.

    pxl build writes art/<name>/out/sprites/<name>.png. That PNG is already
    the pixel grid - no snapper, no resampling.
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
    shutil.copyfile(built, ASSETS / f"{name}.png")
    print(f"  [build] {name} -> assets/sprites")
    return True


def main() -> int:
    args = sys.argv[1:]
    build = "--build" in args or not args

    for name, src in SOURCES.items():
        d = ART / name
        d.mkdir(parents=True, exist_ok=True)
        (d / f"{name}.px.js").write_text(src)
        print(f"wrote {name}")

    if not build:
        print("\n(sources only; pass --build to render and stage)")
        return 0

    print("\nbuilding and staging")
    failures = [n for n in SOURCES if not build_and_stage(n)]
    if failures:
        print(f"\nFAILED: {', '.join(failures)}")
        return 1
    print(f"\nstaged {len(SOURCES)} sprites to assets/sprites")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
