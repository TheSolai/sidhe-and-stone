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
  scale = 1
): void {
  if (!image || !scratchCtx) return;
  const src = spritePixels(image);

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // The bounding box of the rotated sprite.
  const bw = Math.ceil(Math.abs(src.w * cos) + Math.abs(src.h * sin));
  const bh = Math.ceil(Math.abs(src.w * sin) + Math.abs(src.h * cos));
  if (bw < 1 || bh < 1) return;

  scratch.width = bw;
  scratch.height = bh;
  const out = scratchCtx.createImageData(bw, bh);
  const d = out.data;
  const halfW = src.w / 2;
  const halfH = src.h / 2;

  for (let y = 0; y < bh; y += 1) {
    const dy = y - bh / 2 + 0.5;
    for (let x = 0; x < bw; x += 1) {
      const dx = x - bw / 2 + 0.5;
      // Inverse-rotate the destination pixel back into source space.
      const sx = Math.round(dx * cos + dy * sin + halfW - 0.5);
      const sy = Math.round(-dx * sin + dy * cos + halfH - 0.5);
      if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;

      const si = (sy * src.w + sx) * 4;
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
  ctx.drawImage(
    scratch,
    Math.round(cx - (bw * scale) / 2),
    Math.round(cy - (bh * scale) / 2),
    bw * scale,
    bh * scale
  );
  ctx.imageSmoothingEnabled = smoothing;
}
