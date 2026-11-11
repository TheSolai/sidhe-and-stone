/**
 * Pure-logic economy model -- a literal transcription of `sim/sim_core.gd`.
 *
 * THE LOOP
 *   excavate  ->  curate  ->  vault / gallery  ->  takings  ->  reinvest
 *
 * WHY THE ECONOMY IS SHAPED THIS WAY
 *   1. DEMAND CAPS. Scholars and donors buy at most N exhibits a day. A
 *      bigger site alone does not make money -- it makes unsold stock.
 *   2. ESCALATING COSTS. Every site, curator and gallery upgrade costs more
 *      than the last, and running them costs more every day.
 *   3. REINVESTMENT. Surplus buys sites, curators, fairies and gallery
 *      upgrades that raise throughput and demand. That is the growth loop.
 *   4. THE FATE REEL. A luck mechanic that amplifies a day's takings. It is
 *      deliberately MARGINAL: it never dominates revenue, so the management
 *      layer always matters more than the gamble.
 *
 * LEDGER SEPARATION: capital expenditure (buying a site, a curator, a fairy)
 * is INVESTMENT, not operating loss. Folding it into the daily expense line
 * made every upgrade look like a catastrophic loss day and the harness
 * cried "CHAOTIC" for an economy that was actually healthy. Operating costs
 * and capital expenditure are tracked on separate lines, and the volatility
 * test looks only at operating income.
 *
 * ORDERING IS LOAD-BEARING. GDScript dictionaries iterate in insertion
 * order, and several behaviours depend on it -- most importantly theft,
 * which walks the gallery's keys in insertion order and therefore consumes
 * the RNG in that order. Every collection here is an explicitly ordered
 * array or a `Map`, never a plain object with numeric-ish keys.
 */

import { GodotRandom } from './rng.ts';
import { ReelCore, godotInt, godotRound, type SpinResult } from './reel-core.ts';
import {
  neutralEvent,
  rollEvent,
  type GameEvent,
} from './event-deck.ts';

// ---------------------------------------------------------------- artefacts

export interface FindDef {
  readonly value: number;
  readonly theft: number;
}

/** A find's curated value and how attractive it is to thieves. */
export const FINDS: readonly (FindDef & { readonly id: string })[] = [
  { id: 'rubble', value: 18, theft: 1.0 },
  { id: 'clay', value: 45, theft: 1.15 },
  { id: 'relic', value: 110, theft: 1.3 },
  { id: 'crown', value: 300, theft: 1.6 },
];

export const GRADE_ORDER: readonly string[] = ['crown', 'relic', 'clay', 'rubble'];

// ---------------------------------------------------------------- excavation

export interface DigDef {
  readonly id: string;
  readonly days: number;
  readonly cost: number;
  readonly finds: number;
  /** Grade weights, in declaration order -- the draw walks them in order. */
  readonly grades: readonly { readonly id: string; readonly weight: number }[];
}

/** Three excavation types. Deeper digs pay more but tie up a site longer. */
export const DIGS: readonly DigDef[] = [
  {
    id: 'test_pit',
    days: 1,
    cost: 12,
    finds: 2,
    grades: [
      { id: 'rubble', weight: 70 },
      { id: 'clay', weight: 30 },
    ],
  },
  {
    id: 'trench',
    days: 3,
    cost: 40,
    finds: 4,
    grades: [
      { id: 'rubble', weight: 10 },
      { id: 'clay', weight: 55 },
      { id: 'relic', weight: 35 },
    ],
  },
  {
    id: 'shaft',
    days: 6,
    cost: 95,
    finds: 3,
    grades: [
      { id: 'clay', weight: 25 },
      { id: 'relic', weight: 60 },
      { id: 'crown', weight: 15 },
    ],
  },
];

// ---------------------------------------------------------------- upgrades

export interface UpgradeDef {
  readonly id: string;
  readonly base: number;
  readonly escalate: number;
  readonly max: number;
  /** Luck granted per purchase (omen only). */
  readonly luck?: number;
}

/** Reinvestment catalogue. Costs escalate geometrically. */
export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'site', base: 180, escalate: 1.45, max: 24 },
  { id: 'curator', base: 520, escalate: 1.55, max: 8 },
  { id: 'gallery', base: 700, escalate: 1.6, max: 12 },
  { id: 'omen', base: 620, escalate: 1.5, max: 6, luck: 0.1 },
  { id: 'diggers', base: 240, escalate: 1.4, max: 6 },
  { id: 'archivists', base: 380, escalate: 1.45, max: 6 },
  { id: 'wards', base: 300, escalate: 1.4, max: 4 },
];

// ---------------------------------------------------------------- helpers

function findDef(grade: string): FindDef {
  return FINDS.find((f) => f.id === grade) ?? (FINDS[0] as FindDef);
}

function digDef(dig: string): DigDef {
  return DIGS.find((d) => d.id === dig) ?? (DIGS[0] as DigDef);
}

function upgradeDef(kind: string): UpgradeDef | undefined {
  return UPGRADES.find((u) => u.id === kind);
}

/** `pow` with GDScript's double semantics. */
function gpow(base: number, exp: number): number {
  return Math.pow(base, exp);
}

export interface DigInfo {
  dig: string;
  ready_day: number;
}

export interface SimSnapshot {
  day: number;
  money: number;
  sites: number;
  curators: number;
  charms: number;
  raw: Record<string, number>;
  vault: Record<string, number>;
  gallery: Record<string, number>;
  digging: Record<string, { dig: string; ready_day: number }>;
  pending_digs: Record<string, string>;
  upgrades_bought: Record<string, number>;
  reel: Record<string, unknown>;
  pending_payout: number;
  pending_spin: Record<string, unknown>;
  last_spin: Record<string, unknown>;
  last_event: string;
  current_event: Record<string, unknown>;
  last_day_event: Record<string, unknown>;
  event_log: Record<string, unknown>[];
  events_enabled: boolean;
  event_rng_state: string;
  last_stolen: number;
  last_stolen_grades: Record<string, number>;
  rng_state: string;
  revenue_log: number[];
  opex_log: number[];
  capex_log: number[];
  reel_revenue_log: number[];
  stolen_log: number[];
  curated_log: number[];
  manual: boolean;
}

export class SimCore {
  // ---------------------------------------------------------------- demand

  /** Visitors who actually pay on a given day. */
  public visitorDemand = 4;
  /** Demand grows slowly with calendar time. */
  public demandGrowth = 900.0;
  /** Each 'gallery' upgrade multiplies demand by this factor. */
  public marketGain = 1.32;
  /** Base number of exhibit slots. Each gallery upgrade adds slots too. */
  public gallerySlots = 4;
  public gallerySlotGain = 2;

  // ---------------------------------------------------------------- costs

  public upkeepPerSite = 2;
  public upkeepPerCurator = 8;
  public upkeepPerWard = 4;
  public curatorCapacity = 3;
  public archivistBonus = 0.08;
  public diggerBonus = 0.06;
  public theftBase = 0.05;
  public wardReduction = 0.012;
  public theftCap = 2;
  public dealerRate = 0.5;

  // ---------------------------------------------------------------- reel

  public reelCharmCost = 2;
  /** "always" spins whenever affordable, "off" never spins. */
  public reelPolicy = 'always';
  /**
   * Charm earned per exhibit earning takings.
   *
   * The rate is deliberately tied to SUCCESS: a struggling outfit earns
   * almost no charms and so can rarely spin. The luck mechanic is a reward
   * for having built something, not a lifeline for having built nothing.
   */
  public charmPerUnit = 0.15;

  // ---------------------------------------------------------------- state

  public day = 0;
  public money = 240;
  public sites = 3;
  public curators = 1;
  public charms = 6;

  /** Raw finds waiting to be catalogued, by grade. */
  public raw = new Map<string, number>();
  /** Curated exhibits held in the vault, by grade. */
  public vault = new Map<string, number>();
  /** Curated exhibits currently on display, by grade. */
  public gallery = new Map<string, number>();
  /** Digs in progress, site index -> {dig, ready_day}. */
  public digging = new Map<number, DigInfo>();

  public upgradesBought = new Map<string, number>();

  /** The luck mechanic. */
  public reel = new ReelCore();

  // ---------------------------------------------------------------- ledgers

  public revenueLog: number[] = [];
  public opexLog: number[] = [];
  public capexLog: number[] = [];
  public reelRevenueLog: number[] = [];
  public stolenLog: number[] = [];
  public curatedLog: number[] = [];

  /** Deterministic RNG for dig grades and theft. */
  public rng = new GodotRandom(20261110);

  // ---------------------------------------------------------------- events

  /** The event governing the day currently being played. */
  public currentEvent: GameEvent = neutralEvent();
  /** The event that governed the most recently resolved day. */
  public lastDayEvent: GameEvent = neutralEvent();
  /**
   * Separate RNG for the deck. Events must not perturb the rest of the
   * simulation's random stream, or turning the deck off would change the
   * baseline too.
   */
  public eventRng = new GodotRandom(20261110);
  /** Switch the deck off entirely. */
  private eventsEnabledFlag = true;
  /** Every event that has been rolled, for the day report and the harness. */
  public eventLog: GameEvent[] = [];

  public revenueToday = 0;
  public opexToday = 0;
  public capexToday = 0;
  public reelRevenueToday = 0;
  public curatedToday = 0;
  public digsCompletedToday = 0;
  public payoutApplied = 1.0;

  // ---------------------------------------------------------------- player mode

  /**
   * The headless harness runs the economy on autopilot. In manual mode the
   * same simulation code answers to the player instead. Nothing about the
   * maths changes, which is the point.
   */
  public manual = false;
  /** site index -> dig type the player has assigned for the next day. */
  public pendingDigs = new Map<number, string>();
  /** The most recent reel result, for the UI to display. */
  public lastSpin: SpinResult | null = null;
  /** A short human-readable note about what just happened. */
  public lastEvent = '';
  /** The player's payout multiplier for the day, set by a spin before it resolves. */
  public pendingPayout = 1.0;
  /** The last spin the player asked for, for the UI to animate. */
  public pendingSpin: SpinResult | null = null;

  public lastStolen = 0;
  public lastStolenGrades = new Map<string, number>();

  constructor() {
    this.rng.seed(20261110);
    this.eventRng.seed(20261110);
    for (const u of UPGRADES) this.upgradesBought.set(u.id, 0);
    this.rollEvent();
  }

  /** Whether the event deck is switched on. Setting it re-rolls the event. */
  public get eventsEnabled(): boolean {
    return this.eventsEnabledFlag;
  }

  public set eventsEnabled(value: boolean) {
    if (this.eventsEnabledFlag === value) return;
    this.eventsEnabledFlag = value;
    this.rollEvent();
  }

  // ---------------------------------------------------------------- public API

  /** How many artefacts visitors will pay for today. */
  public demandCap(): number {
    return this.demand();
  }

  /** The event governing the day being played. */
  public event(): GameEvent {
    return this.currentEvent;
  }

  /**
   * Roll the event that will govern the next day.
   *
   * The deck is rolled AHEAD of the day on purpose. The player needs to see
   * the event BEFORE they commit the gallery floor, or the event is just
   * narration rather than a decision.
   */
  public rollEvent(): GameEvent {
    this.currentEvent = this.eventsEnabledFlag
      ? rollEvent(this.eventRng)
      : neutralEvent();
    this.eventLog.push({ ...this.currentEvent });
    return this.currentEvent;
  }

  /** The demand multiplier the current event applies. */
  public eventDemandMult(): number {
    return this.currentEvent.demand;
  }

  /** The theft multiplier the current event applies. */
  public eventTheftMult(): number {
    return this.currentEvent.theft;
  }

  /** The change in curator throughput the current event applies. */
  public eventCurationDelta(): number {
    return this.currentEvent.curation;
  }

  /** Charms the current event hands over for free. */
  public eventCharm(): number {
    return this.currentEvent.charm;
  }

  /** Curated value of one exhibit of a grade, after archivist bonuses. */
  public exhibitValue(grade: string): number {
    return this.exhibitValueInternal(grade);
  }

  /** How many artefacts are currently on display. */
  public onDisplay(): number {
    let n = 0;
    for (const qty of this.gallery.values()) n += qty;
    return n;
  }

  /** Free display slots right now. */
  public slotsFree(): number {
    return Math.max(0, this.gallerySlots - this.onDisplay());
  }

  /**
   * How many of each grade ON DISPLAY actually earn money today.
   *
   * Visitors pay for the most valuable exhibits up to the demand cap, in
   * value order. Anything beyond that earns nothing but is still exposed to
   * theft -- so the split between 'paying' and 'idle' IS the tension.
   */
  public payingSplit(): Map<string, number> {
    const out = new Map<string, number>();
    const cap = this.demand();
    let paid = 0;
    for (const g of GRADE_ORDER) {
      const n = this.gallery.get(g) ?? 0;
      const earning = Math.min(Math.max(cap - paid, 0), n);
      out.set(g, earning);
      paid += earning;
    }
    return out;
  }

  /** Chance that one displayed artefact of this grade is stolen tonight. */
  public theftChance(grade: string): number {
    const base = Math.max(0.005, this.theftBase - this.wardReduction * this.count('wards'));
    return base * findDef(grade).theft * this.eventTheftMult();
  }

  /** Cost of the next purchase of an upgrade, or -1 if it is maxed. */
  public upgradeCost(kind: string): number {
    const def = upgradeDef(kind);
    if (!def) return -1;
    if (this.count(kind) >= def.max) return -1;
    return this.upgradeCostInternal(kind);
  }

  /** Buy one of an upgrade. Returns true if it was bought. */
  public buyUpgrade(kind: string): boolean {
    const def = upgradeDef(kind);
    if (!def) return false;
    const cost = this.upgradeCost(kind);
    if (cost < 0 || this.money < cost) return false;
    this.money -= cost;
    this.capexToday += cost;
    this.upgradesBought.set(kind, this.count(kind) + 1);
    this.applyUpgrade(kind);
    this.lastEvent = `Bought ${kind}`;
    return true;
  }

  /** Assign a dig type to a site for the next day. */
  public assignDig(site: number, dig: string): void {
    if (!DIGS.some((d) => d.id === dig)) return;
    if (site < 0 || site >= this.sites) return;
    this.pendingDigs.set(site, dig);
  }

  /** Forget a site's pending assignment, leaving it idle. */
  public clearDig(site: number): void {
    this.pendingDigs.delete(site);
  }

  /** Move one curated artefact from the vault onto display. */
  public displayOne(grade: string): boolean {
    if ((this.vault.get(grade) ?? 0) <= 0) return false;
    if (this.slotsFree() <= 0) return false;
    this.vault.set(grade, (this.vault.get(grade) as number) - 1);
    this.add(this.gallery, grade, 1);
    return true;
  }

  /** Move one displayed artefact back into the vault. */
  public vaultOne(grade: string): boolean {
    if ((this.gallery.get(grade) ?? 0) <= 0) return false;
    this.gallery.set(grade, (this.gallery.get(grade) as number) - 1);
    this.add(this.vault, grade, 1);
    return true;
  }

  /**
   * Spin the Fate Reel on the player's behalf, spending charms. The result
   * is held as pending_payout and applied when the day resolves.
   */
  public spinReelNow(): SpinResult | null {
    if (this.charms < this.reelCharmCost) return null;
    this.charms -= this.reelCharmCost;
    const res = this.reel.spin();
    this.pendingSpin = res;
    this.pendingPayout = res.payout;
    return res;
  }

  /** Whether the player can currently afford a spin. */
  public canSpin(): boolean {
    return this.charms >= this.reelCharmCost;
  }

  /** Total artefacts waiting to be catalogued. */
  public rawCount(): number {
    let n = 0;
    for (const qty of this.raw.values()) n += qty;
    return n;
  }

  /** Total curated artefacts sitting in the vault. */
  public vaultCount(): number {
    let n = 0;
    for (const qty of this.vault.values()) n += qty;
    return n;
  }

  /** Daily operating cost of everything currently owned. */
  public dailyUpkeep(): number {
    return (
      this.sites * this.upkeepPerSite +
      this.curators * this.upkeepPerCurator +
      this.count('wards') * this.upkeepPerWard
    );
  }

  /** How long a dig of this type takes, in days. */
  public digDays(dig: string): number {
    return digDef(dig).days;
  }

  /** Cost of a dig of this type. */
  public digCost(dig: string): number {
    return digDef(dig).cost;
  }

  /**
   * Sell one vaulted artefact to a dealer for half its value, immediately.
   * The player's decision, not an automatic safety valve.
   */
  public sellOne(grade: string): boolean {
    if ((this.vault.get(grade) ?? 0) <= 0) return false;
    this.vault.set(grade, (this.vault.get(grade) as number) - 1);
    const cash = godotInt(godotRound(this.exhibitValueInternal(grade) * this.dealerRate));
    this.money += cash;
    this.revenueToday += cash;
    this.lastEvent = `Sold a ${grade} to a dealer for ${cash}`;
    return true;
  }

  // ---------------------------------------------------------------- internals

  private count(kind: string): number {
    return this.upgradesBought.get(kind) ?? 0;
  }

  /** Apply the effect of an upgrade purchase. */
  private applyUpgrade(kind: string): void {
    switch (kind) {
      case 'site':
        this.sites += 1;
        break;
      case 'curator':
        this.curators += 1;
        break;
      case 'gallery':
        this.gallerySlots += this.gallerySlotGain;
        break;
      case 'omen':
        this.reel.luck = Math.min(0.9, this.reel.luck + (upgradeDef('omen')?.luck ?? 0));
        break;
      default:
        break;
    }
  }

  /** Pick a grade by weight, consuming one RNG draw. */
  private pickGrade(weights: readonly { id: string; weight: number }[]): string {
    let total = 0;
    for (const w of weights) total += w.weight;
    if (total <= 0) return 'rubble';
    const roll = this.rng.randiRange(1, total);
    let acc = 0;
    for (const w of weights) {
      acc += w.weight;
      if (roll <= acc) return w.id;
    }
    return 'rubble';
  }

  /** Greedy but not optimal: opens the most expensive dig it can afford. */
  private pickDig(): string {
    const affordable: DigDef[] = [];
    for (const d of DIGS) {
      if (this.money >= d.cost) affordable.push(d);
    }
    if (affordable.length === 0) return '';
    affordable.sort((a, b) => b.cost - a.cost);
    return affordable[0].id;
  }

  private add(store: Map<string, number>, grade: string, qty: number): void {
    store.set(grade, (store.get(grade) ?? 0) + qty);
  }

  private upgradeCostInternal(kind: string): number {
    const def = upgradeDef(kind) as UpgradeDef;
    return godotInt(godotRound(def.base * gpow(def.escalate, this.count(kind))));
  }

  /** Autopilot upgrade purchasing. */
  private tryBuyUpgrades(): void {
    for (const def of UPGRADES) {
      if (this.manual) continue; // the player buys upgrades by hand
      const bought = this.count(def.id);
      if (bought >= def.max) continue;
      const cost = this.upgradeCostInternal(def.id);
      if (this.money >= cost) {
        this.money -= cost;
        this.capexToday += cost;
        this.upgradesBought.set(def.id, bought + 1);
        this.applyUpgrade(def.id);
      }
    }
  }

  // ---------------------------------------------------------------- stages

  /** Open new digs on any idle site. */
  private openDigs(): void {
    for (let p = 0; p < this.sites; p++) {
      if (this.digging.has(p)) continue;
      let dig = '';
      if (this.manual) {
        // Only dig what the player assigned. Idle sites stay idle.
        dig = this.pendingDigs.get(p) ?? '';
        if (dig === '') continue;
      } else {
        dig = this.pickDig();
      }
      if (dig === '') continue;
      const def = digDef(dig);
      this.money -= def.cost;
      this.opexToday += def.cost;
      this.digging.set(p, { dig, ready_day: this.day + def.days });
      if (this.manual) this.pendingDigs.delete(p);
    }
  }

  /** Finish any dig whose time is up, yielding raw finds. */
  private finishDigs(): void {
    // Snapshot the keys: GDScript iterates `digging.keys()`, which is a
    // copy, so erasing during the walk is safe.
    for (const p of [...this.digging.keys()]) {
      const info = this.digging.get(p) as DigInfo;
      if (this.day < info.ready_day) continue;
      const def = digDef(info.dig);
      const n = godotInt(godotRound(def.finds * (1.0 + this.diggerBonus * this.count('diggers'))));
      for (let i = 0; i < n; i++) {
        this.add(this.raw, this.pickGrade(def.grades), 1);
      }
      this.digging.delete(p);
      this.digsCompletedToday += 1;
    }
  }

  /**
   * Catalogue raw finds into curated exhibits. Curators are the throughput
   * bottleneck: more finds without more curators just piles up in the
   * storeroom.
   */
  private curate(): void {
    const bonus = 1.0 + this.archivistBonus * this.count('archivists');
    void bonus;
    const capacity = Math.max(
      0,
      this.curators * this.curatorCapacity + this.eventCurationDelta()
    );
    for (let i = 0; i < capacity; i++) {
      let moved = false;
      for (const g of GRADE_ORDER) {
        if ((this.raw.get(g) ?? 0) > 0) {
          this.raw.set(g, (this.raw.get(g) as number) - 1);
          this.add(this.vault, g, 1);
          moved = true;
          this.curatedToday += 1;
          break;
        }
      }
      if (!moved) break;
    }
  }

  /** Curated value of one exhibit of a grade, after archivist bonuses. */
  private exhibitValueInternal(grade: string): number {
    const base = findDef(grade).value;
    const bonus = 1.0 + this.archivistBonus * this.count('archivists');
    return godotInt(godotRound(base * bonus));
  }

  /**
   * Move the most valuable vaulted artefacts onto display. Displaying beyond
   * the demand cap earns nothing but still risks theft, so the game only puts
   * out a little more than it expects to sell.
   */
  private restockGallery(): void {
    if (this.manual) return; // the player curates the display by hand
    const wanted = Math.min(this.gallerySlots, godotInt(Math.ceil(this.demand() * 1.3)));
    let onDisplay = 0;
    for (const qty of this.gallery.values()) onDisplay += qty;
    const space = Math.max(0, wanted - onDisplay);
    if (space <= 0) return;
    for (let i = 0; i < space; i++) {
      let moved = false;
      for (const g of GRADE_ORDER) {
        if ((this.vault.get(g) ?? 0) > 0) {
          this.vault.set(g, (this.vault.get(g) as number) - 1);
          this.add(this.gallery, g, 1);
          moved = true;
          break;
        }
      }
      if (!moved) break;
    }
  }

  /** Nightly theft. Displayed artefacts are exposed; vaulted ones are not. */
  private theft(): number {
    const chance =
      Math.max(0.005, this.theftBase - this.wardReduction * this.count('wards')) *
      this.eventTheftMult();
    let stolen = 0;
    this.lastStolenGrades = new Map<string, number>();
    // GDScript iterates `gallery.keys()` -- a snapshot in insertion order.
    for (const g of [...this.gallery.keys()]) {
      if (stolen >= this.theftCap) break;
      const n = this.gallery.get(g) ?? 0;
      for (let i = 0; i < n; i++) {
        if (stolen >= this.theftCap) break;
        const p = chance * findDef(g).theft;
        if (this.rng.randf() < p) {
          this.gallery.set(g, (this.gallery.get(g) as number) - 1);
          stolen += 1;
          this.lastStolenGrades.set(g, (this.lastStolenGrades.get(g) ?? 0) + 1);
        }
      }
    }
    return stolen;
  }

  /** Visitors pay for the most valuable exhibits on display, up to the cap. */
  private demand(): number {
    const mult = gpow(this.marketGain, this.count('gallery'));
    const timeMult = 1.0 + this.day / this.demandGrowth;
    return Math.max(
      1,
      godotInt(
        godotRound(this.visitorDemand * mult * timeMult * this.eventDemandMult())
      )
    );
  }

  /**
   * Spin the Fate Reel if policy allows and charms suffice.
   * Returns the payout multiplier (1.0 if no spin).
   */
  private spinReel(): number {
    if (this.manual) {
      // The player already spun (and watched it land) before the day
      // resolved. Apply that payout exactly once, then reset it.
      const p = this.pendingPayout;
      this.pendingPayout = 1.0;
      this.pendingSpin = null;
      return p;
    }
    if (this.reelPolicy === 'off') return 1.0;
    if (this.charms < this.reelCharmCost) return 1.0;
    this.charms -= this.reelCharmCost;
    const res = this.reel.spin();
    this.lastSpin = res;
    return res.payout;
  }

  /** Collect the day's takings, multiplied by the reel. */
  private collectTakings(multiplier: number): void {
    const cap = this.demand();
    let paid = 0;
    for (const g of GRADE_ORDER) {
      if (paid >= cap) break;
      const n = this.gallery.get(g) ?? 0;
      for (let i = 0; i < n; i++) {
        if (paid >= cap) break;
        paid += 1;
        const baseRev = this.exhibitValueInternal(g);
        const effective = godotInt(godotRound(baseRev * multiplier));
        this.money += effective;
        this.revenueToday += effective;
        this.reelRevenueToday += effective - baseRev;
      }
    }
    // Charms accrue once per paying exhibit, not per coin.
    this.charms += godotInt(godotRound(paid * this.charmPerUnit));
  }

  /**
   * Sell a vaulted artefact to a dealer for quick cash. A safety valve so a
   * player who over-invests cannot spiral into an unrecoverable hole.
   */
  private dealerSale(): void {
    if (this.manual) {
      // A dealer must never quietly sell the player's artefacts.
      return;
    }
    if (this.money >= 60) return;
    for (const g of ['rubble', 'clay', 'relic', 'crown']) {
      if ((this.vault.get(g) ?? 0) > 0) {
        this.vault.set(g, (this.vault.get(g) as number) - 1);
        const cash = godotInt(godotRound(this.exhibitValueInternal(g) * this.dealerRate));
        this.money += cash;
        this.revenueToday += cash;
        this.lastEvent = `A dealer bought a ${g} for ${cash}`;
        return;
      }
    }
  }

  // ---------------------------------------------------------------- day

  /**
   * Advance one day.
   *
   * The event rolled AHEAD of this day governs it. When the day resolves,
   * the NEXT day's event is rolled, so the player always sees the weather
   * before they have to walk into it.
   */
  public step(): void {
    this.day += 1;
    this.lastDayEvent = { ...this.currentEvent };
    this.revenueToday = 0;
    this.opexToday = 0;
    this.capexToday = 0;
    this.reelRevenueToday = 0;
    this.curatedToday = 0;
    this.digsCompletedToday = 0;
    this.payoutApplied = 1.0;

    // operating costs: scale with what you own
    const upkeep = this.dailyUpkeep();
    this.money -= upkeep;
    this.opexToday += upkeep;

    this.finishDigs();
    this.curate();
    this.openDigs();
    this.restockGallery();
    this.lastStolen = this.theft();

    const mult = this.spinReel();
    this.payoutApplied = mult;
    this.collectTakings(mult);
    this.dealerSale();
    this.tryBuyUpgrades();

    // A notice in the paper pays out in charms, not coin: a small windfall
    // that buys a reel spin rather than solving the economy outright.
    const charmGift = this.eventCharm();
    if (charmGift > 0) {
      this.charms += charmGift;
      if (this.lastEvent === '') {
        this.lastEvent = `A notice in the paper brought ${charmGift} charms`;
      }
    }

    this.revenueLog.push(this.revenueToday);
    this.opexLog.push(this.opexToday);
    this.capexLog.push(this.capexToday);
    this.reelRevenueLog.push(this.reelRevenueToday);
    this.stolenLog.push(this.lastStolen);
    this.curatedLog.push(this.curatedToday);

    // The next day's weather is rolled now.
    this.rollEvent();
  }

  /** Run `days` days on autopilot. Returns the run report. */
  public run(days: number): {
    days: number;
    money: number;
    plots: number;
    mills: number;
    market: number;
    omens: number;
    charms: number;
    luck: number;
    reel_spins: number;
    reel_avg_payout: number;
    money_curve: number[];
  } {
    const moneyCurve: number[] = [];
    for (let i = 0; i < days; i++) {
      this.step();
      moneyCurve.push(this.money);
    }
    return {
      days,
      money: this.money,
      plots: this.sites,
      mills: this.curators,
      market: this.count('gallery'),
      omens: this.count('omen'),
      charms: this.charms,
      luck: this.reel.luck,
      reel_spins: this.reel.spins,
      reel_avg_payout: this.reel.spins > 0 ? this.reel.payoutTotal / this.reel.spins : 0.0,
      money_curve: moneyCurve,
    };
  }

  // ---------------------------------------------------------------- save/load

  /** Snapshot the entire simulation for saving. */
  public toDict(): SimSnapshot {
    const mapToRecord = (m: Map<string, number>): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const [k, v] of m) out[k] = v;
      return out;
    };
    return {
      day: this.day,
      money: this.money,
      sites: this.sites,
      curators: this.curators,
      charms: this.charms,
      raw: mapToRecord(this.raw),
      vault: mapToRecord(this.vault),
      gallery: mapToRecord(this.gallery),
      digging: Object.fromEntries(
        [...this.digging.entries()].map(([k, v]) => [String(k), { ...v }])
      ),
      pending_digs: Object.fromEntries(this.pendingDigs),
      upgrades_bought: mapToRecord(this.upgradesBought),
      reel: this.reel.toDict() as unknown as Record<string, unknown>,
      pending_payout: this.pendingPayout,
      pending_spin: (this.pendingSpin ?? {}) as unknown as Record<string, unknown>,
      last_spin: (this.lastSpin ?? {}) as unknown as Record<string, unknown>,
      last_event: this.lastEvent,
      current_event: { ...this.currentEvent } as unknown as Record<string, unknown>,
      last_day_event: { ...this.lastDayEvent } as unknown as Record<string, unknown>,
      event_log: this.eventLog.map((e) => ({ ...e }) as unknown as Record<string, unknown>),
      events_enabled: this.eventsEnabledFlag,
      event_rng_state: this.eventRng.getStateString(),
      last_stolen: this.lastStolen,
      last_stolen_grades: mapToRecord(this.lastStolenGrades),
      rng_state: this.rng.getStateString(),
      revenue_log: [...this.revenueLog],
      opex_log: [...this.opexLog],
      capex_log: [...this.capexLog],
      reel_revenue_log: [...this.reelRevenueLog],
      stolen_log: [...this.stolenLog],
      curated_log: [...this.curatedLog],
      manual: this.manual,
    };
  }

  /** Restore a simulation snapshot produced by `toDict`. */
  public fromDict(d: SimSnapshot): void {
    const recordToMap = (src: Record<string, number> | undefined): Map<string, number> => {
      const out = new Map<string, number>();
      if (src) for (const [k, v] of Object.entries(src)) out.set(k, Number(v));
      return out;
    };

    this.day = Number(d.day ?? 0);
    this.money = Number(d.money ?? 240);
    this.sites = Number(d.sites ?? 3);
    this.curators = Number(d.curators ?? 1);
    this.charms = Number(d.charms ?? 6);
    this.raw = recordToMap(d.raw);
    this.vault = recordToMap(d.vault);
    this.gallery = recordToMap(d.gallery);

    this.digging = new Map<number, DigInfo>();
    if (d.digging) {
      for (const [k, info] of Object.entries(d.digging)) {
        const site = Number(k);
        const dig = typeof info === 'string' ? info : info.dig;
        // The ready day is stored with the dig, so a load restores the dig's
        // remaining time exactly rather than restarting it.
        const readyDay =
          typeof info === 'string'
            ? this.day + digDef(dig).days
            : Number(info.ready_day);
        this.digging.set(site, { dig, ready_day: readyDay });
      }
    }

    this.pendingDigs = new Map<number, string>();
    if (d.pending_digs) {
      for (const [k, dig] of Object.entries(d.pending_digs)) {
        this.pendingDigs.set(Number(k), dig);
      }
    }

    this.upgradesBought = recordToMap(d.upgrades_bought);
    for (const u of UPGRADES) {
      if (!this.upgradesBought.has(u.id)) this.upgradesBought.set(u.id, 0);
    }
    this.reel.fromDict(d.reel as never);
    this.pendingPayout = Number(d.pending_payout ?? 1.0);
    this.pendingSpin = (d.pending_spin ?? null) as unknown as SpinResult | null;
    this.lastSpin = (d.last_spin ?? null) as unknown as SpinResult | null;
    this.lastEvent = String(d.last_event ?? '');
    this.currentEvent = (d.current_event ?? neutralEvent()) as unknown as GameEvent;
    this.lastDayEvent = (d.last_day_event ?? neutralEvent()) as unknown as GameEvent;
    // Set the backing field directly: the property's setter re-rolls the
    // event, and a load must restore the event that was SAVED.
    this.eventsEnabledFlag = Boolean(d.events_enabled ?? true);
    this.eventLog = (d.event_log ?? []).map((e) => e as unknown as GameEvent);
    const est = String(d.event_rng_state ?? '');
    if (/^-?\d+$/.test(est)) this.eventRng.setState(BigInt(est));
    else this.eventRng.seed(20261110);
    this.lastStolen = Number(d.last_stolen ?? 0);
    this.lastStolenGrades = recordToMap(d.last_stolen_grades);
    this.manual = Boolean(d.manual ?? true);
    this.revenueLog = (d.revenue_log ?? []).map(Number);
    this.opexLog = (d.opex_log ?? []).map(Number);
    this.capexLog = (d.capex_log ?? []).map(Number);
    this.reelRevenueLog = (d.reel_revenue_log ?? []).map(Number);
    this.stolenLog = (d.stolen_log ?? []).map(Number);
    this.curatedLog = (d.curated_log ?? []).map(Number);
    const st = String(d.rng_state ?? '');
    if (/^-?\d+$/.test(st)) this.rng.setState(BigInt(st));
    else this.rng.seed(20261110);
  }
}

// ---------------------------------------------------------------- analysis

export interface BalanceReport {
  verdict: string;
  detail: string;
  net_early: number;
  net_late: number;
  active_pct: number;
  reel_share: number;
  capex_share: number;
  net_cv: number;
  day1: number;
  final: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0.0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0.0;
  let mean = 0.0;
  for (const v of values) mean += v;
  mean /= values.length;
  let acc = 0.0;
  for (const v of values) acc += Math.pow(v - mean, 2.0);
  return Math.sqrt(acc / (values.length - 1));
}

/**
 * Balance report. Judges the economy, not the bank balance: cumulative money
 * is supposed to grow, so the verdict is driven by OPERATING NET INCOME
 * (revenue minus recurring operating cost). Capital expenditure is excluded
 * because buying a curator is progress, not a loss.
 *
 * Hard rules the harness enforces:
 *   * the reel must never dominate revenue
 *   * operating income must not become chaotically volatile
 *   * luck must be worth buying
 */
export function analyse(
  curve: number[],
  revenue: number[],
  opex: number[],
  capex: number[],
  reelRev: number[]
): BalanceReport {
  if (curve.length < 12) {
    return {
      verdict: 'insufficient data',
      detail: '',
      net_early: 0,
      net_late: 0,
      active_pct: 0,
      reel_share: 0,
      capex_share: 0,
      net_cv: 0,
      day1: 0,
      final: 0,
    };
  }
  const n = curve.length;
  const third = Math.floor(n / 3);

  const opFirst: number[] = [];
  const opLast: number[] = [];
  const opAll: number[] = [];
  for (let i = 0; i < n; i++) {
    const op = revenue[i] - opex[i];
    opAll.push(op);
    if (i < third) opFirst.push(op);
    else if (i >= n - third) opLast.push(op);
  }

  const mFirst = median(opFirst);
  const mLast = median(opLast);
  let activeDays = 0;
  for (let i = 1; i < n; i++) {
    if (curve[i] > curve[i - 1]) activeDays += 1;
  }
  const activePct = activeDays / n;

  let reelTotal = 0;
  for (const r of reelRev) reelTotal += r;
  let gross = 0;
  for (const r of revenue) gross += r;
  const reelShare = gross > 0 ? reelTotal / gross : 0.0;

  let capTotal = 0;
  for (const c of capex) capTotal += c;
  const capexShare = gross > 0 ? capTotal / gross : 0.0;

  let meanOp = 0.0;
  for (const v of opAll) meanOp += v;
  meanOp /= opAll.length;
  const sd = stdev(opAll);
  const cv = Math.abs(meanOp) > 1.0 ? sd / Math.abs(meanOp) : 99.0;

  let verdict = 'healthy';
  let detail = 'operating income stable across the curve';
  if (mFirst <= 0.0) {
    verdict = 'STALLS — early game earns nothing';
    detail = 'first third median operating income <= 0';
  } else if (mLast < mFirst * 0.5) {
    verdict = 'DECLINING — late game earns less than early game';
    detail = `late operating income ${mLast.toFixed(0)} vs early ${mFirst.toFixed(0)}`;
  } else if (mLast > Math.max(mFirst * 50.0, 500.0)) {
    verdict = 'RUNAWAY — operating income explodes';
    detail = `late operating income ${mLast.toFixed(0)} vs early ${mFirst.toFixed(0)}`;
  } else if (activePct < 0.35) {
    verdict = 'STALLS — player idles too often';
    detail = `only ${(activePct * 100.0).toFixed(0)}% of days made a profit`;
  } else if (reelShare > 0.45) {
    verdict = 'REEL DOMINATES — luck mechanic is eating the management game';
    detail = `reel drove ${(reelShare * 100.0).toFixed(0)}% of revenue`;
  } else if (cv > 4.0) {
    verdict = 'CHAOTIC — daily operating income too volatile';
    detail = `operating income CV ${cv.toFixed(1)} (mean ${meanOp.toFixed(0)}, sd ${sd.toFixed(0)})`;
  }

  return {
    verdict,
    detail,
    net_early: mFirst,
    net_late: mLast,
    active_pct: activePct,
    reel_share: reelShare,
    capex_share: capexShare,
    net_cv: cv,
    day1: curve[0],
    final: curve[n - 1],
  };
}
