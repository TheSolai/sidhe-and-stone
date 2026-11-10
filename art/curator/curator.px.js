use("pico8")
pal({ C: "#c05f3c", H: "#5f574f", S: "#e8dcc4", M: "#7d9a52", L: "#8b99a6", D: "#16120f" })

sprite("curator", { w: 16, h: 16, outline: "D" },
  // flat cap
  rect(6, 1, 4, 1, "H"),
  rect(5, 2, 4, 1, "H"),
  // head
  rect(6, 3, 4, 3, "S"),
  // eye
  px(8, 4, "D"),
  // coat
  rect(5, 6, 6, 4, "C"),
  // lapel
  vline(7, 6, 3, "H"),
  // arm reaching out to the lens
  hline(10, 8, 2, "C"),
  // magnifier: a small lens held clear of the head, not a lantern
  ring(13, 4, 1, "M"),
  px(13, 4, "L"),
  // handle down to the hand
  vline(13, 6, 2, "M"),
  // hand
  px(12, 7, "S"),
  // legs
  rect(6, 10, 1, 4, "H"),
  rect(9, 10, 1, 4, "H"),
  // shoes
  rect(5, 14, 2, 1, "D"),
  rect(8, 14, 2, 1, "D")
)
