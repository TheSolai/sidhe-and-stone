include("../palette.px.js")

// The coin: the money icon for the HUD.
//
// A struck gold coin, lit from the upper left, so the top-left arc of the
// rim is H (the bright gold highlight), the body is G, and the lower-right
// arc falls away into A, the darkest of the gold ramp. The Y bar stamped
// down the middle is the denomination, and it is the one accent colour in
// the sprite.
sprite("icon_coin", { w: 16, h: 16, outline: "K" },
  `
  ................
  .....HHHH.......
  ...HHGGGGAA.....
  ..HGGGGGGAAA....
  .HGGGGGGGGAAA...
  .HGGGGGGGGGGGA..
  .HGGGGGGGGGGGA..
  .HGGGYGGGGGGGA..
  .HGGGYGGGGGGGA..
  .HGGGYGGGGGGGA..
  .HGGGYGGGGGGGA..
  .HGGGGGGGGGGGA..
  .HGGGGGGGGGGGA..
  ..GGGGGGGGGGGA..
  ...GGGGGGGGGA...
  .....AAAA.......
`
)
