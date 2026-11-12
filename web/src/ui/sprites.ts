/**
 * Sprite loading.
 *
 * Sprites are preloaded once at boot into a map of `HTMLImageElement`, so no
 * frame ever pays for an image decode. The atlas manifest comes from
 * `web/scripts/sync-assets.mjs`, which copies the PNGs out of the shared
 * `assets/sprites/` folder and records their pixel dimensions.
 */

export interface SpriteEntry {
  file: string;
  w: number;
  h: number;
}

export type SpriteAtlas = Record<string, SpriteEntry>;

export class SpriteSet {
  private images = new Map<string, HTMLImageElement>();

  constructor(private readonly atlas: SpriteAtlas) {}

  /** Preload every sprite. Resolves once they are all decoded. */
  public async load(basePath: string): Promise<void> {
    const entries = Object.entries(this.atlas);
    await Promise.all(
      entries.map(
        ([name, entry]) =>
          new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              this.images.set(name, img);
              resolve();
            };
            img.onerror = () => reject(new Error(`Could not load sprite "${name}"`));
            img.src = `${basePath}/${entry.file}`;
          })
      )
    );
  }

  public get(name: string): HTMLImageElement | undefined {
    return this.images.get(name);
  }

  public has(name: string): boolean {
    return this.images.has(name);
  }

  /** The natural pixel size of a sprite. */
  public size(name: string): { w: number; h: number } {
    const entry = this.atlas[name];
    return entry ? { w: entry.w, h: entry.h } : { w: 0, h: 0 };
  }
}

/**
 * Draw a sprite at an integer position and integer scale.
 *
 * Every draw is snapped to whole pixels and scaled by whole numbers, so a
 * sprite never lands on a half pixel and never gets resampled unevenly.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  scale = 1
): void {
  if (!image) return;
  const sx = Math.round(x);
  const sy = Math.round(y);
  const sw = Math.round(image.width * scale);
  const sh = Math.round(image.height * scale);
  // Nearest-neighbour, always. Smoothing blends the sprite's palette colours
  // into off-palette shades at every edge, and the reel wheel is drawn under
  // a rotation, which resamples it no matter how it is scaled.
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, sx, sy, sw, sh);
  ctx.imageSmoothingEnabled = smoothing;
}

/**
 * Draw a sprite centred on a point. Used for the gallery plinths and the
 * visitors standing beside them.
 */
export function drawSpriteCentred(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  cx: number,
  cy: number,
  scale = 1
): void {
  if (!image) return;
  const w = image.width * scale;
  const h = image.height * scale;
  drawSprite(ctx, image, Math.round(cx - w / 2), Math.round(cy - h), scale);
}

/** The decoded pixels of a sprite, read once and then cached. */
interface SpritePixels {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

const pixelCache = new WeakMap<HTMLImageElement, SpritePixels>();

/**
 * The raw pixels of a sprite.
 *
 * Read from a canvas rather than kept in the PNG, because the browser has
 * already decoded the image and a readback is exact: the sprite PNGs are
 * palette-indexed with binary alpha, so every opaque pixel is one of the
 * shared palette's colours and every transparent pixel is fully clear.
 */
function spritePixels(image: HTMLImageElement): SpritePixels {
  const cached = pixelCache.get(image);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('Sidhe & Stone: could not read sprite pixels');
  g.imageSmoothingEnabled = false;
  g.drawImage(image, 0, 0);
  const imageData = g.getImageData(0, 0, canvas.width, canvas.height);

  const pixels: SpritePixels = {
    w: canvas.width,
    h: canvas.height,
    data: imageData.data,
  };
  pixelCache.set(image, pixels);
  return pixels;
}

/** A scratch canvas that rotated sprites are rasterised into. */
const scratch = document.createElement('canvas');
const scratchCtx = scratch.getContext('2d', { willReadFrequently: true });

/**
 * Draw a sprite rotated about a point, without ever blending a colour.
 *
 * The obvious way to rotate pixel art is ctx.rotate() followed by
 * drawImage(). That is wrong for this game: the browser anti-aliases the
 * EDGES of the rotated quad, so every frame the wheel bleeds a handful of
 * off-palette pixels onto the screen -- exactly the thing the palette
 * purity rule exists to prevent. Turning smoothing off does not help; the
 * edge coverage is not resampling, it is compositing.
 *
 * So the rotation is done by hand. Each destination pixel is inverse-rotated
 * into source space and the nearest source pixel is copied wholesale. A
 * nearest-neighbour copy can only ever reproduce a colour that was already
 * in the sprite, so the result is palette-exact by construction. The
 * rotation is then scaled up with smoothing off, which is another
 * nearest-neighbour copy and equally safe.
 */
export function drawSpriteRotated(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  cx: number,
  cy: number,
  angle: number,
  scale = 1,
  options: {
    pivot?: { x: number; y: number };
    flipX?: boolean;
    /**
     * The part of the sprite to rotate, in image pixels.
     *
     * A prop that is made of a moving part and a fixed part -- the Fate
     * Reel's lever, whose arm swings while its mount stays bolted to the
     * floor -- cannot be drawn by rotating the whole image, because the
     * fixed part would swing with it. So the arm is rotated on its own,
     * and the mount is blitted separately.
     *
     * The pivot is given in the RECT's coordinates, not the image's.
     */
    source?: { x: number; y: number; w: number; h: number };
  } = {}
): void {
  if (!image || !scratchCtx) return;
  const src = spritePixels(image);

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const flip = options.flipX === true;

  // The part of the image being drawn.
  const rect = options.source ?? { x: 0, y: 0, w: src.w, h: src.h };
  if (rect.w <= 0 || rect.h <= 0) return;

  // The point the sprite turns about.
  //
  // By default that is the middle of the sprite, and `(cx, cy)` is where
  // the middle lands. A lever needs to turn about its MOUNT instead --
  // the bolt in the floor -- so the pivot can be given explicitly, and
  // then `(cx, cy)` is where the pivot lands.
  //
  // Pivot coordinates are in source pixels, where pixel `i` covers the
  // continuous span `[i, i + 1)`. So the middle of a 16px sprite is
  // `(8, 8)`, and the middle of pixel `(11, 14)` is `(11.5, 14.5)`.
  const pivot = options.pivot ?? { x: rect.w / 2, y: rect.h / 2 };
  // A mirrored sprite carries its pivot with it.
  const px = flip ? rect.w - pivot.x : pivot.x;
  const py = pivot.y;

  // The bounding box of the rotated sprite, in the rotated frame.
  //
  // The rotation happens about the pivot, so the pivot stays where it
  // is and the corners swing around it.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  // The corners of the SPRITE, in continuous source coordinates: the
  // sprite covers [0, src.w) x [0, src.h). They used to be the corners
  // of a 1x1 unit square, which made the rotated bounding box far too
  // small -- the rotation was clipped to a couple of pixels and the
  // sprite vanished.
  for (const corner of spriteCorners(rect.w, rect.h)) {
    const vx = corner[0] - px;
    const vy = corner[1] - py;
    const rx = px + vx * cos - vy * sin;
    const ry = py + vx * sin + vy * cos;
    if (rx < minX) minX = rx;
    if (rx > maxX) maxX = rx;
    if (ry < minY) minY = ry;
    if (ry > maxY) maxY = ry;
  }
  const bw = Math.max(1, Math.ceil(maxX - minX));
  const bh = Math.max(1, Math.ceil(maxY - minY));

  scratch.width = bw;
  scratch.height = bh;
  const out = scratchCtx.createImageData(bw, bh);
  const d = out.data;

  for (let y = 0; y < bh; y += 1) {
    // The centre of this destination pixel, in the rotated frame.
    const gy = minY + y + 0.5;
    for (let x = 0; x < bw; x += 1) {
      const gx = minX + x + 0.5;
      // Inverse-rotate the destination pixel back into source space.
      const dx = gx - px;
      const dy = gy - py;
      const fx = px + dx * cos + dy * sin;
      const fy = py - dx * sin + dy * cos;
      const rx = Math.floor(fx);
      const ry = Math.floor(fy);
      if (rx < 0 || ry < 0 || rx >= rect.w || ry >= rect.h) continue;

      const sx = rect.x + rx;
      const sy = rect.y + ry;
      const si = (sy * src.w + (flip ? src.w - 1 - sx : sx)) * 4;
      if (src.data[si + 3] === 0) continue;

      const di = (y * bw + x) * 4;
      d[di] = src.data[si];
      d[di + 1] = src.data[si + 1];
      d[di + 2] = src.data[si + 2];
      d[di + 3] = src.data[si + 3];
    }
  }
  scratchCtx.putImageData(out, 0, 0);

  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  // The pivot sits at `(px, py)` in the rotated frame, and the frame's
  // top-left corner is drawn at `(cx, cy)` plus the pivot's offset.
  ctx.drawImage(
    scratch,
    Math.round(cx + (minX - px) * scale),
    Math.round(cy + (minY - py) * scale),
    bw * scale,
    bh * scale
  );
  ctx.imageSmoothingEnabled = smoothing;
}

/**
 * Draw part of a sprite, unsmoothed in colour.
 *
 * This is the fixed half of a moving prop: the mount the lever is
 * bolted to does not turn, so it is blitted rather than rotated.
 */
export function drawSpriteRegion(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  x: number,
  y: number,
  scale = 1
): void {
  if (!image) return;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    image,
    sx,
    sy,
    sw,
    sh,
    Math.round(x),
    Math.round(y),
    Math.round(sw * scale),
    Math.round(sh * scale)
  );
  ctx.imageSmoothingEnabled = smoothing;
}

/**
 * The four corners of a sprite of the given size, in continuous source
 * coordinates. The sprite covers [0, w) x [0, h).
 */
function spriteCorners(
  w: number,
  h: number
): ReadonlyArray<readonly [number, number]> {
  return [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
}
