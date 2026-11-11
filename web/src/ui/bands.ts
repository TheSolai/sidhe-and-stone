/**
 * The band contract.
 *
 * The logical canvas is 960x540, and the interface is divided into
 * horizontal bands. Every band has exactly one owner, and nothing may
 * draw outside the band it was given.
 *
 *   0 .. 58    HUD          the framework. Money, day, charms, End Day.
 *  58 .. 92    TITLE        the screen. The big name, and one stat.
 *  92 .. 404   CONTENT      the screen. The main panels.
 * 404 .. 478   FOOTER       the screen. A summary panel, or nothing.
 * 478 .. 502   HINT         the framework. The contextual hint line.
 * 502 .. 540   NAV          the framework. The navigation strip.
 *
 * WHY THIS IS A MODULE AND NOT A COMMENT
 *
 * Three separate defects had the same cause: the footer of one screen
 * and the hint of another both wanted the last forty pixels of the
 * canvas, and nobody had said who owned them. So the footer of the
 * Dig Site screen, the footers of the Shop and the Reel, and the
 * framework hint were all drawing into the same strip at the bottom,
 * and the Goals screen was drawing its eighth tier row straight over
 * the navigation.
 *
 * A layout that is described in prose stays true until somebody moves
 * a panel by eight pixels. A layout that is described in CODE cannot
 * drift, because the numbers are imported, not remembered. The band
 * constants below are the single source of truth for where things go;
 * a screen that needs the footer band asks for FOOTER_TOP and gets it.
 */

import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './surface.ts';

/** The top bar. The framework owns this. */
export const HUD_HEIGHT = 58;

/** The navigation strip at the bottom. The framework owns this. */
export const NAV_HEIGHT = 38;

/** Where the navigation strip begins. */
export const NAV_TOP = LOGICAL_HEIGHT - NAV_HEIGHT;

/**
 * The screen title band: the big name, and the one stat that sits
 * beside it. Screens draw their title here.
 */
export const TITLE_TOP = HUD_HEIGHT;
export const TITLE_BOTTOM = 92;

/**
 * The content band: the main panels of a screen.
 *
 * A standard panel is CONTENT_TOP tall 300, which ends at 392 and
 * leaves a twelve-pixel gap before the footer band. Panels that are
 * part of the content band and NOT a footer should use PANEL_HEIGHT.
 */
export const CONTENT_TOP = 92;
export const CONTENT_BOTTOM = 404;
export const PANEL_HEIGHT = 300;

/**
 * The drop-shadow offset used by every panel.
 *
 * It lives here rather than in the widget toolkit because it is part of
 * the LAYOUT CONTRACT, not just a drawing detail. A panel is painted
 * with a shadow three pixels down and to the right, so a panel whose
 * bottom edge sits at the bottom of its band pushes its shadow out of
 * the band and onto the framework's hint line.
 *
 * That happened on every single screen: the footer panels ended at
 * y=478, and their shadows ran to y=481 -- three pixels inside the
 * hint band, which the framework owns. It was invisible in a
 * screenshot because the shadow is a pale three-pixel line, but it was
 * a real overlap, and the band check found it.
 *
 * So the footer panel is sized so that its SHADOW fits inside the band.
 */
export const SHADOW_OFFSET = 3;

/**
 * The footer band: a screen's own summary panel.
 *
 * A footer panel is 74 tall, which fits a title, two lines of text and
 * a progress bar. It must not be taller than this, and it must not
 * start above FOOTER_TOP.
 */
export const FOOTER_TOP = 404;
export const FOOTER_BOTTOM = 478;
export const FOOTER_HEIGHT = FOOTER_BOTTOM - FOOTER_TOP;

/**
 * The height a footer PANEL is drawn at.
 *
 * This is the band height less the shadow, so the panel plus its shadow
 * fits inside the band. A panel drawn at the full FOOTER_HEIGHT would
 * put its shadow three pixels past the bottom of the band.
 */
export const FOOTER_PANEL_HEIGHT = FOOTER_HEIGHT - SHADOW_OFFSET;

/**
 * The hint band: one line of framework text explaining what the screen
 * wants the player to do.
 *
 * The framework owns this band outright. A screen that wants to say
 * something to the player uses the FOOTER band, which is its own.
 */
export const HINT_TOP = FOOTER_BOTTOM;
export const HINT_BOTTOM = NAV_TOP;
export const HINT_TEXT_Y = HINT_TOP + 3;

/**
 * The left margin every panel starts from. */
export const MARGIN_X = 20;

/** The width of a full-width panel: the canvas less both margins. */
export const PANEL_WIDTH = LOGICAL_WIDTH - MARGIN_X * 2;

/** A full-width panel in the footer band. */
export function footerPanel(): { x: number; y: number; w: number; h: number } {
  return { x: MARGIN_X, y: FOOTER_TOP, w: PANEL_WIDTH, h: FOOTER_PANEL_HEIGHT };
}

/**
 * A standard content panel: full width, sitting at the top of the
 * content band.
 */
export function contentPanel(): { x: number; y: number; w: number; h: number } {
  return { x: MARGIN_X, y: CONTENT_TOP, w: PANEL_WIDTH, h: PANEL_HEIGHT };
}
