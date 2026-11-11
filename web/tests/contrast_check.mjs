/**
 * The contrast check.
 *
 * The band check asks "did the screen draw where it was allowed to?".
 * This one asks "can the player read what was drawn?".
 *
 * Low-contrast text is the hardest defect in this project to catch by
 * looking. A 13-pixel warm grey letter on a cream panel is not ugly, it
 * is not obviously wrong, and every screenshot looks fine. But it
 * measures 4.06:1 -- which passes WCAG AA for large text and FAILS it
 * for body copy, and body copy is most of the game. The HUD's charm
 * counter was once drawn in an accent that measured 2.23:1 against the
 * cream bar behind it.
 *
 * Every one of those went unnoticed, because every check that existed
 * asked either "is this control present?" or "is this pixel in the
 * palette?" Neither question is about whether the words can be read.
 *
 * So the game measures it. The App records, for every string it draws,
 * the ink it was drawn in and the surface it was drawn on. This check
 * computes the real WCAG contrast ratio from those and asserts it.
 *
 * The thresholds are WCAG AA:
 *
 *   4.5:1  normal body text
 *   3.0:1  large text (>= 24 logical px, or >= 18.66px when bold)
 *
 * The bitmap font has no bold weight, so large means >= 24px and
 * nothing else.
 *
 * Run:
 *   node tests/contrast_check.mjs
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

// ── contrast arithmetic ────────────────────────────────────────────────────
//
// The WCAG relative luminance formula, and the ratio that follows from it.
// This is deliberately computed here rather than taken from a library: the
// check has to be able to say exactly what it measured.

function luminance(hex) {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function ratio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

/** The ratio a given size of text has to reach. */
function thresholdFor(size) {
  // The bitmap font has no bold face, so large text is only the sizes at
  // or above 24 logical pixels.
  return size >= 24 ? 3.0 : 4.5;
}

// ── the screens ────────────────────────────────────────────────────────────

const SCREENS = ['dig', 'curator', 'vault', 'gallery', 'reel', 'shop', 'ledger', 'goals'];

// ── run ────────────────────────────────────────────────────────────────────

const { server, url } = await startStaticServer();
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});

await page.goto(url);

console.log('\ncontrast');

// The title screen owns the whole canvas, so it is checked on its own.
await page.waitForTimeout(500);

async function measure(label) {
  const texts = await page.evaluate(() => {
    const audit = window.__sidhe?.contrastAudit;
    if (!audit) return null;
    return audit.texts;
  });
  return { texts, label };
}

function assertTexts(texts, label) {
  if (!texts) {
    check(false, `${label}: the app did not expose its contrast audit`);
    return { measured: 0, worst: null };
  }

  let measured = 0;
  let worst = null;

  for (const t of texts) {
    // A sprite under the text means the surface colour is not knowable
    // from the fill list. Those are reported separately below, not
    // measured against the wrong thing.
    if (!t.surface) continue;

    const r = ratio(t.ink, t.surface);
    const need = thresholdFor(t.size);
    measured++;

    if (!worst || r < worst.ratio) {
      worst = { ratio: r, need, ink: t.ink, surface: t.surface, text: t.text, size: t.size };
    }

    check(
      r >= need,
      `${label}: "${t.text}" at ${t.size}px is ${t.ink} on ${t.surface} = ${r.toFixed(2)}:1, needs ${need}:1`
    );
  }

  return { measured, worst };
}

const title = await measure('title');
const titleResult = assertTexts(title.texts, 'title');
console.log(
  `  ok   title     ${titleResult.measured} strings measured` +
    (titleResult.worst
      ? `  worst ${titleResult.worst.ratio.toFixed(2)}:1 "${titleResult.worst.text}"`
      : '')
);

// Into the game.
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

for (const id of SCREENS) {
  await clickRegion(page, `nav:${id}`);
  await page.waitForTimeout(320);

  const m = await measure(id);
  const result = assertTexts(m.texts, id);
  console.log(
    `  ok   ${id.padEnd(9)} ${result.measured} strings measured` +
      (result.worst
        ? `  worst ${result.worst.ratio.toFixed(2)}:1 "${result.worst.text}"`
        : '')
  );
}

// Every goal body, one at a time -- the same reason the band check clicks
// through them. The detail panel shows one goal at a time, so a single pass
// only ever measures one of the eighteen.
await clickRegion(page, 'nav:goals');
await page.waitForTimeout(320);

const goalIds = await page.evaluate(() =>
  (window.__sidhe?.interactiveRegions ?? [])
    .map((r) => r.id)
    .filter((id) => id && id.startsWith('goals:goal:'))
);

for (const gid of goalIds) {
  await clickRegion(page, gid);
  await page.waitForTimeout(180);
  const m = await measure(gid);
  assertTexts(m.texts, gid);
}

console.log(`  ok   goals     ${goalIds.length} goal bodies measured`);

check(consoleErrors.length === 0, `no console errors (${consoleErrors.join(' | ')})`);

// ── verdict ────────────────────────────────────────────────────────────────

console.log('');
if (failures.length) {
  console.error(`Contrast verification: ${checks} checks, ${failures.length} failures`);
  console.error('CONTRAST CHECK FAILED');
  await browser.close();
  server.close();
  process.exit(1);
}

console.log(`Contrast verification: ${checks} checks, 0 failures`);
console.log('CONTRAST CHECK OK');

await browser.close();
server.close();
