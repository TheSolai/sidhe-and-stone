include("../palette.px.js")

// The crown: the museum's prize, so it must be the warmest thing on the
// title screen. Gold G body. The light comes from the top left, so the left
// edge of every point is the bright highlight H and the left face of the
// band is H as well. Everything on the right falls away down the ramp: the
// right point is shadow ochre Y, the right of the band is Y, and the lowest
// right of the lip is the dark clay A. A rust T jewel is set into the middle
// of the band. Three points, notched apart down to the band, so the
// silhouette says "crown" at a glance. No private colours: every pixel here
// comes from the shared palette, so the crown sits in the same world as the
// rest.
sprite("artefact_crown", { w: 16, h: 16, outline: "K" },
  `
  ................
  .......HH.......
  ......HGGH......
  ......HGGH......
  ..HHG.HGG.HHY...
  ..HGG.HGGH.YYA..
  ..HGG.HGGH.YYA..
  ..HGY.HGGH.YYA..
  ..HGY.HGGH.YYA..
  ..HGY.HGGH.YYA..
  ..HGY.HGGH.YYA..
  .HGGGGGGGGGGGYA.
  .HGGGGGTTGGGGYA.
  .HGGGGGTTGGGGYA.
  .YYYYYYYYAAAAAA.
  ................
`
)
