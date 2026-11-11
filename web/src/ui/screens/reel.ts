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
import { drawSprite } from '../sprites.ts';
import { drawPanel, drawText, drawWell, FONT } from '../widgets.ts';

/** The colour of each reel symbol. */
const SYMBOL_COLOR: Record<string, string> = {
  clover: PAL.M,
  honey: PAL.Y,
  moon: PAL.I,
  star: PAL.G,
  bog: PAL.N,
  blight: PAL.T,
};

/** The glyph drawn for each symbol. Text glyphs, so no extra art needed. */
const SYMBOL_GLYPH: Record<string, string> = {
  clover: '☘',
  honey: '⬤',
  moon: '☾',
  star: '★',
  bog: '≈',
  blight: '✖',
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
      g.save();
      g.translate(wheelX + wheel.width / 2, wheelY + wheel.height / 2);
      g.rotate(this.wheelAngle);
      g.translate(-(wheelX + wheel.width / 2), -(wheelY + wheel.height / 2));
      drawSprite(g, wheel, wheelX, wheelY, 2);
      g.restore();
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
      const color = SYMBOL_COLOR[symbol] ?? PAL.N;

      drawText(g, SYMBOL_GLYPH[symbol] ?? '?', wx + winW / 2, winY + 16, {
        font: { size: 26 },
        color,
        align: 'center',
      });

      if (def) {
        drawText(g, `×${def.mult.toFixed(2)}`, wx + winW / 2, winY + winH - 16, {
          font: FONT.tiny,
          color: PAL.N,
          align: 'center',
        });
      }
    }

    // The payout the pending spin will apply.
    const payout = state.pendingPayout();
    const pendingText = this.spinning
      ? 'The wheel is turning…'
      : `Pending multiplier: ×${payout.toFixed(2)}`;

    drawText(g, pendingText, winX, winY + winH + 20, {
      font: FONT.mid,
      color: payout > 1 ? PAL.M : PAL.N,
    });

    // The explanation of the guarantee.
    drawText(
      g,
      'A miss still pays ×1.00. The reel never takes money from you.',
      winX,
      winY + winH + 44,
      { font: FONT.small, color: PAL.N, maxWidth: panelW - 220 }
    );

    drawText(
      g,
      `Cost: ${state.charmCost()} charms  ·  You have ${state.charms()}`,
      winX,
      winY + winH + 64,
      { font: FONT.small, color: PAL.N }
    );

    // The spin button.
    const canSpin = state.canSpin() && !this.spinning;
    const bw = 150;
    const bh = 40;
    const bx = panelX + 40;
    const by = panelY + panelH - 62;

    g.fillStyle = canSpin ? PAL.Y : PAL.X;
    g.fillRect(bx, by, bw, bh);
    g.fillStyle = canSpin ? PAL.H : PAL.P;
    g.fillRect(bx + 1, by + 1, bw - 2, 1);
    g.fillStyle = PAL.K;
    g.fillRect(bx, by, bw, 1);
    g.fillRect(bx, by + bh - 1, bw, 1);
    g.fillRect(bx, by, 1, bh);
    g.fillRect(bx + bw - 1, by, 1, bh);
    drawText(g, this.spinning ? 'Turning…' : 'Spin the reel', bx + bw / 2, by + 12, {
      font: FONT.mid,
      color: canSpin ? PAL.K : PAL.P,
      align: 'center',
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

    let oy = panelY + 48;
    for (const def of SYMBOLS) {
      const weight = weights.get(def.id) ?? def.weight;
      const chance = totalWeight > 0 ? weight / totalWeight : 0;

      // The symbol.
      drawText(g, SYMBOL_GLYPH[def.id] ?? '?', oddsX + 20, oy, {
        font: FONT.mid,
        color: SYMBOL_COLOR[def.id] ?? PAL.N,
      });

      drawText(g, def.id, oddsX + 44, oy + 2, {
        font: FONT.body,
        color: def.good ? PAL.D : PAL.N,
      });

      drawText(g, `×${def.mult.toFixed(2)}`, oddsX + 140, oy + 2, {
        font: FONT.small,
        color: def.good ? PAL.M : PAL.T,
      });

      drawText(g, `${(chance * 100).toFixed(1)}%`, oddsX + oddsW - 24, oy + 2, {
        font: FONT.small,
        color: PAL.N,
        align: 'right',
      });

      // A bar showing the share.
      const barX = oddsX + 44;
      const barY = oy + 20;
      const barW = oddsW - 68;
      g.fillStyle = PAL.X;
      g.fillRect(barX, barY, barW, 6);
      g.fillStyle = SYMBOL_COLOR[def.id] ?? PAL.N;
      g.fillRect(barX, barY, Math.round(barW * chance), 6);

      oy += 38;
    }

    // The reel's own history.
    const reel = state.sim.reel;
    const footY = panelY + panelH + 18;
    drawPanel(g, { x: oddsX, y: footY, w: oddsW, h: 84 }, {
      fill: PAL.C,
      title: 'The reel’s record',
    });

    drawText(
      g,
      `${reel.spins} spins   ·   ${reel.tripleHits} triples   ·   luck ${state.luck().toFixed(2)}`,
      oddsX + 20,
      footY + 38,
      { font: FONT.small, color: PAL.N }
    );
    drawText(
      g,
      `Best ×${reel.biggestWin.toFixed(2)}   ·   charms ${state.charms()}`,
      oddsX + 20,
      footY + 56,
      { font: FONT.small, color: PAL.N }
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
