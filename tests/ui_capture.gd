extends SceneTree
## Render the live UI to PNGs so the assembled screen can be reviewed as an
## image, not just as an assertion list. Headless smoke tests prove the
## sprites LOAD; this proves they LOOK right where they sit.
##
## Captures one frame per tab, plus the two MODAL screens (the end-of-day
## report and the first-run coach) which are only ever seen for a moment in
## play and are therefore the easiest thing in the game to get wrong.
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

	# --- 1. first run: the coach is up, nothing else exists yet.
	await _shot(root_node, "01_first_run")

	# --- 2. play a few days so the museum has something in it.
	_play_a_while(root_node.state)

	# --- 3. the tabs
	var tabs := [["gallery", "02_gallery"], ["vault", "03_vault"],
		["digs", "04_digs"], ["staff", "05_staff"], ["ledger", "06_ledger"]]
	for entry in tabs:
		_click_tab(root_node, str(entry[0]))
		await create_timer(0.35).timeout
		await _shot(root_node, str(entry[1]))

	# --- 4. the end-of-day report modal
	_click_tab(root_node, "gallery")
	await create_timer(0.2).timeout
	_click_button(root_node, "End Day")
	await create_timer(0.6).timeout
	await _shot(root_node, "07_day_report")
	_click_button(root_node, "Continue")
	await create_timer(0.3).timeout

	# --- 5. the reel, mid-spin, and the odds table
	_click_button(root_node, "Odds")
	await create_timer(0.4).timeout
	await _shot(root_node, "08_odds")

	quit()


## Drive the game forward the way a player would: dig, wait, display.
## This produces a museum with real contents so the gallery and vault
## screenshots show actual cards rather than empty states.
func _play_a_while(state: GameState) -> void:
	for day in 5:
		state.assign_dig(0, "test_pit")
		state.assign_dig(1, "trench")
		state.assign_dig(2, "shaft")
		state.end_day()
		# Pull anything that has been catalogued onto the gallery floor.
		for grade in ["crown", "relic", "clay", "rubble"]:
			while state.vault_counts().get(grade, 0) > 0:
				if not state.display_one(grade):
					break
	await create_timer(0.3).timeout


func _shot(root_node: Node, name: String) -> void:
	await process_frame
	await process_frame
	var img := root.get_texture().get_image()
	var path := "%s/%s.png" % [_out_dir, name]
	var err := img.save_png(path)
	print("[capture] %s (%dx%d) err=%d" % [
		path, img.get_width(), img.get_height(), err])


func _click_tab(root_node: Node, tab_name: String) -> void:
	# Select the tab by its label. Counting button indices is fragile: the
	# "Odds" and "Spin" buttons are Buttons too and come first in tree order.
	_click_button(root_node, tab_name)


func _click_button(root_node: Node, label: String) -> void:
	var buttons: Array[Button] = []
	_collect_buttons(root_node, buttons)
	for b in buttons:
		if b.text.to_lower() == label.to_lower():
			b.pressed.emit()
			return
	push_warning("[capture] no button labelled '%s'" % label)


func _collect_buttons(node: Node, out: Array[Button]) -> void:
	if node is Button:
		out.append(node)
	for c in node.get_children():
		_collect_buttons(c, out)
