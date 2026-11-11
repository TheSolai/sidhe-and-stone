/**
 * The Ledger screen.
 *
 * The museum's books. Every day that has been resolved is written down:
 * the takings, the upkeep, what was stolen, what was invested.
 *
 * This screen exists for a specific reason. The economy's most important
 * property is that capital expenditure (buying sites, curators, upgrades)
 * is separate from operating expenditure (the daily running cost). A player
 * who sees a big investment land in the same column as their daily bills
 * will think the game is bleeding money. So the ledger separates them
 * explicitly and states the operating result on its own line.
 */

import { PAL } from '../palette.ts';
import type { Region, Screen, ScreenContext } from '../screen.ts';
import { money, signedMoney } from '../screen.ts';
import { drawPanel, drawText, drawWell, drawTintedValue, FONT } from '../widgets.ts';

export class LedgerScreen implements Screen {
  public readonly id = 'ledger';
  public readonly label = 'Ledger';

  public layout(ctx: ScreenContext): Region[] {
    const g = ctx.surface.ctx;
    const { state } = ctx;
    const w = ctx.surface.canvas.width;

    const panelX = 20;
    const panelY = 92;
    const panelH = 300;

    // The operating summary, on the left.
    const sumW = 300;
    drawPanel(g, { x: panelX, y: panelY, w: sumW, h: panelH }, {
      fill: PAL.C,
      title: 'The books',
    });

    const revenue = state.revenueLog();
    const opex = state.opexLog();
    const capex = state.capexLog();
    const stolen = state.stolenLog();
    const reelRev = state.reelRevenueLog();

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

    let y = panelY + 46;
    const row = (label: string, value: string, color: string, strong = false) => {
      drawText(g, label, panelX + 20, y, {
        font: strong ? FONT.body : FONT.small,
        color: strong ? PAL.D : PAL.P,
      });
      // The value is dark ink with a tint chip, not a coloured glyph.
      // Takings in clay is 2.47:1 on the cream panel -- the chip carries
      // the tint, the ink carries the number.
      drawTintedValue(g, value, panelX + sumW - 20, y, {
        font: strong ? FONT.body : FONT.small,
        tint: color,
        align: 'right',
      });
      y += strong ? 26 : 22;
    };

    row('Takings', money(sum(revenue)), PAL.A);
    row('Reel bonus', money(sum(reelRev)), PAL.E);
    row('Upkeep', `-${money(sum(opex))}`, PAL.T);
    row('Stolen', `-${money(sum(stolen))}`, PAL.T);

    // The operating result. This is the number that matters.
    g.fillStyle = PAL.P;
    g.fillRect(panelX + 20, y - 2, sumW - 40, 1);
    y += 8;

    const operating = sum(revenue) + sum(reelRev) - sum(opex) - sum(stolen);
    row('Operating result', signedMoney(operating), operating >= 0 ? PAL.M : PAL.T, true);

    y += 6;
    drawText(g, 'Investment is separate:', panelX + 20, y, {
      font: FONT.small,
      color: PAL.P,
    });
    y += 16;
    row('Spent on growth', `-${money(sum(capex))}`, PAL.U);

    // The days recorded.
    const days = revenue.length;
    y += 10;
    drawText(g, `${days} day${days === 1 ? '' : 's'} recorded`, panelX + 20, y, {
      font: FONT.small,
      color: PAL.P,
    });

    // The chart of takings against upkeep.
    const chartY = panelY + panelH - 120;
    drawText(g, 'Takings and upkeep', panelX + 20, chartY - 18, {
      font: FONT.small,
      color: PAL.D,
    });
    this.drawChart(g, panelX + 20, chartY, sumW - 40, 100, revenue, opex);

    // The running list, on the right.
    const listX = panelX + sumW + 20;
    const listW = w - listX - 20;

    drawPanel(g, { x: listX, y: panelY, w: listW, h: panelH }, {
      fill: PAL.C,
      title: 'The day’s entries',
    });

    const entries = state.recentEvents(40);
    const wellX = listX + 14;
    const wellY = panelY + 36;
    const wellW = listW - 28;
    const wellH = panelH - 50;
    drawWell(g, { x: wellX, y: wellY, w: wellW, h: wellH }, PAL.W);

    if (entries.length === 0) {
      drawText(g, 'Nothing written down yet.', wellX + 12, wellY + 12, {
        font: FONT.body,
        color: PAL.N,
      });
    } else {
      let ey = wellY + 8;
      for (const entry of entries) {
        const color = this.entryColor(entry.kind);
        drawText(g, `Day ${entry.day}`, wellX + 10, ey, {
          font: FONT.tiny,
          color: PAL.P,
        });
        // The entry text sits on a W well, where every accent hue is
        // under 4.5:1. Dark ink plus a chip keeps the kind readable.
        drawTintedValue(g, entry.text, wellX + 62, ey - 1, {
          font: FONT.small,
          tint: color,
          maxWidth: wellW - 74,
        });
        ey += 18;
        if (ey > wellY + wellH - 18) break;
      }
    }

    return [];
  }

  /** The colour an entry is written in. */
  private entryColor(kind: string): string {
    switch (kind) {
      case 'theft':
      case 'sale':
        return PAL.T;
      case 'goal':
        return PAL.G;
      case 'upgrade':
        return PAL.U;
      case 'display':
        return PAL.L;
      case 'dig':
        return PAL.Z;
      case 'event':
        return PAL.E;
      case 'revenue':
        return PAL.A;
      default:
        return PAL.D;
    }
  }

  /**
   * Two series over time: takings in gold, upkeep in rust.
   *
   * The point of the chart is that the gold line should sit above the rust
   * line for the museum to be healthy. When it does not, the player can see
   * why without reading a number.
   */
  private drawChart(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    revenue: number[],
    opex: number[]
  ): void {
    g.fillStyle = PAL.W;
    g.fillRect(x, y, w, h);
    g.fillStyle = PAL.P;
    g.fillRect(x, y, w, 1);
    g.fillRect(x, y + h - 1, w, 1);
    g.fillRect(x, y, 1, h);
    g.fillRect(x + w - 1, y, 1, h);

    const n = Math.max(revenue.length, opex.length);
    if (n === 0) {
      drawText(g, 'No days yet.', x + 8, y + h / 2 - 6, {
        font: FONT.small,
        color: PAL.N,
      });
      return;
    }

    let max = 1;
    for (const v of revenue) max = Math.max(max, v);
    for (const v of opex) max = Math.max(max, v);

    const step = Math.max(1, Math.floor(w / Math.max(1, n - 1)));
    const barW = Math.max(1, step - 1);

    for (let i = 0; i < revenue.length; i++) {
      const bh = Math.max(0, Math.round((revenue[i] / max) * (h - 4)));
      g.fillStyle = PAL.A;
      g.fillRect(x + i * step, y + h - 1 - bh, barW, bh);
    }
    for (let i = 0; i < opex.length; i++) {
      const bh = Math.max(0, Math.round((opex[i] / max) * (h - 4)));
      g.fillStyle = PAL.T;
      g.fillRect(x + i * step, y + h - 1 - bh, Math.max(1, Math.floor(barW / 2)), bh);
    }

    // The legend.
    g.fillStyle = PAL.A;
    g.fillRect(x + w - 96, y + 6, 8, 8);
    drawText(g, 'Takings', x + w - 84, y + 4, { font: FONT.tiny, color: PAL.N });
    g.fillStyle = PAL.T;
    g.fillRect(x + w - 44, y + 6, 8, 8);
    drawText(g, 'Upkeep', x + w - 32, y + 4, { font: FONT.tiny, color: PAL.N });
  }

  public draw(ctx: ScreenContext): void {
    const g = ctx.surface.ctx;
    drawText(g, 'LEDGER', 24, 62, { font: FONT.large, color: PAL.D });
  }

  public hint(): string {
    return 'Investment in sites and curators is not an operating loss — it is growth.';
  }
}
