/**
 * The layout and contrast audit.
 *
 * Two things went wrong over and over in this project, and neither was
 * caught by a check:
 *
 *   1. A screen drew a panel over the navigation strip, or over the
 *      framework's hint line. Every screenshot still looked plausible --
 *      the overlap was small, and nobody was measuring.
 *   2. A string was silently truncated with an ellipsis, so a description
 *      lost its meaning without anything saying so.
 *
 * Both are invisible to a pixel comparison against a baseline, and both
 * are invisible to the eye at a glance. So they are made observable.
 *
 * THE BANDS
 *
 * While a screen is drawing, every rectangle it paints and every sprite
 * it blits is measured. The result is the bounding box of everything
 * that screen drew, and the browser check asserts that the box stays
 * inside the bands the contract gives the screen:
 *
 *   TITLE   58 .. 92    the screen's name
 *   CONTENT 92 .. 404   the screen's panels
 *   FOOTER  404 .. 478   the screen's summary panel
 *
 * The framework owns the HUD above and the hint and navigation strips
 * below, so a screen that reaches past 478 is drawing where it has no
 * right to draw. The title screen owns everything and is exempt.
 *
 * THE TRUNCATIONS
 *
 * `drawText` cuts a string that does not fit rather than squeezing it
 * sideways. That is the right behaviour for a bitmap font, but it must
 * not happen by accident. Every string that gets cut is recorded with
 * the text that was asked for, so the check can assert that the strings
 * which are supposed to fit -- the upgrade descriptions, the goal
 * titles -- are NOT being cut.
 *
 * THE CONTRAST
 *
 * The third thing that went wrong was text that could not be read. The
 * secondary ink was a warm grey that measures 4.06:1 on cream -- which
 * passes WCAG AA for large text and fails it for body copy, and nobody
 * noticed, because a 13-pixel grey letter on a cream panel LOOKS fine
 * right up until someone tries to read it.
 *
 * So the audit records, for every piece of text, the ink it was drawn in
 * and the surface it was drawn on. The check then computes the real
 * contrast ratio and asserts it. Judging contrast by eye is how the
 * problem got in; measuring it is how it stays out.
 *
 * The surfaces are tracked from the fills themselves: every rectangle
 * painted records its colour, and the surface under a piece of text is
 * the last fill that covered the text's origin. That is how the panels
 * and wells actually work here -- a panel is painted, then its text is
 * written on it -- so the answer is the real one.
 */

/** The bounding box of everything a screen drew in one frame. */
export interface DrawBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** How many draw calls were measured. */
  calls: number;
  /**
   * The single draw call that reached the lowest point.
   *
   * A bounding box says a screen overran; it does not say WHICH piece
   * of it did. This does, so a failure can be traced to one line
   * instead of guessed at.
   */
  lowest: { x: number; y: number; w: number; h: number } | null;
}

/** What the audit collected during the last frame. */
export interface AuditState {
  bounds: DrawBounds | null;
  /**
   * Whether the audit is currently watching the canvas.
   *
   * The framework draws its hint and its navigation strip after the
   * screen has been drawn, and those are the framework's business -- a
   * truncated hint would be a different bug, and it must not be blamed
   * on the screen.
   */
  active: boolean;
  /**
   * Whether the screen's own drawing is happening right now.
   *
   * The audit spans the whole frame, so the framework's own text can be
   * checked for contrast too. But the BOUNDS belong to the screen
   * alone, so only the screen's drawing counts towards them.
   */
  inScreen: boolean;
}

/**
 * A rectangle that was painted, and the colour it was painted with.
 *
 * These are the surfaces that text is drawn on. A sprite is also a paint,
 * but its colour is unknown -- the pixels come from the artwork, not from
 * a fill -- so it is recorded separately and text over it is reported as
 * unmeasurable rather than measured against the wrong thing.
 */
export interface SurfaceFill {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  /** True for a sprite blit rather than a filled rectangle. */
  sprite: boolean;
}

/**
 * A piece of text, the ink it was drawn in, and what it was drawn on.
 */
export interface TextDraw {
  /** The text as it was actually drawn. */
  text: string;
  /** The ink colour, as a hex string. */
  ink: string;
  /** The colour of the surface underneath, or null if unknown. */
  surface: string | null;
  /** Where the text starts, in logical pixels. */
  x: number;
  y: number;
  /** The font size, in logical pixels. */
  size: number;
}

export const audit: AuditState = {
  bounds: null,
  active: false,
  inScreen: false,
};

/**
 * The strings cut during the last frame.
 *
 * A separate list from the bounds, because a truncation is a fact about
 * the TEXT and a bound is a fact about the GEOMETRY, and the two fail
 * for different reasons.
 */
export const truncations: string[] = [];

/** The rectangles painted during the last frame, with their colours. */
export const surfaces: SurfaceFill[] = [];

/** The text drawn during the last frame, with its ink and its surface. */
export const textDraws: TextDraw[] = [];

/** Record a string that had to be cut to fit. */
export function recordTruncation(text: string): void {
  if (!audit.active || !audit.inScreen) return;
  truncations.push(text);
}

/**
 * Record a piece of text, its ink, and the surface underneath it.
 *
 * Called by the font, so every string that reaches the screen is
 * accounted for -- including the ones drawn by the framework, which is
 * how the HUD's own low-contrast numerals were found.
 */
export function recordTextDraw(
  text: string,
  ink: string,
  x: number,
  y: number,
  size: number
): void {
  if (!audit.active) return;
  textDraws.push({
    text,
    ink,
    surface: surfaceAt(x, y),
    x,
    y,
    size,
  });
}

/**
 * The colour of the last painted rectangle that covers this point.
 *
 * The fills are in the order they were painted, so the LAST one that
 * covers the point is the one the player actually sees behind the text.
 */
function surfaceAt(x: number, y: number): string | null {
  for (let i = surfaces.length - 1; i >= 0; i--) {
    const s = surfaces[i];
    if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) {
      // A sprite covers this point. Its colour is not knowable from here,
      // so the text is reported as unmeasurable instead of being judged
      // against whatever happened to be painted underneath it.
      return s.sprite ? null : s.color;
    }
  }
  return null;
}

/**
 * Start measuring the drawing.
 *
 * The context's drawing methods are wrapped, not replaced: the wrapped
 * version does exactly what the original did, and also records where it
 * drew. Nothing about the rendering changes.
 */
export function beginAudit(ctx: CanvasRenderingContext2D): void {
  audit.bounds = null;
  truncations.length = 0;
  surfaces.length = 0;
  textDraws.length = 0;
  audit.active = true;
  audit.inScreen = false;

  const original = {
    fillRect: ctx.fillRect.bind(ctx),
    drawImage: ctx.drawImage.bind(ctx),
  };

  const recordBounds = (x: number, y: number, w: number, h: number): void => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (!Number.isFinite(w) || !Number.isFinite(h)) return;
    if (w <= 0 || h <= 0) return;
    const bounds = audit.bounds ?? {
      minX: x,
      minY: y,
      maxX: x + w,
      maxY: y + h,
      calls: 0,
      lowest: null,
    };
    if (x < bounds.minX) bounds.minX = x;
    if (y < bounds.minY) bounds.minY = y;
    if (x + w > bounds.maxX) bounds.maxX = x + w;
    if (y + h > bounds.maxY) {
      bounds.maxY = y + h;
      bounds.lowest = { x, y, w, h };
    }
    bounds.calls += 1;
    audit.bounds = bounds;
  };

  ctx.fillRect = ((x: number, y: number, w: number, h: number) => {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        // The fill's colour is whatever the caller set as the fill
        // style, which is still in place at this point.
        const color =
          typeof ctx.fillStyle === 'string' ? ctx.fillStyle : '#000000';
        surfaces.push({ x, y, w, h, color, sprite: false });
      }
      if (audit.inScreen) recordBounds(x, y, w, h);
    }
    original.fillRect(x, y, w, h);
  }) as typeof ctx.fillRect;

  ctx.drawImage = ((
    image: CanvasImageSource,
    dx: number,
    dy: number,
    dw?: number,
    dh?: number
  ) => {
    // The five-argument form gives the destination size; the
    // three-argument form takes it from the source.
    if (dw === undefined || dh === undefined) {
      const src = image as HTMLImageElement;
      surfaces.push({
        x: dx,
        y: dy,
        w: src.width,
        h: src.height,
        color: '#000000',
        sprite: true,
      });
      if (audit.inScreen) recordBounds(dx, dy, src.width, src.height);
      original.drawImage(image, dx, dy);
      return;
    }
    surfaces.push({ x: dx, y: dy, w: dw, h: dh, color: '#000000', sprite: true });
    if (audit.inScreen) recordBounds(dx, dy, dw, dh);
    original.drawImage(image, dx, dy, dw, dh);
  }) as typeof ctx.drawImage;
}

/** Stop measuring and put the raw context back. */
export function endAudit(ctx: CanvasRenderingContext2D): void {
  audit.active = false;
  audit.inScreen = false;
  // Restore the prototype methods, so the wrappers do not accumulate
  // across frames and slow the game down frame by frame.
  delete (ctx as unknown as Record<string, unknown>).fillRect;
  delete (ctx as unknown as Record<string, unknown>).drawImage;
}
