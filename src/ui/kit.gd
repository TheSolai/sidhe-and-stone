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
##
## The bevels are StoneBevel (src/ui/bevel.gd), a custom StyleBox. A Control
## that overrides _draw() paints over the engine's own label, which was
## measured on this project; a StyleBox is drawn by the engine BEFORE the
## label, so the bevel stays underneath the text.

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

## The minimum height of anything tappable.
##
## Apple HIG asks for 44x44 pt, and the research behind the redesign
## agrees. A 12px label inside a 44px target is still a 44px target.
const TAP := 44


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


## A flat fill with a hard border and padding. For panels that do not get
## a bevel.
static func panel(fill: Color) -> StyleBoxFlat:
	var s := box(fill, COL_K)
	s.content_margin_left = 10
	s.content_margin_right = 10
	s.content_margin_top = 8
	s.content_margin_bottom = 8
	return s


## A chunky bevelled surface.
##
## This is the house look. `accent` is the colour of the hard outline, so
## a card can be picked out of a list without tinting a single letter.
static func bevel(fill: Color = COL_C, accent: Color = COL_K,
		light: Color = COL_W, dark: Color = COL_P) -> StoneBevel:
	var b := StoneBevel.new()
	b.face = fill
	b.ink = accent
	b.light = light
	b.dark = dark
	return b


## A bevelled button: raised, with a hard outline, and a flat face.
##
## The button is at least TAP tall so it can be pressed with a thumb.
static func button(text: String, cb: Callable, fill: Color = COL_C,
		accent: Color = COL_K) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, TAP)
	b.add_theme_stylebox_override("normal", bevel(fill, accent))
	b.add_theme_stylebox_override("hover", bevel(COL_W, accent))
	b.add_theme_stylebox_override("pressed", bevel(fill, accent).pressed())
	b.add_theme_stylebox_override("disabled", bevel(COL_X, COL_P))
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.add_theme_color_override("font_color", COL_K)
	b.add_theme_color_override("font_hover_color", COL_K)
	b.add_theme_color_override("font_pressed_color", COL_K)
	b.add_theme_color_override("font_disabled_color", COL_P)
	b.pressed.connect(cb)
	return b


## A small bevelled button: still TAP tall, but with tighter padding so a
## row of them fits across a phone.
static func small_button(text: String, cb: Callable, fill: Color = COL_C,
		accent: Color = COL_K) -> Button:
	var b := button(text, cb, fill, accent)
	var s := bevel(fill, accent)
	s.content_margin_left = 8
	s.content_margin_right = 8
	s.content_margin_top = 4
	s.content_margin_bottom = 4
	b.add_theme_stylebox_override("normal", s)
	b.add_theme_stylebox_override("hover", bevel(COL_W, accent))
	b.add_theme_stylebox_override("pressed", bevel(fill, accent).pressed())
	b.add_theme_font_size_override("font_size", 13)
	return b


## The style of a destination in the bottom navigation.
##
## Exactly ONE destination is lit. The reference UI has no active state at
## all, which is the one place this interface deliberately diverges: a
## bottom bar where nothing says where you are is a bottom bar you have to
## read to use. The lit destination is the accent colour on this screen,
## and dark ink sits on it (K on Y is 9.13:1).
static func nav_style(active: bool) -> StoneBevel:
	if active:
		return bevel(COL_Y, COL_K)
	return bevel(COL_C, COL_K)


## A destination in the bottom navigation: a drawn icon and a word.
##
## The icon comes FIRST and the label follows, which is the convention the
## research found. The word is always present, because a bare icon is a
## puzzle and a puzzle is a bad thing to put in a tab bar.
static func nav_button(label: String, icon_file: String, cb: Callable) -> Button:
	var b := Button.new()
	b.text = label
	b.custom_minimum_size = Vector2(0, TAP)
	b.alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.clip_text = true
	var s := bevel(COL_C, COL_K)
	s.content_margin_left = 6
	s.content_margin_right = 6
	s.content_margin_top = 4
	s.content_margin_bottom = 4
	b.add_theme_stylebox_override("normal", s)
	b.add_theme_stylebox_override("hover", bevel(COL_W, COL_K))
	b.add_theme_stylebox_override("pressed", bevel(COL_C, COL_K).pressed())
	b.add_theme_stylebox_override("disabled", s)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.add_theme_color_override("font_color", COL_D)
	b.add_theme_color_override("font_hover_color", COL_K)
	b.add_theme_color_override("font_pressed_color", COL_K)
	b.add_theme_font_size_override("font_size", 12)
	var path := SPRITE_DIR + icon_file + ".png"
	if ResourceLoader.exists(path):
		b.icon = load(path)
		b.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		b.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.add_theme_constant_override("h_separation", 4)
	b.pressed.connect(cb)
	return b


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


## A thin vertical bar of colour: the identity of a row.
##
## A row in a list is identified by a 4px block at its leading edge rather
## than by a coloured border around the whole card. The border made every
## row look like a separate object; the block makes a shelf read as one
## block of stuff.
static func row_block(col: Color, w: int = 4) -> ColorRect:
	var c := ColorRect.new()
	c.color = col
	c.custom_minimum_size = Vector2(w, 0)
	c.size_flags_vertical = Control.SIZE_EXPAND_FILL
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c


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
		or file.begins_with("visitor_") or file.begins_with("curator") else 26
	return icon(file, base * 2)


## An empty space.
static func spacer(w: float = 0, h: float = 0) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(w, h)
	return c


## A progress bar with the house track and fill.
##
## The track is parchment and the fill is flat colour. A thin bar in a
## light track, with the fill carrying the state, is what the reference
## UI does, and it is the only honest way to show progress at a glance.
static func bar(value: float, fill: Color = COL_Y, h: int = 8) -> ProgressBar:
	var p := ProgressBar.new()
	p.show_percentage = false
	p.custom_minimum_size = Vector2(0, h)
	p.max_value = 1.0
	p.step = 0.001
	p.value = clampf(value, 0.0, 1.0)
	p.add_theme_stylebox_override("background", flat(COL_X))
	p.add_theme_stylebox_override("fill", flat(fill))
	return p


## A card: a raised cream slab.
##
## The identity colour of the thing in the card is a 4px block at the
## leading edge, added by the caller. The slab itself stays quiet.
static func card(accent: Color = COL_K) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", bevel(COL_W, accent))
	return p


## The row inside a card: a single horizontal line of card content.
##
## A PanelContainer stretches its ONLY child to the full rect, so the row
## is created here and added to the card, and the caller fills it rather
## than replacing it. The row is CENTRED vertically inside the card, so a
## card that is taller than its row still reads as one thing.
static func card_row(card: PanelContainer) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	card.add_child(row)
	return row


## The column inside a card, for cards that carry more than one line.
##
## The card is rebuilt as a single column so the second line sits UNDER
## the title rather than fighting it for width in the same row. The row
## is REMOVED from the card rather than just emptied: a PanelContainer
## stretches every child to the full rect, so an empty row left in there
## would sit invisibly on top of the column.
static func card_col(card: PanelContainer) -> VBoxContainer:
	for c in card.get_children():
		card.remove_child(c)
		c.queue_free()
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)
	card.add_child(col)
	return col


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


## A header block for a modal panel.
##
## The research found the reference UI put a header in its own shape
## inside the frame, rather than letting the first line of text float.
static func panel_header(text: String) -> Control:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", box(COL_W, COL_K))
	var l := Label.new()
	l.text = text.to_upper()
	l.add_theme_color_override("font_color", COL_D)
	l.add_theme_font_size_override("font_size", 15)
	p.add_child(l)
	return p


## A row inside a modal: a leading colour block, a label, and a
## right-aligned value.
##
## Money is right-aligned so the digits line up down the column, which is
## the only way a column of numbers can be scanned.
static func stat_row(key: String, value: String, accent: Color = COL_K,
		fill: Color = COL_C) -> Control:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", flat(fill))

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	p.add_child(row)

	row.add_child(row_block(accent, 4))

	var k := tight(key, COL_P, 14)
	k.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(k)

	var v := tight(value, COL_D, 16)
	v.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	row.add_child(v)
	return p
