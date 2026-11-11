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
  ctx.drawImage(image, sx, sy, sw, sh);
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
