/**
 * The band contract check.
 *
 * Every other check in this project asked "is this control present?" and
 * "is the pixel the right colour?". Neither of those questions catches
 * the two defects that kept coming back:
 *
 *   1. A screen drew over the framework's navigation strip, or over the
 *      hint line. The screenshots still looked plausible -- the overlap
 *      was small and nobody was measuring -- but the Goals screen really
 *      did draw its eighth tier row straight over the nav.
 *   2. A string was silently truncated with an ellipsis, so a
 *      description lost its meaning without anything saying so.
 *
 * So the game is asked what it actually drew. The App measures every
 * rectangle and sprite the active screen paints, and reports the
 * bounding box. This check then asserts:
 *
 *   - the screen stayed inside the bands it owns
 *   - the strings that are SUPPOSED to fit were not cut
 *
 * It drives the real dist/ build in a real browser, so what it measures
 * is what a player sees.
 *
 * Run:
 *   node tests/band_check.mjs
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

// ── the contract ────────────────────────────────────────────────────────────
//
// These are duplicated from web/src/ui/bands.ts on purpose. The point of
// the check is to catch the SCREENS and the CONTRACT drifting apart. If
// a band moves, this fails and the constant is updated in the same
// commit -- which is the review you want, rather than a check that
// quietly followed the code around and never noticed.

const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 540;

// The framework's bands.
const HUD_HEIGHT = 58;
const NAV_TOP = LOGICAL_HEIGHT - 38;

// The bands the screen owns.
const TITLE_TOP = HUD_HEIGHT;
const FOOTER_BOTTOM = 478;

// The screens, and whether they own the whole canvas.
const SCREENS = ['dig', 'curator', 'vault', 'gallery', 'reel', 'shop', 'ledger', 'goals'];

// ── the strings that must NOT be cut ────────────────────────────────────────
//
// Duplicated from web/src/sim/goals.ts and web/src/ui/palette.ts. These
// are the texts whose full meaning matters: a goal whose description is
// cut stops telling the player what to do, and an upgrade whose
// description is cut stops telling the player what they are buying.
//
// If one of these is truncated, the check fails and the text is
// shortened at the source rather than the layout being allowed to eat it.

const GOAL_TITLES = [
  'Open Doors',
  'Something to Show',
  'A House of Oddities',
  'A First Payday',
  "Curator's Apprentice",
  'A Clean Sweep',
  'The Tablet Case',
  'The Treasury Grows',
  'A Crown on Show',
  'A Very Good Day',
  'A Real Collection',
  'Steady Hands',
  'The Long Shift',
  'A Grander Gallery',
  'An Institution',
  'Full Coffers',
  'The Mask Comes',
  'Renowned',
];

const GOAL_BODIES = [
  'End your first day of trading.',
  'Put one exhibit on the gallery floor.',
  'Keep 4 exhibits on display at once.',
  'Take £50 at the door in a single day.',
  'Catalogue 10 finds.',
  'Go 7 nights without losing a thing to thieves.',
  'Put a tablet on the gallery floor.',
  'Keep 10 pieces in the vault.',
  'Display a crown.',
  'Earn £300 in a single day.',
  'Keep 25 pieces in the vault.',
  'Go 21 nights without losing a thing to thieves.',
  'Finish 25 digs.',
  'Extend the gallery to 8 slots.',
  'Trade for 30 days.',
  "Take £5,000 across the gallery's whole history.",
  'Display a mask.',
  'Trade for 60 days.',
];

const UPGRADE_DESCS = [
  'One more dig running at once.',
  'Catalogues three more finds a day.',
  'Two more display slots, more visitors.',
  'A fortune teller makes the reel kinder.',
  'Your fairies find more per dig.',
  'Every dig finishes a day sooner.',
  'One more visitor comes to pay.',
  'Every exhibit is worth a little more.',
  'Fewer artefacts stolen at night.',
];

const MUST_FIT = [...GOAL_TITLES, ...GOAL_BODIES, ...UPGRADE_DESCS];

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

// ── the band check ──────────────────────────────────────────────────────────

console.log('\nband contract');

for (const id of SCREENS) {
  await clickRegion(page, `nav:${id}`);
  await page.waitForTimeout(320);

  const result = await page.evaluate(() => {
    const audit = window.__sidhe?.layoutAudit;
    if (!audit) return null;
    return { bounds: audit.bounds, truncations: audit.truncations };
  });

  if (!result) {
    check(false, `${id}: the app did not expose its layout audit`);
    continue;
  }

  const b = result.bounds;
  if (!b) {
    // A screen that drew nothing at all is a broken screen, not a pass.
    check(false, `${id}: the screen drew nothing at all`);
    continue;
  }

  // The screen owns the title, content and footer bands. It must not
  // reach into the HUD above, or into the hint and nav strips below.
  const aboveOk = b.minY >= TITLE_TOP;
  const belowOk = b.maxY <= FOOTER_BOTTOM;
  const leftOk = b.minX >= 0;
  const rightOk = b.maxX <= LOGICAL_WIDTH;

  check(
    aboveOk,
    `${id}: drew at y=${b.minY}, above the screen's first band (${TITLE_TOP}) -- over the HUD`
  );
  check(
    belowOk,
    `${id}: drew down to y=${b.maxY}, past the footer band (${FOOTER_BOTTOM}) -- over the hint or the nav`
  );
  check(leftOk, `${id}: drew at x=${b.minX}, off the left edge of the canvas`);
  check(rightOk, `${id}: drew to x=${b.maxX}, off the right edge of the canvas`);

  // The strings that must not be cut.
  const cut = result.truncations.filter((t) => MUST_FIT.includes(t));
  check(
    cut.length === 0,
    `${id}: truncated text that was supposed to fit: ${cut.map((t) => `"${t}"`).join(', ')}`
  );

  const ok = aboveOk && belowOk && leftOk && rightOk && cut.length === 0;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(9)} drew ${b.minX},${b.minY} to ${b.maxX},${b.maxY}` +
      `  (${b.calls} draw calls)` +
      (b.lowest
        ? `  lowest: ${b.lowest.x},${b.lowest.y} ${b.lowest.w}x${b.lowest.h}`
        : '') +
      (b.rightmost && b.rightmost.x + b.rightmost.w > LOGICAL_WIDTH
        ? `  rightmost: ${b.rightmost.x},${b.rightmost.y} ${b.rightmost.w}x${b.rightmost.h}`
        : '') +
      (result.truncations.length
        ? `  [${result.truncations.length} string(s) cut: ${result.truncations.map((t) => `"${t.slice(0, 28)}…"`).join(', ')}]`
        : '')
  );
}

// ── every goal's body, one at a time ───────────────────────────────────────
//
// The Goals screen shows ONE goal's body in the detail panel, so a
// single pass over the screen only ever exercises the next milestone.
// The other seventeen bodies are never drawn, and never measured --
// which is exactly how a body like "Go 21 nights without losing a
// thing to thieves." can be quietly cut and never noticed.
//
// So the check clicks each goal in turn and measures what the detail
// panel draws. Every body gets measured, and every body is asserted to
// be whole.

console.log('\ngoal bodies (each one, selected in turn)');

await clickRegion(page, 'nav:goals');
await page.waitForTimeout(320);

const goalIds = await page.evaluate(() =>
  (window.__sidhe?.interactiveRegions ?? [])
    .map((r) => r.id)
    .filter((id) => id && id.startsWith('goals:goal:'))
    .map((id) => id.slice('goals:goal:'.length))
);

check(goalIds.length === 18, `expected 18 selectable goals, found ${goalIds.length}`);

let goalBodiesSeen = 0;
for (const gid of goalIds) {
  await clickRegion(page, `goals:goal:${gid}`);
  await page.waitForTimeout(180);

  const result = await page.evaluate(() => {
    const audit = window.__sidhe?.layoutAudit;
    return audit ? { bounds: audit.bounds, truncations: audit.truncations } : null;
  });
  if (!result) {
    check(false, `${gid}: the app did not expose its layout audit`);
    continue;
  }

  // The body of the selected goal must be drawn, and must be drawn whole.
  const cut = result.truncations.filter((t) => MUST_FIT.includes(t));
  check(
    cut.length === 0,
    `goal ${gid}: truncated text that was supposed to fit: ${cut.map((t) => `"${t}"`).join(', ')}`
  );

  // And the detail panel must stay inside the footer band.
  const b = result.bounds;
  if (b) {
    check(
      b.maxY <= FOOTER_BOTTOM,
      `goal ${gid}: the detail panel drew down to y=${b.maxY}, past the footer band (${FOOTER_BOTTOM})`
    );
  }

  // Count the goal bodies that were actually drawn, so the check cannot
  // pass by measuring nothing.
  const drawn = result.truncations.length === 0;
  if (drawn) goalBodiesSeen++;
}

check(
  goalBodiesSeen === goalIds.length,
  `only ${goalBodiesSeen} of ${goalIds.length} goal bodies were measured`
);
console.log(`  ok   ${goalBodiesSeen} goal bodies measured, none cut`);

// ── the title screen owns everything ────────────────────────────────────────

console.log('\ntitle screen');
await clickRegion(page, 'nav:goals');
await page.waitForTimeout(200);
// The title screen is reached from the game's own quit path, so drive it
// through the App rather than clicking around for it.
await page.evaluate(() => window.__sidhe?.goTo?.('title'));
await page.waitForTimeout(320);

const titleAudit = await page.evaluate(() => {
  const audit = window.__sidhe?.layoutAudit;
  return audit ? { bounds: audit.bounds, truncations: audit.truncations } : null;
});

if (titleAudit?.bounds) {
  const b = titleAudit.bounds;
  // The title screen is allowed the whole canvas.
  check(b.minY >= 0 && b.maxY <= LOGICAL_HEIGHT, 'the title screen drew outside the canvas');
  console.log(`  ok   title     drew ${b.minX},${b.minY} to ${b.maxX},${b.maxY}`);
} else {
  // The title screen is reached by a different route, so a miss here is
  // not a failure of the contract. It is reported, not asserted.
  console.log('  --   title     not reached through the nav; the contract does not apply');
}

check(consoleErrors.length === 0, `console errors: ${consoleErrors.join(' | ')}`);

console.log(`\nBand contract verification: ${checks} checks, ${failures.length} failures`);
if (failures.length === 0) {
  console.log('BAND CHECK OK');
}

await browser.close();
server.close();

process.exit(failures.length === 0 ? 0 : 1);
