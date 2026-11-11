/**
 * Godot-compatible RNG.
 *
 * This is a literal transcription of Godot 4.7's `RandomNumberGenerator`
 * (`core/math/random_number_generator.h`) and its PCG32 backend
 * (`thirdparty/misc/pcg.cpp`). It is NOT a standard PCG32 and it is NOT
 * Math.random().
 *
 * The pieces that matter, all verified against Godot's own output:
 *
 *   - Seeding. `RandomPCG::seed()` calls `pcg32_srandom_r(&pcg, seed, inc)`
 *     where `inc` is the constant `PCG_DEFAULT_INC_64` (1442695040888963407).
 *     `pcg32_srandom_r` sets `rng->inc = (initseq << 1) | 1`, so the
 *     effective increment is 2885390081777926815 -- NOT the raw constant.
 *
 *   - State advance. `state = oldstate * 6364136223846793005 + (inc | 1)`,
 *     all modulo 2^64.
 *
 *   - Output. XSH-RR over the OLD state:
 *     `xorshifted = ((oldstate >> 18) ^ oldstate) >> 27`, then rotate right
 *     by `oldstate >> 59`.
 *
 *   - `randf()`. Two raw draws. The first supplies the exponent offset via
 *     `clz()`; the second supplies the significand as the *integer*
 *     `rand() | 0x80000001`, which is then converted to float32 and scaled
 *     by `2^(-32 - clz(exponent))`. The significand is an integer value, not
 *     a bit pattern to reinterpret -- that distinction is the difference
 *     between matching Godot and not.
 *
 *   - `randf_range(from, to)`. Godot's `RandomPCG::random(float, float)`
 *     computes `randf() * (to - from) + from` in float32, which is
 *     `random(double, double)` semantics scaled by the same factor but
 *     keeping float32 precision throughout.
 *
 *   - `randi_range(from, to)`. Inclusive bounds. Uses PCG bounded rejection
 *     sampling (`pcg32_boundedrand_r`), not modulo. A range where
 *     `from == to` returns immediately and consumes NO draw.
 *
 *   - `randi_range` when the span is exactly 2^32-1 falls back to an
 *     unbounded draw plus an offset.
 *
 * State is exposed so it can be saved and restored, matching Godot's
 * `RandomNumberGenerator.state`.
 */

const MASK64 = (1n << 64n) - 1n;

/** PCG's LCG multiplier. */
const MULTIPLIER = 6364136223846793005n;

/** `PCG_DEFAULT_INC_64`. */
const DEFAULT_INC_64 = 1442695040888963407n;

/**
 * The effective increment after `pcg32_srandom_r` applies `(initseq << 1) | 1`.
 * This is the value the state advance actually adds, every single draw.
 */
const INCREMENT = ((DEFAULT_INC_64 << 1n) | 1n) & MASK64;

/** Round a float64 to float32, the way Godot's `real_t` does. */
export function fround(value: number): number {
  return Math.fround(value);
}

/** Count leading zeros of a 32-bit unsigned value. */
function clz32(value: number): number {
  if (value === 0) return 32;
  // Math.clz32 counts from the full 32-bit width.
  return Math.clz32(value >>> 0);
}

/**
 * Interpret an unsigned 64-bit BigInt as a signed two's-complement 64-bit int.
 *
 * Returns a BigInt, deliberately. A 64-bit integer does not fit in a JS
 * `number`, so returning one would silently round the low bits -- exactly
 * the state the save file has to reproduce byte for byte.
 */
export function toSigned64(value: bigint): bigint {
  const masked = value & MASK64;
  return masked >= 1n << 63n ? masked - (1n << 64n) : masked;
}

/** Interpret a signed 64-bit int as an unsigned BigInt. */
export function toUnsigned64(value: bigint | number | string): bigint {
  return BigInt.asUintN(64, BigInt(value));
}

export class GodotRandom {
  /** Raw 64-bit PCG state, unsigned. */
  private state: bigint;

  /** The seed this generator was last seeded with. */
  public seedValue: number;

  constructor(seed = 0) {
    this.seedValue = seed;
    this.state = 0n;
    this.seed(seed);
  }

  /**
   * Reseed exactly as Godot's `RandomPCG::seed()` does:
   * `pcg32_srandom_r(&pcg, seed, PCG_DEFAULT_INC_64)`.
   */
  public seed(seed: number): void {
    this.seedValue = seed;
    const initstate = toUnsigned64(seed);
    this.state = 0n;
    // rng->inc = (initseq << 1) | 1, with initseq = PCG_DEFAULT_INC_64.
    // `inc` is fixed for the lifetime of the generator.
    this.raw();
    this.state = (this.state + initstate) & MASK64;
    this.raw();
  }

  /** Current 64-bit state, as Godot would report it. */
  public getState(): bigint {
    return this.state & MASK64;
  }

  /** Current 64-bit state as a signed integer, matching Godot's `state` property. */
  public getStateSigned(): bigint {
    return toSigned64(this.state);
  }

  /** Current 64-bit state as an exact decimal string, as Godot prints it. */
  public getStateString(): string {
    return this.getStateSigned().toString();
  }

  /** Restore a previously captured state (Godot's `state` setter). */
  public setState(state: bigint | number): void {
    this.state =
      typeof state === 'bigint' ? state & MASK64 : toUnsigned64(state);
  }

  /**
   * One raw PCG draw: advances the state and returns the XSH-RR output
   * computed from the OLD state.
   */
  private raw(): number {
    const old = this.state & MASK64;
    this.state = (old * MULTIPLIER + (INCREMENT | 1n)) & MASK64;

    // xorshifted = ((oldstate >> 18) ^ oldstate) >> 27, taken as 32 bits.
    const xorshifted = Number((((old >> 18n) ^ old) >> 27n) & 0xffffffffn);
    const rot = Number((old >> 59n) & 31n);
    // Rotate right. `>>>` yields an unsigned 32-bit value; note that a
    // trailing `& 0xffffffff` would re-sign it, because `&` coerces both
    // operands to signed int32.
    const right = xorshifted >>> rot;
    const left = xorshifted << ((-rot) & 31);
    return (right | left) >>> 0;
  }

  /** `randi()` -- one raw draw. */
  public randi(): number {
    return this.raw();
  }

  /**
   * `randf()` -- two raw draws, float32 result.
   *
   * Mirrors `RandomPCG::randf()`: the first draw supplies the exponent
   * offset, the second supplies the significand as an integer.
   */
  public randf(): number {
    const protoExpOffset = this.raw();
    if (protoExpOffset === 0) return 0;

    // Integer value, then converted to float32. NOT a bit-pattern read.
    // `| 0x80000001` must be coerced back to unsigned: `|` works on signed
    // int32, and bit 31 is set, so an unsigned coercion would otherwise
    // turn a large significand negative.
    const significand = (this.raw() | 0x80000001) >>> 0;
    const exponent = -32 - clz32(protoExpOffset);
    // Scale in float64 then round to float32, matching `ldexp` on a float.
    return fround(Math.fround(significand) * Math.pow(2, exponent));
  }

  /**
   * `randf_range(from, to)` -- two raw draws via `randf()`.
   *
   * Godot computes `randf() * (to - from) + from` in float32 for the
   * float overload, and in float64 for the double overload. GDScript's
   * `randf_range` with float arguments resolves to the float overload, so
   * the arithmetic stays in float32.
   */
  public randfRange(from: number, to: number): number {
    const span = fround(to - from);
    return fround(fround(fround(this.randf()) * span) + fround(from));
  }

  /**
   * `randi_range(from, to)` -- inclusive bounds.
   *
   * Uses PCG's bounded rejection sampling so the distribution is uniform,
   * and consumes one or more draws depending on rejection.
   */
  public randiRange(from: number, to: number): number {
    if (from === to) return from;

    const min = Math.min(from, to);
    const max = Math.max(from, to);
    const diff = (max - min) >>> 0;

    if (diff === 0xffffffff) {
      // Cannot represent an inclusive range of 2^32 values as a bound.
      return (this.raw() + min) | 0;
    }
    return this.bounded(diff + 1) + min;
  }

  /** `pcg32_boundedrand_r` -- rejection sampling against a threshold. */
  private bounded(bound: number): number {
    // threshold = (2^32 - bound) % bound, computed in 32-bit unsigned.
    const threshold = ((0x100000000 - bound) >>> 0) % bound;
    for (;;) {
      const r = this.raw();
      if (r >= threshold) return r % bound;
    }
  }

  /** `rand_weighted(weights)` -- Godot's implementation, for parity. */
  public randWeighted(weights: number[]): number {
    if (weights.length === 0) return -1;
    let sum = 0;
    for (const w of weights) sum += w;
    let remaining = this.randf() * sum;
    for (let i = 0; i < weights.length; i++) {
      remaining -= weights[i];
      if (remaining < 0) return i;
    }
    for (let i = weights.length - 1; i >= 0; i--) {
      if (weights[i] > 0) return i;
    }
    return -1;
  }
}

/** Convenience factory matching Godot's `RandomNumberGenerator.new()`. */
export function makeRng(seed = 0): GodotRandom {
  return new GodotRandom(seed);
}
