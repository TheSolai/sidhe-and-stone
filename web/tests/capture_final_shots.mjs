#!/usr/bin/env node
/**
 * Capture the final screenshots of the built game.
 *
 * Drives the actual dist/ build in a real browser -- the same artifact
 * that ships -- so what the screenshots show is what a player gets.
 *
 * The pictures go into web/screenshots/, not into art/: the art
 * directory belongs to the artwork pipeline, and a screen capture is a
 * record of a build, not an asset.
 *
 * Run:
 *   node tests/capture_final_shots.mjs
 */

import {
  launchBrowser,
  loadPlaywright,
  regionIds,
  clickRegion,
  startStaticServer,
} from './browser_helpers.mjs';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const shotDir = resolve(here, '..', 'screenshots');

const { chromium } = loadPlaywright();

const { server, url } = await startStaticServer();
console.log(`serving ${url}`);

const browser = await launchBrowser(chromium);
// The viewport must be wide enough to show the WHOLE 960x540 game.
// The game scales by an integer factor, so at 1920x1200 it renders at
// exactly 2x and the entire canvas is visible.
const page = await browser.newPage({
  viewport: { width: 1920, height: 1200 },
  deviceScaleFactor: 1,
});

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

mkdirSync(shotDir, { recursive: true });

async function shot(name) {
  await page.waitForTimeout(450);
  const file = resolve(shotDir, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`shot: ${file}`);
}

/** Click a region by id; returns true if it existed and was clicked. */
async function tryClick(id) {
  const ids = await regionIds(page);
  const hit = ids.find((x) => x === id) ?? ids.find((x) => x.toLowerCase().includes(id));
  if (!hit) return false;
  const rect = await clickRegion(page, hit);
  if (!rect) return false;
  await page.waitForTimeout(500);
  console.log(`  clicked ${hit}`);
  return true;
}

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await shot('01-title');

// Start a fresh game so we are looking at live gameplay screens.
if (await tryClick('title:new')) {
  await page.waitForTimeout(700);
  await shot('02-tutorial');
}

// Dismiss the tutorial so the underlying game is visible in every later shot.
for (let i = 0; i < 6; i += 1) {
  const ids = await regionIds(page);
  if (!ids.some((id) => id.startsWith('tutorial:'))) break;
  const skipped = await tryClick('tutorial:skip');
  if (!skipped) await tryClick('tutorial:next');
  await page.waitForTimeout(400);
}
await shot('03-gameplay');

// The dig screen, with a dig actually ASSIGNED, so the frame is
// genuinely different from the gameplay shot.
await tryClick('dig:card:trench');
await tryClick('dig:plot:0');
await shot('04-dig');

// End the day, so the dig resolves and the finds are shown.
await tryClick('hud:endday');
await page.waitForTimeout(600);
await shot('05-dig-result');
await tryClick('summary:close');
await page.waitForTimeout(400);

// Walk every nav screen that exists.
for (const nav of ['gallery', 'vault', 'curator', 'reel', 'shop', 'ledger', 'goals']) {
  if (await tryClick(`nav:${nav}`)) {
    await shot(`06-${nav}`);
  }
}

// The reel, mid-spin: the one frame that shows the machine working.
await tryClick('nav:reel');
await page.waitForTimeout(300);
await tryClick('reel:spin');
await page.waitForTimeout(500);
await shot('07-reel-spin');

console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join('\n')}` : 'no console errors');

await browser.close();
server.close();
