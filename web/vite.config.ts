import { defineConfig } from 'vite';

/**
 * Vite configuration for Sidhe & Stone.
 *
 * The build targets a static site: no server, no runtime code generation.
 * `base: './'` makes the output portable, so the `dist/` folder can be
 * opened from a file server, a CDN, or a static host without rewriting
 * asset paths.
 */
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // The game is small; a modest warning limit keeps the build honest
    // if a dependency ever creeps in.
    chunkSizeWarningLimit: 200,
    assetsInlineLimit: 0,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
