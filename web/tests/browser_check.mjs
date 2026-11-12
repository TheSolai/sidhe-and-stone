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
  colourProfile,
  drawnTexts,
  regionEnabled,
  regionIds,
  startStaticServer,
  toPage,
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
check(reelIds.includes('reel:lever'), 'the reel has a lever');

// The lever is a control that is PULLED, not tapped, so the check that
// matters is whether the grip actually goes down when the pointer goes
// down. The grip is brass; its brass pixels are measured before and
// during the pull, and their mean height has to fall.
//
// The crop holds the lever and nothing else: the reel windows end
// above it, the spin button is to the left of it, and the status line
// is above it.
const LEVER_CROP = { x: 250, y: 316, w: 62, h: 76 };
const BRASS = ['#e5b63d', '#efd788', '#dda742'];

const atRest = await colourProfile(
  page,
  LEVER_CROP.x,
  LEVER_CROP.y,
  LEVER_CROP.w,
  LEVER_CROP.h,
  BRASS
);
check(
  atRest.count > 20,
  `the lever's brass grip is drawn (${atRest.count} brass pixels)`
);

// Take hold of the grip and pull it down.
const charmsBeforePull = await page.evaluate(() => window.__sidhe.state.charms());
const grip = await toPage(page, 276, 340);
await page.mouse.move(grip.x, grip.y);
await page.mouse.down();
await page.mouse.move(grip.x, grip.y + 18 * grip.scale, { steps: 4 });
await page.mouse.move(grip.x, grip.y + 42 * grip.scale, { steps: 6 });
await page.waitForTimeout(120);

const pulled = await colourProfile(
  page,
  LEVER_CROP.x,
  LEVER_CROP.y,
  LEVER_CROP.w,
  LEVER_CROP.h,
  BRASS
);
check(pulled.count > 20, 'the grip is still drawn while the lever is held');
check(
  pulled.meanY > atRest.meanY + 4,
  `the grip goes DOWN when the lever is pulled (${atRest.meanY?.toFixed(1)} -> ${pulled.meanY?.toFixed(1)})`
);
check(
  pulled.maxY > atRest.maxY,
  `the lowest brass pixel drops when the lever is pulled (${atRest.maxY} -> ${pulled.maxY})`
);

await page.mouse.up();
await page.waitForTimeout(120);

// The pull was a spin, so it cost charms.
const charmsAfterPull = await page.evaluate(() => window.__sidhe.state.charms());
check(
  charmsAfterPull === charmsBeforePull - 2,
  `pulling the lever spun the reel (charms ${charmsBeforePull} -> ${charmsAfterPull})`
);

// While the wheel is turning, the control is locked...
const duringSpin = await regionEnabled(page, 'reel:spin');
check(duringSpin === false, 'the spin control is locked while the wheel is turning');

// ...and it comes back when the last reel stops.
await page.waitForTimeout(1600);
const afterSpin = await regionEnabled(page, 'reel:spin');
check(afterSpin === true, 'the spin control comes back after the reveal');

// And the reel can be spun AGAIN. It used to be a one-shot: the gate
// said "only if there has never been a result", which meant a player
// could not use the reel twice in a day. The Godot original disables
// the button only while the wheel is turning.
const charmsBefore = await page.evaluate(() => window.__sidhe.state.charms());
await clickRegion(page, 'reel:spin');
await page.waitForTimeout(1600);
const charmsAfter = await page.evaluate(() => window.__sidhe.state.charms());
check(
  charmsAfter === charmsBefore - 2,
  `the reel can be spun a second time (charms ${charmsBefore} -> ${charmsAfter})`
);
const secondSpin = await regionEnabled(page, 'reel:spin');
check(secondSpin === true, 'the spin control is usable again after the second spin');

// The lever SPRINGS BACK.
//
// The pull is a sprung lever: it is pulled down while the hand is on it
// and it returns to rest when the hand comes off. A lever that stayed
// down would tell the player it is still held.
//
// The brass grip is measured once more, now that the spin is over and
// the spring has had its quarter of a second, and it must be back up
// where it started.
const sprung = await colourProfile(
  page,
  LEVER_CROP.x,
  LEVER_CROP.y,
  LEVER_CROP.w,
  LEVER_CROP.h,
  BRASS
);
check(sprung.count > 20, `the grip is still drawn after the spring (${sprung.count} brass pixels)`);
check(
  Math.abs((sprung.meanY ?? 0) - (atRest.meanY ?? 0)) < 4,
  `the lever springs back to rest (${atRest.meanY?.toFixed(1)} -> ${sprung.meanY?.toFixed(1)})`
);

// The reel's audio hook.
//
// The reels stop one at a time, and each stop has to TICK. A single
// sound at the end of the spin would land on the wrong thing -- it
// would sound like one reel finished when three had.
//
// So the audio is counted: the counter is installed on the live audio
// object, reset, and then the wheel is spun. The counter must see at
// least one tick per reel, plus the sound of the reveal.
//
// The counter is installed BEFORE the reset so that the navigation
// clicks and the button click are not counted as reel ticks.
const audioCounted = await page.evaluate(() => {
  const audio = window.__sidhe.audio;
  if (!audio) return false;
  window.__reelAudio = { click: 0, chime: 0, fanfare: 0 };
  for (const name of ['playClick', 'playChime', 'playFanfare']) {
    const original = audio[name].bind(audio);
    audio[name] = (...args) => {
      const key = name.replace('play', '').toLowerCase();
      window.__reelAudio[key] += 1;
      return original(...args);
    };
  }
  return true;
});
check(audioCounted, 'the reel audio can be observed');

await page.evaluate(() => {
  window.__reelAudio.click = 0;
  window.__reelAudio.chime = 0;
  window.__reelAudio.fanfare = 0;
});
await clickRegion(page, 'reel:spin');
await page.waitForTimeout(1600);
const reelAudio = await page.evaluate(() => window.__reelAudio);
check(
  reelAudio.click >= 3,
  `each reel ticks as it comes to rest (${reelAudio.click} clicks for 3 reels)`
);
check(
  reelAudio.click + reelAudio.chime + reelAudio.fanfare >= 4,
  `the reveal has its own sound (${reelAudio.click} clicks, ${reelAudio.chime} chimes, ${reelAudio.fanfare} fanfares)`
);

// The lever and the spin button must not fight over the same click.
const leverRect = await page.evaluate(() => {
  const app = window.__sidhe;
  const lever = app.interactiveRegions.find((r) => r.id === 'reel:lever');
  const spin = app.interactiveRegions.find((r) => r.id === 'reel:spin');
  return { lever, spin };
});
const overlap =
  leverRect.lever &&
  leverRect.spin &&
  leverRect.lever.x < leverRect.spin.x + leverRect.spin.w &&
  leverRect.lever.x + leverRect.lever.w > leverRect.spin.x &&
  leverRect.lever.y < leverRect.spin.y + leverRect.spin.h &&
  leverRect.lever.y + leverRect.lever.h > leverRect.spin.y;
check(!overlap, 'the lever and the spin button do not overlap');
check(
  leverRect.lever &&
    leverRect.lever.x >= 0 &&
    leverRect.lever.y >= 0 &&
    leverRect.lever.x + leverRect.lever.w <= 960 &&
    leverRect.lever.y + leverRect.lever.h <= 540,
  'the lever sits inside the 960x540 canvas'
);

// ---------------------------------------------------------------- the forecast

// The forecast is the retention hook. It is the thing that tells a player
// what tomorrow holds, and it has to be on the screen in THREE places:
// the end-of-day modal, the title screen's continue path, and the dig
// site's footer.
//
// The check reads the strings the game actually DREW, rather than
// re-deriving the forecast in the test and comparing the two. A test
// that rebuilds the thing it is testing proves nothing about the
// screen; this one asks the canvas what it says.
//
// Every forecast line ends in a full stop. A fact that had been cut
// short would end in something else, and that is a failure too.
const FORECAST_LINES = [
  /^Site \d+: .+ finishes tomorrow\.$/,
  /^\d+ digs finish tomorrow\.$/,
  /^Milestone ".+" is nearly met\.$/,
  /^Milestone ".+" is met\.$/,
  /^Takings look like £[\d,]+, upkeep £[\d,]+\.$/,
  /^\d+ finds wait in the storeroom\.$/,
  /^The storeroom is empty\.$/,
  /^Nothing is on the gallery floor\.$/,
  /^\d+ display slots are free\.$/,
  /^The gallery floor is full\.$/,
  /^Curators will catalogue \d+ finds\.$/,
];
const isForecastLine = (text) => FORECAST_LINES.some((re) => re.test(text));

// The dig site's footer carries the FIRST fact.
await clickRegion(page, 'nav:dig');
await page.waitForTimeout(300);
const digTexts = await drawnTexts(page);
const digFacts = digTexts.map((t) => t.text).filter(isForecastLine);
check(
  digFacts.length >= 1,
  `the dig site's footer carries a forecast fact (${digFacts.length} found)`
);

// The end-of-day modal carries the headline and up to three lines.
//
// The day is ended from the SHOP, not from the dig site. The dig site's
// footer draws a forecast fact of its own, and that foot is still on the
// canvas underneath the modal -- so ending the day from there counts the
// footer fact as well and the modal looks like it is carrying five.
await clickRegion(page, 'nav:shop');
await page.waitForTimeout(300);
await clickRegion(page, 'hud:endday');
await page.waitForTimeout(500);
const modalTexts = await drawnTexts(page);
const modalFacts = modalTexts.map((t) => t.text).filter(isForecastLine);
check(
  modalFacts.length >= 2,
  `the end-of-day modal carries the forecast (${modalFacts.length} facts)`
);
check(
  modalFacts.length <= 4,
  `the end-of-day modal does not over-stuff the forecast (${modalFacts.length} facts)`
);
await clickRegion(page, 'summary:close');
await page.waitForTimeout(300);

// The title screen's continue path carries the panel.
//
// A save exists by now -- the day has ended and been written -- so the
// continue path has a museum to forecast.
await page.evaluate(() => window.__sidhe.goTo('title'));
await page.waitForTimeout(400);
const titleTexts = await drawnTexts(page);
const titleFacts = titleTexts.map((t) => t.text).filter(isForecastLine);
check(
  titleFacts.length >= 1,
  `the title screen's Tomorrow panel carries a forecast (${titleFacts.length} facts)`
);
check(
  titleTexts.some((t) => t.text === 'Tomorrow'),
  'the title screen shows the Tomorrow panel heading'
);

// The panel is a panel, not a stray line of text: it has a heading and
// at least one fact under it.
const panelHasHeading = titleTexts.some(
  (t) => t.text === 'Tomorrow' && t.surface !== null
);
check(panelHasHeading, 'the Tomorrow heading is drawn on a panel surface');

// Back into the game for the keyboard check.
await page.evaluate(() => window.__sidhe.goTo('dig'));
await page.waitForTimeout(300);

// ---------------------------------------------------------------- keyboard

// The number keys pick a screen. A canvas interface with no keyboard
// route is a canvas interface some players cannot use at all.
await page.keyboard.press('5');
await page.waitForTimeout(300);
const afterKey = await page.evaluate(() => {
  const ids = window.__sidhe.interactiveRegions.map((r) => r.id).filter(Boolean);
  return ids;
});
check(
  afterKey.includes('reel:spin') || afterKey.includes('reel:lever'),
  `the number keys reach the reel (${afterKey.filter((id) => id.startsWith('reel:')).join(', ')})`
);

await page.keyboard.press('1');
await page.waitForTimeout(300);
const backToDig = await page.evaluate(() =>
  window.__sidhe.interactiveRegions.map((r) => r.id).filter(Boolean)
);
check(
  backToDig.some((id) => id.startsWith('dig:')),
  'the number keys reach the dig site'
);

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
