include("../palette.px.js")

// #COMMENT
// A cutting: a stepped dig, wide at the top and then a narrow slot
// driven deeper at the far end.
//
// The step is what makes it read as a cutting rather than a pit. The wide
// floor of the first cut is S, P is the cut edge of the step, and the slot
// drops from there into the dark D of the deep end, with E glimmering at
// the bottom of it. A heap of turned earth sits on the left of the
// surface.
//
// The earth in section is N with a band of S for a buried stratum, and the
// bottom of the frame is the hard D of deep ground.

// #SIZE 24

sprite("dig_cutting", { w: 24, h: 24, outline: "K" },
  `
  ........................
  ..ZNNSS.................
  .ZNNNNNSS...............
  .ZNNNNNNNNSS............
  ZNNNNNNNNNNNSS..........
  ZZZZZZZZZZDDDDDDDDDDDDZZ
  NNNNNNNNNNDDDDDDDDDDDDNN
  NNNNNNNNNNDDDDDDDDDDDDNN
  NNNNNNNNNNSSSSSPDDDDDDNN
  NNNNNNNNNNNNNNNPDDDDDDNN
  NNNNNNNNNNNNNNNPDDDDDDNN
  NNNNNNNNNNNNNNNPDDDDDDNN
  NNNNNNNNNNNNNNNPDDEEDDNN
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
