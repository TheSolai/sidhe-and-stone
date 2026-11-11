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
  K: '#16120f',
  D: '#2f251d',
  P: '#453729',

  // warm earth: dirt, wood, leather, stone
  N: '#6e624a',
  S: '#845537',
  Z: '#b0895f',

  // paper: the UI surfaces
  X: '#d6d4c8',
  C: '#e8dcc4',
  W: '#f7f2e3',

  // gold & ochre: money, the crown, the warm centre
  A: '#b4794a',
  Y: '#d9a441',
  G: '#e0b23c',
  H: '#f2d98a',

  // accents: each one means something
  T: '#c05f3c', // rust: theft, danger
  M: '#7d9a52', // moss: growth, nature, fairies
  L: '#5f9e8f', // relic teal-green
  E: '#6dd3df', // arcane teal: omens, luck, the reel
  I: '#a8e8ef', // arcane teal light
  U: '#8b99a6', // slate: staff, neutral metal
  R: '#8a8378', // rubble grey
} as const;

export type PaletteKey = keyof typeof PAL;

/** The colour of a grade, used by icons, plinths and the vault. */
export const GRADE_COLOR: Record<string, string> = {
  rubble: PAL.R,
  clay: PAL.A,
  relic: PAL.L,
  crown: PAL.G,
};

/** The colour of a grade's label, kept light enough to read on cream. */
export const GRADE_INK: Record<string, string> = {
  rubble: PAL.D,
  clay: PAL.D,
  relic: PAL.W,
  crown: PAL.D,
};

/** Sprite file names for each grade. */
export const GRADE_SPRITE: Record<string, string> = {
  rubble: 'artefact_rubble',
  clay: 'artefact_clay',
  relic: 'artefact_relic',
  crown: 'artefact_crown',
};

/** Grade order, richest first. Used everywhere the player compares value. */
export const GRADES = ['crown', 'relic', 'clay', 'rubble'] as const;

/** The colour of a dig type's label. */
export const DIG_COLOR: Record<string, string> = {
  test_pit: PAL.U,
  trench: PAL.Z,
  shaft: PAL.A,
};

/** Human-readable dig names. */
export const DIG_NAME: Record<string, string> = {
  test_pit: 'Test Pit',
  trench: 'Trench',
  shaft: 'Shaft',
};

/** Human-readable upgrade names. */
export const UPGRADE_NAME: Record<string, string> = {
  site: 'Dig Site',
  curator: 'Curator',
  gallery: 'Gallery Extension',
  omen: 'Omen Fairy',
  diggers: 'Digger Fairy',
  archivists: 'Archivist',
  wards: 'Ward Fairy',
};

/** Human-readable upgrade descriptions. */
export const UPGRADE_DESC: Record<string, string> = {
  site: 'One more dig running at once.',
  curator: 'Catalogues three more finds a day.',
  gallery: 'Two more display slots, and more visitors.',
  omen: 'Hires a fortune teller. The reel gets kinder.',
  diggers: 'Your fairies find more per dig.',
  archivists: 'Every exhibit is worth a little more.',
  wards: 'Fewer artefacts stolen at night.',
};
