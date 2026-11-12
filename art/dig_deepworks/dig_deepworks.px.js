include("../palette.px.js")

// #COMMENT
// The deep works: the deepest hole on the site, with a winding gear
// over it and a gallery running off the bottom.
//
// The scene is a cross-section like every other dig site. The winding
// drum is S timber in an N frame, standing on the surface line, and the
// shaft below it is a straight cut edged in P with the dark D of the
// hole between the walls.
//
// Something arcane glimmers in E at the bottom of the shaft, and a
// gallery branches off to the right into the P and D of unlit rock.
//
// The earth around the shaft is N in section, with a band of S for a
// buried stratum and hard D at the bottom of the frame.

// #SIZE 24

sprite("dig_deepworks", { w: 24, h: 24, outline: "K" },
  `
  .........SSSSSS.........
  ........NSSSSSSN........
  ........NSSSSSSN........
  ........NNNNNNNN........
  .......SSSSSSSSSS.......
  .......S........S.......
  .......S........S.......
  .......S........S.......
  ZZZZZZZZZZZZZZZZZZZZZZZZ
  NNNNNNNNNPPPPPPP.NNNNNNN
  NNNNNNNNNPDDDDDP.NNNNNNN
  NNSSNNNNNPDDDDDP.NNNNNNN
  NNSSNNNNNPDDDDDP.NNNSSNN
  NNNNNNNNNPDEEDDP.NNNSSNN
  NNNNNNNNNPDEEDDP.NNNNNNN
  NNNNNNNNNPDDDDDPPPPPPPNN
  NNNNNSSNNPDDDDDPDDDDDDNN
  NNNNNSSNNPDDDDDPDDDDDDNN
  NNNNNNNNNPPPPPPPPPPPPPPP
  NNNNNNNNNNNNSSNNNNNDDDDD
  NNNNNNNNNNNNSSNNNNNDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
`
)
