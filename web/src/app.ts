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
import { drawHud, drawNav, HUD_HEIGHT, navLayout, type NavButton } from './ui/hud.ts';
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
import { drawPanel, drawText, FONT, measureText } from './ui/widgets.ts';

import { TitleScreen } from './ui/screens/title.ts';
import { DigSiteScreen } from './ui/screens/dig-site.ts';
import { CuratorScreen } from './ui/screens/curator.ts';
import { VaultScreen } from './ui/screens/vault.ts';
import { GalleryScreen } from './ui/screens/gallery.ts';
import { ReelScreen } from './ui/screens/reel.ts';
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

  constructor(canvas: HTMLCanvasElement, settings: Settings, atlas: Record<string, unknown>) {
    this.surface = new Surface(canvas);
    this.sprites = new SpriteSet(atlas as never);
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
    if (index >= 1 && index <= 7) {
      const ids = ['dig', 'curator', 'vault', 'gallery', 'reel', 'ledger', 'goals'];
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
    const contentTop = isTitle ? 0 : HUD_HEIGHT;
    const contentBottom = isTitle ? LOGICAL_HEIGHT : LOGICAL_HEIGHT - 34;

    const screenCtx: ScreenContext = {
      ...ctx,
      surface: this.surface,
    };

    // Ask the screen for its regions first, so a click in the same frame as
    // a layout change still lands on the right thing.
    const own = screen.layout({
      ...screenCtx,
      time: this.elapsed,
    });
    this.regions.push(...own);

    // Clip the screen's drawing to its band, so a screen cannot paint over
    // the HUD.
    g.save();
    g.beginPath();
    g.rect(0, contentTop, LOGICAL_WIDTH, contentBottom - contentTop);
    g.clip();
    screen.draw(screenCtx);
    g.restore();

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
      g.globalAlpha = alpha;
      const w = Math.min(420, 20 + t.text.length * 7);
      const x = LOGICAL_WIDTH / 2 - w / 2;
      drawPanel(g, { x, y: t.y, w, h: 30 }, { fill: PAL.D, shadow: true, raised: false });
      drawText(g, t.text, LOGICAL_WIDTH / 2, t.y + 9, {
        font: FONT.small,
        color: t.color,
        align: 'center',
        maxWidth: w - 16,
      });
      g.globalAlpha = 1;
    }
  }

  /** The end-of-day summary overlay. */
  private drawSummary(g: CanvasRenderingContext2D): void {
    const s = this.summary;
    if (!s) return;

    g.fillStyle = 'rgba(22, 18, 15, 0.72)';
    g.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const w = 460;
    const h = 330;
    const x = (LOGICAL_WIDTH - w) / 2;
    const y = (LOGICAL_HEIGHT - h) / 2;

    drawPanel(g, { x, y, w, h }, { fill: PAL.C, title: `Day ${s.day} closes` });

    let ly = y + 46;
    const line = (label: string, value: string, color: string = PAL.K) => {
      drawText(g, label, x + 24, ly, { font: FONT.body, color: PAL.N });
      drawText(g, value, x + w - 24, ly, {
        font: FONT.body,
        color,
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
    drawText(
      g,
      `${s.delta >= 0 ? '+' : ''}£${Math.round(s.delta)}`,
      x + w - 24,
      ly,
      { font: FONT.mid, color: deltaColor, align: 'right' }
    );
    ly += 26;

    drawText(g, `In the till: £${Math.round(s.money)}`, x + 24, ly, {
      font: FONT.body,
      color: PAL.K,
    });
    ly += 26;

    if (s.day_event && s.day_event.title) {
      drawText(g, `Omen: ${s.day_event.title}`, x + 24, ly, {
        font: FONT.small,
        color: PAL.U,
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

    g.fillStyle = 'rgba(22, 18, 15, 0.68)';
    g.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

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
    drawText(g, 'Skip tutorial', x + 28, btnY + 9, {
      font: FONT.small,
      color: PAL.U,
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
    drawText(g, hint, 16, LOGICAL_HEIGHT - 56, {
      font: FONT.small,
      color: PAL.N,
      maxWidth: LOGICAL_WIDTH - 32,
    });
  }
}
