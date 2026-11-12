include("../palette.px.js")

// #COMMENT
// A trench: a long, wide cut taken down to a single flat floor.
//
// The spoil heap is heaped on the left of the surface line, the cut runs
// most of the width of the frame, and the floor of the dig is a band of S
// where it meets the untouched ground. E is a find lying on that floor.
//
// Below the cut the earth is N in section with a buried stratum of S, and
// the deep ground is D.

// #SIZE 24

sprite("dig_trench", { w: 24, h: 24, outline: "K" },
  `
  ........................
  ..ZNNSS.................
  .ZNNNNNSS...............
  .ZNNNNNNNNSS............
  ZNNNNNNNNNNNSS..........
  ZZZZZZZZZDDDDDDDDDDDDDZZ
  NNNNNNNNNDDDDDDDDDDDDDNN
  NNNNNNNNNDDDDDDDDDDDDDNN
  NNNNNNNNNDDDDDEEDDDDDDNN
  NNNNNNNNNSSSSSSSSSSSSSNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
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
