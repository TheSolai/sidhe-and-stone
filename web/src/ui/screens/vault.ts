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
import { money } from '../screen.ts';
import { drawSprite } from '../sprites.ts';
import { drawPanel, drawText, FONT } from '../widgets.ts';

export class VaultScreen implements Screen {
  public readonly id = 'vault';
  public readonly label = 'Vault';

  public layout(ctx: ScreenContext): Region[] {
    const g = ctx.surface.ctx;
    const { state } = ctx;
    const regions: Region[] = [];

    const panelX = 20;
    const panelY = 92;
    const panelW = ctx.surface.canvas.width - 40;
    const panelH = 300;

    drawPanel(g, { x: panelX, y: panelY, w: panelW, h: panelH }, {
      fill: PAL.C,
      title: 'Vault',
    });

    const vaultCounts = state.vaultCounts();
    const galleryCounts = state.galleryCounts();

    // The four grade columns.
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
        color: vaulted > 0 ? PAL.K : PAL.P,
      });
      drawText(g, `On show: ${shown}`, cx + 8, statsY + 17, {
        font: FONT.small,
        color: shown > 0 ? PAL.K : PAL.P,
      });
      drawText(g, `Value: ${money(value)}/day`, cx + 8, statsY + 34, {
        font: FONT.small,
        color: PAL.N,
      });

      // The theft risk, stated as a number and a word. A bare percentage
      // would be meaningless to most players.
      const riskColor = risk > 0.08 ? PAL.T : PAL.N;
      drawText(g, `Stolen nightly: ${(risk * 100).toFixed(1)}%`, cx + 8, statsY + 51, {
        font: FONT.small,
        color: riskColor,
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
        fill: string = PAL.C
      ) => {
        g.fillStyle = enabled ? fill : PAL.X;
        g.fillRect(bx, by, bw, 26);
        g.fillStyle = enabled ? PAL.W : PAL.P;
        g.fillRect(bx + 1, by + 1, bw - 2, 1);
        g.fillStyle = PAL.K;
        g.fillRect(bx, by, bw, 1);
        g.fillRect(bx, by + 25, bw, 1);
        g.fillRect(bx, by, 1, 26);
        g.fillRect(bx + bw - 1, by, 1, 26);
        drawText(g, label, bx + bw / 2, by + 8, {
          font: FONT.small,
          color: enabled ? PAL.K : PAL.P,
          align: 'center',
          maxWidth: bw - 6,
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
        PAL.M
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
        `Sell one (${money(value / 2)})`,
        vaulted > 0,
        `vault:sell:${grade}`,
        () => {
          state.sellOne(grade);
        },
        PAL.U
      );

      cx += colW;
    }

    // The slots summary along the bottom.
    const footY = panelY + panelH + 18;
    drawPanel(g, { x: panelX, y: footY, w: panelW, h: 84 }, {
      fill: PAL.C,
      title: 'The gallery floor',
    });

    drawText(
      g,
      `${state.onDisplay()} of ${state.gallerySlots()} slots filled  ·  demand for ${state.demand()} today`,
      panelX + 20,
      footY + 38,
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
      footY + 58,
      { font: FONT.small, color: PAL.N }
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
