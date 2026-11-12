/**
 * What a reel spin will actually do to today's takings.
 *
 * The reel screen used to show a multiplier and nothing else, which is
 * a lie by omission: a player reading "x2.6" cannot tell whether that
 * means "x2.6 on the whole day's takings" or "x2.6 on the one exhibit
 * you happened to have out". Visitors pay for only as many exhibits as
 * the demand cap allows, and only the most valuable of them, so the
 * number that matters is the one computed from THAT split.
 *
 * This module is pure: it takes the gallery, the paying split and the
 * multiplier, and returns the numbers. No canvas, no DOM, no game
 * state. That is deliberate -- the preview is the part of the reel
 * most likely to be quietly wrong, so it is the part that can be
 * tested without a browser.
 *
 * The arithmetic mirrors `SimCore.collectTakings` exactly:
 *
 *   - grades are walked RICHEST FIRST (`GRADE_ORDER`), because that is
 *     the order visitors pay in;
 *   - the count of paying exhibits is capped by the demand cap, which
 *     is what `payingSplit()` already returns;
 *   - each exhibit's takings are `round(base * multiplier)`, rounded
 *     PER EXHIBIT, not on the total. Rounding the total instead would
 *     show a different number from the one the player is given.
 */

import { GRADE_ORDER } from '../sim/sim-core.ts';
import { godotInt, godotRound } from '../sim/reel-core.ts';

/** One grade's contribution to the preview. */
export interface PayoutLine {
  grade: string;
  /** How many exhibits of this grade will actually be paid for. */
  earning: number;
  /** Takings from one exhibit, before the reel multiplier. */
  base: number;
  /** Takings from one exhibit, after the reel multiplier. */
  boosted: number;
}

export interface PayoutPreview {
  /** The multiplier being previewed. */
  multiplier: number;
  /** How many exhibits are on display. */
  displayed: number;
  /** How many of them will be paid for. */
  paying: number;
  /** How many are on display but earn nothing today. */
  idle: number;
  /** Takings today with no reel multiplier at all. */
  baseTotal: number;
  /** Takings today with the multiplier applied. */
  boostedTotal: number;
  /** The per-grade breakdown, richest first. */
  lines: PayoutLine[];
}

export interface PayoutPreviewInput {
  /** The gallery: grade -> count on display. */
  galleryCounts: Iterable<readonly [string, number]>;
  /** Grade -> count that will actually be paid for, from `payingSplit()`. */
  payingSplit: Map<string, number>;
  /** The base takings of one exhibit of a grade. */
  exhibitValue: (grade: string) => number;
  /** The multiplier to preview. */
  multiplier: number;
}

export function buildPayoutPreview(input: PayoutPreviewInput): PayoutPreview {
  const counts = new Map<string, number>();
  for (const [grade, n] of input.galleryCounts) counts.set(grade, n);

  let displayed = 0;
  for (const n of counts.values()) displayed += n;

  let paying = 0;
  let baseTotal = 0;
  let boostedTotal = 0;
  const lines: PayoutLine[] = [];

  for (const grade of GRADE_ORDER) {
    const earning = Math.max(0, input.payingSplit.get(grade) ?? 0);
    if (earning <= 0) continue;
    const base = input.exhibitValue(grade);
    const boosted = godotInt(godotRound(base * input.multiplier));
    paying += earning;
    baseTotal += base * earning;
    boostedTotal += boosted * earning;
    lines.push({ grade, earning, base, boosted });
  }

  return {
    multiplier: input.multiplier,
    displayed,
    paying,
    idle: Math.max(0, displayed - paying),
    baseTotal,
    boostedTotal,
    lines,
  };
}
