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
## Hash of each captured frame, so the harness can tell the difference
## between "the screen looked the same" and "the screen never redrew".
var _frame_hashes: Array[int] = []
## Set when two consecutive frames are byte-identical.
var _frozen := false
## Set when the capture ran to completion.
var _done := false


func _init() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			_out_dir = a.substr(6)
	_capture.call_deferred()
	_watchdog.call_deferred()


## Hard ceiling. Without this the capture can hang forever: an `await` on a
## signal that never fires strands the whole validation run, and a stranded
## run looks exactly like a slow run. Verified by a real hang on 2026-11-10.
func _watchdog() -> void:
	for i in 300:
		await create_timer(0.1).timeout
		if _done:
			return
	push_warning("[capture] watchdog fired - bailing out")
	print("CAPTURE VERDICT: FROZEN - the capture never completed")
	quit()


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
		["digs", "04_digs"], ["staff", "05_staff"], ["goals", "06_goals"],
		["ledger", "07_ledger"]]
	for entry in tabs:
		_click_tab(root_node, str(entry[0]))
		await create_timer(0.35).timeout
		await _shot(root_node, str(entry[1]))

	# --- 4. the end-of-day report modal
	_click_tab(root_node, "gallery")
	await create_timer(0.2).timeout
	_click_button(root_node, "End Day")
	await create_timer(0.6).timeout
	await _shot(root_node, "08_day_report")
	_click_button(root_node, "Continue")
	await create_timer(0.3).timeout

	# --- 5. the reel, mid-spin, and the odds table
	_click_button(root_node, "Odds")
	await create_timer(0.4).timeout
	await _shot(root_node, "09_odds")

	# --- verdict. A capture that froze looks exactly like a capture that
	# worked: every PNG saves without error and every one is identical.
	# "err=0" proves the file was written, not that the screen was alive.
	if _frozen:
		print("CAPTURE VERDICT: FROZEN - consecutive frames are byte-identical")
		print("  (the display probably slept mid-capture; re-run under caffeinate)")
	else:
		print("CAPTURE VERDICT: ok - %d distinct frames" % _distinct_frames())

	_done = true
	quit()


## How many different images were captured.
func _distinct_frames() -> int:
	var seen := {}
	for h in _frame_hashes:
		seen[h] = true
	return seen.size()


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
	# Settle the frame properly.
	#
	# The naive `await process_frame` waits for the frame to be SCHEDULED,
	# not for it to be DRAWN, so the viewport texture can still hold the
	# previous frame - which is how several identical PNGs appear while
	# every save reports err=0.
	#
	# `await RenderingServer.frame_post_draw` fixes that but introduces a
	# worse bug: it waits for an actual PRESENTATION, and macOS suspends
	# presentation when the window is occluded. The await then never
	# resumes and the capture hangs (verified 2026-11-10).
	#
	# `force_draw()` is the correct primitive: it renders the frame into the
	# viewport texture whether or not the window is on screen.
	await process_frame
	await process_frame
	RenderingServer.force_draw()
	await process_frame
	var img := root.get_texture().get_image()
	var path := "%s/%s.png" % [_out_dir, name]
	var err := img.save_png(path)
	# Fingerprint the pixels, not the file. A display that has gone to sleep
	# still returns a valid (frozen) texture, and every save still succeeds,
	# so the only way to notice is to compare consecutive frames.
	var h := _checksum(img)
	if not _frame_hashes.is_empty() and _frame_hashes[-1] == h:
		_frozen = true
		print("[capture] WARNING: %s is identical to the previous frame" % name)
	_frame_hashes.append(h)
	print("[capture] %s (%dx%d) err=%d" % [
		path, img.get_width(), img.get_height(), err])


## A cheap fingerprint of the pixels. PackedByteArray has no hash(), and a
## full cryptographic hash of a 3.7 MB frame would cost more than the
## capture itself. Sampling every 997th byte is enough to tell a redrawn
## screen from a frozen one.
func _checksum(img: Image) -> int:
	var data := img.get_data()
	var h := 7
	var i := 0
	while i < data.size():
		h = (h * 31 + int(data[i])) & 0x7fffffff
		i += 997
	return h


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
