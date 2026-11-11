# GameStewKit

A mobile-ready Godot 4.7 starter for Kairosoft-style pixel management/tycoon
sims, plus a **headless economy simulator** so balance can be tuned before a
single sprite exists.

Built and verified on macOS 27 (M4 Max, 128 GB). Every target below was
produced by an actual export, not assumed.

## Verified build matrix

| Target | Status | Output |
|---|---|---|
| macOS | ✅ builds, installs, launches | `build/macos/Sidhe & Stone.app` + `.dmg` |
| Android | ✅ builds, debug-signed | `build/android/GameStewKit.apk` |
| Web | ✅ builds | `build/web/` (index.html/wasm/pck) |
| iOS | ⛔ blocked on App Store Team ID | needs Apple Developer account ($99/yr) |

## Building the Mac app

```bash
./tools/build_mac.sh                # export, verify, install to /Applications
./tools/build_mac.sh --no-install   # export and verify only
```

One command, and it verifies rather than assumes: the bundle must be a
universal binary with both `arm64` and `x86_64` slices, the `Info.plist`
must parse, the app must be signed, and the app must actually launch and
exit on its own. It leaves a `.app` in `build/macos/` and a `.dmg` beside it.

Two traps are already handled, and both are worth knowing about:

- **Godot writes an invalid `Info.plist` when the project name contains
  `&`.** It escapes the name correctly in `CFBundleName` but writes it raw
  in `CFBundleExecutable`, so the plist is not well-formed XML and macOS
  refuses to launch the bundle. The build script repairs the XML before
  loading it, then puts the real title back.
- **Signing is ad-hoc.** There is no Apple Developer account on this
  machine, so there is no certificate to sign with and nothing to
  notarise against. It runs fine locally. Sharing it with someone else
  would need a real Developer ID, which is a purchase, not a setting.

## Layout

```
project.godot          portrait 720x1280, GL Compatibility, ETC2/ASTC on
src/main.gd            touch-driven grid shell (mobile-first skeleton)
src/game_state.gd      player-facing seam over the economy (UI never touches SimCore)
src/goals.gd           12-goal progression ladder, measured from real player actions
sim/sim_core.gd        pure-logic economy model — no engine deps
sim/run_sim.gd         headless balance harness
sim/player_path.gd     plays the game the way a player does, through GameState
sim/run_player_balance.gd  milestone-ladder balance harness
tests/validate.sh      the standing validation workflow
export_presets.cfg     all four targets, known-good settings
```

## The balance harness (the point of this kit)

Kairosoft-style games live or die on economy tuning. Normally that means
playing by hand, for hours, with a spreadsheet. Instead the economy is pure
logic, so it runs headless for 365 simulated days in about a second.

```bash
cd ~/Projects/GameStewKit
godot --headless --path . --script res://sim/run_sim.gd -- --days=365
```

```
=== GameStewKit balance report (365 days) ===
money: day1=0  final=22151
net income/day: early=826  late=503
active days: 79.7%
owned: plots=22 mills=6 market=12
VERDICT: healthy (net income stable across the curve)
```

Tuning flags: `--days=N`, `--demand-growth=N`, `--market-gain=F`,
`--upkeep-plot=N`.

The verdict is driven by **daily net income**, not bank balance — cumulative
money is *supposed* to grow. A healthy curve holds net income roughly stable
while the player's holdings climb.

### The three-part economic model

1. **Demand caps** — the village buys at most N units of each item per day.
   You cannot sell infinite wheat. This is the ceiling that stops runaway
   compounding.
2. **Escalating costs** — each upgrade costs geometrically more than the last
   (`plot` 1.45×, `mill` 1.55×, `market` 1.60×), and running more
   plots/mills costs more every day.
3. **Reinvestment** — surplus money buys `market` upgrades that raise demand,
   which lets you sell more. This is the intended growth loop.

Two earlier designs were tested and rejected by the harness: flat upkeep (money
went negative, player idled — *FLAT*) and unbounded selling (money compounded
without limit — *RUNAWAY*). Both were caught in seconds, before any UI existed.

## Mobile-first settings already applied

- Portrait 720×1280, `canvas_items` stretch, `expand` aspect → safe on any
  phone ratio without letterboxing.
- **GL Compatibility** renderer — the only path that reaches older Android
  devices. Forward+ is not an option for a broad mobile audience.
- `emulate_touch_from_mouse=true` → click in the editor, tap on device.
- ETC2/ASTC texture compression enabled — **Android export refuses to run
  without it**.

## The standing validation workflow

```bash
cd ~/Projects/GameStewKit
./tests/validate.sh            # smoke + economy + ladder + event deck
./tests/validate.sh --visual   # ...plus UI and reel captures
```

Five stages: UI smoke test (drives real player actions, checks all six tabs
render), 365-day economy baseline, player-path balance with the milestone
ladder, the daily event deck's neutrality check, and — under `--visual` — a PNG
per tab plus a mid-spin reel capture.

Two rules the harnesses enforce, both learned the hard way:

- **A capture must prove the screen redrew.** Every PNG can save with `err=0`
  while the display is asleep and the framebuffer is frozen. The harness
  fingerprints the pixels and reports `FROZEN` when consecutive frames are
  byte-identical, and `validate.sh` **fails** on that verdict.
- **Wait on `force_draw()`, not on presentation.** `await process_frame` fires
  when a frame is *scheduled*; `await RenderingServer.frame_post_draw` waits
  for a *presentation*, which macOS suspends when the window is occluded — the
  await then never resumes and the run hangs. `RenderingServer.force_draw()`
  renders into the viewport texture either way.

## The milestone ladder

12 goals across `Opening`, `Steady Trade` and `Renown`. They measure actions
players already perform (dig, display, earn, hire) rather than adding new
verbs, and they pay out automatically into the ledger.

The balance harness plays through `GameState` — the same path a player uses —
so milestone payouts feed back into measured progression. Rewards are scaled
against the player's **measured gross daily takings at the moment the
milestone lands**, and every cash milestone must land within 1.0–12.0×
daily takings:

```
goal                   day    reward takings/day    ratio
A Very Good Day          5       250         64     3.93
The Treasury Grows       8       950        226     4.20
Full Coffers            14      2500        576     4.34
An Institution          30     12500       2097     5.96
Renowned                60     36000       8729     4.12
LADDER VERDICT: healthy (every cash milestone is worth 1.0-12.0x daily takings)
```

Milestones that land before the gallery earns anything pay in charms and luck
instead of cash — otherwise milestone income masks an underlying economy
problem instead of revealing it.

The yardstick is a **winsorized mean** of the trailing week's gross takings:
a plain median would collapse to zero in the early game, where most days earn
nothing because the gallery is still empty (those zeros are structural, not
noise), and a plain mean would let one loud Fair Day drag the number a
milestone is scaled against.

## The daily event deck

Every day gets weather. `sim/event_deck.gd` is a seeded, pure-logic deck of
eight events — a Fair Day, rain, the Wardens' Walk, Thief's Moon, a curator's
holiday, an extra pair of hands, a notice in the paper — that change demand,
theft risk, curation throughput and charms.

Two rules make it safe to ship:

- **It is rolled ahead of the day it governs.** The player sees the weather
  *before* they commit the gallery floor, so it informs a decision instead of
  explaining one afterwards.
- **It is proven neutral, not assumed neutral.** `tests/validate.sh` runs the
  same 365-day simulation twice — once with the deck, once without — and
  fails if the economy drifts more than 8%. The deck's own multipliers
  average to demand 1.0, theft 1.0, curation 0.0, with charm EV held at
  0.2/day. A daily event system is the easiest way to accidentally rebalance
  a management sim while looking like pure flavour.

```
--- deck multipliers ---
demand EV=1.0000  theft EV=1.0000  curation EV=0.0000  charm EV=0.2000
--- economy with deck vs without ---
pure sim:  median daily operating income  decked=11539  bare=11817  ratio=0.976
player path: median daily operating income  decked=11350  bare=11263  ratio=1.008
EVENT VERDICT: neutral (the deck changes the shape of a day, not the slope of a campaign)
```

## Export gotchas (cost real time — don't repeat them)

1. Android export **refuses to run** unless
   `rendering/textures/vram_compression/import_etc2_astc=true`.
2. Every `[preset.N]` needs a matching `[preset.N.options]` section, plus
   `export_filter` / `include_filter` / `exclude_filter` keys. Missing →
   "Cannot get keys from nonexistent section", export aborts.
3. iOS `application/min_ios_version` must be **14+** (Metal renderer).
4. Android builds need `JAVA_HOME=/opt/homebrew/opt/openjdk@17` explicitly —
   Homebrew's `java_home` cannot see it.
5. iOS needs `application/app_store_team_id` — set from your Apple Developer
   account. Without a signing identity the export cannot complete.

## Next steps

- Play the slice and say what's *boring* — that critique gates the Kairosoft
  onboarding work, which is the real craft in the genre.
- Add art. Start with a 16×16 tileset; the sim needs none to be balanced.
- Add the AdMob plugin (Poing Studios, MIT, Godot 4.2+) for mobile ads.
- Test on a real phone early — the editor is not the device.
