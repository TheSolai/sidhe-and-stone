/**
 * The shared palette, mirrored from `art/palette.px.js`.
 *
 * Every pixel the game draws comes from here. The sprite files use the same
 * colours by name, so the interface and the artwork cannot drift apart.
 *
 * Art direction is KairoSoft: LIGHT and high-contrast. Cream paper, dark
 * warm outlines, muted-but-saturated accents, one cool teal for the arcane
 * things.
 */

export const PAL = {
  // dark structure: outlines, deep shadow, panel edges
  K: '#1e1a16',
  D: '#362a21',
  P: '#46382a',

  // warm earth: dirt, wood, leather, stone
  N: '#716855',
  S: '#c17c50',
  Z: '#c69a6b',

  // paper: the UI surfaces
  X: '#d6d4c8',
  C: '#e8dcc5',
  W: '#f7f2e3',

  // gold & ochre: money, the crown, the warm centre
  A: '#b98053',
  Y: '#dda742',
  G: '#e5b63d',
  H: '#efd788',

  // accents: each one means something
  T: '#c3613d', // rust: theft, danger
  M: '#82a156', // moss: growth, nature, fairies
  L: '#5f9f90', // relic teal-green
  E: '#6fd8e4', // arcane teal: omens, luck, the reel
  I: '#a8e8ef', // arcane teal light
  U: '#8896a3', // slate: staff, neutral metal
  R: '#aca496', // rubble grey
} as const;

export type PaletteKey = keyof typeof PAL;

/**
 * The colour of a grade, used by icons, plinths and the vault.
 *
 * Each grade owns a hue so a shelf reads at a glance. These are the
 * identity colours from art/ART_DIRECTION.md, and they match what each
 * artefact sprite is actually made of:
 *
 *   rubble  stone       R  (grey broken chunk)
 *   clay    terracotta  A  (warm pot)
 *   tablet  slate       U  (inscribed stone slab, cool)
 *   relic   verdigris   L  (teal carved stone, arcane glow)
 *   mask    rust & gold T  (ceremonial mask, gilt)
 *   crown   gold        G  (the warmest thing in the game)
 */
export const GRADE_COLOR: Record<string, string> = {
  rubble: PAL.R,
  clay: PAL.A,
  tablet: PAL.U,
  relic: PAL.L,
  mask: PAL.T,
  crown: PAL.G,
};

/**
 * The colour of a grade's label, chosen for CONTRAST against the grade's
 * own colour, not by taste.
 *
 * A label is drawn on a band of its grade colour, so the pair has to be
 * readable. Measured against the shared palette:
 *
 *   rubble  R  vs D 5.63   vs W 2.21   -> D
 *   clay    A  vs D 4.16   vs W 2.99   -> D
 *   tablet  U  vs D 4.59   vs W 2.70   -> D
 *   relic   L  vs D 4.54   vs W 2.74   -> D
 *   mask    T  vs D 3.38   vs W 3.68   -> W
 *   crown   G  vs D 7.34   vs W 1.69   -> D
 *
 * Only `mask` is dark enough to need white ink; everything else takes the
 * near-black. Re-run the numbers before changing one of these.
 */
export const GRADE_INK: Record<string, string> = {
  rubble: PAL.D,
  clay: PAL.D,
  tablet: PAL.D,
  relic: PAL.D,
  mask: PAL.W,
  crown: PAL.D,
};

/** Sprite file names for each grade. */
export const GRADE_SPRITE: Record<string, string> = {
  rubble: 'artefact_rubble',
  clay: 'artefact_clay',
  tablet: 'artefact_tablet',
  relic: 'artefact_relic',
  mask: 'artefact_mask',
  crown: 'artefact_crown',
};

/**
 * Grade order, richest first. Used everywhere the player compares value.
 *
 * Mirrors SimCore.GRADE_ORDER in the Godot source. The order is load
 * bearing: visitors pay for the most valuable exhibits up to the demand
 * cap, so this list decides what actually earns.
 */
export const GRADES = ['crown', 'mask', 'relic', 'tablet', 'clay', 'rubble'] as const;

/** The colour of a dig type's label. */
export const DIG_COLOR: Record<string, string> = {
  test_pit: PAL.U,
  trench: PAL.Z,
  cutting: PAL.M,
  shaft: PAL.A,
  deepworks: PAL.Y,
};

/** Human-readable dig names. */
export const DIG_NAME: Record<string, string> = {
  test_pit: 'Test Pit',
  trench: 'Trench',
  cutting: 'Cutting',
  shaft: 'Shaft',
  deepworks: 'Deepworks',
};

/** Human-readable upgrade names. */
export const UPGRADE_NAME: Record<string, string> = {
  site: 'Dig Site',
  curator: 'Curator',
  gallery: 'Gallery Extension',
  omen: 'Omen Fairy',
  diggers: 'Digger Fairy',
  excavators: 'Excavators',
  guides: 'Guides',
  archivists: 'Archivist',
  wards: 'Ward Fairy',
};

/**
 * The accent colour of each upgrade.
 *
 * Used for the band down the left edge of an upgrade card and for the
 * owned-count bar. It is never used for text: the accents are deliberately
 * weak against cream (teal on cream is 1.23:1), so the colour carries the
 * meaning as a fill while the ink carries the words.
 */
export const UPGRADE_COLOR: Record<string, string> = {
  site: PAL.S,
  curator: PAL.U,
  gallery: PAL.M,
  omen: PAL.E,
  diggers: PAL.M,
  excavators: PAL.A,
  guides: PAL.Y,
  archivists: PAL.G,
  wards: PAL.L,
};

/** Human-readable upgrade descriptions. */
export const UPGRADE_DESC: Record<string, string> = {
  site: 'One more dig running at once.',
  curator: 'Catalogues three more finds a day.',
  gallery: 'Two more display slots, more visitors.',
  omen: 'A fortune teller makes the reel kinder.',
  diggers: 'Your fairies find more per dig.',
  excavators: 'Every dig finishes a day sooner.',
  guides: 'One more visitor comes to pay.',
  archivists: 'Every exhibit is worth a little more.',
  wards: 'Fewer artefacts stolen at night.',
};
