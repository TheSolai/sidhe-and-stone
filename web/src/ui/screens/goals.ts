/**
 * The Goals screen.
 *
 * The milestone ladder, in order. Twelve goals across three tiers, each
 * with a progress bar and a stated reward.
 *
 * The design constraint here is that the rewards must be meaningful without
 * replacing normal play. So the reward is always stated in the same terms
 * the player uses everywhere else -- money, charms, luck -- and the goals
 * themselves ask for things the player would do anyway: open the doors,
 * put something on show, keep the gallery full.
 */

import { PAL } from '../palette.ts';
import type { GoalProgress } from '../../sim/game-state.ts';
import type { Region, Screen, ScreenContext } from '../screen.ts';
import { money } from '../screen.ts';
import { drawPanel, drawText, drawWell, FONT } from '../widgets.ts';

export class GoalsScreen implements Screen {
  public readonly id = 'goals';
  public readonly label = 'Goals';

  public layout(ctx: ScreenContext): Region[] {
    const g = ctx.surface.ctx;
    const { state } = ctx;
    const w = ctx.surface.canvas.width;

    const panelX = 20;
    const panelY = 92;
    const panelH = 300;

    drawPanel(g, { x: panelX, y: panelY, w: w - 40, h: panelH }, {
      fill: PAL.C,
      title: 'Milestones',
    });

    const list = state.goalList();

    // The three tiers, laid out as columns.
    const tiers: string[] = [];
    for (const gp of list) {
      if (!tiers.includes(gp.goal.tier)) tiers.push(gp.goal.tier);
    }

    const colW = Math.floor((w - 60) / Math.max(1, tiers.length));
    const wellY = panelY + 36;
    const wellH = panelH - 50;

    let tx = panelX + 20;

    for (const tier of tiers) {
      drawWell(g, { x: tx, y: wellY, w: colW - 10, h: wellH }, PAL.W);

      drawText(g, tier, tx + 12, wellY + 8, {
        font: FONT.mid,
        color: PAL.D,
      });
      g.fillStyle = PAL.Y;
      g.fillRect(tx + 12, wellY + 28, colW - 34, 2);

      let gy = wellY + 40;
      for (const gp of list.filter((x) => x.goal.tier === tier)) {
        this.drawGoal(g, gp, tx + 12, gy, colW - 34);
        gy += 52;
      }

      tx += colW;
    }

    // The current objective, highlighted at the bottom.
    const footY = panelY + panelH + 18;
    drawPanel(g, { x: panelX, y: footY, w: w - 40, h: 84 }, {
      fill: PAL.C,
      title: 'Next',
    });

    const next = state.nextGoal();
    if (!next) {
      drawText(g, 'Every milestone reached. The museum is yours.', panelX + 20, footY + 40, {
        font: FONT.body,
        color: PAL.G,
      });
    } else {
      drawText(g, next.goal.title, panelX + 20, footY + 36, {
        font: FONT.mid,
        color: PAL.D,
      });
      drawText(g, next.goal.body, panelX + 20, footY + 58, {
        font: FONT.small,
        color: PAL.N,
      });

      const barX = panelX + 420;
      const barW = w - barX - 220;
      drawText(
        g,
        `${next.progress} / ${next.target}`,
        barX,
        footY + 32,
        { font: FONT.small, color: PAL.N }
      );

      g.fillStyle = PAL.X;
      g.fillRect(barX, footY + 52, barW, 16);
      const ratio = next.target > 0 ? Math.min(1, next.progress / next.target) : 0;
      g.fillStyle = PAL.Y;
      g.fillRect(barX, footY + 52, Math.round(barW * ratio), 16);
      g.fillStyle = PAL.K;
      g.fillRect(barX, footY + 52, barW, 1);
      g.fillRect(barX, footY + 67, barW, 1);
      g.fillRect(barX, footY + 52, 1, 16);
      g.fillRect(barX + barW - 1, footY + 52, 1, 16);

      drawText(g, this.rewardText(next.goal), barX + barW + 14, footY + 52, {
        font: FONT.small,
        color: PAL.G,
      });
    }

    return [];
  }

  /** Draw one goal: its title, its bar, and whether it is done. */
  private drawGoal(
    g: CanvasRenderingContext2D,
    gp: GoalProgress,
    x: number,
    y: number,
    w: number
  ): void {
    const { goal } = gp;

    // A tick box, so completion is a shape and not only a colour.
    g.fillStyle = gp.complete ? PAL.M : PAL.W;
    g.fillRect(x, y, 12, 12);
    g.fillStyle = PAL.K;
    g.fillRect(x, y, 12, 1);
    g.fillRect(x, y + 11, 12, 1);
    g.fillRect(x, y, 1, 12);
    g.fillRect(x + 11, y, 1, 12);
    if (gp.complete) {
      // A hand-drawn tick.
      g.fillStyle = PAL.W;
      g.fillRect(x + 3, y + 6, 2, 2);
      g.fillRect(x + 5, y + 8, 2, 2);
      g.fillRect(x + 7, y + 4, 2, 2);
    }

    drawText(g, goal.title, x + 20, y - 1, {
      font: FONT.small,
      color: gp.complete ? PAL.M : PAL.D,
      maxWidth: w - 20,
    });

    drawText(g, goal.body, x + 20, y + 14, {
      font: FONT.tiny,
      color: PAL.P,
      maxWidth: w - 20,
    });

    // The progress bar.
    const barY = y + 30;
    g.fillStyle = PAL.X;
    g.fillRect(x + 20, barY, w - 20, 6);
    const ratio = gp.target > 0 ? Math.min(1, gp.progress / gp.target) : 0;
    g.fillStyle = gp.complete ? PAL.M : PAL.Y;
    g.fillRect(x + 20, barY, Math.round((w - 20) * ratio), 6);

    drawText(g, this.rewardText(goal), x + 20, barY + 8, {
      font: FONT.tiny,
      color: gp.complete ? PAL.M : PAL.G,
      maxWidth: w - 20,
    });
  }

  /** The reward, written the way the player sees it elsewhere. */
  private rewardText(goal: { reward: { money?: number; charms?: number; luck?: number } }): string {
    const parts: string[] = [];
    if (goal.reward.money !== undefined) parts.push(money(goal.reward.money));
    if (goal.reward.charms !== undefined) parts.push(`${goal.reward.charms} charms`);
    if (goal.reward.luck !== undefined) parts.push(`+${goal.reward.luck.toFixed(2)} luck`);
    return parts.join('  ·  ');
  }

  public draw(ctx: ScreenContext): void {
    const g = ctx.surface.ctx;
    const list = ctx.state.goalList();
    const done = list.filter((x) => x.complete).length;
    drawText(g, 'GOALS', 24, 62, { font: FONT.large, color: PAL.D });

    const text = `${done} of ${list.length} reached`;
    g.font = FONT.small;
    const tw = g.measureText(text).width;
    drawText(g, text, ctx.surface.canvas.width - 24 - tw, 68, {
      font: FONT.small,
      color: PAL.N,
    });
  }

  public hint(): string {
    return 'Milestones reward steady progress. They are not a substitute for running the museum.';
  }
}
