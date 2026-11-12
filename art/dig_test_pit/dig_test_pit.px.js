include("../palette.px.js")

// #COMMENT
// A trial pit: the first shallow square hole, dug by hand to see what
// the ground gives up.
//
// The scene is a cross-section like every other dig site. The spoil heap of
// turned earth stands on the left, sunlit Z on its upper left and shaded S
// down its right.
//
// The pit is a real void, cut down on the right of the frame: P is the cut
// edge of the walls, S is the ladder standing in it, and E glimmers on the
// dark floor where something has already been found.
//
// The earth below is N with a band of S for a buried stratum, and the deep
// earth is D all the way down.

// #SIZE 24

sprite("dig_test_pit", { w: 24, h: 24, outline: "K" },
  `
  ........................
  ..ZNNSS.................
  .ZNNNNNSS...............
  .ZNNNNNNNNSS............
  ZNNNNNNNNNNNSS..........
  ZZZZZZZZZZZZZZZDDDDDDDZZ
  NNNNNNNNNNNNNNNPDDDDDPNN
  NNNNNNNNNNNNNNNPDSDDSPNN
  NNNNNNNNNNNNNNNPDSSSSPNN
  NNNNNNNNNNNNNNNPDSDDSPNN
  NNNNNNNNNNNNNNNPDSSSSPNN
  NNNNNNNNNNNNNNNPDSDDSPNN
  NNNNNNNNNNNNNNNPDDEEDPNN
  NNNNNNNNNNNNNNNPPPPPPPNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  SSSSSSSSSSSSSSSSSSSSSSSS
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
`
)
