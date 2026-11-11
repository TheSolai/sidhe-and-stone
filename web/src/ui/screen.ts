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

/** Format a signed money delta, with an explicit plus or minus. */
export function signedMoney(v: number): string {
  const rounded = Math.round(v);
  if (rounded > 0) return `+${money(rounded)}`;
  if (rounded < 0) return `-${money(Math.abs(rounded))}`;
  return money(0);
}

/** Format a multiplier, the way the reel shows it. */
export function multiplier(v: number): string {
  return `×${v.toFixed(2)}`;
}

/** Capitalise the first letter. */
export function cap(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
