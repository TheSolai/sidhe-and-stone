/**
 * The larger-font audit.
 *
 * Every screen in this game was laid out for one type ramp: 8, 16, 24,
 * 32, 48 logical pixels. That is fine as long as nobody ever asks for
 * larger text -- and somebody always does. A layout that only fits at
 * one size is a layout that breaks the moment the type grows, and the
 * breakage is invisible in a screenshot of the shipped size.
 *
 * So this check runs every screen at the shipped size and at two larger
 * ones, and asks the same question at each: did the screen stay inside
 * the canvas, and did it have to cut any of its words?
 *
 * At the shipped size the answer must be clean, on every screen. At the
 * larger sizes the findings are REPORTED, screen by screen, because
 * they are the map of what would have to change for the game to carry
 * a large-text mode -- and a report that is not a failure is the
 * honest thing to hand over.
 */

import {
  launchBrowser,
  loadPlaywright,
  clickRegion,
  startStaticServer,
} from './browser_helpers.mjs';

const { chromium } = loadPlaywright();

const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 540;

/** Every screen the navigation strip can reach. */
const SCREENS = ['dig', 'curator', 'vault', 'gallery', 'reel', 'shop', 'ledger', 'goals'];

/** The scales the audit runs at. One is the shipped size. */
const SCALES = [1, 1.25, 1.5];

let failures = [];
let checks = 0;

function check(condition, message) {
  checks++;
  if (!condition) {
    failures.push(message);
    console.error(`  FAIL: ${message}`);
  }
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

// ── the audit ───────────────────────────────────────────────────────────────

console.log('\nlarger-font audit');

for (const scale of SCALES) {
  await page.evaluate((s) => window.__sidhe?.setFontScale?.(s), scale);
  await page.waitForTimeout(200);

  const rows = [];

  for (const id of SCREENS) {
    await clickRegion(page, `nav:${id}`);
    await page.waitForTimeout(280);

    const result = await page.evaluate(() => {
      const audit = window.__sidhe?.layoutAudit;
      if (!audit) return null;
      return { bounds: audit.bounds, truncations: audit.truncations };
    });

    if (!result || !result.bounds) {
      rows.push({ id, drawn: false, off: 0, cut: 0 });
      continue;
    }

    const b = result.bounds;
    // How far outside the canvas the screen reached.
    const off = Math.max(
      0,
      -b.minX,
      -b.minY,
      b.maxX - LOGICAL_WIDTH,
      b.maxY - LOGICAL_HEIGHT
    );
    rows.push({
      id,
      drawn: true,
      off,
      cut: result.truncations.length,
      cutTexts: result.truncations.slice(0, 3),
      bounds: b,
    });
  }

  // Every WORD on the screen, measured against the canvas.
  //
  // The band check only measures the screen's own rectangles, and it
  // only visits the screens the navigation strip reaches. The words are
  // the other half of the question: a line of text that runs off the
  // right edge of the canvas is broken even when every panel is inside
  // it, and this reads the frames the band check never sees -- the
  // overlays, the toasts, the hint line and the navigation strip.
  const words = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d');
    const measure = (text, size) => {
      c.font = `${size}px "Silkscreen"`;
      let w = 0;
      for (const ch of text) w += c.measureText(ch).width;
      return w;
    };
    const texts = window.__sidhe?.contrastAudit?.texts ?? [];
    const bad = [];
    for (const t of texts) {
      const w = measure(t.text, t.size);
      const over = Math.max(0, -t.x, -t.y, t.x + w - 960, t.y + t.size - 540);
      if (over > 0) bad.push({ text: t.text, x: t.x, y: t.y, over });
    }
    return bad;
  });

  const worstOff = Math.max(...rows.map((r) => r.off));
  const totalCut = rows.reduce((n, r) => n + r.cut, 0);
  const worstWord = words.reduce((n, w) => Math.max(n, w.over), 0);

  console.log(
    `\n  scale x${scale}: ${rows.length} screens, ` +
      `worst overhang ${worstOff}px, ${totalCut} string(s) cut, ` +
      `worst word overhang ${worstWord}px`
  );
  for (const r of rows) {
    const mark = r.off > 0 || r.cut > 0 ? '!!  ' : 'ok  ';
    console.log(
      `    ${mark} ${r.id.padEnd(8)} ` +
        (r.drawn
          ? `drew to ${r.bounds.maxX},${r.bounds.maxY}` +
            (r.off > 0 ? `  OFF by ${r.off}px` : '') +
            (r.cut > 0 ? `  cut: ${r.cutTexts.map((t) => `"${t.slice(0, 26)}…"`).join(', ')}` : '')
          : 'drew nothing')
    );
  }
  for (const w of words.slice(0, 6)) {
    console.log(
      `    !!  word "${w.text.slice(0, 30)}" at ${w.x},${w.y} runs ${w.over}px off the canvas`
    );
  }

  if (scale === 1) {
    // At the shipped size every screen must be inside the canvas and
    // none of them may cut a word.
    for (const r of rows) {
      check(r.drawn, `${r.id}: drew nothing at all`);
      check(r.off === 0, `${r.id}: drew ${r.off}px outside the canvas`);
      check(r.cut === 0, `${r.id}: cut ${r.cut} string(s) at the shipped size`);
    }
  }
}

await page.evaluate(() => window.__sidhe?.setFontScale?.(1));
check(consoleErrors.length === 0, `console errors: ${consoleErrors.join(' | ')}`);

console.log(`\nLarger-font audit: ${checks} checks, ${failures.length} failures`);
if (failures.length === 0) {
  console.log('FONT SCALE CHECK OK');
}

await browser.close();
server.close();

process.exit(failures.length === 0 ? 0 : 1);
