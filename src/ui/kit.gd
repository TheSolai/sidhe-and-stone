class_name StoneKit
extends RefCounted
## The shared widget kit for SIDHE & STONE.
##
## Every screen in the game is built from the pieces in this file, so the
## interface cannot drift between tabs. It is the Godot counterpart of
## web/src/ui/widgets.ts, and it obeys the same rules:
##
##   - every colour comes from the one shared palette (see ui_theme.gd);
##   - nothing is drawn with alpha, so every pixel on screen is a colour
##     the palette actually contains;
##   - text is dark ink on cream, never a coloured glyph, because the
##     accent hues do not carry enough contrast to be legible as type.
##
## The house look is a CHUNKY BEVEL: a light edge along the top and left,
## a dark edge along the bottom and right, and a hard near-black outline.
## That is what makes a cream rectangle read as a physical object rather
## than as a spreadsheet cell, and it is the single biggest difference
## between this interface and a desktop one.

## Where the generated pixel art lives.
const SPRITE_DIR := "res://assets/sprites/"

## The palette, mirrored from ui_theme.gd so the kit and the theme cannot
## drift apart.
const COL_K := StoneTheme.COL_K   ## near-black outline
const COL_D := StoneTheme.COL_D   ## deep shadow / body ink
const COL_P := StoneTheme.COL_P   ## panel edge, secondary ink
const COL_N := StoneTheme.COL_N   ## mid brown
const COL_X := StoneTheme.COL_X   ## parchment shadow
const COL_C := StoneTheme.COL_C   ## cream panel
const COL_W := StoneTheme.COL_W   ## paper white
const COL_Y := StoneTheme.COL_Y   ## ochre
const COL_G := StoneTheme.COL_G   ## gold
const COL_T := StoneTheme.COL_T   ## rust
const COL_M := StoneTheme.COL_M   ## moss
const COL_A := Color("b98053")    ## clay (also the dark edge on gold)
const COL_U := Color("8896a3")    ## slate


## A flat fill with no border. The base of every bevelled widget.
static func flat(fill: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = fill
	s.set_corner_radius_all(0)
	return s


## A flat fill with a hard border. For wells and frames that do not get
## a bevel.
static func box(fill: Color, border: Color, width: int = 1) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = fill
	s.border_color = border
	s.set_border_width_all(width)
	s.set_corner_radius_all(0)
	return s


## A cream panel with the standard 10px horizontal / 8px vertical padding.
static func panel(fill: Color) -> StyleBoxFlat:
	var s := box(fill, COL_K)
	s.content_margin_left = 10
	s.content_margin_right = 10
	s.content_margin_top = 8
	s.content_margin_bottom = 8
	return s


## A labelled section header: a small caps label with a rule under it.
##
## The rule is the way a header reads as a header without being BIG.
## A 19px bold word competes with the numbers the player needs; a small
## label with a rule sits above them without shouting.
static func section(title: String) -> Control:
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 3)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	col.add_child(row)

	var l := Label.new()
	l.text = title.to_upper()
	l.add_theme_color_override("font_color", COL_D)
	l.add_theme_font_size_override("font_size", 13)
	row.add_child(l)

	var rule := ColorRect.new()
	rule.color = COL_K
	rule.custom_minimum_size = Vector2(0, 1)
	rule.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	rule.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rule.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(rule)

	return col


## A dark-ink label. The default is 15px because that is the body size.
static func label(text: String, col: Color = COL_D, size: int = 15) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_color_override("font_color", col)
	l.add_theme_font_size_override("font_size", size)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return l


## A label that does NOT wrap and does NOT expand. For values and captions
## that must sit on one line next to an icon.
static func tight(text: String, col: Color = COL_D, size: int = 15) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_color_override("font_color", col)
	l.add_theme_font_size_override("font_size", size)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return l


## A small solid colour chip.
##
## The accent hues do not survive as TEXT on cream, but they do survive as
## a shape. The chip is how "good news" and "bad news" reach the player
## without colouring a single letter.
static func chip(col: Color, px: int = 9) -> ColorRect:
	var c := ColorRect.new()
	c.color = col
	c.custom_minimum_size = Vector2(px, px)
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c


## A chip with a word beside it.
static func chip_label(col: Color, text: String, size: int = 13) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 5)
	row.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	row.add_child(chip(col))
	row.add_child(tight(text, COL_D, size))
	return row


## A generated sprite as a UI icon.
##
## The textures are 18x18 and 26x26 pixel art. They are shown at their
## natural size or at an exact multiple, and the filter is NEAREST so a
## pixel never bleeds into its neighbour.
static func icon(file: String, px: int = 24) -> TextureRect:
	var tr := TextureRect.new()
	var path := SPRITE_DIR + file + ".png"
	if ResourceLoader.exists(path):
		tr.texture = load(path)
	tr.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	tr.custom_minimum_size = Vector2(px, px)
	tr.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	tr.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return tr


## A sprite drawn at exactly twice its natural size.
##
## 18x18 becomes 36x36 and 26x26 becomes 52x52. Both are whole-pixel
## multiples, so nothing is resampled and nothing blurs.
static func icon2(file: String) -> TextureRect:
	var base := 18 if file.begins_with("icon_") or file.begins_with("symbol_") \
		or file.begins_with("artefact_") or file.begins_with("upgrade_") \
		or file.begins_with("visitor_") else 26
	return icon(file, base * 2)


## An empty space.
static func spacer(w: float = 0, h: float = 0) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(w, h)
	return c


## A progress bar with the house track and fill, plus a lit top edge on
## the fill so it reads as a filled trough rather than a flat block.
static func bar(value: float, fill: Color = COL_Y, h: int = 8) -> ProgressBar:
	var p := ProgressBar.new()
	p.show_percentage = false
	p.custom_minimum_size = Vector2(0, h)
	p.max_value = 1.0
	p.step = 0.001
	p.value = clampf(value, 0.0, 1.0)
	p.add_theme_stylebox_override("background", box(COL_X, COL_K))
	p.add_theme_stylebox_override("fill", box(fill, COL_K))
	return p


## A card: a raised cream slab with a coloured left edge.
##
## The colour is the artefact's own identity colour, so a shelf reads at a
## glance, but the grade name is always written out: colour supplements
## the name, it never replaces it.
static func card(accent: Color) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", panel(COL_W))
	return p


## A title with a small caption under it.
static func titled(title: String, caption: String, accent: Color = COL_C) -> Control:
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 1)
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var t := Label.new()
	t.text = title
	t.add_theme_color_override("font_color", COL_D)
	t.add_theme_font_size_override("font_size", 17)
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.add_child(t)

	if caption != "":
		var c := Label.new()
		c.text = caption
		c.add_theme_color_override("font_color", COL_P)
		c.add_theme_font_size_override("font_size", 12)
		c.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		col.add_child(c)

	return col
