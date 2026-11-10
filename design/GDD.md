# Sidhe & Stone — Game Design Document

**Working title:** Sidhe & Stone
**Genre:** Cozy management simulation (KairoSoft lineage)
**Platform:** iOS / Android (portrait first), then Web and desktop
**Engine:** Godot 4.7.2
**Status:** Vertical slice in progress. Economy implemented and balance-validated
headless. UI not yet wired.

---

## 1. Premise

You run a small excavation outfit in rural Ireland, digging into old fairy
mounds and ring-forts. Your fairies — the Sidhe, and the odd friendly ghost —
do the digging, the cataloguing and the polishing. You decide what goes in
the gallery and what stays in the vault.

Visitors come. Scholars, donors, schoolchildren, the mildly curious. They
pay for the privilege of looking at what you pulled out of the ground.

Nothing dies. Nothing attacks. The worst thing that happens is a bad night
with the case doors unlocked.

**Tone:** quiet, warm, archaeological. Mud, lamplight, handwritten labels in
small neat boxes. The fantasy is that Ireland's past is *manageable* — that a
clever enough outfit with good fairies can dig it up, understand it, and show
it to people, one careful day at a time.

**Player fantasy:** being the person who finally worked out what was under the
hill, and being quietly proud of the glass case it now sits in.

---

## 2. The core loop

```
   dig  ──►  catalogue  ──►  vault  ──►  display  ──►  takings  ──►  reinvest
 (site)      (curator)      (store)      (gallery)     (daily)       (upgrades)
```

1. **Dig.** Assign a dig type to each site. Test pits are fast and cheap but
   shallow. Trenches take three days. Shafts take six and can bring back a
   crown. A site occupied by a dig is a site not producing.
2. **Catalogue.** Finds arrive as raw dirt-encrusted lumps. Curators clean,
   label and assess them. Curators are a *throughput bottleneck* — digging
   more without more curators just piles up in the storeroom, which is where
   the tension lives.
3. **Vault.** Curated exhibits are stored. Vaulted pieces earn nothing.
4. **Display.** Move pieces onto the gallery floor. Displayed pieces earn
   every day that visitors come.
5. **Takings.** Visitors pay for the most valuable pieces on display, up to a
   daily demand cap. Beyond the cap, extra display is wasted risk.
6. **Reinvest.** Surplus buys more sites, curators, gallery slots, ward
   fairies, and fortune-tellers (the luck upgrade).

### The daily decision (the heart of the game)

**Vault vs. display.** A vaulted exhibit is safe but earns nothing. A
displayed exhibit earns every day — and is exposed to theft overnight. The
player is constantly deciding how much of their good stock to put at risk,
and how much insurance (ward fairies, locked cases) to buy.

This is the whole game in one choice: *greed vs. security, with a price tag
you can compute exactly.*

---

## 3. The economy

Implemented in `sim/sim_core.gd` as pure logic, deliberately free of engine
dependencies so it can be run headless for thousands of days and balanced
numerically before any art exists.

### Artefacts

| Grade | Curated value / day | Theft attraction |
|-------|--------------------|------------------|
| Rubble | 18 | 1.00× |
| Clay | 45 | 1.15× |
| Relic | 110 | 1.30× |
| Crown | 300 | 1.60× |

Crowns are worth six times a relic and pull half again as much attention.
That spread is the entire risk curve in one table.

### Excavation

| Type | Days | Cost | Finds | Grade mix |
|------|------|------|-------|-----------|
| Test pit | 1 | 12 | 2 | 70% rubble, 30% clay |
| Trench | 3 | 40 | 4 | 10% rubble, 55% clay, 35% relic |
| Shaft | 6 | 95 | 3 | 25% clay, 60% relic, 15% crown |

Deeper is better *and* slower *and* more theft-prone. There is no free lunch.

### Demand cap (why you cannot simply dig more)

Visitors pay for at most `N` exhibits a day, where N grows slowly with the
calendar and with gallery upgrades. Display a hundred relics and only N of
them earn. The rest sit there being stealable. This is what stops the game
degenerating into "dig faster, win faster" — you must build *demand*
(gallery slots, reputation) alongside *supply*.

### Upgrades

| Upgrade | Effect | Base cost | Escalation | Cap |
|---------|--------|-----------|------------|-----|
| Site | +1 dig site | 180 | 1.45 | 24 |
| Curator | +1 curator | 520 | 1.55 | 8 |
| Gallery | +2 slots, ×1.32 demand | 700 | 1.60 | 12 |
| Omen | +0.10 luck (Fate Reel) | 620 | 1.50 | 6 |
| Diggers | +6% finds per dig | 240 | 1.40 | 6 |
| Archivists | +8% curated value | 380 | 1.45 | 6 |
| Wards | −1.2% theft chance | 300 | 1.40 | 4 |

Costs escalate geometrically so the player cannot buy everything at once.

### Ledger separation (do not break this)

Capital expenditure — buying a site, a curator, a fairy — is **investment**,
not operating loss. It is tracked on a separate line from recurring operating
cost, and the volatility test looks only at operating income. Folding
reinvestment into the daily expense line made every upgrade look like a
catastrophic loss day and the harness cried `CHAOTIC` for an economy that was
perfectly healthy. This was a real bug, caught by the harness, and the fix is
load-bearing.

---

## 4. The Fate Reel

Implemented in `sim/reel_core.gd`. A three-symbol reel, spun before the day's
takings are collected, multiplying that day's takings.

| Symbols | Multiplier |
|---------|-----------|
| Clover | 1.30× |
| Honey | 1.60× |
| Moon | 2.00× |
| Star | 2.60× |
| Bog | 0.90× |
| Blight | 0.85× |

- Three of a kind pays the symbol's multiplier.
- A pair pays a fraction of the bonus.
- **A miss pays exactly 1.0×** — never a punishment. Cozy games punish through
  opportunity cost, not by taking money back.
- **Bounded both ways**: 2.6× best, 0.85× worst. An unbounded jackpot creates
  absolute swings that swamp the economy and make the game unreadable.
- **Luck raises EV.** Luck shifts weight toward the rewarding end. EV at
  luck 0.60 is **1.084** vs **1.031** at zero luck. Luck is the thing the
  player is really buying; the reel is the lens that displays it.
- **Charms cost 2 per spin** and are earned from takings. Every spin spends
  real production income, which is what makes it a decision rather than a free
  money printer.

### The hard constraint

**Reel-attributable revenue must stay under 45% of gross.** Above that, the
management layer stops mattering and the game collapses into "spin forever".
The harness enforces this as a failing verdict. Measured: **3.7%** over 365
days. The reel is upside, never the foundation. A player who never spins
earns a fair, steady income.

---

## 5. Balance methodology

The economy is tuned by running `godot --headless --path . --script
res://sim/run_sim.gd -- --days=365` and reading the `VERDICT` line. The
harness judges the *economy*, not the bank balance — cumulative money is
supposed to grow, so the verdict is driven by operating income.

**Failing verdicts and what they mean:**

| Verdict | Meaning |
|---------|---------|
| `STALLS — early game earns nothing` | First third of median operating income ≤ 0. The opening is a trap. |
| `DECLINING` | Late income < 50% of early. The player peaks then dies. |
| `RUNAWAY` | Late income > 50× early (or > 500). Money compounds without limit. |
| `STALLS — player idles too often` | Under 35% of days made a profit. Nothing to do. |
| `REEL DOMINATES` | The reel drove over 45% of revenue. The luck mechanic is eating the game. |
| `CHAOTIC` | Daily operating income CV over 4.0. Unreadable swings. |

### Current validation

Baseline (365 days, reel on):

```
money: day1=24  final=88126
operating income/day: early=4225  late=11912   volatility CV=0.45
active days: 85.8%   capex share of revenue: 93.1%
reel: 3.7% of revenue | spins=162 avg payout=1.071 | luck=0.60 | EV(luck)=1.084 EV(0)=1.031
VERDICT: healthy (operating income stable across the curve)
```

Reel off: also healthy. Parameter sweeps across demand growth (600–1400),
market gain (1.20–1.45), site upkeep (1–4) and reel cost (1–5) all return
`healthy`.

**Note on capex share:** 93% of revenue is reinvested. That is high, but it is
the greedy reinvestment policy working as designed — surplus buys upgrades
rather than accumulating. It is a signal the growth loop is being driven by
player decisions, not by idle accumulation. Worth watching; if it ever
approaches 100% it means the player can never bank a buffer, which would make
a bad night unrecoverable.

---

## 6. Art direction

**Look:** 16×16 and 24×24 pixel sprites, limited palette, hard edges, flat
cel shading, one dark outline colour per sprite. Pixel strata in the
backgrounds — bands of ochre and clay. Lamplight pooling around the gallery
cases. Handwritten labels as tiny 3×5 pixel text on the exhibit cards.

**Palette anchor:** deep peat browns, ochre, moss green, and a cold
blue-grey for shadow. Accent colours only on the artefacts themselves, so the
gallery reads as a calm room with a few bright objects in it.

**Pipeline:** fully local, no API keys, no runtime network calls.
`qwen3-coder:30b` writes `pxl` source code → `pxl build` → `pxl lint` →
errors and lint findings fed back for repair → `llava:34b` vision critique →
second pass. `pxl build --godot` emits Godot 4 `SpriteFrames` `.tres`
automatically. See `ai/pxl_gen.py`.

**Critical lesson:** tracing a rendered image into a sprite produces mush. A
photograph has no pixel grid to recover. Pixel art has to be *drawn* at sprite
resolution — which is why the pipeline generates code rather than converting
images.

---

## 7. UI

Portrait. One thumb. Five-minute session shape: open, take the day's
decisions, glance at the result, close.

- **Top bar:** money, day, charms, luck.
- **Centre:** the gallery floor — grid of exhibit slots with sprite, grade,
  and a lock icon if warded.
- **Bottom tab bar:** Gallery · Dig Sites · Curators · Staff · Reel.
- **The Fate Reel** lives in its own tab with a physical reel that animates
  through its symbols. The player can always see the current payout table, so
  the mechanic never feels arbitrary.
- **Vault** is a separate tab from Gallery. Moving an artefact between them
  is the core interaction and should be one drag.

---

## 8. Monetisation

Free to play. Core loop never paywalled.

- **Display case skins** (cosmetic, cosmetic only)
- **Extra vault slots** (convenience — inventory space, never power)
- **Seasonal passes** (cosmetics + charm bundles)
- **Hard rule:** no purchasable luck, no purchasable artefact values, no
  "skip the interesting decision" purchases. The reel spins with earned
  charms or not at all.

---

## 9. Scope: what ships in the vertical slice

1. One full loop: dig → catalogue → vault → display → takings → reinvest.
2. Portrait mobile UI wired to `SimCore`.
3. A visible, animated Fate Reel.
4. Pixel art for: three dig-site states, four artefact grades, one gallery
   case, one curator, the reel, and the UI chrome.
5. The balance harness running alongside, so every art/economy change is
   re-validated the same day.

**Not in the slice:** multiplayer, the full artefact roster, story events,
audio, iOS release (blocked on an Apple Developer account).

---

## 10. Open questions

1. **Does the vault-vs-display risk read as fun or as fiddly?** The theft rate
   (5% base per displayed artefact per night, capped at 2/night) is currently
   a guess. It needs playtesting, not reasoning.
2. **Is the demand cap visible enough?** Players must understand that a tenth
   relic on display earns nothing. The UI has to *show* that, not just
   enforce it.
3. **Art volume.** Every artefact grade and every dig state needs sprites. The
   local pipeline makes this cheap but its output needs a human eye; the
   `llava:34b` critique is advisory only and has already misidentified
   subjects.
4. **Does the Fate Reel need to be per-site rather than per-day?** Per-day is
   simpler and validated. Per-site would make the gamble more granular and
   more interesting, at the cost of a much larger tuning space.
5. **Monetisation timing.** The genre earns from a large catalogue rather than
   one deep game. Worth revisiting whether Sidhe & Stone is the first of
   several, and whether its systems should be built to be reused.

---

## 11. Design lineage

Derived from the ten-concept shortlist in `design/concept_shortlist.md`.
Three concepts were cut: *The Wild Hunt Riders* (breaks the cozy register)
and *The Lughnasadh Matchmaker* (tone drifts into dating-simulation), and
*The Harvest Mound* (overlaps farming too closely).

Sidhe & Stone was chosen because its loop has a **daily risk/reward decision
with no timer or combat involved** — the vault-vs-display choice — and because
its subject matter (pixel strata, small artefacts, glass cases, lamplight) is
the most forgiving of the ten for a low-resolution art style, which is
exactly the constraint local generation imposes.
