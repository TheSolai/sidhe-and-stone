/**
 * A one-off probe: which draw call goes past the right edge of the canvas?
 *
 * Patches the 2D context prototype so every fillRect and drawImage is
 * recorded with its destination rectangle, then drives the app to a
 * screen and prints the calls that reach past 960 logical pixels.
 *
 *   node tests/probe_overflow.mjs curator reel
 */

import { loadPlaywright, launchBrowser, startStaticServer, clickRegion } from './browser_helpers.mjs';

const { chromium } = await loadPlaywright();
const { server, url } = await startStaticServer();
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

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

await page.evaluate(() => {
  window.__rects = [];
  const P = CanvasRenderingContext2D.prototype;
  const fr = P.fillRect;
  const di = P.drawImage;
  P.fillRect = function (x, y, w, h) {
    window.__rects.push({ kind: 'fill', x, y, w, h, color: String(this.fillStyle) });
    return fr.call(this, x, y, w, h);
  };
  P.drawImage = function (...a) {
    const src = a[0];
    let dx, dy, dw, dh;
    if (a.length >= 9) { dx = a[5]; dy = a[6]; dw = a[7]; dh = a[8]; }
    else if (a.length >= 5) { dx = a[1]; dy = a[2]; dw = a[3]; dh = a[4]; }
    else { dx = a[1]; dy = a[2]; dw = src.width; dh = src.height; }
    window.__rects.push({ kind: 'sprite', x: dx, y: dy, w: dw, h: dh });
    return di.apply(this, a);
  };
});

for (const screen of process.argv.slice(2)) {
  await clickRegion(page, `nav:${screen}`);
  await page.waitForTimeout(400);
  const rects = await page.evaluate(() => {
    const r = window.__rects.slice();
    window.__rects = [];
    return r;
  });
  const over = rects.filter((r) => r.x + r.w > 960 || r.x < 0 || r.y + r.h > 540);
  console.log(`\n== ${screen}: ${rects.length} calls, ${over.length} past the canvas ==`);
  for (const r of over.slice(0, 25)) {
    console.log(`   ${r.kind} ${r.x},${r.y} ${r.w}x${r.h} -> right=${r.x + r.w}${r.color ? ' ' + r.color : ''}`);
  }
  // Also the widest calls, to see how close the panel is.
  const widest = rects.slice().sort((a, b) => (b.x + b.w) - (a.x + a.w)).slice(0, 6);
  console.log('   widest: ' + widest.map((r) => `${r.kind} ${r.x}..${r.x + r.w}`).join(', '));
}

await browser.close();
server.close();
