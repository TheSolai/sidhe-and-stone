include("../palette.px.js")

// #COMMENT
// // A wreck site: a broken hull under the sand, with its mast still up.
// //
// // The scene is a cross-section like every other dig site. The ground is
// // cut open so the hull is a real cavity with depth, not a flat disc.
// //
// // Z is the sunlit sand along the surface, N is the earth in section, S is
// // the timber of the hull and the mast, and D is the black of the inside
// // of the wreck. The hull is drawn as a shell of S planks around a dark
// // void, and a two-by-two gap between two planks lets the sky through,
// // which is the gap you would see in a hull that has been open for a
// // thousand years.
// //
// // The mast breaks the top edge of the ground. That single vertical is
// // what tells the eye this is a wreck and not a hole in the sand.

// #SIZE 24

sprite("dig_wreck", { w: 24, h: 24, outline: "K" },
  `
  .........SS.............
  .........SS.............
  .........SS.............
  .........SS.............
  .........SS.............
  .........SS.............
  .........SS.............
  .........SS.............
  ZZZZZZZZZZZZZZNNNNNNNNNN
  ZZZZZZZZZZZZNNNNNNNNNNNN
  NNNNNNNNNDDDDDDDNNNNNNNN
  NNNNNNNNNDDSSSSSNNNNNNNN
  NNNNNNNNNDDS..SSNNNNNNNN
  NNNNNNNNNDDS..SSNNNNNNNN
  NNNNNNNNNNSSSSSSNNNNNNNN
  NNNNNNNNNNDDDDDDDNNNNNNN
  SSSSSSSSSSSSSSSSSSSSSSSS
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  SSSSSSSSSSSSSSSSSSSSSSSS
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  DDDDDDDDDDDDDDDDDDDDDDDD
  DDDDDDDDDDDDDDDDDDDDDDDD
`
)
