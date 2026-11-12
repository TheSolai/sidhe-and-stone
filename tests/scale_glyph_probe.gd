extends SceneTree
func _init() -> void:
	_run.call_deferred()
func _run() -> void:
	var silks: FontFile = load("res://src/fonts/Silkscreen-Regular.ttf")
	silks.antialiasing = TextServer.FONT_ANTIALIASING_NONE
	silks.hinting = TextServer.HINTING_NONE
	silks.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_DISABLED
	var old: Font = ThemeDB.get_default_theme().default_font
	var of: FontFile = (old as FontFile).duplicate() as FontFile
	of.antialiasing = TextServer.FONT_ANTIALIASING_NONE
	of.hinting = TextServer.HINTING_NONE
	of.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_DISABLED

	var holder := Control.new()
	holder.set_anchors_preset(Control.PRESET_TOP_LEFT)
	holder.position = Vector2.ZERO
	root.add_child(holder)
	# Row 0: OLD font at size 16. Row 40: SILKSCREEN at size 16.
	var l1 := Label.new()
	l1.text = "Day 6 16"
	l1.add_theme_font_override("font", of)
	l1.add_theme_font_size_override("font_size", 16)
	l1.position = Vector2(4, 4)
	holder.add_child(l1)
	var l2 := Label.new()
	l2.text = "Day 6 16"
	l2.add_theme_font_override("font", silks)
	l2.add_theme_font_size_override("font_size", 16)
	l2.position = Vector2(4, 40)
	holder.add_child(l2)

	for sz in [Vector2i(540, 960), Vector2i(720, 1280)]:
		DisplayServer.window_set_size(sz)
		await create_timer(0.9).timeout
		await process_frame
		await process_frame
		var img: Image = root.get_viewport().get_texture().get_image()
		var path := "/tmp/gsk_sg_%dx%d.png" % [sz.x, sz.y]
		img.save_png(path)
		print("P saved ", path, " size=", img.get_size())
	quit()
