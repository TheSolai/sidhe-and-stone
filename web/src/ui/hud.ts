/**
 * The HUD: the persistent bar across the top of every screen.
 *
 * It carries the things the player must never have to hunt for: the money,
 * the day, the charms, luck, and what the gallery is currently paying.
 * The End Day button lives here too, because ending the day is the single
 * most frequent action in the game and it should never be more than one
 * click away.
 */

import { PAL } from './palette.ts';
import type { ScreenContext } from './screen.ts';
import { money } from './screen.ts';
import { drawPanel, drawText, FONT } from './widgets.ts';

export const HUD_HEIGHT = 58;

export interface HudLayout {
  endDayButton: { x: number; y: number; w: number; h: number };
}

/**
 * Draw the top bar and return where the End Day button sits.
 *
 * The resource readouts are spread across the bar in a fixed order so the
 * numbers do not jump around when their values change width.
 */
export function drawHud(ctx: ScreenContext): HudLayout {
  const g = ctx.surface.ctx;
  const { state } = ctx;
  const w = ctx.surface.canvas.width;

  drawPanel(g, { x: 0, y: 0, w, h: HUD_HEIGHT }, { fill: PAL.C, shadow: false });

  // A gold rule under the bar, to separate it from the scene.
  g.fillStyle = PAL.Y;
  g.fillRect(0, HUD_HEIGHT - 3, w, 2);
  g.fillStyle = PAL.K;
  g.fillRect(0, HUD_HEIGHT - 1, w, 1);

  let x = 14;

  // Day.
  drawText(g, `Day ${state.day()}`, x, 8, { font: FONT.mid, color: PAL.D });
  x += 78;

  // Money.
  drawText(g, money(state.money()), x, 8, { font: FONT.mid, color: PAL.A });
  x += 104;

  // Charms.
  drawText(g, `☘ ${state.charms()}`, x, 8, { font: FONT.mid, color: PAL.M });
  x += 62;

  // Luck.
  drawText(g, `Luck ${state.luck().toFixed(2)}`, x, 8, { font: FONT.mid, color: PAL.U });
  x += 96;

  // Demand: how many exhibits pay today.
  drawText(g, `Demand ${state.demand()}`, x, 8, { font: FONT.mid, color: PAL.L });
  x += 116;

  // Upkeep: the running cost of the outfit.
  drawText(g, `Upkeep ${money(state.upkeep())}`, x, 8, {
    font: FONT.mid,
    color: state.upkeep() > 0 ? PAL.T : PAL.N,
  });

  // The secondary row: counts that change less often, kept out of the way.
  const subY = 30;
  drawText(
    g,
    `Raw ${state.rawCount()}   Vault ${state.vaultCount()}   On show ${state.onDisplay()}/${state.gallerySlots()}`,
    14,
    subY,
    { font: FONT.small, color: PAL.N }
  );

  drawText(g, `Sites ${state.sites()}   Curators ${state.curators()}`, 300, subY, {
    font: FONT.small,
    color: PAL.N,
  });

  // The End Day button, right-aligned.
  const bw = 116;
  const bh = 34;
  const bx = w - bw - 14;
  const by = (HUD_HEIGHT - bh) / 2;

  g.fillStyle = PAL.Y;
  g.fillRect(bx, by, bw, bh);
  g.fillStyle = PAL.H;
  g.fillRect(bx + 1, by + 1, bw - 2, 1);
  g.fillStyle = PAL.A;
  g.fillRect(bx + 1, by + bh - 2, bw - 2, 1);
  g.fillStyle = PAL.K;
  g.fillRect(bx, by, bw, 1);
  g.fillRect(bx, by + bh - 1, bw, 1);
  g.fillRect(bx, by, 1, bh);
  g.fillRect(bx + bw - 1, by, 1, bh);

  drawText(g, 'End Day', bx + bw / 2, by + 10, {
    font: FONT.mid,
    color: PAL.K,
    align: 'center',
  });

  return { endDayButton: { x: bx, y: by, w: bw, h: bh } };
}

/**
 * The navigation strip.
 *
 * Eight screens, but the title screen has no entry here -- it is a separate
 * mode the player enters and leaves. The other seven are the working
 * screens of the museum.
 */
export interface NavButton {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const NAV_IDS = [
  'dig',
  'curator',
  'vault',
  'gallery',
  'reel',
  'ledger',
  'goals',
] as const;

export type NavId = (typeof NAV_IDS)[number];

export function drawNav(
  ctx: ScreenContext,
  active: string,
  buttons: NavButton[]
): void {
  const g = ctx.surface.ctx;
  const y = ctx.surface.canvas.height - 34;

  // The strip sits on a dark band so it reads as a separate layer.
  g.fillStyle = PAL.D;
  g.fillRect(0, y - 4, ctx.surface.canvas.width, 38);
  g.fillStyle = PAL.P;
  g.fillRect(0, y - 4, ctx.surface.canvas.width, 1);

  for (const b of buttons) {
    const isActive = b.id === active;
    g.fillStyle = isActive ? PAL.C : PAL.P;
    g.fillRect(b.x, b.y, b.w, b.h);

    if (isActive) {
      // The active tab is cream, with a gold cap so it reads as "current".
      g.fillStyle = PAL.W;
      g.fillRect(b.x + 1, b.y + 1, b.w - 2, 1);
      g.fillStyle = PAL.Y;
      g.fillRect(b.x, b.y, b.w, 3);
    }

    g.fillStyle = PAL.K;
    g.fillRect(b.x, b.y, 1, b.h);
    g.fillRect(b.x + b.w - 1, b.y, 1, b.h);

    drawText(g, b.label, b.x + b.w / 2, b.y + 11, {
      font: FONT.small,
      color: isActive ? PAL.K : PAL.C,
      align: 'center',
      maxWidth: b.w - 8,
    });
  }
}

/** The nav button geometry, laid out left to right. */
export function navLayout(canvasWidth: number, canvasHeight: number): NavButton[] {
  const labels: Record<NavId, string> = {
    dig: 'Dig Site',
    curator: 'Storeroom',
    vault: 'Vault',
    gallery: 'Gallery',
    reel: 'Fate Reel',
    ledger: 'Ledger',
    goals: 'Goals',
  };

  // The chips sit inside the dark band along the bottom edge. The band is
  // drawn 38px tall from the bottom, so the chips sit flush with its lower
  // edge -- the same place the clickable regions live.
  const h = 30;
  const y = canvasHeight - h;
  const gap = 4;
  const total = NAV_IDS.length;
  const w = 118;
  const totalWidth = total * w + (total - 1) * gap;
  const startX = Math.round((canvasWidth - totalWidth) / 2);

  return NAV_IDS.map((id, i) => ({
    id,
    label: labels[id],
    x: startX + i * (w + gap),
    y,
    w,
    h,
  }));
}
