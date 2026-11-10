use("pico8")
pal({ C: "#e8dcc4", H: "#d9a441", R: "#8a7d6b", D: "#16120f" })

// A fortune wheel reads as a DISC with alternating segments, not as open
// spokes. Open spokes leave transparent gaps between them, and the outline
// op then traces every gap - the wheel came out as speckle. Filling the
// disc first and cutting solid wedges over it keeps the silhouette one
// connected shape.

sprite("reel_wheel", { w: 24, h: 24, outline: "D" },
  // the wheel face
  circ(12, 12, 10, "C"),
  // four bold segments. Eight thinner wedges read as noise at this size:
  // the diagonal edges become 1px staircases and the wheel turns to mush.
  poly([12, 12, 19, 5, 5, 5], "H"),
  poly([12, 12, 19, 19, 19, 5], "C"),
  poly([12, 12, 5, 19, 19, 19], "H"),
  poly([12, 12, 5, 5, 5, 19], "C"),
  // the rim, an even ring right around the face
  ring(12, 12, 10, "R"),
  // hub
  circ(12, 12, 2, "R"),
  px(12, 12, "C")
)
