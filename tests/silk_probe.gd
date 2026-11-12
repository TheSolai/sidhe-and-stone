extends SceneTree
const PAPER := Color("f7f2e3")
const INK := Color("1e1a16")
func _init() -> void: _run.call_deferred()
func _run() -> void:
	var silk: FontFile = load("res://src/fonts/Silkscreen-Regular.ttf")
	var f: FontFile = silk.duplicate()
	f.antialiasing = TextServer.FONT_ANTIALIASING_NONE
	f.hinting = TextServer.HINTING_NONE
	f.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_DISABLED
	var bg := ColorRect.new(); bg.color = PAPER; bg.size = Vector2(720, 1280); root.add_child(bg)
	DisplayServer.window_set_size(Vector2i(720, 1280))
	await create_timer(0.5).timeout
	for size in [8, 10, 12, 14, 16, 18, 20, 24, 28, 32]:
		for c in root.get_children():
			if c is Label: c.queue_free()
		await process_frame
		var l := Label.new()
		l.text = "Hxp8"
		l.add_theme_font_override("font", f)
		l.add_theme_font_size_override("font_size", size)
		l.add_theme_color_override("font_color", INK)
		l.position = Vector2(20, 20)
		root.add_child(l)
		await process_frame; await process_frame
		var img: Image = root.get_viewport().get_texture().get_image()
		var data := img.get_data(); var w := img.get_width()
		var blends := 0; var ink := 0
		var miny := 9999; var maxy := -1; var minx := 9999; var maxx := -1
		for y in range(0, 90):
			for x in range(0, 300):
				var i := (y * w + x) * 4
				var c := Color(data[i]/255.0, data[i+1]/255.0, data[i+2]/255.0)
				if c.is_equal_approx(INK):
					ink += 1
					if y < miny: miny = y
					if y > maxy: maxy = y
					if x < minx: minx = x
					if x > maxx: maxx = x
				elif not c.is_equal_approx(PAPER):
					blends += 1
		print("S size=%d capH=%d inkW=%d ink=%d blends=%d" % [size, (maxy-miny+1) if maxy>=0 else 0, (maxx-minx+1) if maxx>=0 else 0, ink, blends])
	quit()
