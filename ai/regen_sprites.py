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

SOURCES["artefact_rubble"] = '''include("../palette.px.js")

// The rubble: broken stone — three overlapping angular chunks, not one
// rounded boulder and not a scatter of noise. The sunlit top planes are X,
// the bodies of the stone are R, and the lower right of each chunk falls
// into D. The heap stands on a band of ground shadow.
sprite("artefact_rubble", { w: 16, h: 16, outline: "K" },
  `
  ................
  ................
  ................
  ......XXXX......
  .....XXXXXX.....
  .....RRRRRRD....
  ..XXXRRRRRRD....
  .XXXXRRRRRRD....
  .RRRRRRRRRRD....
  RRRRRRRDRRRD....
  RRRRRRRRD...XX..
  RRRRRRRRD...RD..
  .RRRRRR.....RD..
  DDDDDDDDDDDDDD..
  ................
  ................
  `
)
'''

SOURCES["artefact_clay"] = '''include("../palette.px.js")

// The clay pot: a real pot shape, not a blob. A flared lip, the dark mouth
// of the pot as a slot directly under the lip (D), a narrow neck, shoulders
// that flare out into a round belly, and a foot standing in shadow. Light
// comes from the top left, so Z runs down the lit left edge and S down the
// shadowed right edge.
sprite("artefact_clay", { w: 16, h: 16, outline: "K" },
  `
  ................
  ................
  .....ZAAAAS.....
  .....ZDDDDS.....
  ......ZAAS......
  ......ZAAS......
  .....ZAAAAS.....
  ....ZAAAAAAS....
  ...ZAAAAAAAAS...
  ...ZAAAAAAAAS...
  ...ZAAAAAAAAS...
  ....ZAAAAAAS....
  ....ZAAAAAAS....
  .....ZAAAAS.....
  ......DDDD......
  ................
  `
)
'''

SOURCES["artefact_relic"] = '''include("../palette.px.js")

// The relic: a carved standing monolith, broken off on a diagonal at the top
// so the silhouette never reads as a domed gravestone. The stone is L (relic
// teal). Light comes from the top left, so a cream vein C runs down the lit
// left edge, following the break, and the right side of the stone falls away
// to D. A groove is cut into the face — recessed, so D — and a rune still
// burning E runs down inside the cut, so the eye reads one vertical wound
// rather than a face. The stone stands in a plinth of shadow.
sprite("artefact_relic", { w: 16, h: 16, outline: "K" },
  `
  .......CLL......
  ......CLLL......
  .....CLLLL......
  ....CLLDLD......
  ....CLLELD......
  ....CLLELD......
  ....CLLELD......
  ....CLLDLD......
  ....CLLLLD......
  ....CLLLLD......
  ....CLLLLD......
  ...CLLLLLLD.....
  ...CLLLLLLD.....
  ..DDDDDDDDD.....
  ...DDDDDDD......
  ................
  `
)
'''

SOURCES["dig_site"] = '''include("../palette.px.js")

// The dig site, drawn as a cross-section: the ground is cut open, so the pit
// is a real hole with depth instead of a flat disc on a flat field. The earth
// in section is mid brown N, sunlit along the surface Z, with bands of S for
// strata and A for stones buried in the cut. The pit is dug straight down
// out of the surface; the far wall is lit A just under the lip, falls
// through P and goes to the dark D of the shaft, and on the floor of the pit
// something arcane is glimmering E. A wooden ladder S stands in the pit and
// breaks the top edge of the ground — that is what tells the eye this is a
// hole and not a flat panel. On the left, the spoil heap: turned earth N
// heaped up above the ground line, sunlit Z on the upper left, shaded S down
// the right, with clods A on it.
sprite("dig_site", { w: 24, h: 24, outline: "K" },
  `
  ........................
  ...........S..S.........
  ..ZZNNN....S..S.........
  .ZZNAANS...SSSS.........
  ZNAANNSSS..S..S.........
  NNNNNSSSS..S..S...MM.MM.
  ZZZZZZZZZAASAASAZZZZZZZZ
  NNNNNNNNNAASSSSANNNNNNNN
  NNNNNNNNNPPSPPSPNNNNNNNN
  NNNNNNNNNPPSPPSPNNNNNNNN
  SSSSSSSSSDDSDDSDSSSSSSSS
  NNNNNNNNNDDSSSSDNNNNNNNN
  NNAANNNNNDDSDDSDNNNNNNNN
  NNNNNNNNNDDSDDSDNNNAANNN
  NNNNNNNNNDDSDDSDNNNNNNNN
  SSSSSSSSSDDSSSSDSSSSSSSS
  NNNNNNNNNDDDDDDDNNNNNNNN
  NNNNNNNNNNNNEENNNNNNNNNN
  NNNNNAANNNNNNNNNNAANNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  SSSSSSSSSNNNNNNNSSSSSSSS
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  `
)
'''

SOURCES["artefact_crown"] = '''include("../palette.px.js")

// The crown: the museum's prize, so it must be the warmest thing on the
// title screen. Gold G body, with the lit top-left edge of every point in
// the brighter H, the shadowed inner-right of each point falling to the
// ochre Y, and a rust T jewel set into the middle of the band. The bottom
// lip of the band is Y, so the crown reads as a solid ring and not a flat
// block. Three points, notched apart down to the band, so the silhouette
// says "crown" at a glance. No private colours: every pixel here comes
// from the shared palette, so the crown sits in the same world as the rest.
sprite("artefact_crown", { w: 16, h: 16, outline: "K" },
  `
  ................
  .......GG.......
  ......HGGG......
  ......HGGG......
  ..HGG.HGGG.HGG..
  ..HGG.HGGG.HGG..
  ..HGG.HGGG.HGG..
  ..HGY.HGGY.HGG..
  ..HGY.HGGY.HGG..
  ..HGY.HGGY.HGG..
  ..HGY.HGGY.HGG..
  .GGGGGGGGGGGGGG.
  .GGGGGGTTGGGGGG.
  .GGGGGGTTGGGGGG.
  .YYYYYYYYYYYYYY.
  ................
  `
)
'''

SOURCES["gallery_case"] = '''include("../palette.px.js")

// The gallery case: a display vitrine, not a box. A brass L top rail, a
// slate U frame with two corner posts and a cap, a cream C glint on the
// glass, and a warm A pedestal with a brass L label plate. The shadow
// under the table top is K, so the case reads as sitting on something
// rather than floating. Every colour here comes from the shared palette.
sprite("gallery_case", { w: 24, h: 24, outline: "K" },
  // pedestal foot
  rect(4, 20, 16, 2, "L"),
  // pedestal column
  rect(8, 16, 8, 4, "A"),
  // brass label plate on the column
  rect(10, 17, 4, 2, "L"),
  // display table top
  rect(3, 13, 18, 3, "A"),
  // shadow under the table top
  rect(3, 15, 18, 1, "K"),
  // glass vitrine: corner posts
  rect(5, 4, 2, 9, "U"),
  rect(17, 4, 2, 9, "U"),
  // vitrine cap
  rect(4, 3, 16, 2, "U"),
  // brass top rail
  rect(4, 2, 16, 1, "L"),
  // a glint on the glass
  px(7, 6, "C"),
  px(8, 7, "C")
)
'''

SOURCES["reel_wheel"] = '''include("../palette.px.js")

// The reel wheel: a wheel, not a shield. A rim of slate U two pixels thick
// all the way round, four wooden spokes N running from the hub out to the
// rim, and open gaps between them — the gaps are what tell the eye this
// thing turns. In the middle, the hub with an arcane jewel E set into it.
sprite("reel_wheel", { w: 24, h: 24, outline: "K" },
  `
  ........................
  ........................
  .........UUUUUU.........
  .......UUUUNNUUUU.......
  .....UUU...NN...UUU.....
  ....UUU....NN....UUU....
  ....UU.....NN.....UU....
  ...UU......NN......UU...
  ...U.......NN.......U...
  ..UU.......NN.......UU..
  ..UU......NNNN......UU..
  ..UNNNNNNNNEENNNNNNNNU..
  ..UNNNNNNNNEENNNNNNNNU..
  ..UU......NNNN......UU..
  ..UU.......NN.......UU..
  ...U.......NN.......U...
  ...UU......NN......UU...
  ....UU.....NN.....UU....
  ....UUU....NN....UUU....
  .....UUU...NN...UUU.....
  .......UUUUNNUUUU.......
  .........UUUUUU.........
  ........................
  ........................
  `
)
'''

SOURCES["curator"] = '''include("../palette.px.js")

// The curator: a person, so the head and the body must never blur into one
// blob. A flat cap in N, a face in A (clay) with two D eyes, and a D neck
// that separates the head from the shoulders. The coat is warm brown S with
// a cream shirt C down the middle of it and a shadow down its right side,
// and the sleeve N reaches out to the hand A. The magnifier is a small round
// lens — a slate U rim with the corners cut away so it reads as a circle, a
// bright W glass in the middle — held up at eye level on a wooden handle.
sprite("curator", { w: 16, h: 16, outline: "K" },
  `
  ................
  ......NNNN...UU.
  .....NNNNNN.UWWU
  ......AAAA..UWWU
  ......ADAD...UU.
  ......AAAA...N..
  .......DD....N..
  .....SSSSSD..N..
  .....SSCCSDNNA..
  .....SSCCSD.....
  .....SSCCSD.....
  .....SSSSSD.....
  .....NN..NN.....
  .....NN..NN.....
  .....NN..NN.....
  ....DDD..DDD....
  `
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
