#!/usr/bin/env node
/**
 * Sync the game's sprite PNGs into the web build and write the atlas
 * manifest the runtime loads.
 *
 * The sprites live in `assets/sprites/` at the repository root because the
 * Godot build uses them too. The web build needs them inside `web/public/`
 * so Vite serves them as static assets, and it needs to know their pixel
 * dimensions so it can lay them out without loading them first.
 *
 * Run automatically by `npm run build` and `npm run dev`.
 */

import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const repoRoot = resolve(webRoot, '..');
const sourceDir = join(repoRoot, 'assets', 'sprites');
const targetDir = join(webRoot, 'public', 'sprites');

/**
 * Read a PNG's width and height from its IHDR chunk.
 *
 * PNG layout: 8-byte signature, then chunks of [4-byte length][4-byte
 * type][data][4-byte CRC]. IHDR is always the first chunk, and its data
 * begins with the width and height as 4-byte big-endian integers.
 */
function pngSize(path) {
  const buf = readFileSync(path);
  if (buf.length < 24) throw new Error(`${path}: too short to be a PNG`);
  // Verify the PNG signature.
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== signature[i]) throw new Error(`${path}: not a PNG`);
  }
  if (buf.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`${path}: first chunk is not IHDR`);
  }
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

mkdirSync(targetDir, { recursive: true });

const manifest = {};
const files = readdirSync(sourceDir).filter((f) => f.endsWith('.png')).sort();

for (const file of files) {
  const name = file.replace(/\.png$/, '');
  const from = join(sourceDir, file);
  const to = join(targetDir, file);
  copyFileSync(from, to);
  const { w, h } = pngSize(from);
  manifest[name] = { file, w, h };
}

writeFileSync(
  join(targetDir, 'atlas.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8'
);

console.log(`Synced ${files.length} sprites -> web/public/sprites`);
for (const [name, size] of Object.entries(manifest)) {
  console.log(`  ${name}: ${size.w}x${size.h}`);
}
