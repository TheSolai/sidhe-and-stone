use("pico8")
pal({ E: "#8a7d6b", L: "#a99a80", S: "#5f574f", G: "#7d9a52", D: "#16120f" })

sprite("dig_site", { w: 24, h: 24, outline: "D" },
  // the patch of turned earth
  ellipse(12, 13, 10, 7, "E"),
  // the hole
  ellipse(12, 14, 6, 4, "D"),
  // far wall of the pit, catching a little light
  ellipse(12, 12, 6, 3, "S"),
  // spoil heaped at the near edge
  ellipse(12, 19, 7, 3, "L"),
  ellipse(12, 19, 5, 2, "E"),
  // grass tufts at the edge of the dug patch
  px(2, 9, "G"),
  px(3, 8, "G"),
  px(21, 10, "G"),
  px(20, 9, "G"),
  px(3, 18, "G")
)
