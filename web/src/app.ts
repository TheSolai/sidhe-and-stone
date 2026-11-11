/**
 * The application shell.
 *
 * Owns the screen stack, the frame loop, input routing, and the transitions
 * between screens. The game logic lives entirely in `src/sim`; this file
 * only decides what the player is looking at and what their clicks mean.
 *
 * The loop is fixed-step at 60Hz. Simulation advances on whole ticks so the
 * economy cannot depend on frame timing -- a slow frame must never change
 * the player's money.
 */

import { GameState } from './sim/game-state.ts';
import type { DaySummary } from './sim/game-state.ts';
import { loadGame, saveGame, type Settings } from './save.ts';
import { Audio } from './ui/audio.ts';
import { drawHud, drawNav, navLayout, type NavButton } from './ui/hud.ts';
import { HINT_TEXT_Y, HUD_HEIGHT, NAV_TOP, SHADOW_OFFSET } from './ui/bands.ts';
import { drawWithOrderedFade } from './ui/fade.ts';
import {
  audit,
  beginAudit,
  endAudit,
  textDraws,
  truncations,
} from './ui/audit.ts';
import { PAL } from './ui/palette.ts';
import {
  regionHit,
  ToastStack,
  type Region,
  type Screen,
  type ScreenContext,
} from './ui/screen.ts';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, Surface } from './ui/surface.ts';
import { SpriteSet } from './ui/sprites.ts';
import {
  drawChip,
  drawPanel,
  drawText,
  drawVeil,
  drawTintedValue,
  FONT,
  measureText,
} from './ui/widgets.ts';

import { TitleScreen } from './ui/screens/title.ts';
import { DigSiteScreen } from './ui/screens/dig-site.ts';
import { CuratorScreen } from './ui/screens/curator.ts';
import { VaultScreen } from './ui/screens/vault.ts';
import { GalleryScreen } from './ui/screens/gallery.ts';
import { ReelScreen } from './ui/screens/reel.ts';
import { ShopScreen } from './ui/screens/shop.ts';
import { LedgerScreen } from './ui/screens/ledger.ts';
import { GoalsScreen } from './ui/screens/goals.ts';

/** The simulation tick rate. Fixed, so the economy is timing-independent. */
const TICK_HZ = 60;
const TICK_DT = 1 / TICK_HZ;

export class App {
  public readonly state = new GameState();
  public readonly toasts = new ToastStack();
  public readonly audio: Audio;

  private surface: Surface;
  private sprites: SpriteSet;

  public readonly screens = new Map<string, Screen>();
  private activeId = 'title';

  private regions: Region[] = [];
  /** Modal overlay regions. These take priority over the screen's own. */
  private overlayRegions: Region[] = [];

  /**
   * Every interactive region currently on screen.
   *
   * Exposed so the browser checks can click a control by its id rather
   * than by a hardcoded pixel position, which breaks the moment a layout
   * changes by a few pixels.
   */
  public get interactiveRegions(): Region[] {
    return [...this.overlayRegions, ...this.regions];
  }

  /**
   * What the last frame's screen actually drew.
   *
   * The bounding box of everything the active screen painted, and the
   * strings it had to cut to fit. The browser checks use this to assert
   * that a screen stays inside the bands it owns and that no text is
   * being silently truncated.
   */
  public get layoutAudit(): {
    bounds: { minX: number; minY: number; maxX: number; maxY: number; calls: number } | null;
    truncations: string[];
  } {
    return { bounds: audit.bounds, truncations: [...truncations] };
  }

  /**
   * Every piece of text the last frame drew, with its ink and its surface.
   *
   * The contrast check computes the real ratio from these, so "can this
   * be read?" is answered by arithmetic rather than by somebody's eye.
   */
  public get contrastAudit(): {
    texts: { text: string; ink: string; surface: string | null; x: number; y: number; size: number }[];
  } {
    return { texts: textDraws.map((t) => ({ ...t })) };
  }
  private navButtons: NavButton[] = [];

  private pointer: { x: number; y: number } | null = null;
  private pressedRegion: Region | null = null;

  private lastFrame = 0;
  private accumulator = 0;
  private elapsed = 0;
  private running = false;

  /** The last day summary, shown as an overlay until dismissed. */
  private summary: DaySummary | null = null;
  /** The tutorial overlay, when the tutorial is running. */
  private tutorialOpen = false;

  private settings: Settings;

  /**
   * @param sprites The ALREADY LOADED sprite set. The App does not load
   *   sprites itself: it has no base path and cannot know where the built
   *   assets live. It used to take the raw atlas and build its own empty
   *   SpriteSet, which was never load()ed, so every sprite lookup returned
   *   undefined and the whole web build silently rendered no sprite art at
   *   all. The caller loads them once and hands over the loaded set.
   */
  constructor(canvas: HTMLCanvasElement, settings: Settings, sprites: SpriteSet) {
    this.surface = new Surface(canvas);
    this.sprites = sprites;
    this.audio = new Audio(settings);
    this.settings = settings;

    this.registerScreens();
    this.wireEvents();
    this.wireState();
  }

  private registerScreens(): void {
    const add = (s: Screen) => this.screens.set(s.id, s);
    add(new TitleScreen());
    add(new DigSiteScreen());
    add(new CuratorScreen());
    add(new VaultScreen());
    add(new GalleryScreen());
    add(new ReelScreen());
    add(new ShopScreen());
    add(new LedgerScreen());
    add(new GoalsScreen());
  }

  private wireState(): void {
    const { state } = this;

    state.onChanged = () => {
      // Save whenever the state changes materially. The snapshot is small
      // and localStorage is fast, but writing on every frame would be
      // wasteful, so the change flag is coalesced to the frame boundary.
      this.savePending = true;
    };

    state.onDayEnded = (summary) => {
      this.summary = summary;
      this.audio.playDayEnd();
      this.reportDay(summary);
    };

    state.onGoalAchieved = (goal) => {
      this.toasts.push(`Milestone: ${goal.title}`, PAL.G, 4.2, 120);
      this.audio.playChime();
    };

    state.onReelSpun = (res) => {
      if (res.pattern === 'triple') this.audio.playFanfare();
      else if (res.pattern === 'pair') this.audio.playChime();
      else this.audio.playClick();
    };
  }

  private savePending = false;

  /** Report the night's events as toasts. */
  private reportDay(summary: DaySummary): void {
    if (summary.stolen > 0) {
      const grades = Object.entries(summary.stolen_grades)
        .map(([g, n]) => `${n} ${g}`)
        .join(', ');
      this.toasts.push(`Stolen overnight: ${grades}`, PAL.T, 4.2, 90);
    }
    if (summary.curated > 0) {
      this.toasts.push(`${summary.curated} finds catalogued`, PAL.M, 3.2, 120);
    }
    if (summary.digs_done > 0) {
      this.toasts.push(`${summary.digs_done} dig${summary.digs_done === 1 ? '' : 's'} completed`, PAL.Z, 3.2, 150);
    }
    if (summary.delta < 0) {
      this.toasts.push(`The day cost ${summary.delta < 0 ? '' : ''}${Math.abs(Math.round(summary.delta))}`, PAL.T, 3.6, 180);
    }
  }

  // ------------------------------------------------------------------ input

  private wireEvents(): void {
    const canvas = this.surface.canvas;

    canvas.addEventListener('pointermove', (e) => {
      const p = this.surface.toLogical(e);
      this.pointer = p;
    });

    canvas.addEventListener('pointerleave', () => {
      this.pointer = null;
      this.pressedRegion = null;
    });

    canvas.addEventListener('pointerdown', (e) => {
      const p = this.surface.toLogical(e);
      if (!p) return;
      this.pointer = p;
      this.audio.resume();

      // Find the region under the pointer and remember it, so the click is
      // resolved on pointerup even if the pointer drifts a pixel.
      //
      // Overlay regions are searched FIRST. A modal dialog covers the whole
      // screen, so without this the screen's own buttons would still take
      // clicks through the dimming.
      this.pressedRegion =
        this.overlayRegions.find(
          (r) => r.enabled !== false && regionHit(r, p.x, p.y)
        ) ??
        this.regions.find((r) => r.enabled !== false && regionHit(r, p.x, p.y)) ??
        null;

      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointerup', (e) => {
      const p = this.surface.toLogical(e);
      if (!p) {
        this.pressedRegion = null;
        return;
      }

      const pressed = this.pressedRegion;
      this.pressedRegion = null;

      if (!pressed) return;
      if (!regionHit(pressed, p.x, p.y)) return;

      // The region's own action. Every region carries one, including the
      // chrome (nav tabs, the End Day button) and the modal overlays.
      pressed.onClick();

      // The screen also gets told, so it can update hover state.
      const screen = this.screens.get(this.activeId);
      screen?.onRegionClick?.(pressed, this.context());
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('resize', () => this.surface.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  private onKey(e: KeyboardEvent): void {
    // Number keys pick a screen; Escape backs out of an overlay.
    const index = Number(e.key);
    if (index >= 1 && index <= 8) {
      const ids = ['dig', 'curator', 'vault', 'gallery', 'reel', 'shop', 'ledger', 'goals'];
      this.goTo(ids[index - 1]);
      return;
    }

    if (e.key === 'Escape') {
      if (this.summary) {
        this.summary = null;
        return;
      }
      if (this.tutorialOpen) {
        this.tutorialOpen = false;
        this.state.skipTutorial();
        return;
      }
    }

    if (e.key === 'Enter' && this.activeId === 'title') {
      this.startNewGame();
    }
  }

  // ------------------------------------------------------------------ flow

  /** Switch to a screen. */
  public goTo(id: string): void {
    if (!this.screens.has(id)) return;
    if (this.activeId === id) return;
    this.activeId = id;
    this.screens.get(id)?.enter?.();
    this.audio.playClick();
  }

  /** Begin a fresh game from the title screen. */
  public startNewGame(): void {
    this.state.reset();
    this.state.sim.manual = true;
    this.summary = null;
    this.tutorialOpen = this.settings.showTutorial;
    this.toasts.clear();
    this.goTo('dig');
    this.savePending = true;
  }

  /** Continue from the saved game. */
  public continueGame(): boolean {
    if (!loadGame(this.state)) return false;
    this.summary = null;
    this.tutorialOpen = false;
    this.goTo('dig');
    this.toasts.push('Museum reopened.', PAL.G, 2.6, 90);
    return true;
  }

  /** Resolve the day and show the summary. */
  public endDay(): void {
    if (this.summary) return;
    const summary = this.state.endDay();
    this.savePending = true;
    void summary;
  }

  /** Dismiss the day summary. */
  public dismissSummary(): void {
    this.summary = null;
  }

  private context(): ScreenContext {
    return {
      state: this.state,
      sprites: this.sprites,
      surface: this.surface,
      time: this.elapsed,
      pointer: this.pointer,
    };
  }

  // ------------------------------------------------------------------ loop

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    if (!this.running) return;

    // Clamp the frame time so a tab that was backgrounded does not try to
    // catch up with a thousand ticks at once.
    const dt = Math.min(0.25, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.elapsed += dt;

    this.accumulator += dt;
    while (this.accumulator >= TICK_DT) {
      this.accumulator -= TICK_DT;
      this.tick(TICK_DT);
    }

    this.render();

    if (this.savePending) {
      this.savePending = false;
      saveGame(this.state);
    }

    requestAnimationFrame(this.frame);
  };

  /** One simulation tick. */
  private tick(dt: number): void {
    this.toasts.update(dt);
    this.audio.update(dt);
  }

  // ------------------------------------------------------------------ draw

  private render(): void {
    const g = this.surface.ctx;
    const ctx = this.context();

    // The audit spans the WHOLE frame, not just the screen's own
    // drawing.
    //
    // The BOUNDS belong to the screen alone -- a screen that reaches
    // past its band is the defect the band check looks for. But the
    // CONTRAST belongs to every word on the screen, and the framework
    // draws words too: the HUD's numerals, the nav labels, the hint
    // line. The HUD's charm counter was once drawn in a colour that
    // measured 2.23:1 against the cream bar behind it, and nobody
    // noticed, because the only checks that existed asked whether a
    // control was present and whether its pixels were in the palette.
    //
    // So the audit is on for the frame, and the bounds are gated on
    // `inScreen` instead.
    beginAudit(g);
    try {
      this.renderFrame(g, ctx);
    } finally {
      endAudit(g);
    }
  }

  private renderFrame(g: CanvasRenderingContext2D, ctx: ScreenContext): void {
    // The page behind the panels is the darker parchment, so the cream
    // panels read as raised surfaces rather than dissolving into the
    // background.
    this.surface.begin(PAL.X);

    const screen = this.screens.get(this.activeId);
    if (!screen) return;

    // The title screen owns the whole canvas. Every other screen is framed
    // by the HUD and the nav strip.
    const isTitle = this.activeId === 'title';

    this.regions = [];
    this.overlayRegions = [];

    if (!isTitle) {
      const hud = drawHud(ctx);
      this.navButtons = navLayout(LOGICAL_WIDTH, LOGICAL_HEIGHT);
      for (const b of this.navButtons) {
        this.regions.push({
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h,
          id: `nav:${b.id}`,
          onClick: () => this.goTo(b.id),
        });
      }
      this.regions.push({
        x: hud.endDayButton.x,
        y: hud.endDayButton.y,
        w: hud.endDayButton.w,
        h: hud.endDayButton.h,
        id: 'hud:endday',
        onClick: () => this.endDay(),
      });
    }

    // The screen's own content, inset below the HUD and above the nav.
    //
    // The bands own the edges: the HUD is the framework's, the nav strip
    // is the framework's, and the hint band below the nav is the
    // framework's too. A screen draws between the HUD and the nav strip
    // and nowhere else, and the band contract says which slice of that
    // space belongs to the title, the content and the footer.
    const contentTop = isTitle ? 0 : HUD_HEIGHT;
    const contentBottom = isTitle ? LOGICAL_HEIGHT : NAV_TOP;

    const screenCtx: ScreenContext = {
      ...ctx,
      surface: this.surface,
    };

    // Clip the screen's drawing to its band, so a screen cannot paint over
    // the HUD.
    //
    // The clip has to wrap the LAYOUT as well as the draw. The screens
    // draw their panels inside layout() -- that is where the panel
    // rectangles, the wells and the bars are actually painted -- so
    // clipping only the draw left the panels free to paint over the HUD
    // and the nav strip with nothing to stop them.
    //
    // The audit wraps the same region, so the browser check can measure
    // exactly what the screen painted and assert that it stayed inside
    // the bands the contract gives it.
    g.save();
    g.beginPath();
    g.rect(0, contentTop, LOGICAL_WIDTH, contentBottom - contentTop);
    g.clip();

    // The screen's own drawing, and only that, counts towards the bounds.
    audit.inScreen = true;
    let own: Region[];
    try {
      // Ask the screen for its regions first, so a click in the same frame
      // as a layout change still lands on the right thing.
      own = screen.layout({
        ...screenCtx,
        time: this.elapsed,
      });
      screen.draw(screenCtx);
    } finally {
      audit.inScreen = false;
    }
    g.restore();

    this.regions.push(...own);

    if (!isTitle) {
      drawNav(ctx, this.activeId, this.navButtons);
    }

    this.drawToasts(g);
    this.drawSummary(g);
    this.drawTutorial(g);
    this.drawHint(g);
  }

  /** The toast stack, drawn over the scene. */
  private drawToasts(g: CanvasRenderingContext2D): void {
    for (const t of this.toasts.toasts) {
      const alpha = Math.min(1, t.life / 0.6);
      // The panel is wide enough for the chip AND the words, so the
      // accent never has to be spelled by the glyph.
      const w = Math.min(440, 46 + t.text.length * 7);
      const x = Math.round(LOGICAL_WIDTH / 2 - w / 2);
      const y = Math.round(t.y);
      const h = 30;
      // The fade region has to cover the panel AND its offset shadow, or
      // the shadow would hang around at full strength while the panel
      // dissolved.
      drawWithOrderedFade(g, { x, y, w: w + SHADOW_OFFSET, h: h + SHADOW_OFFSET }, alpha, (c) => {
        drawPanel(c, { x, y, w, h }, { fill: PAL.D, shadow: true, raised: false });
        // The toast panel is DARK, so the text is paper white (12.43:1 on
        // D) rather than the accent hue. Rust on the dark panel is only
        // 3.38:1, and a coloured GLYPH that faint is a legibility bug.
        // The accent survives as a CHIP beside the words, so "rust" still
        // means "theft", and the words say it anyway.
        drawChip(c, x + 8, y + 11, t.color);
        drawText(c, t.text, x + 22, y + 9, {
          font: FONT.small,
          color: PAL.W,
          maxWidth: w - 30,
        });
      });
    }
  }

  /** The end-of-day summary overlay. */
  private drawSummary(g: CanvasRenderingContext2D): void {
    const s = this.summary;
    if (!s) return;

    drawVeil(g, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, PAL.K, PAL.P);

    const w = 460;
    const h = 330;
    const x = (LOGICAL_WIDTH - w) / 2;
    const y = (LOGICAL_HEIGHT - h) / 2;

    drawPanel(g, { x, y, w, h }, { fill: PAL.C, title: `Day ${s.day} closes` });

    let ly = y + 46;
    const line = (label: string, value: string, tint: string = PAL.K) => {
      // The label is panel-edge ink, not the mid brown N. N on the cream
      // summary panel is 4.06:1 -- under the floor for body text. P on
      // cream is 8.32:1 and still reads a step lighter than the D value.
      drawText(g, label, x + 24, ly, { font: FONT.body, color: PAL.P });
      // Dark ink for the value, a chip for the tint. Clay money on cream
      // is 2.47:1 and arcane teal is 1.23:1 -- unreadable as glyphs.
      drawTintedValue(g, value, x + w - 24, ly, {
        font: FONT.body,
        tint,
        align: 'right',
      });
      ly += 22;
    };

    line('Takings', `£${Math.round(s.revenue)}`, PAL.A);
    line('Upkeep', `-£${Math.round(s.opex)}`, PAL.T);
    if (s.capex > 0) line('Investment', `-£${Math.round(s.capex)}`, PAL.U);
    if (s.payout > 0) line('Fate Reel', `+£${Math.round(s.payout)}`, PAL.E);
    if (s.stolen > 0) line('Stolen', `-${s.stolen}`, PAL.T);
    if (s.curated > 0) line('Catalogued', `${s.curated}`, PAL.M);

    g.fillStyle = PAL.P;
    g.fillRect(x + 24, ly - 4, w - 48, 1);
    ly += 8;

    const deltaColor = s.delta >= 0 ? PAL.M : PAL.T;
    drawText(g, 'Change', x + 24, ly, { font: FONT.mid, color: PAL.D });
    drawTintedValue(g, `${s.delta >= 0 ? '+' : ''}£${Math.round(s.delta)}`, x + w - 24, ly, {
      font: FONT.mid,
      tint: deltaColor,
      align: 'right',
    });
    ly += 26;

    drawText(g, `In the till: £${Math.round(s.money)}`, x + 24, ly, {
      font: FONT.body,
      color: PAL.K,
    });
    ly += 26;

    if (s.day_event && s.day_event.title) {
      drawTintedValue(g, `Omen: ${s.day_event.title}`, x + 24, ly, {
        font: FONT.small,
        tint: PAL.U,
      });
      ly += 18;
    }

    const btnW = 140;
    const btnX = x + (w - btnW) / 2;
    const btnY = y + h - 46;
    g.fillStyle = PAL.Y;
    g.fillRect(btnX, btnY, btnW, 30);
    g.fillStyle = PAL.K;
    g.fillRect(btnX, btnY, btnW, 1);
    g.fillRect(btnX, btnY + 29, btnW, 1);
    g.fillRect(btnX, btnY, 1, 30);
    g.fillRect(btnX + btnW - 1, btnY, 1, 30);
    drawText(g, 'Close', btnX + btnW / 2, btnY + 9, {
      font: FONT.body,
      color: PAL.K,
      align: 'center',
    });

    this.overlayRegions.push({
      x: btnX,
      y: btnY,
      w: btnW,
      h: 30,
      id: 'summary:close',
      onClick: () => this.dismissSummary(),
    });
  }

  /** The tutorial overlay. */
  private drawTutorial(g: CanvasRenderingContext2D): void {
    if (!this.tutorialOpen) return;
    const beat = this.state.tutorial.current();
    if (!beat) {
      this.tutorialOpen = false;
      return;
    }

    drawVeil(g, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, PAL.K, PAL.P);

    const w = 520;
    const h = 210;
    const x = (LOGICAL_WIDTH - w) / 2;
    const y = (LOGICAL_HEIGHT - h) / 2;

    drawPanel(g, { x, y, w, h }, { fill: PAL.C, title: beat.title });

    // Wrap the body text by hand: the canvas has no word-wrap, and the
    // body is prose rather than a label.
    const maxWidth = w - 56;
    const words = beat.body.split(' ');
    let lineText = '';
    let ly = y + 52;
    for (const word of words) {
      const test = lineText.length === 0 ? word : `${lineText} ${word}`;
      if (measureText(test, FONT.body) > maxWidth && lineText.length > 0) {
        drawText(g, lineText, x + 28, ly, { font: FONT.body, color: PAL.D });
        ly += 19;
        lineText = word;
      } else {
        lineText = test;
      }
    }
    if (lineText) {
      drawText(g, lineText, x + 28, ly, { font: FONT.body, color: PAL.D });
    }

    // Progress dots.
    const total = this.state.tutorial.progress();
    for (let i = 0; i < total; i++) {
      g.fillStyle = i <= this.state.tutorial.index ? PAL.Y : PAL.P;
      g.fillRect(x + 28 + i * 12, y + h - 66, 8, 8);
    }

    const btnW = 130;
    const btnX = x + w - btnW - 24;
    const btnY = y + h - 52;
    g.fillStyle = PAL.Y;
    g.fillRect(btnX, btnY, btnW, 30);
    g.fillStyle = PAL.K;
    g.fillRect(btnX, btnY, btnW, 1);
    g.fillRect(btnX, btnY + 29, btnW, 1);
    g.fillRect(btnX, btnY, 1, 30);
    g.fillRect(btnX + btnW - 1, btnY, 1, 30);
    drawText(g, 'Got it', btnX + btnW / 2, btnY + 9, {
      font: FONT.body,
      color: PAL.K,
      align: 'center',
    });

    // The skip link.
    drawTintedValue(g, 'Skip tutorial', x + 28, btnY + 9, {
      font: FONT.small,
      tint: PAL.U,
    });

    this.overlayRegions.push({
      x: btnX,
      y: btnY,
      w: btnW,
      h: 30,
      id: 'tutorial:next',
      onClick: () => {
        this.state.tutorial.advance();
        this.state.onTutorialAdvanced?.();
        if (!this.state.tutorial.active()) this.tutorialOpen = false;
      },
    });

    this.overlayRegions.push({
      x: x + 28,
      y: btnY,
      w: 110,
      h: 30,
      id: 'tutorial:skip',
      onClick: () => {
        this.state.skipTutorial();
        this.tutorialOpen = false;
      },
    });
  }

  /** The contextual hint at the bottom of the content area. */
  private drawHint(g: CanvasRenderingContext2D): void {
    const screen = this.screens.get(this.activeId);
    if (!screen || this.activeId === 'title') return;

    const hint = screen.hint?.(this.context());
    if (!hint) return;
    // The hint runs along the bottom of the content area, over the
    // parchment background. Panel-edge ink, not N: P on the parchment
    // X is 7.59:1, N on X is only 3.70:1.
    //
    // It lives in the HINT band, which the framework owns outright. A
    // screen that wants to say something to the player uses the FOOTER
    // band, which is its own -- so the two can never land on top of
    // each other.
    drawText(g, hint, 16, HINT_TEXT_Y, {
      font: FONT.small,
      color: PAL.P,
      maxWidth: LOGICAL_WIDTH - 32,
    });
  }
}
