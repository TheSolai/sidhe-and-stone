/**
 * The player's ladder of milestones.
 *
 * A literal transcription of `src/goals.gd`.
 *
 * A management game needs to show the player where they are going, not just
 * where they are. The ladder is deliberately shallow -- three tiers, eighteen
 * goals -- and every goal is a thing the player has ALREADY been doing, just
 * noticed. Nothing here asks for a new verb. "Catalogue 10 finds" is what a
 * curator does.
 *
 * Rewards are granted automatically the moment a goal completes, and the
 * completion is written into the ledger, so the ladder also doubles as the
 * game's narrative spine.
 *
 * WHY THE REWARDS ARE SCALED THE WAY THEY ARE
 *   A milestone reward has to be worth roughly FOUR DAYS of the player's
 *   operating income at the moment it lands. Too small and the milestone
 *   stops mattering; too large and the milestone replaces the game. The
 *   balance harness MEASURES that ratio on every run, so the rule cannot
 *   rot.
 */

export const TIERS: readonly string[] = ['Opening', 'Steady Trade', 'Renown'];

export interface GoalReward {
  money?: number;
  charms?: number;
  luck?: number;
}

export interface GoalDef {
  readonly id: string;
  readonly tier: string;
  readonly title: string;
  readonly body: string;
  readonly metric: string;
  readonly target: number;
  readonly reward: GoalReward;
}

/** The ladder, in order. The order IS the progression. */
export const GOALS: readonly GoalDef[] = [
  {
    id: 'open_doors',
    tier: 'Opening',
    title: 'Open Doors',
    body: 'End your first day of trading.',
    metric: 'days',
    target: 1,
    reward: { charms: 3, luck: 0.02 },
  },
  {
    id: 'first_exhibit',
    tier: 'Opening',
    title: 'Something to Show',
    body: 'Put one exhibit on the gallery floor.',
    metric: 'on_display',
    target: 1,
    reward: { charms: 2, luck: 0.03 },
  },
  {
    id: 'house_of_oddities',
    tier: 'Opening',
    title: 'A House of Oddities',
    body: 'Keep 4 exhibits on display at once.',
    metric: 'on_display',
    target: 4,
    reward: { money: 250 },
  },
  {
    id: 'first_payday',
    tier: 'Opening',
    title: 'A First Payday',
    body: 'Take £50 at the door in a single day.',
    metric: 'max_day_revenue',
    target: 50,
    reward: { money: 150 },
  },
  {
    id: 'apprentice',
    tier: 'Opening',
    title: "Curator's Apprentice",
    body: 'Catalogue 10 finds.',
    metric: 'curated_total',
    target: 10,
    reward: { money: 550 },
  },
  {
    id: 'clean_sweep',
    tier: 'Opening',
    title: 'A Clean Sweep',
    body: 'Go 7 nights without losing a thing to thieves.',
    metric: 'clean_nights',
    target: 7,
    reward: { charms: 3, luck: 0.05 },
  },
  {
    id: 'tablet_case',
    tier: 'Opening',
    title: 'The Tablet Case',
    body: 'Put a tablet on the gallery floor.',
    metric: 'tablets_displayed',
    target: 1,
    reward: { charms: 3, luck: 0.05 },
  },
  {
    id: 'treasury',
    tier: 'Steady Trade',
    title: 'The Treasury Grows',
    body: 'Keep 10 pieces in the vault.',
    metric: 'vault_count',
    target: 10,
    reward: { money: 950 },
  },
  {
    id: 'crown_on_show',
    tier: 'Steady Trade',
    title: 'A Crown on Show',
    body: 'Display a crown.',
    metric: 'crowns_displayed',
    target: 1,
    reward: { money: 2050 },
  },
  {
    id: 'good_day',
    tier: 'Steady Trade',
    title: 'A Very Good Day',
    body: 'Earn £300 in a single day.',
    metric: 'max_day_revenue',
    target: 300,
    reward: { money: 350 },
  },
  {
    id: 'real_collection',
    tier: 'Steady Trade',
    title: 'A Real Collection',
    body: 'Keep 25 pieces in the vault.',
    metric: 'vault_count',
    target: 25,
    reward: { money: 1200 },
  },
  {
    id: 'steady_hands',
    tier: 'Steady Trade',
    title: 'Steady Hands',
    body: 'Go 21 nights without losing a thing to thieves.',
    metric: 'clean_nights',
    target: 21,
    reward: { money: 7900 },
  },
  {
    id: 'long_shift',
    tier: 'Steady Trade',
    title: 'The Long Shift',
    body: 'Finish 25 digs.',
    metric: 'digs_completed',
    target: 25,
    reward: { money: 4250 },
  },
  {
    id: 'grander_gallery',
    tier: 'Steady Trade',
    title: 'A Grander Gallery',
    body: 'Extend the gallery to 8 slots.',
    metric: 'gallery_slots',
    target: 8,
    reward: { money: 2500 },
  },
  {
    id: 'institution',
    tier: 'Steady Trade',
    title: 'An Institution',
    body: 'Trade for 30 days.',
    metric: 'days',
    target: 30,
    reward: { money: 9600 },
  },
  {
    id: 'strongbox',
    tier: 'Renown',
    title: 'Full Coffers',
    body: "Take £5,000 across the gallery's whole history.",
    metric: 'total_revenue',
    target: 5000,
    reward: { money: 2500 },
  },
  {
    id: 'mask_comes',
    tier: 'Renown',
    title: 'The Mask Comes',
    body: 'Display a mask.',
    metric: 'masks_displayed',
    target: 1,
    reward: { money: 4000 },
  },
  {
    id: 'renowned',
    tier: 'Renown',
    title: 'Renowned',
    body: 'Trade for 60 days.',
    metric: 'days',
    target: 60,
    reward: { money: 36000, charms: 5 },
  },
];

/** The numbers the ladder measures. */
export interface GoalContext {
  days: number;
  on_display: number;
  curated_total: number;
  money: number;
  vault_count: number;
  gallery_slots: number;
  clean_nights: number;
  crowns_displayed: number;
  tablets_displayed: number;
  masks_displayed: number;
  digs_completed: number;
  max_day_revenue: number;
  total_revenue: number;
}

export class Goals {
  /** Ids of goals already completed. */
  public completed: string[] = [];

  /** True if this goal has already been earned. */
  public isComplete(id: string): boolean {
    return this.completed.includes(id);
  }

  /** Mark a goal complete. Returns false if it already was. */
  public complete(id: string): boolean {
    if (this.completed.includes(id)) return false;
    this.completed.push(id);
    return true;
  }

  /**
   * How far along the player is on one goal, in the goal's own units.
   * Every metric is something the player has already done.
   */
  public progressFor(goal: GoalDef, ctx: GoalContext): number {
    switch (goal.metric) {
      case 'days':
        return ctx.days;
      case 'on_display':
        return ctx.on_display;
      case 'curated_total':
        return ctx.curated_total;
      case 'money':
        return ctx.money;
      case 'vault_count':
        return ctx.vault_count;
      case 'gallery_slots':
        return ctx.gallery_slots;
      case 'clean_nights':
        return ctx.clean_nights;
      case 'crowns_displayed':
        return ctx.crowns_displayed;
      case 'tablets_displayed':
        return ctx.tablets_displayed;
      case 'masks_displayed':
        return ctx.masks_displayed;
      case 'digs_completed':
        return ctx.digs_completed;
      case 'max_day_revenue':
        return ctx.max_day_revenue;
      case 'total_revenue':
        return ctx.total_revenue;
      default:
        return 0.0;
    }
  }

  /** A short human-readable reward, for the card. */
  public rewardText(goal: GoalDef): string {
    const bits: string[] = [];
    const r = goal.reward;
    if (r.money !== undefined) bits.push(`£${r.money}`);
    if (r.charms !== undefined) bits.push(`${r.charms}☘`);
    if (r.luck !== undefined) bits.push(`+${r.luck.toFixed(2)} luck`);
    return bits.join(' · ');
  }

  /**
   * The goal the player is working toward right now: the first one on the
   * ladder that is not yet complete.
   */
  public nextGoal(): GoalDef | null {
    for (const g of GOALS) {
      if (!this.completed.includes(g.id)) return g;
    }
    return null;
  }

  public toDict(): { completed: string[] } {
    return { completed: [...this.completed] };
  }

  public fromDict(d: { completed?: string[] } | undefined): void {
    this.completed = (d?.completed ?? []).map(String);
  }
}

/** The money a goal pays, for the balance harness. */
export function rewardMoney(goal: GoalDef): number {
  return goal.reward.money ?? 0;
}
