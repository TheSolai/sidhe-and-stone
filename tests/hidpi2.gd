extends SceneTree
func _init() -> void: _run.call_deferred()
func _run() -> void:
	print("H screen=", DisplayServer.screen_get_size(), " scale=", DisplayServer.screen_get_scale())
	for sz in [Vector2i(360, 640), Vector2i(540, 960), Vector2i(720, 1280)]:
		DisplayServer.window_set_size(sz)
		await create_timer(0.6).timeout
		await process_frame
		var img: Image = root.get_viewport().get_texture().get_image()
		print("H win=", DisplayServer.window_get_size(), " fb=", img.get_size(), " vis=", root.get_viewport().get_visible_rect().size)
	quit()
