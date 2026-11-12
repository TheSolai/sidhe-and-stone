include("../palette.px.js")

// The reel wheel: a wheel, not a shield.
//
// A wooden rim two pixels thick all the way round, four spokes running
// from the hub out to the rim, and open gaps between them — the gaps are
// what tell the eye this thing turns. In the middle, an arcane jewel set
// into a dark seat.
//
// The lighting is on the wheel itself, not around it: the rim and the
// spokes that face the top-left are the light wood Z, the ones facing
// down-right fall away into the shadowed brown S, and the rest stay the
// base oak N. So the wheel is lit from the same side as every other
// object in the game, and the light slides around the curve of the rim
// instead of sitting flat on it.
//
// The hub used to be a dead disc of deep shadow D — a hole in the middle
// of the wheel. Now it holds the jewel the wheel is named for: an arcane
// teal E cut in a small diamond, set into the D seat, lit from the same
// top left as the whole wheel so its lower-right facets fall back into
// the shadow of the seat. E is the reel's one accent colour, the same
// arcane teal the moon symbol wears, so the wheel and its symbols read
// as one idea.
sprite("reel_wheel", { w: 24, h: 24, outline: "K" },
  `
  ...........Z............
  .......ZZZZZZZZZ........
  .....ZZZZZZZZZZZZZ......
  ....ZZZ...ZZZ...ZZZ.....
  ...ZZZ....ZZZ....ZNN....
  ..ZZZ.....ZZZ.....SSS...
  ..ZZ......ZZZ......SS...
  .ZZ.......ZZZ.......SS..
  .ZZ.......DDD.......SS..
  .ZZ......DDEDD......SS..
  .ZZZZZZZDDEEDDDSSSSSSS..
  ZZZZZZZZDEEEEDDSSSSSSSS.
  .ZZZZZZZDDEEDDDSSSSSSS..
  .ZZ......DDEDD......SS..
  .ZZ.......DDD.......SS..
  .ZZ.......SSS.......SS..
  ..ZZ......SSS......SS...
  ..ZZZ.....SSS.....SSS...
  ...ZNN....SSS....SSS....
  ....SSS...SSS...SSS.....
  .....SSSSSSSSSSSSS......
  .......SSSSSSSSS........
  ...........S............
  ........................
`
)
