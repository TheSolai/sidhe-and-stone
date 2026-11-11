include("../palette.px.js")

// The curator: a person, so the head and the body must never blur into one
// blob. A flat cap in N, a face in A (clay) with two D eyes, and a D neck
// that separates the head from the shoulders. The coat is warm brown S with
// a cream shirt C down the middle of it and a shadow down its right side,
// and the sleeve N reaches out to the hand A. The magnifier is a small round
// lens — a slate U rim with the corners cut away so it reads as a circle, a
// bright W glass in the middle — held up at eye level on a wooden handle.
sprite("curator", { w: 16, h: 16, outline: "K" },
  `
  ................
  ......NNNN...UU.
  .....NNNNNN.UWWU
  ......AAAA..UWWU
  ......ADAD...UU.
  ......AAAA...N..
  .......DD....N..
  .....SSSSSD..N..
  .....SSCCSDNNA..
  .....SSCCSD.....
  .....SSCCSD.....
  .....SSSSSD.....
  .....NN..NN.....
  .....NN..NN.....
  .....NN..NN.....
  ....DDD..DDD....
  `
)
