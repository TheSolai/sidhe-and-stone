extends SceneTree
func _init() -> void:
	print("PROBE window_get_size      = ", DisplayServer.window_get_size())
	print("PROBE window_get_size_px   = ", DisplayServer.window_get_size() )
	print("PROBE screen_get_size      = ", DisplayServer.screen_get_size())
	print("PROBE screen_get_scale     = ", DisplayServer.screen_get_scale())
	print("PROBE screen_get_dpi       = ", DisplayServer.screen_get_dpi())
	print("PROBE rendering_device     = ", RenderingServer.get_video_adapter_name())
	var vs := DisplayServer.window_get_size()
	var ct := get_root().get_size()
	print("PROBE root_viewport_size   = ", ct)
	print("PROBE canvas_stretch_scale = ", get_root().content_scale_factor)
	quit()
