/**
 * Entry point.
 *
 * Loads the sprites, builds the app, and starts the frame loop. Everything
 * else is imported by `app.ts`.
 */

import { App } from './app.ts';
import { hasSave, loadSettings, saveSettings, type Settings } from './save.ts';
import { SpriteSet, type SpriteAtlas } from './ui/sprites.ts';

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  const bootEl = document.getElementById('boot');

  if (!canvas) {
    throw new Error('Sidhe & Stone: no canvas to draw on');
  }

  const settings = loadSettings();

  // Load the atlas manifest, then every sprite in it. The manifest is
  // generated at build time by `scripts/sync-assets.mjs`.
  const manifestResponse = await fetch(`${import.meta.env.BASE_URL}sprites/atlas.json`);
  if (!manifestResponse.ok) {
    throw new Error('Sidhe & Stone: could not load the sprite manifest');
  }
  const atlas = (await manifestResponse.json()) as SpriteAtlas;

  const sprites = new SpriteSet(atlas);
  await sprites.load(`${import.meta.env.BASE_URL}sprites`);

  const { App: AppClass } = { App };
  const app = new AppClass(canvas, settings, atlas as unknown as Record<string, unknown>);

  // The title screen needs to know whether there is a save to continue.
  const title = app.screens.get('title');
  if (title && 'hasSave' in title) {
    (title as unknown as { hasSave: boolean }).hasSave = hasSave();
  }

  // The title screen's three buttons.
  if (title && 'onNew' in title) {
    const t = title as unknown as {
      onNew: () => void;
      onContinue: () => void;
      onSettings: () => void;
    };
    t.onNew = () => app.startNewGame();
    t.onContinue = () => {
      if (!app.continueGame()) app.startNewGame();
    };
    t.onSettings = () => openSettings(settings);
  }

  if (bootEl) bootEl.classList.add('hidden');

  // A test seam. The browser checks drive the real game through this, so
  // they can find a control by its id instead of by a hardcoded pixel
  // position that breaks the moment a layout shifts.
  (window as unknown as { __sidhe?: unknown }).__sidhe = app;

  app.start();
}

/**
 * A small settings panel, toggled from the title screen.
 *
 * It is deliberately minimal: sound on or off, motion, and a reset. The
 * accessibility settings matter because the canvas is otherwise opaque to
 * assistive technology.
 */
function openSettings(settings: Settings): void {
  const backdrop = document.createElement('div');
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-label', 'Settings');
  backdrop.style.cssText = `
    position: fixed; inset: 0; display: grid; place-items: center;
    background: rgba(22,18,15,0.72); z-index: 20; font-family: ui-monospace, monospace;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    background: #e8dcc4; color: #16120f; border: 2px solid #16120f;
    padding: 20px 24px; min-width: 320px; box-shadow: 6px 6px 0 rgba(0,0,0,0.35);
  `;

  const title = document.createElement('h2');
  title.textContent = 'Settings';
  title.style.cssText = 'margin: 0 0 14px; font-size: 18px;';
  panel.appendChild(title);

  const rows: [keyof Settings, string][] = [
    ['sound', 'Sound'],
    ['music', 'Music'],
    ['reducedMotion', 'Reduced motion'],
    ['highContrast', 'High contrast'],
    ['showTutorial', 'Show the tutorial'],
  ];

  for (const [key, label] of rows) {
    const row = document.createElement('label');
    row.style.cssText =
      'display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 8px 0; font-size: 13px; cursor: pointer;';

    const text = document.createElement('span');
    text.textContent = label;
    row.appendChild(text);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(settings[key]);
    input.addEventListener('change', () => {
      (settings as unknown as Record<string, boolean>)[key] = input.checked;
      saveSettings(settings);
    });
    row.appendChild(input);
    panel.appendChild(row);
  }

  const close = document.createElement('button');
  close.textContent = 'Close';
  close.style.cssText = `
    margin-top: 16px; width: 100%; padding: 8px; font: inherit; cursor: pointer;
    background: #d9a441; border: 2px solid #16120f; color: #16120f;
  `;
  close.addEventListener('click', () => backdrop.remove());
  panel.appendChild(close);

  backdrop.appendChild(panel);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  document.body.appendChild(backdrop);
}

boot().catch((err) => {
  const bootEl = document.getElementById('boot');
  if (bootEl) {
    bootEl.textContent = `Sidhe & Stone failed to start: ${err instanceof Error ? err.message : String(err)}`;
    bootEl.classList.remove('hidden');
  }
  console.error(err);
});
