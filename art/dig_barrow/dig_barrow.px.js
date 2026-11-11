include("../palette.px.js")

// #COMMENT
// // A barrow: a grass mound over a stone chamber.
// //
// // The scene is a cross-section like every other dig site. The mound is M,
// // the moss green of turf, and it is the brightest thing in the frame
// // because it is the only part of the ground the light reaches.
// //
// // Z runs down the sunlit upper left of the mound and N takes over on the
// // lower right, so the dome turns away from the light instead of reading
// // as a flat green triangle.
// //
// // Under the turf the ground is N with a band of S for a buried stratum,
// // and the chamber itself is built of R, the grey of old fieldstone, with
// // a two-by-two gap between two stones where the wall has fallen in.
// //
// // The mound meets the ground line in a single unbroken row, which is what
// // makes it read as a barrow rather than as a hill.

// #SIZE 24

sprite("dig_barrow", { w: 24, h: 24, outline: "K" },
  `
  .........ZZZMMM.........
  ........ZZMMMMMM........
  .......ZZMMMMMMMM.......
  ......ZZMMMMMMMMMM......
  .....ZZMMMMMMMMMMMM.....
  ....ZZMMMMMMMMMMMMMM....
  ...ZZMMMMMMMMMMMMMMMM...
  ..ZZMMMMMMMMMMMMMMMMMM..
  .ZZMMMMMMMMMMMMMMMMMMMM.
  ZZMMMMMMMMMMMMMMMMMMMMMM
  MMMMMMMMMMMMMMMMMMMMMMMM
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNRRRRNNNNNNNNNNN
  NNNNNNNNNRR..RRNNNNNNNNN
  NNNNNNNNNRR..RRNNNNNNNNN
  NNNNNNNNNRRRRRRNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  SSSSSSSSSSSSSSSSSSSSSSSS
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  ........................
  ........................
`
)
