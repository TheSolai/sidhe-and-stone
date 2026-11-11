/**
 * The Storeroom (curator) screen.
 *
 * Where dirty finds arrive. The curators work here: they clean and label
 * what comes up, turning raw lumps into graded artefacts. Curators are the
 * bottleneck in the game, so this screen exists to make the backlog visible
 * -- a growing pile of raw finds is a problem the player can see and fix.
 */

import { PAL } from '../palette.ts';
import { GRADES, GRADE_SPRITE } from '../palette.ts';
import type { Region, Screen, ScreenContext } from '../screen.ts';
import { drawSprite } from '../sprites.ts';
import { drawPanel, drawText, FONT } from '../widgets.ts';

export class CuratorScreen implements Screen {
  public readonly id = 'curator';
  public readonly label = 'Storeroom';

  public layout(ctx: ScreenContext): Region[] {
    const g = ctx.surface.ctx;
    const { state } = ctx;
    const regions: Region[] = [];
    const w = ctx.surface.canvas.width;

    // The raw pile, on the left.
    const rawX = 20;
    const rawY = 92;
    const rawW = 300;
    const rawH = 260;

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
        color: PAL.N,
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
          color: PAL.N,
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
    const tableW = w - tableX - 20;

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

    let ry = rawY + 48;
    if (rows.length === 0) {
      drawText(g, 'Nothing waiting.', tableX + 20, ry, {
        font: FONT.body,
        color: PAL.N,
      });
    } else {
      for (const row of rows) {
        const image = ctx.sprites.get(GRADE_SPRITE[row.grade]);
        if (image) {
          drawSprite(g, image, tableX + 20, ry - 2, 1);
        }
        drawText(g, row.grade, tableX + 44, ry + 3, {
          font: FONT.body,
          color: PAL.D,
        });
        drawText(g, `×${row.count}`, tableX + 160, ry + 3, {
          font: FONT.body,
          color: PAL.K,
        });
        ry += 30;
      }
    }

    // The curators themselves, with what they can handle.
    const crewY = rawY + rawH + 22;
    drawPanel(g, { x: tableX, y: crewY, w: tableW, h: 96 }, {
      fill: PAL.C,
      title: 'Your crew',
    });

    const curatorSprite = ctx.sprites.get('curator');
    if (curatorSprite) {
      drawSprite(g, curatorSprite, tableX + 20, crewY + 34, 2);
    }

    drawText(g, `${state.curators()} curator${state.curators() === 1 ? '' : 's'}`, tableX + 70, crewY + 40, {
      font: FONT.body,
      color: PAL.D,
    });
    drawText(g, `${state.curatorCapacity()} find${state.curatorCapacity() === 1 ? '' : 's'} each per day`, tableX + 70, crewY + 58, {
      font: FONT.small,
      color: PAL.N,
    });
    drawText(g, `Capacity: ${state.dailyCuration()} per day`, tableX + 70, crewY + 74, {
      font: FONT.small,
      color: PAL.N,
    });

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
      drawText(g, text, ctx.surface.canvas.width - 24 - 420, 68, {
        font: FONT.small,
        color: PAL.T,
        maxWidth: 420,
      });
    }
  }

  public hint(): string {
    return 'Raw finds become graded artefacts only after your curators work through them.';
  }
}
