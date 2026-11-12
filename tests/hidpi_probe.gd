extends SceneTree
func _init() -> void:
	_run.call_deferred()
func _run() -> void:
	print("P screen=", DisplayServer.screen_get_size(), " scale=", DisplayServer.screen_get_scale())
	for sz in [Vector2i(100,100), Vector2i(540,960), Vector2i(1728,1080)]:
		DisplayServer.window_set_size(sz)
		await create_timer(0.6).timeout
		await process_frame
		var img: Image = root.get_viewport().get_texture().get_image()
		print("P win=", DisplayServer.window_get_size(), " framebuffer=", img.get_size(), " vis=", root.get_viewport().get_visible_rect().size)
	quit()
