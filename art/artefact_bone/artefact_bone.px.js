include("../palette.px.js")

// #COMMENT
// // The bone: a long bone, catalogued and shelved.
// //
// // The silhouette does all the work. A bone is two fat knobs joined by a
// // narrow shaft, and that profile is unmistakable at 1x: a bump above and
// // below the left end, a bump above and below the right end, and a straight
// // waist between them. Nothing else in the set has that shape.
// //
// // The material is bleached bone, so it is pale all the way up the ramp:
// // X is the lit bone along the upper left, R is the bone body across the
// // top surface, and N is the bone turned away into shadow on the lower
// // right. Every X and every N run is at least two pixels long, so the light
// // reads as an edge and not as a speck.
// //
// // Two pixels of M sit on the lower-left flank as lichen. That is the one
// // accent in this sprite and the only thing that says "this was dug up"
// // rather than "this was made".
// //
// // The right end sits in a short hard D shadow, so the bone rests on the
// // shelf instead of floating in front of it.

sprite("artefact_bone", { w: 16, h: 16, outline: "K" },
  `
  ................
  ................
  ................
  ...XX......XX...
  ..XXRR....XXRR..
  .XRRRRR..RRRRNN.
  XRRRRRRRRRRRRRRN
  .RRRRRR..RRRRNN.
  ..MMRR....RRRNN.
  ...NN......NNN..
  ...........DDD..
  ................
  ................
  ................
  ................
  ................
`
)
