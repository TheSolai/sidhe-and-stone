/**
 * The Goals screen.
 *
 * The milestone ladder, in order. Eighteen goals across three tiers, each
 * with a progress bar and a stated reward.
 *
 * The design constraint here is that the rewards must be meaningful without
 * replacing normal play. So the reward is always stated in the same terms
 * the player uses everywhere else -- money, charms, luck -- and the goals
 * themselves ask for things the player would do anyway: open the doors,
 * put something on show, keep the gallery full.
 *
 * WHY THE LADDER IS A LIST AND NOT THREE COLUMNS OF CARDS
 *
 * The tiers used to be drawn as three columns, one per tier, with each
 * goal as a small card carrying its title, its description, a bar and its
 * reward. The `Steady Trade` tier has EIGHT goals in it, and eight cards
 * of that height do not fit in the column -- the last two were drawn
 * straight over the navigation strip.
 *
 * So the ladder is now a compact list: one line per goal, carrying the
 * title and the reward, with the progress bar underneath. Eight of those
 * fit the column with room to spare, and the description of any goal is
 * one click away in the detail panel at the bottom, which shows the goal
 * you have selected -- or the next one, if you have not selected any.
 */

import { PAL } from '../palette.ts';
import type { GoalProgress } from '../../sim/game-state.ts';
import type { Region, Screen, ScreenContext } from '../screen.ts';
import { moneyNumber } from '../screen.ts';
import { CONTENT_TOP, FOOTER_PANEL_HEIGHT, FOOTER_TOP, MARGIN_X, PANEL_HEIGHT, PANEL_WIDTH } from '../bands.ts';
import { drawPanel, drawText, drawWell, FONT, measureText } from '../widgets.ts';
import { drawSprite, type SpriteSet } from '../sprites.ts';

/** The height of one goal row. */
const ROW_H = 26;

/** The width of the tier columns' contents. */
const TIER_TEXT_W = 265;

export class GoalsScreen implements Screen {
  public readonly id = 'goals';
  public readonly label = 'Goals';

  /** The goal the detail panel is showing. Null means "the next one". */
  private selectedId: string | null = null;

  public layout(ctx: ScreenContext): Region[] {
    const g = ctx.surface.ctx;
    const { state } = ctx;
    const regions: Region[] = [];
    const list = state.goalList();

    const panelH = PANEL_HEIGHT;
    drawPanel(g, { x: MARGIN_X, y: CONTENT_TOP, w: PANEL_WIDTH, h: panelH }, {
      fill: PAL.C,
      title: 'Milestones',
    });

    // The three tiers, as columns. The tier ORDER is the progression, so
    // it always reads left to right.
    const tiers: string[] = [];
    for (const gp of list) {
      if (!tiers.includes(gp.goal.tier)) tiers.push(gp.goal.tier);
    }

    const innerX = MARGIN_X + 8;
    const innerW = PANEL_WIDTH - 16;
    const colW = Math.floor((innerW - (tiers.length - 1) * 6) / tiers.length);
    const wellY = CONTENT_TOP + 36;
    const wellH = panelH - 50;

    let tx = innerX;
    for (const tier of tiers) {
      const wellW = colW - 8;
      drawWell(g, { x: tx, y: wellY, w: wellW, h: wellH }, PAL.W);

      drawText(g, tier, tx + 10, wellY + 6, {
        font: FONT.mid,
        color: PAL.D,
      });
      g.fillStyle = PAL.Y;
      g.fillRect(tx + 10, wellY + 24, wellW - 20, 2);

      let gy = wellY + 34;
      for (const gp of list.filter((x) => x.goal.tier === tier)) {
        this.drawGoal(g, gp, tx + 10, gy, TIER_TEXT_W, ctx.sprites);

        // Clicking a goal opens it in the detail panel below, so the
        // player can read what any of the eighteen asks of them without
        // the column having to carry the text.
        regions.push({
          x: tx + 10,
          y: gy - 2,
          w: wellW - 20,
          h: ROW_H,
          id: `goals:goal:${gp.goal.id}`,
          onClick: () => {
            this.selectedId = gp.goal.id;
          },
        });

        gy += ROW_H;
      }

      tx += colW;
    }

    // The detail panel: the selected goal, or the next one.
    const detail = this.detailGoal(ctx);
    drawPanel(g, { x: MARGIN_X, y: FOOTER_TOP, w: PANEL_WIDTH, h: FOOTER_PANEL_HEIGHT }, {
      fill: PAL.C,
      title: detail ? 'Next milestone' : 'Milestones',
    });

    if (!detail) {
      drawText(g, 'Every milestone reached. The museum is yours.', MARGIN_X + 20, FOOTER_TOP + 34, {
        font: FONT.body,
        color: PAL.D,
      });
    } else {
      const next = state.nextGoal();
      const isNext = next !== null && next.goal.id === detail.goal.id;

      // A chip marks the goal the player is working towards, so the
      // detail panel always says whether this is the one that counts.
      if (isNext) {
        g.fillStyle = PAL.Y;
        g.fillRect(MARGIN_X + 20, FOOTER_TOP + 30, 8, 8);
        g.fillStyle = PAL.K;
        g.fillRect(MARGIN_X + 20, FOOTER_TOP + 30, 8, 1);
        g.fillRect(MARGIN_X + 20, FOOTER_TOP + 30, 1, 8);
      }

      drawText(g, detail.goal.title, MARGIN_X + (isNext ? 34 : 20), FOOTER_TOP + 26, {
        font: FONT.mid,
        color: PAL.D,
      });
      drawText(g, detail.goal.body, MARGIN_X + 20, FOOTER_TOP + 46, {
        font: FONT.small,
        // Panel edge ink, not the mid brown N. N on the cream panel is
        // 4.06:1 -- under the floor for small text. P on cream is 8.32:1.
        color: PAL.P,
        maxWidth: 400,
      });

      const barX = MARGIN_X + 460;
      const barW = PANEL_WIDTH - 460 - 160;

      drawText(g, `${detail.progress} of ${detail.target}`, barX, FOOTER_TOP + 24, {
        font: FONT.small,
        color: PAL.P,
      });

      g.fillStyle = PAL.X;
      g.fillRect(barX, FOOTER_TOP + 42, barW, 12);
      const ratio = detail.target > 0 ? Math.min(1, detail.progress / detail.target) : 0;
      g.fillStyle = PAL.Y;
      g.fillRect(barX, FOOTER_TOP + 42, Math.round(barW * ratio), 12);
      g.fillStyle = PAL.K;
      g.fillRect(barX, FOOTER_TOP + 42, barW, 1);
      g.fillRect(barX, FOOTER_TOP + 53, barW, 1);
      g.fillRect(barX, FOOTER_TOP + 42, 1, 12);
      g.fillRect(barX + barW - 1, FOOTER_TOP + 42, 1, 12);

      // RULE 4.6: the coin carries the unit, so the reward figure is
      // naked and the coin is drawn on its leading side.
      const detailReward = this.rewardText(detail.goal);
      const detailRewardW = measureText(detailReward, FONT.small);
      if (detail.goal.reward.money !== undefined) {
        const coin = ctx.sprites.get('icon_coin');
        if (coin) {
          drawSprite(
            g,
            coin,
            MARGIN_X + PANEL_WIDTH - 20 - detailRewardW - 14,
            FOOTER_TOP + 42,
            1
          );
        }
      }
      drawText(g, detailReward, MARGIN_X + PANEL_WIDTH - 20, FOOTER_TOP + 40, {
        font: FONT.small,
        color: PAL.D,
        align: 'right',
      });
    }

    return regions;
  }

  /**
   * The goal the detail panel shows: the one the player clicked, or the
   * next one on the ladder.
   */
  private detailGoal(ctx: ScreenContext): GoalProgress | null {
    const list = ctx.state.goalList();
    if (this.selectedId !== null) {
      const found = list.find((x) => x.goal.id === this.selectedId);
      if (found) return found;
    }
    const next = ctx.state.nextGoal();
    if (!next) return null;
    return list.find((x) => x.goal.id === next.goal.id) ?? null;
  }

  /**
   * Draw one goal: a tick box, the title, the reward, and a bar.
   *
   * One line, so that a tier with eight goals fits the column. The
   * description is in the detail panel below instead.
   */
  private drawGoal(
    g: CanvasRenderingContext2D,
    gp: GoalProgress,
    x: number,
    y: number,
    w: number,
    sprites: SpriteSet
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
      // A hand-drawn tick. Dark ink, not white: white on the moss box is
      // 2.61:1 and the tick is the thing that says "done".
      g.fillStyle = PAL.K;
      g.fillRect(x + 3, y + 6, 2, 2);
      g.fillRect(x + 5, y + 8, 2, 2);
      g.fillRect(x + 7, y + 4, 2, 2);
    }

    // The reward, measured first, so the title knows how much room it
    // has left. Without this the longest title and the longest reward
    // would overlap on the same line.
    //
    // RULE 4.6: the coin carries the unit, so the figure itself is
    // naked -- no currency glyph, which measures 2.47:1 on cream.
    const reward = this.rewardText(goal);
    // The coin is 18 pixels wide, and it needs a four-pixel gap before
    // the number it belongs to. Reserving less than that puts the gold
    // disc UNDER the figure -- which is exactly what it did, and the
    // numbers were unreadable where they overlapped.
    const COIN_W = 18;
    const COIN_GAP = 4;
    const rewardW =
      Math.round(measureText(reward, FONT.tiny)) +
      (goal.reward.money !== undefined ? COIN_W + COIN_GAP : 0);

    // The title is dark ink either way. Moss on the white well is
    // 2.61:1 -- unreadable as a glyph -- and the tick box already
    // carries "done", so the colour was never carrying it alone.
    drawText(g, goal.title, x + 18, y, {
      font: FONT.small,
      color: gp.complete ? PAL.D : PAL.P,
      maxWidth: w - 18 - rewardW - 10,
    });

    // The coin sits on the LEADING side of the money figure (RULE 7.3),
    // so the pair is "coin then number" and reads as one unit.
    if (goal.reward.money !== undefined) {
      const coin = sprites.get('icon_coin');
      if (coin) drawSprite(g, coin, x + w - rewardW, y + 1, 1);
      // The number sits to the RIGHT of the coin: the picture carries
      // the unit, the figure carries the amount (RULE 7.3, RULE 4.6).
    }
    drawText(g, reward, x + w, y + 1, {
      font: FONT.tiny,
      color: gp.complete ? PAL.D : PAL.P,
      align: 'right',
    });

    // The progress bar, under the title.
    const barY = y + 15;
    const barW = w - 18;
    g.fillStyle = PAL.X;
    g.fillRect(x + 18, barY, barW, 5);
    const ratio = gp.target > 0 ? Math.min(1, gp.progress / gp.target) : 0;
    g.fillStyle = gp.complete ? PAL.M : PAL.Y;
    g.fillRect(x + 18, barY, Math.round(barW * ratio), 5);
  }

  /** The reward, written the way the player sees it elsewhere. */
  private rewardText(goal: { reward: { money?: number; charms?: number; luck?: number } }): string {
    const parts: string[] = [];
    // RULE 4.6: naked number -- the coin icon is drawn beside it.
    if (goal.reward.money !== undefined) parts.push(moneyNumber(goal.reward.money));
    if (goal.reward.charms !== undefined) parts.push(`${goal.reward.charms} charms`);
    if (goal.reward.luck !== undefined) parts.push(`+${goal.reward.luck.toFixed(2)} luck`);
    // No spaces around the separator: the reward shares a line with the
    // goal's title, and every pixel of that line is spoken for.
    return parts.join('·');
  }

  public draw(ctx: ScreenContext): void {
    const g = ctx.surface.ctx;
    const list = ctx.state.goalList();
    const done = list.filter((x) => x.complete).length;
    drawText(g, 'GOALS', 24, 62, { font: FONT.large, color: PAL.D });

    const text = `${done} of ${list.length} reached`;
    const tw = measureText(text, FONT.small);
    drawText(g, text, ctx.surface.canvas.width - 24 - tw, 68, {
      font: FONT.small,
      color: PAL.P,
    });
  }

  public hint(): string {
    return 'Click a milestone to read what it asks of you.';
  }
}
