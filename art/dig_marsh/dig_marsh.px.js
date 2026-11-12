include("../palette.px.js")

// #COMMENT
// A marsh dig: standing water over wet ground, and reeds.
//
// The scene is a cross-section like every other dig site, but the top of
// the earth is drowned: the water table is L, the green of standing
// water, and it lies over the N of the peat below.
//
// M is the reed bed. Reeds are the moss colour because they are growing
// things, and they stand in two clumps rather than in a line, because a
// line of reeds reads as a fence.
//
// The lit edge of the water is Z along the surface and L through the
// body of it, so the surface reads as a plane turning away from the
// light.
//
// A pocket of trapped air sits in the peat, and it is what keeps the cut
// honest: there is nothing behind it.

// #SIZE 24

sprite("dig_marsh", { w: 24, h: 24, outline: "K" },
  `
  .....M..........M.......
  .....M.M........MMMM....
  ....MMMM........M.M.....
  .....MMM........M.M.....
  ZZZZZZZZZZZZZZZZZZZZZZZZ
  LLLLLLLLLLLLLLLLLLLLLLLL
  LLNNLLLLLLLLLLNNLLLLLLLL
  LLNNLLLLLLLLLLNNLLLLLLLL
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNSSNN
  NSSNNNNNNDDNNNNNNNNNSSNN
  NSSNNNNNNDDNNNNNNNNNNNNN
  NNNNNNNNNNNNSSNNNNNNNNNN
  SSSSSSSSSSSSSSNNNNNNNNNN
  SSSSSSSSSSSSNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNSSNNNNNNNNNNNNNNN
  NNNNNNNSSNNNNNNNNNNNNNNN
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
`
)
