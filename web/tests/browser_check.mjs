/**
 * Browser verification for Sidhe & Stone.
 *
 * Drives the real built game in a real browser and proves the things that
 * a unit test cannot: that the canvas renders, that the controls are
 * live, that clicking a nav button actually changes screens, and that the
 * game state advances when the player ends a day.
 *
 * Controls are found by their region id through the app's test seam, so a
 * layout change does not turn every check into a false failure.
 *
 * Run:
 *   node tests/browser_check.mjs
 */

import {
  launchBrowser,
  loadPlaywright,
  canvasSignature,
  clickRegion,
  regionIds,
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

const { server, url } = await startStaticServer();

const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
// The boot overlay hides once the sprites are decoded.
await page.waitForFunction(
  () => document.getElementById('boot')?.classList.contains('hidden'),
  { timeout: 15000 }
);

// ---------------------------------------------------------------- the title

const title = await canvasSignature(page);
check(title.colours > 8, `the title screen is painted (${title.colours} distinct colours)`);

await page.screenshot({ path: '/tmp/ss-01-title.png' });

// The three title buttons must exist as real, clickable regions.
const titleIds = await regionIds(page);
for (const id of ['title:new', 'title:continue', 'title:settings']) {
  check(titleIds.includes(id), `the title screen has a ${id} control`);
}

// ---------------------------------------------------------------- new game

await clickRegion(page, 'title:new');
await page.waitForTimeout(400);

const afterNew = await canvasSignature(page);
check(
  afterNew.checksum !== title.checksum,
  'clicking New Museum changed what is on screen'
);
await page.screenshot({ path: '/tmp/ss-02-tutorial.png' });

// The tutorial must be running.
const tutorialIds = await regionIds(page);
check(tutorialIds.includes('tutorial:next'), 'the tutorial opened with a "Got it" button');

// ---------------------------------------------------------------- the tutorial

await clickRegion(page, 'tutorial:next');
await page.waitForTimeout(250);
await clickRegion(page, 'tutorial:next');
await page.waitForTimeout(250);
await page.screenshot({ path: '/tmp/ss-03-dig.png' });

// ---------------------------------------------------------------- navigation

const navIds = ['dig', 'curator', 'vault', 'gallery', 'reel', 'shop', 'ledger', 'goals'];

let activeTab = 'dig';
for (const id of navIds) {
  const before = await canvasSignature(page);
  const rect = await clickRegion(page, `nav:${id}`);
  check(rect !== null, `the ${id} tab is a clickable region`);
  await page.waitForTimeout(250);
  const after = await canvasSignature(page);
  if (id !== activeTab) {
    check(after.checksum !== before.checksum, `the ${id} tab changes the screen`);
  }
  activeTab = id;
  await page.screenshot({ path: `/tmp/ss-04-${id}.png` });
}

// ---------------------------------------------------------------- the shop

// The shop is the first screen in the web build that spends money, so it
// gets a real test: buy an upgrade and prove that money went down, the
// owned count went up, and the effect actually landed.
//
// A screen that merely renders is not a working shop. This is the check
// that would have caught the nine upgrades being unreachable.
await clickRegion(page, 'nav:shop');
await page.waitForTimeout(300);

const shopIds = await regionIds(page);
const buyIds = shopIds.filter((id) => id.startsWith('shop:buy:'));
check(buyIds.length > 0, `the shop offers something to buy (${buyIds.length} buttons)`);

// A fresh game starts with 240, and a dig site costs 180, so the site
// upgrade is affordable at the start.
const before = await page.evaluate(() => {
  const app = window.__sidhe;
  return {
    money: app.state.money(),
    owned: app.state.upgradeCount('site'),
    sites: app.state.sites(),
    cost: app.state.upgradeCost('site'),
  };
});
check(before.cost > 0, `a dig site has a price (${before.cost})`);
check(before.money >= before.cost, `the player can afford one at the start (${before.money} >= ${before.cost})`);

const bought = await clickRegion(page, 'shop:buy:site');
check(bought !== null, 'the buy button is a clickable region');
await page.waitForTimeout(300);

const after = await page.evaluate(() => {
  const app = window.__sidhe;
  return {
    money: app.state.money(),
    owned: app.state.upgradeCount('site'),
    sites: app.state.sites(),
  };
});
check(after.money === before.money - before.cost, `buying cost money (${before.money} -> ${after.money})`);
check(after.owned === before.owned + 1, `the owned count went up (${before.owned} -> ${after.owned})`);
check(after.sites === before.sites + 1, `the extra dig site exists (${before.sites} -> ${after.sites})`);

// The price must escalate, so the second one costs more than the first.
const nextCost = await page.evaluate(() => window.__sidhe.state.upgradeCost('site'));
check(nextCost > before.cost, `the next one costs more (${before.cost} -> ${nextCost})`);

await page.screenshot({ path: '/tmp/ss-05-shop.png' });

// ---------------------------------------------------------------- the dig loop

// Back to the dig site. Assign a dig to the first site, then end the day.
await clickRegion(page, 'nav:dig');
await page.waitForTimeout(250);

const digIds = await regionIds(page);
const digCards = digIds.filter((id) => id.startsWith('dig:card:'));
// Five dig types since the content expansion: test pit, trench, cutting,
// shaft and deepworks. This assertion used to expect three, and it was
// the only thing that caught the expansion -- a stale count is a test
// that quietly stops testing.
check(digCards.length === 5, `the dig site offers five dig types (${digCards.length})`);

await clickRegion(page, 'dig:card:trench');
await page.waitForTimeout(150);
await clickRegion(page, 'dig:plot:0');
await page.waitForTimeout(250);
await page.screenshot({ path: '/tmp/ss-05-dig-assigned.png' });

// The assignment must show up in the storeroom's pending state.
const state = await page.evaluate(() => {
  const app = window.__sidhe;
  return {
    day: app.state.day(),
    pending: app.state.pendingDig(0),
    money: app.state.money(),
  };
});
check(state.pending === 'trench', `the trench was assigned to site 1 (got "${state.pending}")`);

// ---------------------------------------------------------------- end of day

await clickRegion(page, 'hud:endday');
await page.waitForTimeout(500);

const summaryIds = await regionIds(page);
check(summaryIds.includes('summary:close'), 'ending a day opens the summary overlay');
await page.screenshot({ path: '/tmp/ss-06-summary.png' });

// The day must have advanced.
const afterDay = await page.evaluate(() => {
  const app = window.__sidhe;
  return { day: app.state.day(), money: app.state.money() };
});
check(afterDay.day === state.day + 1, `the day advanced (${state.day} -> ${afterDay.day})`);

await clickRegion(page, 'summary:close');
await page.waitForTimeout(300);

// ---------------------------------------------------------------- the save

const saved = await page.evaluate(() => localStorage.getItem('sidhe-and-stone/save'));
check(saved !== null, 'a save was written');
if (saved) {
  const parsed = JSON.parse(saved);
  check(parsed.version >= 1, 'the save carries a version');
  check(parsed.payload && parsed.payload.sim, 'the save carries the sim state');
  // The RNG state is a uint64 and must survive the round trip as a string.
  check(
    typeof parsed.payload.sim.rng_state === 'string',
    'the save keeps the RNG state as a string'
  );
}

// ------------------------------------------------------- the pressed state
//
// RULE 3.6: on press, a button SINKS -- its bevel inverts -- rather than
// fading. The press has to reach the drawing code, not just the click
// handler, so the check holds the pointer down and reads the canvas
// while the button is still held.
//
// A button that only reacts on release is a button that gives no
// feedback, and on a canvas interface there is no DOM hover state to
// fall back on.
//
// The tutorial has to be dismissed first: its veil is an ordered dither
// over the WHOLE screen, including the nav strip, and a dithered veil
// erases the very pixels this check is looking for.

// Dismiss the tutorial if it is still running.
if ((await regionIds(page)).includes('tutorial:skip')) {
  await clickRegion(page, 'tutorial:skip');
  await page.waitForTimeout(250);
}

const pressPoint = await page.evaluate(() => {
  const app = window.__sidhe;
  const region = app.interactiveRegions.find((r) => r.id === 'nav:reel');
  if (!region) return null;
  const canvas = document.getElementById('game');
  const bounds = canvas.getBoundingClientRect();
  const scale = bounds.width / canvas.width;
  return {
    x: bounds.left + (region.x + region.w / 2) * scale,
    y: bounds.top + (region.y + region.h / 2) * scale,
    region: { x: region.x, y: region.y, w: region.w, h: region.h },
  };
});
check(pressPoint !== null, 'the reel tab can be found for a press test');

/** The exact pixels of the nav chip, so the comparison is pixel-true. */
const chipPixels = async () =>
  page.evaluate((r) => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    return [...ctx.getImageData(r.x, r.y, r.w, r.h).data];
  }, pressPoint.region);

if (pressPoint) {
  const idle = await chipPixels();

  await page.mouse.move(pressPoint.x, pressPoint.y);
  await page.mouse.down();
  await page.waitForTimeout(200);

  const held = await page.evaluate(() => window.__sidhe.pressedRegionId);
  check(held === 'nav:reel', `holding the button reports it as pressed (${held})`);

  const pressed = await chipPixels();
  const differing = idle.filter((v, i) => v !== pressed[i]).length;
  check(differing > 0, `the held button is drawn differently from the released one (${differing} bytes differ)`);
  await page.screenshot({ path: '/tmp/ss-06-pressed.png' });

  // Release over empty canvas, so the release does not also navigate.
  await page.mouse.move(600, 300);
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(200);

  const afterRelease = await page.evaluate(() => window.__sidhe.pressedRegionId);
  check(afterRelease === null, `releasing clears the pressed state (${afterRelease})`);

  const back = await chipPixels();
  const same = idle.every((v, i) => v === back[i]);
  check(same, 'the button looks the same again once it is released');
}

// ---------------------------------------------------------------- the reel

await clickRegion(page, 'nav:reel');
await page.waitForTimeout(250);
await page.screenshot({ path: '/tmp/ss-07-reel.png' });

const reelIds = await regionIds(page);
check(reelIds.includes('reel:spin'), 'the reel has a spin control');

// ---------------------------------------------------------------- errors

check(consoleErrors.length === 0, `no console errors (${consoleErrors.join(' | ')})`);

await browser.close();
server.close();

console.log(`Browser verification: ${checks} checks, ${failures.length} failures`);
if (failures.length > 0) {
  console.error('BROWSER CHECK FAILED');
  process.exit(1);
}
console.log('BROWSER CHECK OK');
