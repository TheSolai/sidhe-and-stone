include("../palette.px.js")

// #COMMENT
// A cliff face: rock in section, with scree piled at its foot.
//
// The scene is a cross-section like every other dig site. The cliff is
// N, the ordinary brown of rock in section, banded with S for the strata
// that run through it, and capped with Z where the light catches the
// top of the rock.
//
// The cliff stands on the left and the ground falls away to the right,
// which is the opposite of every other scene in this set on purpose: it
// is the one dig site where the light has nothing to fall on, so the
// lower right is the darkest corner in the game.
//
// A fissure runs into the cliff face as a shadow crack in P, and the
// scree at the foot is R, the grey of broken stone.

// #SIZE 24

sprite("dig_cliff", { w: 24, h: 24, outline: "K" },
  `
  ZZZZZZZZZZZZZ...........
  ZZZZZZZZZZZZ............
  NNNNNNNNNNNNN...........
  NNNSSNNNNNNNN...........
  NNNSSNNNNNNNN...........
  SSSSSSSSSSSS............
  SSSSSSSSSSSS............
  NNNNNNNNNPNNN...........
  NNNNNNSSNPPNN...........
  NNNNNNSSNPPNN...........
  NNNNNNNNNPNNN...........
  SSSSSSSSSSS.............
  SSSSSSSSSSS.............
  NNNNNNNNNNNNN...........
  NNSSNNNNNNNNNNNNNNNNNNNN
  NNSSNNNNNNNNNNRRNSSNNNNN
  NNNNNSSNNNNNNNNNRRSNNNNN
  NNNNNSSNNNNNNNNNNNRRNNNN
  NNNNNNNNNNNNNNNNNNNNRRNN
  DDDDDDDDDDDDDDDDDDDNNPPP
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
`
)
