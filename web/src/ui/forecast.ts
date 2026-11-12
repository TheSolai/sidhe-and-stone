/**
 * THE FORECAST -- what tomorrow looks like.
 *
 * A management sim earns its keep on the day it is playing. The forecast
 * is the pull that brings the player BACK: the dig that opens tomorrow,
 * the finds still waiting in the storeroom, the takings the gallery
 * floor is about to earn, the milestone that is one step from done.
 *
 * It is a PURE function of the game state. No DOM, no canvas, no drawing
 * helpers -- just numbers turned into sentences. That is what lets the
 * same forecast be shown in three places (the end-of-day modal, the title
 * screen's continue path and the dig screen's footer) and be TESTED
 * without a browser.
 *
 * WHERE THE NUMBERS COME FROM
 *
 * Every figure here is read through the public GameState API, using the
 * same ordering the simulation itself uses:
 *
 *   projectedTakings
 *     `payingSplit()` walks the gallery in GRADE_ORDER -- richest exhibit
 *     first -- and marks how many of each grade visitors will actually
 *     pay for, up to the demand cap. Multiplying those counts by
 *     `exhibitValue()` reproduces exactly what `collectTakings()` would
 *     bank. The one thing it does NOT include is the Fate Reel's payout
 *     multiplier: the reel has not been spun yet, so x1 is the only
 *     multiplier that can honestly be promised.
 *
 *   projectedUpkeep
 *     `upkeep()` is the RECURRING daily operating cost -- sites,
 *     curators and wards. It does NOT include the cost of opening a new
 *     dig, because that is a one-off the player chooses, and it does not
 *     include capital expenditure, which the ledger keeps separate for a
 *     reason.
 *
 *   curatedTomorrow
 *     `dailyCuration()` is how many finds the curators can handle on the
 *     coming day (including the current omen's effect on their
 *     throughput). The number actually catalogued is bounded by the
 *     backlog, so the forecast reports the smaller of the two.
 *
 * DOCUMENTED APPROXIMATIONS
 *
 *   * The demand cap and the takings are the CURRENT cap and the CURRENT
 *     floor. Tomorrow's omen is rolled ahead of the day it governs, so
 *     the forecast can see it at the end-of-day modal -- but a forecast
 *     built mid-day is working with today's weather.
 *   * `curatedTomorrow` uses the current omen's curation modifier.
 *
 * Both approximations are stated in the strings themselves where they
 * matter: the money line says "look like", not "will be".
 */

import type { GameState } from '../sim/game-state.ts';
import { DIG_NAME } from './palette.ts';

export interface Forecast {
  /**
   * The lines that follow the headline.
   *
   * Two or three of them, always: the forecast is at least three
   * concrete sentences long (headline plus two lines), and never more
   * than four in total.
   */
  lines: string[];
  /**
   * Every fact the forecast knows, most urgent first.
   *
   * `headline` is `facts[0]`, and `lines` is the rest. A screen that
   * has only room for one fact -- the dig site's footer, the title
   * screen's hook -- takes the first one that fits rather than
   * inventing a second wording of the same thing.
   *
   * There are ALWAYS at least three facts (the storeroom, the gallery
   * floor and the money), so `lines` is never empty: the forecast is
   * never a shrug.
   */
  facts: string[];
  /** The digs that will finish during the coming day, by site. */
  readyTomorrow: { site: number; dig: string }[];
  /** How many digs are in the ground right now. */
  digging: number;
  /** Finds waiting to be catalogued. */
  backlog: number;
  /** How many finds the curators will get through tomorrow. */
  curatedTomorrow: number;
  /** Free display slots on the gallery floor. */
  freeSlots: number;
  /** Curated exhibits sitting in the vault. */
  vaultCount: number;
  /** Exhibits currently on the gallery floor. */
  onDisplay: number;
  /** How many artefacts visitors will pay for today. */
  demandCap: number;
  /** What the current gallery floor would earn in a day. */
  projectedTakings: number;
  /** The recurring daily operating cost. */
  projectedUpkeep: number;
  /** The single most interesting fact, in one short line. */
  headline: string;
  /** The milestone the player is working towards, if there is one. */
  goalHook: string | null;
  /** The day the forecast was built for. */
  day: number;
}

/** A pound figure, the way the game writes one in prose. */
function money(v: number): string {
  return `£${Math.round(v).toLocaleString('en-GB')}`;
}

/**
 * Build the forecast from the current state.
 *
 * The horizon is the coming day: the next time the day resolves. A dig
 * counts as opening tomorrow when its ready day falls on or before the
 * next resolution, which is the same test the simulation itself makes
 * when it finishes a dig.
 */
export function buildForecast(state: GameState): Forecast {
  const day = state.day();
  const sites = state.sites();

  const readyTomorrow: { site: number; dig: string }[] = [];
  let digging = 0;
  for (let i = 0; i < sites; i++) {
    const d = state.digInProgress(i);
    if (!d) continue;
    digging++;
    if (d.ready_day <= day + 1) {
      readyTomorrow.push({ site: i, dig: d.dig });
    }
  }

  const backlog = state.rawCount();
  const capacity = state.dailyCuration();
  const curatedTomorrow = Math.max(0, Math.min(capacity, backlog));

  const freeSlots = state.slotsFree();
  const vaultCount = state.vaultCount();
  const onDisplay = state.onDisplay();
  const demandCap = state.demand();

  // What the floor as it stands would earn: the paying exhibits, in the
  // simulation's own order, at the exhibit values it would use.
  const split = state.payingSplit();
  let projectedTakings = 0;
  for (const [grade, count] of split) {
    if (count <= 0) continue;
    projectedTakings += count * state.exhibitValue(grade);
  }
  const projectedUpkeep = state.upkeep();

  // The milestone the player is working towards.
  const next = state.nextGoal();
  let goalHook: string | null = null;
  let goalFact: string | null = null;
  if (next) {
    const remaining = Math.max(0, next.target - next.progress);
    goalHook = `${next.goal.title} (${next.progress}/${next.target})`;
    if (remaining === 0) {
      goalFact = `Milestone "${next.goal.title}" is met.`;
    } else if (remaining <= 1 || next.progress / Math.max(1, next.target) >= 0.75) {
      goalFact = `Milestone "${next.goal.title}" is nearly met.`;
    }
  }

  // The candidate facts, most interesting first.
  //
  // ONE fact about the digs, never two: saying "Site 1: Trench finishes
  // tomorrow" AND "3 digs finish tomorrow" in the same forecast is the
  // same news twice, and the second line is vaguer than the first. So a
  // single finishing dig is named, and several digs are counted.
  let digFact: string | null = null;
  if (readyTomorrow.length === 1) {
    const r = readyTomorrow[0];
    const name = DIG_NAME[r.dig] ?? r.dig;
    digFact = `Site ${r.site + 1}: ${name} finishes tomorrow.`;
  } else if (readyTomorrow.length > 1) {
    digFact = `${readyTomorrow.length} digs finish tomorrow.`;
  }

  const backlogFact =
    backlog > 0
      ? `${backlog} finds wait in the storeroom.`
      : 'The storeroom is empty.';

  const floorFact =
    onDisplay === 0
      ? 'Nothing is on the gallery floor.'
      : freeSlots > 0
        ? `${freeSlots} display slots are free.`
        : 'The gallery floor is full.';

  const curationFact =
    curatedTomorrow > 0
      ? `Curators will catalogue ${curatedTomorrow} finds.`
      : null;

  const moneyFact = `Takings look like ${money(projectedTakings)}, upkeep ${money(projectedUpkeep)}.`;

  // The facts, most urgent first. The headline is the first of them; the
  // lines are the rest.
  //
  // The money comes third because this is a management game: what the
  // floor will earn and what it will cost is the number the player is
  // actually playing for, and it must not be the fact that falls off
  // the end of the list.
  const pool: (string | null)[] = [
    digFact,
    goalFact,
    moneyFact,
    backlogFact,
    floorFact,
    curationFact,
  ];
  const facts: string[] = [];
  for (const fact of pool) {
    if (!fact) continue;
    if (facts.includes(fact)) continue;
    facts.push(fact);
  }

  // The headline is the ONE thing worth saying out loud.
  const headline = facts[0] ?? moneyFact;

  // The lines are everything else, in the same order of interest.
  const lines = facts.slice(1, 4);

  return {
    lines,
    facts,
    readyTomorrow,
    digging,
    backlog,
    curatedTomorrow,
    freeSlots,
    vaultCount,
    onDisplay,
    demandCap,
    projectedTakings,
    projectedUpkeep,
    headline,
    goalHook,
    day,
  };
}
