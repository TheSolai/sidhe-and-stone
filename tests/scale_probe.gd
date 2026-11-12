extends SceneTree
func _init() -> void:
	_run.call_deferred()

func _run() -> void:
	print("P screen=", DisplayServer.screen_get_size(), " scale=", DisplayServer.screen_get_scale())
	for sz in [Vector2i(540,960), Vector2i(720,1280), Vector2i(1080,1920)]:
		DisplayServer.window_set_size(sz)
		await create_timer(0.7).timeout
		var vp := root.get_viewport()
		var tex := vp.get_texture()
		var img: Image = tex.get_image()
		print("P win=", DisplayServer.window_get_size(),
			" framebuffer=", img.get_size(),
			" vis=", vp.get_visible_rect().size,
			" csf=", root.content_scale_factor,
			" mode=", root.content_scale_mode)
	quit()
