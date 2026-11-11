/**
 * The bitmap font.
 *
 * The canvas anti-aliases every glyph it draws, so the edge of a letter
 * is a blend of the ink colour and whatever is behind it. Those blends
 * are not in the shared palette, which quietly breaks the promise that
 * every pixel on screen comes from the palette. On a 960x540 canvas that
 * is then scaled up to a high-DPI display, the softness is magnified into
 * blur.
 *
 * So text is rasterised once into a ONE-BIT mask and blitted from there.
 * Every glyph pixel is the exact ink colour, and every edge is hard.
 *
 * The mask is cut from the same monospace face the layout was written
 * against, so the type stays readable at the sizes the game needs, and
 * any character the system can draw is available -- including the symbols
 * the interface uses.
 */

import { PAL } from './palette';
import { recordTextDraw, recordTruncation } from './audit';

/** The face every size is cut from. */
const FAMILY = 'ui-monospace, Menlo, monospace';

/**
 * How much ink a pixel needs before it counts as part of the glyph.
 *
 * Below this the pixel is dropped; at or above it the pixel is the ink
 * colour. A shade under a half keeps thin strokes from breaking up at
 * the small sizes, without thickening the large ones.
 */
const COVERAGE = 0.45;

/** A font size, in logical pixels. */
export interface FontSpec {
  readonly size: number;
}

/**
 * Text sizes for the 960x540 logical canvas.
 *
 * These are the same sizes the interface was laid out against, so the
 * layout does not shift when the text stops being anti-aliased.
 */
export const FONT = {
  tiny: { size: 9 },
  small: { size: 11 },
  body: { size: 13 },
  mid: { size: 16 },
  large: { size: 22 },
  huge: { size: 40 },
} as const;

/** A one-bit glyph: the ink pixels, and where they sit relative to the pen. */
interface Glyph {
  /** 1 for ink, 0 for background. Row-major, `w` wide. */
  mask: Uint8Array;
  w: number;
  h: number;
  /** The mask's left edge, relative to the pen position. */
  left: number;
  /** The mask's top edge, relative to the top of the line. */
  top: number;
  /** The pen advance for this character, in logical pixels. */
  advance: number;
  /** Tinted copies of this glyph, by colour. */
  tinted: Map<string, HTMLCanvasElement>;
}

const glyphs = new Map<string, Glyph>();
const advances = new Map<string, number>();

/** A canvas used only to rasterise and measure. */
let scratch: HTMLCanvasElement | null = null;

function scratchContext(): CanvasRenderingContext2D {
  if (!scratch) {
    scratch = document.createElement('canvas');
    scratch.width = 256;
    scratch.height = 256;
  }
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Sidhe & Stone: could not get a 2D context');
  return ctx;
}

/**
 * Cut a one-bit mask for a single character.
 *
 * The glyph is drawn once, at the target size, and then read back. The
 * alpha of each pixel is the coverage of the glyph there, and coverage
 * above the threshold becomes ink.
 */
function cutGlyph(size: number, ch: string): Glyph {
  const ctx = scratchContext();
  ctx.font = `${size}px ${FAMILY}`;

  const metrics = ctx.measureText('Hg');
  const ascent = Math.ceil(metrics.fontBoundingBoxAscent);
  const descent = Math.ceil(metrics.fontBoundingBoxDescent);

  // Room around the glyph for its bearings and for the descenders.
  const pad = size + 2;
  const width = size * 3 + 4;
  const height = ascent + descent + size + 4;
  const baseline = ascent + 2;

  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Pure white on a SCRATCH canvas. This is the mask buffer, not the game
  // surface: only the alpha channel is read back, and the glyph is later
  // blitted in its real ink colour. Nothing here reaches the screen.
  ctx.fillStyle = '#ffffff';
  ctx.fillText(ch, pad, baseline);

  const { data } = ctx.getImageData(0, 0, width, height);

  // Find the ink bounds.
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] >= COVERAGE * 255) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const w = maxX >= minX ? maxX - minX + 1 : 0;
  const h = maxY >= minY ? maxY - minY + 1 : 0;

  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[((minY + y) * width + (minX + x)) * 4 + 3];
      mask[y * w + x] = alpha >= COVERAGE * 255 ? 1 : 0;
    }
  }

  return {
    mask,
    w,
    h,
    left: minX - pad,
    // The offset is measured against the shared baseline, not against the
    // glyph's own ink. An 'x' and an 'H' must sit on the same line even
    // though their ink starts at different heights.
    top: minY - (baseline - ascent),
    advance: ctx.measureText(ch).width,
    tinted: new Map(),
  };
}

/** The cut glyph for a character, cutting it the first time it is seen. */
function glyphFor(size: number, ch: string): Glyph {
  const key = `${size}|${ch}`;
  let glyph = glyphs.get(key);
  if (!glyph) {
    glyph = cutGlyph(size, ch);
    glyphs.set(key, glyph);
  }
  return glyph;
}

/** The pen advance for a character. */
function advanceFor(size: number, ch: string): number {
  const key = `${size}|${ch}`;
  let advance = advances.get(key);
  if (advance === undefined) {
    const ctx = scratchContext();
    ctx.font = `${size}px ${FAMILY}`;
    advance = ctx.measureText(ch).width;
    advances.set(key, advance);
  }
  return advance;
}

/** The glyph painted in one exact colour, as a canvas ready to blit. */
function tintedGlyph(glyph: Glyph, color: string): HTMLCanvasElement {
  const cached = glyph.tinted.get(color);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, glyph.w);
  canvas.height = Math.max(1, glyph.h);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sidhe & Stone: could not get a 2D context');

  // The mask goes in as opaque ink or fully transparent, so the blit
  // leaves the background untouched and puts down nothing but the ink.
  const image = ctx.createImageData(canvas.width, canvas.height);
  const rgb = hexToRgb(color);
  for (let i = 0; i < glyph.mask.length; i++) {
    if (!glyph.mask[i]) continue;
    const o = i * 4;
    image.data[o] = rgb[0];
    image.data[o + 1] = rgb[1];
    image.data[o + 2] = rgb[2];
    image.data[o + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  glyph.tinted.set(color, canvas);
  return canvas;
}

/** Parse a palette colour into its bytes. */
function hexToRgb(color: string): [number, number, number] {
  const hex = color.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * The width of a string, in logical pixels.
 *
 * The advances are the real, fractional ones, so text is measured the
 * same way the layout was measured before the font changed. The glyphs
 * themselves are still drawn on whole pixels.
 */
export function measureText(text: string, font: FontSpec = FONT.body): number {
  let width = 0;
  for (const ch of text) {
    width += advanceFor(font.size, ch);
  }
  return width;
}

/**
 * Cut a string down to what fits in `maxWidth`, adding an ellipsis.
 *
 * The canvas used to squeeze text to fit by compressing it sideways.
 * Compressing a bitmap font is not possible without blurring it, so
 * long text is cut instead.
 */
export function truncate(
  text: string,
  maxWidth: number,
  font: FontSpec = FONT.body
): string {
  if (maxWidth <= 0) return '';
  if (measureText(text, font) <= maxWidth) return text;

  const ellipsis = '…';
  const ellipsisWidth = measureText(ellipsis, font);
  let width = 0;
  let cut = '';
  for (const ch of text) {
    const next = width + advanceFor(font.size, ch);
    if (next + ellipsisWidth > maxWidth) break;
    width = next;
    cut += ch;
  }
  return cut + ellipsis;
}

/**
 * Draw text as hard-edged bitmap glyphs.
 *
 * A one-pixel offset copy in the shadow colour is drawn first, the way
 * pixel games do: it keeps light text legible on any background and
 * reads as deliberate rather than as a blur.
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    font?: FontSpec;
    color?: string;
    shadow?: string | null;
    align?: 'left' | 'center' | 'right';
    maxWidth?: number;
  } = {}
): void {
  const {
    font = FONT.body,
    color = PAL.K,
    shadow = PAL.K,
    align = 'left',
    maxWidth,
  } = options;

  const shown = maxWidth === undefined ? text : truncate(text, maxWidth, font);
  if (!shown) return;

  // A string that had to be cut is recorded, so the browser check can
  // assert that the text which is SUPPOSED to fit is not being quietly
  // truncated. A cut string loses its meaning without saying so.
  if (shown !== text) recordTruncation(text);

  const width = measureText(shown, font);
  let pen = Math.round(x);
  if (align === 'center') pen = Math.round(x - width / 2);
  else if (align === 'right') pen = Math.round(x - width);

  const top = Math.round(y);

  // The ink and the surface it lands on, so the contrast can be measured
  // rather than judged by eye. A 13-pixel grey letter on a cream panel
  // looks fine until someone tries to read it.
  recordTextDraw(shown, color, pen, top, font.size);

  if (shadow) {
    drawRun(ctx, shown, pen + 1, top + 1, font, shadow);
  }
  drawRun(ctx, shown, pen, top, font, color);
}

/** Blit a run of glyphs, one at a time, along the pen. */
function drawRun(
  ctx: CanvasRenderingContext2D,
  text: string,
  pen: number,
  top: number,
  font: FontSpec,
  color: string
): void {
  let cursor = pen;
  for (const ch of text) {
    const glyph = glyphFor(font.size, ch);
    if (glyph.w > 0 && glyph.h > 0) {
      // The destination is rounded to whole pixels: a fractional blit
      // would resample the glyph and blend it with what is behind it,
      // which is exactly the off-palette colour this font exists to
      // avoid.
      ctx.drawImage(
        tintedGlyph(glyph, color),
        Math.round(cursor + glyph.left),
        Math.round(top + glyph.top)
      );
    }
    cursor += glyph.advance;
  }
}
