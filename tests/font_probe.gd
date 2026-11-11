extends SceneTree
## Probe: what font does the default theme use, can antialiasing be disabled,
## and does a themed Button draw in exact palette colours?

func _init() -> void:
	var t := ThemeDB.get_default_theme()
	var f := t.default_font
	print("default font class: ", f.get_class())
	print("fallback font class: ", ThemeDB.fallback_font.get_class())
	print("default font size: ", t.default_font_size)
	if f is FontFile:
		print("is FontFile -> can set antialiasing")
		var ff: FontFile = (f as FontFile).duplicate()
		ff.antialiasing = TextServer.FONT_ANTIALIASING_NONE
		ff.hinting = TextServer.HINTING_NONE
		ff.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_DISABLED
		print("duplicated ok, antialiasing now: ", ff.antialiasing)
	else:
		print("NOT a FontFile")
	quit()
