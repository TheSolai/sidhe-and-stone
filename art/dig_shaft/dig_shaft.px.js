include("../palette.px.js")

// #COMMENT
// A shaft: a narrow hole driven straight down, with a timber headframe
// over its mouth.
//
// S is the frame above ground and the ladder down the shaft, P is the cut
// edge of the shaft walls, and the D between them is the dark of the hole.
// The glimmer of E at the bottom is the only bright thing that deep.
//
// The earth around the shaft is N in section, with a band of S for a
// buried stratum and hard D at the bottom of the frame.

// #SIZE 24

sprite("dig_shaft", { w: 24, h: 24, outline: "K" },
  `
  ........................
  .............SSSSSSSSSS.
  .............S........S.
  .............S........S.
  .............S........S.
  ZZZZZZZZZZZZZZZDDDDDDDNZ
  NNNNNNNNNNNNNNNPDSDSDPNN
  NNNNNNNNNNNNNNNPDSSSDPNN
  NNNNNNNNNNNNNNNPDSDSDPNN
  NNNNNNNNNNNNNNNPDSSSDPNN
  NNNNNNNNNNNNNNNPDSDSDPNN
  NNNNNNNNNNNNNNNPDSSSDPNN
  NNNNNNNNNNNNNNNPDDEDDPNN
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
