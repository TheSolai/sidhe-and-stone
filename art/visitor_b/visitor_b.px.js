include("../palette.px.js")

// The second visitor. Same build as the first one — a warm coat, a warm
// head, legs under it — so the two have to be told apart at a glance.
//
// The difference is the hair: a bun pinned up on top of the head, a narrow
// knot of N rather than a cap, so the silhouette alone says "this is the
// other one". The head is narrower than the first visitor's, and the right
// side of it carries an N shadow so the face is not a flat oval.
//
// The coat is unchanged from the first visitor: Z on the lit left edge, S
// for the body, N for the shadowed right side and the legs.

sprite("visitor_b", { w: 16, h: 16, outline: "K" },
  `
  ................
  .....NNNNNN.....
  ......NNNN......
  ......AAAA......
  .....ADAADA.....
  .....AAAAAN.....
  .....SSSSSS.....
  ...ZZSSSSSSNN...
  ..ZZSSSSSSSSNN..
  ..ZSSSSSSSSSNN..
  ...SSSSSSNNNNN..
  ...SSSSSSNNNNN..
  ..SSSSSSNNNNNN..
  ..SSSSNNNNNNNN..
  ..SSNNNNNNNNNN..
  ..DDDDDDDDDDDD..
  `
)
