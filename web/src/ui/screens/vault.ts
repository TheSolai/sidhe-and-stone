/**
 * The Vault screen.
 *
 * This is where the game's central decision is made: what goes on show and
 * what stays in the vault. A displayed artefact earns every day, but it can
 * be stolen overnight. A vaulted one is safe and earns nothing.
 *
 * The screen makes that trade explicit. Each grade shows its theft risk
 * beside its daily value, so the choice is informed rather than a guess.
 */

import { PAL, GRADES, GRADE_SPRITE, GRADE_COLOR } from '../palette.ts';
import type { Region, Screen, ScreenContext } from '../screen.ts';
import { moneyNumber } from '../screen.ts';
import { drawSprite } from '../sprites.ts';
import { drawBevelButton, drawChip, drawPanel, drawText, FONT } from '../widgets.ts';
import { FOOTER_PANEL_HEIGHT, FOOTER_TOP, MARGIN_X, PANEL_WIDTH } from '../bands.ts';

export class VaultScreen implements Screen {
  public readonly id = 'vault';
  public readonly label = 'Vault';

  public layout(ctx: ScreenContext): Region[] {
    const g = ctx.surface.ctx;
    const { state } = ctx;
    const regions: Region[] = [];

    const panelX = MARGIN_X;
    const panelY = 92;
    const panelW = PANEL_WIDTH;
    const panelH = 294;

    drawPanel(g, { x: panelX, y: panelY, w: panelW, h: panelH }, {
      fill: PAL.C,
      title: 'Vault',
    });

    const vaultCounts = state.vaultCounts();
    const galleryCounts = state.galleryCounts();

    // One column per grade. Six grades now, so each column is 146px wide
    // rather than 220px -- every label in here is measured to fit that,
    // because a label that runs into the next column makes two grades
    // read as one.
    const colW = Math.floor((panelW - 40) / GRADES.length);
    let cx = panelX + 20;

    for (const grade of GRADES) {
      const vaulted = vaultCounts.get(grade) ?? 0;
      const shown = galleryCounts.get(grade) ?? 0;
      const value = state.exhibitValue(grade);
      const risk = state.theftChance(grade);

      // The artefact's own picture, large.
      const image = ctx.sprites.get(GRADE_SPRITE[grade]);
      if (image) {
        drawSprite(g, image, cx + Math.round((colW - image.width * 2) / 2), panelY + 44, 2);
      }

      // The grade's colour as a band under the picture.
      g.fillStyle = GRADE_COLOR[grade] ?? PAL.N;
      g.fillRect(cx + 10, panelY + 92, colW - 20, 4);

      drawText(g, grade, cx + colW / 2, panelY + 102, {
        font: FONT.mid,
        color: PAL.D,
        align: 'center',
      });

      const statsY = panelY + 130;
      drawText(g, `In vault: ${vaulted}`, cx + 8, statsY, {
        font: FONT.small,
        color: vaulted > 0 ? PAL.D : PAL.P,
        maxWidth: colW - 16,
      });
      drawText(g, `On show: ${shown}`, cx + 8, statsY + 17, {
        font: FONT.small,
        color: shown > 0 ? PAL.D : PAL.P,
        maxWidth: colW - 16,
      });
      // RULE 4.6: the coin carries the unit, so the figure is a picture
      // and a number rather than a number and a currency mark.
      const coin = ctx.sprites.get('icon_coin');
      if (coin) drawSprite(g, coin, cx + 8, statsY + 32, 1);
      drawText(g, `${moneyNumber(value)}/day`, cx + 30, statsY + 34, {
        font: FONT.small,
        color: PAL.D,
        maxWidth: colW - 38,
      });

      // The theft risk, stated as a number and a word. A bare percentage
      // would be meaningless to most players. The label is short on
      // purpose: at 146px a column has room for one word and a number.
      // The theft risk is a number in dark ink with a chip beside it.
      // Rust as text on cream is only 3.04:1, so the chip carries the
      // warning and the ink carries the value.
      drawChip(g, cx + 8, statsY + 53, risk > 0.08 ? PAL.T : PAL.M, 7);
      drawText(g, `Theft ${(risk * 100).toFixed(1)}%`, cx + 20, statsY + 51, {
        font: FONT.small,
        color: PAL.D,
        maxWidth: colW - 28,
      });

      // The buttons: display one, vault one, sell one.
      const bw = colW - 26;
      const bx = cx + 13;
      let by = panelY + 208;

      const button = (
        label: string,
        enabled: boolean,
        id: string,
        onClick: () => void,
        primary = false
      ) => {
        // RULE 3.1: a bevelled 3D button -- a light edge along the top
        // and left, a dark edge along the bottom and right, and a flat
        // face.
        // RULE 9.2: ONE accent on the screen, and it is the primary
        // action. The other two buttons are plain cream.
        drawBevelButton(g, {
          rect: { x: bx, y: by, w: bw, h: 26 },
          label,
          enabled,
          primary: primary && enabled,
          font: FONT.small,
          pressed: ctx.pressedRegionId === id,
        });
        regions.push({ x: bx, y: by, w: bw, h: 26, id, enabled, onClick });
        by += 32;
      };

      // Display is only possible if there is a free slot.
      const free = state.slotsFree();
      button(
        'Display one',
        vaulted > 0 && free > 0,
        `vault:display:${grade}`,
        () => {
          state.displayOne(grade);
        },
        true
      );

      button(
        'Vault one',
        shown > 0,
        `vault:putaway:${grade}`,
        () => {
          state.vaultOne(grade);
        }
      );

      // Selling is only for artefacts already in the vault, and it gives
      // half the daily value.
      button(
        `Sell one (${moneyNumber(value / 2)})`,
        vaulted > 0,
        `vault:sell:${grade}`,
        () => {
          state.sellOne(grade);
        }
      );

      cx += colW;
    }

    // The slots summary along the bottom.
    const footY = FOOTER_TOP;
    drawPanel(g, { x: panelX, y: footY, w: panelW, h: FOOTER_PANEL_HEIGHT }, {
      fill: PAL.C,
      title: 'The gallery floor',
    });

    drawText(
      g,
      `${state.onDisplay()} of ${state.gallerySlots()} slots filled  ·  demand for ${state.demand()} today`,
      panelX + 20,
      footY + 32,
      { font: FONT.body, color: PAL.D }
    );

    // The demand note, spelled out: exhibits beyond the cap earn nothing
    // but are still exposed to theft.
    const free = state.slotsFree();
    drawText(
      g,
      free === 0
        ? 'The floor is full. Anything beyond the cap earns nothing — but it can still be stolen.'
        : 'Exhibits past the demand cap earn nothing, but they are still exposed to theft.',
      panelX + 20,
      footY + 52,
      { font: FONT.small, color: PAL.P }
    );

    return regions;
  }

  public draw(ctx: ScreenContext): void {
    const g = ctx.surface.ctx;
    drawText(g, 'VAULT', 24, 62, { font: FONT.large, color: PAL.D });
  }

  public hint(): string {
    return 'Displayed artefacts earn every day and can be stolen. Vaulted ones are safe and earn nothing.';
  }
}
