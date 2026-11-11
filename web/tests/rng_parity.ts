/**
 * RNG parity test: the TypeScript implementation must match Godot's
 * RandomNumberGenerator exactly -- values AND state after every call.
 *
 * Run with:
 *   node --experimental-strip-types web/tests/rng_parity.ts
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { GodotRandom } from '../src/sim/rng.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, 'fixtures/godot_rng_fixtures.json');
const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<
  string,
  Record<string, unknown>
>;

let failures = 0;
let checks = 0;

function fail(message: string): void {
  failures++;
  if (failures <= 40) console.error(`  FAIL: ${message}`);
}

function check(condition: boolean, message: string): void {
  checks++;
  if (!condition) fail(message);
}

/** Signed 64-bit state of a generator, exactly as Godot prints it. */
function rngState(rng: GodotRandom): string {
  return rng.getStateSigned().toString();
}

/** Compare two float64 values with a tolerance tight enough to catch drift. */
function floatClose(a: number, b: number, tolerance = 1e-12): boolean {
  if (a === b) return true;
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b));
}

for (const [seedText, rec] of Object.entries(fixtures)) {
  const seed = Number(seedText);
  const r = rec as {
    state_after_seed: string;
    randi: number[];
    randi_state: string[];
    randf: number[];
    randf_state: string[];
    randf_range: number[];
    randf_range_state: string[];
    range_1_10: number[];
    range_1_10_state: string[];
    range_3_9: number[];
    range_3_9_state: string[];
    range_1_97: number[];
    range_1_97_state: string[];
    range_1_1_state: string[];
    range_0_0_state: string[];
    range_reversed: number[];
    range_reversed_state: string[];
    save_restore_saved_state: string;
    save_restore_continued: number[];
    save_restore_restored: number[];
  };

  // --- state right after seeding ---
  {
    const rng = new GodotRandom(seed);
    check(
      rngState(rng) === r.state_after_seed,
      `seed ${seed}: state after seed = ${rngState(rng)}, godot = ${r.state_after_seed}`
    );
  }

  // --- randi ---
  {
    const rng = new GodotRandom(seed);
    for (let i = 0; i < r.randi.length; i++) {
      const got = rng.randi();
      check(got === r.randi[i], `seed ${seed}: randi[${i}] = ${got}, godot = ${r.randi[i]}`);
      const st = rngState(rng);
      check(st === r.randi_state[i], `seed ${seed}: randi[${i}] state = ${st}, godot = ${r.randi_state[i]}`);
    }
  }

  // --- randf ---
  {
    const rng = new GodotRandom(seed);
    for (let i = 0; i < r.randf.length; i++) {
      const got = rng.randf();
      check(
        floatClose(got, r.randf[i]),
        `seed ${seed}: randf[${i}] = ${got}, godot = ${r.randf[i]}`
      );
      const st = rngState(rng);
      check(st === r.randf_state[i], `seed ${seed}: randf[${i}] state = ${st}, godot = ${r.randf_state[i]}`);
    }
  }

  // --- randf_range(0, 10) ---
  {
    const rng = new GodotRandom(seed);
    for (let i = 0; i < r.randf_range.length; i++) {
      const got = rng.randfRange(0.0, 10.0);
      check(
        floatClose(got, r.randf_range[i]),
        `seed ${seed}: randf_range[${i}] = ${got}, godot = ${r.randf_range[i]}`
      );
      const st = rngState(rng);
      check(
        st === r.randf_range_state[i],
        `seed ${seed}: randf_range[${i}] state = ${st}, godot = ${r.randf_range_state[i]}`
      );
    }
  }

  // --- randi_range variants ---
  const ranges: Array<[string, number, number]> = [
    ['range_1_10', 1, 10],
    ['range_3_9', 3, 9],
    ['range_1_97', 1, 97],
    ['range_reversed', 10, 1],
  ];
  for (const [key, from, to] of ranges) {
    const table = r as unknown as Record<string, number[] | string[]>;
    const values = table[key] as number[];
    const states = table[`${key}_state`] as string[];
    const rng = new GodotRandom(seed);
    for (let i = 0; i < values.length; i++) {
      const got = rng.randiRange(from, to);
      check(got === values[i], `seed ${seed}: ${key}[${i}] = ${got}, godot = ${values[i]}`);
      const st = rngState(rng);
      check(st === states[i], `seed ${seed}: ${key}[${i}] state = ${st}, godot = ${states[i]}`);
    }
  }

  // --- degenerate ranges must consume no draw ---
  {
    const states = r.range_1_1_state as string[];
    const rng = new GodotRandom(seed);
    for (let i = 0; i < states.length; i++) {
      rng.randiRange(1, 1);
      const st = rngState(rng);
      check(st === states[i], `seed ${seed}: range_1_1_state[${i}] = ${st}, godot = ${states[i]}`);
    }
  }
  {
    const states = r.range_0_0_state as string[];
    const rng = new GodotRandom(seed);
    for (let i = 0; i < states.length; i++) {
      rng.randiRange(0, 0);
      const st = rngState(rng);
      check(st === states[i], `seed ${seed}: range_0_0_state[${i}] = ${st}, godot = ${states[i]}`);
    }
  }

  // --- save / restore round trip ---
  {
    const rng = new GodotRandom(seed);
    for (let i = 0; i < 7; i++) rng.randi();
    const saved = rng.getState();
    check(
      rngState(rng) === r.save_restore_saved_state,
      `seed ${seed}: saved state = ${rngState(rng)}, godot = ${r.save_restore_saved_state}`
    );
    const continued = r.save_restore_continued.map(() => rng.randi());
    for (let i = 0; i < continued.length; i++) {
      check(
        continued[i] === r.save_restore_continued[i],
        `seed ${seed}: continued[${i}] = ${continued[i]}, godot = ${r.save_restore_continued[i]}`
      );
    }

    const restored = new GodotRandom(999);
    restored.setState(saved);
    const after = r.save_restore_restored.map(() => restored.randi());
    for (let i = 0; i < after.length; i++) {
      check(
        after[i] === r.save_restore_restored[i],
        `seed ${seed}: restored[${i}] = ${after[i]}, godot = ${r.save_restore_restored[i]}`
      );
    }
  }
}

console.log(`RNG parity: ${checks} checks, ${failures} failures`);
if (failures > 0) {
  console.error('RNG PARITY FAILED');
  process.exit(1);
}
console.log('RNG PARITY OK');
