extends SceneTree

const PAPER := Color("f7f2e3")
const INK := Color("1e1a16")

func _init() -> void:
	_run.call_deferred()

func _mk_label(font: Font, size: int) -> Label:
	var l := Label.new()
	l.text = "Hello Wg8 #"
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", INK)
	l.position = Vector2(10, 10)
	return l

func _count(img: Image) -> int:
	var blends := 0
	var data := img.get_data()
	var w := img.get_width()
	for y in range(0, 40):
		for x in range(0, w):
			var idx := (y * w + x) * 4
			var c := Color(data[idx] / 255.0, data[idx + 1] / 255.0, data[idx + 2] / 255.0)
			if c.is_equal_approx(INK) or c.is_equal_approx(PAPER):
				continue
			blends += 1
	return blends

func _run() -> void:
	var silk: FontFile = load("res://src/fonts/Silkscreen-Regular.ttf")
	var silk_crisp: FontFile = silk.duplicate()
	silk_crisp.antialiasing = TextServer.FONT_ANTIALIASING_NONE
	silk_crisp.hinting = TextServer.HINTING_NONE
	silk_crisp.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_DISABLED
	var silk_aa: FontFile = silk.duplicate()

	var bg := ColorRect.new()
	bg.color = PAPER
	bg.size = Vector2(720, 1280)
	root.add_child(bg)

	for win in [Vector2i(540, 960), Vector2i(720, 1280)]:
		DisplayServer.window_set_size(win)
		await create_timer(0.5).timeout
		for combo in [["default", null, 16], ["silk_aa", silk_aa, 16], ["silk_crisp", silk_crisp, 16], ["silk_crisp20", silk_crisp, 20]]:
			var name_s: String = combo[0]
			var f: Font = combo[1]
			var size: int = combo[2]
			for c in root.get_children():
				if c is Label:
					c.queue_free()
			await process_frame
			var l := _mk_label(f, size) if f != null else _mk_label(ThemeDB.get_default_theme().default_font, size)
			root.add_child(l)
			await process_frame
			await process_frame
			var img: Image = root.get_viewport().get_texture().get_image()
			print("W win=%s fb=%s font=%s size=%d blends=%d" % [win, img.get_size(), name_s, size, _count(img)])
	quit()
