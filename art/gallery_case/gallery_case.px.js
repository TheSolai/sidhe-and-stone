use("pico8")
pal({ W: "#b4794a", G: "#8b99a6", L: "#d9a441", D: "#16120f", S: "#e8dcc4" })

sprite("gallery_case", { w: 24, h: 24, outline: "D" },
  // pedestal foot
  rect(4, 20, 16, 2, "L"),
  // pedestal column
  rect(8, 16, 8, 4, "W"),
  // brass label plate on the column
  rect(10, 17, 4, 2, "L"),
  // display table top
  rect(3, 13, 18, 3, "W"),
  // shadow under the table top
  rect(3, 15, 18, 1, "D"),
  // glass vitrine: corner posts
  rect(5, 4, 2, 9, "G"),
  rect(17, 4, 2, 9, "G"),
  // vitrine cap
  rect(4, 3, 16, 2, "G"),
  // brass top rail
  rect(4, 2, 16, 1, "L"),
  // a glint on the glass
  px(7, 6, "S"),
  px(8, 7, "S")
)
