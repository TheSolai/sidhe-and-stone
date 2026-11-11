/**
 * The Fate Reel -- the luck mechanic.
 *
 * A literal transcription of `sim/reel_core.gd`. The reel is a MARGINAL
 * amplifier, not the economy: a bounded multiplier (0.85x worst, 2.6x best)
 * applied to one day's takings, bought with charms earned from sales. A
 * player who never spins still earns a fair, steady income.
 *
 * ORDERING IS LOAD-BEARING. GDScript dictionaries iterate in insertion
 * order, and the reel's random draw walks the symbol table in that order.
 * Every collection here is therefore an explicitly ordered array, and every
 * dictionary is a `Map` (which preserves insertion order in JS too).
 */

import { GodotRandom } from './rng.ts';

export interface SymbolDef {
  readonly id: string;
  readonly mult: number;
  readonly weight: number;
  readonly good: boolean;
}

/** Symbol table. Order matters: it is the order the reel draws in. */
export const SYMBOLS: readonly SymbolDef[] = [
  { id: 'clover', mult: 1.3, weight: 26.0, good: true },
  { id: 'honey', mult: 1.6, weight: 16.0, good: true },
  { id: 'moon', mult: 2.0, weight: 8.0, good: true },
  { id: 'star', mult: 2.6, weight: 4.0, good: true },
  { id: 'bog', mult: 0.9, weight: 26.0, good: false },
  { id: 'blight', mult: 0.85, weight: 22.0, good: false },
];

/**
 * A partial match (two of a kind) pays this fraction of the symbol's bonus
 * over 1.0. A pair of clovers pays 1 + 0.30 * 0.35 = 1.105x.
 */
export const PAIR_BONUS_FRACTION = 0.35;

/** A total miss pays exactly this -- the neutral outcome. No punishment. */
export const MISS_PAYOUT = 1.0;

/** How hard luck pushes the weights around. */
export const LUCK_SPREAD = 0.8;

export interface SpinResult {
  reels: string[];
  payout: number;
  pattern: 'miss' | 'pair' | 'triple';
}

export interface ReelSnapshot {
  luck: number;
  seed: number;
  rng_state: string;
  spins: number;
  payout_total: number;
  biggest_win: number;
  worst_spin: number;
  triple_hits: number;
}

/**
 * GDScript's `round()` rounds halves AWAY FROM ZERO; `Math.round` rounds
 * halves toward positive infinity. They differ for negative halves.
 */
export function godotRound(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** GDScript's `int()` truncates toward zero. */
export function godotInt(value: number): number {
  return value < 0 ? Math.ceil(value) : Math.floor(value);
}

export class ReelCore {
  /** Current luck stat, 0.0 - 1.0. Raised by hired fairies and upgrades. */
  public luck = 0.0;

  /** Deterministic RNG so balance runs are reproducible. */
  public rng: GodotRandom;

  /** The seed this generator was last seeded with. */
  public seedValue: number;

  /** Lifetime stats for balance analysis. */
  public spins = 0;
  public payoutTotal = 0.0;
  public biggestWin = 0.0;
  public worstSpin = 99.0;
  public tripleHits = 0;

  constructor(newSeed = 20261110) {
    this.seedValue = newSeed;
    this.rng = new GodotRandom(newSeed);
  }

  /** Reseed the reel, exactly as `ReelCore.reseed` does. */
  public reseed(newSeed: number): void {
    this.seedValue = newSeed;
    this.rng.seed(newSeed);
  }

  /** Weight of each symbol after luck is applied, in symbol-table order. */
  public weights(): Map<string, number> {
    const out = new Map<string, number>();
    for (const def of SYMBOLS) {
      let w = def.weight;
      if (def.good) {
        w *= 1.0 + this.luck * LUCK_SPREAD;
      } else {
        w *= Math.max(0.05, 1.0 - this.luck * LUCK_SPREAD * 0.9);
      }
      out.set(def.id, w);
    }
    return out;
  }

  /**
   * Payout multiplier for a given reel configuration.
   *
   * The symbol table is walked in insertion order of the counts map, which
   * is the order the symbols first appear in `reels`.
   */
  public static payoutFor(reels: readonly string[]): number {
    const counts = new Map<string, number>();
    for (const r of reels) counts.set(r, (counts.get(r) ?? 0) + 1);

    let best = '';
    let bestCount = 0;
    let bestMult = 0.0;
    for (const [symbol, c] of counts) {
      const m = SYMBOLS.find((s) => s.id === symbol)?.mult ?? 0;
      if (c > bestCount || (c === bestCount && m > bestMult)) {
        best = symbol;
        bestCount = c;
        bestMult = m;
      }
    }
    if (bestCount === 3) return bestMult;
    if (bestCount === 2) return 1.0 + (bestMult - 1.0) * PAIR_BONUS_FRACTION;
    return MISS_PAYOUT;
  }

  /**
   * Spin the reel.
   *
   * The draw walks the symbol table in order, accumulating weight, and
   * takes the first symbol whose running total reaches the roll. `roll <= acc`
   * is inclusive, matching GDScript.
   */
  public spin(): SpinResult {
    const w = this.weights();
    let total = 0.0;
    for (const weight of w.values()) total += weight;

    const reels: string[] = [];
    for (let i = 0; i < 3; i++) {
      const roll = this.rng.randf() * total;
      let acc = 0.0;
      let chosen = 'clover';
      for (const [symbol, weight] of w) {
        acc += weight;
        if (roll <= acc) {
          chosen = symbol;
          break;
        }
      }
      reels.push(chosen);
    }

    const counts = new Map<string, number>();
    for (const r of reels) counts.set(r, (counts.get(r) ?? 0) + 1);
    let bestCount = 0;
    for (const c of counts.values()) bestCount = Math.max(bestCount, c);

    const payout = ReelCore.payoutFor(reels);
    let pattern: 'miss' | 'pair' | 'triple' = 'miss';
    if (bestCount === 3) {
      pattern = 'triple';
      this.tripleHits += 1;
    } else if (bestCount === 2) {
      pattern = 'pair';
    }

    this.spins += 1;
    this.payoutTotal += payout;
    this.biggestWin = Math.max(this.biggestWin, payout);
    this.worstSpin = Math.min(this.worstSpin, payout);
    return { reels, payout, pattern };
  }

  /**
   * Analytic expected value of one spin at the given luck. Exact, not
   * sampled: there are only 216 three-reel outcomes.
   *
   * The triple loop runs in symbol-table order because the floating-point
   * accumulation order is observable in the last bits of the result.
   */
  public expectedValue(atLuck = -1.0): number {
    const saved = this.luck;
    if (atLuck >= 0.0) this.luck = atLuck;
    const w = this.weights();
    let total = 0.0;
    for (const weight of w.values()) total += weight;

    const p = new Map<string, number>();
    for (const [symbol, weight] of w) p.set(symbol, weight / total);

    let ev = 0.0;
    for (const a of p.keys()) {
      for (const b of p.keys()) {
        for (const c of p.keys()) {
          const prob = (p.get(a) as number) * (p.get(b) as number) * (p.get(c) as number);
          ev += prob * ReelCore.payoutFor([a, b, c]);
        }
      }
    }

    this.luck = saved;
    return ev;
  }

  /** Probability distribution of outcome patterns, for reporting. */
  public patternDistribution(): Map<string, number> {
    const w = this.weights();
    let total = 0.0;
    for (const weight of w.values()) total += weight;

    const p = new Map<string, number>();
    for (const [symbol, weight] of w) p.set(symbol, weight / total);

    const out = new Map<string, number>([
      ['triple', 0.0],
      ['pair', 0.0],
      ['miss', 0.0],
    ]);
    for (const a of p.keys()) {
      for (const b of p.keys()) {
        for (const c of p.keys()) {
          const prob = (p.get(a) as number) * (p.get(b) as number) * (p.get(c) as number);
          const counts = new Map<string, number>();
          for (const r of [a, b, c]) counts.set(r, (counts.get(r) ?? 0) + 1);
          let bestCount = 0;
          for (const n of counts.values()) bestCount = Math.max(bestCount, n);
          let pat = 'miss';
          if (bestCount === 3) pat = 'triple';
          else if (bestCount === 2) pat = 'pair';
          out.set(pat, (out.get(pat) as number) + prob);
        }
      }
    }
    return out;
  }

  /**
   * Simulated coefficient of variation of the payout multiplier. This is
   * the honest measure of how swingy the reel feels.
   */
  public simulateCv(spins = 20000): number {
    const savedSeed = this.seedValue;
    const savedLuck = this.luck;
    this.rng.seed(this.seedValue);
    const vals: number[] = [];
    for (let i = 0; i < spins; i++) {
      vals.push(ReelCore.payoutFor([this.pick(), this.pick(), this.pick()]));
    }
    let mean = 0.0;
    for (const v of vals) mean += v;
    mean /= vals.length;
    let acc = 0.0;
    for (const v of vals) acc += Math.pow(v - mean, 2.0);
    const cv = Math.sqrt(acc / (vals.length - 1)) / Math.max(0.0001, Math.abs(mean));
    this.rng.seed(savedSeed);
    this.luck = savedLuck;
    return cv;
  }

  /** One random reel, using the current weights. */
  private pick(): string {
    const w = this.weights();
    let total = 0.0;
    for (const weight of w.values()) total += weight;
    const roll = this.rng.randf() * total;
    let acc = 0.0;
    for (const [symbol, weight] of w) {
      acc += weight;
      if (roll <= acc) return symbol;
    }
    return 'clover';
  }

  /**
   * Snapshot the reel for saving.
   *
   * The RNG state is a string on purpose: it is a uint64 and JSON numbers
   * are doubles, so round-tripping it as a number would corrupt the
   * sequence and silently change every future spin.
   */
  public toDict(): ReelSnapshot {
    return {
      luck: this.luck,
      seed: this.seedValue,
      rng_state: this.rng.getStateString(),
      spins: this.spins,
      payout_total: this.payoutTotal,
      biggest_win: this.biggestWin,
      worst_spin: this.worstSpin,
      triple_hits: this.tripleHits,
    };
  }

  /** Restore a reel snapshot. */
  public fromDict(d: Partial<ReelSnapshot>): void {
    this.luck = d.luck ?? 0.0;
    this.seedValue = d.seed ?? 20261110;
    this.spins = d.spins ?? 0;
    this.payoutTotal = d.payout_total ?? 0.0;
    this.biggestWin = d.biggest_win ?? 0.0;
    this.worstSpin = d.worst_spin ?? 99.0;
    this.tripleHits = d.triple_hits ?? 0;
    const st = d.rng_state ?? '';
    if (st !== '' && /^-?\d+$/.test(st)) {
      this.rng.setState(BigInt(st));
    } else {
      this.rng.seed(this.seedValue);
    }
  }
}
