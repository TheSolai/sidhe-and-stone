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
import { money } from '../screen.ts';
import { drawSprite, drawSpriteCentred } from '../sprites.ts';
import { drawPanel, drawText, FONT } from '../widgets.ts';

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
    const floorH = 300;

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

    // The visitors. They are drawn as simple figures with a bob, so the
    // room feels occupied rather than abandoned.
    const visitorCount = Math.min(8, Math.max(2, Math.round(state.demand() / 2)));
    const visitorTop = roomY + 12;
    for (let i = 0; i < visitorCount; i++) {
      const vx = roomX + 30 + ((i * 97) % (roomW - 60));
      const bob = Math.sin(ctx.time * 1.6 + i * 1.3) > 0 ? 0 : 1;
      this.drawVisitor(g, vx, visitorTop + bob, i);
    }

    // The takings panel.
    const footY = floorY + floorH + 18;
    drawPanel(g, { x: 20, y: footY, w: w - 40, h: 84 }, {
      fill: PAL.C,
      title: 'Today’s takings',
    });

    const lines: [string, string, string][] = [];
    lines.push([
      'Exhibits earning',
      `${Math.min(state.onDisplay(), state.demand())} of ${state.onDisplay()}`,
      PAL.K,
    ]);
    lines.push(['Daily takings', money(state.exhibitValue('crown') * 0 + this.dailyTakings(ctx)), PAL.A]);
    lines.push(['Demand today', `${state.demand()} visitors`, PAL.L]);

    let ly = footY + 36;
    let lx = 40;
    for (const [label, value, color] of lines) {
      drawText(g, label, lx, ly, { font: FONT.small, color: PAL.N });
      drawText(g, value, lx, ly + 15, { font: FONT.body, color });
      lx += 210;
    }

    // The revenue trend along the bottom of the panel.
    const revenue = state.revenueLog();
    if (revenue.length > 1) {
      const sparkX = 40 + lines.length * 210 + 20;
      const sparkW = w - sparkX - 60;
      if (sparkW > 80) {
        drawText(g, 'Recent takings', sparkX, footY + 36, {
          font: FONT.small,
          color: PAL.N,
        });
        drawSpark(g, revenue.slice(-60), sparkX, footY + 52, sparkW, 22, PAL.A);
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

  /** A simple visitor figure. */
  private drawVisitor(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    seed: number
  ): void {
    const coats = [PAL.U, PAL.T, PAL.M, PAL.L];
    const coat = coats[seed % coats.length];

    g.fillStyle = PAL.K;
    g.fillRect(x, y, 10, 14);
    g.fillStyle = coat;
    g.fillRect(x + 1, y + 1, 8, 12);
    // The head.
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
      g.font = FONT.small;
      const tw = g.measureText(text).width;
      drawText(g, text, ctx.surface.canvas.width - 24 - tw, 68, {
        font: FONT.small,
        color: PAL.T,
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
