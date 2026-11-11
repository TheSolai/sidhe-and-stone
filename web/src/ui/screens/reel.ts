/**
 * The Fate Reel screen.
 *
 * A bounded gamble. The player spends charms to multiply the day's takings.
 * The reel never takes money away: a miss still pays ×1.00. That is the
 * whole design constraint, and this screen has to communicate it clearly --
 * a player who thinks the reel can punish them will never use it, and the
 * reel is meant to be a marginal amplifier, not a livelihood.
 *
 * The screen shows the odds plainly, so the player can see the reel is
 * weighted and bounded rather than a black box.
 */

import { PAL } from '../palette.ts';
import { SYMBOLS, type SymbolDef } from '../../sim/reel-core.ts';
import type { Region, Screen, ScreenContext } from '../screen.ts';
import { multiplier } from '../screen.ts';
import { drawSprite, drawSpriteRotated } from '../sprites.ts';
import { drawBevelButton, drawPanel, drawText, drawWell, FONT, measureText } from '../widgets.ts';
import { FOOTER_PANEL_HEIGHT, FOOTER_TOP } from '../bands.ts';

/** The colour of each reel symbol. */
const SYMBOL_COLOR: Record<string, string> = {
  clover: PAL.M,
  honey: PAL.Y,
  moon: PAL.I,
  star: PAL.G,
  bog: PAL.N,
  blight: PAL.T,
};

/**
 * The drawn sprite for each reel symbol.
 *
 * These are hand-drawn motifs, never font glyphs: a font glyph has no
 * silhouette of its own, so the reel would read as a row of emoji rather
 * than as objects on a wheel. Each symbol is a real 16x16 sprite in the
 * shared palette, so it sits in the same world as the rest of the game.
 */
const SYMBOL_SPRITE: Record<string, string> = {
  clover: 'symbol_clover',
  honey: 'symbol_honey',
  moon: 'symbol_moon',
  star: 'symbol_star',
  bog: 'symbol_bog',
  blight: 'symbol_blight',
};

export class ReelScreen implements Screen {
  public readonly id = 'reel';
  public readonly label = 'Fate Reel';

  /** The animation state of the last spin. */
  private spinTimer = 0;
  private spinning = false;
  private lastResult: { reels: string[]; payout: number; pattern: string } | null = null;

  /** The wheel's rotation, for the animated idle state. */
  private wheelAngle = 0;

  public layout(ctx: ScreenContext): Region[] {
    const g = ctx.surface.ctx;
    const { state } = ctx;
    const regions: Region[] = [];

    // The reel itself, on the left.
    const panelX = 20;
    const panelY = 92;
    const panelW = 470;
    const panelH = 300;

    drawPanel(g, { x: panelX, y: panelY, w: panelW, h: panelH }, {
      fill: PAL.C,
      title: 'The Fate Reel',
    });

    // The wheel, turning slowly while idle and spinning fast on a spin.
    if (this.spinning) {
      this.wheelAngle += 0.9;
      this.spinTimer -= 1 / 60;
      if (this.spinTimer <= 0) {
        this.spinning = false;
      }
    } else {
      this.wheelAngle += 0.0035;
    }

    const wheel = ctx.sprites.get('reel_wheel');
    const wheelX = panelX + 40;
    const wheelY = panelY + 60;
    if (wheel) {
      // Rotated by hand rather than with ctx.rotate(): a canvas rotation
      // anti-aliases the edges of the rotated quad and bleeds off-palette
      // pixels onto the screen every frame.
      drawSpriteRotated(
        g,
        wheel,
        wheelX + (wheel.width * 2) / 2,
        wheelY + (wheel.height * 2) / 2,
        this.wheelAngle,
        2
      );
    }

    // The three reel windows.
    const winX = panelX + 190;
    const winW = 72;
    const winH = 62;
    const winY = panelY + 56;

    const reels = this.spinning
      ? this.fakeReels()
      : (this.lastResult?.reels ?? ['clover', 'bog', 'honey']);

    for (let i = 0; i < 3; i++) {
      const wx = winX + i * (winW + 8);
      drawWell(g, { x: wx, y: winY, w: winW, h: winH }, PAL.W);

      const symbol = reels[i];
      const def = SYMBOLS.find((s) => s.id === symbol);

      // The drawn motif, centred in the window above its multiplier.
      const image = ctx.sprites.get(SYMBOL_SPRITE[symbol] ?? '');
      if (image) {
        const scale = 2;
        const sw = image.width * scale;
        drawSprite(g, image, wx + (winW - sw) / 2, winY + 8, scale);
      } else {
        // No sprite loaded: fall back to the label so the slot is never blank.
        drawText(g, symbol.toUpperCase(), wx + winW / 2, winY + 16, {
          font: FONT.small,
          color: PAL.D,
          align: 'center',
        });
      }

      if (def) {
        // RULE 4.1: a multiplier is written `x1.5` -- lowercase x, no
        // space -- and RULE 4.3: it lives in the panel where the boosted
        // value is compared, not in the top bar.
        drawText(g, multiplier(def.mult), wx + winW / 2, winY + winH - 16, {
          font: FONT.tiny,
          color: PAL.P,
          align: 'center',
        });
      }
    }

    // The payout the pending spin will apply.
    const payout = state.pendingPayout();
    const pendingText = this.spinning
      ? 'The wheel is turning…'
      : `Pending multiplier: ${multiplier(payout)}`;

    drawText(g, pendingText, winX, winY + winH + 20, {
      font: FONT.mid,
      color: payout > 1 ? PAL.D : PAL.P,
    });

    // The cost of a spin, under the windows.
    //
    // RULE 1.2 / RULE 4.6: the charm is a picture and a number, never a
    // bare word with a number attached, and the picture carries the
    // unit.
    const charmIcon = ctx.sprites.get('icon_charm');
    const costLabel = 'Cost';
    drawText(g, costLabel, winX, winY + winH + 64, {
      font: FONT.small,
      color: PAL.P,
    });
    const costIconX = winX + measureText(costLabel, FONT.small) + 8;
    if (charmIcon) drawSprite(g, charmIcon, costIconX, winY + winH + 62, 1);
    drawText(g, `${state.charmCost()}`, costIconX + (charmIcon ? 22 : 0), winY + winH + 64, {
      font: FONT.small,
      color: PAL.D,
    });
    drawText(g, '·', costIconX + 44, winY + winH + 64, {
      font: FONT.small,
      color: PAL.P,
    });
    const haveIconX = costIconX + 54;
    drawText(g, 'You have', haveIconX, winY + winH + 64, {
      font: FONT.small,
      color: PAL.P,
    });
    if (charmIcon) drawSprite(g, charmIcon, haveIconX + measureText('You have', FONT.small) + 8, winY + winH + 62, 1);
    drawText(g, `${state.charms()}`, haveIconX + measureText('You have', FONT.small) + 30, winY + winH + 64, {
      font: FONT.small,
      color: PAL.D,
    });

    // The guarantee used to live here, in the content panel, and it did
    // not fit: the sentence is 404 pixels wide and the space beside the
    // reel windows is 250. It was being silently truncated to "A miss
    // still pays ×1.00. The…", which is the one sentence in the game
    // that the player most needs to read in full.
    //
    // It lives in the FOOTER band now, on the left, where there was
    // empty space. The reel's own record sits on the right of the same
    // band, so the two panels balance each other.

    // The spin button: the primary action on this screen, so it gets the
    // gold bevelled face (RULE 3.1, RULE 3.7) and the star icon on its
    // leading side (RULE 2.6).
    const canSpin = state.canSpin() && !this.spinning;
    // The button is 190 wide because the label and its icon have to fit
    // without truncation: "Spin the reel" at the mid size plus the star
    // icon is wider than 150, and a clipped label on the one button the
    // player is looking for is a defect.
    const bw = 190;
    const bh = 40;
    const bx = panelX + 40;
    const by = panelY + panelH - 62;

    drawBevelButton(g, {
      rect: { x: bx, y: by, w: bw, h: bh },
      label: this.spinning ? 'Turning…' : 'Spin the reel',
      enabled: canSpin,
      primary: canSpin,
      icon: 'symbol_star',
      sprites: ctx.sprites,
      font: FONT.mid,
      pressed: ctx.pressedRegionId === 'reel:spin',
    });

    regions.push({
      x: bx,
      y: by,
      w: bw,
      h: bh,
      id: 'reel:spin',
      enabled: canSpin,
      onClick: () => this.doSpin(ctx),
    });

    // The odds table, on the right.
    const oddsX = panelX + panelW + 20;
    const oddsW = ctx.surface.canvas.width - oddsX - 20;

    drawPanel(g, { x: oddsX, y: panelY, w: oddsW, h: panelH }, {
      fill: PAL.C,
      title: 'What the wheel shows',
    });

    const weights = state.sim.reel.weights();
    let totalWeight = 0;
    for (const w of weights.values()) totalWeight += w;

    // The odds table.
    //
    // RULE 10.1: full-width inset rows, with a thin coloured block at
    // the leading edge as the row's icon column.
    //
    // RULE 10.2: a WIDE table alternates its row fills, so the column of
    // percentages can be scanned.
    //
    // RULE 10.5: the percentage is right-aligned, so the numbers line
    // up down the column.
    //
    // RULE 4.4: the share is a thin bar in a light track.
    const rowH = 38;
    const rowX = oddsX + 12;
    const rowW = oddsW - 24;
    let oy = panelY + 44;
    SYMBOLS.forEach((def, i) => {
      const weight = weights.get(def.id) ?? def.weight;
      const chance = totalWeight > 0 ? weight / totalWeight : 0;

      g.fillStyle = i % 2 === 0 ? PAL.W : PAL.C;
      g.fillRect(rowX, oy, rowW, rowH - 4);

      // The leading block: the symbol's colour as a plate.
      g.fillStyle = SYMBOL_COLOR[def.id] ?? PAL.N;
      g.fillRect(rowX, oy, 6, rowH - 4);

      // The drawn motif, so the odds table matches the reel itself.
      const image = ctx.sprites.get(SYMBOL_SPRITE[def.id] ?? '');
      if (image) {
        drawSprite(g, image, rowX + 12, oy + 3, 1);
      } else {
        drawText(g, def.id.slice(0, 2).toUpperCase(), rowX + 14, oy + 5, {
          font: FONT.mid,
          color: PAL.D,
        });
      }

      drawText(g, def.id, rowX + 36, oy + 5, {
        font: FONT.body,
        color: def.good ? PAL.D : PAL.P,
      });

      drawText(g, multiplier(def.mult), rowX + 118, oy + 6, {
        font: FONT.small,
        color: def.good ? PAL.D : PAL.P,
      });

      drawText(g, `${(chance * 100).toFixed(1)}%`, rowX + rowW - 10, oy + 6, {
        font: FONT.small,
        color: PAL.P,
        align: 'right',
      });

      // A bar showing the share.
      const barX = rowX + 36;
      const barY = oy + 24;
      const barW = rowW - 46;
      g.fillStyle = PAL.X;
      g.fillRect(barX, barY, barW, 6);
      g.fillStyle = SYMBOL_COLOR[def.id] ?? PAL.N;
      g.fillRect(barX, barY, Math.round(barW * chance), 6);

      oy += rowH;
    });

    // The reel's own history.
    const reel = state.sim.reel;
    const footY = FOOTER_TOP;

    // The guarantee, on the left of the footer band.
    //
    // This is the left half of the footer, which was empty. The
    // sentence is the game's promise to the player -- a spin can never
    // cost them money -- and it deserves more room than a line of
    // content panel could give it.
    drawPanel(g, { x: panelX, y: footY, w: panelW, h: FOOTER_PANEL_HEIGHT }, {
      fill: PAL.C,
      title: 'The reel’s promise',
    });
    drawText(
      g,
      'A miss still pays x1. The reel never takes money from you.',
      panelX + 20,
      footY + 32,
      { font: FONT.small, color: PAL.D, maxWidth: panelW - 40 }
    );
    drawText(
      g,
      'The multiplier only ever adds to what you have already earned.',
      panelX + 20,
      footY + 50,
      { font: FONT.small, color: PAL.P, maxWidth: panelW - 40 }
    );

    drawPanel(g, { x: oddsX, y: footY, w: oddsW, h: FOOTER_PANEL_HEIGHT }, {
      fill: PAL.C,
      title: 'The reel’s record',
    });

    drawText(
      g,
      `${reel.spins} spins   ·   ${reel.tripleHits} triples   ·   luck ${state.luck().toFixed(2)}`,
      oddsX + 20,
      footY + 32,
      { font: FONT.small, color: PAL.P }
    );
    drawText(
      g,
      `Best ${multiplier(reel.biggestWin)}   ·   charms ${state.charms()}`,
      oddsX + 20,
      footY + 50,
      { font: FONT.small, color: PAL.P }
    );

    return regions;
  }

  /** Spin the reel and start the animation. */
  private doSpin(ctx: ScreenContext): void {
    if (this.spinning) return;
    const result = ctx.state.spinReel();
    if (!result) return;
    this.lastResult = result;
    this.spinning = true;
    this.spinTimer = 1.1;
  }

  /** The symbols shown while the wheel is turning. */
  private fakeReels(): string[] {
    const pick = () => {
      const idx = Math.floor(Math.random() * SYMBOLS.length);
      return (SYMBOLS[idx] as SymbolDef).id;
    };
    return [pick(), pick(), pick()];
  }

  public draw(ctx: ScreenContext): void {
    const g = ctx.surface.ctx;
    drawText(g, 'FATE REEL', 24, 62, { font: FONT.large, color: PAL.D });
  }

  public hint(): string {
    return 'The reel multiplies your takings for the day. A miss is never a loss.';
  }
}
