include("../palette.px.js")

// The gallery case: a display vitrine, not a box. A brass L top rail, a
// slate U frame with two corner posts and a cap, a cream C glint on the
// glass, and a warm A pedestal with a brass L label plate. The shadow
// under the table top is K, so the case reads as sitting on something
// rather than floating. Every colour here comes from the shared palette.
sprite("gallery_case", { w: 24, h: 24, outline: "K" },
  // pedestal foot
  rect(4, 20, 16, 2, "L"),
  // pedestal column
  rect(8, 16, 8, 4, "A"),
  // brass label plate on the column
  rect(10, 17, 4, 2, "L"),
  // display table top
  rect(3, 13, 18, 3, "A"),
  // shadow under the table top
  rect(3, 15, 18, 1, "K"),
  // glass vitrine: corner posts
  rect(5, 4, 2, 9, "U"),
  rect(17, 4, 2, 9, "U"),
  // vitrine cap
  rect(4, 3, 16, 2, "U"),
  // brass top rail
  rect(4, 2, 16, 1, "L"),
  // a glint on the glass
  px(7, 6, "C"),
  px(8, 7, "C")
)
