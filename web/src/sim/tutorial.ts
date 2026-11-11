/**
 * The first-run coach.
 *
 * A literal transcription of `src/tutorial.gd`.
 *
 * KairoSoft's onboarding is the craft of the genre: a new player must
 * understand the CENTRAL decision within three minutes, or they never come
 * back. Sidhe & Stone's central decision is vault-versus-display, so that
 * is what the tutorial teaches -- not "here are the buttons", but "here is
 * the choice you will be making forever".
 *
 * Each beat completes against real game state, so the tutorial advances
 * because the player did the thing -- never because a timer elapsed. It is
 * skippable, always.
 */

export interface TutorialBeat {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /**
   * A String tag: when the game reports an action with this tag, the beat
   * completes. An empty tag means the beat completes when the player
   * presses its single "Got it" button.
   */
  readonly done: string;
}

/** Every beat, in order. */
export const BEATS: readonly TutorialBeat[] = [
  {
    id: 'welcome',
    title: 'Sidhe & Stone',
    body:
      'You run a small excavation outfit on the west coast of Ireland. ' +
      'Dig into the old mounds, catalog what comes up, and decide what ' +
      'the public gets to see.',
    done: '',
  },
  {
    id: 'dig',
    title: 'Send them digging',
    body:
      'Your fairies need to know where to dig. Open Dig Sites and ' +
      'assign a dig to a site. Test pits are quick and cheap but ' +
      'shallow. Shafts take days and days, and can bring back a crown.',
    done: 'dig_assigned',
  },
  {
    id: 'wait',
    title: 'Time passes',
    body:
      'Digs take days. End the day and the finds arrive as dirty ' +
      'lumps in the storeroom. Your curators clean and label them ' +
      'each day - they are the bottleneck, so more finds without more ' +
      'curators just piles up.',
    done: 'day_ended',
  },
  {
    id: 'display',
    title: 'The first decision',
    body:
      'Open the Vault and press Display to put a find on show. ' +
      'This is the heart of the game: a displayed artefact earns money ' +
      'every day, but it can be stolen overnight. A vaulted one is ' +
      'safe and earns nothing.',
    done: 'displayed',
  },
  {
    id: 'reel',
    title: 'The Fate Reel',
    body:
      'Charms come from takings. Spend them on the reel to multiply ' +
      "a day's earnings. A miss still pays ×1.00 - it never takes " +
      'money away. Higher luck makes the good symbols more likely.',
    done: 'reel_spun',
  },
  {
    id: 'done',
    title: "You're the curator now",
    body:
      'Dig, catalogue, display, take the takings, reinvest. The ' +
      'gallery only pays for so many exhibits a day, so the real ' +
      'question is always: how much do I dare put on show?',
    done: '',
  },
];

export class Tutorial {
  public index = 0;
  public skipped = false;

  /** Is there a beat waiting to be shown? */
  public active(): boolean {
    return !this.skipped && this.index < BEATS.length;
  }

  /** The current beat, or null when there is none. */
  public current(): TutorialBeat | null {
    if (!this.active()) return null;
    return BEATS[this.index];
  }

  /** The current beat's title. */
  public currentTitle(): string {
    return this.current()?.title ?? '';
  }

  /** The current beat's body text. */
  public currentBody(): string {
    return this.current()?.body ?? '';
  }

  /** Does the current beat complete when this action happens? */
  public wants(action: string): boolean {
    const b = this.current();
    if (!b) return false;
    return b.done === action && action !== '';
  }

  /** Report an action the player took. Returns true if it completed the beat. */
  public report(action: string): boolean {
    if (!this.wants(action)) return false;
    this.index += 1;
    return true;
  }

  /**
   * The player pressed "Got it" on a beat. A beat with a completion action
   * is finished by DOING it, not by pressing a button.
   */
  public advance(): void {
    if (!this.active()) return;
    if ((this.current()?.done ?? '') === '') this.index += 1;
  }

  /** The player dismissed the tutorial entirely. */
  public skip(): void {
    this.skipped = true;
    this.index = BEATS.length;
  }

  /** How far through the tutorial the player is, 0.0 to 1.0. */
  public progress(): number {
    if (this.skipped) return 1.0;
    if (BEATS.length === 0) return 1.0;
    return Math.min(1.0, Math.max(0.0, this.index / BEATS.length));
  }

  public toDict(): { index: number; skipped: boolean } {
    return { index: this.index, skipped: this.skipped };
  }

  public fromDict(d: { index?: number; skipped?: boolean } | undefined): void {
    this.index = Number(d?.index ?? 0);
    this.skipped = Boolean(d?.skipped ?? false);
  }
}
