extends SceneTree
func _init() -> void:
	_run.call_deferred()
func _run() -> void:
	var silks: FontFile = load("res://src/fonts/Silkscreen-Regular.ttf")
	silks.antialiasing = TextServer.FONT_ANTIALIASING_NONE
	silks.hinting = TextServer.HINTING_NONE
	silks.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_DISABLED
	var sv := SubViewport.new()
	sv.size = Vector2i(120, 200)
	sv.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(sv)
	var y := 2
	for s in [8, 10, 12, 14, 16, 20, 24, 32]:
		var l := Label.new()
		l.text = "H"
		l.add_theme_font_override("font", silks)
		l.add_theme_font_size_override("font_size", s)
		l.position = Vector2(2, y)
		sv.add_child(l)
		print("P size=", s, " str_size=", silks.get_string_size("H", HORIZONTAL_ALIGNMENT_LEFT, -1, s), " ascent=", silks.get_ascent(s), " descent=", silks.get_descent(s))
		y += 24
	await create_timer(0.6).timeout
	await process_frame
	await process_frame
	var img: Image = sv.get_texture().get_image()
	img.save_png("/tmp/gsk_grid.png")
	print("P saved")
	quit()
