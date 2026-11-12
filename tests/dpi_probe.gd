extends SceneTree
func _init() -> void:
	_run.call_deferred()
func _run() -> void:
	print("P allow_hidpi=", ProjectSettings.get_setting("display/window/dpi/allow_hidpi", "unset"))
	print("P screen_size=", ProjectSettings.get_setting("display/window/size/screen_width", -1), "x", ProjectSettings.get_setting("display/window/size/screen_height", -1))
	print("P usable=", DisplayServer.screen_get_usable_rect())
	print("P screen=", DisplayServer.screen_get_size(), " scale=", DisplayServer.screen_get_scale(), " dpi=", DisplayServer.screen_get_dpi())
	quit()
