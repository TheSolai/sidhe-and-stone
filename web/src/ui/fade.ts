/**
 * Ordered-dither fades.
 *
 * An alpha fade blends the fading element with whatever is behind it, and
 * every blend is a colour that is not in the shared palette. The toast
 * fade was the last place that happened, and it put thirteen off-palette
 * colours on screen for the last 0.6 seconds of every toast -- which is
 * exactly the sort of defect a screenshot of the right screen at the
 * wrong moment hides.
 *
 * So a fade is a dither instead. Each pixel is either the element or the
 * background, chosen by a 4x4 Bayer threshold against the fade fraction.
 * The eye reads a fade; every individual pixel is still one of the two
 * colours that were already on screen.
 */

/**
 * The 4x4 Bayer threshold matrix, normalised to 0..1 by the caller.
 *
 * A 4x4 matrix is the smallest that reads as a fade rather than as
 * visible speckle, and it repeats every four pixels in both directions,
 * so the pattern does not crawl when the canvas is scaled up.
 */
const BAYER4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

/**
 * Draw something that fades out, without ever blending two colours.
 *
 * The caller draws the element at full strength; this takes the pixels
 * underneath it first, draws the element, and then keeps each pixel
 * either from the element or from what was underneath, according to the
 * dither threshold and the fade fraction. Nothing is interpolated, so
 * every pixel on the canvas is still an exact palette colour.
 *
 * `rect` must cover the whole element, including any shadow it casts --
 * a shadow that falls outside the rectangle would be left behind at full
 * strength while the panel faded.
 */
export function drawWithOrderedFade(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  alpha: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): void {
  const fraction = Math.max(0, Math.min(1, alpha));

  // Nothing to show, or nothing to hide: just draw it.
  if (fraction <= 0) return;
  if (fraction >= 1) {
    draw(ctx);
    return;
  }

  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);

  // Clamp to the canvas. getImageData outside the backing store throws,
  // and a toast near the edge would take the whole frame loop with it.
  const sx = Math.max(0, x);
  const sy = Math.max(0, y);
  const ex = Math.min(ctx.canvas.width, x + w);
  const ey = Math.min(ctx.canvas.height, y + h);
  const rw = ex - sx;
  const rh = ey - sy;
  if (rw <= 0 || rh <= 0) return;

  // What was underneath the element.
  const before = ctx.getImageData(sx, sy, rw, rh);

  // The element itself, at full strength.
  draw(ctx);

  // What the element looks like now that it is on top.
  const after = ctx.getImageData(sx, sy, rw, rh);

  const out = ctx.createImageData(rw, rh);
  for (let py = 0; py < rh; py += 1) {
    for (let px = 0; px < rw; px += 1) {
      const threshold = (BAYER4[(py & 3) * 4 + (px & 3)] + 0.5) / 16;
      const src = threshold < fraction ? after : before;
      const si = (py * rw + px) * 4;
      const di = si;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = 255;
    }
  }
  ctx.putImageData(out, sx, sy);
}
