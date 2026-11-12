class_name StoneTheme
extends RefCounted
## The ONE Godot theme for SIDHE & STONE.
##
## Godot ships with a DARK GREY default theme. Left alone, that grey bled
## onto every button, scrollbar and progress track in the interface - a
## measured capture had 10-13% of every frame in colours that are not in
## the shared palette at all. The interface is cream paper with dark warm
## outlines, so every control here is given an explicit palette stylebox.
##
## The font matters just as much. Godot antialiases text by default, and an
## antialiased glyph edge is a BLENDED pixel: a colour that is not in the
## palette and never will be. So the font is duplicated with antialiasing,
## hinting and subpixel positioning all switched off, which makes every
## glyph pixel either exactly the ink colour or exactly the paper behind
## it. Hard-edged type is also the right look for this art direction.
##
## Nothing in this file invents a colour. Every value comes from
## art/palette.px.js, and the roles match web/src/ui/palette.ts.

## The shared palette, mirrored from art/palette.px.js.
const COL_K := Color("1e1a16")   ## K - near-black outline
const COL_D := Color("362a21")   ## D - deep shadow, body ink
const COL_P := Color("46382a")   ## P - panel edge, and secondary ink
const COL_N := Color("716855")   ## N - mid brown
const COL_X := Color("d6d4c8")   ## X - parchment shadow
const COL_C := Color("e8dcc5")   ## C - cream panel
const COL_W := Color("f7f2e3")   ## W - paper white
const COL_Y := Color("dda742")   ## Y - ochre
const COL_G := Color("e5b63d")   ## G - gold
const COL_T := Color("c3613d")   ## T - rust
const COL_M := Color("82a156")   ## M - moss


## Build the theme. Assign it to the root Control and every child inherits
## it, so nothing in the interface can reach Godot's default look.
static func build() -> Theme:
	var th := Theme.new()
	th.default_font = crisp_font()
	th.default_font_size = FS_BODY

	# --- Label: dark ink by default. A label that forgets to set its own
	# colour gets readable dark text, not Godot's default white.
	th.set_color("font_color", "Label", COL_D)

	# --- Button: cream with a near-black outline, exactly like the web.
	th.set_stylebox("normal", "Button", _box(COL_C, COL_K))
	th.set_stylebox("hover", "Button", _box(COL_W, COL_K))
	th.set_stylebox("pressed", "Button", _box(COL_C, COL_K))
	th.set_stylebox("disabled", "Button", _box(COL_X, COL_P))
	th.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	th.set_color("font_color", "Button", COL_K)
	th.set_color("font_hover_color", "Button", COL_K)
	th.set_color("font_pressed_color", "Button", COL_K)
	th.set_color("font_disabled_color", "Button", COL_P)
	th.set_color("font_focus_color", "Button", COL_K)

	# --- The spin button is the one warm call to action on the screen, so
	# it gets the ochre fill with dark ink on it (K on Y is 9.13:1).
	th.set_stylebox("normal", "SpinButton", _box(COL_Y, COL_K))
	th.set_stylebox("hover", "SpinButton", _box(COL_G, COL_K))
	th.set_stylebox("pressed", "SpinButton", _box(COL_Y, COL_K))
	th.set_stylebox("disabled", "SpinButton", _box(COL_X, COL_P))
	th.set_stylebox("focus", "SpinButton", StyleBoxEmpty.new())
	th.set_color("font_color", "SpinButton", COL_K)
	th.set_color("font_hover_color", "SpinButton", COL_K)
	th.set_color("font_pressed_color", "SpinButton", COL_K)
	th.set_color("font_disabled_color", "SpinButton", COL_P)
	th.set_color("font_focus_color", "SpinButton", COL_K)

	# --- Scroll bars. The default ones were the second-biggest source of
	# off-palette pixels after the buttons.
	for bar in ["VScrollBar", "HScrollBar"]:
		th.set_stylebox("scroll", bar, _flat(COL_X))
		th.set_stylebox("scroll_focus", bar, _flat(COL_X))
		th.set_stylebox("grabber", bar, _flat(COL_N))
		th.set_stylebox("grabber_highlight", bar, _flat(COL_P))
		th.set_stylebox("grabber_pressed", bar, _flat(COL_D))

	# --- Progress bars: a parchment track with an ochre fill.
	th.set_stylebox("background", "ProgressBar", _flat(COL_X))
	th.set_stylebox("fill", "ProgressBar", _flat(COL_Y))

	# --- Panels, so anything not explicitly styled is still cream.
	th.set_stylebox("panel", "PanelContainer", _box(COL_C, COL_K))
	th.set_stylebox("panel", "Panel", _box(COL_C, COL_K))

	return th


## The default font, with antialiasing switched off.
##
## This is the difference between "the text is in the palette" and "the
## text edges are in the palette". Godot renders an antialiased glyph edge
## by blending the ink with whatever is behind it, and that blend is a
## colour the palette does not contain and never will.
## The one crisp Silkscreen instance, built once and shared. Anything that
## needs to MEASURE text (rather than draw it) has to measure it against the
## same face the button will draw with, or the measurement is a guess.
static var _crisp: FontFile = null

static func crisp_font() -> Font:
	if _crisp != null:
		return _crisp
	# THE PIXEL FONT. This used to duplicate Godot's DEFAULT theme font,
	# which is Open Sans SemiBold: a smooth VECTOR face. Switching its
	# antialiasing off does not make a vector face into a pixel face - it
	# just makes the vector face RAGGED, because the stems are drawn on
	# fractional outlines and land on uneven pixel boundaries. The real
	# pixel face was sitting unused in src/fonts/.
	#
	# Silkscreen is drawn on an 8px grid, so its stems land on whole
	# pixels. With antialiasing off, every glyph pixel is either exactly
	# the ink colour or exactly the paper behind it, and the edge is hard.
	var f: FontFile = load("res://src/fonts/Silkscreen-Regular.ttf")
	if f == null:
		var base: Font = ThemeDB.get_default_theme().default_font
		if base == null:
			base = ThemeDB.fallback_font
		if base is FontFile:
			return (base as FontFile).duplicate() as FontFile
		return base
	var d: FontFile = f.duplicate() as FontFile
	d.antialiasing = TextServer.FONT_ANTIALIASING_NONE
	d.hinting = TextServer.HINTING_NONE
	d.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_DISABLED
	d.allow_system_fallback = false
	_crisp = d
	return d


## The type ramp.
##
## EVERY size here is a multiple of 8, and that is not a style choice --
## it is the only way to get clean pixel stems out of Silkscreen.
##
## Measured from the font itself (src/fonts/Silkscreen-Regular.ttf,
## unitsPerEm = 1000): the vertical stem of "I" is 125 units, which is
## 1/8 em, and the cap height is 625 units, which is 5/8 em. So at a
## font size of N the stem is N/8 pixels and the cap height is 5N/8.
##
##   size  stem  cap   verdict
##     12   1.5    7.5  fractional - stems break across 1px and 2px
##     14   1.75   8.75  fractional - worse, 3 distinct stem widths
##     16   2.0   10.0  clean
##     20   2.5   12.5  fractional
##     24   3.0   15.0  clean
##     32   4.0   20.0  clean
##
## A fractional stem is what makes pixel text look thin, ragged and
## "bad" rather than deliberate. The old ramp used 12, 14 and 20, so
## most of the interface was being drawn with stems that never lined
## up. These sizes are the multiples of 8.
##
## Sizes are also large enough to read: the smallest tier is 16 (a 10px
## cap height) and body text is 24 (a 15px cap height).
const FS_TINY := 16
const FS_SMALL := 24
const FS_BODY := 24
const FS_MID := 32
const FS_LARGE := 40
const FS_HUGE := 48


## A flat filled box with a border and no corner radius: the house style.
static func _box(fill: Color, border: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = fill
	s.border_color = border
	s.set_border_width_all(1)
	s.set_corner_radius_all(0)
	return s


## A flat filled box with no border.
static func _flat(fill: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = fill
	s.set_corner_radius_all(0)
	return s
