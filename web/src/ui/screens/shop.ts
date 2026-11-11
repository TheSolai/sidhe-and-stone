/**
 * The Upgrades screen.
 *
 * This screen exists because the simulation has nine kinds of upgrade and
 * the web build had no way to buy any of them. The Godot build has had a
 * Staff tab for a while; this is the browser equivalent, and it is the
 * first screen in the web build that spends money.
 *
 * The screen is a shop, so it has to answer three questions at a glance:
 * what does it cost, what does it do, and can I afford it right now. The
 * cost is on the button because that is where the player's eye goes
 * first. The description sits directly under the name, in the same words
 * used everywhere else in the game. The affordability is carried by the
 * button's own state rather than by a line of prose, so a player who
 * cannot afford something sees it immediately instead of reading a
 * sentence about it.
 *
 * Every upgrade is capital, not running cost. That is the single most
 * important thing to understand about this screen, so it is stated in
 * plain words at the bottom rather than left for the player to infer
 * from the ledger.
 */

import { PAL, UPGRADE_COLOR, UPGRADE_DESC, UPGRADE_NAME } from '../palette.ts';
import { UPGRADES } from '../../sim/sim-core.ts';
import type { Region, Screen, ScreenContext } from '../screen.ts';
import { moneyNumber } from '../screen.ts';
import { drawSprite } from '../sprites.ts';
import { drawBevelButton, drawPanel, drawText, FONT } from '../widgets.ts';
import {
  CONTENT_TOP,
  FOOTER_PANEL_HEIGHT,
  FOOTER_TOP,
  MARGIN_X,
  PANEL_WIDTH,
} from '../bands.ts';

/**
 * The card size. Three columns of three, inside the content band.
 *
 * The cards are 94 tall rather than 118 because the content band is 312
 * tall and three rows of 118 do not fit in it: the third row used to end
 * at y=474, which is inside the footer band and hard against the hint.
 */
const CARD_W = 297;
const CARD_H = 94;
const CARD_GAP_X = 14;
const CARD_GAP_Y = 12;
const TOP_Y = CONTENT_TOP + 4;

/** The sprite for each upgrade, when the art exists. */
const UPGRADE_SPRITE: Record<string, string> = {
  site: 'upgrade_site',
  curator: 'upgrade_curator',
  gallery: 'upgrade_gallery',
  omen: 'upgrade_omen',
  diggers: 'upgrade_diggers',
  excavators: 'upgrade_excavators',
  guides: 'upgrade_guides',
  archivists: 'upgrade_archivists',
  wards: 'upgrade_wards',
};

export class ShopScreen implements Screen {
  public readonly id = 'shop';
  public readonly label = 'Upgrades';

  public layout(ctx: ScreenContext): Region[] {
    const g = ctx.surface.ctx;
    const { state } = ctx;
    const regions: Region[] = [];

    const cardW = CARD_W;
    const cardH = CARD_H;

    for (let i = 0; i < UPGRADES.length; i += 1) {
      const def = UPGRADES[i];
      const kind = def.id;
      const col = i % 3;
      const row = Math.floor(i / 3);

      const cx = MARGIN_X + col * (cardW + CARD_GAP_X);
      const cy = TOP_Y + row * (cardH + CARD_GAP_Y);

      const accent = UPGRADE_COLOR[kind] ?? PAL.U;
      const owned = state.upgradeCount(kind);
      const cost = state.upgradeCost(kind);
      const maxed = cost < 0;

      // RULE 10.2: a wide table alternates its row fills, so the eye can
      // run along a row of prices without losing its place.
      drawPanel(g, { x: cx, y: cy, w: cardW, h: cardH }, {
        fill: row % 2 === 0 ? PAL.C : PAL.W,
      });

      // A colour band down the left edge, so the nine cards are told apart
      // at a glance. The name is always written out as well -- the colour
      // never carries the meaning on its own.
      g.fillStyle = accent;
      g.fillRect(cx + 1, cy + 1, 5, cardH - 2);

      // The upgrade's own picture.
      const image = ctx.sprites.get(UPGRADE_SPRITE[kind] ?? '');
      if (image) {
        drawSprite(g, image, cx + 14, cy + 6, 2);
      } else {
        // A plain plate, so a missing sprite reads as an unfinished
        // drawing rather than as a hole in the interface.
        g.fillStyle = accent;
        g.fillRect(cx + 14, cy + 6, 32, 32);
        g.fillStyle = PAL.K;
        g.fillRect(cx + 14, cy + 6, 32, 1);
        g.fillRect(cx + 14, cy + 37, 32, 1);
        g.fillRect(cx + 14, cy + 6, 1, 32);
        g.fillRect(cx + 45, cy + 6, 1, 32);
      }

      // The name.
      drawText(g, UPGRADE_NAME[kind] ?? kind, cx + 54, cy + 7, {
        font: FONT.mid,
        color: PAL.D,
        maxWidth: cardW - 130,
      });

      // How many are owned, out of the cap. The cap matters: an upgrade
      // that cannot be bought again says so here, before the player
      // wastes money looking for it.
      drawText(g, `${owned} / ${def.max}`, cx + cardW - 12, cy + 10, {
        font: FONT.small,
        color: PAL.P,
        align: 'right',
      });

      // What it does.
      drawText(g, UPGRADE_DESC[kind] ?? '', cx + 14, cy + 44, {
        font: FONT.small,
        color: PAL.P,
        maxWidth: cardW - 28,
      });

      // A bar showing how much of the cap is filled.
      const barX = cx + 14;
      const barY = cy + 60;
      const barW = 140;
      g.fillStyle = PAL.X;
      g.fillRect(barX, barY, barW, 6);
      const ratio = def.max > 0 ? Math.min(1, owned / def.max) : 0;
      g.fillStyle = accent;
      g.fillRect(barX, barY, Math.round(barW * ratio), 6);
      g.fillStyle = PAL.K;
      g.fillRect(barX, barY, barW, 1);
      g.fillRect(barX, barY + 5, barW, 1);
      g.fillRect(barX, barY, 1, 6);
      g.fillRect(barX + barW - 1, barY, 1, 6);

      // The price. A capped upgrade says MAX instead, because there is
      // nothing left to buy.
      const btnX = cx + cardW - 118;
      const btnY = cy + cardH - 34;
      const btnW = 106;
      const btnH = 26;

      if (maxed) {
        drawBevelButton(g, {
          rect: { x: btnX, y: btnY, w: btnW, h: btnH },
          label: 'MAX',
          enabled: false,
        });
      } else {
        const affordable = state.money() >= cost;
        // RULE 4.6: the coin carries the unit, so the price is a picture
        // and a number. RULE 3.1: the button is bevelled, with a flat
        // face and a light top-left edge.
        drawBevelButton(g, {
          rect: { x: btnX, y: btnY, w: btnW, h: btnH },
          label: moneyNumber(cost),
          enabled: affordable,
          icon: 'icon_coin',
          sprites: ctx.sprites,
          pressed: ctx.pressedRegionId === `shop:buy:${kind}`,
        });
        regions.push({
          x: btnX,
          y: btnY,
          w: btnW,
          h: btnH,
          id: `shop:buy:${kind}`,
          enabled: affordable,
          onClick: () => {
            state.buyUpgrade(kind);
          },
        });
      }
    }

    // The footer note.
    //
    // This line used to be drawn at canvas.height - 58, which is y=482 --
    // inside the framework's hint band. The framework owns that band, so
    // the screen's own most important sentence was competing with the
    // hint for the same strip of pixels. It now lives in the footer
    // band, which belongs to the screen.
    drawPanel(g, { x: MARGIN_X, y: FOOTER_TOP, w: PANEL_WIDTH, h: FOOTER_PANEL_HEIGHT }, {
      fill: PAL.C,
      title: 'What a purchase is',
    });
    drawText(
      g,
      'Every purchase is capital, not running cost. It raises what you can earn later.',
      MARGIN_X + 20,
      FOOTER_TOP + 32,
      // The panel is 920 wide and nothing is drawn to the right of this
      // text, so the line has the whole panel. It used to be cut at 560
      // and the player saw "Every purchase is capital, n…" -- which
      // loses the entire point of the sentence.
      { font: FONT.body, color: PAL.D, maxWidth: PANEL_WIDTH - 40 }
    );
    drawText(
      g,
      'The ledger keeps investment apart from the daily bills, so a big purchase never looks like a losing day.',
      MARGIN_X + 20,
      FOOTER_TOP + 50,
      { font: FONT.small, color: PAL.P, maxWidth: PANEL_WIDTH - 40 }
    );

    return regions;
  }

  public draw(ctx: ScreenContext): void {
    const g = ctx.surface.ctx;
    const { state } = ctx;

    drawText(g, 'UPGRADES', 24, 62, { font: FONT.large, color: PAL.D });

    // How much of the outfit is built. On the right, opposite the title.
    let owned = 0;
    let possible = 0;
    for (const u of UPGRADES) {
      owned += state.upgradeCount(u.id);
      possible += u.max;
    }
    const text = `${owned} of ${possible} bought`;
    const tw = ctx.surface.canvas.width - 24;
    drawText(g, text, tw, 68, {
      font: FONT.small,
      color: PAL.P,
      align: 'right',
    });

  }

  public hint(): string {
    return 'Upgrades are permanent. Each one costs more than the last.';
  }
}
