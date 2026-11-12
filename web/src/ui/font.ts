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
 * The mask is cut from SILKSCREEN, the pixel face the whole game is set
 * in. Silkscreen is drawn on a grid, so at the sizes the game uses it
 * lands on whole pixels and keeps its square, arcade lettering.
 *
 * The one-bit pipeline is unchanged: the glyph is rasterised once, the
 * alpha is thresholded, and the mask is blitted in an exact palette
 * colour. What changed is only WHICH face is rasterised.
 */

import { PAL } from './palette';
import { recordTextDraw, recordTruncation } from './audit';

/** The face every size is cut from. */
const FAMILY = 'Silkscreen';

/**
 * Where the webfont lives.
 *
 * The path is built from Vite's base URL, so it resolves the same way
 * every other asset does: from the root in development, and under the
 * deployment sub-path in a built site. The URL is resolved against the
 * document at load time, so a site served from a sub-folder finds it
 * too.
 */
const FONT_URL = `${import.meta.env.BASE_URL}fonts/Silkscreen-Regular.ttf`;

/**
 * How much ink a pixel needs before it counts as part of the glyph.
 *
 * Below this the pixel is dropped; at or above it the pixel is the ink
 * colour. A shade under a half keeps thin strokes from breaking up at
 * the small sizes, without thickening the large ones.
 */
const COVERAGE = 0.45;

/**
 * The sizes the ramp is built from.
 *
 * These are the sizes at scale 1. `setFontScale` scales every one of
 * them, so the ramp keeps its SHAPE at any scale: the body text and the
 * small text stay the same size relative to each other, and the
 * headings stay headings.
 */
const RAMP = {
  tiny: 8,
  small: 16,
  body: 16,
  mid: 24,
  large: 32,
  huge: 48,
} as const;

/** The names in the type ramp. */
export type FontName = keyof typeof RAMP;

/** A font size, in logical pixels. */
export interface FontSpec {
  readonly size: number;
}

/**
 * Text sizes for the 960x540 logical canvas.
 *
 * Every size is a multiple of 8, because Silkscreen is drawn on an
 * eight-pixel grid: at those sizes its stems land on whole pixels and
 * the lettering stays square instead of being smeared by a fractional
 * scale.
 *
 * The sizes themselves are bigger than the old system-face sizes, and
 * that is the point: Silkscreen carries its detail in fewer, fatter
 * pixels, so it needs the room. The screens were adjusted to match --
 * panels are wider, rows are taller, and the copy that used to be
 * squeezed into a column now has the space to sit in it.
 */
export const FONT: Record<FontName, { size: number }> = {
  tiny: { size: RAMP.tiny },
  small: { size: RAMP.small },
  body: { size: RAMP.body },
  mid: { size: RAMP.mid },
  large: { size: RAMP.large },
  huge: { size: RAMP.huge },
};

/** The scale applied to the ramp. One is the shipped size. */
let fontScale = 1;

/**
 * Scale every size in the ramp.
 *
 * The audit needs to know what the screens do when the type is bigger:
 * a layout that only fits one size is a layout that breaks the first
 * time a player asks for larger text. The glyphs are cut per size, so
 * the caches are cleared when the scale changes.
 */
export function setFontScale(scale: number): void {
  const next = Math.max(0.5, Math.min(2, Number.isFinite(scale) ? scale : 1));
  if (next === fontScale) return;
  fontScale = next;
  for (const name of Object.keys(RAMP) as FontName[]) {
    FONT[name].size = Math.max(1, Math.round(RAMP[name] * fontScale));
  }
  glyphs.clear();
  advances.clear();
}

/** The scale the ramp is currently at. */
export function getFontScale(): number {
  return fontScale;
}

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

/** Whether the webfont has finished loading. */
let fontReady = false;

/**
 * Load the webfont, and wait until it is ready to be cut.
 *
 * A webfont that has not arrived yet is measured with the FALLBACK
 * face, and a glyph cut from the fallback is a glyph cut from the
 * wrong font: it would be cut once, cached, and then blitted on screen
 * forever, in the wrong shape, at the wrong width. So the game waits
 * for the font before it draws anything at all.
 *
 * The face is loaded through the FontFace API so the URL is explicit:
 * it is resolved against the document, which means the same path works
 * in development and in a built site deployed under a sub-path.
 */
export async function loadFont(): Promise<void> {
  if (fontReady) return;

  const url = new URL(FONT_URL, document.baseURI).href;
  const face = new FontFace(FAMILY, `url("${url}") format("truetype")`, {
    weight: 'normal',
    style: 'normal',
    display: 'block',
  });

  await face.load();
  document.fonts.add(face);

  // Ask the document for the face at a size, so the browser downloads
  // it and reports it as usable, and then wait for the set to settle.
  await document.fonts.load(`16px "${FAMILY}"`);
  await document.fonts.ready;

  if (!document.fonts.check(`16px "${FAMILY}"`)) {
    throw new Error(
      `Sidhe & Stone: the ${FAMILY} webfont did not load (${url}). ` +
        'The game cannot draw its text without it.'
    );
  }

  fontReady = true;
}

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
 * Characters Silkscreen does not draw, and what stands in for them.
 *
 * The face covers Latin text, punctuation and a few marks, but not the
 * arrow, the tick, or the shamrock. Those are drawn as SPRITES or as
 * shapes at the call site, where they can be given real detail; this
 * table is the last line of defence, so a character that slips through
 * is never cut as an empty box.
 */
const FALLBACKS: Record<string, string> = {
  '\u2192': '>', // rightwards arrow
  '\u2190': '<', // leftwards arrow
  '\u2191': '^', // upwards arrow
  '\u2193': 'v', // downwards arrow
  '\u2618': '*', // shamrock
  '\u2713': 'v', // check mark
  '\u2717': 'x', // ballot x
  '\u25b2': '^', // black up-pointing triangle
  '\u25bc': 'v', // black down-pointing triangle
};

/** The character a glyph is actually cut from. */
function resolve(ch: string): string {
  return FALLBACKS[ch] ?? ch;
}

/**
 * Cut a one-bit mask for a single character.
 *
 * The glyph is drawn once, at the target size, and then read back. The
 * alpha of each pixel is the coverage of the glyph there, and coverage
 * above the threshold becomes ink.
 */
function cutGlyph(size: number, ch: string): Glyph {
  if (!fontReady) {
    throw new Error(
      'Sidhe & Stone: a glyph was cut before the webfont had loaded. ' +
        'The game must wait for loadFont() before it draws.'
    );
  }
  const ctx = scratchContext();
  ctx.font = `${size}px "${FAMILY}"`;

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
  ctx.fillText(resolve(ch), pad, baseline);

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
    advance: ctx.measureText(resolve(ch)).width,
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
    ctx.font = `${size}px "${FAMILY}"`;
    advance = ctx.measureText(resolve(ch)).width;
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
 * The pen advance for a single character.
 *
 * Exposed so that text which mixes glyphs and SPRITES can be measured
 * the same way the glyph-only text is measured: the sprite takes the
 * room it occupies, and the characters take their real advances.
 */
export function charAdvance(ch: string, font: FontSpec = FONT.body): number {
  return advanceFor(font.size, ch);
}

/**
 * Break a string into the lines that fit in `maxWidth`.
 *
 * The lines are broken on spaces, and no word is cut: a word too long
 * for the line is given a line of its own. Wrapping is not truncation
 * -- the whole sentence is still there, on more than one line -- so the
 * audit records nothing and the text keeps its meaning.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  font: FontSpec = FONT.body
): string[] {
  if (maxWidth <= 0) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || measureText(candidate, font) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
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
