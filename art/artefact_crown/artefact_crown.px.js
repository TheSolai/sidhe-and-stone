use("pico8")
pal({ G: "#e0b23c", H: "#f2d98a", D: "#a8762a", K: "#16120f" })

sprite("artefact_crown", { w: 16, h: 16, outline: "K" },
  // three points rising from the band
  poly([2, 12, 4, 4, 6, 12], "G"),
  poly([6, 12, 8, 2, 10, 12], "G"),
  poly([10, 12, 12, 4, 14, 12], "G"),
  // the band the points sit on
  rect(1, 12, 14, 3, "G"),
  // shaded lower lip of the band
  rect(1, 14, 14, 1, "D"),
  // shadow at the right end, so the band reads as a curve
  rect(13, 12, 2, 2, "D"),
  // centre jewel set into the band
  rect(7, 13, 2, 2, "H")
)
