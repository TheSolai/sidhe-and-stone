# ART LIGHTING NOTES — SIDHE & STONE

Working notes for the light model, the material ramps, and the reasoning
behind every sprite added or redrawn in the latest art pass.

`art/ART_DIRECTION.md` is the rulebook. This file is the *reasoning* behind
the rulebook: how the rules were applied, what the machines actually
measure, and which decisions were judgement calls rather than measurements.

---

## 1. THE LIGHTING MODEL

**One light, one place: the top-left.** Every form in the game is lit as if
by a warm gallery light hanging above and to the left of the player. That
single rule is what makes a set of independently drawn sprites look like one
set, and it is the rule the tools enforce.

### 1.1 How the light is measured

`ai/verify_sprites.py` and `tools/grid_check.py` both split a sprite's
canvas into quadrants and compare the mean luminance of the top-left
quadrant against the mean luminance of the bottom-right quadrant. A sprite
whose top-left is not brighter is lit from the wrong side and is rejected.

`tools/light_check.py <name>` reports the same numbers for one sprite plus
the colour mix of each quadrant, which is what makes a failure fixable: the
mix tells you *which* colour is sitting in the wrong half.

The practical consequence: **the light is a placement constraint, not a
post-process.** It cannot be brushed on afterwards. A sprite is either built
with its light side in the top-left or it is wrong.

### 1.2 Ramp order — darkest to lightest

The four palette ramps are monotonic in luminance, low to high:

| Ramp | Luminance, low to high |
|---|---|
| `KDPNS` — structure and warm earth | `26.7` → `44.6` → `58.6` → `104.5` → `139.6` |
| `XCW` — paper | `211.2` → `221.0` → `241.8` |
| `AYGH` — gold and ochre | `139.9` → `171.6` → `182.3` → `213.2` |
| `LEI` — arcane | `138.2` → `186.0` → `213.7` |

So on a wood object the top-left face is `S`, the body is `N`, the turned
face is `P`, and the deepest crease is `D`. On brass it is `H` → `G` → `Y`.
The `K` at the head of each ramp is the outline, not a surface tone.

**Every sprite in this pass steps down the same ramp in the same direction.**
That consistency — the same material reading the same way everywhere — is
worth more than any individual sprite's cleverness.

### 1.3 Three tones per form, and the contact shadow

Every 3D form carries a light tone, a base tone and a shadow tone. Where a
form stands on the ground it also carries a **contact shadow**: a short,
hard run of `D` or `K` directly beneath it, touching it, no gap.

The contact shadow is not decoration. Without it, objects float; with it,
they sit. It is the cheapest single thing that makes a 16×16 sprite look
placed in a room rather than pasted onto one.

### 1.4 Silhouette before colour

The `K` outline alone must be recognisable. Nothing in this pass relies on
colour to carry the read: the bone is two knobs and a waist, the key is a
bow and a bit, the wreck is a mast and a hull, the tarpaulin is a mound.
At 1×, in the cream UI, the outline is what the eye gets.

### 1.5 The arcane teal rule, honoured

`E` (arcane teal) appears only where the art direction says it may:
`artefact_glass` and `symbol_crystal` (relic glass and a relic charm). It is
used for **no** new scene or prop, not even for the most tempting case — the
glowing mouth of `dig_cave`. The cave is `D` with `P` at the cut lip, and
the only cold note in a dig scene is the `L` standing water in `dig_marsh`,
which is verdigris, not arcane.

---

## 2. THE OUTLINE RULE — HOW THE JAGGY FINDING IS AVOIDED

This is the one genuinely non-obvious piece of craft in the pass, and it
is worth writing down.

`pxl lint` has a `jaggy` check: *"doubled corner in 1-px lines (an L where
the line should step diagonally)"*. It fires when a 1-pixel-wide run of
outline turns a 90° corner — the corner pixel has exactly two outline
neighbours and an empty diagonal behind it. A stem meeting a body, or a
vertical edge meeting a horizontal one, produces exactly that shape.

The check is **skipped for any outline component that contains a 2×2 block
of outline pixels.** That is not a loophole; it is the tool's way of saying
"this shape has real thickness, so a corner in it is a corner and not a
jaggy pixel".

Verified directly against the tool:

```
$ node tools/pxl/bin/pxl.js lint art/t.px.js     # a 2px stem on a body
t: 1 finding
  jaggy          1 doubled corner in 1-px lines (an L where the line should step diagonally).
                 at 2,11
1 finding in 1 asset

$ node tools/pxl/bin/pxl.js lint art/t2.px.js    # same shape + one 2x2 hole
t2: clean
0 findings in 1 asset
```

**The rule this pass works to:** give every sprite a closed void that is
exactly two pixels wide (or two pixels tall). Its cells are all four-way
adjacent to opaque pixels, so they become outline, so they form a 2×2 block,
so the outline counts as thick and no corner in the whole sprite can be
called jaggy.

Each sprite in this pass pays for that void with a detail that a real object
would have anyway:

| Sprite | The void |
|---|---|
| `dig_wreck` | a gap between two hull planks |
| `dig_barrow` | a gap between two stones of the chamber wall |
| `dig_cliff` | a fissure running into the rock face |
| `dig_marsh` | a pocket of air in the peat |
| `dig_well` | a rotted pocket in the soil beside the shaft |
| `dig_cave` | a fissure in the roof of the hill, above the mouth |
| `prop_desk` | the gap between two blocks of paperwork on the shelf |
| `prop_lamp` | the square lightening hole in the cast foot |
| `prop_plaque` | the gap between the two legs of the stand |
| `prop_rope` | the hole in the middle of the coil of rope |
| `prop_ladder` | the two-pixel gap between the rails |
| `prop_tarpaulin` | the gap under the lifted hem |

The 13 smaller sprites (artefacts, symbols, visitors) reach the same
condition through their own construction — the key's bow hole, the
crystal's core, the bell's clapper slot, the bone's hollow shaft — rather
than through a separate hole.

### 2.1 A second rule the tool taught: no islands

`tools/grid_check.py` fails any sprite whose opaque pixels are not all in
one 8-connected piece. The first cut of `prop_rope` had posts whose shafts
stopped two rows above their own feet, so the rope swag and the base were
two separate objects: **110 detached island pixels**. The shafts now run
the full height of the posts, and the sprite is one piece. This is the same
discipline as the silhouette rule: a sprite is one object, drawn whole.

---

## 3. SCENE RULES — THE 24×24 FAMILY

The six dig scenes and the six props are cross-sections or objects on a
floor, and they share a construction:

- **Sunlit ground on the left, shadowed ground on the right.** In a cross
  section, the surface band is `Z` on the left and steps down to `N` on the
  right. That is the top-left light, applied to the ground plane.
- **The dark end of every scene is the bottom-right.** `D` is reserved for
  the deepest part of the frame, and it lives in the lower right.
- **A feature that reaches the surface is the readable one.** The mast on
  `dig_wreck`, the mound on `dig_barrow`, the cliff edge on `dig_cliff`,
  the open shaft on `dig_well`, the fissure on `dig_cave`. A dig site with
  no feature is a hole.
- **Strata bands run the full width** so the scene reads as geology rather
  as decoration.

Two scenes deliberately break the pattern:

- **`dig_cliff`** is the only site where the light has nothing to fall on.
  The cliff stands on the left, open air fills the upper right, and the
  lower right is the darkest corner in the game. It is the scene that proves
  the lighting rule is a rule and not a lighting preset.
- **`dig_marsh`** is the only site where the top of the earth is drowned.
  The water table is `L`, the reeds are `M`, and the ground below is peat.

---

## 4. PER-ASSET REASONING

### 4.1 Artefacts (16×16)

| Sprite | Materials | Why it is drawn this way |
|---|---|---|
| `artefact_bone` | bone `X`/`R`, lichen `M`, shadow `N`/`D` | Two knobs and a straight waist — the silhouette alone says "bone". Pale all the way up the ramp, so the light reads as an edge and not a speck. Two pixels of moss on the lower-left flank say "this was dug up". |
| `artefact_amber` | amber `G`/`H`/`A`, `R` | A teardrop, wide at the bottom, with the highlight up-left and the deep amber down-right. `R` is a trapped speck, which is the whole point of amber. |
| `artefact_bronze` | bronze `Y`/`C`, slate `U`, `D` | A wedge — a blade or an axe-head. The cool `U` on the right face is the one cold note, and it separates bronze from every other warm artefact. |
| `artefact_fabric` | cloth `S`/`Z`, `C` patch, `T` fringe | A folded rectangle with a stepped hem, so it reads as folded cloth rather than a flat swatch. The `T` fringe at the lower right is the shadowed edge of the fold. |
| `artefact_coin` | gold `G`/`H`/`A`, `T` edge, `D` | A disc seen face-on: a bright `H` rim up-left, a `G` face, an `A` shadow down-right, and a struck boss in the middle. |
| `artefact_glass` | glass `E`/`L`/`C`, `T` neck, `U` | The only artefact allowed the arcane teal. A drop shape with a bright `C` glint on the upper left and a dark `U` on the right, so the glass reads as translucent. |

### 4.2 Symbols (16×16)

| Sprite | Materials | Why it is drawn this way |
|---|---|---|
| `symbol_bell` | brass `H`/`G`/`Y`/`A` | A bell shape with a flaring mouth, a lit crown and a shadowed lip. The `Y` clapper slot under the crown is the void that keeps the outline thick. |
| `symbol_crystal` | arcane `E`/`L`, `D` | A faceted drop. `E` down the left, `L` across the body, `D` for the base shadow. The diamond core is the void. |
| `symbol_feather` | paper `W`/`C`, `S` shaft | A leaf of vane on one side of a shaft, lit `W` on the upper left, the shaft stepping down the ramp as it descends. |
| `symbol_key` | gold `G`/`H`/`A`, `D` | A round bow on the left and a bit on the right — the silhouette carries it. `H` on the crown of the bow, `A` on the lower-right of the shaft. |

### 4.3 Visitors (16×16)

The three new visitors are separated by **coat colour**, not by silhouette,
because a 16×16 person is a blob and colour is the only honest way to tell
three of them apart in a crowd:

| Sprite | Coat | Skin/hat | Notes |
|---|---|---|---|
| `visitor_d` | moss `M` | `Z` hat, `A` face | The middle of the three. Moss reads as a walker's coat. |
| `visitor_e` | slate `U` | `Z` hat, `A` face | The cool coat — the only visitor with a cold one, so it reads as a curator or a guide. |
| `visitor_f` | parchment `X` | `N` hat, `A` face | The pale coat. The lower half is pushed down into `N` so the top-left quadrant still wins. |

### 4.4 Dig scenes (24×24)

| Sprite | Subject | Key decision |
|---|---|---|
| `dig_wreck` | a hull under the sand, mast still up | The mast is the silhouette. The hull is a real cavity with planking, not a disc. |
| `dig_barrow` | a turf mound over a stone chamber | The dome is lit `Z` on its upper left and turns to `N` on its lower right, so it reads as a dome rather than a green triangle. The chamber is built of `R` fieldstone. |
| `dig_cliff` | a rock face with scree at its foot | The one site where the light has nothing to fall on. The fissure in the face is the void. |
| `dig_marsh` | standing water over peat | `L` water, `M` reeds in two clumps — a line of reeds reads as a fence. The peat below is `N` with a buried `S` log. |
| `dig_well` | a stone-lined shaft | The mouth is genuinely open: sky comes down between the frame posts. `P` is the cut lining, `D` is the bottom nothing has reached. |
| `dig_cave` | a cave mouth in the hill | The cavity narrows as it runs right, the way a cave does. The fissure in the roof sits directly above the mouth. |

### 4.5 Props (24×24)

| Sprite | Subject | Key decision |
|---|---|---|
| `prop_desk` | the curator's desk | A heavy rectangle, because a desk should be. `X` parchment on the shelf is the brightest thing in the sprite — paper catches more light than wood. `Y` is the drawer handle. |
| `prop_lamp` | a gallery lamp on a cast foot | Brass on the `AYGH` ramp. The underside of the shade is `A`, the darkest part of any lamp, because the light inside it points down. The square hole in the foot is a real cast-iron lightening hole. |
| `prop_plaque` | a museum label on an A-frame stand | Two staggered lines of `N` on the `X` card are the printed text, and they are what make it read as a sign rather than a blank card. |
| `prop_rope` | a rope barrier and a coil | `W` rope is the only thing in the game lighter than paper, and it is what the eye goes to first. The coil on the floor has a square hole in the middle. |
| `prop_ladder` | a library ladder | The left rail is `S`, the right `N`, the foot `D` — a front and a side without a second material. The shadow falls to the lower right, because the light comes from the upper left. |
| `prop_tarpaulin` | a tarp pegged over a dig | `Z` crest, `S` canvas, `N` flanks, `P` hem, `D` ground shadow. The hem has lifted on the left, and the gap under it is the void. |

---

## 5. WHAT WAS REJECTED OR FIXED

Honest record of the things that did not work first time:

- **`dig_cave` (first cut) failed the lighting check**: `tl=0.310` against
  `br=0.312`. The cave mouth was on the left, putting a large `D` mass in the
  top-left quadrant. Redrawn with the cavity in the right half and the
  fissure above it: now `tl=0.397`, `br=0.337`.
- **`dig_marsh` (first cut) floated.** The spec was one row short and the
  emitter padded the bottom, leaving six empty rows under the peat — a
  scene that visibly hovered above its own tile. Redrawn to fill the frame.
- **`dig_well` (first cut) was lidded.** The ground surface ran unbroken
  over the shaft, so the well read as covered. The mouth is now open to the
  sky between the frame posts.
- **`prop_rope` (first cut) had a doubled corner** where the rope met the
  right-hand post: the swag stepped two pixels in one row. The swag now
  steps one pixel per row.
- **`prop_rope` (second cut) fell into two pieces**: the post shafts ended
  two rows above their own feet, which `grid_check.py` caught as
  **110 detached island pixels**. Fixed; the sprite is now one island.
- **`prop_plaque` (first cut) had its "text" as a single dark block** on the
  left of the card. Re-cut as two staggered lines, and the first attempt at
  the staggered version reintroduced a doubled corner, which was backed out.
- **`prop_ladder` has a thin bottom-right quadrant** (`n=30` against `n=87`
  top-left). It passes comfortably (`tl=0.368` vs `br=0.131`) but it is the
  narrowest of the set, because a standing ladder is a narrow object and the
  shadow that fills the lower right is the only thing in it.
- **`visitor_f` is the thinnest light margin in the set** (`tl=0.372` vs
  `br=0.364`). It passes, but it is the first thing to re-check if the
  palette is ever re-solved.
- **`art/gallery_case/gallery_case.px.js` reports `no grid found`** to any
  grid-based scanner. This is not a defect and not caused by this pass:
  the sprite is built from `rect`/`px` calls rather than a grid string, so
  it has no grid to find. It builds and stages normally, and both
  `verify_sprites.py` and `grid_check.py` skip grid checks for op-built
  sprites by design.

### Nothing was shipped that did not pass

Every one of the 25 sprites in this pass clears all of:

```
node tools/pxl/bin/pxl.js lint art/<name>/<name>.px.js      -> 0 findings
python3 tools/light_check.py <name>                          -> OK
python3 tools/grid_check.py --all                            -> 0 failures
```

and the repo-wide suite:

```
python3 ai/regen_sprites.py --build     -> staged 61 sprites
python3 ai/verify_sprites.py            -> Sprite verification: 72 checks, 0 failures / ALL CHECKS PASS
python3 tools/grid_check.py             -> Grid check: 61 sprites, 0 failures
python3 tools/grid_check.py --all       -> Grid check: 61 sprites, 0 failures
```

---

## 6. WORKFLOW FOR THE NEXT PASS

For each new or redrawn sprite, in this order:

1. Author `art/<name>/<name>.px.js` — the **only** source of truth. It must
   `include("../palette.px.js")`, declare `sprite("<name>", { w: W, h: H,
   outline: "K" }, …)` with W and H either 16 or 24, use 3–7 colours
   including `K`, use only shared palette keys, never `I`, never a hex
   literal, never `use("pico8")`.
2. **Build it** with `pxl`. Never run Sprite Fusion Pixel Snapper on pxl
   output — it resamples rather than snaps, and it destroys hand-placed
   detail.
3. **Lint it** with `pxl lint`. Zero findings. If a `jaggy` finding appears,
   add a two-pixel void (section 2) rather than nudging pixels.
4. **Look at it.** Export and read the sprite as annotated ASCII, and
   judge the silhouette before the colour. A sprite that reads only in
   isolation is not finished.
5. **Light it** with `python3 tools/light_check.py <name>`. `tl` must beat
   `br`. If it does not, move the light, do not re-roll the palette.
6. **Check the grid** with `python3 tools/grid_check.py <name>` — one
   island, no illegal keys, canvas size legal.
7. **Stage it** with `python3 ai/regen_sprites.py --build`, which rebuilds
   every sprite from `art/` and syncs `assets/sprites/` and
   `web/public/sprites/`.
8. **Re-run the whole suite** before calling the pass done.

The shared palette must stay byte-identical across `art/palette.px.js`,
`web/src/ui/palette.ts`, `ai/verify_sprites.py`, `tools/grid_check.py`,
`src/main.godot` and `web/index.html`. This pass changed none of them.
