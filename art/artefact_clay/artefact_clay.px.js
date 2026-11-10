use("pico8")
pal({ C: "#b4794a", H: "#e0a878", S: "#7d4f2e", D: "#16120f" })

sprite("artefact_clay", { w: 16, h: 16, outline: "D" },
  // flared rim at the top of the neck
  rect(6, 3, 4, 1, "H"),
  // the mouth, dark because it is a hole
  rect(7, 4, 2, 1, "D"),
  // narrow neck
  rect(6, 5, 4, 2, "C"),
  // belly, tapering to a narrow foot
  poly([6, 7, 10, 7, 11, 10, 10, 13, 5, 13, 4, 10], "C"),
  // lit edge on the left of the belly
  hline(5, 9, 3, "H"),
  px(5, 8, "H"),
  // shadow on the right of the belly
  hline(10, 9, 1, "S"),
  px(10, 10, "S"),
  // foot
  rect(5, 13, 6, 1, "S")
)
