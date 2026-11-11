/**
 * The Gallery screen.
 *
 * The museum floor as the visitor sees it. This screen exists mostly so the
 * player can SEE what they have built: the display cases, the artefacts on
 * them, the visitors walking through.
 *
 * It is the payoff screen. The Vault is where decisions are made; the
 * Gallery is where the player goes to look at the result.
 */

import { PAL, GRADES, GRADE_SPRITE } from '../palette.ts';
import type { Region, Screen, ScreenContext } from '../screen.ts';
import { moneyNumber } from '../screen.ts';
import { drawSprite, drawSpriteCentred } from '../sprites.ts';
import { drawPanel, drawText, drawChip, FONT, measureText } from '../widgets.ts';
import { FOOTER_PANEL_HEIGHT, FOOTER_TOP, MARGIN_X, PANEL_WIDTH } from '../bands.ts';

export class GalleryScreen implements Screen {
  public readonly id = 'gallery';
  public readonly label = 'Gallery';

  /** The plinth the pointer is over. */
  private hoverPlinth = -1;

  public layout(ctx: ScreenContext): Region[] {
    const g = ctx.surface.ctx;
    const { state } = ctx;
    const regions: Region[] = [];
    const w = ctx.surface.canvas.width;

    const floorY = 92;
    const floorH = 294;

    drawPanel(g, { x: 20, y: floorY, w: w - 40, h: floorH }, {
      fill: PAL.C,
      title: 'The gallery floor',
    });

    // The room: a warm back wall, a floor, and a skirting.
    const roomX = 30;
    const roomY = floorY + 34;
    const roomW = w - 60;
    const roomH = floorH - 50;

    g.fillStyle = PAL.W;
    g.fillRect(roomX, roomY, roomW, roomH - 60);
    g.fillStyle = PAL.Z;
    g.fillRect(roomX, roomY + roomH - 60, roomW, 60);
    g.fillStyle = PAL.A;
    g.fillRect(roomX, roomY + roomH - 62, roomW, 2);
    g.fillStyle = PAL.K;
    g.fillRect(roomX, roomY + roomH - 60, roomW, 1);

    // The plinths, evenly spaced.
    const slots = Math.max(1, state.gallerySlots());
    const usableW = roomW - 80;
    const spacing = usableW / slots;
    const plinthW = 44;

    const galleryCounts = state.galleryCounts();
    // Expand the gallery into a flat list of exhibits, in insertion order,
    // so the display matches what the player put out.
    const exhibits: string[] = [];
    for (const grade of GRADES) {
      const count = galleryCounts.get(grade) ?? 0;
      for (let i = 0; i < count; i++) exhibits.push(grade);
    }

    for (let i = 0; i < slots; i++) {
      const px = Math.round(roomX + 40 + i * spacing + (spacing - plinthW) / 2);
      const py = roomY + roomH - 62;

      const isHover = this.hoverPlinth === i;
      const grade = exhibits[i];

      // A plinth: a wooden column with a lit top.
      g.fillStyle = PAL.N;
      g.fillRect(px, py - 30, plinthW, 30);
      g.fillStyle = PAL.Z;
      g.fillRect(px + 2, py - 30, plinthW - 4, 4);
      g.fillStyle = PAL.K;
      g.fillRect(px, py - 30, plinthW, 1);
      g.fillRect(px, py - 1, plinthW, 1);
      g.fillRect(px, py - 30, 1, 30);
      g.fillRect(px + plinthW - 1, py - 30, 1, 30);

      if (grade) {
        // The display case over the plinth.
        const caseSprite = ctx.sprites.get('gallery_case');
        if (caseSprite) {
          drawSprite(g, caseSprite, px + Math.round((plinthW - caseSprite.width) / 2), py - 30 - caseSprite.height + 2, 1);
        }

        // The artefact inside it.
        const image = ctx.sprites.get(GRADE_SPRITE[grade]);
        if (image) {
          drawSpriteCentred(g, image, px + plinthW / 2, py - 30 - caseSprite!.height / 2 + 6, 1);
        }

        // A small brass label.
        g.fillStyle = PAL.Y;
        g.fillRect(px + 8, py - 22, plinthW - 16, 8);
        g.fillStyle = PAL.K;
        g.fillRect(px + 8, py - 22, plinthW - 16, 1);
        g.fillRect(px + 8, py - 15, plinthW - 16, 1);
      } else {
        // An empty plinth, marked so it does not look like a bug.
        g.fillStyle = isHover ? PAL.C : PAL.X;
        g.fillRect(px + 6, py - 26, plinthW - 12, 18);
        g.fillStyle = PAL.P;
        g.fillRect(px + 6, py - 26, plinthW - 12, 1);
        g.fillRect(px + 6, py - 9, plinthW - 12, 1);
        g.fillRect(px + 6, py - 26, 1, 18);
        g.fillRect(px + plinthW - 7, py - 26, 1, 18);
      }

      regions.push({
        x: px - 4,
        y: py - 90,
        w: plinthW + 8,
        h: 92,
        id: `gallery:plinth:${i}`,
        onClick: () => {
          // Clicking an exhibit takes it back to the vault.
          if (grade) state.vaultOne(grade);
        },
      });

      // The grade name under the plinth.
      if (grade) {
        drawText(g, grade, px + plinthW / 2, py + 6, {
          font: FONT.tiny,
          color: PAL.D,
          align: 'center',
          maxWidth: plinthW + 10,
        });
      }
    }

    // The visitors. They are drawn with the visitor sprites, three variants
    // in rotation, with a bob, so the room feels occupied rather than
    // abandoned and every figure is a real drawing rather than a block.
    const visitorCount = Math.min(8, Math.max(2, Math.round(state.demand() / 2)));
    const visitorTop = roomY + 34;
    for (let i = 0; i < visitorCount; i++) {
      const vx = roomX + 30 + ((i * 97) % (roomW - 60));
      const bob = Math.sin(ctx.time * 1.6 + i * 1.3) > 0 ? 0 : 1;
      this.drawVisitor(ctx, vx, visitorTop + bob, i);
    }

    // The takings panel.
    const footY = FOOTER_TOP;
    drawPanel(g, { x: MARGIN_X, y: footY, w: PANEL_WIDTH, h: FOOTER_PANEL_HEIGHT }, {
      fill: PAL.C,
      title: 'Today’s takings',
    });

    // The three readings, each with its own picture.
    //
    // The VALUES used to be written in the accent colour itself -- clay
    // money and relic teal straight onto the cream panel. Clay on cream
    // is 2.47:1 and teal is 2.26:1, so those numbers were unreadable.
    // Now the value is written in dark ink and the picture in front of it
    // carries the meaning (RULE 1.2, RULE 4.6).
    const lines: { label: string; value: string; icon: string }[] = [
      {
        label: 'Exhibits earning',
        value: `${Math.min(state.onDisplay(), state.demand())} of ${state.onDisplay()}`,
        icon: 'upgrade_gallery',
      },
      {
        label: 'Daily takings',
        value: moneyNumber(this.dailyTakings(ctx)),
        icon: 'icon_coin',
      },
      {
        label: 'Demand today',
        value: `${state.demand()}`,
        icon: 'icon_demand',
      },
    ];

    let ly = footY + 30;
    let lx = MARGIN_X + 20;
    for (const line of lines) {
      drawText(g, line.label, lx, ly, { font: FONT.small, color: PAL.P });
      // The icon is on the leading side of the value (RULE 7.3), and it
      // carries the unit, so the number itself stays naked.
      const image = ctx.sprites.get(line.icon);
      if (image) drawSprite(g, image, lx, ly + 12, 1);
      drawText(g, line.value, lx + 22, ly + 15, {
        font: FONT.body,
        color: PAL.D,
        maxWidth: 180,
      });
      lx += 210;
    }

    // The revenue trend along the bottom of the panel.
    const revenue = state.revenueLog();
    if (revenue.length > 1) {
      const sparkX = MARGIN_X + 20 + lines.length * 210 + 20;
      const sparkW = PANEL_WIDTH - (sparkX - MARGIN_X) - 40;
      if (sparkW > 80) {
        drawText(g, 'Recent takings', sparkX, footY + 30, {
          font: FONT.small,
          color: PAL.P,
        });
        drawSpark(g, revenue.slice(-60), sparkX, footY + 46, sparkW, 18, PAL.A);
      }
    }

    return regions;
  }

  /** The takings the gallery would earn today. */
  private dailyTakings(ctx: ScreenContext): number {
    const { state } = ctx;
    const paying = state.payingSplit();
    let total = 0;
    for (const [grade, count] of paying) {
      total += state.exhibitValue(grade) * count;
    }
    return total;
  }

  /** A visitor figure, drawn from the visitor sprites. */
  private drawVisitor(ctx: ScreenContext, x: number, y: number, seed: number): void {
    const g = ctx.surface.ctx;
    // Three visitor sprites, cycled. The sprite is 18x18 with the feet at
    // the bottom, so it is drawn with its base on the floor line.
    const names = ['visitor_a', 'visitor_b', 'visitor_c'];
    const image = ctx.sprites.get(names[seed % names.length] as string);
    if (image) {
      drawSprite(g, image, x - image.width / 2, y - image.height, 1);
      return;
    }

    // Fallback: a plain figure, so a missing sprite never leaves a gap.
    const coats = [PAL.U, PAL.T, PAL.M, PAL.L];
    const coat = coats[seed % coats.length];
    g.fillStyle = PAL.K;
    g.fillRect(x, y, 10, 14);
    g.fillStyle = coat;
    g.fillRect(x + 1, y + 1, 8, 12);
    g.fillStyle = PAL.Z;
    g.fillRect(x + 2, y - 7, 6, 7);
    g.fillStyle = PAL.K;
    g.fillRect(x + 1, y - 8, 8, 1);
    g.fillRect(x + 1, y - 1, 8, 1);
    g.fillRect(x + 1, y - 8, 1, 8);
    g.fillRect(x + 8, y - 8, 1, 8);
  }

  public draw(ctx: ScreenContext): void {
    const g = ctx.surface.ctx;
    drawText(g, 'GALLERY', 24, 62, { font: FONT.large, color: PAL.D });

    const shown = ctx.state.onDisplay();
    const cap = ctx.state.demand();
    if (shown > cap) {
      const text = `${shown - cap} exhibit${shown - cap === 1 ? '' : 's'} earning nothing`;
      const tw = measureText(text, FONT.small);
      const tx = ctx.surface.canvas.width - 24 - tw;
      // Rust on cream is 3.04:1, so the warning is dark ink with a rust
      // chip beside it.
      drawChip(g, tx - 14, 70, PAL.T);
      drawText(g, text, tx, 68, {
        font: FONT.small,
        color: PAL.D,
      });
    }
  }

  public onRegionClick(region: Region): void {
    if (region.id?.startsWith('gallery:plinth:')) {
      this.hoverPlinth = Number(region.id.slice('gallery:plinth:'.length));
    }
  }

  public hint(): string {
    return 'Click an exhibit on the floor to take it back to the vault.';
  }
}

/** A small bar chart of a value series. */
function drawSpark(
  g: CanvasRenderingContext2D,
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
    g.fillStyle = color;
    g.fillRect(x + i * step, y + h - barH, Math.max(1, step - 1), barH);
  }
  g.fillStyle = PAL.P;
  g.fillRect(x, y + h, w, 1);
}
