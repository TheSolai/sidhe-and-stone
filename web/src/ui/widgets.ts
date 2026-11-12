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
import { SHADOW_OFFSET } from './bands.ts';
import {
  charAdvance,
  drawText,
  FONT,
  measureText,
  wrapText,
  type FontSpec,
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
    //
    // The offset comes from the band contract rather than being written
    // here, because the shadow is part of the layout: a panel at the
    // bottom of its band pushes its shadow past the band, and the
    // framework's hint line lives there.
    ctx.fillStyle = PAL.P;
    ctx.fillRect(x + SHADOW_OFFSET, y + SHADOW_OFFSET, w, h);
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
    // A panel title must fit INSIDE its panel. Silkscreen is a wide
    // face, and a title set at the mid size can run off the right edge
    // of a narrow panel and off the canvas entirely -- which is exactly
    // what happened to the reel's odds panel.
    //
    // The title is not cut: it is set at the largest size that fits, so
    // the words stay whole and the panel keeps its name.
    const titleFont = [FONT.mid, FONT.small, FONT.tiny].find(
      (f) => measureText(title, f) <= w - 24
    ) ?? FONT.tiny;
    drawText(ctx, title, x + 8, y + 6, { font: titleFont, color: PAL.D });
    const tw = Math.round(measureText(title, titleFont));
    ctx.fillStyle = PAL.P;
    // The rule starts on a whole pixel. A fractional x would make the
    // canvas anti-alias the edge of the rule, and that blended pixel is
    // a colour that is not in the palette.
    ctx.fillRect(x + 12 + tw, y + 5 + Math.round(titleFont.size * 0.35), Math.max(0, w - 24 - tw), 1);
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
/**
 * A small solid colour chip.
 *
 * This is how an accent hue survives on a cream panel. Measured against
 * the shared palette, gold is 1.40:1 on cream, moss 2.15:1 and rust
 * 3.04:1 -- all below the 4.5:1 floor for body text. So a coloured GLYPH
 * on paper is a legibility bug, but a coloured CHIP is not: it is a
 * graphic, and it reads as "rust means danger" at a glance.
 *
 * Every chip still has a shape, so the meaning never rests on colour
 * alone.
 */
export function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  size = 8
): void {
  const cx = Math.round(x);
  const cy = Math.round(y);
  ctx.fillStyle = color;
  ctx.fillRect(cx, cy, size, size);
  // A dark top-left edge, so the chip reads as a solid object rather
  // than a smear of colour.
  ctx.fillStyle = PAL.K;
  ctx.fillRect(cx, cy, size, 1);
  ctx.fillRect(cx, cy, 1, size);
}

/**
 * A coloured value, written in dark ink with a tint chip beside it.
 *
 * The ledger and the day summary both want to say "this number is good
 * news" or "this number is bad news" with a colour. Written as a glyph
 * that colour is unreadable -- moss on cream is 2.15:1, rust 3.04:1,
 * teal 1.23:1. So the ink carries the value and a small chip carries the
 * tint. Same information, legible.
 */
export function drawTintedValue(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    font: FontSpec;
    tint: string;
    align?: 'left' | 'right' | 'center';
    maxWidth?: number;
    chip?: boolean;
  }
): void {
  const { font, tint, align = 'left', maxWidth, chip = true } = options;
  const tw = measureText(text, font);
  const gap = chip ? 12 : 0;
  let tx = x;
  if (align === 'right') tx = x - tw;
  else if (align === 'center') tx = x - tw / 2;
  if (chip) {
    drawChip(ctx, tx - gap, y + Math.round((font.size - 8) / 2), tint);
  }
  drawText(ctx, text, tx, y, { font, color: PAL.D, align, maxWidth });
}

export function drawButton(
  ctx: CanvasRenderingContext2D,
  button: Button,
  pressed = false,
  hovered = false
): void {
  drawBevelButton(ctx, {
    rect: button.rect,
    label: button.label,
    enabled: button.enabled,
    pressed,
    hovered,
  });
}

/**
 * A bevelled 3D button, in the KairoSoft idiom.
 *
 * RULE 3.1: a raised button is a bevelled 3D rectangle -- a lighter edge
 * along the top and left, a darker edge along the bottom and right.
 *
 * RULE 3.2: the bevel is ONE pixel at 1x and the face is FLAT. There is
 * no gradient on the face, because a gradient is a smooth blend and the
 * palette is closed: every pixel on screen is one of the palette's
 * colours, and a gradient would put hundreds of others on the canvas.
 *
 * RULE 3.6: on press the bevel INVERTS -- the light edge moves to the
 * bottom and right -- so the button sinks instead of fading.
 *
 * RULE 3.7: the primary action gets its own face (gold) so it reads as
 * different from the secondary buttons around it.
 *
 * The icon, when there is one, is on the LEADING side of the label
 * (RULE 2.6 / RULE 7.3).
 */
export interface BevelButtonSpec {
  rect: Rect;
  label: string;
  enabled?: boolean;
  /** Gold face: the primary action. */
  primary?: boolean;
  /** A sprite name, drawn on the leading side of the label. */
  icon?: string;
  /** The sprite set the icon is looked up in. */
  sprites?: SpriteSet;
  pressed?: boolean;
  hovered?: boolean;
  /** The font to write the label in. Defaults by button height. */
  font?: FontSpec;
}

export function drawBevelButton(
  ctx: CanvasRenderingContext2D,
  spec: BevelButtonSpec
): void {
  const { rect } = spec;
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);

  const enabled = spec.enabled !== false;
  const pressed = enabled && spec.pressed === true;
  const primary = spec.primary === true;

  // The face, and the two edges that make it read as a solid object.
  const face = enabled ? (primary ? PAL.Y : PAL.C) : PAL.X;
  const light = enabled ? (primary ? PAL.H : PAL.W) : PAL.P;
  const dark = enabled ? (primary ? PAL.A : PAL.P) : PAL.P;

  ctx.fillStyle = face;
  ctx.fillRect(x, y, w, h);

  // The bevel: light along the top and left, dark along the bottom and
  // right -- or the other way round when the button is pressed.
  ctx.fillStyle = pressed ? dark : light;
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  ctx.fillRect(x + 1, y + 1, 1, h - 2);
  ctx.fillStyle = pressed ? light : dark;
  ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
  ctx.fillRect(x + w - 2, y + 1, 1, h - 2);

  // The hard outline that keeps the button off the surface behind it.
  strokeRect(ctx, x, y, w, h, PAL.K);

  const ink = enabled ? PAL.K : PAL.P;
  const font = spec.font ?? (h >= 30 ? FONT.mid : FONT.small);
  const labelW = measureText(spec.label, font);

  // The icon, when there is one, is a real sprite on the leading side.
  const image = spec.icon && spec.sprites ? spec.sprites.get(spec.icon) : undefined;
  const iconSize = 18;
  const iconW = image ? iconSize + 4 : 0;

  const groupW = iconW + labelW;
  const groupX = Math.round(x + (w - groupW) / 2);
  const textX = groupX + iconW;
  const textY = y + Math.round((h - font.size) / 2) - (pressed ? 1 : 0);

  drawText(ctx, spec.label, textX, textY, {
    font,
    color: ink,
    maxWidth: Math.max(8, w - 8 - iconW),
  });

  if (image) {
    drawSprite(
      ctx,
      image,
      groupX,
      y + Math.round((h - iconSize) / 2) - (pressed ? 1 : 0),
      1
    );
  }
}

/**
 * A small numeric badge: a solid yellow square with a dark number.
 *
 * RULE 7.2: a badge on an icon button shows a pending count. It is a
 * graphic, not a glyph of its own, so the number inside it is dark ink
 * on gold -- which is a legible pair -- rather than a colour that means
 * "attention" on its own.
 *
 * RULE 7.5: yellow is the badge colour, and nowhere else.
 */
export function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number
): void {
  if (count <= 0) return;
  const bx = Math.round(x);
  const by = Math.round(y);
  const size = 11;

  ctx.fillStyle = PAL.Y;
  ctx.fillRect(bx, by, size, size);
  strokeRect(ctx, bx, by, size, size, PAL.K);

  const text = count > 99 ? '99+' : String(count);
  drawText(ctx, text, bx + size / 2, by + 2, {
    font: FONT.tiny,
    color: PAL.K,
    align: 'center',
  });
}

/**
 * A pixel-rounded rectangle.
 *
 * The canvas has rounded-rect primitives, but they are drawn with arcs,
 * and an arc is anti-aliased: the edge pixels are blends, and a blend is
 * a colour that is not in the palette. So the rounding is done by hand,
 * one whole-pixel row at a time.
 */
function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string
): void {
  const radius = Math.max(0, Math.min(r, Math.floor(Math.min(w, h) / 2)));
  ctx.fillStyle = color;
  for (let row = 0; row < h; row += 1) {
    let inset = 0;
    if (radius > 0) {
      let d = 0;
      if (row < radius) d = radius - row - 0.5;
      else if (row >= h - radius) d = radius - (h - 1 - row) - 0.5;
      if (d > 0) inset = radius - Math.floor(Math.sqrt(Math.max(0, radius * radius - d * d)));
    }
    ctx.fillRect(x + inset, y + row, w - inset * 2, 1);
  }
}

/**
 * A white pill: the header shape a Kairosoft modal carries.
 *
 * RULE 5.2: every modal has a header in its own shape -- a white pill
 * inside the frame -- and RULE 5.5: the frame itself is a single strong
 * accent colour, and the interior stays quiet.
 */
export function drawPixelPill(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  fill: string = PAL.W,
  border: string = PAL.K,
  radius = 6
): void {
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);

  // The outline is the same shape, one pixel larger all round.
  fillRoundRect(ctx, x - 1, y - 1, w + 2, h + 2, radius + 1, border);
  fillRoundRect(ctx, x, y, w, h, radius, fill);
}

/**
 * A centred modal panel.
 *
 * RULE 5.1: a centred modal over a dimmed backdrop, never a slide-up
 * bottom sheet.
 *
 * RULE 5.2: a white-pill header, and a footer action row.
 *
 * RULE 5.5: ONE accent colour for the whole frame -- the thick border --
 * with a quiet cream interior.
 */
export interface ModalSpec {
  rect: Rect;
  title: string;
  /** The single accent colour of the frame. */
  accent?: string;
}

export interface ModalFrame {
  /** Where the body content goes, under the header pill. */
  content: Rect;
  /** The top of the footer action row. */
  footerTop: number;
}

export function drawModal(ctx: CanvasRenderingContext2D, spec: ModalSpec): ModalFrame {
  const x = Math.round(spec.rect.x);
  const y = Math.round(spec.rect.y);
  const w = Math.round(spec.rect.w);
  const h = Math.round(spec.rect.h);
  const accent = spec.accent ?? PAL.E;
  const border = 3;

  // The thick, single-colour frame.
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, w, h);

  // The quiet interior.
  ctx.fillStyle = PAL.C;
  ctx.fillRect(x + border, y + border, w - border * 2, h - border * 2);

  // The white-pill header.
  const titleW = Math.round(measureText(spec.title, FONT.mid));
  const pillW = Math.min(w - border * 2 - 16, titleW + 28);
  const pillH = 22;
  const pillX = x + Math.round((w - pillW) / 2);
  const pillY = y + border + 8;
  drawPixelPill(ctx, { x: pillX, y: pillY, w: pillW, h: pillH });
  drawText(ctx, spec.title, pillX + pillW / 2, pillY + 5, {
    font: FONT.mid,
    color: PAL.K,
    align: 'center',
    maxWidth: pillW - 12,
  });

  // The rule under the header, so the body is clearly the body.
  ctx.fillStyle = PAL.P;
  ctx.fillRect(x + border + 8, pillY + pillH + 6, w - border * 2 - 16, 1);

  const contentTop = pillY + pillH + 14;
  const footerTop = y + h - border - 46;

  return {
    content: {
      x: x + border + 8,
      y: contentTop,
      w: w - border * 2 - 16,
      h: Math.max(0, footerTop - contentTop - 6),
    },
    footerTop,
  };
}

/**
 * A stat row inside a modal.
 *
 * RULE 5.3: the rows of a modal table alternate between two quiet
 * fills, so a column of numbers can be scanned.
 *
 * RULE 10.1: a thin coloured block at the LEADING edge is the row's
 * icon column. It is a graphic, never the only carrier of the meaning
 * (RULE 4.5) -- the label says what the row is.
 *
 * RULE 10.5: the value is right-aligned, so the numbers line up.
 */
export interface ModalRowSpec {
  label: string;
  value: string;
  /** The colour of the leading block. */
  tint?: string;
  /** The row's fill. Alternate this between two quiet colours. */
  fill?: string;
  /** Draw the value in this colour instead of the default ink. */
  valueColor?: string;
  /** The font of the label and the value. */
  font?: FontSpec;
  /**
   * A sprite drawn just before the value.
   *
   * RULE 4.6: the icon carries the unit, so a money figure is a coin and
   * a number rather than a number and a currency mark.
   */
  icon?: string;
  sprites?: SpriteSet;
}

export function drawModalRow(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  spec: ModalRowSpec
): void {
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);
  const font = spec.font ?? FONT.body;

  ctx.fillStyle = spec.fill ?? PAL.W;
  ctx.fillRect(x, y, w, h);

  // The leading block: the row's colour, as a plate rather than a tint
  // on the text.
  ctx.fillStyle = spec.tint ?? PAL.K;
  ctx.fillRect(x, y, 6, h);

  drawText(ctx, spec.label, x + 14, y + Math.round((h - font.size) / 2), {
    font,
    color: PAL.D,
    maxWidth: w - 100,
  });

  // The value, right-aligned, with the coin in front of it when the row
  // is a money row.
  const valueW = Math.round(measureText(spec.value, font));
  const image = spec.icon && spec.sprites ? spec.sprites.get(spec.icon) : undefined;
  const iconW = image ? 18 + 3 : 0;

  drawText(ctx, spec.value, x + w - 10, y + Math.round((h - font.size) / 2), {
    font,
    color: spec.valueColor ?? PAL.K,
    align: 'right',
    maxWidth: w - 90,
  });

  if (image) {
    drawSprite(ctx, image, x + w - 10 - valueW - iconW, y + Math.round((h - 18) / 2), 1);
  }
}

/**
 * A speech bubble.
 *
 * RULE 5.6: character speech is a white bubble with a thin dark outline
 * and a small tail pointing at the speaker. System messages are never in
 * a bubble -- they live in the HUD, in a panel, or in a banner.
 */
export function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  text: string,
  tailAt: number,
  tailDir: 'down' | 'left' = 'down'
): void {
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);

  if (tailDir === 'left') {
    // The tail points LEFT, at a speaker who stands BESIDE the bubble.
    //
    // The downward tail used to be the only kind, and the curator's
    // bubble sits to the RIGHT of the curator, so the tail had to be
    // clamped to the bubble's own left edge and pointed at nothing. The
    // rule says the tail points AT THE SPEAKER, so when the speaker is
    // beside the bubble the tail has to point sideways.
    //
    // `tailAt` is the speaker's Y, because that is the axis a sideways
    // tail slides along.
    const ty = Math.round(Math.max(y + 6, Math.min(y + h - 7, tailAt)));
    // The tail leaves the bubble's left wall and tapers to a point.
    const reach = 6;
    for (let i = 0; i < reach; i += 1) {
      const col = x - 1 - i;
      const half = 4 - i;
      ctx.fillStyle = PAL.K;
      ctx.fillRect(col, ty - half, 1, half * 2 + 1);
    }
    // The white inside of the tail, so it reads as one shape with the
    // bubble rather than as a black wedge stuck on the side.
    for (let i = 1; i < reach; i += 1) {
      const col = x - 1 - i;
      const half = 3 - i;
      ctx.fillStyle = PAL.W;
      ctx.fillRect(col, ty - half, 1, half * 2 + 1);
    }
  } else {
    // The tail: a three-step triangle pointing down at the speaker.
    const tx = Math.round(Math.max(x + 6, Math.min(x + w - 12, tailAt)));
    ctx.fillStyle = PAL.K;
    ctx.fillRect(tx - 5, y + h - 1, 11, 1);
    ctx.fillRect(tx - 3, y + h, 7, 1);
    ctx.fillRect(tx - 1, y + h + 1, 3, 1);
    ctx.fillStyle = PAL.W;
    ctx.fillRect(tx - 4, y + h, 9, 1);
    ctx.fillRect(tx - 2, y + h + 1, 5, 1);
    ctx.fillRect(tx, y + h + 2, 1, 1);
  }

  // The bubble itself.
  fillRoundRect(ctx, x - 1, y - 1, w + 2, h + 2, 6, PAL.K);
  fillRoundRect(ctx, x, y, w, h, 5, PAL.W);

  // The words WRAP inside the bubble rather than being cut.
  //
  // Silkscreen is a wide face: "The storeroom is clear." is 242 pixels
  // and the bubble was 210, so the curator's line was cut at "The
  // storeroom is clear.…" -- which is a bubble saying nothing. A bubble
  // with room for two lines says the whole thing.
  const innerW = w - 16;
  const lines = wrapText(text, innerW, FONT.body);
  const step = FONT.body.size + 2;
  const blockH = lines.length * step;
  const startY = y + Math.round((h - blockH) / 2);
  lines.forEach((line, i) => {
    drawText(ctx, line, x + 8, startY + i * step, {
      font: FONT.body,
      color: PAL.D,
    });
  });
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
 * Dim the screen behind a modal panel, using only palette colours.
 *
 * An alpha-blended black rectangle puts blended colours on screen that
 * are not in the shared palette, which breaks the promise that every pixel
 * comes from the palette. A pixel game dims with a dither instead: two
 * palette colours interleaved in a checkerboard read as a veil at 1x, and
 * every individual pixel is exactly one of the two.
 *
 * `dark` is the colour of the veil's squares, `light` the colour showing
 * through. Two palettes of square size 2 keep the pattern from shimmering
 * when the canvas is upscaled.
 */
export function drawVeil(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dark: string,
  light: string,
  density = 2
): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const width = Math.round(w);
  const height = Math.round(h);
  const step = Math.max(1, Math.round(density));

  ctx.fillStyle = light;
  ctx.fillRect(x0, y0, width, height);

  ctx.fillStyle = dark;
  for (let py = 0; py < height; py += step) {
    for (let px = 0; px < width; px += step) {
      // The checkerboard: only the squares on one diagonal take the dark
      // colour, so half the veil is covered.
      if (((px / step) + (py / step)) % 2 === 0) {
        ctx.fillRect(x0 + px, y0 + py, step, step);
      }
    }
  }
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
  drawText(ctx, text, x, y, { font: FONT.small, color: PAL.P, maxWidth: w });
}

/**
 * The shamrock.
 *
 * Silkscreen has no shamrock, and a shamrock is not a letter -- it is a
 * PIECE OF THINGS, like the coin and the charm, so it is drawn as the
 * `symbol_clover` sprite and takes the room the sprite takes. The
 * character stays in the DATA (the ledger says "3 shamrocks" as
 * "3<clover>"), because the simulation and the Godot build agree on
 * that string; it is only the drawing that changes.
 */
const CLOVER = '\u2618';

/** The width the clover sprite takes in a line of text. */
const CLOVER_W = 18;

/**
 * The width of a line that mixes glyphs and sprites.
 */
export function measureRichText(
  text: string,
  font: FontSpec = FONT.body
): number {
  const parts = text.split(CLOVER);
  let width = (parts.length - 1) * CLOVER_W;
  for (const part of parts) width += measureText(part, font);
  return width;
}

export interface RichTextOptions {
  font?: FontSpec;
  color?: string;
  shadow?: string | null;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
}

/**
 * Draw a line of text in which a sprite stands in for a character.
 *
 * The line is cut exactly the way glyph-only text is cut -- same
 * advances, same ellipsis -- so a line that mixes the two measures and
 * truncates like one thing rather than two.
 */
export function drawRichText(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteSet,
  text: string,
  x: number,
  y: number,
  options: RichTextOptions = {}
): void {
  const {
    font = FONT.body,
    color = PAL.K,
    shadow = PAL.K,
    align = 'left',
    maxWidth,
  } = options;

  // Cut the line down to what fits, counting the clover as the sprite
  // it is going to be.
  let shown = text;
  if (maxWidth !== undefined && measureRichText(text, font) > maxWidth) {
    const ellipsisWidth = measureText('…', font);
    let width = 0;
    let cut = '';
    for (const ch of text) {
      const next = width + (ch === CLOVER ? CLOVER_W : charAdvance(ch, font));
      if (next + ellipsisWidth > maxWidth) break;
      width = next;
      cut += ch;
    }
    shown = cut + '…';
  }

  const total = measureRichText(shown, font);
  let pen = Math.round(x);
  if (align === 'center') pen = Math.round(x - total / 2);
  else if (align === 'right') pen = Math.round(x - total);

  const parts = shown.split(CLOVER);
  parts.forEach((part, i) => {
    if (i > 0) {
      // The sprite is eighteen tall and the text sixteen, so the sprite
      // is nudged up by a pixel to sit on the same line.
      const clover = sprites.get('symbol_clover');
      if (clover) {
        drawSprite(ctx, clover, pen, Math.round(y) - 1, 1);
      }
      pen += CLOVER_W;
    }
    if (!part) return;
    const width = measureText(part, font);
    drawText(ctx, part, pen, y, { font, color, shadow });
    pen += width;
  });
}

/**
 * A paragraph: text that is WRAPPED rather than cut.
 *
 * The bitmap face is wider than the face the layout was written
 * against, so a sentence that used to sit on one line now sits on two.
 * Cutting the sentence would lose the end of it, so the lines are
 * broken instead, and the whole sentence is still on the screen.
 *
 * Returns the height the paragraph took, so the caller can put the
 * next thing below it.
 */
export function drawParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    font?: FontSpec;
    color?: string;
    shadow?: string | null;
    align?: 'left' | 'center' | 'right';
    maxWidth: number;
    /** The distance between the tops of two lines. */
    lineHeight?: number;
  }
): number {
  const {
    font = FONT.body,
    color = PAL.K,
    shadow = PAL.K,
    align = 'left',
    maxWidth,
    lineHeight,
  } = options;

  const step = lineHeight ?? font.size + 4;
  const lines = wrapText(text, maxWidth, font);
  lines.forEach((line, i) => {
    drawText(ctx, line, x, y + i * step, { font, color, shadow, align });
  });
  return lines.length * step;
}

/**
 * A right-pointing arrow, drawn as a shape.
 *
 * The old face had an arrow character. Silkscreen does not, and an
 * arrow is a MARK rather than a letter: it is drawn here, in whole
 * pixels, in a palette colour, so it stays crisp and stays inside the
 * palette.
 */
export function drawArrowRight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  scale = 1
): number {
  const w = 9 * scale;
  const h = 7 * scale;
  ctx.fillStyle = color;
  // The head, three steps in from the tip.
  for (let i = 0; i < 3; i++) {
    const inset = (2 - i) * scale;
    ctx.fillRect(
      Math.round(x + w - scale - inset),
      Math.round(y + i * scale),
      scale,
      scale
    );
    ctx.fillRect(
      Math.round(x + w - scale - inset),
      Math.round(y + h - scale - i * scale),
      scale,
      scale
    );
  }
  // The shaft.
  ctx.fillRect(
    Math.round(x),
    Math.round(y + Math.floor(h / 2)),
    Math.round(w - 2 * scale),
    scale
  );
  return w;
}
