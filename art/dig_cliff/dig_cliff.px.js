include("../palette.px.js")

// #COMMENT
// // A cliff face: rock in section, with scree piled at its foot.
// //
// // The scene is a cross-section like every other dig site. The cliff is
// // N, the ordinary brown of rock in section, banded with S for the strata
// // that run through it, and capped with Z where the light catches the
// // top of the rock.
// //
// // The cliff stands on the left and the ground falls away to the right,
// // which is the opposite of every other scene in this set on purpose: it
// // is the one dig site where the light has nothing to fall on, so the
// // lower right is the darkest corner in the game.
// //
// // A two-by-two fissure runs into the cliff face. That is the gap a
// // weathered rock face always has, and it is what lets the sky through
// // the cut.
// //
// // P is the deep shadow the cliff throws across the scree, and the scree
// // itself is N so that the whole lower right stays dark.

// #SIZE 24

sprite("dig_cliff", { w: 24, h: 24, outline: "K" },
  `
  ZZZZZZZZZZ..............
  ZZZZZZZZZZZZZ...........
  NNNNNNNNNNNNN...........
  NNNNNNNNNNNNN...........
  NNNNN..NNNNNN...........
  NNNNN..NNNNNNNNNNNNNNNNN
  SSSSSSSSSSSSS...........
  SSSSSSSSSSSSS...........
  NNNNNNNNNNNNN...........
  NNNNNNNNNNNNN...........
  NNNNNNNNNNNNN...........
  NNNNNNNNNNNNN...........
  NNNNNNNNNNNNN...........
  SSSSSSSSSSSSS...........
  SSSSSSSSSSSSSNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNSSSSSSNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNN.PPPPPPPPPP
  NNNNNNNNNNNNN..PPPPPPPPP
  NNNNNNNNNNNNN...DDDDDDDD
  ........................
`
)
