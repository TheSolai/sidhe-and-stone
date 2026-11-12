/**
 * Player-facing wrapper around SimCore.
 *
 * A literal transcription of `src/game_state.gd`.
 *
 * SimCore is the pure economy and knows nothing about who is pressing what.
 * This class is the seam: it exposes the handful of actions a player can
 * take (assign a dig, move an exhibit, buy an upgrade, spin the reel, end
 * the day) and nothing else. The UI never touches SimCore's fields directly.
 *
 * The important property: MANUAL MODE. The balance harness runs SimCore on
 * autopilot -- it picks the richest dig, restocks the gallery itself, spins
 * the reel every day and buys anything affordable. A playable game must do
 * none of that without being told. Same maths, different driver.
 *
 * This class also owns the things that are game-shaped rather than
 * economy-shaped: the tutorial, the rolling ledger of events, and the
 * save/load round trip. Keeping them here means the UI only ever talks to
 * one object.
 */

import { SimCore, GRADE_ORDER, type SimSnapshot } from './sim-core.ts';
import { Goals, GOALS, rewardMoney, type GoalContext, type GoalDef } from './goals.ts';
import { Tutorial } from './tutorial.ts';
import type { SpinResult } from './reel-core.ts';
import type { GameEvent } from './event-deck.ts';

/** The dig types a player may assign. */
export const DIG_TYPES: readonly string[] = [
  'test_pit',
  'trench',
  'cutting',
  'shaft',
  'deepworks',
];

export interface LedgerEntry {
  day: number;
  text: string;
  kind: string;
}

export interface DaySummary {
  day: number;
  money: number;
  delta: number;
  revenue: number;
  opex: number;
  capex: number;
  stolen: number;
  stolen_grades: Record<string, number>;
  payout: number;
  curated: number;
  digs_done: number;
  before_display: number;
  after_display: number;
  raw_before: number;
  raw_after: number;
  event: string;
  day_event: GameEvent;
}

export interface GoalProgress {
  goal: GoalDef;
  progress: number;
  target: number;
  complete: boolean;
}

export interface GameStateSnapshot {
  sim: SimSnapshot;
  tutorial: { index: number; skipped: boolean };
  goals: { completed: string[] };
  ledger: LedgerEntry[];
}

export class GameState {
  public sim = new SimCore();
  public tutorial = new Tutorial();
  public goals = new Goals();
  /** Rolling log of notable events, newest last. */
  public ledger: LedgerEntry[] = [];

  /** Listeners. The web UI is event-driven rather than signal-driven. */
  public onChanged: (() => void) | null = null;
  public onDayEnded: ((summary: DaySummary) => void) | null = null;
  public onGoalAchieved: ((goal: GoalDef) => void) | null = null;
  public onReelSpun: ((result: SpinResult) => void) | null = null;
  /**
   * Fired when ONE reel comes to rest, with its index.
   *
   * The three reels stop one after another, so a single sound at the
   * end of the whole spin would land on the wrong thing. This fires
   * three times per spin, once per reel, so the audio can tick along
   * with the wheels.
   */
  public onReelStop: ((index: number) => void) | null = null;
  public onTutorialAdvanced: (() => void) | null = null;
  public onGameLoaded: (() => void) | null = null;

  public static readonly LEDGER_MAX = 200;

  constructor() {
    this.sim = new SimCore();
    this.sim.manual = true;
  }

  /** Start a completely fresh game. */
  public reset(): void {
    this.sim = new SimCore();
    this.sim.manual = true;
    this.tutorial = new Tutorial();
    this.goals = new Goals();
    this.ledger = [];
  }

  // ------------------------------------------------------------------ queries

  public money(): number {
    return this.sim.money;
  }
  public day(): number {
    return this.sim.day;
  }
  public charms(): number {
    return this.sim.charms;
  }
  public luck(): number {
    return this.sim.reel.luck;
  }
  public charmCost(): number {
    return this.sim.reelCharmCost;
  }
  public sites(): number {
    return this.sim.sites;
  }
  public curators(): number {
    return this.sim.curators;
  }
  public demand(): number {
    return this.sim.demandCap();
  }
  public slotsFree(): number {
    return this.sim.slotsFree();
  }
  public gallerySlots(): number {
    return this.sim.gallerySlots;
  }
  public upkeep(): number {
    return this.sim.dailyUpkeep();
  }
  public rawCount(): number {
    return this.sim.rawCount();
  }
  public vaultCount(): number {
    return this.sim.vaultCount();
  }
  public onDisplay(): number {
    return this.sim.onDisplay();
  }
  /** How many tablets are on the gallery floor right now. */
  public tabletsDisplayed(): number {
    return this.sim.tabletsDisplayed();
  }
  /** How many masks are on the gallery floor right now. */
  public masksDisplayed(): number {
    return this.sim.masksDisplayed();
  }
  /** How many digs have finished since the museum opened. */
  public digsCompleted(): number {
    return this.sim.digsCompleted;
  }
  public lastEvent(): string {
    return this.sim.lastEvent;
  }
  public pendingDig(site: number): string {
    return this.sim.pendingDigs.get(site) ?? '';
  }
  public digInProgress(site: number): { dig: string; ready_day: number } | null {
    return this.sim.digging.get(site) ?? null;
  }
  public galleryCounts(): Map<string, number> {
    return new Map(this.sim.gallery);
  }
  public vaultCounts(): Map<string, number> {
    return new Map(this.sim.vault);
  }
  public rawCounts(): Map<string, number> {
    return new Map(this.sim.raw);
  }
  public exhibitValue(grade: string): number {
    return this.sim.exhibitValue(grade);
  }

  /**
   * How many of each grade on display actually earn today. Anything on
   * display beyond the demand cap earns nothing but is still stealable.
   */
  public payingSplit(): Map<string, number> {
    return this.sim.payingSplit();
  }

  /** Chance one displayed artefact of a grade is stolen tonight. */
  public theftChance(grade: string): number {
    return this.sim.theftChance(grade);
  }

  /** The event governing the day being played. */
  public todayEvent(): GameEvent {
    return this.sim.currentEvent;
  }

  /** The event that governed the most recently resolved day. */
  public lastDayEvent(): GameEvent {
    return this.sim.lastDayEvent;
  }

  public eventLog(): GameEvent[] {
    return this.sim.eventLog;
  }

  /** Force the event that governs the next day. A test seam. */
  public setTodayEvent(ev: GameEvent): void {
    this.sim.currentEvent = { ...ev };
  }

  /** Switch the daily event deck on or off. */
  public setEventsEnabled(on: boolean): void {
    this.sim.eventsEnabled = on;
  }

  /** The deck's headline for today. */
  public eventTitle(): string {
    return this.sim.currentEvent.title;
  }

  /** One line of flavour for today. */
  public eventText(): string {
    return this.sim.currentEvent.text;
  }

  /** How many finds one curator can catalog per day. */
  public curatorCapacity(): number {
    return this.sim.curatorCapacity;
  }

  /** How many finds the curators can handle today, after today's event. */
  public dailyCuration(): number {
    return Math.max(
      0,
      this.sim.curators * this.sim.curatorCapacity + this.sim.eventCurationDelta()
    );
  }

  public upgradeCost(kind: string): number {
    return this.sim.upgradeCost(kind);
  }
  public upgradeCount(kind: string): number {
    return this.sim.upgradesBought.get(kind) ?? 0;
  }
  public digDays(dig: string): number {
    return this.sim.digDays(dig);
  }
  public digCost(dig: string): number {
    return this.sim.digCost(dig);
  }
  public canSpin(): boolean {
    return this.sim.canSpin();
  }
  public pendingPayout(): number {
    return this.sim.pendingPayout;
  }

  // ------------------------------------------------------------------ logs

  public revenueLog(): number[] {
    return this.sim.revenueLog;
  }
  public opexLog(): number[] {
    return this.sim.opexLog;
  }
  public reelRevenueLog(): number[] {
    return this.sim.reelRevenueLog;
  }
  public capexLog(): number[] {
    return this.sim.capexLog;
  }
  public stolenLog(): number[] {
    return this.sim.stolenLog;
  }
  public curatedLog(): number[] {
    return this.sim.curatedLog;
  }

  /** Recent ledger entries, newest first. */
  public recentEvents(n = 8): LedgerEntry[] {
    const start = Math.max(0, this.ledger.length - n);
    const out: LedgerEntry[] = [];
    for (let i = this.ledger.length - 1; i >= start; i--) out.push(this.ledger[i]);
    return out;
  }

  // ------------------------------------------------------------------ goals

  /** The numbers the ladder measures. */
  public goalContext(): GoalContext {
    let curatedTotal = 0;
    for (const c of this.sim.curatedLog) curatedTotal += c;
    let cleanNights = 0;
    for (const s of this.sim.stolenLog) if (s === 0) cleanNights += 1;
    let bestDay = 0;
    let totalRevenue = 0;
    for (const r of this.sim.revenueLog) {
      bestDay = Math.max(bestDay, r);
      totalRevenue += r;
    }
    return {
      days: this.sim.day,
      on_display: this.sim.onDisplay(),
      curated_total: curatedTotal,
      money: this.sim.money,
      vault_count: this.sim.vaultCount(),
      gallery_slots: this.sim.gallerySlots,
      clean_nights: cleanNights,
      crowns_displayed: this.sim.gallery.get('crown') ?? 0,
      tablets_displayed: this.sim.gallery.get('tablet') ?? 0,
      masks_displayed: this.sim.gallery.get('mask') ?? 0,
      digs_completed: this.sim.digsCompleted,
      max_day_revenue: bestDay,
      total_revenue: totalRevenue,
    };
  }

  /**
   * Check every goal against the current state and pay out the ones that
   * have been reached. Returns the goals newly completed by this call.
   *
   * Goals are checked after every action, not just at end of day, because a
   * goal like "put one exhibit on the gallery floor" is completed the
   * instant the player does it.
   */
  public checkGoals(): GoalDef[] {
    const ctx = this.goalContext();
    const earned: GoalDef[] = [];
    for (const g of GOALS) {
      if (this.goals.isComplete(g.id)) continue;
      if (this.goals.progressFor(g, ctx) < g.target) continue;
      if (!this.goals.complete(g.id)) continue;
      this.payGoalReward(g);
      this.log(`Milestone: ${g.title}. ${this.goals.rewardText(g)}`, 'goal');
      earned.push(g);
      this.onGoalAchieved?.(g);
    }
    return earned;
  }

  /** Grant a completed goal's reward. */
  private payGoalReward(g: GoalDef): void {
    const r = g.reward;
    if (r.money !== undefined) this.sim.money += r.money;
    if (r.charms !== undefined) this.sim.charms += r.charms;
    if (r.luck !== undefined) {
      this.sim.reel.luck = Math.min(0.9, this.sim.reel.luck + r.luck);
    }
  }

  /** The goal the player is working toward right now. */
  public nextGoal(): { goal: GoalDef; progress: number; target: number } | null {
    const ctx = this.goalContext();
    const g = this.goals.nextGoal();
    if (!g) return null;
    return { goal: g, progress: this.goals.progressFor(g, ctx), target: g.target };
  }

  /** All goals with their progress, for the goals tab. */
  public goalList(): GoalProgress[] {
    const ctx = this.goalContext();
    return GOALS.map((g) => ({
      goal: g,
      progress: this.goals.progressFor(g, ctx),
      target: g.target,
      complete: this.goals.isComplete(g.id),
    }));
  }

  // ------------------------------------------------------------------ actions

  /** Returns true if the assignment was accepted. */
  public assignDig(site: number, dig: string): boolean {
    if (!DIG_TYPES.includes(dig)) return false;
    this.sim.assignDig(site, dig);
    this.log(`Site ${site + 1}: ${dig.replace('_', ' ')} assigned.`, 'dig');
    this.tutorialReport('dig_assigned');
    this.onChanged?.();
    return true;
  }

  public clearDig(site: number): void {
    this.sim.clearDig(site);
    this.onChanged?.();
  }

  /** Returns true if the artefact actually moved. */
  public displayOne(grade: string): boolean {
    if (!this.sim.displayOne(grade)) return false;
    this.log(`${this.capitalise(grade)} moved to the gallery.`, 'display');
    this.checkGoals();
    this.tutorialReport('displayed');
    this.onChanged?.();
    return true;
  }

  /** Returns true if the artefact actually moved. */
  public vaultOne(grade: string): boolean {
    if (!this.sim.vaultOne(grade)) return false;
    this.log(`${this.capitalise(grade)} put back in the vault.`, 'display');
    this.onChanged?.();
    return true;
  }

  /** Sell one vaulted artefact to a dealer for half its value. */
  public sellOne(grade: string): boolean {
    if (!this.sim.sellOne(grade)) return false;
    this.log(`Sold a ${grade} to a dealer.`, 'sale');
    this.onChanged?.();
    return true;
  }

  /** Returns true if the purchase went through. */
  public buyUpgrade(kind: string): boolean {
    if (!this.sim.buyUpgrade(kind)) return false;
    this.log(`Bought ${kind}.`, 'upgrade');
    this.onChanged?.();
    return true;
  }

  /**
   * Spin the Fate Reel. The result is held until the day resolves, so the
   * player watches the gamble land before they see the money.
   */
  public spinReel(): SpinResult | null {
    const res = this.sim.spinReelNow();
    if (!res) return null;
    this.tutorialReport('reel_spun');
    this.onChanged?.();
    return res;
  }

  /**
   * Announce that the reel has actually LANDED.
   *
   * The spin result is known the instant it is drawn -- the maths does
   * not wait for an animation -- but the player is told about it when
   * the last reel stops, because that is when they can see it. So the
   * sound and the message fire from here, and the screen calls this at
   * the moment of the reveal rather than at the moment of the pull.
   */
  public revealReel(result: SpinResult): void {
    this.onReelSpun?.(result);
  }

  /** Resolve the day: upkeep, dig completion, curation, takings, theft. */
  public endDay(): DaySummary {
    const beforeMoney = this.sim.money;
    const beforeDisplay = this.sim.onDisplay();
    const beforeRaw = this.sim.rawCount();
    this.sim.step();
    const summary: DaySummary = {
      day: this.sim.day,
      money: this.sim.money,
      delta: this.sim.money - beforeMoney,
      revenue: this.sim.revenueToday,
      opex: this.sim.opexToday,
      capex: this.sim.capexToday,
      stolen: this.sim.lastStolen,
      stolen_grades: Object.fromEntries(this.sim.lastStolenGrades),
      payout: this.sim.payoutApplied,
      curated: this.sim.curatedToday,
      digs_done: this.sim.digsCompletedToday,
      before_display: beforeDisplay,
      after_display: this.sim.onDisplay(),
      raw_before: beforeRaw,
      raw_after: this.sim.rawCount(),
      event: this.sim.lastEvent,
      day_event: { ...this.sim.lastDayEvent },
    };
    this.dayNarrative(summary);
    this.checkGoals();
    this.onDayEnded?.(summary);
    this.tutorialReport('day_ended');
    this.onChanged?.();
    return summary;
  }

  // ------------------------------------------------------------------ ledger

  /** Write one line into the rolling ledger. */
  public log(text: string, kind = 'plain'): void {
    this.ledger.push({ day: this.sim.day, text, kind });
    while (this.ledger.length > GameState.LEDGER_MAX) this.ledger.shift();
  }

  /**
   * Turn the day's numbers into a sentence. The player should be able to
   * read one line and know what happened -- a management game that makes
   * you do the arithmetic is a spreadsheet with pixels.
   */
  private dayNarrative(s: DaySummary): void {
    const bits: string[] = [];

    const revenue = s.revenue;
    const opex = s.opex;
    if (revenue > 0) bits.push(`Visitors paid £${revenue}.`);
    else bits.push('No visitors paid today.');

    // The day's event is named first, because it is the reason for the
    // numbers that follow.
    if (s.day_event && s.day_event.id) {
      bits.push(`It was ${s.day_event.title}.`);
    }

    if (s.curated > 0) {
      bits.push(`Curators catalogued ${s.curated} find${s.curated === 1 ? '' : 's'}.`);
    }

    if (s.digs_done > 0) {
      bits.push(`${s.digs_done} dig${s.digs_done === 1 ? '' : 's'} finished.`);
    }

    if (s.stolen > 0) {
      const named: string[] = [];
      for (const g of GRADE_ORDER) {
        const n = s.stolen_grades[g] ?? 0;
        if (n > 0) named.push(`${n} ${g}`);
      }
      bits.push(`THIEVES TOOK ${named.join(', ')}!`);
    }

    if (s.raw_after > 0) {
      bits.push(`${s.raw_after} find${s.raw_after === 1 ? '' : 's'} still waiting in the storeroom.`);
    }

    if (opex > 0) bits.push(`Upkeep £${opex}.`);

    if (s.delta !== 0) {
      bits.push(`Net ${s.delta > 0 ? '+' : '-'}£${Math.abs(s.delta)}.`);
    }

    this.log(`Day ${s.day} — ${bits.join(' ')}`, 'day');
  }

  private capitalise(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ------------------------------------------------------------------ tutorial

  /** Tell the tutorial what the player just did. */
  private tutorialReport(action: string): void {
    if (this.tutorial.report(action)) this.onTutorialAdvanced?.();
  }

  /** The player dismissed the tutorial. */
  public skipTutorial(): void {
    this.tutorial.skip();
    this.onTutorialAdvanced?.();
  }

  // ------------------------------------------------------------------ saving

  /** Everything about the player-facing state, in one dictionary. */
  public toDict(): GameStateSnapshot {
    return {
      sim: this.sim.toDict(),
      tutorial: this.tutorial.toDict(),
      goals: this.goals.toDict(),
      ledger: this.ledger.map((e) => ({ ...e })),
    };
  }

  /** Restore from a dictionary produced by `toDict`. */
  public fromDict(d: GameStateSnapshot): void {
    this.sim = new SimCore();
    this.sim.manual = true;
    this.sim.fromDict(d.sim);
    this.sim.manual = true;
    this.tutorial.fromDict(d.tutorial);
    this.goals.fromDict(d.goals);
    this.ledger = (d.ledger ?? []).map((e) => ({ ...e }));
    this.onGameLoaded?.();
    this.onChanged?.();
  }
}

export { rewardMoney };
