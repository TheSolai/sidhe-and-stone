use("pico8")
pal({ G: "#8a8378", L: "#b8b1a4", S: "#5f574f", D: "#16120f" })

sprite("artefact_rubble", { w: 16, h: 16, outline: "D" },
  // angular hewn stone, not a rounded blob
  poly([3, 9, 4, 6, 7, 4, 9, 5, 12, 7, 12, 11, 8, 13, 5, 13, 3, 11], "G"),
  // shaded lower-right facet
  poly([12, 7, 12, 11, 8, 13, 6, 11], "S"),
  // lit upper-left facet
  poly([7, 4, 9, 5, 7, 8, 4, 9, 4, 6], "L"),
  // a chipped corner
  px(11, 5, "D"),
  px(12, 6, "D")
)
