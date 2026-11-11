# ART DIRECTION — "The Museum Ledger"

The house style for **SIDHE & STONE**. Every sprite in this game obeys this
document. It is short on purpose, and every rule in it is checkable by
`ai/verify_sprites.py`, so the set cannot quietly drift apart again.

The reference is **Kairosoft** — *Game Dev Story* (Steam app `1847240`),
*Dungeon Village*, *Cavern Adventurers* — not grimdark pixel art. Kairosoft
art wins because it is **light, chunky and instantly readable**: cream paper,
dark warm linework, a few saturated accents, and forms that are legible at 1×
before you even look at the colour.

Our twist on it: this is a **museum**, so the art direction is *curatorial*.
Objects are lit like exhibits under warm gallery lights, on a warm cream
ground. The palette is the museum's own palette — parchment, oak, brass,
verdigris, gold — and the arcane teal is the one cold note in the whole
game, reserved for relics, omens and the Fate Reel.

---

## 1. ONE PALETTE

Every pixel comes from `art/palette.px.js`. Never a private colour, never a
second `pal({...})`, never `use("pico8")`. The key `"I"` is forbidden.

The palette is grouped, and each group means something:

| Group | Keys | Meaning |
|---|---|---|
| dark structure | `K` `D` `P` | outlines, deep shadow, panel edges |
| warm earth | `N` `S` `Z` | dirt, oak, leather, stone |
| paper | `X` `C` `W` | parchment, cream, paper white |
| gold & ochre | `A` `Y` `G` `H` | clay, ochre, gold, gold highlight |
| accents | `T` `M` `L` `E` `U` `R` | rust, moss, verdigris, arcane teal, slate, rubble grey |

### The palette is solved, not hand-picked

The values in `art/palette.px.js` came out of a deterministic solver fitted
against full-resolution *Game Dev Story* reference screenshots. It was told
to hit three things:

- **Sprite body luminance.** The target is a measured **per-sprite median of
  `110.0`**. The old palette sat at `94.9`, which is why the sprites read
  muddy on the cream UI surface. The solved palette measures `103.7`.
  (Do not use the screenshot-wide mean of `145.2` as a sprite target — that
  number includes large regions of cream UI and sky, so it describes the
  screenshot, not a sprite.)
- **Accent saturation floors**, so nothing drifts toward grey.
- **Every audited UI foreground/background contrast pair**, so the interface
  does not regress while the artwork gets brighter.

The paper surfaces `X`/`C`/`W` and the gold-and-rust accents are **pinned**:
they carry the UI's bevels and the game's identity, and a solver left free
to drift them flattens the panel edges or bleaches the gold.

The solve also fixed a latent bug. The ramp `KDPNS` was declared as
increasing lightness, but `S` (lum `95.6`) was actually *darker* than `N`
(`98.9`), so `lighting()` stepped the earth ramp the wrong way and the warm
earth family shaded backwards. Every ramp is monotonic now:

| Ramp | Luminance, low to high |
|---|---|
| `KDPNS` | `26.7` → `44.6` → `58.6` → `104.5` → `139.6` |
| `XCW` | `211.2` → `221.0` → `241.8` |
| `AYGH` | `139.9` → `171.6` → `182.3` → `213.2` |
| `LEI` | `138.2` → `186.0` → `213.7` |

If the palette is ever re-solved, it must be re-landed in **every** mirror:
`art/palette.px.js`, `web/src/ui/palette.ts`, `ai/verify_sprites.py`,
`tools/grid_check.py`, the Godot colour constants in `src/main.gd`, and
`web/index.html`.

## 2. TWO CANVASES, NO OTHERS

- **16×16** — objects, symbols, icons, people.
- **24×24** — scene props (`dig_site`, `gallery_case`, `reel_wheel`).

Nothing else. The exported PNG is the canvas plus a 1px `K` outline on every
side, so a 16×16 sprite exports at 18×18 and a 24×24 prop at 26×26.

## 3. SILHOUETTE FIRST

The `K` outline alone, filled solid, must be recognisable. A crown has
points. A pot has a neck and a foot. A wheel has a rim. No gaps in the
outline, no detached specks, no islands.

## 4. LIGHT FROM THE TOP-LEFT, ALWAYS

This is the single rule that makes a set look like a set. The upper-left face
of any form is its **lightest** pixel; the lower-right face is its **darkest**.

Every 3D form gets exactly **three tones**:

- **light** — the face pointing up-left
- **base** — the main colour
- **shadow** — the face pointing down-right

`ai/verify_sprites.py` measures this: the mean luminance of a sprite's
top-left quadrant must exceed the mean luminance of its bottom-right
quadrant. A sprite that fails is lit from the wrong side and gets fixed.

## 5. MATERIAL PALETTE — FIXED

A material always uses the same tones, so two objects made of the same stuff
look like the same stuff:

| Material | base | light | shadow | deep |
|---|---|---|---|---|
| clay / terracotta | `A` | `Z` | `S` | `D` |
| rubble / stone | `R` | `X` | `N` | `D` |
| arcane / verdigris | `L` | `E` | `D` | — |
| gold / brass | `G` | `H` | `Y` | — |
| oak / wood | `N` | `Z` | `S` | `D` |
| slate / metal | `U` | `X` | `N` | `D` |
| moss / growth | `M` | `X` | `N` | `D` |
| rust / danger | `T` | `Y` | `N` | `D` |
| paper / cream | `C` | `W` | `X` | — |
| skin | `A` | `Z` | `S` | `D` |

## 6. COLOUR BUDGET

**Three to seven** distinct colours per sprite. At least three, because a
sprite with one or two colours is a silhouette, not a drawing. At most seven,
because the point of one shared palette is that you cannot start inventing
shades.

## 7. NO SUB-PIXEL NOISE

Single pixels are for eyes, jewels and deliberate accents only. Never scatter
lone pixels to fake texture — that reads as noise at 1×.

## 8. TEXTURE, NOT FLATNESS

A large surface gets dithering (Bayer 4×4), a shade step, or a second tone.
Never one flat colour across a big area. Earth, water and sky want dithering;
metal and gold want a hard highlight edge.

## 9. INTERIOR LINES ARE NOT OUTLINES

Inside the silhouette, separate forms with the material's **shadow** colour,
never `K`. `K` is only ever the outer outline. A sprite that is mostly `K`
inside is a blob.

## 10. THE ACCENT RULE

Exactly **one** accent colour per sprite: the colour that says what the thing
*is*. The crown's `T` jewel. The relic's `E` glow. The lantern's `W` glass.
Everything else is base, light and shadow.

---

## Grade identity

Each grade owns a hue, so a shelf reads at a glance:

| Grade | Material | Reads as |
|---|---|---|
| `rubble` | stone (`R`/`X`/`N`) | grey broken chunk |
| `clay` | terracotta (`A`/`Z`/`S`) | warm pot, red band |
| `tablet` | slate (`U`/`X`/`N`) | inscribed stone slab, cool |
| `relic` | verdigris (`L`/`E`) | teal carved stone, arcane glow |
| `mask` | rust & gold (`T`/`Y`/`G`) | ceremonial mask, warm, gilt |
| `crown` | gold (`G`/`H`/`Y`) | the warmest thing in the game |

## Reel symbols

Each Fate Reel symbol is a 16×16 sprite, one motif, one accent:

`clover` moss `M` · `honey` gold `Y` · `moon` arcane `E` ·
`star` gold `H` · `bog` moss `N` · `blight` rust `T`

They are drawn as **shapes**, never as text glyphs. A reel window showing a
font character instead of a sprite is a bug.

## The working example

`art/artefact_crown/artefact_crown.px.js` is the canonical reference: three
notched points, `H` on the lit top-left of each point, `Y` on the shadowed
inner-right, a `T` jewel set into the band, a `Y` bottom lip so it reads as
a ring rather than a block. Copy its discipline, not its subject.
