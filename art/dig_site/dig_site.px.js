include("../palette.px.js")

// The dig site, drawn as a cross-section: the ground is cut open, so the pit
// is a real hole with depth instead of a flat disc on a flat field. The earth
// in section is mid brown N, sunlit along the surface Z, with bands of S for
// strata and A for stones buried in the cut. The pit is dug straight down
// out of the surface; the far wall is lit A just under the lip, falls
// through P and goes to the dark D of the shaft, and on the floor of the pit
// something arcane is glimmering E. A wooden ladder S stands in the pit and
// breaks the top edge of the ground — that is what tells the eye this is a
// hole and not a flat panel. On the left, the spoil heap: turned earth N
// heaped up above the ground line, sunlit Z on the upper left, shaded S down
// the right, with clods A on it.
sprite("dig_site", { w: 24, h: 24, outline: "K" },
  `
  ........................
  ...........S..S.........
  ..ZZNNN....S..S.........
  .ZZNZZNS...SSSS.........
  ZNZZNNSSS..S..S.........
  NNNNNSSSS..S..S...SS.SS.
  ZZZZZZZZZZZSZZSZZZZZZZZZ
  NNNNNNNNNSSSSSSSNNNNNNNN
  NNNNNNNNNPPSPPSPNNNNNNNN
  NNNNNNNNNPPSPPSPNNNNNNNN
  SSSSSSSSSDDSDDSDSSSSSSSS
  NNNNNNNNNDDSSSSDNNNNNNNN
  NNPPNNNNNDDSDDSDNNNNNNNN
  NNNNNNNNNDDSDDSDNNNPPNNN
  NNNNNNNNNDDSDDSDNNNNNNNN
  SSSSSSSSSDDSSSSDSSSSSSSS
  NNNNNNNNNDDDDDDDNNNNNNNN
  NNNNNNNNNNNNEENNNNNNNNNN
  NNNNNPPNNNNNNNNNNPPNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  SSSSSSSSSNNNNNNNSSSSSSSS
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
  NNNNNNNNNNNNNNNNNNNNNNNN
`
)
