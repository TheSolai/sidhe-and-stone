use("pico8")
pal({ G: "#8a8378", L: "#b8b1a4", S: "#5f574f", T: "#5f9e8f", D: "#16120f" })

sprite("artefact_relic", { w: 16, h: 16, outline: "D" },
  // a standing carved stone, tapered toward the top
  poly([5, 14, 4, 9, 5, 3, 8, 1, 11, 4, 11, 10, 10, 14], "G"),
  // shaded right face
  poly([11, 4, 11, 10, 10, 14, 8, 14], "S"),
  // lit top-left face
  poly([5, 3, 8, 1, 8, 3, 5, 5], "L"),
  // carved groove, cut INTO the stone so it is darker than the surface
  vline(7, 6, 5, "D"),
  hline(6, 8, 3, "D"),
  // a single rune still holding its glow
  px(7, 8, "T")
)
