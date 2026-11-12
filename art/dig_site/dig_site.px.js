include("../palette.px.js")

// #COMMENT
// The dig site: the working face of an open excavation.
//
// The scene is a cross-section like every other dig site, but this is the
// broad working dig rather than one feature of it. The pit is shored with
// S timbers on both walls, a ladder stands down the middle of it, and a
// heap of turned earth lies on the surface to the left.
//
// The cut is a real void: D all the way down, and on the floor of the
// dig something arcane is glimmering E.
//
// The earth in section is mid brown N, sunlit along the surface Z, with
// bands of S for the strata that run through it.

// #SIZE 24

sprite("dig_site", { w: 24, h: 24, outline: "K" },
  `
  ........................
  ........................
  .ZZZNNNNSS..............
  ..ZZNNNNSS..............
  .NNNNNNNNNDDDDDDDDDDZZZ.
  NNNNNNNNNNSDSDSDDDDSNNNN
  NNSSNNNNNNSSSSSSSSSSNNNN
  NNSSNNNNNNSDSSSDDDDSNNNN
  NNNNNNNNNNSDSDSDDDDSNNSS
  NNNNNNSSNNSDSSSDDDDSNNSS
  NNNNNNSSNNSSSSSSSSSSNNNN
  NNNNNNNNNNSDSSSDDDDSNNNN
  NNNNNNNNNNSDSDSEEDDSNNNN
  NNNNNNNNNNSDSDSDDDDSNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNSSNNNNNNSSNNNNNNNNNN
  NNNNSSNNNNNNSSNNNNNSSNNN
  SSSSSSSSSSSSSSSSSSSSSSSS
  SSSSSSSSSSSSSSSSSSSSSSSS
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
`
)
