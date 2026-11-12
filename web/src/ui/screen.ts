/**
 * The screen framework.
 *
 * A screen is a self-contained view with its own layout, drawing and input.
 * Every screen declares a set of interactive regions each frame, and the
 * app routes pointer events to whichever region contains the point.
 *
 * The layout is recomputed every frame rather than cached. The cost is
 * trivial at 960x540 with a few dozen regions, and it means a screen can
 * never draw a button somewhere other than where it can be clicked -- the
 * classic bug in hand-rolled canvas UIs.
 */

import type { GameState } from '../sim/game-state.ts';
import type { SpriteSet } from './sprites.ts';
import type { Surface } from './surface.ts';

export interface ScreenContext {
  /** The live game state. */
  state: GameState;
  /** Preloaded sprites. */
  sprites: SpriteSet;
  /** The drawing surface. */
  surface: Surface;
  /** Seconds since boot. Used for idle animation. */
  time: number;
  /** The player's last pointer position, for hover states. */
  pointer: { x: number; y: number } | null;
  /**
   * The id of the region the pointer is currently held down on.
   *
   * RULE 3.6: on press the button SINKS -- its bevel inverts -- rather
   * than fading. For that to be visible the drawing code has to know
   * which region is held, so the framework says which one it is.
   */
  pressedRegionId: string | null;
}

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Called on click. */
  onClick: () => void;
  /** Drawn in a pressed state while the pointer is down inside it. */
  id?: string;
  /** If false, the region is not clickable and is drawn disabled. */
  enabled?: boolean;
  /** If set, the pointer over this region shows this hint text. */
  hint?: string;

  // ------------------------------------------------------------- gestures
  //
  // A click is not the only way to use a control. The Fate Reel's lever
  // is pulled: the pointer goes down on it, travels, and comes back up,
  // and the control has to see the whole journey. So a region MAY
  // handle the pointer itself.
  //
  // The hooks are optional, and a region that does not define them
  // behaves exactly as before: the framework finds it on press, and
  // calls onClick on release inside it.

  /**
   * Called when the pointer goes down inside this region.
   *
   * The pointer is captured by the canvas, so the movement that follows
   * arrives even if it leaves the region -- and even if it leaves the
   * canvas.
   */
  onPointerDown?: (p: { x: number; y: number }) => void;
  /**
   * Called as the pointer moves while it is held down on this region.
   */
  onPointerMove?: (p: { x: number; y: number }) => void;
  /**
   * Called when the pointer is released, wherever it happens to be.
   *
   * Return true to CONSUME the release: the framework then does not
   * fire onClick. A drag that ends outside the region would otherwise be
   * thrown away, and a gesture that has already done its work would
   * fire the click as well.
   */
  onPointerUp?: (p: { x: number; y: number }) => boolean | void;
}

export interface Screen {
  /** The screen's stable id. */
  readonly id: string;
  /** The label on the navigation button. */
  readonly label: string;
  /** Called when the screen becomes active. */
  enter?(): void;
  /** Called every frame. Returns the interactive regions. */
  layout(ctx: ScreenContext): Region[];
  /** Called every frame after layout. */
  draw(ctx: ScreenContext): void;
  /** Called when a region is clicked. */
  onRegionClick?(region: Region, ctx: ScreenContext): void;
  /** A one-line contextual hint drawn at the bottom of the screen. */
  hint?(ctx: ScreenContext): string | undefined;
}

/** Does a point fall inside a region? */
export function regionHit(region: Region, x: number, y: number): boolean {
  return x >= region.x && x < region.x + region.w && y >= region.y && y < region.y + region.h;
}

/**
 * A toast: a short message that appears over the scene and fades.
 *
 * The game uses these for things that happened the player did not directly
 * click on: a milestone paying out, an artefact stolen overnight, a find
 * arriving from a dig.
 */
export interface Toast {
  text: string;
  color: string;
  /** Seconds remaining. */
  life: number;
  /** Total life, for the fade calculation. */
  maxLife: number;
  y: number;
}

export class ToastStack {
  public toasts: Toast[] = [];

  public push(text: string, color: string, life = 3.2, y = 90): void {
    this.toasts.push({ text, color, life, maxLife: life, y });
    // Never let the stack grow without bound.
    if (this.toasts.length > 5) this.toasts.shift();
  }

  public update(dt: number): void {
    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
  }

  public clear(): void {
    this.toasts = [];
  }
}

/** Format money the way the game shows it: a pound sign and thousands. */
export function money(v: number): string {
  const rounded = Math.round(v);
  return `£${rounded.toLocaleString('en-GB')}`;
}

/**
 * The money figure with no currency mark on it.
 *
 * RULE 4.6: the icon carries the unit, so the number stays naked. The
 * HUD draws the coin beside this number, and the coin says "money" --
 * which is why the gold can stay a picture instead of becoming a glyph
 * that measures 2.47:1 on cream.
 *
 * RULE 1.4: the comma thousands separators are still there.
 */
export function moneyNumber(v: number): string {
  return Math.round(v).toLocaleString('en-GB');
}

/** Format a signed money delta, with an explicit plus or minus. */
export function signedMoney(v: number): string {
  const rounded = Math.round(v);
  if (rounded > 0) return `+${money(rounded)}`;
  if (rounded < 0) return `-${money(Math.abs(rounded))}`;
  return money(0);
}

/**
 * Format a multiplier, the way the reel shows it.
 *
 * RULE 4.1: a multiplier is written `x1.5` -- a lowercase x, no space,
 * one decimal -- never as a percentage and never as a chip.
 *
 * A value that is exactly whole loses its decimal altogether, so a
 * doubled payout reads `x2` and not `x2.0`, which is how Kairosoft
 * writes it. A value that genuinely needs two decimals (the reel's 0.85
 * miss) keeps them: rounding it to `x0.9` would lie about the payout.
 */
export function multiplier(v: number): string {
  const text = v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `x${text}`;
}

/** Capitalise the first letter. */
export function cap(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
