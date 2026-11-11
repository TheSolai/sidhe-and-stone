/**
 * The player-path balance harness.
 *
 * The TypeScript twin of `sim/run_player_balance.gd`. It plays the player's
 * game through `PlayerPath` -- a competent player written as code -- rather
 * than driving the economy on autopilot.
 *
 * WHY THIS EXISTS
 *
 * The autopilot proves the economy is balanced for a SIMULATION. Milestones
 * live in `GameState`, so an autopilot never saw a milestone payout, never
 * had its spending decisions changed by one, and never proved that the
 * ladder the player climbs is worth anything. This harness plays the
 * player's game: same object, same actions, same rewards.
 *
 * It also measures the MILESTONE LADDER. A reward has to be worth a
 * meaningful slice of the income the player has at the moment it lands. Too
 * small and the ladder stops mattering; too large and the milestone
 * replaces the game. The harness MEASURES that ratio and fails if it
 * drifts outside the band, so the rule cannot rot.
 *
 * Run:
 *   node --experimental-strip-types web/src/sim/run-player-balance.ts -- --days=180
 *
 * Exit code is always 0. Read the VERDICT lines.
 */

import { GameState } from './game-state.ts';
import { play } from './player-path.ts';
import { analyse } from './sim-core.ts';

interface Options {
  days: number;
  reelPolicy: string;
  reelCost: number;
  charmRate: number;
  reelSeed: number;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    days: 180,
    reelPolicy: 'always',
    reelCost: 2,
    charmRate: 1.0,
    reelSeed: 20261110,
  };

  for (const arg of argv) {
    if (arg.startsWith('--days=')) opts.days = Number(arg.slice(7));
    else if (arg.startsWith('--reel-policy=')) opts.reelPolicy = arg.slice(14);
    else if (arg.startsWith('--reel-cost=')) opts.reelCost = Number(arg.slice(12));
    else if (arg.startsWith('--charm-rate=')) opts.charmRate = Number(arg.slice(13));
    else if (arg.startsWith('--reel-seed=')) opts.reelSeed = Number(arg.slice(12));
  }

  return opts;
}

/** A milestone reward should be worth roughly this many days of takings. */
const TARGET_DAYS = 4.0;
/** ...and never outside this band, as a multiple of DAILY gross takings. */
const RATIO_FLOOR = 1.0;
const RATIO_CEILING = 12.0;

const opts = parseArgs(process.argv.slice(2));

const state = new GameState();
const core = state.sim;
core.reelPolicy = opts.reelPolicy;
core.reelCharmCost = opts.reelCost;
core.charmPerUnit = opts.charmRate;
core.reel.reseed(opts.reelSeed);

const result = play(state, opts.days);

const report = analyse(
  result.money_curve,
  result.revenue_log,
  result.opex_log,
  result.capex_log,
  result.reel_revenue_log
);

console.log('--- player-path harness ---');
console.log(`  days:            ${result.days}`);
console.log(`  final money:     ${Math.round(result.money_curve[result.money_curve.length - 1] ?? 0)}`);
console.log(`  sites:           ${result.sites}`);
console.log(`  curators:        ${result.curators}`);
console.log(`  gallery:         ${result.gallery_upgrades}`);
console.log(`  omens:           ${result.omens}`);
console.log(`  charms:          ${result.charms}`);
console.log(`  luck:            ${result.luck.toFixed(2)}`);
console.log(`  reel spins:      ${result.spins}`);
console.log(`  avg payout:      ${result.avg_payout.toFixed(3)}`);
console.log(`  operating share: ${(report.active_pct * 100).toFixed(1)}%`);
console.log(`  capex share:     ${(report.capex_share * 100).toFixed(1)}%`);
console.log(`  reel share:      ${(report.reel_share * 100).toFixed(1)}%`);
console.log(`  net early:       ${Math.round(report.net_early)}`);
console.log(`  net late:        ${Math.round(report.net_late)}`);
console.log(`  net cv:          ${report.net_cv.toFixed(2)}`);
console.log(`  VERDICT: ${report.verdict}`);
if (report.detail) console.log(`  DETAIL: ${report.detail}`);

// ---------------------------------------------------------------- the ladder

let ladderFailures = 0;

for (const g of result.goal_days) {
  if (g.reward_money <= 0) continue;

  if (g.revenue_daily <= 1.0) {
    ladderFailures++;
    console.error(`  LADDER: ${g.title} landed on day ${g.day} with no takings`);
    continue;
  }

  const ratio = g.reward_money / g.revenue_daily;
  if (ratio < RATIO_FLOOR || ratio > RATIO_CEILING) {
    ladderFailures++;
    console.error(
      `  LADDER: ${g.title} pays ${ratio.toFixed(2)}x daily takings (day ${g.day})`
    );
  }
}

console.log(`  milestones:       ${result.goal_days.length} reached`);
console.log(`  ladder verdict:   ${ladderFailures === 0 ? 'healthy' : `${ladderFailures} problems`}`);

// The whole point of the player path is that a competent player should end
// the run better off than the economy alone would suggest.
console.log(
  `  target band:       ${TARGET_DAYS.toFixed(1)} days, floor ${RATIO_FLOOR.toFixed(1)}x, ceiling ${RATIO_CEILING.toFixed(1)}x`
);
