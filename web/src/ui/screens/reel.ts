/**
 * The Fate Reel screen.
 *
 * A bounded gamble. The player spends charms to multiply the day's
 * takings. A MISS is never a loss: a miss pays x1.00, exactly what the
 * day would have paid anyway. But a triple of Bog or Blight pays LESS
 * than x1, so the reel can take money away as well as add it. That is
 * the whole design constraint, and this screen has to communicate it
 * clearly -- a player who thinks the reel can punish them will never
 * use it, and the reel is meant to be a marginal amplifier, not a
 * livelihood.
 *
 * THE TRUTHFULNESS RULES THIS SCREEN FOLLOWS
 *
 * 1. The three reels show the symbols the simulation actually drew.
 *    The result is known the moment the wheel is spun -- the maths does
 *    not wait for an animation -- but the player is told about it when
 *    the last reel STOPS, because that is when they can see it. So the
 *    sound and the message fire from the reveal, not from the pull.
 *
 * 2. Each reel stops on its own clock, staggered exactly as the Godot
 *    original does (0.55s, 0.72s, 0.90s), and each one travels a
 *    different number of symbols with a different phase, so the reels
 *    do not move in lockstep.
 *
 * 3. The payout preview only counts the exhibits visitors will
 *    actually pay for, under the current demand cap, and it says how
 *    many exhibits are on display but earning nothing. A preview that
 *    implied the whole gallery was paid for would be a lie.
 */

import { PAL } from '../palette.ts';
import { SYMBOLS, type SpinResult, type SymbolDef } from '../../sim/reel-core.ts';
import type { Region, Screen, ScreenContext } from '../screen.ts';
import { multiplier, money } from '../screen.ts';
import { drawSprite, drawSpriteRegion, drawSpriteRotated } from '../sprites.ts';
import {
  drawArrowRight,
  drawBevelButton,
  drawChip,
  drawPanel,
  drawParagraph,
  drawText,
  drawWell,
  FONT,
  measureText,
} from '../widgets.ts';
import { FOOTER_PANEL_HEIGHT, FOOTER_TOP } from '../bands.ts';
import { buildPayoutPreview } from '../reel-preview.ts';

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
 * silhouette of its own, so the reel would read as a row of emoji
 * rather than as objects on a wheel. Each symbol is a real 18x18 sprite
 * in the shared palette, so it sits in the same world as the rest of
 * the game.
 */
const SYMBOL_SPRITE: Record<string, string> = {
  clover: 'symbol_clover',
  honey: 'symbol_honey',
  moon: 'symbol_moon',
  star: 'symbol_star',
  bog: 'symbol_bog',
  blight: 'symbol_blight',
};

/**
 * When each reel comes to rest, in seconds from the pull.
 *
 * These are the Godot timings, in the same order. The reels stop one
 * after another rather than all at once, which is what makes a reel
 * read as a reel.
 */
const STOP_TIMES = [0.55, 0.72, 0.9] as const;

/** The symbol cell size on screen. The sprites are 18x18; this is 2x. */
const CELL = 36;

/**
 * The lever's geometry, read off the decoded sprite.
 *
 * The staged sprite is the 16x16 art with a one pixel outline around it,
 * so it is 18x18. In those pixels the mount's body starts at row 13,
 * its top-left lit face is at (10, 13), and the beam lands right on
 * top of it at (10, 12).
 *
 * The lever turns about that face -- the bolt -- so the pivot is the
 * CENTRE of that pixel: (10.5, 13.5).
 *
 * It is not the middle of the sprite, and it is not the bottom of the
 * mount. Turning the whole sprite about the middle swings the cap on a
 * circle through the middle of the image, which is not what a lever
 * does; turning it about the floor swings the mount through the air
 * with the arm, which is worse.
 */
const LEVER_PIVOT = { x: 10.5, y: 13.5 };

/** The arm: the cap and the beam, which turn about the bolt. */
const LEVER_ARM = { x: 0, y: 0, w: 18, h: 13 };

/** The mount: bolted to the floor, so it does not turn at all. */
const LEVER_MOUNT = { x: 0, y: 13, w: 18, h: 5 };

/** Where the lever's pivot sits on the 960x540 canvas. */
const LEVER_X = 292;
const LEVER_Y = 372;

/** The lever is drawn at 3x, like the reel symbols. */
const LEVER_SCALE = 3;

/**
 * How far the lever turns at a full pull, in radians.
 *
 * The grip is up and to the LEFT of the bolt, so pulling it DOWN means
 * turning the arm anticlockwise: the grip travels down the arc towards
 * horizontal, which is what a pulled lever looks like. Turning it the
 * other way would throw the grip UP over the machine, which reads as
 * pushing, not pulling.
 */
const LEVER_MAX_ANGLE = 0.6;

/** How far the pointer has to travel down to pull the lever fully. */
const PULL_DISTANCE = 44;

/** How far it has to travel before the pull counts as a spin. */
const PULL_SPIN_AT = 0.55;

/** A press that moves less than this is a click, not a drag. */
const CLICK_SLOP = 4;

/** The reel window size: three cells tall. */
const WIN_W = 72;
const WIN_H = CELL * 3;

/** The animation of one reel. */
interface ReelAnimation {
  /** The symbol order the strip starts on. */
  startIndex: number;
  /** How many symbols the strip travels before it stops. */
  distance: number;
  /** The index of the symbol it must come to rest on. */
  targetIndex: number;
  /** Whether this reel has come to rest yet. */
  stopped: boolean;
}

export class ReelScreen implements Screen {
  public readonly id = 'reel';
  public readonly label = 'Fate Reel';

  /** The result of the last spin, kept so the reels can show it. */
  private result: SpinResult | null = null;
  /** Whether the wheel is currently turning. */
  private spinning = false;
  /** The animations of the three reels. */
  private animations: ReelAnimation[] = [];
  /** When the current spin started, in seconds. */
  private spinStart = 0;
  /**
   * The latest clock the screen has seen, in seconds.
   *
   * The regions are rebuilt on every frame, but the click and gesture
   * closures capture the context of the frame they were built in, so
   * that context's clock can be a second or more stale by the time the
   * player lets go. The spin therefore starts from THIS clock, which is
   * refreshed on every frame, rather than from the captured one.
   */
  private now = 0;
  /** Whether the result has been revealed to the player. */
  private revealed = false;
  /** How far the lever is pulled down, 0 at rest and 1 fully pulled. */
  private leverPull = 0;
  /** The last frame's time, for the lever's spring-back. */
  private lastTime = 0;
  /** Whether the pointer is currently holding the lever down. */
  private grabbing = false;
  /** Where the pointer went down on the lever. */
  private grabX = 0;
  private grabY = 0;
  /** Whether the pointer has moved far enough to count as a drag. */
  private dragged = false;

  public layout(ctx: ScreenContext): Region[] {
    const g = ctx.surface.ctx;
    const { state } = ctx;
    const regions: Region[] = [];

    this.advance(ctx);

    // ------------------------------------------------------------ panels

    const panelY = 92;
    const panelH = 300;

    // The reel machine.
    drawPanel(g, { x: 20, y: panelY, w: 300, h: panelH }, {
      fill: PAL.C,
      title: 'The Fate Reel',
    });

    // What the reel will do to today's takings.
    drawPanel(g, { x: 330, y: panelY, w: 300, h: panelH }, {
      fill: PAL.C,
      title: 'What the reel will pay',
    });

    // The odds.
    drawPanel(g, { x: 640, y: panelY, w: 300, h: panelH }, {
      fill: PAL.C,
      title: 'What the wheel shows',
    });

    regions.push(...this.drawMachine(ctx, panelY));
    this.drawPreview(ctx, 330, panelY);
    this.drawOdds(ctx, 640, panelY);

    // ------------------------------------------------------------ footer

    const reel = state.sim.reel;

    drawPanel(g, { x: 20, y: FOOTER_TOP, w: 460, h: FOOTER_PANEL_HEIGHT }, {
      fill: PAL.C,
      title: 'The reel’s promise',
    });
    // Two lines, each of which fits the panel whole. The sentence used
    // to be one line with a 420-pixel allowance, and Silkscreen is a
    // wide face: the promise was cut at "A good…", which is the half of
    // the sentence that says what the reel can do for you.
    drawText(g, 'A miss still pays x1.', 40, FOOTER_TOP + 32, {
      font: FONT.small,
      color: PAL.D,
    });
    drawText(
      g,
      'A good triple can double your takings.',
      40,
      FOOTER_TOP + 50,
      { font: FONT.small, color: PAL.D }
    );
    // The risk itself lives in the odds panel, beside the two symbols
    // that carry it. A third line does not fit in a footer panel -- the
    // band is 74 pixels tall and holds a title and two lines -- and the
    // warning belongs next to the multipliers it is talking about.

    drawPanel(g, { x: 500, y: FOOTER_TOP, w: 440, h: FOOTER_PANEL_HEIGHT }, {
      fill: PAL.C,
      title: 'The reel’s record',
    });
    drawText(
      g,
      `${reel.spins} spins   ·   ${reel.tripleHits} triples   ·   luck ${state.luck().toFixed(2)}`,
      520,
      FOOTER_TOP + 32,
      { font: FONT.small, color: PAL.P, maxWidth: 400 }
    );
    drawText(
      g,
      `Best ${multiplier(reel.biggestWin)}   ·   charms ${state.charms()}`,
      520,
      FOOTER_TOP + 50,
      { font: FONT.small, color: PAL.P, maxWidth: 400 }
    );

    return regions;
  }

  // --------------------------------------------------------------- machine

  /**
   * The reel machine: three windows, the pull lever, the button, and the
   * status line that tells the player what just happened.
   */
  private drawMachine(ctx: ScreenContext, panelY: number): Region[] {
    const g = ctx.surface.ctx;
    const { state } = ctx;
    const regions: Region[] = [];

    const winY = panelY + 48;
    const winX = 36;
    const gap = 10;

    // The windows.
    for (let i = 0; i < 3; i++) {
      const wx = winX + i * (WIN_W + gap);
      drawWell(g, { x: wx, y: winY, w: WIN_W, h: WIN_H }, PAL.X);
      this.drawReel(ctx, i, wx, winY);
    }

    // The payline: two hairlines marking the row that counts.
    const payTop = winY + CELL;
    const payBottom = winY + CELL * 2;
    g.fillStyle = PAL.A;
    g.fillRect(winX - 2, payTop - 1, WIN_W * 3 + gap * 2 + 4, 1);
    g.fillRect(winX - 2, payBottom, WIN_W * 3 + gap * 2 + 4, 1);

    // The lever, mounted at the bottom right of the machine.
    //
    // The ARM turns about the bolt and the MOUNT stays bolted to the
    // floor, so they are drawn as two pieces: the mount first, and the
    // arm on top of it, so the joint never opens up when the lever is
    // pulled. Rotating the whole sprite as one piece would swing the
    // mount through the air with the arm, which is not what a bolted
    // lever does.
    const lever = ctx.sprites.get('reel_lever');
    if (lever) {
      // At rest the grip is up and to the left of the bolt, and pulling
      // turns the arm anticlockwise, so the grip comes DOWN.
      const angle = -LEVER_MAX_ANGLE * this.leverPull;

      // The mount: bolted down, so it is blitted, not rotated.
      drawSpriteRegion(
        g,
        lever,
        LEVER_MOUNT.x,
        LEVER_MOUNT.y,
        LEVER_MOUNT.w,
        LEVER_MOUNT.h,
        LEVER_X - LEVER_PIVOT.x * LEVER_SCALE,
        LEVER_Y + (LEVER_MOUNT.y - LEVER_PIVOT.y) * LEVER_SCALE,
        LEVER_SCALE
      );

      // The arm: turns about the bolt.
      drawSpriteRotated(g, lever, LEVER_X, LEVER_Y, angle, LEVER_SCALE, {
        pivot: LEVER_PIVOT,
        source: LEVER_ARM,
      });
    }

    // The status line: two lines, because one is not enough.
    //
    // The top line says what the wheel did. The bottom line says what
    // that does to the money. A bad triple has to say both "that was a
    // triple" and "less than x1 today", and in a single line the
    // sentence does not fit in the space the machine panel has -- it was
    // being cut off at the ellipsis, which is exactly how a warning
    // stops being a warning.
    //
    // The good and bad tints ride on a chip rather than on the ink,
    // because moss on cream is 2.16:1 and rust on cream is 3.04:1.
    // Neither can be read as text at this size.
    const status = this.statusText();
    const tint = status.tint;
    if (tint) drawChip(g, 36, panelY + 175, tint);
    const sx = tint ? 50 : 36;
    drawText(g, status.top, sx, panelY + 172, {
      font: FONT.body,
      color: tint ? PAL.D : PAL.P,
      maxWidth: 262,
    });
    drawText(g, status.bottom, sx, panelY + 190, {
      font: FONT.small,
      color: tint ? PAL.D : PAL.P,
      maxWidth: 262,
    });

    // The cost of a spin, with the charm as a picture and a number.
    const charmIcon = ctx.sprites.get('icon_charm');
    const costLabel = 'Cost';
    const cy = panelY + 214;
    drawText(g, costLabel, 36, cy, { font: FONT.small, color: PAL.P });
    let cx = 36 + measureText(costLabel, FONT.small) + 8;
    if (charmIcon) drawSprite(g, charmIcon, cx, cy - 2, 1);
    drawText(g, `${state.charmCost()}`, cx + (charmIcon ? 22 : 0), cy, {
      font: FONT.small,
      color: PAL.D,
    });
    const haveLabel = 'You have';
    cx += 44;
    drawText(g, haveLabel, cx, cy, { font: FONT.small, color: PAL.P });
    if (charmIcon) {
      drawSprite(g, charmIcon, cx + measureText(haveLabel, FONT.small) + 8, cy - 2, 1);
    }
    drawText(
      g,
      `${state.charms()}`,
      cx + measureText(haveLabel, FONT.small) + 30,
      cy,
      { font: FONT.small, color: PAL.D }
    );

    // The button is the primary action on this screen, so it gets the
    // gold bevelled face (RULE 3.1, RULE 3.7) and the star icon on its
    // leading side (RULE 2.6).
    //
    // The reel can be spun again once the wheels have stopped, as long
    // as there are enough charms left. The old gate -- "only if there
    // has never been a result" -- meant the reel could be used exactly
    // once a day, which is not what the Godot original does: there the
    // button is disabled while the wheel is turning and for no other
    // reason. So the gate is the same one the original uses.
    const canSpin = state.canSpin() && !this.spinning;
    // The label is set at the body size, not the mid size.
    //
    // "Spin the reel" is 183 pixels at the mid size and the button has
    // 162 for it, so it was cut to "Spin the reel…" -- and the button
    // that starts the whole mechanic of the screen was not a button
    // with a cut label on it.
    //
    // The button is NOT made wider: the lever stands at x=256 and the
    // browser check pulls it at x=276. A wider button reaches over the
    // lever, and the lever is the control that has to keep working.
    const bw = 190;
    const bh = 40;
    const bx = 36;
    const by = panelY + 244;

    drawBevelButton(g, {
      rect: { x: bx, y: by, w: bw, h: bh },
      label: this.spinning ? 'Turning…' : 'Spin the reel',
      enabled: canSpin,
      primary: canSpin,
      icon: 'symbol_star',
      sprites: ctx.sprites,
      font: FONT.small,
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

    // The lever is a control in its own right: pulling it is the same
    // action as pressing the button.
    //
    // The region covers the grip where it sits at rest and where it
    // travels to, and it stops well short of the spin button, so the
    // two controls never fight over a click.
    if (lever) {
      regions.push({
        x: 256,
        y: 324,
        w: 48,
        h: 64,
        id: 'reel:lever',
        enabled: canSpin,
        onClick: () => this.doSpin(ctx),
        onPointerDown: (p) => this.grabLever(p),
        onPointerMove: (p) => this.dragLever(p),
        onPointerUp: () => this.releaseLever(ctx),
      });
    }

    return regions;
  }

  // ----------------------------------------------------------------- reel

  /**
   * Draw one reel: a strip of three symbols, the middle one on the
   * payline, sliding up as the reel turns.
   */
  private drawReel(ctx: ScreenContext, index: number, wx: number, wy: number): void {
    const g = ctx.surface.ctx;
    const anim = this.animations[index];
    if (!anim) return;

    const position = this.reelPosition(index, ctx.time);
    const base = Math.floor(position);
    const frac = position - base;

    for (let j = -1; j <= 1; j++) {
      const step = base + j;
      const symbolIndex =
        (((anim.startIndex + step) % SYMBOLS.length) + SYMBOLS.length) %
        SYMBOLS.length;
      const def = SYMBOLS[symbolIndex] as SymbolDef;
      const image = ctx.sprites.get(SYMBOL_SPRITE[def.id] ?? '');
      if (!image) continue;
      const y = wy + CELL + (j - frac) * CELL;
      drawSprite(g, image, wx + (WIN_W - CELL) / 2, y, 2);
    }
  }

  /**
   * How far a reel has turned, in symbols.
   *
   * The motion is an ease-out: the strip runs fast at the start and
   * settles onto the answer, which is how a reel actually behaves and
   * is the only way a stop can look deliberate rather than cut off.
   */
  private reelPosition(index: number, now: number): number {
    const anim = this.animations[index];
    if (!anim) return 0;
    const elapsed = now - this.spinStart;
    const stop = STOP_TIMES[index];
    if (elapsed >= stop) return anim.distance;
    const u = Math.max(0, Math.min(1, elapsed / stop));
    const eased = 1 - Math.pow(1 - u, 3);
    return anim.distance * eased;
  }

  // -------------------------------------------------------------- preview

  /**
   * The payout preview.
   *
   * It names the exhibits that will actually be paid for, shows what
   * they earn before and after the multiplier, and says plainly how
   * many exhibits on display earn nothing. Nothing here is implied.
   */
  private drawPreview(ctx: ScreenContext, px: number, py: number): void {
    const g = ctx.surface.ctx;
    const { state } = ctx;

    // The multiplier that will actually apply to the day's takings.
    //
    // `pendingPayout()` is the reel's payout for the day: 1.00 before
    // a spin, and the drawn multiplier after one. While the wheel is
    // turning the player has not seen it land yet, so the preview shows
    // the day's takings WITHOUT the multiplier -- showing it early
    // would leak the result before the player could watch it.
    const revealed = this.result !== null && this.revealed;
    const shownMultiplier = revealed ? state.pendingPayout() : 1;

    const preview = buildPayoutPreview({
      galleryCounts: state.galleryCounts(),
      payingSplit: state.payingSplit(),
      exhibitValue: (grade) => state.exhibitValue(grade),
      multiplier: shownMultiplier,
    });

    const x = px + 16;
    const w = 268;
    let y = py + 44;

    if (preview.displayed === 0) {
      drawText(g, 'Nothing is on display.', x, y, {
        font: FONT.body,
        color: PAL.P,
        maxWidth: w,
      });
      drawParagraph(
        g,
        'Nothing on show yet to multiply.',
        x,
        y + 18,
        { font: FONT.small, color: PAL.P, maxWidth: w, lineHeight: 16 }
      );
      return;
    }

    // The headline: what the day pays, before and after.
    drawText(g, 'Takings today', x, y, { font: FONT.small, color: PAL.P });
    y += 18;

    drawText(g, money(preview.baseTotal), x, y, {
      font: FONT.mid,
      color: PAL.D,
    });
    if (preview.multiplier !== 1) {
      const baseW = measureText(money(preview.baseTotal), FONT.mid);
      // The arrow is DRAWN, not typed: Silkscreen has no arrow
      // character, and a mark that means "becomes" should be a shape
      // with a hard edge rather than a letter.
      const arrowW = drawArrowRight(
        g,
        x + baseW + 8,
        y + Math.round((FONT.mid.size - 7) / 2),
        PAL.P
      );
      // A multiplier below x1 REDUCES the takings. The number has to be
      // shown in the warning colour, not in the "good" one, or the
      // screen is telling the player a lie with a font choice -- but
      // neither moss nor rust can be read as text on cream, so the
      // colour rides on a chip and the figure is written in dark ink.
      const lost = preview.boostedTotal < preview.baseTotal;
      const valueX = x + baseW + 8 + arrowW + 8;
      drawChip(g, valueX - 12, y + 4, lost ? PAL.T : PAL.M);
      drawText(g, money(preview.boostedTotal), valueX, y, {
        font: FONT.mid,
        color: PAL.D,
      });
      drawText(
        g,
        `at ${multiplier(preview.multiplier)}`,
        valueX + measureText(money(preview.boostedTotal), FONT.mid) + 8,
        y + 4,
        { font: FONT.small, color: PAL.P }
      );
    }
    y += 24;

    // The per-grade breakdown: only the exhibits that earn.
    g.fillStyle = PAL.P;
    g.fillRect(x, y, w, 1);
    y += 8;

    for (const line of preview.lines) {
      drawText(g, line.grade, x, y, { font: FONT.small, color: PAL.D });
      drawText(g, `x${line.earning}`, x + 84, y, {
        font: FONT.small,
        color: PAL.P,
        align: 'right',
      });
      drawText(g, money(line.base * line.earning), x + 168, y, {
        font: FONT.small,
        color: PAL.P,
        align: 'right',
      });
      if (preview.multiplier !== 1) {
        drawText(g, money(line.boosted * line.earning), x + w, y, {
          font: FONT.small,
          color: PAL.D,
          align: 'right',
        });
      }
      y += 16;
    }

    y += 6;

    // How many of the exhibits on display are NOT being paid for. This
    // is the number players most often get wrong, so it is stated.
    const note =
      preview.paying >= preview.displayed
        ? `All ${preview.displayed} on display will earn today.`
        : `${preview.paying} of ${preview.displayed} on display earn today. ` +
          `${preview.idle} earn nothing.`;
    drawText(g, note, x, y, { font: FONT.small, color: PAL.P, maxWidth: w });
  }

  // ---------------------------------------------------------------- odds

  /** The odds table, and what the reel does on average. */
  private drawOdds(ctx: ScreenContext, px: number, py: number): void {
    const g = ctx.surface.ctx;
    const { state } = ctx;

    const weights = state.sim.reel.weights();
    let totalWeight = 0;
    for (const w of weights.values()) totalWeight += w;

    const rowX = px + 12;
    const rowW = 276;
    // The rows are 30 tall, not 34, so that the summary below them has
    // room for all four of its lines. The panel is 300 tall and holds a
    // title, six rows and four lines of figures; at 34 the last line ran
    // off the bottom of the panel.
    const rowH = 30;
    let oy = py + 42;

    SYMBOLS.forEach((def, i) => {
      const weight = weights.get(def.id) ?? def.weight;
      const chance = totalWeight > 0 ? weight / totalWeight : 0;

      // RULE 10.2: a WIDE table alternates its row fills, so the column
      // of percentages can be scanned.
      g.fillStyle = i % 2 === 0 ? PAL.W : PAL.C;
      g.fillRect(rowX, oy, rowW, rowH - 4);

      // The leading block: the symbol's colour as a plate.
      g.fillStyle = SYMBOL_COLOR[def.id] ?? PAL.N;
      g.fillRect(rowX, oy, 6, rowH - 4);

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
        font: FONT.small,
        color: def.good ? PAL.D : PAL.P,
      });

      drawText(g, multiplier(def.mult), rowX + 116, oy + 6, {
        font: FONT.small,
        color: def.good ? PAL.D : PAL.P,
      });

      drawText(g, `${(chance * 100).toFixed(1)}%`, rowX + rowW - 10, oy + 6, {
        font: FONT.small,
        color: PAL.P,
        align: 'right',
      });

      // RULE 4.4: the share is a thin bar in a light track.
      const barX = rowX + 36;
      const barY = oy + 20;
      const barW = rowW - 46;
      g.fillStyle = PAL.X;
      g.fillRect(barX, barY, barW, 6);
      g.fillStyle = SYMBOL_COLOR[def.id] ?? PAL.N;
      g.fillRect(barX, barY, Math.round(barW * chance), 6);

      oy += rowH;
    });

    oy += 8;

    // What the reel does on average, at this luck.
    const reel = state.sim.reel;
    const ev = reel.expectedValue();
    drawText(g, `Luck ${state.luck().toFixed(2)}`, px + 16, oy, {
      font: FONT.small,
      color: PAL.D,
    });
    drawText(g, `average ${multiplier(ev)}`, px + 284, oy, {
      font: FONT.small,
      color: PAL.P,
      align: 'right',
    });
    oy += 16;

    // How the outcomes fall, as a share of spins.
    //
    // The three shares are on two lines: "Triple 4.8% · Pair 48.4% ·
    // Miss 50.7%" is wider than the panel, and it used to be cut at
    // "M…", which hid the share of spins that MISS.
    const dist = reel.patternDistribution();
    const triple = (dist.get('triple') ?? 0) * 100;
    const pair = (dist.get('pair') ?? 0) * 100;
    const miss = (dist.get('miss') ?? 0) * 100;
    drawText(
      g,
      `Triple ${triple.toFixed(1)}% · Pair ${pair.toFixed(1)}%`,
      px + 16,
      oy,
      { font: FONT.small, color: PAL.P }
    );
    oy += 16;
    drawText(g, `Miss ${miss.toFixed(1)}%`, px + 16, oy, {
      font: FONT.small,
      color: PAL.P,
    });
    oy += 16;

    // The risk, stated plainly, and standing beside the two symbols
    // that carry it.
    //
    // Rust on cream is 3.04:1, which is not enough for text this small,
    // so the rust is a chip and the words are in an ink that can be read.
    // The same rule the HUD follows for the upkeep chip.
    drawChip(g, px + 16, oy + 3, PAL.T);
    drawText(g, 'Bog or Blight pay LESS.', px + 28, oy, {
      font: FONT.small,
      color: PAL.D,
    });
  }

  // ------------------------------------------------------------ the lever

  /**
   * The pointer has gone down on the lever.
   *
   * The lever is a control that is USED, not tapped: the player takes
   * hold of it and pulls. So the press is the start of a gesture, and
   * the lever waits, at rest, to see how far the pointer travels.
   */
  private grabLever(p: { x: number; y: number }): void {
    this.grabbing = true;
    this.grabX = p.x;
    this.grabY = p.y;
    this.dragged = false;
  }

  /**
   * The pointer is moving while the lever is held.
   *
   * The lever follows the pointer: it is pulled down as far as the
   * pointer has travelled, and no further. So the pull is visible while
   * it is happening, rather than appearing all at once on release.
   */
  private dragLever(p: { x: number; y: number }): void {
    if (!this.grabbing) return;
    if (
      Math.abs(p.x - this.grabX) > CLICK_SLOP ||
      Math.abs(p.y - this.grabY) > CLICK_SLOP
    ) {
      this.dragged = true;
    }
    const pull = (p.y - this.grabY) / PULL_DISTANCE;
    this.leverPull = Math.max(0, Math.min(1, pull));
  }

  /**
   * The pointer has come up on the lever.
   *
   * A tap is a click, and the lever is a control like any other, so a
   * tap spins the reel. That is the accessible path, and it is also
   * what a player who has not worked out the gesture will do.
   *
   * A pull has to travel far enough to count: a half-hearted tug on a
   * sprung lever springs back and does nothing.
   *
   * Returns true either way, because the release has been handled here
   * and the framework must not also fire the click.
   */
  private releaseLever(ctx: ScreenContext): boolean {
    if (!this.grabbing) return false;
    this.grabbing = false;
    const pull = this.leverPull;
    this.leverPull = 0;

    if (!this.dragged) {
      this.doSpin(ctx);
      return true;
    }
    if (pull >= PULL_SPIN_AT) {
      this.doSpin(ctx);
    }
    return true;
  }

  // --------------------------------------------------------------- state

  /** Advance the animation, and reveal the result when it lands. */
  private advance(ctx: ScreenContext): void {
    const dt = Math.max(0, Math.min(0.25, ctx.time - this.lastTime));
    this.lastTime = ctx.time;
    this.now = ctx.time;

    // The lever springs back after the pull, over about a quarter of a
    // second, which is what a sprung lever does. While the pointer is
    // still on it the lever follows the pointer instead, so the spring
    // must not fight the player's hand.
    if (!this.grabbing && this.leverPull > 0) {
      this.leverPull = Math.max(0, this.leverPull - dt * 4);
    }

    if (this.result === null || !this.spinning) return;
    const elapsed = ctx.time - this.spinStart;

    for (let i = 0; i < this.animations.length; i++) {
      const anim = this.animations[i] as ReelAnimation;
      if (!anim.stopped && elapsed >= STOP_TIMES[i]) {
        anim.stopped = true;
        ctx.state.onReelStop?.(i);
      }
    }

    if (!this.revealed && elapsed >= STOP_TIMES[2]) {
      this.revealed = true;
      this.spinning = false;
      // The result is announced here, when the last reel has come to
      // rest, and not when the wheel was pulled.
      ctx.state.revealReel(this.result);
    }
  }

  /**
   * The status line: what is happening, or what just happened.
   *
   * Two lines, each of which fits the machine panel without being cut.
   *
   * The tint is the chip's colour, not the ink's: moss on cream is
   * 2.16:1 and rust on cream is 3.04:1, and neither can be read as text.
   */
  private statusText(): {
    top: string;
    bottom: string;
    tint: string | null;
  } {
    if (this.spinning) {
      return {
        top: 'The wheel is turning…',
        bottom: 'The reels stop one at a time.',
        tint: null,
      };
    }
    const result = this.result;
    if (!result || !this.revealed) {
      return {
        top: 'Pull the lever.',
        bottom: 'A miss still pays x1.',
        tint: null,
      };
    }
    if (result.payout > 1.0) {
      return {
        top: 'Three of a kind!',
        bottom: `${multiplier(result.payout)} today — the reel pays you.`,
        tint: PAL.M,
      };
    }
    if (result.payout < 1.0) {
      // A bad triple CUTS the day's takings. The player has to be told
      // that plainly, not dressed up as a win.
      return {
        top: 'A triple of something bad.',
        bottom: `${multiplier(result.payout)} today. The reel takes its cut.`,
        tint: PAL.T,
      };
    }
    return {
      top: 'No match.',
      bottom: `${multiplier(result.payout)} today — nothing lost.`,
      tint: null,
    };
  }

  /**
   * Spin the reel.
   *
   * The result is drawn from the simulation immediately, but it is not
   * shown until the reels have stopped. The animations are built here so
   * that each reel travels a different distance, starts on a different
   * symbol, and lands exactly on the symbol the simulation drew.
   */
  private doSpin(ctx: ScreenContext): void {
    if (this.spinning) return;
    const result = ctx.state.spinReel();
    if (!result) return;

    this.result = result;
    this.spinning = true;
    this.revealed = false;
    // The spin starts NOW, not at the time of the frame the click
    // closure was built in: the wheel's stop times are measured from
    // here, so a stale start would make the wheel finish in the same
    // frame it began.
    this.spinStart = this.now;
    this.leverPull = 1;

    this.animations = result.reels.map((symbol, i) => {
      const targetIndex = Math.max(
        0,
        SYMBOLS.findIndex((s) => s.id === symbol)
      );
      // The strip starts on a symbol that is NOT the answer, so the
      // player cannot read the result off the reel before it stops.
      const startIndex = (targetIndex + 2 + i) % SYMBOLS.length;
      // A whole number of turns plus whatever is needed to land on the
      // answer: the reel always comes to rest on the drawn symbol.
      const extra = (targetIndex - startIndex + SYMBOLS.length) % SYMBOLS.length;
      const distance = SYMBOLS.length * (5 + i) + extra;
      return { startIndex, distance, targetIndex, stopped: false };
    });
  }

  public draw(ctx: ScreenContext): void {
    const g = ctx.surface.ctx;
    drawText(g, 'FATE REEL', 24, 62, { font: FONT.large, color: PAL.D });
  }

  public hint(): string {
    return 'The reel multiplies your takings for the day. A miss is never a loss.';
  }
}
