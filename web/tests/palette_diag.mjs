/**
 * Diagnostic: locate off-palette pixels on each screen.
 *
 * Prints the bounding box of every off-palette cluster and the colour
 * involved, so a blend can be traced to the widget that drew it.
 */
import {
  launchBrowser,
  loadPlaywright,
  loadPalette,
  clickRegion,
  startStaticServer,
} from './browser_helpers.mjs';

const { chromium } = loadPlaywright();

/**
 * The palette, read from art/palette.px.js.
 *
 * Parsed rather than copied, so this diagnostic always compares against
 * the colours the game actually draws with.
 */
const PALETTE = new Set(loadPalette());

const { server, url } = await startStaticServer();
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(
  () => document.getElementById('boot')?.classList.contains('hidden'),
  { timeout: 15000 }
);

await clickRegion(page, 'title:new');
await page.waitForTimeout(400);
await clickRegion(page, 'tutorial:skip');
await page.waitForTimeout(400);

for (const id of ['curator', 'vault', 'gallery', 'reel', 'shop', 'ledger', 'goals']) {
  await clickRegion(page, `nav:${id}`);
  await page.waitForTimeout(250);

  const report = await page.evaluate((palette) => {
    const set = new Set(palette);
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const byColour = new Map();
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const hex =
          '#' +
          [data[i], data[i + 1], data[i + 2]]
            .map((v) => v.toString(16).padStart(2, '0'))
            .join('');
        if (set.has(hex)) continue;
        const e = byColour.get(hex) ?? { n: 0, minX: 1e9, maxX: -1, minY: 1e9, maxY: -1 };
        e.n++;
        e.minX = Math.min(e.minX, x);
        e.maxX = Math.max(e.maxX, x);
        e.minY = Math.min(e.minY, y);
        e.maxY = Math.max(e.maxY, y);
        byColour.set(hex, e);
      }
    }

    const total = data.length / 4;
    const list = [...byColour.entries()].sort((a, b) => b[1].n - a[1].n);
    const strayTotal = list.reduce((a, [, e]) => a + e.n, 0);

    // The dominant colour and where it lives.
    const counts = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const hex =
        '#' +
        [data[i], data[i + 1], data[i + 2]]
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('');
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      total,
      strayTotal,
      strayPct: ((strayTotal / total) * 100).toFixed(2),
      dominant: { hex: dominant[0], pct: ((dominant[1] / total) * 100).toFixed(1) },
      top: list.slice(0, 6).map(([hex, e]) => ({
        hex,
        n: e.n,
        box: `${e.minX},${e.minY} ${e.maxX - e.minX + 1}x${e.maxY - e.minY + 1}`,
      })),
    };
  }, [...PALETTE]);

  console.log(`\n=== ${id} ===`);
  console.log(`off-palette: ${report.strayPct}% (${report.strayTotal} px)`);
  console.log(`dominant: ${report.dominant.hex} ${report.dominant.pct}%`);
  for (const t of report.top) console.log(`  ${t.hex} n=${t.n} box=${t.box}`);
}

await browser.close();
server.close();
