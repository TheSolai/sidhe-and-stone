/**
 * Economy parity test.
 *
 * The TypeScript port must reproduce Godot's 365-day autopilot run
 * ELEMENT FOR ELEMENT -- every day's money, every ledger line, every rolled
 * event, and the final state including both RNG states. Matching only the
 * headline numbers would hide exactly the drift that matters.
 *
 * Run with:
 *   node --experimental-strip-types web/tests/parity.ts
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SimCore, analyse } from '../src/sim/sim-core.ts';
import { expectedMultipliers, totalWeight } from '../src/sim/event-deck.ts';
import { ReelCore } from '../src/sim/reel-core.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, 'fixtures/godot_curve_fixture.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  days: number;
  money_curve: number[];
  revenue_log: number[];
  opex_log: number[];
  capex_log: number[];
  reel_revenue_log: number[];
  stolen_log: number[];
  curated_log: number[];
  event_ids: string[];
  analysis: Record<string, unknown>;
  final_state: {
    day: number;
    money: number;
    sites: number;
    curators: number;
    charms: number;
    raw: [string, number][];
    vault: [string, number][];
    gallery: [string, number][];
    upgrades_bought: [string, number][];
    digging: [string, { dig: string; ready_day: number }][];
    reel: Record<string, unknown>;
    rng_state: string;
    event_rng_state: string;
  };
};

let failures = 0;
let checks = 0;

function check(condition: boolean, message: string): void {
  checks++;
  if (!condition) {
    failures++;
    if (failures <= 40) console.error(`  FAIL: ${message}`);
  }
}

function checkArray(actual: number[], expected: number[], label: string): void {
  check(
    actual.length === expected.length,
    `${label}: length ${actual.length} != godot ${expected.length}`
  );
  const n = Math.min(actual.length, expected.length);
  for (let i = 0; i < n; i++) {
    check(actual[i] === expected[i], `${label}[${i}] = ${actual[i]}, godot = ${expected[i]}`);
  }
}

// ---------------------------------------------------------------- run the sim

const core = new SimCore();
const result = core.run(fixture.days);

checkArray(result.money_curve, fixture.money_curve, 'money_curve');
checkArray(core.revenueLog, fixture.revenue_log, 'revenue_log');
checkArray(core.opexLog, fixture.opex_log, 'opex_log');
checkArray(core.capexLog, fixture.capex_log, 'capex_log');
checkArray(core.reelRevenueLog, fixture.reel_revenue_log, 'reel_revenue_log');
checkArray(core.stolenLog, fixture.stolen_log, 'stolen_log');
checkArray(core.curatedLog, fixture.curated_log, 'curated_log');

// ---------------------------------------------------------------- events

check(
  core.eventLog.length === fixture.event_ids.length,
  `event count ${core.eventLog.length} != godot ${fixture.event_ids.length}`
);
for (let i = 0; i < Math.min(core.eventLog.length, fixture.event_ids.length); i++) {
  check(
    core.eventLog[i].id === fixture.event_ids[i],
    `event[${i}] = ${core.eventLog[i].id}, godot = ${fixture.event_ids[i]}`
  );
}

// ---------------------------------------------------------------- final state

const fs = fixture.final_state;
check(core.day === fs.day, `final day ${core.day} != godot ${fs.day}`);
check(core.money === fs.money, `final money ${core.money} != godot ${fs.money}`);
check(core.sites === fs.sites, `final sites ${core.sites} != godot ${fs.sites}`);
check(core.curators === fs.curators, `final curators ${core.curators} != godot ${fs.curators}`);
check(core.charms === fs.charms, `final charms ${core.charms} != godot ${fs.charms}`);
check(
  core.rng.getStateString() === fs.rng_state,
  `final rng_state ${core.rng.getStateString()} != godot ${fs.rng_state}`
);
check(
  core.eventRng.getStateString() === fs.event_rng_state,
  `final event_rng_state ${core.eventRng.getStateString()} != godot ${fs.event_rng_state}`
);

/**
 * Compare an ordered map against the fixture's ordered pairs.
 *
 * ORDER IS CHECKED, not just values: GDScript dictionaries iterate in
 * insertion order and the simulation's behaviour depends on it.
 */
function checkMap(
  actual: Map<string, number>,
  expected: [string, number][],
  label: string
): void {
  const actualKeys = [...actual.keys()];
  const expectedKeys = expected.map(([k]) => k);
  check(
    actualKeys.join(',') === expectedKeys.join(','),
    `${label} keys [${actualKeys.join(',')}] != godot [${expectedKeys.join(',')}]`
  );
  for (const [k, v] of expected) {
    check(actual.get(k) === v, `${label}[${k}] = ${actual.get(k)}, godot = ${v}`);
  }
}

checkMap(core.raw, fs.raw, 'raw');
checkMap(core.vault, fs.vault, 'vault');
checkMap(core.gallery, fs.gallery, 'gallery');
checkMap(core.upgradesBought, fs.upgrades_bought, 'upgrades_bought');

// The digs still in progress, by site index, with their ready days.
const actualDigging = [...core.digging.entries()]
  .map(([site, info]) => `${site}:${info.dig}@${info.ready_day}`)
  .sort()
  .join(',');
const godotDigging = fixture.final_state.digging
  .map(([site, info]) => `${site}:${info.dig}@${info.ready_day}`)
  .sort()
  .join(',');
check(actualDigging === godotDigging, `digging ${actualDigging} != godot ${godotDigging}`);

// The reel's lifetime stats.
const reelActual = core.reel.toDict();
const reelGodot = fs.reel as Record<string, number | string>;
check(reelActual.spins === reelGodot.spins, `reel spins ${reelActual.spins} != godot ${reelGodot.spins}`);
check(
  reelActual.payout_total === reelGodot.payout_total,
  `reel payout_total ${reelActual.payout_total} != godot ${reelGodot.payout_total}`
);
check(
  reelActual.biggest_win === reelGodot.biggest_win,
  `reel biggest_win ${reelActual.biggest_win} != godot ${reelGodot.biggest_win}`
);
check(
  reelActual.worst_spin === reelGodot.worst_spin,
  `reel worst_spin ${reelActual.worst_spin} != godot ${reelGodot.worst_spin}`
);
check(
  reelActual.triple_hits === reelGodot.triple_hits,
  `reel triple_hits ${reelActual.triple_hits} != godot ${reelGodot.triple_hits}`
);
check(
  reelActual.luck === reelGodot.luck,
  `reel luck ${reelActual.luck} != godot ${reelGodot.luck}`
);
check(
  reelActual.rng_state === reelGodot.rng_state,
  `reel rng_state ${reelActual.rng_state} != godot ${reelGodot.rng_state}`
);

// ---------------------------------------------------------------- analysis

const report = analyse(
  result.money_curve,
  core.revenueLog,
  core.opexLog,
  core.capexLog,
  core.reelRevenueLog
);
const ga = fixture.analysis as Record<string, number | string>;
check(report.verdict === ga.verdict, `verdict "${report.verdict}" != godot "${ga.verdict}"`);
check(report.detail === ga.detail, `detail "${report.detail}" != godot "${ga.detail}"`);
check(report.final === ga.final, `analysis final ${report.final} != godot ${ga.final}`);
check(report.day1 === ga.day1, `analysis day1 ${report.day1} != godot ${ga.day1}`);
check(
  Math.abs(report.net_cv - (ga.net_cv as number)) < 1e-9,
  `analysis net_cv ${report.net_cv} != godot ${ga.net_cv}`
);
check(
  Math.abs(report.reel_share - (ga.reel_share as number)) < 1e-12,
  `analysis reel_share ${report.reel_share} != godot ${ga.reel_share}`
);
check(
  Math.abs(report.capex_share - (ga.capex_share as number)) < 1e-12,
  `analysis capex_share ${report.capex_share} != godot ${ga.capex_share}`
);
check(
  Math.abs(report.active_pct - (ga.active_pct as number)) < 1e-12,
  `analysis active_pct ${report.active_pct} != godot ${ga.active_pct}`
);

// ---------------------------------------------------------------- invariants

// The event deck must be neutral: events may not quietly rebalance the game.
const ev = expectedMultipliers();
check(Math.abs(ev.demand - 1.0) < 1e-9, `event EV demand ${ev.demand} != 1.0`);
check(Math.abs(ev.theft - 1.0) < 1e-9, `event EV theft ${ev.theft} != 1.0`);
check(Math.abs(ev.curation) < 1e-9, `event EV curation ${ev.curation} != 0`);
check(ev.charm < 0.25, `event EV charm ${ev.charm} >= 0.25`);
// The deck's total weight, with the six market/crowd/fever events added.
const DECK_WEIGHT = 114;
check(totalWeight() === DECK_WEIGHT, `deck weight ${totalWeight()} != ${DECK_WEIGHT}`);

// The reel must be a bounded amplifier, never the foundation.
const reel = new ReelCore();
const ev0 = reel.expectedValue(0.0);
const evLuck = reel.expectedValue(0.6);
check(ev0 > 0.95 && ev0 < 1.1, `EV(0) ${ev0} out of band`);
check(evLuck > ev0, `EV(0.6) ${evLuck} must exceed EV(0) ${ev0}`);
const dist = reel.patternDistribution();
check(Math.abs((dist.get('miss') ?? 0) + (dist.get('pair') ?? 0) + (dist.get('triple') ?? 0) - 1) < 1e-9,
  'reel pattern distribution does not sum to 1');

// ---------------------------------------------------------------- report

console.log(`Economy parity: ${checks} checks, ${failures} failures`);
console.log(
  `  final=${report.final}  cv=${report.net_cv.toFixed(2)}  active=${(report.active_pct * 100).toFixed(1)}%  ` +
    `capex=${(report.capex_share * 100).toFixed(1)}%  reel=${(report.reel_share * 100).toFixed(1)}%  ` +
    `spins=${result.reel_spins}  avg_payout=${result.reel_avg_payout.toFixed(3)}  ` +
    `luck=${result.luck.toFixed(2)}  EV(luck)=${evLuck.toFixed(3)}  EV(0)=${ev0.toFixed(3)}`
);
console.log(`  VERDICT: ${report.verdict} (${report.detail})`);

if (failures > 0) {
  console.error('ECONOMY PARITY FAILED');
  process.exit(1);
}
console.log('ECONOMY PARITY OK');
