include("../palette.px.js")

// #COMMENT
// // The cloth: a folded bolt of woven textile, cream and ochre.
// //
// // The silhouette is a rectangle whose lower-right corner is cut away on a
// // diagonal and turned under into shadow. A flat rectangle would read as
// // a panel; the turned corner says fabric.
// //
// // The material ramp is Z, S and T: Z is the light on the turned-over fold
// // along the top, S is the body of the cloth, and T is the shadow that
// // gathers in the hanging corner. Each step down is the same cloth in less
// // light, so the fold reads as one continuous piece.
// //
// // C is the accent: a woven cream band two pixels wide running down the
// // front of the bolt. It is the only cool note and it is what tells the
// // eye this is textile and not a wooden panel.
// //
// // A hard D shadow runs along the bottom so the bolt rests on the shelf.

sprite("artefact_fabric", { w: 16, h: 16, outline: "K" },
  `
  ................
  ................
  ....ZZZZZZZZ....
  ..ZZSSSSSSSSSS..
  .ZSSSSSSSSSSSS..
  .ZSSSSSSSSSSSS..
  .ZSSSSCCSSSSSS..
  .ZSSSSCCSSSSSS..
  .ZSSSSSSSSSSSS..
  .ZSSSSSSSSSSSS..
  .ZSSSSSSSSSSSS..
  .ZSSSSSSSSSSST..
  .SSSSSSSSSSSTT..
  .SSSSSSSSSSTT...
  .SSSSSSSSTTTT...
  ..DDDDDDDDDD....
`
)
