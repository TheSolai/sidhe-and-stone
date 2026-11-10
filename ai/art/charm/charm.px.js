// Traced from charm_snapped.png by `pxl trace`: 32x31, 16 colors.
// Keys are palette indexes (0-9a-z...); "." is transparent. Patch pixels with grid(), recolor with swap.
use("pico8")

sprite("charm", `
  99ffffffffffffffffffffffffff9944
  fffffffffffffffffffffffffffff944
  ffffffffffffffffffffffffffffff94
  ffffffffffffffffffffffffffffff94
  fffffffffffffff66666f6666fffffff
  fffffff666666ddd44ddd66dddddffff
  ffffff44dd66ddd44666633ddddddfff
  ffffddddddddddfff6666333dffdddff
  ff6dddffffffddd6633333333d66ddff
  ff6ddffffffffdd633333333ddddffff
  ff966fffffffffff33333355ddffffff
  ff9d6666ffffffffdddddddddfffffff
  ffdddd666ffffffffdd666d6ffffffff
  ffddd9966663ffffffddd666ffffffff
  fffdff99633336ffff66d4444fffffff
  ff44fffd6333366fff33334444ddddff
  f66fffddd633333ff333336ff444dddf
  f6ddfff6d66333333333339fffffdddf
  fddddff63333333333333999ffffdd4f
  ffd9ddf33333333333333d99fffddd4f
  ff9944d33333663333333d4466ddddff
  fffff4d3333336333344dd446ddddfff
  fffffffddd333333d44ddd66dddfffff
  ffffffffdd333333d444ddd6ddfffff9
  fffffffffffddd66dd44444ffffffff9
  fffffffffff44f666ff6666ffffffff9
  9ffffffffffffffffffffffffffffff4
  99fffffffffffffffffffffffffff994
  999fffffffffffffffffffffffff9944
  4499ffffffffffffffffffffffff4444
  4449fffffffffffffffffffffff44444
`)
