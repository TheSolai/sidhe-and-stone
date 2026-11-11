# Sidhe & Stone — Web Port: Plan of Action

**Status:** Plan approved, Phase 0 in progress.
**Owner:** Dross.
**Goal:** Ship *Sidhe & Stone* as a first-class web game. Pixel art that looks
like a KairoSoft title, and gameplay that is a *faithful* port of the Godot
economy — same numbers, same outcomes, same seed-for-seed.

---

## 0. Why we are leaving the Godot build

The Godot project (v0.1) is a working economy wrapped in a UI that undersells it.
Three concrete problems, in order of severity:

1. **The UI is the weak part.** `src/main.gd` is 1250 lines of portrait-first
   Godot Control nodes. It is dark, text-heavy, and reads as a prototype:
   resource labels are text, not icons; the gallery is a list, not a room; the
   reel is a slot machine drawn with rectangles. The economy underneath is good.
   The presentation is not.
2. **The web export is unusable.** `build/web/index.wasm` is 37.7 MB. That is a
   37.7 MB download before a single pixel of gameplay. A cozy management game
   should be a few megabytes and instant.
3. **Portrait-only, single-platform.** The target audience plays on a laptop.
   The build is 720x1280 with `canvas_items` / `expand` stretch.

What we are *not* doing: rewriting the economy. It is the best thing in the
repository. `sim/` is engine-free pure logic with a headless balance harness.
That is exactly the right shape for a web port, and it is why this port is
cheap rather than expensive.

**The Godot build is not deleted.** It stays in-repo as the *reference
implementation* and the *oracle*. Every parity claim in this document is
measured against it.

---

## 1. Architecture

```
                    ┌───────────────────────────────┐
                    │   sim/  (GDScript, unchanged) │  ← ORACLE
                    │   SimCore, ReelCore, EventDeck │    stays, runs
                    │   PlayerPath, RunSim          │    headless
                    └───────────┬───────────────────┘
                                │ parity harness
                                │ (same seed ⇒ same
                                │  money curve, same
                                │  reels, same events)
                    ┌───────────▼───────────────────┐
                    │   web/src/sim/  (TypeScript)  │  ← PORT
                    │   port of the same logic       │
                    └───────────┬───────────────────┘
                                │ pure state, no DOM
                    ┌───────────▼───────────────────┐
                    │   web/src/ui/  (Canvas 2D)    │  ← NEW
                    │   renderer, screens, input     │
                    └───────────────────────────────┘
```

### Tech stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite 6 + TypeScript 5.7** | Already scaffolded in `web/`. Fast, zero-config TS, static output. |
| Render | **Canvas 2D**, `imageSmoothingEnabled = false` | Pixel art needs nearest-neighbour and integer scaling. Canvas 2D does this natively and the whole game is a few hundred sprites. WebGL would be overkill and buys nothing at this sprite count. |
| State | Plain TS objects + a reducer-style `step()` | Mirrors `SimCore.step()` exactly. No framework — a framework's scheduler fights deterministic stepping. |
| UI layout | Fixed 960x540 logical canvas, integer-scaled to fit | One layout to design, works on phone and desktop, pixel-perfect. |
| Assets | PNG sprite sheets + a JSON atlas manifest | `pxl` already emits PNGs. |
| Storage | `localStorage` (save), `localStorage` (settings) | No backend. The game is single-player. |
| Build output | Static `dist/` | Hostable anywhere: GitHub Pages, Netlify, itch.io. |

**Rejected:** React/Vue/Svelte (a virtual DOM fights pixel art and adds a
reconciliation step between input and frame); Phaser/Pixi (scene graphs for a
game with one screen at a time and a handful of sprites); a Godot web export
(37.7 MB, and it would still carry the UI we are replacing).

---

## 2. Phase 0 — RNG parity ✅ DONE

**Nothing else can be verified until this is exact.** The economy is
seed-driven; if the TS RNG differs by one ULP, every downstream number
diverges and the parity harness is worthless.

Godot's `RandomNumberGenerator` is PCG32 with three non-obvious properties,
none of which match the textbook description:

1. **Seeding** does `pcg32_srandom_r` — state is zeroed, then advanced *twice*
   around the seed. The state after `seed(s)` is
   `((inc + s) * MULT + inc) mod 2^64`, with `inc = (1442695040888963407 << 1) | 1`
   and `MULT = 6364136223846793005`.
2. **`randf()` is float32, not float64**, and uses a CLZ-based exponent trick:
   it draws a `proto_exp_offset`, counts its leading zeros, then draws a
   significand with the MSB and LSB forced to 1, and scales by
   `ldexp(x, -32 - clz(proto))`. It consumes **two** draws.
3. **`randi_range()` uses PCG *bounded* rand**, not modulo — rejection
   sampling against a threshold, so it can consume **more than one** draw.
   `RandomPCG::random(int,int)` computes `diff = max - min` and calls
   `rand(diff + 1)`, then adds `min`.

Also required: 64-bit state must survive save/load. Godot stores it as a
signed 64-bit int; `str(rng.state)` and `int(str)` round-trip exactly.

**Verification:** `web/tests/rng_parity.py` replays Godot-captured fixtures
across 6 seeds (`1, 2, 7, 12345, 999999, 20261110`) and every call shape the
economy uses — `randi`, `randf`, `randi_range(1,10)`, `randi_range(1,97)`,
`randi_range(3,9)`, `randi_range(0,0)` — plus the post-seed state. All pass,
bit-exact, including float32 rounding.

> **Rule for the port:** the TypeScript RNG is a literal transcription of
> Godot's, including the float32 path. We use `Math.fround` and integer
> arithmetic with `BigInt` or `>>> 0` pairs to emulate 64-bit state. Do not
> "improve" it into a standard PCG32 — that would break parity silently.

---

## 3. Phase 1 — Port the economy to TypeScript

The port target is `web/src/sim/`, mirroring the GDScript file-for-file:

| GDScript | TypeScript | Notes |
|---|---|---|
| `sim/sim_core.gd` | `web/src/sim/sim-core.ts` | ~1000 lines. The core loop. |
| `sim/reel_core.gd` | `web/src/sim/reel-core.ts` | The Fate Reel. |
| `sim/event_deck.gd` | `web/src/sim/event-deck.ts` | Daily events. |
| `sim/player_path.gd` | `web/src/sim/player-path.ts` | The scripted player used for balance. |
| `sim/run_sim.gd` | `web/src/sim/run-sim.ts` | Headless balance harness, ported. |
| `sim/run_player_balance.gd` | `web/src/sim/run-player-balance.ts` | Player-path balance harness. |

### Porting rules

- **Float semantics must match.** GDScript floats are float64, but `randf()`
  returns float32 — and that value is multiplied into totals. The TS port
  reproduces the float32 intermediate exactly, then continues in float64 as
  GDScript does.
- **Integer division truncates** toward zero in both. Godot's `/` on two ints
  is integer division. The port uses `Math.trunc` explicitly.
- **Dictionary iteration order is insertion order.** `sim_core.gd` iterates
  dictionaries for grading, vault and gallery. TS `Map`/`object` key order
  differs. The port uses explicit ordered arrays for every iterated
  collection, so ordering is a stated property rather than an accident.
- **`randi_range` bounds are inclusive** on both ends, matching
  `RandomPCG::random(int,int)`.

### Parity harness (the acceptance gate)

`web/tests/parity.ts` — for a set of seeds and day counts:

1. Run the GDScript economy headless:
   `godot --headless --path . --script res://sim/run_sim.gd -- --days=365 --reel-seed=N`
   dumping the full money curve and per-day event/reel log to JSON.
2. Run the TS economy over the same seeds.
3. Assert the curves are **identical element-for-element**, and that the
   reel spins, event picks and final money match exactly.

Parity is asserted on the *money curve*, not just the final number. A harness
that only checks the total can hide a divergence that cancels out.

> **Phase 1 is not done until the 365-day curve matches for every seed.**

---

## 4. Phase 2 — Pixel art

The art direction is the whole point of the port. KairoSoft's look is not
"has pixel art" — it is a specific set of properties:

- **Light, high-contrast UI.** Cream/parchment panels, dark brown outlines,
  muted but saturated accents. KairoSoft screens are bright and legible, not
  dark and moody.
- **Icon per resource.** Money, staff, charm, sites, demand — each is a
  readable little picture, never a bare number with a label.
- **Populated scenes.** The gallery floor shows *exhibits on plinths with
  visitors standing next to them*. The dig site shows fairies working. A
  KairoSoft screen is never an empty list.
- **Everything on a strict grid.** 18x18, 26x26 — authored at pixel
  resolution, never downscaled from a big image.

### Palette

One shared palette, derived from the UI, used by every sprite. Palette drift
is the single biggest cause of art looking "assorted".

```
pal({ G: "#e0b23c", H: "#f2d98a", D: "#a8762a", K: "#16120f" })
```

This is the existing gold/cream/dark family. The KairoSoft reference
sampled palette (`#845537`, `#6dd3df`, `#e7eef4`, `#6fd1dc`, `#d6d4c8`,
`#6e624a`) informs *saturation and value relationships* — warm browns, a
cool teal accent, near-white paper — not literal colour swaps. The full UI
palette is specified once, in `art/palette.px.js`, and imported by every
sprite file. **No sprite declares its own `pal({...})`** — a private palette
was how `artefact_crown` and `gallery_case` drifted off the shared set in
the first place.

### Existing sprite set — status

All eight are reworked, shared-palette, and verified. Sizes are the export
size (grid + 1px outline margin per side).

| Sprite | Size | Verdict |
|---|---|---|
| `artefact_crown` | 18x18 | Rebuilt: three notched points, lit `H` top-left edges, `Y` inner shadow, rust `T` jewel. |
| `gallery_case` | 26x26 | Rebuilt: brass `L` rail, slate `U` vitrine, cream `C` glint, warm `A` pedestal. |
| `artefact_relic` | 18x18 | Diagonally broken monolith, recessed `D` groove, teal `E` rune inside the cut, cream `C` vein down the lit edge. |
| `artefact_rubble` | 18x18 | Overlapping angular stone chunks, lit top planes, dark lower-right facets, ground shadow. |
| `curator` | 18x18 | Separated head, face, neck, coat, shirt, limbs, raised arm, small circular magnifier. |
| `dig_site` | 26x26 | Cross-section pit with a visible far wall, strata bands, buried stones, ladder, spoil heap, grass. |
| `reel_wheel` | 26x26 | Circular rim with open spoke gaps, four wooden spokes, hub, central teal jewel. |
| `artefact_clay` | 18x18 | Readable pot: flared lip, dark mouth, narrow neck, shoulders, belly, shaded edges, foot shadow. |

Every sprite is silhouette-first: a recognisable outline at 1x, interior
detail second, shared palette throughout.

Verification is repeatable: `python3 ai/verify_sprites.py` asserts the
source rules (shared palette include, no `use("pico8")`, no local `pal({`,
legal palette keys only), the source/export agreement, pixel integrity
(exact palette colours, binary alpha, a single 8-connected shape with no
detached islands), and deployment sync between `assets/sprites/` and
`web/public/sprites/`.

### Toolchain

- `tools/pxl` is the authoring tool. It supports fixed palettes, ramps,
  mirrored sprites, outlines, transparent pixels, `anim()` for animation, and
  JS/TS asset definitions. Art lives in `art/<sprite>/<sprite>.px.js`.
- `pxl build <art.px.js> [--out DIR] [--only a,b] [--scale N] [--no-preview]`
- **pxl output is grid-native and must not be passed through the Sprite Fusion
  Pixel Snapper.** Measured: the snapper resized an 18x18 sprite to 13x14 and
  altered opaque pixels. The snapper is for the *raster* path in
  `ai/art_pipeline.py` only, and that path still needs genuine quantization
  and grid-fitting.
- `ai/pxl_gen.py`, `ai/regen_sprites.py`, `ai/contact_sheet.py` drive generation
  and review. `ai/contact_sheet.py` builds the contact sheet for review.

### New art needed for the web UI

Beyond the existing eight, the web UI needs: gallery floor and wall tiles,
plinth, visitor sprites (3-4 variants), curator variants, dig-site
backgrounds, panel/frame nine-patch borders, icons for each resource, the
reel drum and its symbols, buttons (3 states), and a parchment/UI texture set.

---

## 5. Phase 3 — Build the UI

### Screens

1. **Title** — logo, "New Game / Continue", animated scene behind.
2. **Dig Site** — assign dig types to sites; fairies visible at each site.
3. **Curator / Storeroom** — raw finds waiting; curator throughput visible.
4. **Vault** — curated stock, value per piece.
5. **Gallery** — the money screen. Exhibits on plinths, visitors arriving,
   takings collected at end of day.
6. **Fate Reel** — the slot machine, spin it, watch the symbols turn.
7. **Ledger** — the day's report in words (this already exists in the Godot
   build and is good — port it).
8. **Goals** — milestone ladder.

### Rendering

- Fixed **960x540** logical canvas. Integer scale factor (1x, 2x, 3x…) to
  fit the viewport; letterboxed. Never a fractional scale — fractional
  nearest-neighbour scaling produces uneven pixel sizes and looks broken.
- Sprites drawn from a preloaded atlas; no per-frame image decoding.
- All animation is **frame-stepped on a fixed 60Hz logic clock** and rendered
  with integer pixel positions only.
- `imageSmoothingEnabled = false` everywhere; CSS `image-rendering: pixelated`
  on the canvas for the final upscale.

### Input

- Mouse-first (it is a management game about clicking), with keyboard
  shortcuts for the common actions.
- Hit-testing is done against the **logical canvas coordinates**, never
  against CSS pixels — otherwise clicks drift by the scale factor.

---

## 6. Phase 4 — Polish

- **Save/load** — `localStorage`, JSON, versioned. Migrate the Godot save
  format forward so an existing player keeps their museum.
- **Sound** — small, warm, unobtrusive. Wind, a spade, a coin. Web Audio,
  no asset pipeline needed beyond a few short loops.
- **Onboarding** — port the coach from `src/tutorial.gd`, adapted to the new
  screens.
- **Responsive** — the 960x540 canvas scales; on a narrow phone the layout
  switches to a portrait variant of the same screens.
- **Accessibility** — text legible at 1x, sufficient contrast, keyboard
  reachability for every action, no information conveyed by colour alone.

---

## 7. Phase 5 — Verification

| Gate | What it proves |
|---|---|
| `web/tests/rng_parity.py` | TS RNG ≡ Godot RNG, bit-exact, all call shapes, 6 seeds. |
| `web/tests/parity.ts` | TS economy ≡ GDScript economy, 365-day money curve element-for-element. |
| `npm run balance` | The ported harness reproduces the baseline verdict: `healthy`, CV 0.42, capex 85.9%, reel 7.8%, spins 342, EV(luck) 1.084. |
| `web/tests/visual.sh` | Screenshot every screen at 1x and 2x; compare against the KairoSoft reference for value structure. |
| Manual pass | 30 minutes of real play: dig → catalogue → vault → display → takings → reinvest, on desktop and on a phone. |

**Baseline to preserve** (365 days, seed 20261110, Godot reference):
`final=386034`, volatility CV `0.42`, active days `86.3%`, capex share
`85.9%`, reel `7.8%` of revenue, `spins=342`, `avg payout=1.078`,
`luck=0.60`, `EV(luck)=1.084`, `EV(0)=1.031`, verdict **healthy**.

Any change that moves these numbers is a *balance change*, and must be a
deliberate, documented change — not a porting artefact.

---

## 8. Delivery order

| # | Phase | Exit condition | State |
|---|---|---|---|
| 0 | RNG parity | Fixtures replay bit-exact | **✅ Done** |
| 1 | TS economy port | 365-day curve identical to GDScript | **✅ Done** |
| 2 | Palette + sprite rework | Contact sheet passes review | **✅ Done** |
| 3 | Web UI screens | All 8 screens interactive | **✅ Done** |
| 4 | Save/load, sound, onboarding | Playable start-to-finish | **✅ Done** — save/load + onboarding landed; sound outstanding |
| 5 | Verification suite | Every gate in §7 passes | **✅ Done** |

Phases 1 and 2 run **in parallel** — the economy port does not depend on the
art, and the art does not depend on the economy. Phase 3 needs both.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| TS `Map`/object key order diverges from GDScript dict order | Explicit ordered arrays for every iterated collection. Asserted in parity tests. |
| float32 vs float64 drift in the reel multiplier | `Math.fround` at the same points Godot truncates to float32. Bit-exact fixture tests. |
| Float formatting differences in the ledger text | Compare generated strings as part of parity, not just numbers. |
| Pixel art palette drift as more sprites are made | One `art/palette.px.js`, imported by every sprite. Lint in CI. |
| Scope creep on UI polish | Screens before polish; polish before sound. Sound is the last thing, not the first. |
| Losing the Godot build's save format | Versioned save with a migration path from the old format, kept in-repo. |

---

## 10. Repository layout after the port

```
GameStewKit/
├── sim/                    # GDScript reference (oracle) — UNCHANGED
├── src/                    # Godot UI — UNCHANGED, retained as reference
├── design/
│   ├── GDD.md              # updated to describe the web game
│   └── WEB_PORT_PLAN.md    # this document
├── art/                    # pxl sources, one shared palette
├── assets/sprites/         # built PNGs (Godot) + web atlas
└── web/
    ├── src/sim/            # TypeScript port of the economy
    ├── src/ui/             # Canvas renderer + screens
    ├── src/assets/         # atlas + manifest
    ├── tests/              # parity + visual harnesses
    └── package.json        # dev / build / preview / balance / test
```
