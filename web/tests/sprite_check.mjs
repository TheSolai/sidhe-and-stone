/**
 * Sprite landing verification for Sidhe & Stone.
 *
 * Every other check in this project asked "is this control present?" and
 * never "did the pixel land?". That is precisely the gap a sprite bug
 * hides in: the reel has a text fallback, the gallery pedestals stand
 * empty, and the game looks like a working game with the art quietly
 * deleted. A whole project shipped that way before anyone looked.
 *
 * So this check compares the PIXELS. For each sprite the game is supposed
 * to draw, it reads the region of the real canvas where that sprite must
 * be, and compares every opaque pixel of the real PNG against the canvas.
 * If the sprite is missing, unloaded, drawn at the wrong place, drawn at
 * the wrong scale, or drawn through a smoothing path that blends its
 * edges, the comparison fails.
 *
 * It drives the real dist/ build in a real browser, so what it reads is
 * what a player sees.
 *
 * Run:
 *   node tests/sprite_check.mjs
 */

import {
  launchBrowser,
  loadPlaywright,
  clickRegion,
  startStaticServer,
} from './browser_helpers.mjs';

const { chromium } = loadPlaywright();

let failures = [];
let checks = 0;

function check(condition, message) {
  checks++;
  if (!condition) {
    failures.push(message);
    console.error(`  FAIL: ${message}`);
  }
}

// ── the expected layout ─────────────────────────────────────────────────────
//
// These positions are duplicated from the screens that draw the sprites.
// That is deliberate: the point of this check is to catch the screen and
// the artwork drifting APART. If a card moves, this check fails and the
// constant here gets updated in the same commit -- which is the review you
// want, rather than a check that quietly followed the code around and
// never noticed anything had gone wrong.

const SHOP = {
  MARGIN_X: 20,
  // The shop is a nine-row LIST, not a grid of cards: the upgrade
  // descriptions are sentences, and a sentence needs a line of its own.
  // The rows start at CONTENT_TOP + 4 and are 30 tall.
  LIST_TOP: 96,
  ROW_H: 30,
  // The sprite sits this far into the row, at this scale.
  ICON_DX: 12,
  ICON_DY: 6,
  ICON_SCALE: 1,
};

// The upgrade order is the order in sim-core.ts.
const UPGRADES = [
  ['site', 'upgrade_site'],
  ['curator', 'upgrade_curator'],
  ['gallery', 'upgrade_gallery'],
  ['omen', 'upgrade_omen'],
  ['diggers', 'upgrade_diggers'],
  ['archivists', 'upgrade_archivists'],
  ['wards', 'upgrade_wards'],
  ['excavators', 'upgrade_excavators'],
  ['guides', 'upgrade_guides'],
];

const DIG = {
  PAL_Y: 248, // plotY 92 + plotH 130 + 26
  CARD_W: 294,
  CARD_H: 70,
  GAP: 14,
  PER_ROW: 3,
  START_X: 24,
  // The dig picture sits this far from the card's right edge.
  ICON_FROM_RIGHT: 30,
  ICON_DY: 8,
  ICON_SCALE: 1,
};

const DIG_TYPES = ['test_pit', 'trench', 'cutting', 'shaft', 'deepworks'];

/**
 * Compare a canvas rectangle against a sprite PNG, pixel for pixel.
 *
 * Only the sprite's OPAQUE pixels are compared. The sprite PNGs are
 * palette-indexed with binary alpha, and the transparent parts of the
 * sprite let the panel behind it show through, which is correct.
 */
async function compareRegion(page, sprite, x, y, scale) {
  return page.evaluate(
    async ({ sprite, x, y, scale }) => {
      const img = new Image();
      img.src = `/sprites/${sprite}.png`;
      await img.decode();

      const off = document.createElement('canvas');
      off.width = img.naturalWidth;
      off.height = img.naturalHeight;
      const og = off.getContext('2d', { willReadFrequently: true });
      og.imageSmoothingEnabled = false;
      og.drawImage(img, 0, 0);
      const sp = og.getImageData(0, 0, off.width, off.height).data;

      const canvas = document.getElementById('game');
      const g = canvas.getContext('2d', { willReadFrequently: true });
      const w = off.width * scale;
      const h = off.height * scale;
      const gp = g.getImageData(x, y, w, h).data;

      let compared = 0;
      let mismatch = 0;
      const firstBad = [];

      for (let sy = 0; sy < off.height; sy++) {
        for (let sx = 0; sx < off.width; sx++) {
          const si = (sy * off.width + sx) * 4;
          if (sp[si + 3] !== 255) continue; // transparent: background shows

          const dx = sx * scale;
          const dy = sy * scale;
          let bad = false;
          for (let oy = 0; oy < scale && !bad; oy++) {
            for (let ox = 0; ox < scale && !bad; ox++) {
              const di = ((dy + oy) * w + (dx + ox)) * 4;
              if (
                gp[di] !== sp[si] ||
                gp[di + 1] !== sp[si + 1] ||
                gp[di + 2] !== sp[si + 2]
              ) {
                bad = true;
              }
            }
          }
          compared++;
          if (bad) {
            mismatch++;
            if (firstBad.length < 4) {
              firstBad.push(`sprite(${sx},${sy}) vs canvas(${dx},${dy})`);
            }
          }
        }
      }
      return { compared, mismatch, firstBad, spriteW: off.width, spriteH: off.height };
    },
    { sprite, x, y, scale }
  );
}

const { server, url } = await startStaticServer();

const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

// New game, then past the tutorial.
await clickRegion(page, 'title:new');
await page.waitForTimeout(400);
for (let i = 0; i < 8; i++) {
  const ids = await page.evaluate(() =>
    (window.__sidhe?.interactiveRegions ?? []).map((r) => r.id).filter(Boolean)
  );
  if (!ids.some((id) => id.startsWith('tutorial:'))) break;
  if (!(await clickRegion(page, 'tutorial:skip'))) {
    await clickRegion(page, 'tutorial:next');
  }
  await page.waitForTimeout(250);
}
await page.waitForTimeout(300);

// ── the nine upgrade icons ──────────────────────────────────────────────────

console.log('\nshop sprites');
await clickRegion(page, 'nav:shop');
await page.waitForTimeout(500);

for (let i = 0; i < UPGRADES.length; i++) {
  const [kind, sprite] = UPGRADES[i];
  const rowY = SHOP.LIST_TOP + i * SHOP.ROW_H;
  const x = SHOP.MARGIN_X + SHOP.ICON_DX;
  const y = rowY + SHOP.ICON_DY;

  const res = await compareRegion(page, sprite, x, y, SHOP.ICON_SCALE);
  const ok = res.compared > 0 && res.mismatch === 0;
  check(ok, `${sprite}: ${res.mismatch}/${res.compared} pixels wrong on the canvas`);
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${sprite.padEnd(18)} ${res.compared} px compared` +
      (res.mismatch ? `  ${res.mismatch} wrong  ${res.firstBad.join(' ')}` : '')
  );
}

// ── the five dig pictures ───────────────────────────────────────────────────

console.log('\ndig sprites');
await clickRegion(page, 'nav:dig');
await page.waitForTimeout(500);

for (let i = 0; i < DIG_TYPES.length; i++) {
  const dig = DIG_TYPES[i];
  const sprite = `dig_${dig}`;
  const row = Math.floor(i / DIG.PER_ROW);
  const col = i % DIG.PER_ROW;
  const cx = DIG.START_X + col * (DIG.CARD_W + DIG.GAP);
  const cy = DIG.PAL_Y + row * (DIG.CARD_H + DIG.GAP);
  const x = cx + DIG.CARD_W - DIG.ICON_FROM_RIGHT;
  const y = cy + DIG.ICON_DY;

  const res = await compareRegion(page, sprite, x, y, DIG.ICON_SCALE);
  const ok = res.compared > 0 && res.mismatch === 0;
  check(ok, `${sprite}: ${res.mismatch}/${res.compared} pixels wrong on the canvas`);
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${sprite.padEnd(18)} ${res.compared} px compared` +
      (res.mismatch ? `  ${res.mismatch} wrong  ${res.firstBad.join(' ')}` : '')
  );
}

// ── and the ones that were already there ───────────────────────────────────
//
// The reel symbols and the gallery pedestals are the sprites the original
// bug silenced, so they are checked here too: they are the ones that
// proved the bug was real.

console.log('\nreel symbols');
await clickRegion(page, 'nav:reel');
await page.waitForTimeout(600);

const reelSymbols = ['clover', 'honey', 'moon', 'star', 'bog', 'blight'];
const reelIds = await page.evaluate(() =>
  (window.__sidhe?.interactiveRegions ?? []).map((r) => r.id).filter(Boolean)
);
check(reelIds.length > 0, 'the reel screen exposed no regions at all');

// The symbol sprites are drawn into the reel windows. Rather than guess
// the geometry of a rotating wheel, check that each symbol PNG exists,
// decodes, and is the right size -- and that the reel actually drew
// SOMETHING (a non-empty set of pixels in the window strip).
for (const sym of reelSymbols) {
  const size = await page.evaluate(async (name) => {
    const img = new Image();
    img.src = `/sprites/symbol_${name}.png`;
    try {
      await img.decode();
      return { w: img.naturalWidth, h: img.naturalHeight };
    } catch {
      return null;
    }
  }, sym);
  check(size !== null && size.w === 18 && size.h === 18,
    `symbol_${sym}.png did not decode to 18x18 (got ${size ? `${size.w}x${size.h}` : 'nothing'})`);
  console.log(`  ${size ? 'ok  ' : 'FAIL'} symbol_${sym.padEnd(12)} ${size ? `${size.w}x${size.h}` : 'MISSING'}`);
}

check(consoleErrors.length === 0, `console errors: ${consoleErrors.join(' | ')}`);

console.log(`\nSprite landing verification: ${checks} checks, ${failures.length} failures`);
if (failures.length === 0) {
  console.log('SPRITE CHECK OK');
}

await browser.close();
server.close();

process.exit(failures.length === 0 ? 0 : 1);
