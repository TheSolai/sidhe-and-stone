/**
 * Player-path parity test.
 *
 * The player path is the honest balance harness: it drives GameState --
 * the same object the UI drives, through the same actions -- so it is the
 * run that actually proves the milestone ladder is worth something.
 *
 * The web port must reproduce it exactly, including the day each goal
 * lands on and the income it was scaled against.
 *
 * Run with:
 *   node --experimental-strip-types web/tests/player_path_parity.ts
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { GameState } from '../src/sim/game-state.ts';
import { play } from '../src/sim/player-path.ts';
import { analyse } from '../src/sim/sim-core.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, 'fixtures/godot_player_path_fixture.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  days: number;
  money_curve: number[];
  revenue_log: number[];
  opex_log: number[];
  capex_log: number[];
  reel_revenue_log: number[];
  goal_days: {
    id: string;
    title: string;
    day: number;
    reward_money: number;
    operating_income_day: number;
    operating_income_daily: number;
    operating_income_trail: number;
    revenue_daily: number;
    revenue_trail: number;
    money_after: number;
  }[];
  summary: {
    spins: number;
    avg_payout: number;
    luck: number;
    charms: number;
    sites: number;
    curators: number;
    gallery_upgrades: number;
    omens: number;
  };
  final_state: {
    day: number;
    money: number;
    charms: number;
    completed_goals: string[];
    ledger_size: number;
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

function checkClose(actual: number, expected: number, label: string): void {
  check(
    Math.abs(actual - expected) < 1e-9,
    `${label} = ${actual}, godot = ${expected}`
  );
}

// ---------------------------------------------------------------- run

const state = new GameState();
const result = play(state, fixture.days);

checkArray(result.money_curve, fixture.money_curve, 'money_curve');
checkArray(result.revenue_log, fixture.revenue_log, 'revenue_log');
checkArray(result.opex_log, fixture.opex_log, 'opex_log');
checkArray(result.capex_log, fixture.capex_log, 'capex_log');
checkArray(result.reel_revenue_log, fixture.reel_revenue_log, 'reel_revenue_log');

// ---------------------------------------------------------------- goals

check(
  result.goal_days.length === fixture.goal_days.length,
  `goal count ${result.goal_days.length} != godot ${fixture.goal_days.length}`
);
for (let i = 0; i < Math.min(result.goal_days.length, fixture.goal_days.length); i++) {
  const a = result.goal_days[i];
  const g = fixture.goal_days[i];
  check(a.id === g.id, `goal[${i}] id ${a.id} != godot ${g.id}`);
  check(a.day === g.day, `goal ${g.id} day ${a.day} != godot ${g.day}`);
  check(a.reward_money === g.reward_money, `goal ${g.id} reward ${a.reward_money} != godot ${g.reward_money}`);
  check(
    a.operating_income_day === g.operating_income_day,
    `goal ${g.id} op_income_day ${a.operating_income_day} != godot ${g.operating_income_day}`
  );
  checkClose(a.operating_income_daily, g.operating_income_daily, `goal ${g.id} op_income_daily`);
  checkClose(a.operating_income_trail, g.operating_income_trail, `goal ${g.id} op_income_trail`);
  checkClose(a.revenue_daily, g.revenue_daily, `goal ${g.id} revenue_daily`);
  checkClose(a.revenue_trail, g.revenue_trail, `goal ${g.id} revenue_trail`);
  check(a.money_after === g.money_after, `goal ${g.id} money_after ${a.money_after} != godot ${g.money_after}`);
}

// ---------------------------------------------------------------- summary

const s = fixture.summary;
check(result.spins === s.spins, `spins ${result.spins} != godot ${s.spins}`);
checkClose(result.avg_payout, s.avg_payout, 'avg_payout');
checkClose(result.luck, s.luck, 'luck');
check(result.charms === s.charms, `charms ${result.charms} != godot ${s.charms}`);
check(result.sites === s.sites, `sites ${result.sites} != godot ${s.sites}`);
check(result.curators === s.curators, `curators ${result.curators} != godot ${s.curators}`);
check(
  result.gallery_upgrades === s.gallery_upgrades,
  `gallery upgrades ${result.gallery_upgrades} != godot ${s.gallery_upgrades}`
);
check(result.omens === s.omens, `omens ${result.omens} != godot ${s.omens}`);

// ---------------------------------------------------------------- final state

const fs = fixture.final_state;
check(state.day() === fs.day, `final day ${state.day()} != godot ${fs.day}`);
check(state.money() === fs.money, `final money ${state.money()} != godot ${fs.money}`);
check(state.charms() === fs.charms, `final charms ${state.charms()} != godot ${fs.charms}`);
check(
  state.goals.completed.join(',') === fs.completed_goals.join(','),
  `completed goals [${state.goals.completed.join(',')}] != godot [${fs.completed_goals.join(',')}]`
);
check(
  state.ledger.length === fs.ledger_size,
  `ledger size ${state.ledger.length} != godot ${fs.ledger_size}`
);

// ---------------------------------------------------------------- ladder

// A milestone reward must be worth roughly FOUR DAYS of the player's gross
// takings at the moment it lands. Outside the 1x-12x band the ladder stops
// mattering or replaces the game.
const RATIO_FLOOR = 1.0;
const RATIO_CEILING = 12.0;

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
    console.error(`  LADDER: ${g.title} pays ${ratio.toFixed(2)}x daily takings`);
  }
}
check(ladderFailures === 0, `milestone ladder MIS-SCALED (${ladderFailures} problems)`);

const report = analyse(
  result.money_curve,
  result.revenue_log,
  result.opex_log,
  result.capex_log,
  result.reel_revenue_log
);
check(
  report.verdict === 'healthy',
  `player-path economy verdict "${report.verdict}" (${report.detail})`
);

// ---------------------------------------------------------------- report

console.log(`Player-path parity: ${checks} checks, ${failures} failures`);
console.log(
  `  final=${report.final}  cv=${report.net_cv.toFixed(2)}  active=${(report.active_pct * 100).toFixed(1)}%  ` +
    `capex=${(report.capex_share * 100).toFixed(1)}%  reel=${(report.reel_share * 100).toFixed(1)}%  ` +
    `spins=${result.spins}  avg_payout=${result.avg_payout.toFixed(3)}  luck=${result.luck.toFixed(2)}  ` +
    `goals=${result.goal_days.length}`
);
console.log(`  VERDICT: ${report.verdict} (${report.detail})`);

if (failures > 0) {
  console.error('PLAYER-PATH PARITY FAILED');
  process.exit(1);
}
console.log('PLAYER-PATH PARITY OK');
