extends SceneTree
func _init() -> void:
	_run.call_deferred()

func _run() -> void:
	print("P screen=", DisplayServer.screen_get_size(), " scale=", DisplayServer.screen_get_scale())
	print("P window=", DisplayServer.window_get_size())
	print("P vp=", root.get_viewport().get_size(), " vis=", root.get_viewport().get_visible_rect())
	print("P csf=", root.content_scale_factor, " mode=", root.content_scale_mode, " size=", root.content_scale_size)
	var df: Font = ThemeDB.get_default_theme().default_font
	print("P default_font=", df, " name=", df.get_font_name())

	var silks: FontFile = load("res://src/fonts/Silkscreen-Regular.ttf")
	silks.antialiasing = TextServer.FONT_ANTIALIASING_NONE
	silks.hinting = TextServer.HINTING_NONE
	silks.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_DISABLED
	var of: FontFile = (df as FontFile).duplicate() as FontFile
	of.antialiasing = TextServer.FONT_ANTIALIASING_NONE
	of.hinting = TextServer.HINTING_NONE
	of.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_DISABLED

	var sv := SubViewport.new()
	sv.size = Vector2i(360, 300)
	sv.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(sv)
	var y := 4
	for s in [12, 16, 20, 24]:
		var l1 := Label.new()
		l1.text = "Day 6 %d" % s
		l1.add_theme_font_override("font", of)
		l1.add_theme_font_size_override("font_size", s)
		l1.position = Vector2(4, y)
		sv.add_child(l1)
		var l2 := Label.new()
		l2.text = "Day 6 %d" % s
		l2.add_theme_font_override("font", silks)
		l2.add_theme_font_size_override("font_size", s)
		l2.position = Vector2(4, y + 14)
		sv.add_child(l2)
		y += 38
	await create_timer(0.6).timeout
	await process_frame
	await process_frame
	var img: Image = sv.get_texture().get_image()
	img.save_png("/tmp/gsk_fonts2.png")
	print("P saved ", img.get_size())
	quit()
