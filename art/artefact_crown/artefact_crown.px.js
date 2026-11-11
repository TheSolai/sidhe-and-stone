include("../palette.px.js")

// The crown: the museum's prize, so it must be the warmest thing on the
// title screen. Gold G body, with the lit top-left edge of every point in
// the brighter H, the shadowed inner-right of each point falling to the
// ochre Y, and a rust T jewel set into the middle of the band. The bottom
// lip of the band is Y, so the crown reads as a solid ring and not a flat
// block. Three points, notched apart down to the band, so the silhouette
// says "crown" at a glance. No private colours: every pixel here comes
// from the shared palette, so the crown sits in the same world as the rest.
sprite("artefact_crown", { w: 16, h: 16, outline: "K" },
  `
  ................
  .......GG.......
  ......HGGG......
  ......HGGG......
  ..HGG.HGGG.HGG..
  ..HGG.HGGG.HGG..
  ..HGG.HGGG.HGG..
  ..HGY.HGGY.HGG..
  ..HGY.HGGY.HGG..
  ..HGY.HGGY.HGG..
  ..HGY.HGGY.HGG..
  .GGGGGGGGGGGGGG.
  .GGGGGGTTGGGGGG.
  .GGGGGGTTGGGGGG.
  .YYYYYYYYYYYYYY.
  ................
  `
)
