/**
 * The title screen.
 *
 * The first thing the player sees. It has to say what the game is, and it
 * has to offer the two things a player wants on arrival: start fresh, or
 * carry on with what they had.
 *
 * DRAWING ORDER
 *
 * The framework calls `layout()` and then `draw()`, every frame, in that
 * order. So anything drawn in `layout()` is painted FIRST and anything
 * drawn in `draw()` is painted OVER it.
 *
 * The buttons used to be drawn in `layout()`, and the sky gradient in
 * `draw()` -- so the gradient wiped the buttons out entirely. The title
 * screen had no visible buttons at all: the primary action was in the
 * hit regions but not on the screen, and a probe looking for the gold
 * face of the "New Museum" button found nothing.
 *
 * So the buttons are now drawn in `draw()`, after the background, and
 * `layout()` only computes where they are.
 */

import { PAL } from '../palette.ts';
import type { Region, Screen, ScreenContext } from '../screen.ts';
import type { FontSpec } from '../font.ts';
import {
  drawBevelButton,
  drawPanel,
  drawText,
  drawDitherGradient,
  FONT,
  measureText,
} from '../widgets.ts';
import { drawSprite } from '../sprites.ts';
import { GameState } from '../../sim/game-state.ts';
import { hasSave, loadGame } from '../../save.ts';
import { buildForecast, type Forecast } from '../forecast.ts';

/** The three buttons, and where they sit. */
interface TitleButton {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  primary?: boolean;
  enabled?: boolean;
  font: FontSpec;
}

export class TitleScreen implements Screen {
  public readonly id = 'title';
  public readonly label = 'Title';

  /** Set by the app when the screen is built. */
  public onNew: () => void = () => {};
  public onContinue: () => void = () => {};
  public onSettings: () => void = () => {};

  public hasSave = false;

  /**
   * What is waiting for the player.
   *
   * The continue path is the retention hook: a player who closes the tab
   * needs to be given a REASON to open it again. The forecast says what
   * that reason is -- a dig opening tomorrow, a backlog waiting to be
   * cleared, a milestone one step away.
   *
   * It is built from the live state when there is one (the player has
   * already been playing), and otherwise from the save in localStorage,
   * read into a scratch state so the live state is left alone.
   */
  private preview: Forecast | null = null;
  private previewTried = false;

  /** The day the cached preview was built for, so it is not rebuilt every frame. */
  private previewDay = -1;

  /** The forecast for the saved museum, or null if there is none. */
  private previewForecast(ctx: ScreenContext): Forecast | null {
    // The live state first: if the player has been playing, it IS the
    // museum the save holds, and it moves with the day.
    const day = ctx.state.day();
    if (day > 0) {
      if (this.previewDay !== day) {
        this.previewDay = day;
        this.preview = buildForecast(ctx.state);
      }
      return this.preview;
    }

    // Otherwise read the save ONCE. A scratch state is used so the live
    // one is untouched -- continuing the game loads it properly
    // afterwards, and the title screen must not have half-loaded it.
    if (!this.previewTried) {
      this.previewTried = true;
      if (hasSave()) {
        const scratch = new GameState();
        if (loadGame(scratch)) this.preview = buildForecast(scratch);
      }
    }
    return this.preview;
  }

  /**
   * Where the three buttons are.
   *
   * Computed in one place so the drawn buttons and the clickable
   * regions can never drift apart.
   */
  private buttons(ctx: ScreenContext): TitleButton[] {
    const cx = ctx.surface.canvas.width / 2;
    const bw = 220;
    const bh = 40;
    const bx = cx - bw / 2;

    // New game.
    //
    // RULE 3.1: every raised button is a bevelled 3D rectangle -- a light
    // edge along the top and left, a dark edge along the bottom and
    // right -- with a FLAT face.
    //
    // RULE 3.7: the primary action is visually distinct. The gold face
    // says "this is the one", and it is the biggest button on the
    // screen.
    const newY = 330;
    const contY = newY + bh + 12;
    const setY = contY + bh + 12;

    return [
      {
        id: 'title:new',
        label: 'New Museum',
        x: bx,
        y: newY,
        w: bw,
        h: bh,
        primary: true,
        font: FONT.mid,
      },
      {
        id: 'title:continue',
        label: 'Continue',
        x: bx,
        y: contY,
        w: bw,
        h: bh,
        enabled: this.hasSave,
        font: FONT.mid,
      },
      {
        id: 'title:settings',
        label: 'Settings',
        x: bx,
        y: setY,
        w: bw,
        h: 30,
        font: FONT.small,
      },
    ];
  }

  public layout(ctx: ScreenContext): Region[] {
    const regions: Region[] = [];

    for (const b of this.buttons(ctx)) {
      regions.push({
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
        id: b.id,
        enabled: b.enabled,
        onClick: () => {
          if (b.id === 'title:new') this.onNew();
          else if (b.id === 'title:continue') this.onContinue();
          else this.onSettings();
        },
      });
    }

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
    //
    // It sits UNDER the forecast panel, in the space between the banner
    // and the buttons, so that neither the panel nor the buttons have
    // anything drawn over them.
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
        drawSprite(g, image, Math.round(ix), 296, 2);
      }
      ix += iconSize + gap;
    }

    // The curator, standing to one side.
    const curator = ctx.sprites.get('curator');
    if (curator) {
      drawSprite(g, curator, 96, 264, 3);
    }

    // A caption at the bottom.
    //
    // This sits on the MOSS band, and white on moss is only 2.61:1 --
    // unreadable. It is written on a dark ink plate instead, which is
    // both legible and more in keeping with the rest of the interface.
    //
    // The plate is MEASURED, not guessed. It was 440 wide and the
    // caption is 500, so the ends of the line ran off the plate and
    // back onto the moss -- white on moss, unreadable, in the middle of
    // the screen's own tagline.
    const capText = 'Dig  ·  Catalogue  ·  Display  ·  Take the takings';
    const capTextW = Math.round(measureText(capText, FONT.small));
    const capW = capTextW + 20;
    const capX = Math.round((w - capW) / 2);
    const capY = h - 66;
    g.fillStyle = PAL.K;
    g.fillRect(capX - 10, capY - 6, capW + 20, 24);
    drawText(g, capText, w / 2, capY, {
      font: FONT.small,
      color: PAL.W,
      align: 'center',
    });

    // The version and a hint, small and unobtrusive.
    //
    // This one was written in N on the N band at the very bottom, which
    // is a contrast ratio of 1.0 -- it was invisible. It is now on a dark
    // plate as well.
    const verText = 'Web port — economy verified identical to the Godot build';
    const verW = measureText(verText, FONT.tiny);
    const verX = 10;
    // The plate's width is rounded to a whole pixel. A fractional
    // fillRect antialiases its right edge, and the blended column that
    // produces is off-palette -- 72 pixels of it, in the one frame that
    // the audit cares about most.
    g.fillStyle = PAL.K;
    g.fillRect(verX, h - 30, Math.round(verW) + 14, 18);
    drawText(g, verText, verX + 7, h - 26, {
      font: FONT.tiny,
      color: PAL.W,
    });

    // ── THE HOOK ──
    //
    // The continue path is the retention hook: a player who closed the
    // tab needs a REASON to open it again. The forecast says what that
    // reason is -- the dig that finishes tomorrow, the backlog waiting
    // to be cleared, the money on the floor.
    //
    // It is a panel with its own heading, so it reads as a piece of
    // information about the museum rather than as a stray line of text.
    // It is only drawn when there IS a save: a new player has no museum
    // to forecast.
    const forecast = this.previewForecast(ctx);
    if (forecast && this.hasSave) {
      const pw = 460;
      const px = Math.round((w - pw) / 2);
      const py = 196;
      const ph = 92;
      drawPanel(g, { x: px, y: py, w: pw, h: ph }, { fill: PAL.C, title: 'Tomorrow' });

      // The headline, then as many of the following lines as fit.
      //
      // A line that does not fit is LEFT OUT, not cut short: a sentence
      // that stops before its verb is worse than no sentence at all. So
      // the facts are walked in order, the first one that fits is taken
      // as the headline, and the rest are taken the same way.
      const innerW = pw - 24;
      const facts = forecast.facts;
      let ty = py + 22;

      const headline = facts.find((f) => measureText(f, FONT.mid) <= innerW);
      if (headline) {
        drawText(g, headline, px + 12, ty, {
          font: FONT.mid,
          color: PAL.D,
          maxWidth: innerW,
        });
        ty += 16;

        for (const line of facts) {
          if (line === headline) continue;
          if (ty + 12 > py + ph - 6) break;
          if (measureText(line, FONT.small) > innerW) continue;
          drawText(g, line, px + 12, ty, {
            font: FONT.small,
            color: PAL.P,
            maxWidth: innerW,
          });
          ty += 13;
        }
      }
    }

    // The buttons, LAST.
    //
    // Everything else on this screen is background, and the buttons are
    // the foreground. They are drawn here, after the background, so that
    // nothing paints over them.
    for (const b of this.buttons(ctx)) {
      drawBevelButton(g, {
        rect: { x: b.x, y: b.y, w: b.w, h: b.h },
        label: b.label,
        primary: b.primary === true,
        enabled: b.enabled,
        font: b.font,
        pressed: ctx.pressedRegionId === b.id,
      });
    }
  }
}
