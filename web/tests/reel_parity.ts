/**
 * Reel and event-deck parity.
 *
 * The economy curve fixture proves the reel end to end, because the reel's
 * lifetime stats are part of the final state that fixture compares. This
 * test is much sharper: it pins the reel's own behaviour against the
 * Godot original -- every spin's reels, payout and pattern, the weights at
 * each luck level, the analytic expected value, the pattern distribution,
 * the full payout table, and the RNG state after every spin.
 *
 * It also pins the event deck, and asserts the deck's neutrality directly
 * rather than leaving it to be assumed.
 *
 * Run:
 *   node --experimental-strip-types tests/reel_parity.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GodotRandom } from '../src/sim/rng.ts';
import { ReelCore, SYMBOLS, MISS_PAYOUT } from '../src/sim/reel-core.ts';
import {
  EVENTS,
  expectedMultipliers,
  neutralEvent,
  rollEvent,
  totalWeight,
} from '../src/sim/event-deck.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(resolve(here, 'fixtures', 'godot_reel_fixture.json'), 'utf8')
) as {
  [seed: string]: unknown;
  _spins: number;
  _luck_levels: number[];
  _float_encoding: string;
  _event_deck: {
    total_weight: number;
    expected_multipliers: Record<string, string>;
    neutral_event: {
      id: string;
      title: string;
      text: string;
      demand: string;
      theft: string;
      curation: number;
      charm: number;
    };
    rolls: string[];
    rng_state_after_roll: string[];
    events: {
      id: string;
      title: string;
      text: string;
      weight: number;
      demand: string;
      theft: string;
      curation: number;
      charm: number;
    }[];
  };
};

/** One seed's reel record, as the fixture stores it. */
interface ReelRecord {
  weights_by_luck: Record<string, [string, string][]>;
  expected_value_by_luck: Record<string, string>;
  pattern_distribution_by_luck: Record<string, Record<string, string>>;
  spins: { reels: string[]; payout: string; pattern: string }[];
  rng_state_after_spin: string[];
  stats: {
    spins: number;
    payout_total: string;
    biggest_win: string;
    worst_spin: string;
    triple_hits: number;
  };
  final_rng_state: string;
  all_payouts: Record<string, string>;
}

let checks = 0;
let failures = 0;

function check(condition: boolean, message: string): void {
  checks++;
  if (!condition) {
    failures++;
    console.error(`  FAIL: ${message}`);
  }
}

/**
 * Exact equality against a literal number, for the game's own rules.
 *
 * These are not fixture values, so they are compared as plain numbers.
 */
function checkExact(actual: number, expected: number, label: string): void {
  checks++;
  if (actual !== expected) {
    failures++;
    console.error(`  FAIL: ${label} ${actual} != ${expected}`);
  }
}

/**
 * Decode a fixture float.
 *
 * The fixture stores floats as the hex of their eight little-endian
 * IEEE-754 bytes, because Godot's JSON writer rounds a float to about 15
 * significant digits and would quietly lose the last bits of an expected
 * value. Decoding the raw bytes round-trips exactly, so the comparison
 * below can be exact -- an exact comparison is what catches a genuine
 * divergence in floating-point accumulation order, which a tolerance
 * would hide.
 */
function decodeFloat(hex: string): number {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  const view = new DataView(bytes.buffer);
  return view.getFloat64(0, true);
}

/**
 * Exact equality on a float. The port is a literal transcription, so the
 * last bits must match too -- a tolerance here would hide a real
 * divergence in the floating-point accumulation order.
 */
function checkFloat(actual: number, expectedHex: string, label: string): void {
  checks++;
  const expected = decodeFloat(expectedHex);
  if (actual !== expected) {
    failures++;
    console.error(`  FAIL: ${label} ${actual} != godot ${expected}`);
  }
}

/**
 * Format a float the way GDScript's `str()` does, for use as a map key.
 *
 * GDScript writes 0.0 as "0.0"; JavaScript's `String(0)` writes "0". The
 * fixture is keyed by GDScript's spelling, so the keys have to match.
 */
function godotFloatKey(value: number): string {
  const s = String(value);
  return s.includes('.') || s.includes('e') ? s : `${s}.0`;
}

// ---------------------------------------------------------------- the reel

const SEEDS = [1, 7, 20261110];
const LUCK_LEVELS = [0.0, 0.25, 0.5, 0.75, 0.9];
const SPINS: number = fixture._spins;

for (const seed of SEEDS) {
  const rec = fixture[String(seed)] as ReelRecord;

  // The weights at each luck level, in symbol-table order.
  for (const luck of LUCK_LEVELS) {
    const reel = new ReelCore(seed);
    reel.luck = luck;
    const actual = reel.weights();

    // The fixture stores the weights as an ordered array of [symbol, weight]
    // pairs, because Godot's JSON writer sorts object keys and the
    // insertion order is exactly what the reel's random draw walks.
    const expected = rec.weights_by_luck[godotFloatKey(luck)] as [
      string,
      string
    ][];

    check(
      [...actual.keys()].join(',') === expected.map((p) => p[0]).join(','),
      `seed ${seed} luck ${luck}: symbol order ${[...actual.keys()].join(',')} != ${expected
        .map((p) => p[0])
        .join(',')}`
    );
    for (const [symbol, weight] of actual) {
      const hex = expected.find((p) => p[0] === symbol)?.[1];
      check(hex !== undefined, `seed ${seed} luck ${luck}: ${symbol} missing from fixture`);
      if (hex !== undefined) {
        checkFloat(weight, hex, `seed ${seed} luck ${luck} weight ${symbol}`);
      }
    }
  }

  // The analytic expected value at each luck level.
  for (const luck of LUCK_LEVELS) {
    const reel = new ReelCore(seed);
    checkFloat(
      reel.expectedValue(luck),
      rec.expected_value_by_luck[godotFloatKey(luck)],
      `seed ${seed} luck ${luck} expected_value`
    );
  }

  // The pattern distribution at each luck level.
  for (const luck of LUCK_LEVELS) {
    const reel = new ReelCore(seed);
    const actual = reel.patternDistribution();
    const expected = rec.pattern_distribution_by_luck[godotFloatKey(luck)];
    for (const [pattern, share] of actual) {
      checkFloat(share, expected[pattern], `seed ${seed} luck ${luck} pattern ${pattern}`);
    }
  }

  // Every spin, with the RNG state after it.
  const reel = new ReelCore(seed);
  for (let i = 0; i < SPINS; i++) {
    const result = reel.spin();
    const expected = rec.spins[i];

    check(
      result.reels.join(',') === expected.reels.join(','),
      `seed ${seed} spin ${i} reels ${result.reels.join(',')} != ${expected.reels.join(',')}`
    );
    checkFloat(result.payout, expected.payout, `seed ${seed} spin ${i} payout`);
    check(
      result.pattern === expected.pattern,
      `seed ${seed} spin ${i} pattern ${result.pattern} != ${expected.pattern}`
    );
    check(
      reel.rng.getStateString() === rec.rng_state_after_spin[i],
      `seed ${seed} spin ${i} rng state ${reel.rng.getStateString()} != ${rec.rng_state_after_spin[i]}`
    );
  }

  // The lifetime stats.
  const stats = rec.stats;
  check(reel.spins === stats.spins, `seed ${seed} spins ${reel.spins} != ${stats.spins}`);
  checkFloat(reel.payoutTotal, stats.payout_total, `seed ${seed} payout_total`);
  checkFloat(reel.biggestWin, stats.biggest_win, `seed ${seed} biggest_win`);
  checkFloat(reel.worstSpin, stats.worst_spin, `seed ${seed} worst_spin`);
  check(reel.tripleHits === stats.triple_hits, `seed ${seed} triple_hits`);
  check(
    reel.rng.getStateString() === rec.final_rng_state,
    `seed ${seed} final rng state ${reel.rng.getStateString()} != ${rec.final_rng_state}`
  );

  // The whole payout table, so the payouts themselves are pinned and not
  // merely the outcomes they produce.
  const payouts = rec.all_payouts;
  for (const key of Object.keys(payouts)) {
    const reels = key.split(',');
    checkFloat(
      ReelCore.payoutFor(reels),
      payouts[key],
      `seed ${seed} payout_for(${key})`
    );
  }
}

// ---------------------------------------------------------- the event deck

const deck = fixture._event_deck;

// The deck's contents, in declaration order.
check(
  EVENTS.map((e) => e.id).join(',') === (deck.events as { id: string }[]).map((e) => e.id).join(','),
  `event order ${EVENTS.map((e) => e.id).join(',')} != ${(deck.events as { id: string }[]).map((e) => e.id).join(',')}`
);

for (let i = 0; i < EVENTS.length; i++) {
  const actual = EVENTS[i];
  const expected = deck.events[i];

  check(actual.id === expected.id, `event ${i} id ${actual.id} != ${expected.id}`);
  check(actual.title === expected.title, `event ${i} title ${actual.title} != ${expected.title}`);
  check(actual.text === expected.text, `event ${i} text`);
  check(actual.weight === expected.weight, `event ${i} weight ${actual.weight} != ${expected.weight}`);
  checkFloat(actual.demand, expected.demand, `event ${i} demand`);
  checkFloat(actual.theft, expected.theft, `event ${i} theft`);
  check(actual.curation === expected.curation, `event ${i} curation`);
  check(actual.charm === expected.charm, `event ${i} charm`);
}

// The deck's total weight.
check(
  totalWeight() === deck.total_weight,
  `total weight ${totalWeight()} != godot ${deck.total_weight}`
);

// The neutral event.
const neutral = neutralEvent();
const neutralGodot = deck.neutral_event;
check(neutral.id === neutralGodot.id, `neutral id ${neutral.id} != ${neutralGodot.id}`);
check(neutral.title === neutralGodot.title, `neutral title`);
check(neutral.text === neutralGodot.text, `neutral text`);
checkFloat(neutral.demand, neutralGodot.demand, 'neutral demand');
checkFloat(neutral.theft, neutralGodot.theft, 'neutral theft');
check(neutral.curation === neutralGodot.curation, 'neutral curation');
check(neutral.charm === neutralGodot.charm, 'neutral charm');

// The expected multipliers.
const ev = expectedMultipliers();
const evGodot = deck.expected_multipliers as Record<string, string>;
checkFloat(ev.demand, evGodot.demand, 'expected demand');
checkFloat(ev.theft, evGodot.theft, 'expected theft');
checkFloat(ev.curation, evGodot.curation, 'expected curation');
checkFloat(ev.charm, evGodot.charm, 'expected charm');

// A long roll sequence, with the RNG state after each roll.
const rng = new GodotRandom(20261110);
for (let i = 0; i < (deck.rolls as string[]).length; i++) {
  const rolled = rollEvent(rng);
  check(
    rolled.id === (deck.rolls as string[])[i],
    `roll ${i} ${rolled.id} != ${(deck.rolls as string[])[i]}`
  );
  check(
    rng.getStateString() === (deck.rng_state_after_roll as string[])[i],
    `roll ${i} rng state ${rng.getStateString()} != ${(deck.rng_state_after_roll as string[])[i]}`
  );
}

// ---------------------------------------------------------------- the rules

// The deck must be economically neutral. These are the game's own rules,
// asserted here rather than assumed: an event deck that quietly rebalances
// the economy would make every balance number measured through it a number
// about the wrong game.
checkExact(ev.demand, 1.0, 'the deck must be demand-neutral');
checkExact(ev.theft, 1.0, 'the deck must be theft-neutral');
checkExact(ev.curation, 0.0, 'the deck must be curation-neutral');
check(ev.charm < 0.25, `the deck's charm windfall must stay under 0.25 (got ${ev.charm})`);
check(ev.charm > 0, 'the deck should pay a small charm windfall');
// The deck's total weight, with the six market/crowd/fever events added.
const DECK_WEIGHT = 114;
check(
  totalWeight() === DECK_WEIGHT,
  `the deck's total weight must be ${DECK_WEIGHT} (got ${totalWeight()})`
);

// The reel must stay a bounded marginal amplifier: a player who never
// spins must still earn a fair, steady income.
const mults = SYMBOLS.map((s) => s.mult);
const worstMult = Math.min(...mults);
const bestMult = Math.max(...mults);
check(worstMult === 0.85, `the reel's worst symbol must pay 0.85x (got ${worstMult})`);
check(bestMult === 2.6, `the reel's best symbol must pay 2.6x (got ${bestMult})`);
checkExact(MISS_PAYOUT, 1.0, 'the reel must pay exactly 1.0x on a miss');

// The expected value must sit near neutral at zero luck, and rise with
// luck.
//
// The reel pays exactly 1.0x on a miss, so its EV at zero luck is
// slightly ABOVE 1.0 rather than exactly at it: a player who spins and
// misses has not lost anything, so the reel cannot pay less than the
// neutral outcome. The design's documented baseline is EV(0) = 1.031
// (design/GDD.md), and the reel's own doc calls that "near 1.0".
//
// The band below is therefore: never below neutral, and never so far
// above it that the reel prints money for free. The separate "reel share
// of revenue" rule in the balance harness is what keeps the reel from
// dominating the economy.
const evZero = new ReelCore(1).expectedValue(0.0);
const evHigh = new ReelCore(1).expectedValue(0.9);
check(evZero >= 1.0, `EV at zero luck must never be below neutral (got ${evZero})`);
check(evZero < 1.1, `EV at zero luck must stay near neutral (got ${evZero})`);
check(
  Math.abs(evZero - 1.031) < 5e-4,
  `EV at zero luck must match the documented baseline of 1.031 (got ${evZero})`
);
check(evHigh > evZero, `EV must rise with luck (${evHigh} <= ${evZero})`);

console.log(`Reel and event-deck parity: ${checks} checks, ${failures} failures`);
if (failures > 0) {
  console.error('REEL PARITY FAILED');
  process.exit(1);
}
console.log('REEL PARITY OK');
