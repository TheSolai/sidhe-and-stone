/**
 * A competent player, expressed as code.
 *
 * A literal transcription of `sim/player_path.gd`.
 *
 * The balance harness used to drive SimCore on autopilot, which meant it
 * proved balance for an economy the player never experiences: the autopilot
 * buys upgrades itself, restocks its own gallery, and -- crucially -- never
 * sees a milestone payout, because milestones live in GameState. That broke
 * the GDD's own invariant: proved balance must equal felt balance.
 *
 * This class closes the gap. It drives GameState -- the same object the UI
 * drives, through the same actions -- and it plays like a player rather than
 * like a spreadsheet:
 *
 *   * opens with shallow digs until there is stock to sell, then goes deep
 *   * puts the best finds on the gallery floor, a little beyond the demand
 *     cap, because that is the tension the game is about
 *   * spins the reel when it can afford to
 *   * buys upgrades when it can afford to, keeping a buffer
 *
 * It is not optimal play. It is honest play, and honest play is what the
 * balance numbers have to survive.
 */

import type { GameState } from './game-state.ts';
import { rewardMoney } from './goals.ts';
import { GRADE_ORDER } from './sim-core.ts';

/**
 * Every dig type, in ascending order of depth. This is the canonical list:
 * it is the order dig types are declared in everywhere else in the game.
 */
export const DIG_ORDER: readonly string[] = [
  'test_pit',
  'trench',
  'cutting',
  'shaft',
  'deepworks',
];

/**
 * The order the harness player actually digs in, RICHEST FIRST. A competent
 * player prefers a rich find, but only once the outfit can actually sell
 * what it digs.
 */
export const DIG_PREFERENCE: readonly string[] = [
  'deepworks',
  'shaft',
  'cutting',
  'trench',
  'test_pit',
];

/** Digs that tie a site up for days rather than hours. */
export const DEEP_DIGS: readonly string[] = ['cutting', 'shaft', 'deepworks'];

/**
 * How much money the outfit must have in hand before it will open a
 * deepworks - a nine-day project. It is a gamble on the whole board, and
 * the harness player only takes it with money to spare.
 */
export const DEEPWORKS_CASH = 500;

/** Upgrade priority order. */
export const UPGRADE_PRIORITY: readonly string[] = [
  'site',
  'curator',
  'gallery',
  'guides',
  'excavators',
  'omen',
  'archivists',
  'wards',
  'diggers',
];

/**
 * How much cash the player keeps unspent as a buffer before buying an
 * upgrade. Greedy players who spend to zero never recover from a bad night.
 */
export const BUFFER = 60;

export interface GoalDay {
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
}

export interface PlayerPathReport {
  days: number;
  money_curve: number[];
  goal_days: GoalDay[];
  revenue_log: number[];
  opex_log: number[];
  capex_log: number[];
  reel_revenue_log: number[];
  spins: number;
  avg_payout: number;
  luck: number;
  charms: number;
  sites: number;
  curators: number;
  gallery_upgrades: number;
  omens: number;
  guides: number;
  excavators: number;
  shaft_days: number;
  demand: number;
}

/** Play `days` days through `state`. Returns a report. */
export function play(state: GameState, days: number): PlayerPathReport {
  const curve: number[] = [];
  const goalDays: GoalDay[] = [];

  // Record the day each milestone lands on, and what the economy was doing
  // at the time. The reward for a milestone has to be scaled against the
  // income the player has at that moment, not against some global average.
  const previousGoalHandler = state.onGoalAchieved;
  state.onGoalAchieved = (g) => {
    const d = state.day();
    goalDays.push({
      id: g.id,
      title: g.title,
      day: d,
      reward_money: rewardMoney(g),
      operating_income_day: dayOperatingIncome(state, d),
      operating_income_daily: dailyOperatingIncome(state, 7),
      operating_income_trail: trailingOperatingIncome(state, 7),
      revenue_daily: dailyRevenue(state, 7),
      revenue_trail: trailingRevenue(state, 7),
      money_after: state.money(),
    });
    previousGoalHandler?.(g);
  };

  for (let i = 0; i < days; i++) {
    playOneDay(state);
    curve.push(state.money());
  }

  state.onGoalAchieved = previousGoalHandler;

  return {
    days,
    money_curve: curve,
    goal_days: goalDays,
    revenue_log: [...state.revenueLog()],
    opex_log: [...state.opexLog()],
    capex_log: [...state.capexLog()],
    reel_revenue_log: [...state.reelRevenueLog()],
    spins: state.sim.reel.spins,
    avg_payout:
      state.sim.reel.spins > 0 ? state.sim.reel.payoutTotal / state.sim.reel.spins : 0.0,
    luck: state.luck(),
    charms: state.charms(),
    sites: state.sites(),
    curators: state.curators(),
    gallery_upgrades: state.upgradeCount('gallery'),
    omens: state.upgradeCount('omen'),
    guides: state.upgradeCount('guides'),
    excavators: state.upgradeCount('excavators'),
    shaft_days: state.digDays('shaft'),
    demand: state.demand(),
  };
}

/** One day of competent play. */
function playOneDay(state: GameState): void {
  assignDigs(state);
  restockGallery(state);
  if (state.canSpin()) state.spinReel();
  state.endDay();
  buyUpgrades(state);
}

/**
 * Dig the richest site the player can currently afford.
 *
 * A competent player does NOT open a six-day shaft while the gallery floor
 * is still empty: that is six days of upkeep with nothing to sell, and it
 * buries the outfit in debt before it has ever made a penny. So depth comes
 * AFTER the first stock. This single rule is what keeps the opening week
 * solvent, and the opening week's solvency is what makes the early
 * milestones meaningful rather than compensatory.
 */
function assignDigs(state: GameState): void {
  const money = state.money();
  const selling = state.onDisplay() > 0;
  for (let site = 0; site < state.sites(); site++) {
    if (state.digInProgress(site)) continue;
    let chosen = '';
    for (const d of DIG_PREFERENCE) {
      if (state.digCost(d) > money) continue;
      if (!selling && DEEP_DIGS.includes(d)) continue; // no deep digs until there is stock
      if (d === 'deepworks' && money < DEEPWORKS_CASH) continue;
      chosen = d;
      break;
    }
    if (chosen === '') chosen = 'test_pit'; // cheapest; credit is allowed
    state.assignDig(site, chosen);
  }
}

/**
 * Put the best finds on display, a little beyond what visitors will buy.
 * Going past the demand cap earns nothing but risks theft -- which is the
 * decision the game asks the player to make, so the harness makes it too.
 */
function restockGallery(state: GameState): void {
  const wanted = Math.ceil(state.demand() * 1.3);
  const vault = state.vaultCounts();
  for (const g of GRADE_ORDER) {
    while ((vault.get(g) ?? 0) > 0 && state.onDisplay() < wanted) {
      if (!state.displayOne(g)) break;
      vault.set(g, (vault.get(g) ?? 0) - 1);
    }
  }
}

/** Buy upgrades in priority order, keeping a cash buffer. */
function buyUpgrades(state: GameState): void {
  for (const kind of UPGRADE_PRIORITY) {
    const cost = state.upgradeCost(kind);
    if (cost < 0) continue;
    if (state.money() - cost < BUFFER) continue;
    state.buyUpgrade(kind);
  }
}

/** Operating income (revenue minus recurring operating cost) on one day. */
export function dayOperatingIncome(state: GameState, dayIndex: number): number {
  const rev = state.revenueLog();
  const op = state.opexLog();
  const i = dayIndex - 1;
  if (i < 0 || i >= rev.length) return 0;
  return rev[i] - op[i];
}

/**
 * Mean DAILY operating income over the last `n` days, ending today.
 * This is the number a milestone reward is scaled against.
 */
export function dailyOperatingIncome(state: GameState, n: number): number {
  const rev = state.revenueLog();
  const op = state.opexLog();
  if (rev.length === 0) return 0.0;
  const start = Math.max(0, rev.length - n);
  let total = 0;
  for (let i = start; i < rev.length; i++) total += rev[i] - op[i];
  return total / (rev.length - start);
}

/** Mean operating income over the last `n` days, ending today. */
export function trailingOperatingIncome(state: GameState, n: number): number {
  const rev = state.revenueLog();
  const op = state.opexLog();
  if (rev.length === 0) return 0.0;
  const start = Math.max(0, rev.length - n);
  let total = 0;
  for (let i = start; i < rev.length; i++) total += rev[i] - op[i];
  return total / (rev.length - start);
}

/**
 * Mean DAILY gross takings over the last `n` days, ending today.
 *
 * This, not net income, is the honest yardstick for a milestone reward. Net
 * income understates what the player is worth in the early game, because
 * the early game is deliberately spent INVESTING.
 *
 * It is a WINSORIZED MEAN, and the reasoning matters:
 *
 *   * A plain mean is right about the typical case, but the daily event deck
 *     can put one loud day in the window: a Fair Day lifts takings by 40%.
 *     That single day would inflate the yardstick.
 *   * A plain MEDIAN is the obvious other answer, and it is WRONG here. In
 *     the early game most days earn nothing at all -- the gallery is empty
 *     until the curators have caught up -- and those zeros are STRUCTURAL,
 *     not noise. The median of a mostly-zero window is 0, which would make
 *     every early milestone read as "landed on a day with no takings".
 *
 * So: mean over the window, with any single day's takings capped at twice
 * the median of the days the player actually earned.
 */
export function dailyRevenue(state: GameState, n: number): number {
  const rev = state.revenueLog();
  if (rev.length === 0) return 0.0;
  const start = Math.max(0, rev.length - n);
  const window: number[] = [];
  for (let i = start; i < rev.length; i++) window.push(rev[i]);
  return winsorizedMean(window);
}

/**
 * Mean of a window, with a single outsized day capped.
 *
 * The cap is twice the median of the EARNING days in the window. Using the
 * earning days rather than all of them keeps the early game working: if the
 * player earned on one day only, that day's takings are the median of the
 * earning days and therefore uncapped.
 */
export function winsorizedMean(window: number[]): number {
  if (window.length === 0) return 0.0;

  const earning = window.filter((v) => v > 0).sort((a, b) => a - b);

  let cap = -1;
  if (earning.length > 0) cap = earning[Math.floor(earning.length / 2)] * 2;

  let total = 0.0;
  for (const v of window) total += cap > 0 ? Math.min(v, cap) : v;
  return total / window.length;
}

/** Total gross takings over the last `n` days. */
export function trailingRevenue(state: GameState, n: number): number {
  const rev = state.revenueLog();
  if (rev.length === 0) return 0.0;
  const start = Math.max(0, rev.length - n);
  let total = 0;
  for (let i = start; i < rev.length; i++) total += rev[i];
  return total;
}
