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
  loadPalette,
  loadPaletteByKey,
  readCanvas,
  countColour,
  clickRegion,
  startStaticServer,
} from './browser_helpers.mjs';

const { chromium } = loadPlaywright();

/**
 * The palette, read from art/palette.px.js.
 *
 * Every rendered pixel is an exact palette entry. The text is a baked
 * 1-bit bitmap font and the geometry is integer-aligned, so there are no
 * anti-aliased glyph edges and no resampled surfaces left to blend into
 * colours that are not in this list.
 *
 * That means the check below can demand a perfect result rather than
 * tolerating the blends an anti-aliased system font used to produce.
 *
 * The list is PARSED from the palette file, not copied into this test.
 * A copy goes stale the moment the palette is re-solved, and a stale
 * list fails for the wrong reason - or worse, passes against colours
 * the game no longer draws.
 */
const PALETTE = loadPalette();

const PALETTE_SET = new Set(PALETTE.map((h) => h.toLowerCase()));

/**
 * The palette by letter.
 *
 * The checks below measure named roles -- "the cream of the HUD", "the
 * gold rule", "the dark nav band" -- so they ask for the palette LETTER
 * rather than a hex. If the palette is re-solved, the letter keeps its
 * meaning and the measured colour follows it automatically. A hardcoded
 * hex here would quietly measure the wrong thing, or measure nothing.
 */
const PAL = loadPaletteByKey();

/**
 * The most pixels a single off-palette colour may cover.
 *
 * Zero, deliberately. With the bitmap font and integer-aligned geometry
 * there is no source of blends left, and every screen was measured at
 * exactly zero off-palette pixels. The old limit of 500 existed to
 * tolerate anti-aliased text edges; tolerating them any more would let a
 * real drift — a smooth gradient or an alpha-blended shadow — creep back
 * in unnoticed.
 */
const MAX_OFF_PALETTE_COLOUR = 0;

/** How much of a screen may be off-palette in total, for any reason. */
const MAX_OFF_PALETTE_SHARE = 0;

/**
 * Check that a screen is drawn in the palette.
 *
 * Returns a result rather than mutating a counter that was passed in.
 * Mutating a by-value parameter would let the check print FAIL and still
 * report zero failures, which is worse than no check at all.
 */
function isOnPalette(label, counts) {
  const total = counts.reduce((a, [, n]) => a + n, 0);
  const stray = counts.filter(([hex]) => !PALETTE_SET.has(hex.toLowerCase()));
  const strayTotal = stray.reduce((a, [, n]) => a + n, 0);
  const share = strayTotal / total;

  const worst = stray[0];
  if (worst && worst[1] > MAX_OFF_PALETTE_COLOUR) {
    return {
      ok: false,
      message:
        `${label} has an off-palette surface: ${worst[0]} covers ` +
        `${worst[1]} pixels (${((worst[1] / total) * 100).toFixed(2)}% of the screen). ` +
        'A real surface has drifted; text edges never cover this much.',
    };
  }

  if (share > MAX_OFF_PALETTE_SHARE) {
    return {
      ok: false,
      message:
        `${label} is mostly off-palette (${(share * 100).toFixed(2)}% of pixels, ` +
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
const goldOnTitle = await countColour(page, PAL.G, 200, 100, 560, 80);
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
const hudCream = await countColour(page, PAL.C, 0, 0, 960, 55);
check(hudCream > 20000, `the HUD is a cream bar (${hudCream} px)`);

const hudGold = await countColour(page, PAL.Y, 0, 55, 960, 3);
check(hudGold > 900, `the HUD has its gold rule (${hudGold} px)`);

// The nav strip: a dark band along the bottom, with cream chips on it.
const navDark = await countColour(page, PAL.D, 0, 502, 960, 34);
check(navDark > 10000, `the nav strip is a dark band (${navDark} px)`);

const navCream = await countColour(page, PAL.C, 0, 502, 960, 34);
check(navCream > 1000, `the nav buttons are cream chips (${navCream} px)`);

// ---------------------------------------------------------------- each screen

const navIds = ['dig', 'curator', 'vault', 'gallery', 'reel', 'shop', 'ledger', 'goals'];

for (const id of navIds) {
  await clickRegion(page, `nav:${id}`);
  await page.waitForTimeout(300);

  const screen = await readCanvas(page);

  // Every screen keeps the HUD and the nav strip.
  const hud = await countColour(page, PAL.C, 0, 0, 960, 55);
  check(hud > 20000, `the ${id} screen keeps its HUD (${hud} px)`);

  const nav = await countColour(page, PAL.D, 0, 502, 960, 34);
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
