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
	th.default_font_size = 16

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
static func crisp_font() -> Font:
	var base: Font = ThemeDB.get_default_theme().default_font
	if base == null:
		base = ThemeDB.fallback_font
	if base is FontFile:
		var f: FontFile = (base as FontFile).duplicate() as FontFile
		f.antialiasing = TextServer.FONT_ANTIALIASING_NONE
		f.hinting = TextServer.HINTING_NONE
		f.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_DISABLED
		return f
	return base


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
