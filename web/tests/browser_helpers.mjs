/**
 * Shared helpers for the browser checks.
 *
 * The checks drive the real game in a real browser. Controls are found by
 * their region id through the app's test seam, never by a hardcoded pixel
 * position -- a layout that shifts by a few pixels would otherwise turn
 * every check into a false failure, or worse, a false pass.
 */

import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '..', 'dist');
const paletteFile = resolve(here, '..', '..', 'art', 'palette.px.js');

/**
 * The shared palette, read from the ONE source of truth.
 *
 * art/palette.px.js is the file the sprites are drawn from. The checks
 * used to carry their own hardcoded copy of the hex values, which is a
 * promise waiting to be broken: the palette is re-solved when the art
 * direction moves, and a stale list in a test file either fails for the
 * wrong reason or, worse, quietly passes against the old colours.
 *
 * So the list is PARSED from the palette file itself. If the palette
 * changes, the check follows it automatically.
 *
 * Returns the hex values, lowercased, in palette order.
 */
export function loadPalette() {
  const source = readFileSync(paletteFile, 'utf8');
  const hexes = [];
  const pattern = /^\s*[A-Za-z]\s*:\s*"(#[0-9a-fA-F]{6})"/gm;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    hexes.push(match[1].toLowerCase());
  }
  if (hexes.length < 8) {
    throw new Error(
      `Palette parse failed: only found ${hexes.length} colours in ${paletteFile}. ` +
        'The palette file format must have changed.'
    );
  }
  return hexes;
}

/**
 * The shared palette, keyed by its palette letter.
 *
 * Same source and same parser as `loadPalette`, but the result is a map
 * from the letter the sprites use ("C" for cream) to the hex value. A
 * check that wants to measure "the cream of the HUD" should say `PAL.C`
 * and not a hex it typed out by hand: if the palette is re-solved, the
 * letter keeps its meaning and the hex follows.
 *
 * Returns a plain object of lowercased hex values.
 */
export function loadPaletteByKey() {
  const source = readFileSync(paletteFile, 'utf8');
  const byKey = {};
  const pattern = /^\s*([A-Za-z])\s*:\s*"(#[0-9a-fA-F]{6})"/gm;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    byKey[match[1]] = match[2].toLowerCase();
  }
  if (Object.keys(byKey).length < 8) {
    throw new Error(
      `Palette parse failed: only found ${Object.keys(byKey).length} colours in ${paletteFile}. ` +
        'The palette file format must have changed.'
    );
  }
  return byKey;
}

/** Load Playwright from the project, or from an npx cache. */
export function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright',
    `${process.env.HOME}/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs`,
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(
    'Could not load Playwright. Install it, or set PLAYWRIGHT_MODULE to its path.'
  );
}

/** Launch a browser, preferring the system Chrome when Playwright's is absent. */
export async function launchBrowser(chromium) {
  const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  try {
    return await chromium.launch();
  } catch {
    if (existsSync(systemChrome)) {
      return await chromium.launch({ executablePath: systemChrome });
    }
    throw new Error('No Chromium available: neither the Playwright build nor system Chrome');
  }
}

/** Serve the build from this process. */
export async function startStaticServer(root = distDir) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.css': 'text/css; charset=utf-8',
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';

    const filePath = join(root, path);
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end('forbidden');
      return;
    }

    try {
      if (!statSync(filePath).isFile()) throw new Error('not a file');
      const body = readFileSync(filePath);
      res.writeHead(200, {
        'content-type': types[extname(filePath)] ?? 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });

  const port = await new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
  return { server, url: `http://127.0.0.1:${port}/` };
}

/**
 * Click a control by its region id.
 *
 * Returns the region that was clicked, or null when no region matched.
 */
export async function clickRegion(page, id) {
  const rect = await page.evaluate((wanted) => {
    const app = window.__sidhe;
    if (!app) return null;
    const region = app.interactiveRegions.find((r) => r.id === wanted);
    if (!region) return null;

    const canvas = document.getElementById('game');
    const bounds = canvas.getBoundingClientRect();
    const scale = bounds.width / canvas.width;

    return {
      x: bounds.left + (region.x + region.w / 2) * scale,
      y: bounds.top + (region.y + region.h / 2) * scale,
      rect: { x: region.x, y: region.y, w: region.w, h: region.h },
    };
  }, id);

  if (!rect) return null;
  await page.mouse.click(rect.x, rect.y);
  return rect.rect;
}

/** Click at a logical canvas coordinate. */
export async function clickLogical(page, x, y) {
  const box = await page.evaluate(() => {
    const canvas = document.getElementById('game');
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top, scale: rect.width / canvas.width };
  });
  await page.mouse.click(box.left + x * box.scale, box.top + y * box.scale);
}

/**
 * The page coordinates of a point on the logical canvas.
 *
 * The canvas is drawn at 960x540 logical pixels and then scaled by the
 * browser to fit, so every real mouse position has to be converted
 * before it is used.
 */
export async function toPage(page, x, y) {
  return page.evaluate(
    ({ x, y }) => {
      const canvas = document.getElementById('game');
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width / canvas.width;
      return { x: rect.left + x * scale, y: rect.top + y * scale, scale };
    },
    { x, y }
  );
}

/**
 * Is a control usable right now?
 *
 * A control that is disabled still exists, so this is the check that
 * tells "the button is there" apart from "the button does something".
 */
export async function regionEnabled(page, id) {
  return page.evaluate((wanted) => {
    const app = window.__sidhe;
    if (!app) return null;
    const region = app.interactiveRegions.find((r) => r.id === wanted);
    if (!region) return null;
    return region.enabled !== false;
  }, id);
}

/**
 * Where the pixels of a given colour sit inside a rectangle.
 *
 * This is how the browser checks measure a moving prop: not by looking
 * at it, but by asking where its colour actually ended up. The mean
 * height of the grip's brass says which way the lever went.
 */
export async function colourProfile(page, x, y, w, h, hexes) {
  return page.evaluate(
    ({ x, y, w, h, hexes }) => {
      const canvas = document.getElementById('game');
      const ctx = canvas.getContext('2d');
      const { data } = ctx.getImageData(x, y, w, h);
      const wanted = new Set(hexes.map((c) => c.toLowerCase()));
      let count = 0;
      let sumY = 0;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const i = (py * w + px) * 4;
          if (data[i + 3] === 0) continue;
          const hex =
            '#' +
            [data[i], data[i + 1], data[i + 2]]
              .map((v) => v.toString(16).padStart(2, '0'))
              .join('');
          if (!wanted.has(hex)) continue;
          count++;
          sumY += py;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
      }
      return {
        count,
        meanY: count > 0 ? sumY / count : null,
        minY: count > 0 ? minY : null,
        maxY: count > 0 ? maxY : null,
      };
    },
    { x, y, w, h, hexes }
  );
}

/**
 * Every string the last frame drew, with its ink.
 *
 * This is how the checks ask "is the forecast on the screen?" -- by
 * reading the strings the game actually drew, rather than by guessing
 * at pixels or re-deriving the forecast in the test. If the game says
 * it, the check can see it said it.
 */
export async function drawnTexts(page) {
  return page.evaluate(() => {
    const audit = window.__sidhe?.contrastAudit;
    if (!audit) return [];
    return audit.texts.map((t) => ({ text: t.text, ink: t.ink, surface: t.surface }));
  });
}

/** The ids of every interactive region currently on screen. */
export async function regionIds(page) {
  return page.evaluate(() => {
    const app = window.__sidhe;
    if (!app) return [];
    return app.interactiveRegions.map((r) => r.id).filter(Boolean);
  });
}

/** Read the whole canvas back as a colour histogram. */
export async function readCanvas(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const counts = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const hex =
        '#' +
        [data[i], data[i + 1], data[i + 2]]
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('');
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    return { width: canvas.width, height: canvas.height, counts: [...counts] };
  });
}

/** How many pixels of a given colour are in a rectangle. */
export async function countColour(page, hex, x, y, w, h) {
  return page.evaluate(
    ({ hex, x, y, w, h }) => {
      const canvas = document.getElementById('game');
      const ctx = canvas.getContext('2d');
      const { data } = ctx.getImageData(x, y, w, h);
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const c =
          '#' +
          [data[i], data[i + 1], data[i + 2]]
            .map((v) => v.toString(16).padStart(2, '0'))
            .join('');
        if (c === hex) n++;
      }
      return n;
    },
    { hex, x, y, w, h }
  );
}

/** A cheap perceptual signature of what is on screen. */
export async function canvasSignature(page) {
  const { counts } = await readCanvas(page);
  let checksum = 0;
  for (const [hex, n] of counts) {
    checksum = (checksum * 31 + parseInt(hex.slice(1), 16) + n) >>> 0;
  }
  return { colours: counts.length, checksum };
}
