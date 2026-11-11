extends SceneTree
## A rendering probe for the bevel widgets.
##
## Two questions this answers, both of which changed the design:
##
##  1. Does a Button subclass's _draw() paint OVER the engine's own button
##     text? If it does, a custom bevelled button has to draw its own
##     label, and a plain themed Button has to be used wherever the
##     engine label is wanted.
##
##  2. Are the glyph edges of the crisp font PURE palette colours? An
##     antialiased edge is a blended pixel, and a blended pixel is a
##     colour the shared palette does not contain.
##
## Usage:
##   godot --headless --path . --script res://tests/bevel_probe.gd

const OUT_PATH := "/Users/amre/.openclaw/workspace/tmp_frames/probe2.png"

## A button that draws its own face, its own bevel and its own label.
##
## If the engine drew its text first and this _draw() ran afterwards, the
## fill would cover the engine's label - which is exactly why the label
## is drawn HERE rather than being left to the engine.
class BevelProbeButton extends Button:
	var face := Color("dda742")
	var light := Color("efd788")
	var dark := Color("b98053")
	var ink := Color("1e1a16")
	var label_text := "BEVEL"
	var label_size := 16
	var show_icon := false
	var icon_tex: Texture2D

	func _draw() -> void:
		draw_rect(Rect2(0, 0, size.x, size.y), face)
		draw_rect(Rect2(2, 2, size.x - 4, 2), light)
		draw_rect(Rect2(2, 2, 2, size.y - 4), light)
		draw_rect(Rect2(2, size.y - 4, size.x - 4, 2), dark)
		draw_rect(Rect2(size.x - 4, 2, 2, size.y - 4), dark)
		draw_rect(Rect2(0, 0, size.x, 2), ink)
		draw_rect(Rect2(0, 0, 2, size.y), ink)
		draw_rect(Rect2(0, size.y - 2, size.x, 2), ink)
		draw_rect(Rect2(size.x - 2, 0, 2, size.y), ink)

		var font: Font = get_theme_default_font()
		var tx := 10.0
		if show_icon and icon_tex:
			draw_texture_rect(icon_tex, Rect2(8, (size.y - 18) / 2, 18, 18), false)
			tx = 32.0
		draw_string(font, Vector2(tx, size.y / 2 + label_size * 0.36),
			label_text, HORIZONTAL_ALIGNMENT_LEFT, -1, label_size, ink)

## A card with a chunky bevel, built on a MarginContainer.
class BevelProbeCard extends MarginContainer:
	var face := Color("f7f2e3")
	var light := Color("ffffff")
	var dark := Color("46382a")
	var ink := Color("1e1a16")

	func _draw() -> void:
		draw_rect(Rect2(0, 0, size.x, size.y), face)
		draw_rect(Rect2(2, 2, size.x - 4, 3), light)
		draw_rect(Rect2(2, 2, 3, size.y - 4), light)
		draw_rect(Rect2(2, size.y - 5, size.x - 4, 3), dark)
		draw_rect(Rect2(size.x - 5, 2, 3, size.y - 4), dark)
		draw_rect(Rect2(0, 0, size.x, 2), ink)
		draw_rect(Rect2(0, 0, 2, size.y), ink)
		draw_rect(Rect2(0, size.y - 2, size.x, 2), ink)
		draw_rect(Rect2(size.x - 2, 0, 2, size.y), ink)


func _init() -> void:
	_probe.call_deferred()
	_watchdog.call_deferred()


func _watchdog() -> void:
	for i in 200:
		await create_timer(0.1).timeout
		if _done:
			return
	push_warning("[probe] watchdog fired - bailing out")
	quit()


var _done := false


func _probe() -> void:
	var ctrl := Control.new()
	ctrl.set_anchors_preset(Control.PRESET_FULL_RECT)
	ctrl.theme = StoneTheme.build()
	root.add_child(ctrl)

	var bg := ColorRect.new()
	bg.color = Color("d6d4c8")
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ctrl.add_child(bg)

	# --- A: a PLAIN themed button. Does the engine still draw its label?
	var plain := Button.new()
	plain.text = "PLAIN"
	plain.position = Vector2(20, 20)
	plain.size = Vector2(220, 48)
	ctrl.add_child(plain)

	# --- B: the custom bevel button, with its own label and icon.
	var bb := BevelProbeButton.new()
	bb.position = Vector2(20, 90)
	bb.size = Vector2(220, 48)
	bb.label_text = "BEVEL"
	bb.show_icon = true
	var p := "res://assets/sprites/icon_charm.png"
	if ResourceLoader.exists(p):
		bb.icon_tex = load(p)
	ctrl.add_child(bb)

	# --- C: a flat button with a TextureRect child on top of it.
	var flat := Button.new()
	flat.flat = true
	flat.position = Vector2(20, 160)
	flat.size = Vector2(220, 48)
	ctrl.add_child(flat)
	var tr := TextureRect.new()
	tr.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	tr.position = Vector2(100, 14)
	tr.size = Vector2(20, 20)
	if ResourceLoader.exists(p):
		tr.texture = load(p)
	flat.add_child(tr)

	# --- D: the bevelled card, with a child label inside it.
	var card := BevelProbeCard.new()
	card.position = Vector2(20, 230)
	card.size = Vector2(320, 70)
	card.add_theme_constant_override("margin_left", 12)
	card.add_theme_constant_override("margin_top", 12)
	ctrl.add_child(card)
	var l := Label.new()
	l.text = "CARD CHILD"
	l.add_theme_color_override("font_color", Color("362a21"))
	l.add_theme_font_size_override("font_size", 16)
	card.add_child(l)

	await create_timer(0.8).timeout
	await process_frame
	await process_frame
	RenderingServer.force_draw()
	await process_frame

	var img := root.get_texture().get_image()
	var err := img.save_png(OUT_PATH)
	print("[probe] saved %s (%dx%d) err=%d" % [OUT_PATH,
		img.get_width(), img.get_height(), err])

	_done = true
	quit()
