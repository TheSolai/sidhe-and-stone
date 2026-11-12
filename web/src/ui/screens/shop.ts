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
 * The row size. Nine upgrades, one row each, inside the content band.
 *
 * THE LIST AND NOT A GRID OF CARDS
 *
 * The cards were three columns of three. A card is 297 wide, and the
 * longest description -- "A fortune teller makes the reel kinder." --
 * is 408 pixels wide in the bitmap face. It does not fit in a card at
 * any size the game can read, so it was being cut, and a cut
 * description is a shop that will not tell you what it sells.
 *
 * A row is 920 wide. The name, the description, how many you own, the
 * bar and the price all fit on one line of it, so nothing is cut.
 */
const ROW_H = 30;
const LIST_TOP = CONTENT_TOP + 4;

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

    // The nine upgrades, one row each.
    //
    // A row is the whole width of the panel, so the name, the
    // description, the count, the bar and the price all have room and
    // nothing has to be cut. RULE 10.2: the rows alternate their fills,
    // so the eye can run along the column of prices.
    for (let i = 0; i < UPGRADES.length; i += 1) {
      const def = UPGRADES[i];
      const kind = def.id;
      const rowY = LIST_TOP + i * ROW_H;

      const accent = UPGRADE_COLOR[kind] ?? PAL.U;
      const owned = state.upgradeCount(kind);
      const cost = state.upgradeCost(kind);
      const maxed = cost < 0;

      g.fillStyle = i % 2 === 0 ? PAL.C : PAL.W;
      g.fillRect(MARGIN_X, rowY, PANEL_WIDTH, ROW_H);

      // A colour band down the leading edge, so the nine upgrades are
      // told apart at a glance. The name is always written out as well
      // -- the colour never carries the meaning on its own.
      g.fillStyle = accent;
      g.fillRect(MARGIN_X + 1, rowY + 1, 5, ROW_H - 2);

      // The upgrade's own picture.
      const image = ctx.sprites.get(UPGRADE_SPRITE[kind] ?? '');
      if (image) {
        drawSprite(g, image, MARGIN_X + 12, rowY + 6, 1);
      } else {
        // A plain plate, so a missing sprite reads as an unfinished
        // drawing rather than as a hole in the interface.
        g.fillStyle = accent;
        g.fillRect(MARGIN_X + 12, rowY + 6, 18, 18);
        g.fillStyle = PAL.K;
        g.fillRect(MARGIN_X + 12, rowY + 6, 18, 1);
        g.fillRect(MARGIN_X + 12, rowY + 23, 18, 1);
        g.fillRect(MARGIN_X + 12, rowY + 6, 1, 18);
        g.fillRect(MARGIN_X + 29, rowY + 6, 1, 18);
      }

      // The name.
      drawText(g, UPGRADE_NAME[kind] ?? kind, MARGIN_X + 38, rowY + 7, {
        font: FONT.small,
        color: PAL.D,
        maxWidth: 195,
      });

      // What it does. The description is the sentence that tells the
      // player what the money buys, so it is never cut.
      drawText(g, UPGRADE_DESC[kind] ?? '', MARGIN_X + 240, rowY + 7, {
        font: FONT.small,
        color: PAL.P,
        maxWidth: 410,
      });

      // How many are owned, out of the cap. The cap matters: an upgrade
      // that cannot be bought again says so here, before the player
      // wastes money looking for it.
      drawText(g, `${owned} / ${def.max}`, MARGIN_X + 700, rowY + 9, {
        font: FONT.tiny,
        color: PAL.P,
        align: 'right',
      });

      // A bar showing how much of the cap is filled.
      const barX = MARGIN_X + 716;
      const barY = rowY + 12;
      const barW = 96;
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
      const btnW = 116;
      const btnH = 26;
      const btnX = MARGIN_X + PANEL_WIDTH - btnW - 4;
      const btnY = rowY + 2;

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
      FOOTER_TOP + 30,
      // The panel is 920 wide and nothing is drawn to the right of this
      // text, so the line has the whole panel. It used to be cut at 560
      // and the player saw "Every purchase is capital, n…" -- which
      // loses the entire point of the sentence.
      { font: FONT.body, color: PAL.D, maxWidth: PANEL_WIDTH - 40 }
    );
    drawText(
      g,
      'The ledger keeps investment apart from the daily bills.',
      MARGIN_X + 20,
      FOOTER_TOP + 48,
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
