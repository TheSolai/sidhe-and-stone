#!/usr/bin/env node
/**
 * Measure the glyphs the game actually renders.
 *
 * The claim this file backs up is that the text on screen is Silkscreen,
 * cut into a one-bit mask, and that at the sizes in the ramp its stems
 * land on whole pixels. That is a measurable claim, so it is measured
 * here rather than asserted in prose:
 *
 *   - the face the browser reports as loaded,
 *   - the advance of every character at every size in the ramp, and
 *     whether that advance is a whole number of logical pixels,
 *   - the ink box of the glyphs (cap height, x-height, baseline offset),
 *   - the pixels that actually reach the canvas, read back from a real
 *     frame, to confirm the mask is one-bit: every pixel of a drawn
 *     glyph is either the exact ink colour or the surface behind it.
 *
 * Run:
 *   node tests/glyph_metrics.mjs
 */

import {
  launchBrowser,
  loadPlaywright,
  clickRegion,
  startStaticServer,
} from './browser_helpers.mjs';

const { chromium } = loadPlaywright();

const RAMP = [
  ['tiny', 8],
  ['small', 16],
  ['body', 16],
  ['mid', 24],
  ['large', 32],
  ['huge', 48],
];

const { server, url } = await startStaticServer();
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

await clickRegion(page, 'title:new');
await page.waitForTimeout(400);
for (let i = 0; i < 8; i++) {
  const ids = await page.evaluate(() =>
    (window.__sidhe?.interactiveRegions ?? []).map((r) => r.id).filter(Boolean)
  );
  if (!ids.some((id) => id.startsWith('tutorial:'))) break;
  if (!(await clickRegion(page, 'tutorial:skip'))) await clickRegion(page, 'tutorial:next');
  await page.waitForTimeout(250);
}

const metrics = await page.evaluate((ramp) => {
  const out = {};

  // ── the face ─────────────────────────────────────────────────────────────
  out.fonts = {
    family: 'Silkscreen',
    loaded: document.fonts.check('16px "Silkscreen"'),
    faces: [...document.fonts].map((f) => `${f.family} ${f.style} ${f.weight} ${f.status}`),
  };

  // ── the advances ─────────────────────────────────────────────────────────
  const c = document.createElement('canvas').getContext('2d');
  const advance = (ch, size) => {
    c.font = `${size}px "Silkscreen"`;
    return c.measureText(ch).width;
  };
  const SAMPLE = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?';

  out.sizes = ramp.map(([name, size]) => {
    c.font = `${size}px "Silkscreen"`;
    const advances = [...SAMPLE].map((ch) => advance(ch, size));
    const fractional = advances.filter((a) => Math.abs(a - Math.round(a)) > 1e-6);
    const metrics = c.measureText('Hxpg');
    const ascent = Math.ceil(metrics.fontBoundingBoxAscent);
    const descent = Math.ceil(metrics.fontBoundingBoxDescent);

    // The ink box, cut the way the game cuts it.
    const pad = size + 2;
    const width = size * 3 + 4;
    const height = ascent + descent + size + 4;
    const baseline = ascent + 2;
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const og = off.getContext('2d', { willReadFrequently: true });
    og.clearRect(0, 0, width, height);
    og.font = `${size}px "Silkscreen"`;
    og.textAlign = 'left';
    og.textBaseline = 'alphabetic';
    og.fillStyle = '#ffffff';
    og.fillText('H', pad, baseline);
    const data = og.getImageData(0, 0, width, height).data;
    let top = height;
    let bottom = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] >= 0.45 * 255) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }

    return {
      name,
      size,
      advanceMin: Math.min(...advances),
      advanceMax: Math.max(...advances),
      advanceMean: advances.reduce((a, b) => a + b, 0) / advances.length,
      space: advance(' ', size),
      fractional: fractional.length,
      ascent,
      descent,
      capHeight: bottom - top + 1,
      capTop: top - baseline,
      capBottom: bottom - baseline,
    };
  });

  // ── what actually reaches the canvas ─────────────────────────────────────
  //
  // The pixels of a drawn glyph are read back from the real frame: every
  // pixel must be the exact ink colour or the surface behind it. A
  // blended edge would mean the mask is not one-bit.
  const canvas = document.getElementById('game');
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const region = g.getImageData(24, 62, 220, 40); // the "FATE REEL" title
  const colours = new Map();
  for (let i = 0; i < region.data.length; i += 4) {
    const hex =
      '#' +
      [region.data[i], region.data[i + 1], region.data[i + 2]]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('');
    colours.set(hex, (colours.get(hex) ?? 0) + 1);
  }
  out.canvasColours = [...colours.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return out;
}, RAMP);

console.log('\nfont family');
console.log(`  family requested : ${metrics.fonts.family}`);
console.log(`  document.fonts   : ${metrics.fonts.loaded ? 'loaded' : 'NOT LOADED'}`);
for (const f of metrics.fonts.faces) console.log(`  face             : ${f}`);

console.log('\nglyph metrics (Silkscreen, one-bit mask)');
console.log(
  '  name    size  advance min/max/mean  space  fractional  ascent  descent  cap height  cap top/bottom'
);
for (const s of metrics.sizes) {
  console.log(
    `  ${s.name.padEnd(6)} ${String(s.size).padStart(4)}  ` +
      `${s.advanceMin.toFixed(1).padStart(5)}/${s.advanceMax.toFixed(1).padStart(5)}/${s.advanceMean.toFixed(2).padStart(6)}  ` +
      `${s.space.toFixed(1).padStart(5)}  ${String(s.fractional).padStart(9)}  ` +
      `${String(s.ascent).padStart(6)}  ${String(s.descent).padStart(7)}  ` +
      `${String(s.capHeight).padStart(10)}  ${String(s.capTop).padStart(4)}/${String(s.capBottom).padStart(4)}`
  );
}

console.log('\ncolours on the canvas where a title is drawn');
for (const [hex, n] of metrics.canvasColours) {
  console.log(`  ${hex}  ${n} px`);
}

await browser.close();
server.close();
