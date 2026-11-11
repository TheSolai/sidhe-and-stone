/**
 * The rendering surface.
 *
 * A fixed 960x540 LOGICAL canvas, scaled to the viewport by an INTEGER
 * factor and letterboxed. Two rules make pixel art look right:
 *
 *   1. Never a fractional scale. Nearest-neighbour at 1.5x makes some
 *      pixel rows two device pixels wide and others one, which reads as a
 *      rendering bug rather than a style.
 *   2. Hit-test in LOGICAL coordinates. If a click is compared against CSS
 *      pixels it drifts by the scale factor, and on a 3x display the player
 *      clicks one tile to the left of what they aimed at.
 */

export const LOGICAL_WIDTH = 960;
export const LOGICAL_HEIGHT = 540;

export class Surface {
  public readonly canvas: HTMLCanvasElement;
  public readonly ctx: CanvasRenderingContext2D;

  /** Integer scale factor currently applied. */
  public scale = 1;

  /** Offset of the canvas within the viewport, in CSS pixels. */
  public offsetX = 0;
  public offsetY = 0;

  /** Cached CSS size of the canvas. */
  private cssWidth = LOGICAL_WIDTH;
  private cssHeight = LOGICAL_HEIGHT;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Sidhe & Stone: could not get a 2D context');
    this.ctx = ctx;

    // The backing store is the logical size; the CSS size does the scaling.
    canvas.width = LOGICAL_WIDTH;
    canvas.height = LOGICAL_HEIGHT;

    this.ctx.imageSmoothingEnabled = false;
    this.resize();
  }

  /** Recompute the integer scale factor and the canvas's CSS size. */
  public resize(): void {
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const rawScale = Math.min(viewportW / LOGICAL_WIDTH, viewportH / LOGICAL_HEIGHT);
    // Floor to an integer, but never below 1 -- at 1x the game is small but
    // correct, and a 0x scale would render nothing.
    const scale = Math.max(1, Math.floor(rawScale));

    this.scale = scale;
    this.cssWidth = LOGICAL_WIDTH * scale;
    this.cssHeight = LOGICAL_HEIGHT * scale;

    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;

    // Centre the canvas in the stage.
    const stage = this.canvas.parentElement;
    if (stage) {
      this.offsetX = Math.max(0, Math.round((viewportW - this.cssWidth) / 2));
      this.offsetY = Math.max(0, Math.round((viewportH - this.cssHeight) / 2));
      stage.style.width = `${this.cssWidth}px`;
      stage.style.height = `${this.cssHeight}px`;
    }

    this.ctx.imageSmoothingEnabled = false;
  }

  /** Begin a frame. Clears to the background and resets the transform. */
  public begin(background: string): void {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  /**
   * Convert a pointer event into logical canvas coordinates.
   * Returns null when the pointer is outside the canvas.
   */
  public toLogical(event: { clientX: number; clientY: number }): {
    x: number;
    y: number;
  } | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / this.scale);
    const y = Math.floor((event.clientY - rect.top) / this.scale);
    if (x < 0 || y < 0 || x >= LOGICAL_WIDTH || y >= LOGICAL_HEIGHT) return null;
    return { x, y };
  }
}

/** A rectangle in logical canvas coordinates. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Does a point fall inside a rectangle? */
export function hitTest(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/**
 * Draw a crisp 1px rectangle outline. Coordinates are snapped so the line
 * lands on whole device pixels.
 */
export function strokeRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 1);
  ctx.fillRect(Math.round(x), Math.round(y + h) - 1, Math.round(w), 1);
  ctx.fillRect(Math.round(x), Math.round(y) + 1, 1, Math.round(h) - 2);
  ctx.fillRect(Math.round(x + w) - 1, Math.round(y) + 1, 1, Math.round(h) - 2);
}
