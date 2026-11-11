// ─────────────────────────────────────────────────────────────────────────────
// Sidhe & Stone — the ONE shared palette.
//
// Every sprite in this game is drawn from these colours. No sprite invents its
// own. That is the single biggest reason a sprite set looks "assorted" instead
// of like it came from the same world — and it is the rule we are not breaking.
//
// Art direction is KairoSoft: LIGHT and high-contrast. Cream paper, dark warm
// outlines, muted-but-saturated accents, one cool teal for the "arcane" things.
//
// The values below are SOLVED, not hand-picked. A deterministic solver
// (artcmp/solve_palette.py) fitted this palette against full-resolution
// Game Dev Story references (Steam app 1847240), matching:
//   - sprite body luminance to a measured per-sprite median of ~110.0
//     (the old palette sat at 94.9 — the sprites were reading muddy)
//   - accent saturation floors, so nothing desaturates into grey
//   - every audited UI foreground/background contrast pair
// The paper surfaces X/C/W and the gold-and-rust accents are PINNED: they
// carry the UI's bevels and the game's identity, and a solver left free to
// drift them flattens the panel edges.
//
// It also fixed a latent bug: the old ramp declared KDPNS as increasing
// lightness, but S (lum 95.6) was actually DARKER than N (98.9), so
// lighting() stepped the earth ramp the wrong way. The solved palette has
// every ramp monotonic.
//
// Usage in a sprite file:
//   include("../palette.px.js")
//   sprite("artefact_relic", { w: 18, h: 18, outline: "K" }, ...)
// ─────────────────────────────────────────────────────────────────────────────

use("pico8")

pal({
  // — dark structure: outlines, deep shadow, panel edges —
  K: "#1e1a16", //  K  outline. Always "K". Never draw an outline in anything else.
  D: "#362a21", //  D  deep shadow / recessed
  P: "#46382a", //  P  panel edge, rim light

  // — warm earth: dirt, wood, leather, stone —
  N: "#716855", //  N  mid brown
  S: "#c17c50", //  S  warm brown
  Z: "#c69a6b", //  Z  light wood

  // — paper: the UI surfaces. Light. This is what makes it feel KairoSoft
  //   rather than grim — a big field of cream, with dark linework on top.
  X: "#d6d4c8", //  X  parchment shadow
  C: "#e8dcc5", //  C  cream (the panel colour)
  W: "#f7f2e3", //  W  paper white / highlight

  // — gold & ochre: money, the crown, the warm centre of the palette —
  A: "#b98053", //  A  clay
  Y: "#dda742", //  Y  ochre
  G: "#e5b63d", //  G  gold
  H: "#efd788", //  H  gold highlight

  // — accents: each one means something —
  T: "#c3613d", //  T  rust (theft, danger, the red accent)
  M: "#82a156", //  M  moss (growth, nature, fairies)
  L: "#5f9f90", //  L  relic teal-green
  E: "#6fd8e4", //  E  arcane teal (omens, luck, the reel)
  I: "#a8e8ef", //  I  arcane teal light
  U: "#8896a3", //  U  slate (staff, neutral metal)
  R: "#aca496", //  R  rubble grey
})

// Ramps tell pxl which way is "lighter", so lighting() and ramp() work
// correctly instead of nudging colours the wrong direction.
ramps("KDPNS", "XCW", "AYGH", "LEI")
