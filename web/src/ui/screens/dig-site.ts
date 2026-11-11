/**
 * The Dig Site screen.
 *
 * The player assigns a dig to each of their sites. This is the screen that
 * starts the whole loop: nothing arrives in the storeroom until a site has
 * been told what to do.
 *
 * The layout is a row of site plots along the top and a palette of dig
 * types below. Clicking a dig type selects it; clicking a plot sends the
 * selected dig there. That two-click model is deliberate: it is faster than
 * opening a menu on every plot once there are more than a few sites.
 */

import { PAL, DIG_COLOR, DIG_NAME } from '../palette.ts';
import { DIG_TYPES } from '../../sim/game-state.ts';
import { DIGS } from '../../sim/sim-core.ts';
import type { Region, Screen, ScreenContext } from '../screen.ts';
import { money } from '../screen.ts';
import { drawSprite } from '../sprites.ts';
import { drawPanel, drawText, drawWell, FONT, measureText } from '../widgets.ts';

export class DigSiteScreen implements Screen {
  public readonly id = 'dig';
  public readonly label = 'Dig Site';

  /** The dig type the player has selected. Null means "not chosen yet". */
  private selected: string | null = null;

  /** The site the pointer is over, for the hover highlight. */
  private hoverSite = -1;

  public layout(ctx: ScreenContext): Region[] {
    const g = ctx.surface.ctx;
    const { state } = ctx;
    const regions: Region[] = [];
    const w = ctx.surface.canvas.width;

    const plotY = 92;
    const plotH = 150;
    const plotW = Math.floor((w - 40) / Math.max(1, state.sites())) - 10;
    const startX = 20;

    // The plots.
    for (let i = 0; i < state.sites(); i++) {
      const px = startX + i * (plotW + 10);
      const inProgress = state.digInProgress(i);
      const pending = state.pendingDig(i);

      const isHover = this.hoverSite === i;

      drawPanel(
        g,
        { x: px, y: plotY, w: plotW, h: plotH },
        {
          fill: isHover ? PAL.W : PAL.C,
        }
      );

      // The earth inside the plot.
      drawWell(g, { x: px + 6, y: plotY + 30, w: plotW - 12, h: plotH - 60 }, PAL.S);

      // The dig site artwork.
      const sprite = ctx.sprites.get('dig_site');
      if (sprite) {
        drawSprite(g, sprite, px + Math.round((plotW - sprite.width * 2) / 2), plotY + 44, 2);
      }

      // The plot's name.
      drawText(g, `Site ${i + 1}`, px + plotW / 2, plotY + 9, {
        font: FONT.small,
        color: PAL.D,
        align: 'center',
      });

      // The state of the plot.
      let statusText: string;
      let statusColor: string;
      if (inProgress) {
        const left = Math.max(0, inProgress.ready_day - state.day());
        statusText = left === 0 ? 'Ready' : `${DIG_NAME[inProgress.dig]} · ${left}d`;
        statusColor = left === 0 ? PAL.M : PAL.N;
      } else if (pending) {
        statusText = `${DIG_NAME[pending]} queued`;
        statusColor = PAL.U;
      } else {
        statusText = 'Idle';
        statusColor = PAL.P;
      }
      drawText(g, statusText, px + plotW / 2, plotY + plotH - 24, {
        font: FONT.small,
        color: statusColor,
        align: 'center',
        maxWidth: plotW - 12,
      });

      regions.push({
        x: px,
        y: plotY,
        w: plotW,
        h: plotH,
        id: `dig:plot:${i}`,
        onClick: () => {
          if (this.selected) {
            state.assignDig(i, this.selected);
            this.selected = null;
          }
        },
      });
    }

    // The dig palette.
    const palY = plotY + plotH + 20;
    drawText(g, 'Choose a dig', 24, palY - 20, { font: FONT.small, color: PAL.D });

    const cardW = 280;
    const cardH = 86;
    for (let i = 0; i < DIG_TYPES.length; i++) {
      const dig = DIG_TYPES[i];
      const def = DIGS.find((d) => d.id === dig);
      const cx = 24 + i * (cardW + 14);
      const isSelected = this.selected === dig;

      drawPanel(
        g,
        { x: cx, y: palY, w: cardW, h: cardH },
        {
          fill: isSelected ? PAL.W : PAL.C,
        }
      );

      // A colour band identifies the dig, and the name is always written
      // out -- the colour never carries the meaning on its own.
      g.fillStyle = DIG_COLOR[dig] ?? PAL.U;
      g.fillRect(cx + 1, palY + 1, 5, cardH - 2);

      drawText(g, DIG_NAME[dig], cx + 16, palY + 10, {
        font: FONT.mid,
        color: PAL.D,
      });

      const days = state.digDays(dig);
      const cost = state.digCost(dig);
      const finds = def ? def.finds : 0;

      drawText(g, `${days} day${days === 1 ? '' : 's'}   ·   ${money(cost)}`, cx + 16, palY + 34, {
        font: FONT.small,
        color: PAL.N,
      });
      drawText(g, `~${finds} finds`, cx + 16, palY + 52, {
        font: FONT.small,
        color: PAL.N,
      });

      // The grades it can bring.
      if (def) {
        let gx = cx + 130;
        for (const grade of def.grades) {
          const spriteName = `artefact_${grade.id}`;
          const image = ctx.sprites.get(spriteName);
          if (image) {
            drawSprite(g, image, gx, palY + 48, 1);
          }
          drawText(g, `${grade.weight}%`, gx + (image ? image.width + 2 : 0), palY + 52, {
            font: FONT.tiny,
            color: PAL.N,
          });
          gx += 62;
        }
      }

      regions.push({
        x: cx,
        y: palY,
        w: cardW,
        h: cardH,
        id: `dig:card:${dig}`,
        onClick: () => {
          this.selected = this.selected === dig ? null : dig;
        },
      });
    }

    // The instruction line changes with what the player has selected, so
    // the screen always says what to do next.
    const hint = this.selected
      ? `Click a site to send ${DIG_NAME[this.selected]} there.`
      : 'Pick a dig, then click the site it should go to.';

    const hintX = 24 + DIG_TYPES.length * (cardW + 14);
    if (hintX < w - 240) {
      drawText(g, hint, hintX, palY + 24, {
        font: FONT.small,
        color: PAL.D,
        maxWidth: w - hintX - 20,
      });
    }

    return regions;
  }

  public draw(ctx: ScreenContext): void {
    const g = ctx.surface.ctx;
    const { state } = ctx;

    // The heading, with the day's omen on the right.
    drawText(g, 'DIG SITE', 24, 62, { font: FONT.large, color: PAL.D });

    const omen = state.todayEvent();
    if (omen && omen.title) {
      const text = `Omen: ${omen.title}`;
      const tw = measureText(text, FONT.small);
      drawText(g, text, ctx.surface.canvas.width - 24 - tw, 68, {
        font: FONT.small,
        color: PAL.U,
      });
    }

    // The site's remaining finds, so the player can see the dig is working.
    drawText(
      g,
      `Curators can catalog ${state.dailyCuration()} finds a day.`,
      24,
      ctx.surface.canvas.height - 58,
      { font: FONT.small, color: PAL.N }
    );
  }

  public onRegionClick(region: Region): void {
    // Track hover for the plot highlight.
    if (region.id?.startsWith('dig:plot:')) {
      this.hoverSite = Number(region.id.slice('dig:plot:'.length));
    }
  }

  public hint(): string {
    return this.selected
      ? `Send ${DIG_NAME[this.selected]} to a site.`
      : 'Dig types: Test Pit, Trench, Shaft.';
  }
}
