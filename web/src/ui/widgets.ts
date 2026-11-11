/**
 * The UI toolkit.
 *
 * Everything the interface is built from: cream parchment panels with dark
 * warm outlines, chunky bevelled buttons, and readable text at 1x.
 *
 * The look is deliberately LIGHT and high-contrast, the way a KairoSoft
 * screen is: a big field of warm paper, dark linework on top, and muted but
 * saturated accents that mean something. Nothing is conveyed by colour
 * alone -- every coloured element also has a shape or a word.
 */

import { PAL } from './palette.ts';
import {
  drawText,
  FONT,
  measureText,
} from './font.ts';
import { drawSprite, type SpriteSet } from './sprites.ts';
import { strokeRect, type Rect } from './surface.ts';

export { FONT, drawText, measureText } from './font.ts';
export type { FontSpec } from './font.ts';

export interface Button {
  rect: Rect;
  label: string;
  enabled: boolean;
  /** Optional small icon drawn to the left of the label. */
  icon?: string;
  /** Optional accent colour for the icon and the underline. */
  accent?: string;
  onClick: () => void;
}

export interface HitTarget {
  rect: Rect;
  onClick: () => void;
  enabled?: boolean;
}

/**
 * A parchment panel: cream fill, dark outline, and a shadow underneath so
 * it sits above the scene rather than in it.
 */
export function drawPanel(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  options: {
    fill?: string;
    border?: string;
    shadow?: boolean;
    /** An inner highlight along the top edge, like a raised panel. */
    raised?: boolean;
    title?: string;
  } = {}
): void {
  const {
    fill = PAL.C,
    border = PAL.K,
    shadow = true,
    raised = true,
    title,
  } = options;

  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);

  if (shadow) {
    // A hard, pixel-aligned offset shadow rather than a soft alpha blur.
    // The palette is a closed set, and an alpha fill would blend into
    // colours that are not in it -- which quietly breaks the promise that
    // every pixel on screen comes from the shared palette. KairoSoft's
    // panels have exactly this kind of crisp drop shadow anyway.
    ctx.fillStyle = PAL.P;
    ctx.fillRect(x + 3, y + 3, w, h);
  }

  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);

  if (raised) {
    // A lighter band along the top edge.
    ctx.fillStyle = PAL.W;
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
  }

  strokeRect(ctx, x, y, w, h, border);

  if (title) {
    drawText(ctx, title, x + 8, y + 6, { font: FONT.mid, color: PAL.D });
    const tw = Math.round(measureText(title, FONT.mid));
    ctx.fillStyle = PAL.P;
    // The rule starts on a whole pixel. A fractional x would make the
    // canvas anti-alias the edge of the rule, and that blended pixel is
    // a colour that is not in the palette.
    ctx.fillRect(x + 12 + tw, y + 13, Math.max(0, w - 24 - tw), 1);
  }
}

/** A recessed well: the inside of a panel, where content is listed. */
export function drawWell(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  fill: string = PAL.X
): void {
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  // Recessed: dark on the top and left, light on the bottom and right.
  ctx.fillStyle = PAL.P;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = PAL.W;
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x + w - 1, y, 1, h);
}

/**
 * A chunky bevelled button.
 *
 * The bevel is two pixels, and the pressed state inverts it, so the button
 * reads as physical without needing a separate pressed sprite.
 */
export function drawButton(
  ctx: CanvasRenderingContext2D,
  button: Button,
  pressed = false,
  hovered = false
): void {
  const { rect } = button;
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);

  const base = button.enabled ? (hovered ? PAL.W : PAL.C) : PAL.X;
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);

  if (button.enabled) {
    // Top and left highlight, bottom and right shadow.
    ctx.fillStyle = pressed ? PAL.P : PAL.W;
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
    ctx.fillRect(x + 1, y + 1, 1, h - 2);
    ctx.fillStyle = pressed ? PAL.W : PAL.P;
    ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
    ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
  } else {
    ctx.fillStyle = PAL.P;
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
    ctx.fillRect(x + 1, y + 1, 1, h - 2);
  }

  strokeRect(ctx, x, y, w, h, PAL.K);

  const color = button.enabled ? PAL.K : PAL.P;
  let textX = x + w / 2;
  let iconW = 0;

  if (button.icon) {
    const size = 14;
    iconW = size + 4;
    textX = x + w / 2 + iconW / 2;
  }

  const font = h >= 26 ? FONT.mid : FONT.small;
  drawText(ctx, button.label, textX, y + Math.round((h - 11) / 2), {
    font,
    color,
    align: 'center',
    maxWidth: w - 8 - iconW,
  });

  if (button.icon) {
    // Icons are drawn by the caller through the sprite set; this hook exists
    // so the icon and the label stay aligned.
    (button as Button & { iconRect?: Rect }).iconRect = {
      x: Math.round(textX - iconW / 2),
      y: Math.round(y + (h - 14) / 2),
      w: 14,
      h: 14,
    };
  }
}

/**
 * A resource readout: an icon and a number.
 *
 * Every resource in the game has a picture. A bare number with a label is
 * how the Godot build made the interface feel like a spreadsheet.
 */
export function drawResource(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteSet,
  icon: string,
  value: string,
  x: number,
  y: number,
  color: string = PAL.K,
  scale = 1
): number {
  const size = 14 * scale;
  const image = sprites.get(icon);
  if (image) {
    drawSprite(ctx, image, Math.round(x), Math.round(y), scale);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), size, size);
  }
  drawText(ctx, value, Math.round(x + size + 4), Math.round(y + 1 * scale), {
    font: FONT.mid,
    color,
  });
  const width = measureText(value, FONT.mid);
  return Math.round(x + size + 4 + width);
}

/** A progress bar with a label, used for goal progress and reel stats. */
export function drawBar(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  value: number,
  max: number,
  color: string,
  options: { bg?: string; label?: string } = {}
): void {
  const { bg = PAL.X, label } = options;
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);

  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const fill = Math.round(w * ratio);
  if (fill > 0) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, fill, h);
    // A lighter band along the top of the fill, so the bar has depth.
    // A solid palette colour, not an alpha wash: the palette is closed.
    ctx.fillStyle = PAL.W;
    ctx.fillRect(x, y, fill, 1);
  }

  strokeRect(ctx, x, y, w, h, PAL.K);

  if (label) {
    drawText(ctx, label, x + w / 2, y + Math.round((h - 9) / 2), {
      font: FONT.tiny,
      color: PAL.K,
      align: 'center',
      maxWidth: w - 4,
    });
  }
}

/**
 * A grade chip: the artefact's colour, its name, and how many there are.
 *
 * The colour never carries the meaning alone -- the grade's name is always
 * written next to it.
 */
export function drawGradeChip(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteSet,
  spriteName: string,
  grade: string,
  count: number,
  x: number,
  y: number,
  scale = 1
): number {
  const image = sprites.get(spriteName);
  const size = 18 * scale;
  if (image) {
    drawSprite(ctx, image, Math.round(x), Math.round(y), scale);
  }
  const text = `${grade} ×${count}`;
  drawText(ctx, text, Math.round(x + size + 4), Math.round(y + 2), {
    font: FONT.small,
    color: PAL.D,
  });
  return Math.round(x + size + 4 + measureText(text, FONT.small));
}

/**
 * A dithered gradient between two palette colours.
 *
 * A smooth canvas gradient interpolates to colours that are not in the
 * palette, which quietly breaks the promise that every pixel on screen
 * comes from the shared set. A pixel game dithers instead: the two
 * colours are interleaved in a checkerboard, and the density of each one
 * changes from band to band, so the eye reads a gradient while every
 * individual pixel is exactly one of the two.
 *
 * The dither is a 2x2 ordered pattern, which is the smallest pattern that
 * reads as a blend at 1x without shimmering.
 */
export function drawDitherGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  top: string,
  bottom: string,
  bands = 16
): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const width = Math.round(w);
  const height = Math.round(h);

  // The band height: how tall each step of the gradient is.
  const bandH = Math.max(1, Math.ceil(height / bands));

  for (let band = 0; band < bands; band++) {
    const bandY = y0 + band * bandH;
    const bandHeight = Math.min(bandH, y0 + height - bandY);
    if (bandHeight <= 0) break;

    // How far through the gradient this band sits: 0 at the top, 1 at the
    // bottom.
    const t = bands === 1 ? 0 : band / (bands - 1);

    // The number of rows in this band that are the BOTTOM colour. The
    // dither fills that fraction of the band's rows.
    const bottomRows = Math.round(bandHeight * t);

    for (let row = 0; row < bandHeight; row++) {
      const useBottom = row >= bandHeight - bottomRows;

      ctx.fillStyle = useBottom ? bottom : top;
      ctx.fillRect(x0, bandY + row, width, 1);

      // The transition row: interleave both colours in a checkerboard.
      if (
        useBottom &&
        bottomRows > 0 &&
        bottomRows < bandHeight &&
        row === bandHeight - bottomRows - 1
      ) {
        ctx.fillStyle = bottom;
        for (let i = 0; i < width; i += 2) {
          ctx.fillRect(x0 + i, bandY + row, 1, 1);
        }
      }
    }
  }
}

/** A row of tiny dots showing a probability or a share. */
export function drawSparkline(
  ctx: CanvasRenderingContext2D,
  values: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  if (values.length === 0) return;
  let max = 0;
  for (const v of values) max = Math.max(max, v);
  if (max <= 0) return;
  const step = Math.max(1, Math.floor(w / values.length));
  for (let i = 0; i < values.length; i++) {
    const barH = Math.max(1, Math.round((values[i] / max) * (h - 1)));
    ctx.fillStyle = color;
    ctx.fillRect(x + i * step, y + h - barH, Math.max(1, step - 1), barH);
  }
}

/** A tooltip-ish hint strip along the bottom of the screen. */
export function drawHint(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number
): void {
  drawText(ctx, text, x, y, { font: FONT.small, color: PAL.N, maxWidth: w });
}
