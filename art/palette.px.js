// ─────────────────────────────────────────────────────────────────────────────
// Sidhe & Stone — the ONE shared palette.
//
// Every sprite in this game is drawn from these colours. No sprite invents its
// own. That is the single biggest reason a sprite set looks "assorted" instead
// of like it came from the same world — and it is the rule we are not breaking.
//
// Derived from the game's own UI constants (src/main.gd):
//   COL_BG 16120f · COL_PANEL 241d17 · COL_PANEL_HI 2f251d · COL_LINE 453729
//   COL_OCHRE d9a441 · COL_MOSS 7d9a52 · COL_SLATE 8b99a6 · COL_CREAM e8dcc4
//   COL_RUST c05f3c · COL_DIM 8a7d6b
//   GRADE_COL: rubble 8a8378 · clay b4794a · relic 5f9e8f · crown e0b23c
//
// Art direction is KairoSoft: LIGHT and high-contrast. Cream paper, dark warm
// outlines, muted-but-saturated accents, one cool teal for the "arcane" things.
// Sampled from the Game Dev Story reference: 845537 · 6dd3df · e7eef4 · 6fd1dc
// · d6d4c8 · 6e624a.
//
// Usage in a sprite file:
//   include("../palette.px.js")
//   sprite("artefact_relic", { w: 18, h: 18, outline: "K" }, ...)
// ─────────────────────────────────────────────────────────────────────────────

use("pico8")

pal({
  // — dark structure: outlines, deep shadow, panel edges —
  K: "#16120f", //  K  outline. Always "K". Never draw an outline in anything else.
  D: "#2f251d", //  D  deep shadow / recessed
  P: "#453729", //  P  panel edge, rim light

  // — warm earth: dirt, wood, leather, stone —
  N: "#6e624a", //  N  mid brown
  S: "#845537", //  S  warm brown
  Z: "#b0895f", //  Z  light wood

  // — paper: the UI surfaces. Light. This is what makes it feel KairoSoft
  //   rather than grim — a big field of cream, with dark linework on top.
  X: "#d6d4c8", //  X  parchment shadow
  C: "#e8dcc4", //  C  cream (the panel colour)
  W: "#f7f2e3", //  W  paper white / highlight

  // — gold & ochre: money, the crown, the warm centre of the palette —
  A: "#b4794a", //  A  clay
  Y: "#d9a441", //  Y  ochre
  G: "#e0b23c", //  G  gold
  H: "#f2d98a", //  H  gold highlight

  // — accents: each one means something —
  T: "#c05f3c", //  T  rust (theft, danger, the red accent)
  M: "#7d9a52", //  M  moss (growth, nature, fairies)
  L: "#5f9e8f", //  L  relic teal-green
  E: "#6dd3df", //  E  arcane teal (omens, luck, the reel)
  I: "#a8e8ef", //  I  arcane teal light
  U: "#8b99a6", //  U  slate (staff, neutral metal)
  R: "#8a8378", //  R  rubble grey
})

// Ramps tell pxl which way is "lighter", so lighting() and ramp() work
// correctly instead of nudging colours the wrong direction.
ramps("KDPNS", "XCW", "AYGH", "LEI")
