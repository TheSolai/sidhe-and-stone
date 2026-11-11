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

const navIds = ['dig', 'curator', 'vault', 'gallery', 'reel', 'ledger', 'goals'];

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

// ---------------------------------------------------------------- the dig loop

// Back to the dig site. Assign a dig to the first site, then end the day.
await clickRegion(page, 'nav:dig');
await page.waitForTimeout(250);

const digIds = await regionIds(page);
const digCards = digIds.filter((id) => id.startsWith('dig:card:'));
check(digCards.length === 3, `the dig site offers three dig types (${digCards.length})`);

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
