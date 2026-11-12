/**
 * The Storeroom (curator) screen.
 *
 * Where dirty finds arrive. The curators work here: they clean and label
 * what comes up, turning raw lumps into graded artefacts. Curators are the
 * bottleneck in the game, so this screen exists to make the backlog visible
 * -- a growing pile of raw finds is a problem the player can see and fix.
 */

import { PAL } from '../palette.ts';
import { GRADES, GRADE_COLOR, GRADE_SPRITE } from '../palette.ts';
import type { Region, Screen, ScreenContext } from '../screen.ts';
import { drawSprite } from '../sprites.ts';
import {
  drawPanel,
  drawSpeechBubble,
  drawText,
  drawChip,
  FONT,
  measureText,
} from '../widgets.ts';
import {
  CONTENT_TOP,
  FOOTER_PANEL_HEIGHT,
  FOOTER_TOP,
  MARGIN_X,
  PANEL_HEIGHT,
  PANEL_WIDTH,
} from '../bands.ts';

/**
 * The number of days the backlog will take to clear, written short.
 *
 * A tenth of a day matters when the pile is nearly gone -- "0.3 days"
 * says the work is nearly finished -- but past ten days the decimal is
 * noise, and it makes the line too long for the space it has.
 */
function clearDays(days: number): string {
  if (days < 10) return days.toFixed(1);
  return String(Math.round(days));
}

export class CuratorScreen implements Screen {
  public readonly id = 'curator';
  public readonly label = 'Storeroom';

  public layout(ctx: ScreenContext): Region[] {
    const g = ctx.surface.ctx;
    const { state } = ctx;
    const regions: Region[] = [];

    // The raw pile, on the left.
    const rawX = MARGIN_X;
    const rawY = CONTENT_TOP;
    const rawW = 300;
    const rawH = PANEL_HEIGHT;

    drawPanel(g, { x: rawX, y: rawY, w: rawW, h: rawH }, {
      fill: PAL.C,
      title: 'Uncatalogued',
    });

    const rawCounts = state.rawCounts();
    const totalRaw = state.rawCount();
    const capacity = Math.max(1, state.dailyCuration());

    if (totalRaw === 0) {
      drawText(g, 'The storeroom is empty.', rawX + 18, rawY + 52, {
        font: FONT.body,
        // Panel EDGE ink, not the mid brown N. N on the cream panel is
        // 4.06:1 -- under the floor for body text. P on cream is 8.32:1
        // and still reads a step lighter than the D body ink.
        color: PAL.P,
      });
      drawText(g, 'Send some fairies digging.', rawX + 18, rawY + 74, {
        font: FONT.small,
        color: PAL.P,
      });
    } else {
      // A stack of dirty lumps, one sprite per find, capped so a big
      // backlog does not turn into a wall of sprites.
      const perRow = 8;
      const shown = Math.min(totalRaw, 24);
      for (let i = 0; i < shown; i++) {
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        const image = ctx.sprites.get('artefact_rubble');
        if (image) {
          drawSprite(g, image, rawX + 16 + col * 22, rawY + 44 + row * 22, 1);
        }
      }
      if (totalRaw > shown) {
        drawText(g, `+${totalRaw - shown} more`, rawX + 16, rawY + 44 + 3 * 22 + 8, {
          font: FONT.small,
          color: PAL.P,
        });
      }

      // A progress bar: how much of today's curation is done.
      const done = Math.max(0, capacity - Math.min(totalRaw, capacity));
      const barY = rawY + rawH - 56;
      drawText(g, 'Curated today', rawX + 18, barY - 18, {
        font: FONT.small,
        color: PAL.D,
      });
      g.fillStyle = PAL.X;
      g.fillRect(rawX + 18, barY, rawW - 36, 14);
      g.fillStyle = PAL.M;
      g.fillRect(rawX + 18, barY, Math.round((rawW - 36) * Math.min(1, done / capacity)), 14);
      g.fillStyle = PAL.K;
      g.fillRect(rawX + 18, barY, rawW - 36, 1);
      g.fillRect(rawX + 18, barY + 13, rawW - 36, 1);
      g.fillRect(rawX + 18, barY, 1, 14);
      g.fillRect(rawX + 18 + rawW - 37, barY, 1, 14);
    }

    // The grading table, on the right: what is waiting to be catalogued,
    // by grade. This is what the curator will turn into display pieces.
    const tableX = rawX + rawW + 20;
    const tableW = PANEL_WIDTH - rawW - 20;

    drawPanel(g, { x: tableX, y: rawY, w: tableW, h: rawH }, {
      fill: PAL.C,
      title: 'Waiting on the curator',
    });

    // Which grades are waiting. The sim tracks raw finds by grade in
    // `raw`, so the pile is already broken down.
    const rows: { grade: string; count: number }[] = [];
    for (const grade of GRADES) {
      const count = rawCounts.get(grade) ?? 0;
      if (count > 0) rows.push({ grade, count });
    }

    let ry = rawY + 44;
    if (rows.length === 0) {
      drawText(g, 'Nothing waiting.', tableX + 20, ry, {
        font: FONT.body,
        color: PAL.P,
      });
    } else {
      // RULE 10.1: inset rows with a thin coloured block at the leading
      // edge, and the grade's own picture beside it.
      // RULE 10.2: the table is wide, so the rows alternate.
      // RULE 10.5: the count is right-aligned, so the column of numbers
      // lines up.
      const rowH = 30;
      rows.forEach((row, i) => {
        const rowY = ry + i * rowH;
        g.fillStyle = i % 2 === 0 ? PAL.W : PAL.C;
        g.fillRect(tableX + 12, rowY, tableW - 24, rowH - 4);

        g.fillStyle = GRADE_COLOR[row.grade] ?? PAL.R;
        g.fillRect(tableX + 12, rowY, 5, rowH - 4);

        const image = ctx.sprites.get(GRADE_SPRITE[row.grade]);
        if (image) {
          drawSprite(g, image, tableX + 24, rowY + 3, 1);
        }
        drawText(g, row.grade, tableX + 48, rowY + 6, {
          font: FONT.body,
          color: PAL.D,
        });
        drawText(g, `${row.count}`, tableX + tableW - 24, rowY + 6, {
          font: FONT.body,
          color: PAL.K,
          align: 'right',
        });
      });
      ry += rows.length * rowH;
    }

    // The curators themselves, with what they can handle.
    //
    // This is a FOOTER panel, not a third content panel. It used to sit
    // at rawY + rawH + 22, which was y=374 with a height of 96 -- so it
    // straddled the content and footer bands and its bottom edge landed
    // at 470, hard against the framework hint.
    const crewY = FOOTER_TOP;
    drawPanel(g, { x: MARGIN_X, y: crewY, w: PANEL_WIDTH, h: FOOTER_PANEL_HEIGHT }, {
      fill: PAL.C,
      title: 'Your crew',
    });

    const curatorSprite = ctx.sprites.get('curator');
    if (curatorSprite) {
      drawSprite(g, curatorSprite, MARGIN_X + 14, crewY + 28, 2);
    }

    // RULE 5.6: the curator's own words go in a speech bubble -- a white
    // bubble with a thin outline and a tail pointing at the speaker. A
    // SYSTEM message never goes in a bubble: the standing warning at the
    // top of the screen is written as plain text with a chip, because it
    // is information about the museum, not something anyone said.
    const backlog = state.rawCount();
    const crewCapacity = Math.max(1, state.dailyCuration());
    const daysToClear = backlog / crewCapacity;
    const speech =
      backlog === 0
        ? 'The storeroom is clear.'
        : backlog > crewCapacity * 2
          ? 'The pile is outgrowing us!'
          : 'We will get to them.';

    // The tail points LEFT, at the curator: the bubble sits beside the
    // speaker, so a downward tail would have pointed at the floor. The
    // tail's Y is the middle of the curator sprite.
    //
    // The bubble is 46 tall, so a two-line speech fits inside it. The
    // bubble used to be 34, which left room for one line, and one line
    // is not enough for what the curator has to say: "The storeroom is
    // clear." is 242 pixels and the bubble was 210.
    drawSpeechBubble(
      g,
      { x: MARGIN_X + 62, y: crewY + 22, w: 210, h: 46 },
      speech,
      crewY + 28 + 18,
      'left'
    );

    // The three rows of crew readings.
    //
    // They used to sit at +30, +48 and +62. The last row's glyphs
    // bottomed out at y=480 -- two pixels past the footer band, which
    // the framework owns. The band check found it; the rows are pulled
    // up so the last one lands at +56 and ends at y=472, inside the
    // panel's own bottom edge.
    //
    // RULE 1.2: the crew count is a picture and a number, not a bare
    // word.
    const crewX = MARGIN_X + 290;
    const crewIcon = ctx.sprites.get('upgrade_curator');
    if (crewIcon) drawSprite(g, crewIcon, crewX, crewY + 24, 1);
    drawText(g, `${state.curators()}`, crewX + 22, crewY + 26, {
      font: FONT.body,
      color: PAL.D,
    });
    drawText(g, `curator${state.curators() === 1 ? '' : 's'}`, crewX + 22 + 18, crewY + 27, {
      font: FONT.small,
      color: PAL.P,
    });
    drawText(g, `${state.curatorCapacity()} find${state.curatorCapacity() === 1 ? '' : 's'} each per day`, crewX, crewY + 42, {
      font: FONT.small,
      color: PAL.P,
    });
    drawText(g, `Capacity: ${state.dailyCuration()} per day`, crewX, crewY + 56, {
      font: FONT.small,
      color: PAL.P,
    });

    // On the right of the crew panel: the backlog, stated as a number.
    // Curators are the bottleneck in this game, so the backlog is given
    // its own reading rather than only being a pile of sprites.
    //
    // The column starts at MARGIN_X + 560, not MARGIN_X + 600: the
    // crew's own readings run to about x=506, and Silkscreen is a wide
    // face, so the sentence about the backlog needs the room. It ran to
    // x=1055 -- off the canvas -- before.
    const backlogX = MARGIN_X + 560;
    drawText(g, 'Backlog', backlogX, crewY + 26, {
      font: FONT.small,
      color: PAL.P,
    });
    drawText(g, `${backlog} waiting`, backlogX, crewY + 42, {
      font: FONT.body,
      color: PAL.D,
    });
    drawText(
      g,
      backlog === 0
        ? 'The storeroom is clear.'
        : `About ${clearDays(daysToClear)} days to clear.`,
      backlogX,
      crewY + 56,
      { font: FONT.small, color: PAL.P }
    );

    return regions;
  }

  public draw(ctx: ScreenContext): void {
    const g = ctx.surface.ctx;
    const { state } = ctx;

    drawText(g, 'STOREROOM', 24, 62, { font: FONT.large, color: PAL.D });

    // A standing warning when the backlog is larger than a day's curation:
    // the player is losing finds.
    const raw = state.rawCount();
    const capacity = state.dailyCuration();
    if (raw > capacity * 2 && capacity > 0) {
      const text = `The pile is outgrowing the curators — ${raw} waiting, ${capacity} a day.`;
      // Rust on cream is 3.04:1, so the warning is written in dark ink
      // with a rust chip beside it. The chip is the alarm; the words are
      // the information.
      //
      // The warning is right-aligned against the right margin and is
      // given the whole run from the screen name to that margin, so it
      // is never cut: Silkscreen is a wide face, and the old 420-pixel
      // allowance cut it in the middle of the sentence.
      const tw = measureText(text, FONT.small);
      const tx = 936 - tw;
      drawChip(g, tx - 14, 70, PAL.T);
      drawText(g, text, tx, 68, {
        font: FONT.small,
        color: PAL.D,
        maxWidth: 936 - 250,
      });
    }
  }

  public hint(): string {
    return 'Raw finds become graded artefacts only after your curators work through them.';
  }
}
