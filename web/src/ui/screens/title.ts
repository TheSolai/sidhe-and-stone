/**
 * The title screen.
 *
 * The first thing the player sees. It has to say what the game is, and it
 * has to offer the two things a player wants on arrival: start fresh, or
 * carry on with what they had.
 */

import { PAL } from '../palette.ts';
import type { Screen, ScreenContext } from '../screen.ts';
import { drawPanel, drawText, drawDitherGradient, FONT } from '../widgets.ts';
import { drawSprite } from '../sprites.ts';

export class TitleScreen implements Screen {
  public readonly id = 'title';
  public readonly label = 'Title';

  /** Set by the app when the screen is built. */
  public onNew: () => void = () => {};
  public onContinue: () => void = () => {};
  public onSettings: () => void = () => {};

  public hasSave = false;

  public layout(ctx: ScreenContext) {
    const g = ctx.surface.ctx;
    const cx = ctx.surface.canvas.width / 2;
    const regions = [];

    const bw = 220;
    const bh = 40;
    const bx = cx - bw / 2;

    // New game.
    const newY = 330;
    g.fillStyle = PAL.Y;
    g.fillRect(bx, newY, bw, bh);
    g.fillStyle = PAL.H;
    g.fillRect(bx + 1, newY + 1, bw - 2, 1);
    g.fillStyle = PAL.A;
    g.fillRect(bx + 1, newY + bh - 2, bw - 2, 1);
    g.fillStyle = PAL.K;
    g.fillRect(bx, newY, bw, 1);
    g.fillRect(bx, newY + bh - 1, bw, 1);
    g.fillRect(bx, newY, 1, bh);
    g.fillRect(bx + bw - 1, newY, 1, bh);
    drawText(g, 'New Museum', bx + bw / 2, newY + 12, {
      font: FONT.mid,
      color: PAL.K,
      align: 'center',
    });
    regions.push({
      x: bx,
      y: newY,
      w: bw,
      h: bh,
      id: 'title:new',
      onClick: () => this.onNew(),
    });

    // Continue.
    const contY = newY + bh + 12;
    g.fillStyle = this.hasSave ? PAL.C : PAL.X;
    g.fillRect(bx, contY, bw, bh);
    g.fillStyle = this.hasSave ? PAL.W : PAL.P;
    g.fillRect(bx + 1, contY + 1, bw - 2, 1);
    g.fillStyle = PAL.K;
    g.fillRect(bx, contY, bw, 1);
    g.fillRect(bx, contY + bh - 1, bw, 1);
    g.fillRect(bx, contY, 1, bh);
    g.fillRect(bx + bw - 1, contY, 1, bh);
    drawText(g, 'Continue', bx + bw / 2, contY + 12, {
      font: FONT.mid,
      color: this.hasSave ? PAL.K : PAL.P,
      align: 'center',
    });
    regions.push({
      x: bx,
      y: contY,
      w: bw,
      h: bh,
      id: 'title:continue',
      enabled: this.hasSave,
      onClick: () => this.onContinue(),
    });

    // Settings.
    const setY = contY + bh + 12;
    g.fillStyle = PAL.C;
    g.fillRect(bx, setY, bw, 30);
    g.fillStyle = PAL.W;
    g.fillRect(bx + 1, setY + 1, bw - 2, 1);
    g.fillStyle = PAL.K;
    g.fillRect(bx, setY, bw, 1);
    g.fillRect(bx, setY + 29, bw, 1);
    g.fillRect(bx, setY, 1, 30);
    g.fillRect(bx + bw - 1, setY, 1, 30);
    drawText(g, 'Settings', bx + bw / 2, setY + 8, {
      font: FONT.small,
      color: PAL.K,
      align: 'center',
    });
    regions.push({
      x: bx,
      y: setY,
      w: bw,
      h: 30,
      id: 'title:settings',
      onClick: () => this.onSettings(),
    });

    return regions;
  }

  public draw(ctx: ScreenContext): void {
    const g = ctx.surface.ctx;
    const w = ctx.surface.canvas.width;
    const h = ctx.surface.canvas.height;

    // A warm sky behind the title, so the screen is not a flat panel.
    // Dithered rather than a smooth gradient: a smooth one would
    // interpolate to colours outside the shared palette.
    drawDitherGradient(g, 0, 0, w, h, PAL.W, PAL.C, 18);

    // Rolling ground along the bottom.
    g.fillStyle = PAL.M;
    g.fillRect(0, h - 84, w, 40);
    g.fillStyle = PAL.A;
    g.fillRect(0, h - 84, w, 6);
    g.fillStyle = PAL.N;
    g.fillRect(0, h - 44, w, 44);

    // The title, on a banner.
    const bw = 520;
    const bx = (w - bw) / 2;
    const by = 92;
    drawPanel(g, { x: bx, y: by, w: bw, h: 92 }, { fill: PAL.D, raised: false });

    drawText(g, 'SIDHE & STONE', w / 2, by + 16, {
      font: FONT.huge,
      color: PAL.G,
      align: 'center',
      maxWidth: bw - 24,
    });
    drawText(g, 'a small excavation, a smaller museum', w / 2, by + 62, {
      font: FONT.small,
      color: PAL.Z,
      align: 'center',
    });

    // The artwork, as a row of the museum's contents.
    const icons = [
      'artefact_crown',
      'artefact_relic',
      'artefact_clay',
      'artefact_rubble',
    ];
    const iconSize = 26;
    const gap = 18;
    const total = icons.length * iconSize + (icons.length - 1) * gap;
    let ix = (w - total) / 2;
    for (const name of icons) {
      const image = ctx.sprites.get(name);
      if (image) {
        drawSprite(g, image, Math.round(ix), h - 120, 2);
      }
      ix += iconSize + gap;
    }

    // The curator, standing to one side.
    const curator = ctx.sprites.get('curator');
    if (curator) {
      drawSprite(g, curator, 120, h - 150, 3);
    }

    // A caption at the bottom.
    drawText(g, 'Dig  ·  Catalogue  ·  Display  ·  Take the takings', w / 2, h - 62, {
      font: FONT.small,
      color: PAL.W,
      align: 'center',
    });

    // The version and a hint, small and unobtrusive.
    drawText(g, 'Web port — economy verified identical to the Godot build', 14, h - 24, {
      font: FONT.tiny,
      color: PAL.N,
    });
  }
}
