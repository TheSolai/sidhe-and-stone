include("../palette.px.js")

// #COMMENT
// A well: a stone-lined shaft sunk through the ground.
//
// The scene is a cross-section like every other dig site, and the well
// is a real shaft: you can see down the inside of it, and the far wall
// is in shadow the whole way down.
//
// S is the timber of the winding frame that stands over the mouth, Z is
// the sunlit ground around it on the left, and N is the earth in section
// with a band of S for a buried stratum.
//
// The lining is built of R, the grey of old stone, and the water standing
// in the bottom of the shaft is L. The very bottom is a hard D where
// nothing has reached the light.

// #SIZE 24

sprite("dig_well", { w: 24, h: 24, outline: "K" },
  `
  .........SSSSSS.........
  ........S......S........
  .......S........S.......
  ......S..........S......
  ZZZZZZSSSSSSSSSSSSZZZZZZ
  NNNNNNRRDDDDDDDDRRNNNNNN
  NNNNNNRRDDDDDDDDRRNNNNNN
  NNNNNNRRDDDDDDDDRRNNSSNN
  NNSSNNRRDDDDDDDDRRNNSSNN
  NNSSNNRRDDDDDDDDRRNNNNNN
  NNNNNNRRLLNNLLLLRRNNNNNN
  NNNNNNRRLLNNLNNLRRNNNNNN
  NNNNNNRRRRRRRRRRRRNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNSSNNNNNNNSSNNNNNNNNN
  NNNNSSNNNNNNNSSNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  SSSSSSSSSSSSSSSSSSSSSSSS
  SSSSSSSSSSSSSSSSSSSSSSSS
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
`
)
