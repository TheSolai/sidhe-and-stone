extends SceneTree
## Render the live UI to PNGs so the assembled screen can be reviewed as an
## image, not just as an assertion list. Headless smoke tests prove the
## sprites LOAD; this proves they LOOK right where they sit.
##
## Captures one frame per tab, so every generated sprite is validated in the
## place it actually appears.
##
## Usage:
##   godot --path . --script res://tests/ui_capture.gd -- --out=/tmp/gsk_ui

var _out_dir := "/tmp/gsk_ui"


func _init() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			_out_dir = a.substr(6)
	_capture.call_deferred()


func _capture() -> void:
	DirAccess.make_dir_recursive_absolute(_out_dir)
	var scene: PackedScene = load("res://src/main.tscn")
	var root_node := scene.instantiate()
	root.add_child(root_node)
	# Let layout, fonts and textures settle before grabbing any frame.
	await create_timer(1.2).timeout

	var names := ["gallery", "vault", "digs", "staff"]
	for i in names.size():
		_click_tab(root_node, names[i])
		await create_timer(0.35).timeout
		await process_frame
		await process_frame

		var img := root.get_texture().get_image()
		var path := "%s/%s.png" % [_out_dir, names[i]]
		var err := img.save_png(path)
		print("[capture] %s (%dx%d) err=%d" % [
			path, img.get_width(), img.get_height(), err])

	quit()


func _click_tab(root_node: Node, tab_name: String) -> void:
	# Select the tab by its label. Counting button indices is fragile: the
	# "Odds" and "Spin" buttons are Buttons too and come first in tree order.
	var buttons: Array[Button] = []
	_collect_buttons(root_node, buttons)
	for b in buttons:
		if b.text.to_lower() == tab_name:
			b.pressed.emit()
			return
	push_warning("[capture] no tab button labelled '%s'" % tab_name)


func _collect_buttons(node: Node, out: Array[Button]) -> void:
	if node is Button:
		out.append(node)
	for c in node.get_children():
		_collect_buttons(c, out)
