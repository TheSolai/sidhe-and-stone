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
import { moneyNumber } from '../screen.ts';
import { drawModalRow, drawPanel, drawText, drawWell, FONT } from '../widgets.ts';

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
    const row = (
      label: string,
      value: string,
      color: string,
      strong = false,
      coin = false
    ) => {
      // RULE 10.1: a thin coloured block at the leading edge is the row's
      // icon column, so the kind of each figure is visible at a glance.
      // RULE 10.5: the value is right-aligned, so the figures line up.
      // RULE 4.6: the money rows carry the coin, so the number stays naked.
      drawModalRow(
        g,
        { x: panelX + 12, y, w: sumW - 24, h: strong ? 26 : 22 },
        {
          label,
          value,
          tint: color,
          fill: PAL.C,
          font: strong ? FONT.body : FONT.small,
          icon: coin ? 'icon_coin' : undefined,
          sprites: ctx.sprites,
        }
      );
      y += strong ? 26 : 22;
    };

    row('Takings', moneyNumber(sum(revenue)), PAL.A, false, true);
    row('Reel bonus', moneyNumber(sum(reelRev)), PAL.E, false, true);
    row('Upkeep', `-${moneyNumber(sum(opex))}`, PAL.T, false, true);
    row('Stolen', `-${moneyNumber(sum(stolen))}`, PAL.T, false, true);

    // The operating result. This is the number that matters.
    g.fillStyle = PAL.P;
    g.fillRect(panelX + 20, y - 2, sumW - 40, 1);
    y += 8;

    const operating = sum(revenue) + sum(reelRev) - sum(opex) - sum(stolen);
    row(
      'Operating result',
      `${operating >= 0 ? '+' : '-'}${moneyNumber(Math.abs(operating))}`,
      operating >= 0 ? PAL.M : PAL.T,
      true,
      true
    );

    y += 6;
    drawText(g, 'Investment is separate:', panelX + 20, y, {
      font: FONT.small,
      color: PAL.P,
    });
    y += 16;
    row('Spent on growth', `-${moneyNumber(sum(capex))}`, PAL.U, false, true);

    // The days recorded.
    const days = revenue.length;
    y += 10;
    drawText(g, `${days} day${days === 1 ? '' : 's'} recorded`, panelX + 20, y, {
      font: FONT.small,
      color: PAL.P,
    });

    // The chart of takings against upkeep.
    //
    // It used to be drawn at panelY + panelH - 120 -- which is y=272.
    // The rows above it finish at y=325, so the chart was painted
    // straight over the operating result and the investment line, and
    // the two sets of figures sat on top of each other. A screenshot of
    // this screen had the words "Takings and upkeep" printed across
    // "Investment in...".
    //
    // It is drawn BELOW the last row instead, in the space the panel
    // already had, and the frame carries its own legend so no caption
    // has to be squeezed in above it.
    const chartY = y + 16;
    this.drawChart(g, panelX + 20, chartY, sumW - 40, 56, revenue, opex);

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
      // RULE 10.1: full-width inset rows with a thin coloured block at
      // the leading edge, instead of a line of floating text.
      // RULE 10.2: this is a wide table, so the rows alternate.
      // RULE 10.3: there is no scrollbar -- the arrow at the bottom says
      // there is more below.
      const rowH = 18;
      const fits = Math.floor((wellH - 12) / rowH);
      const shown = entries.slice(0, fits);
      shown.forEach((entry, i) => {
        const rowY = wellY + 6 + i * rowH;
        g.fillStyle = i % 2 === 0 ? PAL.W : PAL.C;
        g.fillRect(wellX, rowY, wellW, rowH);

        // The leading block: the kind of the entry, as a plate.
        g.fillStyle = this.entryColor(entry.kind);
        g.fillRect(wellX, rowY, 5, rowH);

        drawText(g, `Day ${entry.day}`, wellX + 12, rowY + 4, {
          font: FONT.tiny,
          color: PAL.P,
        });
        // The entry text sits on a W or a C row. Both are paper surfaces,
        // so the ink is dark: the accent hues are all under 4.5:1 there,
        // and the leading block already carries the kind.
        drawText(g, entry.text, wellX + 62, rowY + 2, {
          font: FONT.small,
          color: PAL.D,
          maxWidth: wellW - 74,
        });
      });

      if (entries.length > shown.length) {
        const ax = Math.round(wellX + wellW / 2) - 4;
        const ay = wellY + wellH - 14;
        g.fillStyle = PAL.P;
        g.fillRect(ax, ay, 9, 1);
        g.fillRect(ax + 1, ay + 1, 7, 1);
        g.fillRect(ax + 2, ay + 2, 5, 1);
        g.fillRect(ax + 3, ay + 3, 3, 1);
        g.fillRect(ax + 4, ay + 4, 1, 1);
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

    // The legend lives in a strip of its own at the top of the frame,
    // and the plot area is what is left underneath it. The legend used
    // to be drawn ON TOP of the bars, so a tall bar ran straight through
    // the word "Takings".
    const legendH = 13;

    // The legend.
    g.fillStyle = PAL.A;
    g.fillRect(x + 8, y + 4, 8, 8);
    drawText(g, 'Takings', x + 20, y + 2, { font: FONT.tiny, color: PAL.N });
    g.fillStyle = PAL.T;
    g.fillRect(x + 84, y + 4, 8, 8);
    drawText(g, 'Upkeep', x + 96, y + 2, { font: FONT.tiny, color: PAL.N });

    const plotY = y + legendH;
    const plotH = h - legendH;

    // The plot area is INSET from the frame, so a bar can never run over
    // the frame's own border line. The bars used to be laid out from the
    // frame's edge with a step computed from the FULL width, which put
    // the last bar's right edge on top of the frame.
    const inset = 3;
    const plotX = x + inset;
    const plotW = w - inset * 2;

    const n = Math.max(revenue.length, opex.length);
    if (n === 0) {
      drawText(g, 'No days yet.', plotX + 4, plotY + plotH / 2 - 6, {
        font: FONT.small,
        color: PAL.N,
      });
      return;
    }

    let max = 1;
    for (const v of revenue) max = Math.max(max, v);
    for (const v of opex) max = Math.max(max, v);

    // The step is computed from the INSET width, and the last bar is
    // pulled back so that it stays inside the plot area.
    const step = Math.max(1, Math.floor(plotW / n));
    const barW = Math.max(1, step - 2);
    const barX = (i: number): number =>
      plotX + Math.min(i * step, plotX + plotW - barW - inset);

    for (let i = 0; i < revenue.length; i++) {
      const bh = Math.max(0, Math.round((revenue[i] / max) * (plotH - 2)));
      g.fillStyle = PAL.A;
      g.fillRect(barX(i), plotY + plotH - 1 - bh, barW, bh);
    }
    for (let i = 0; i < opex.length; i++) {
      const bh = Math.max(0, Math.round((opex[i] / max) * (plotH - 2)));
      g.fillStyle = PAL.T;
      g.fillRect(barX(i), plotY + plotH - 1 - bh, Math.max(1, Math.floor(barW / 2)), bh);
    }
  }

  public draw(ctx: ScreenContext): void {
    const g = ctx.surface.ctx;
    drawText(g, 'LEDGER', 24, 62, { font: FONT.large, color: PAL.D });
  }

  public hint(): string {
    return 'Investment in sites and curators is not an operating loss — it is growth.';
  }
}
