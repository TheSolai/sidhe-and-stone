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
import { moneyNumber } from '../screen.ts';
import { drawSprite } from '../sprites.ts';
import {
  drawPanel,
  drawParagraph,
  drawText,
  drawWell,
  drawChip,
  FONT,
  measureText,
} from '../widgets.ts';
import { buildForecast } from '../forecast.ts';
import {
  CONTENT_TOP,
  FOOTER_PANEL_HEIGHT,
  FOOTER_TOP,
  MARGIN_X,
  PANEL_WIDTH,
} from '../bands.ts';

/**
 * The height of a site plot.
 *
 * 130 rather than 140, because the content band is 312 tall and the
 * dig palette below it needs two rows of 70 plus a gap: 92 + 130 + 26
 * + 154 = 402, which lands inside the band with two pixels to spare.
 * At 140 the second row of palette cards ran to y=412, straight through
 * the footer panel.
 */
const PLOT_H = 130;

/** The height of a dig-type card. */
const CARD_H = 70;

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

    const plotY = CONTENT_TOP;
    const plotH = PLOT_H;
    const plotW = Math.floor((w - 40) / Math.max(1, state.sites())) - 10;
    const startX = MARGIN_X;

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

      // The dig site artwork. A plot shows the picture of whatever is
      // actually happening there -- a trench looks like a trench -- and
      // falls back to the generic site while the plot is idle.
      const digHere = inProgress ? inProgress.dig : pending;
      const spriteName = digHere ? `dig_${digHere}` : 'dig_site';
      const sprite = ctx.sprites.get(spriteName) ?? ctx.sprites.get('dig_site');
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
      let statusChip: string | null = null;
      if (inProgress) {
        const left = Math.max(0, inProgress.ready_day - state.day());
        statusText = left === 0 ? 'Ready' : `${DIG_NAME[inProgress.dig]} · ${left}d`;
        // Panel edge ink, not the mid brown N. N on the cream plot is
        // 4.06:1 -- under the floor for small text. P on cream is
        // 8.32:1.
        statusColor = left === 0 ? PAL.D : PAL.P;
        // Moss means "finished and waiting" -- a chip, because moss on
        // cream is only 2.15:1 as a glyph.
        if (left === 0) statusChip = PAL.M;
      } else if (pending) {
        statusText = `${DIG_NAME[pending]} queued`;
        statusColor = PAL.P;
        statusChip = PAL.U;
      } else {
        statusText = 'Idle';
        statusColor = PAL.P;
      }
      // The chip and the words are laid out as ONE group and centred
      // together. Centring the text on its own and dropping a chip at a
      // hand-computed offset put the chip on top of the glyphs -- the
      // text is drawn with align 'center', so its x IS the midpoint and
      // subtracting half the width twice shifts it a whole half-width
      // to the left.
      const stW = measureText(statusText, FONT.small);
      const chipSize = 8;
      const chipGap = 4;
      const groupW = stW + (statusChip ? chipSize + chipGap : 0);
      const groupX = px + plotW / 2 - groupW / 2;
      if (statusChip) {
        // Vertically centred on the 11px text row.
        drawChip(g, groupX, plotY + plotH - 22, statusChip);
      }
      drawText(g, statusText, groupX + (statusChip ? chipSize + chipGap : 0), plotY + plotH - 24, {
        font: FONT.small,
        color: statusColor,
        align: 'left',
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
    //
    // Five dig types, laid out on TWO rows of three. A single row of five
    // 280px cards ran to x=1494 on a 960px canvas, so the two deepest digs
    // were off-screen and could never be clicked. The cards stay the same
    // width and the same height; they are simply wrapped onto a second
    // row, and the instruction line takes the space the short row leaves.
    const palY = plotY + plotH + 26;
    drawText(g, 'Choose a dig', MARGIN_X + 4, palY - 18, { font: FONT.small, color: PAL.D });

    const cardW = 294;
    const cardH = CARD_H;
    const cardGap = 14;
    const perRow = 3;

    for (let i = 0; i < DIG_TYPES.length; i++) {
      const dig = DIG_TYPES[i];
      const def = DIGS.find((d) => d.id === dig);
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const cx = MARGIN_X + 4 + col * (cardW + cardGap);
      const cy = palY + row * (cardH + cardGap);
      const isSelected = this.selected === dig;

      drawPanel(
        g,
        { x: cx, y: cy, w: cardW, h: cardH },
        {
          fill: isSelected ? PAL.W : PAL.C,
        }
      );

      // A colour band identifies the dig, and the name is always written
      // out -- the colour never carries the meaning on its own.
      g.fillStyle = DIG_COLOR[dig] ?? PAL.U;
      g.fillRect(cx + 1, cy + 1, 5, cardH - 2);

      // The dig's own picture, so the five dig types are told apart by
      // their shape and not only by their label.
      const digSprite = ctx.sprites.get(`dig_${dig}`);
      if (digSprite) {
        drawSprite(g, digSprite, cx + cardW - 30, cy + 8, 1);
      }

      drawText(g, DIG_NAME[dig], cx + 16, cy + 6, {
        font: FONT.mid,
        color: PAL.D,
      });

      const days = state.digDays(dig);
      const cost = state.digCost(dig);
      const finds = def ? def.finds : 0;

      // RULE 4.6: the coin carries the unit, so the cost is a naked
      // number with the coin on its leading side.
      const daysText = `${days} day${days === 1 ? '' : 's'}`;
      drawText(g, daysText, cx + 16, cy + 26, {
        font: FONT.small,
        color: PAL.P,
      });
      const coin = ctx.sprites.get('icon_coin');
      const coinX = cx + 16 + Math.round(measureText(daysText, FONT.small)) + 12;
      if (coin) drawSprite(g, coin, coinX, cy + 24, 1);
      drawText(g, moneyNumber(cost), coinX + (coin ? 14 : 0), cy + 26, {
        font: FONT.small,
        color: PAL.P,
      });
      drawText(g, `~${finds} finds`, cx + 16, cy + 40, {
        font: FONT.small,
        color: PAL.P,
      });

      // The grades it can bring, along the bottom of the card.
      if (def) {
        let gx = cx + 16;
        for (const grade of def.grades) {
          const spriteName = `artefact_${grade.id}`;
          const image = ctx.sprites.get(spriteName);
          if (image) {
            drawSprite(g, image, gx, cy + 50, 1);
          }
          drawText(g, `${grade.weight}%`, gx + (image ? image.width + 2 : 0), cy + 54, {
            font: FONT.tiny,
            color: PAL.P,
          });
          gx += 52;
        }
      }

      regions.push({
        x: cx,
        y: cy,
        w: cardW,
        h: cardH,
        id: `dig:card:${dig}`,
        onClick: () => {
          this.selected = this.selected === dig ? null : dig;
        },
      });
    }

    // The footer panel. It carries the instruction -- which changes with
    // what the player has selected -- and the curation rate, so the
    // player knows what a dig is worth before they commit to it.
    //
    // The instruction used to sit beside the last row of dig cards,
    // which is short because five dig types do not divide into three
    // even rows. That put it in the wrong place: on a five-card layout
    // the last row holds two cards, so the line floated in the middle
    // of the content band with nothing to anchor it. The footer band
    // belongs to the screen and exists for exactly this.
    drawPanel(g, { x: MARGIN_X, y: FOOTER_TOP, w: PANEL_WIDTH, h: FOOTER_PANEL_HEIGHT }, {
      fill: PAL.C,
      title: 'Next dig',
    });

    const hint = this.selected
      ? `Click a site to send ${DIG_NAME[this.selected]} there.`
      : 'Pick a dig, then click the site it should go to.';
    // The instruction WRAPS rather than being cut, and it is set at the
    // body size. At the mid size it was 717 pixels wide against a
    // 560-pixel space, so the player saw "Pick a dig, then click the
    // s…" -- an instruction that stops before the verb.
    drawParagraph(g, hint, MARGIN_X + 16, FOOTER_TOP + 24, {
      font: FONT.body,
      color: PAL.D,
      maxWidth: 560,
      lineHeight: 16,
    });

    // The curation rate, on the right of the footer.
    const rate = `Curators can catalog ${state.dailyCuration()} finds a day.`;
    drawText(g, rate, MARGIN_X + PANEL_WIDTH - 16, FOOTER_TOP + 44, {
      font: FONT.small,
      color: PAL.P,
      align: 'right',
    });

    // ── TOMORROW ──
    //
    // The dig screen is where the player decides what to dig next, so
    // this is where they need to know what tomorrow already has in it:
    // a dig finishing, a backlog waiting, a milestone one step away.
    //
    // ONE fact, on the footer's own line, in the small ink. The dig
    // screen already has an instruction in the mid ink, and two loud
    // lines in one footer is one too many.
    const forecast = buildForecast(state);
    const fact = forecast.facts[0];
    if (fact) {
      // The line is measured first and LEFT OUT if it does not fit.
      // A cut sentence is worse than no sentence: the player cannot tell
      // that half a fact is missing.
      // The curation rate sits on the row ABOVE this one, so the fact
      // has the full width of the panel to itself.
      const maxW = PANEL_WIDTH - 32;
      if (measureText(fact, FONT.small) <= maxW) {
        drawText(g, fact, MARGIN_X + 16, FOOTER_TOP + 56, {
          font: FONT.small,
          color: PAL.D,
          maxWidth: maxW,
        });
      }
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
      const tx = ctx.surface.canvas.width - 24 - tw;
      // Slate on cream is 2.23:1, so the omen is dark ink with a slate
      // chip. The arcane reading of the day still comes through.
      drawChip(g, tx - 14, 70, PAL.E);
      drawText(g, text, tx, 68, {
        font: FONT.small,
        color: PAL.D,
      });
    }

    // The site's remaining finds, so the player can see the dig is
    // working. This lives in the footer band now, not in the hint band
    // where the framework owns the line.
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
      : 'Dig types: Test Pit, Trench, Cutting, Shaft, Deepworks.';
  }
}
