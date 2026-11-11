include("../palette.px.js")

// #COMMENT
// // A cave mouth: the entrance cut into the side of the hill.
// //
// // The scene is a cross-section like every other dig site, and the cave is
// // a mouth rather than a shaft: it opens at the left wall of the cavity
// // and closes to a point on the right.
// //
// // The turf along the top is Z where the light reaches it on the left, and
// // N on the right where the hill turns away from the light. Below the
// // turf the hill is N with a band of S for a buried stratum, and the cave
// // itself is D, the black you only get at this depth.
// //
// // P is the cut lip of rock along the edge of the mouth. The cavity
// // narrows as it runs right, the way a cave does.
// //
// // A two-by-two fissure in the roof of the hill sits directly above the
// // mouth: it is the crack daylight falls through, and it is what lets the
// // sky through the hill.

// #SIZE 24

sprite("dig_cave", { w: 24, h: 24, outline: "K" },
  `
  ZZZZZZZZZZZZNNNNNNNNNNNN
  ZZZZZZZZZZZZNNNNNNNNNNNN
  NNNNNNNNNNNNNNNN..NNNNNN
  NNNNNNNNNNNNNNNN..NNNNNN
  NNNNNNNNNNNNPPDDDDDDDDNN
  NNNNNNNNNNNNPPDDDDDDDDNN
  NNNNNNNNNNNNPPDDDDDDDNNN
  NNNNNNNNNNNNPPDDDDDDDNNN
  NNNNNNNNNNNNPPDDDDDDNNNN
  NNNNNNNNNNNNPPDDDDDDNNNN
  NNNNNNNNNNNNPPDDDDDNNNNN
  NNNNNNNNNNNNPPDDDDDNNNNN
  NNNNNNNNNNNNPPDDDDNNNNNN
  NNNNNNNNNNNNPPDDDDNNNNNN
  NNNNNNNNNNNNPPDDDNNNNNNN
  NNNNNNNNNNNNDDDDDNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  SSSSSSSSSSSSSSSSSSSSSSSS
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  SSSSSSSSSSSSSSSSSSSSSSSS
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  DDDDDDDDDDDDDDDDDDDDDDDD
`
)
