/**
 * The economy balance harness.
 *
 * The TypeScript twin of `sim/run_sim.gd`. It drives the pure economy for a
 * year and reports whether the museum is healthy.
 *
 * Run:
 *   node --experimental-strip-types web/src/sim/run-sim.ts -- --days=365
 *
 * The harness exists for the same reason the GDScript one does: balance is
 * measurable without a single sprite, scene or sound effect. Because the
 * economy lives in pure logic, the numbers can be trusted.
 *
 * Exit code is always 0. Read the VERDICT line.
 */

import { SimCore, analyse } from './sim-core.ts';

interface Options {
  days: number;
  reelPolicy: string;
  reelCost: number;
  charmRate: number;
  reelSeed: number;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    days: 365,
    reelPolicy: 'always',
    reelCost: 2,
    charmRate: 0.15,
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

const opts = parseArgs(process.argv.slice(2));

const core = new SimCore();
core.reelPolicy = opts.reelPolicy;
core.reelCharmCost = opts.reelCost;
core.charmPerUnit = opts.charmRate;
core.reel.reseed(opts.reelSeed);

const result = core.run(opts.days);

const report = analyse(
  result.money_curve,
  core.revenueLog,
  core.opexLog,
  core.capexLog,
  core.reelRevenueLog
);

console.log('--- economy harness ---');
console.log(`  days:            ${result.days}`);
console.log(`  final money:     ${Math.round(result.money)}`);
console.log(`  sites:           ${result.plots}`);
console.log(`  curators:        ${result.mills}`);
console.log(`  gallery:         ${result.market}`);
console.log(`  omens:           ${result.omens}`);
console.log(`  charms:          ${result.charms}`);
console.log(`  luck:            ${result.luck.toFixed(2)}`);
console.log(`  reel spins:      ${result.reel_spins}`);
console.log(`  avg payout:      ${result.reel_avg_payout.toFixed(3)}`);
console.log(`  operating share: ${(report.active_pct * 100).toFixed(1)}%`);
console.log(`  capex share:     ${(report.capex_share * 100).toFixed(1)}%`);
console.log(`  reel share:      ${(report.reel_share * 100).toFixed(1)}%`);
console.log(`  net early:       ${Math.round(report.net_early)}`);
console.log(`  net late:        ${Math.round(report.net_late)}`);
console.log(`  net cv:          ${report.net_cv.toFixed(2)}`);
console.log(`  VERDICT: ${report.verdict}`);
if (report.detail) console.log(`  DETAIL: ${report.detail}`);
