# GameStewKit

A mobile-ready Godot 4.7 starter for Kairosoft-style pixel management/tycoon
sims, plus a **headless economy simulator** so balance can be tuned before a
single sprite exists.

Built and verified on macOS 27 (M4 Max, 128 GB). Every target below was
produced by an actual export, not assumed.

## Verified build matrix

| Target | Status | Output |
|---|---|---|
| Android | ✅ builds, debug-signed | `build/android/GameStewKit.apk` |
| Web | ✅ builds | `build/web/` (index.html/wasm/pck) |
| macOS | ✅ builds | `build/macos/GameStewKit.zip` |
| iOS | ⛔ blocked on App Store Team ID | needs Apple Developer account ($99/yr) |

## Layout

```
project.godot          portrait 720x1280, GL Compatibility, ETC2/ASTC on
src/main.gd            touch-driven grid shell (mobile-first skeleton)
sim/sim_core.gd        pure-logic economy model — no engine deps
sim/run_sim.gd         headless balance harness
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

- Add art. Start with a 16×16 tileset; the sim needs none to be balanced.
- Wire `src/main.gd` to `SimCore` so the playable grid *is* the model.
- Add the AdMob plugin (Poing Studios, MIT, Godot 4.2+) for mobile ads.
- Test on a real phone early — the editor is not the device.
