extends SceneTree
func _init() -> void:
	_run.call_deferred()

func _run() -> void:
	var scn: Node = load("res://src/main.tscn").instantiate()
	root.add_child(scn)
	await create_timer(1.2).timeout
	var img: Image = root.get_viewport().get_texture().get_image()
	print("PROBE framebuffer = ", img.get_size())
	img.save_png("/tmp/gsk_fb_native.png")
	# Also render the same scene at the logical canvas size for comparison.
	var sv: SubViewport = SubViewport.new()
	sv.size = Vector2i(720, 1280)
	root.add_child(sv)
	var scn2: Node = load("res://src/main.tscn").instantiate()
	sv.add_child(scn2)
	await create_timer(1.0).timeout
	var img2: Image = sv.get_texture().get_image()
	print("PROBE canvas720 = ", img2.get_size())
	img2.save_png("/tmp/gsk_fb_canvas.png")
	quit()
