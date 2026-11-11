/**
 * Canvas pixel analysis.
 *
 * Verifies what the game actually DRAWS, not just that it draws something.
 * A canvas that is the right size but full of the wrong colours is still
 * broken, and a screenshot glance does not catch that reliably.
 *
 * The checks are made against the shared palette, so the interface cannot
 * quietly drift away from the artwork's colours.
 *
 * Run:
 *   node tests/canvas_check.mjs
 */

import {
  launchBrowser,
  loadPlaywright,
  readCanvas,
  countColour,
  clickRegion,
  startStaticServer,
} from './browser_helpers.mjs';

const { chromium } = loadPlaywright();

/**
 * The palette, as hex strings.
 *
 * Text is drawn with the browser's anti-aliased fonts, so its edge pixels
 * are blends rather than exact palette entries. The check therefore
 * allows a small tolerance, and fails only when a whole surface has
 * drifted off-palette.
 */
const PALETTE = [
  '#16120f', '#2f251d', '#453729', '#6e624a', '#845537', '#b0895f',
  '#d6d4c8', '#e8dcc4', '#f7f2e3', '#b4794a', '#d9a441', '#e0b23c',
  '#f2d98a', '#c05f3c', '#7d9a52', '#5f9e8f', '#6dd3df', '#a8e8ef',
  '#8b99a6', '#8a8378',
];

const PALETTE_SET = new Set(PALETTE.map((h) => h.toLowerCase()));

/** How much of a screen may be anti-aliased text edges. */
const ANTIALIAS_TOLERANCE = 0.02;

/**
 * Check that a screen is drawn in the palette.
 *
 * Reports the off-palette share rather than the raw count: a few hundred
 * blended glyph edges are expected, a few thousand means a surface has
 * drifted.
 *
 * Returns a boolean so the caller owns the counters. Passing a counter in
 * and mutating it would silently fail to report -- a test harness that
 * cannot fail is worse than no harness at all.
 */
function isOnPalette(label, counts) {
  const total = counts.reduce((a, [, n]) => a + n, 0);
  const stray = counts.filter(([hex]) => !PALETTE_SET.has(hex.toLowerCase()));
  const strayTotal = stray.reduce((a, [, n]) => a + n, 0);
  const share = strayTotal / total;

  if (share > ANTIALIAS_TOLERANCE) {
    return {
      ok: false,
      message:
        `${label} is off-palette (${(share * 100).toFixed(2)}% of pixels, ` +
        `worst: ${stray
          .slice(0, 4)
          .map(([h, n]) => `${h}x${n}`)
          .join(', ')})`,
    };
  }
  return { ok: true, message: '' };
}

let failures = 0;
let checks = 0;

function check(condition, message) {
  checks++;
  if (!condition) {
    failures++;
    console.error(`  FAIL: ${message}`);
  }
}

const { server, url } = await startStaticServer();

const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.error(`  [pageerror] ${e}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(
  () => document.getElementById('boot')?.classList.contains('hidden'),
  { timeout: 15000 }
);

// ---------------------------------------------------------------- the title

const title = await readCanvas(page);
check(title.width === 960 && title.height === 540, 'the canvas is 960x540');

// The title uses the palette and nothing else.
const titlePalette = isOnPalette('the title screen', title.counts);
check(titlePalette.ok, titlePalette.message);

// The title banner: gold pixels near the top.
const goldOnTitle = await countColour(page, '#e0b23c', 200, 100, 560, 80);
check(goldOnTitle > 200, `the title is drawn in gold (${goldOnTitle} px)`);

// ---------------------------------------------------------------- the dig site

// Start a new game, then dismiss the tutorial so the screen is unobscured.
//
// The tutorial dims the whole canvas behind its panel, so any colour
// measured while it is up is a blend, not a palette colour. Skip it.
await clickRegion(page, 'title:new');
await page.waitForTimeout(400);
await clickRegion(page, 'tutorial:skip');
await page.waitForTimeout(400);

const dig = await readCanvas(page);
check(dig.counts.length > 8, `the dig screen uses many colours (${dig.counts.length})`);

// The HUD strip: cream across the top, with a gold rule under it.
const hudCream = await countColour(page, '#e8dcc4', 0, 0, 960, 55);
check(hudCream > 20000, `the HUD is a cream bar (${hudCream} px)`);

const hudGold = await countColour(page, '#d9a441', 0, 55, 960, 3);
check(hudGold > 900, `the HUD has its gold rule (${hudGold} px)`);

// The nav strip: a dark band along the bottom, with cream chips on it.
const navDark = await countColour(page, '#2f251d', 0, 502, 960, 34);
check(navDark > 10000, `the nav strip is a dark band (${navDark} px)`);

const navCream = await countColour(page, '#e8dcc4', 0, 502, 960, 34);
check(navCream > 1000, `the nav buttons are cream chips (${navCream} px)`);

// ---------------------------------------------------------------- each screen

const navIds = ['dig', 'curator', 'vault', 'gallery', 'reel', 'ledger', 'goals'];

for (const id of navIds) {
  await clickRegion(page, `nav:${id}`);
  await page.waitForTimeout(300);

  const screen = await readCanvas(page);

  // Every screen keeps the HUD and the nav strip.
  const hud = await countColour(page, '#e8dcc4', 0, 0, 960, 55);
  check(hud > 20000, `the ${id} screen keeps its HUD (${hud} px)`);

  const nav = await countColour(page, '#2f251d', 0, 502, 960, 34);
  check(nav > 10000, `the ${id} screen keeps its nav strip (${nav} px)`);

  // Every screen is drawn in the palette.
  const screenPalette = isOnPalette(`the ${id} screen`, screen.counts);
  check(screenPalette.ok, screenPalette.message);

  // No screen is mostly one flat colour: something is actually happening.
  const total = screen.counts.reduce((a, [, n]) => a + n, 0);
  const biggest = Math.max(...screen.counts.map(([, n]) => n));
  check(
    biggest / total < 0.85,
    `the ${id} screen is not one flat colour (${((biggest / total) * 100).toFixed(1)}% dominant)`
  );
}

await browser.close();
server.close();

console.log(`Canvas analysis: ${checks} checks, ${failures} failures`);
if (failures > 0) {
  console.error('CANVAS CHECK FAILED');
  process.exit(1);
}
console.log('CANVAS CHECK OK');
