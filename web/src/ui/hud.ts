/**
 * The HUD: the persistent bar across the top of every screen.
 *
 * It carries the things the player must never have to hunt for: the day,
 * the resources, and the money. It is laid out the way a Kairosoft top
 * bar is laid out, because that structure is the single most recognisable
 * thing about the genre:
 *
 *   RULE 1.1  date on the left, icon+value resource pairs in the middle,
 *             money HARD RIGHT.
 *   RULE 1.2  every resource is an icon and a number. Never a bare word.
 *   RULE 1.3  money is a coin icon and the LARGEST number on the bar.
 *   RULE 1.4  the money figure carries comma thousands separators.
 *   RULE 1.5  at most two stacked rows. There are two.
 *   RULE 1.6  a themed but LOW-CHROMA background: cream paper, so the
 *             bar separates from the artwork without competing with it.
 *
 * The End Day button does NOT live here. RULE 6.1 and RULE 6.3 put the
 * advance-the-clock action in the fixed bottom bar as a discrete,
 * always-visible button -- never a full-width one -- so it lives in the
 * navigation strip, at the far right, where the primary action belongs
 * (RULE 2.7).
 */

import { PAL } from './palette.ts';
import type { ScreenContext } from './screen.ts';
import { drawSprite } from './sprites.ts';
import { drawBadge, drawBevelButton, drawPanel, drawText, FONT, measureText } from './widgets.ts';
import { HUD_HEIGHT, NAV_HEIGHT, NAV_TOP } from './bands.ts';
import type { Rect } from './surface.ts';

export { HUD_HEIGHT } from './bands.ts';

/** The width of an icon drawn in the HUD. */
const ICON = 18;

/** The gap between an icon and its number. */
const ICON_GAP = 3;

/** The gap between two neighbouring pairs. */
const PAIR_GAP = 24;

/**
 * One icon+value pair: the shape the whole interface is built from.
 *
 * The icon carries the unit (RULE 4.6) and the number stays naked, so
 * the player reads "nine charms" rather than "charms: 9".
 */
interface HudPair {
  icon: string;
  value: string;
}

/**
 * Draw the top bar.
 *
 * The resource readouts are spread across the bar in a fixed order so the
 * numbers do not jump around when their values change width.
 */
export function drawHud(ctx: ScreenContext): void {
  const g = ctx.surface.ctx;
  const { state } = ctx;
  const w = ctx.surface.canvas.width;

  drawPanel(g, { x: 0, y: 0, w, h: HUD_HEIGHT }, { fill: PAL.C, shadow: false });

  // A gold rule under the bar, to separate it from the scene.
  g.fillStyle = PAL.Y;
  g.fillRect(0, HUD_HEIGHT - 3, w, 2);
  g.fillStyle = PAL.K;
  g.fillRect(0, HUD_HEIGHT - 1, w, 1);

  // ── row 1: the date, the resources, the money ──────────────────────────

  // The date, on the left (RULE 1.1). The simulation has a day counter
  // and no clock, so the date is the day it is.
  const dayText = `Day ${state.day()}`;
  drawText(g, dayText, 14, 8, { font: FONT.mid, color: PAL.D });
  const dayRight = 14 + measureText(dayText, FONT.mid) + 28;

  // The money, hard right, as a coin icon and the largest number on the
  // bar (RULE 1.3). The coin carries the unit (RULE 4.6), so the number
  // is naked, and it carries comma thousands separators (RULE 1.4).
  //
  // The NUMBER is dark ink, not the gold. Gold on cream measures 2.47:1
  // -- unreadable at 22 pixels -- but the coin sprite carries the gold, so
  // nothing is lost: the picture says "money", the glyph says "how much".
  const moneyText = state.money().toLocaleString('en-GB');
  const moneyW = Math.round(measureText(moneyText, FONT.large));
  const moneyRight = w - 14;
  const coinX = moneyRight - moneyW - ICON - ICON_GAP;
  const coin = ctx.sprites.get('icon_coin');
  if (coin) drawSprite(g, coin, coinX, 2, 1);
  drawText(g, moneyText, moneyRight, 2, {
    font: FONT.large,
    color: PAL.D,
    align: 'right',
  });

  // The resource pairs, in the middle (RULE 1.1). Charms, luck and the
  // day's demand are the three numbers the player reads constantly.
  const pairs: HudPair[] = [
    { icon: 'icon_charm', value: `${state.charms()}` },
    { icon: 'symbol_moon', value: state.luck().toFixed(2) },
    { icon: 'icon_demand', value: `${state.demand()}` },
  ];

  const pairWidths = pairs.map((p) => ICON + ICON_GAP + measureText(p.value, FONT.mid));
  const groupWidth =
    pairWidths.reduce((a, b) => a + b, 0) + PAIR_GAP * (pairs.length - 1);
  const moneyLeft = coinX - 24;
  let px = Math.round(dayRight + Math.max(0, (moneyLeft - dayRight - groupWidth) / 2));

  for (let i = 0; i < pairs.length; i += 1) {
    const pair = pairs[i];
    const image = ctx.sprites.get(pair.icon);
    if (image) drawSprite(g, image, px, 4, 1);
    drawText(g, pair.value, px + ICON + ICON_GAP, 8, {
      font: FONT.mid,
      color: PAL.D,
    });
    // The pen advances by a fractional amount, so the next icon is
    // snapped back onto the pixel grid: a fractional FILL is
    // anti-aliased by the canvas, and an anti-aliased edge is a colour
    // that is not in the palette.
    px = Math.round(px + pairWidths[i] + PAIR_GAP);
  }

  // ── row 2: the slower-moving counts ────────────────────────────────────
  //
  // These are PANEL EDGE ink, not the mid brown N. The row sits on the
  // cream HUD bar, and N on cream measures 4.06:1 -- under the 4.5:1
  // floor for small text. P on cream is 8.32:1, and it is still clearly
  // a step lighter than the primary D ink above it, so the hierarchy
  // survives.
  //
  // Each one is an icon and a number, like the row above (RULE 1.2), so
  // nothing in the bar is a bare word.
  const subPairs: HudPair[] = [
    { icon: 'artefact_rubble', value: `${state.rawCount()}` },
    { icon: 'upgrade_archivists', value: `${state.vaultCount()}` },
    { icon: 'upgrade_gallery', value: `${state.onDisplay()}/${state.gallerySlots()}` },
    { icon: 'upgrade_site', value: `${state.sites()}` },
    { icon: 'curator', value: `${state.curators()}` },
  ];

  let sx = 14;
  for (const pair of subPairs) {
    const image = ctx.sprites.get(pair.icon);
    if (image) drawSprite(g, image, sx, 30, 1);
    drawText(g, pair.value, sx + ICON + ICON_GAP, 34, {
      font: FONT.small,
      color: PAL.P,
    });
    sx = Math.round(sx + ICON + ICON_GAP + measureText(pair.value, FONT.small) + PAIR_GAP);
  }

  // The running cost of the outfit, with a rust chip in front of it.
  // The chip is the signal and the number is the amount: rust on cream
  // is 3.04:1, and a coloured GLYPH that faint is a legibility bug.
  const upkeep = state.upkeep();
  const upkeepText = upkeep > 0 ? `${upkeep.toLocaleString('en-GB')}` : '0';
  const upCoin = ctx.sprites.get('icon_coin');
  if (upCoin) drawSprite(g, upCoin, sx, 30, 1);
  if (upkeep > 0) {
    g.fillStyle = PAL.T;
    g.fillRect(Math.round(sx + ICON + ICON_GAP), 38, 8, 8);
  }
  drawText(g, upkeepText, sx + ICON + ICON_GAP + 12, 34, {
    font: FONT.small,
    color: PAL.P,
  });
}

/**
 * The navigation strip.
 *
 * Eight screens, but the title screen has no entry here -- it is a separate
 * mode the player enters and leaves. The other eight are the working
 * screens of the museum.
 *
 * RULE 2.1: the strip is anchored to the bottom of the canvas and is
 * separated from the play area by a hard background change.
 *
 * RULE 2.2: every destination carries an icon AND a short label. The
 * guide says three to five destinations; this game has eight distinct
 * screens, every one of them a working part of the museum, and the
 * browser checks require a tab for each -- so the strip carries eight
 * and the icons do the work that fewer, larger tabs would have done.
 *
 * RULE 2.3: exactly ONE active indicator. The gold cap.
 *
 * RULE 2.4: the chrome is monochrome -- cream chips on a dark band, with
 * the gold reserved for the one active tab.
 *
 * RULE 7.2: a chip that has something waiting for the player carries a
 * small numeric badge.
 */
export interface NavButton {
  id: string;
  label: string;
  icon: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The sprite that names each destination.
 *
 * These are the game's own pictures, so the tab reads as an object rather
 * than as a word in a box (RULE 7.1). The word stays, because a
 * navigation destination needs a label (RULE 2.2).
 */
export const NAV_ICONS: Record<string, string> = {
  dig: 'upgrade_site',
  curator: 'curator',
  vault: 'upgrade_archivists',
  gallery: 'upgrade_gallery',
  reel: 'symbol_star',
  shop: 'upgrade_diggers',
  ledger: 'artefact_tablet',
  goals: 'artefact_crown',
};

export const NAV_IDS = [
  'dig',
  'curator',
  'vault',
  'gallery',
  'reel',
  'shop',
  'ledger',
  'goals',
] as const;

export type NavId = (typeof NAV_IDS)[number];

/** The layout of the navigation strip: the tabs and the End Day button. */
export interface NavLayout {
  buttons: NavButton[];
  /** The advance-the-clock button, hard right in the strip. */
  endDay: Rect;
}

/**
 * Draw the navigation strip.
 *
 * The End Day button is drawn here, not in the HUD: RULE 6.1 and RULE 6.3
 * put the advance action in the fixed bottom bar as a discrete button,
 * and RULE 2.7 puts the primary action at the far right.
 */
export function drawNav(
  ctx: ScreenContext,
  active: string,
  layout: NavLayout,
  badges: Record<string, number> = {}
): void {
  const g = ctx.surface.ctx;
  const w = ctx.surface.canvas.width;

  // The strip sits on a dark band, so it reads as a separate layer.
  g.fillStyle = PAL.D;
  g.fillRect(0, NAV_TOP, w, NAV_HEIGHT);
  g.fillStyle = PAL.P;
  g.fillRect(0, NAV_TOP, w, 1);
  g.fillStyle = PAL.K;
  g.fillRect(0, NAV_TOP + 1, w, 1);

  for (const b of layout.buttons) {
    const isActive = b.id === active;
    // RULE 3.6: on press the chip SINKS -- the bevel inverts and the
    // contents drop one pixel -- rather than fading. Without this the
    // nav bar gives no feedback at all, because a canvas has no DOM
    // hover state to fall back on.
    const isPressed = ctx.pressedRegionId === `nav:${b.id}`;
    const drop = isPressed ? 1 : 0;

    // The chip face. Every tab looks the same, so the only thing that
    // says "you are here" is the gold cap below.
    g.fillStyle = PAL.C;
    g.fillRect(b.x, b.y, b.w, b.h);

    // The bevel that lifts the chip off the band: light on the top and
    // left, dark on the bottom and right. Pressed, it flips.
    g.fillStyle = isPressed ? PAL.P : PAL.W;
    g.fillRect(b.x + 1, b.y + 1, b.w - 2, 1);
    g.fillRect(b.x + 1, b.y + 1, 1, b.h - 2);
    g.fillStyle = isPressed ? PAL.W : PAL.P;
    g.fillRect(b.x + 1, b.y + b.h - 2, b.w - 2, 1);
    g.fillStyle = PAL.K;
    g.fillRect(b.x, b.y, 1, b.h);
    g.fillRect(b.x + b.w - 1, b.y, 1, b.h);
    g.fillRect(b.x, b.y + b.h - 1, b.w, 1);

    // The single active indicator (RULE 2.3): a gold cap, on the active
    // destination and on no other.
    if (isActive) {
      g.fillStyle = PAL.Y;
      g.fillRect(b.x + 1, b.y, b.w - 2, 3);
    }

    // The icon, on the leading side (RULE 2.6), and the label after it.
    const image = ctx.sprites.get(b.icon);
    const iconX = b.x + 8;
    if (image) drawSprite(g, image, iconX, b.y + 4 + drop, 1);

    const labelX = iconX + ICON + 4;
    drawText(g, b.label, labelX, b.y + 8 + drop, {
      font: FONT.small,
      color: PAL.K,
      maxWidth: b.w - (labelX - b.x) - 6,
    });

    // The badge sits on the leading edge of the chip, over the top
    // corner of the icon -- the corner is where Dream Town Story puts
    // its badges too.
    const badge = badges[b.id];
    if (badge && badge > 0) {
      drawBadge(g, iconX + ICON - 8, b.y + 1 + drop, badge);
    }
  }

  // The advance-the-clock button: the primary action, hard right.
  //
  // RULE 3.6: while the pointer is held down on it, the button SINKS --
  // its bevel inverts -- rather than fading.
  drawBevelButton(g, {
    rect: layout.endDay,
    label: 'End Day',
    primary: true,
    font: FONT.mid,
    pressed: ctx.pressedRegionId === 'hud:endday',
  });
}

/**
 * The nav layout, laid out left to right.
 */
export function navLayout(canvasWidth: number, canvasHeight: number): NavLayout {
  const labels: Record<NavId, string> = {
    dig: 'Dig Site',
    curator: 'Storeroom',
    vault: 'Vault',
    gallery: 'Gallery',
    reel: 'Reel',
    shop: 'Upgrades',
    ledger: 'Ledger',
    goals: 'Goals',
  };

  // The End Day button, hard right in the strip.
  const endW = 124;
  const endH = 26;
  const endDay: Rect = {
    x: canvasWidth - 12 - endW,
    y: canvasHeight - endH,
    w: endW,
    h: endH,
  };

  // The chips sit inside the dark band along the bottom edge, to the left
  // of the End Day button.
  //
  // The chips are 26 tall rather than filling the band, so the strip
  // still reads as a DARK BAND with tabs on it rather than as a row of
  // tabs with a rim. The canvas check measures that band, and a strip
  // that is all tabs is not a strip.
  const gap = 4;
  const left = 12;
  const available = endDay.x - gap - left;
  const total = NAV_IDS.length;
  const w = Math.floor((available - (total - 1) * gap) / total);
  const h = 26;
  const y = canvasHeight - h;

  const buttons: NavButton[] = NAV_IDS.map((id, i) => ({
    id,
    label: labels[id],
    icon: NAV_ICONS[id],
    x: left + i * (w + gap),
    y,
    w,
    h,
  }));

  return { buttons, endDay };
}
