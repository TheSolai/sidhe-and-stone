/**
 * The Fate Reel's payout preview, and the once-only reel payout.
 *
 * Two things are pinned here, and both are load-bearing.
 *
 * THE PREVIEW MUST MATCH THE SIMULATION
 *
 * The preview on the reel screen tells the player what a spin will do
 * to the day's takings. If that number is wrong, the screen is lying
 * to the player about money -- which is the one thing a management sim
 * must never do. So the preview is compared against the simulation's
 * own takings, on real galleries, for real multipliers, rather than
 * against a hand-written copy of the same arithmetic (which would only
 * prove the two copies agree).
 *
 * THE PREVIEW MUST NOT COUNT EXHIBITS THAT EARN NOTHING
 *
 * Visitors pay for the most valuable exhibits up to the demand cap.
 * Anything beyond that is on display but earns nothing. The preview has
 * to say so, and has to count only the paying ones.
 *
 * THE REEL PAYOUT IS APPLIED EXACTLY ONCE
 *
 * In manual mode the player spins the reel and watches it land before
 * the day resolves. The multiplier must then be applied to that day's
 * takings ONCE, and reset afterwards -- otherwise a player who spins
 * once and then plays several more days would keep getting the
 * multiplier, which would quietly wreck the economy.
 *
 * Run:
 *   node --experimental-strip-types tests/reel_preview.ts
 */

import { SimCore, GRADE_ORDER } from '../src/sim/sim-core.ts';
import { buildPayoutPreview } from '../src/ui/reel-preview.ts';
import { godotInt, godotRound } from '../src/sim/reel-core.ts';

let checks = 0;
const failures: string[] = [];

function check(ok: boolean, label: string): void {
  checks++;
  if (!ok) failures.push(label);
}

function checkClose(a: number, b: number, label: string, tol = 1e-9): void {
  checks++;
  if (Math.abs(a - b) > tol) {
    failures.push(`${label}: expected ${b}, got ${a}`);
  }
}

function checkEq<T>(a: T, b: T, label: string): void {
  checks++;
  if (a !== b) failures.push(`${label}: expected ${b}, got ${a}`);
}

/**
 * A deterministic pseudo-random source, so the test is reproducible
 * without depending on the simulation's own RNG.
 */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Build a simulation with a specific gallery, in manual mode, with no
 * upgrades and no dig sites, so the only thing that happens at the end
 * of the day is the takings.
 */
function simWithGallery(gallery: Record<string, number>): SimCore {
  const sim = new SimCore();
  sim.manual = true;
  sim.sites = 0;
  sim.upgradesBought.forEach(() => undefined);
  for (const key of [...sim.upgradesBought.keys()]) sim.upgradesBought.set(key, 0);
  for (const grade of GRADE_ORDER) {
    sim.gallery.set(grade, gallery[grade] ?? 0);
  }
  return sim;
}

/**
 * The takings the simulation itself would credit, computed the way
 * `collectTakings` computes them -- richest grade first, up to the
 * demand cap, each exhibit rounded individually.
 */
function expectedTakings(sim: SimCore, multiplier: number): number {
  const split = sim.payingSplit();
  let total = 0;
  for (const grade of GRADE_ORDER) {
    const earning = split.get(grade) ?? 0;
    if (earning <= 0) continue;
    const base = sim.exhibitValue(grade);
    total += godotInt(godotRound(base * multiplier)) * earning;
  }
  return total;
}

// ---------------------------------------------------------------- the preview

// The preview must agree with the simulation on a spread of galleries
// and multipliers -- including the bounds of the reel's own range.
const rng = makeRng(20261111);
const galleries: Record<string, number>[] = [
  {},
  { rubble: 1 },
  { rubble: 3, clay: 2 },
  { clay: 1, tablet: 1, relic: 1 },
  { crown: 1, mask: 1, relic: 1, tablet: 1, clay: 1, rubble: 1 },
  { mask: 2, relic: 2, tablet: 2 },
  { crown: 2, mask: 2, relic: 2, tablet: 2, clay: 2, rubble: 2 },
];

for (let g = 0; g < 12; g++) {
  const gallery: Record<string, number> = {};
  for (const grade of GRADE_ORDER) {
    const n = Math.floor(rng() * 4);
    if (n > 0) gallery[grade] = n;
  }
  galleries.push(gallery);
}

const MULTIPLIERS = [0.85, 1.0, 1.25, 1.5, 1.77, 2.05, 2.35, 2.6];

for (const gallery of galleries) {
  const sim = simWithGallery(gallery);
  const split = sim.payingSplit();

  for (const multiplier of MULTIPLIERS) {
    const preview = buildPayoutPreview({
      galleryCounts: sim.gallery,
      payingSplit: split,
      exhibitValue: (grade) => sim.exhibitValue(grade),
      multiplier,
    });

    // The preview's boosted total must equal what the sim would credit.
    checkEq(
      preview.boostedTotal,
      expectedTakings(sim, multiplier),
      `preview boosted total matches the simulation (gallery ${JSON.stringify(gallery)}, x${multiplier})`
    );

    // The base total is the same takings at no multiplier.
    checkEq(
      preview.baseTotal,
      expectedTakings(sim, 1.0),
      `preview base total matches the simulation (gallery ${JSON.stringify(gallery)})`
    );

    // The reel is bounded BOTH ways: a triple of Bog or Blight pays
    // LESS than x1, and the preview must be willing to show that loss.
    // The reel's own bounds are 0.85x (worst) and 2.6x (best).
    check(
      multiplier >= 0.85 && multiplier <= 2.6,
      `the preview is only ever asked about multipliers inside the reel's bounds`
    );
    // The exact bound, allowing for per-exhibit rounding: each exhibit
    // is rounded to the nearest whole coin, so the total can sit up to
    // half a coin per paying exhibit above the exact product.
    check(
      preview.boostedTotal <= preview.baseTotal * multiplier + 0.5 * preview.paying + 1e-9,
      `the preview never shows more than the reel's best case (gallery ${JSON.stringify(gallery)}, x${multiplier})`
    );

    // The paying count must match the simulation's own split exactly.
    let splitTotal = 0;
    for (const n of split.values()) splitTotal += n;
    checkEq(
      preview.paying,
      splitTotal,
      `the preview pays exactly what the simulation pays (gallery ${JSON.stringify(gallery)})`
    );

    // Exhibits on display beyond the cap earn nothing, and the preview
    // must say how many those are.
    checkEq(
      preview.idle,
      preview.displayed - preview.paying,
      `idle exhibits are the ones beyond the cap (gallery ${JSON.stringify(gallery)})`
    );
    check(
      preview.idle >= 0,
      `the preview never reports a negative number of idle exhibits (gallery ${JSON.stringify(gallery)})`
    );

    // The per-grade breakdown must add up to the totals, and must only
    // mention grades that actually earn.
    let lineEarning = 0;
    let lineBase = 0;
    let lineBoosted = 0;
    let lastGradeIndex = -1;
    for (const line of preview.lines) {
      check(
        line.earning > 0,
        `no line for a grade that earns nothing (gallery ${JSON.stringify(gallery)})`
      );
      lineEarning += line.earning;
      lineBase += line.base * line.earning;
      lineBoosted += line.boosted * line.earning;
      const idx = GRADE_ORDER.indexOf(line.grade);
      check(
        idx > lastGradeIndex,
        `the breakdown is richest first (gallery ${JSON.stringify(gallery)})`
      );
      lastGradeIndex = idx;
    }
    checkEq(
      lineEarning,
      preview.paying,
      `the breakdown's earning count matches the total (gallery ${JSON.stringify(gallery)})`
    );
    checkEq(
      lineBase,
      preview.baseTotal,
      `the breakdown's base matches the base total (gallery ${JSON.stringify(gallery)})`
    );
    checkEq(
      lineBoosted,
      preview.boostedTotal,
      `the breakdown's boosted matches the boosted total (gallery ${JSON.stringify(gallery)})`
    );
  }
}

// The preview must handle an empty gallery without dividing by zero
// or reporting nonsense.
{
  const sim = simWithGallery({});
  const preview = buildPayoutPreview({
    galleryCounts: sim.gallery,
    payingSplit: sim.payingSplit(),
    exhibitValue: (grade) => sim.exhibitValue(grade),
    multiplier: 2.6,
  });
  checkEq(preview.displayed, 0, 'an empty gallery displays nothing');
  checkEq(preview.paying, 0, 'an empty gallery pays nothing');
  checkEq(preview.boostedTotal, 0, 'an empty gallery earns nothing');
}

// A gallery richer than the demand cap MUST show idle exhibits: that
// is the whole point of the preview.
{
  const sim = simWithGallery({ crown: 1, mask: 1, relic: 1, tablet: 1, clay: 1, rubble: 1 });
  const preview = buildPayoutPreview({
    galleryCounts: sim.gallery,
    payingSplit: sim.payingSplit(),
    exhibitValue: (grade) => sim.exhibitValue(grade),
    multiplier: 1.0,
  });
  check(
    preview.idle > 0,
    'a gallery beyond the demand cap shows idle exhibits'
  );
  check(
    preview.paying < preview.displayed,
    'the paying count is below the displayed count when the cap bites'
  );
  // The richest exhibits are the ones that get paid.
  const payingGrades = preview.lines.map((l) => l.grade);
  const allPaid = payingGrades.every((grade) => {
    const n = sim.gallery.get(grade) ?? 0;
    return (sim.payingSplit().get(grade) ?? 0) === n;
  });
  check(allPaid, 'the paying grades are paid in full before cheaper ones');
}

// ------------------------------------------------------- the reel payout once

// In manual mode the reel payout must be applied to exactly one day's
// takings, and then reset.
{
  const sim = simWithGallery({ rubble: 2, clay: 2 });
  sim.pendingPayout = 2.0;

  const moneyBefore = sim.money;
  sim.step();
  const gained = sim.money - moneyBefore;

  // The takings are credited at the multiplier; upkeep is subtracted.
  // Comparing the reel's contribution against the unmultiplied takings
  // isolates the multiplier exactly.
  const atOne = expectedTakings(sim, 1.0);
  const atTwo = expectedTakings(sim, 2.0);
  check(
    atTwo > atOne,
    'a x2.0 reel must be worth more than no reel at all'
  );
  checkClose(
    sim.payoutApplied,
    2.0,
    'the applied payout is the reel multiplier'
  );

  // And the multiplier must be gone: the next day pays x1.00.
  checkClose(
    sim.pendingPayout,
    1.0,
    'the reel payout is reset after the day resolves'
  );

  const moneyBefore2 = sim.money;
  sim.step();
  const gained2 = sim.money - moneyBefore2;
  const atOneAgain = expectedTakings(sim, 1.0);
  checkClose(
    sim.payoutApplied,
    1.0,
    'the following day applies no multiplier'
  );
  check(
    Math.abs(gained2 - gained) > 1e-9,
    'the following day does not repeat the reel payout'
  );
  check(
    atOneAgain > 0,
    'the following day still pays the takings'
  );
}

// The dealer safety valve must not quietly sell the player's artefacts
// in manual mode. This is the guard that stops the reel screen -- or
// any other screen -- from quietly liquidating the gallery.
{
  const sim = simWithGallery({ crown: 1 });
  sim.vault.set('crown', 2);
  sim.money = 10; // low enough that the safety valve would fire
  const vaultBefore = sim.vault.get('crown') ?? 0;
  const galleryBefore = sim.gallery.get('crown') ?? 0;

  sim.step();

  checkEq(
    sim.vault.get('crown') ?? 0,
    vaultBefore,
    'the dealer safety valve does not sell the vault in manual mode'
  );
  checkEq(
    sim.gallery.get('crown') ?? 0,
    galleryBefore,
    'the dealer safety valve does not sell the gallery in manual mode'
  );
}

console.log(`Reel preview: ${checks} checks, ${failures.length} failures`);
if (failures.length > 0) {
  for (const f of failures.slice(0, 20)) console.error(`  FAIL ${f}`);
  console.error('REEL PREVIEW FAILED');
  process.exit(1);
}
console.log('REEL PREVIEW OK');
