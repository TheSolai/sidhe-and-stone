extends SceneTree
## Capture the Fate Reel MID-SPIN and SETTLED.
## The reel is the game's signature mechanic; a static PNG proves nothing.
##
## Two hard-won lessons baked in:
##   1. The first-run coach card sits over the reel - dismiss it first, or
##      every "reel" screenshot is actually a picture of a tutorial card.
##   2. A reference to a field that does not exist (e.g. `_coach_visible`)
##      aborts the script BEFORE quit() runs, and the Godot window hangs
##      forever. Hence the watchdog below, and hence printing the reel
##      glyphs as TEXT so the evidence does not depend on a vision model
##      being right about where the reel is.

var _out := "/tmp/gsk_reel"
var ui
var _done := false

func _init() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			_out = a.substr(6)
	_capture.call_deferred()
	_watchdog.call_deferred()

func _watchdog() -> void:
	## Hard ceiling. If anything above throws, we still exit.
	for i in 200:
		await create_timer(0.1).timeout
		if _done:
			return
	push_warning("[reel] watchdog fired - bailing out")
	quit()

func _capture() -> void:
	DirAccess.make_dir_recursive_absolute(_out)
	var scene: PackedScene = load("res://src/main.tscn")
	ui = scene.instantiate()
	root.add_child(ui)
	await create_timer(1.2).timeout

	# --- dismiss the first-run coach (it covers the reel strip) ---
	var buttons: Array[Button] = []
	_collect(ui, buttons)
	var dismissed := false
	for b in buttons:
		if b.text == "Got it":
			b.pressed.emit()
			dismissed = true
			break
	await create_timer(0.5).timeout
	print("[reel] coach dismissed=", dismissed, " overlay_children=", ui._overlay.get_child_count())

	# give charms so a spin is legal
	ui.state.sim.charms = 20
	ui._refresh()
	await create_timer(0.2).timeout

	var spin: Button = null
	for b in buttons:
		if b.text.begins_with("Spin"):
			spin = b
			break
	if spin == null:
		push_warning("[reel] no spin button found")
		_done = true
		quit()
		return

	# Union rect over ALL THREE reel windows. Cropping only the first label
	# misses the whole point of the stagger, which is what happens BETWEEN
	# the reels.
	var rect := Rect2()
	for icon in ui._reel_icons:
		var lr: Rect2 = icon.get_global_rect()
		rect = rect.merge(lr) if rect.size != Vector2.ZERO else lr
	var cx := maxi(0, int(rect.position.x) - 30)
	var cy := maxi(0, int(rect.position.y) - 26)
	var cw := int(rect.size.x) + 60
	var ch := int(rect.size.y) + 52
	print("[reel] reel strip union rect=", rect, " crop=", cx, ",", cy, " ", cw, "x", ch)

	spin.pressed.emit()
	print("[reel] spin pressed; symbols now: ", _symbols())

	# sample glyph text DURING the spin to prove it cycles
	var seen := {}
	for i in 14:
		await create_timer(0.07).timeout
		var g := _symbols()
		seen[g] = true
		if i == 9:
			# t ~ 0.63s: reel 0 has landed (stop 0.55) while reels 1 and 2
			# are still cycling (stops 0.72 / 0.90). This is the frame that
			# shows three independent reels rather than one blinking wheel.
			await process_frame
			await process_frame
			_shot("reel_staggered", cx, cy, cw, ch)
			_shot_full("reel_staggered_full")
			print("[reel] staggered frame symbols: ", _symbols())
	print("[reel] distinct symbol states during spin: ", seen.size())
	for g in seen.keys():
		print("[reel]   state: ", g)

	await create_timer(1.4).timeout
	await process_frame
	await process_frame
	_shot("reel_settled", cx, cy, cw, ch)
	_shot_full("reel_settled_full")
	_shot("reel_midspin", cx, cy, cw, ch)
	print("[reel] settled symbols: ", _symbols())
	print("[reel] status: '", ui._lbl_status.text, "'")
	_done = true
	quit()

## The identity of what is in each reel window.
##
## The reel symbols are DRAWN MOTIFS, not font glyphs: each window holds a
## TextureRect whose texture is the symbol's sprite. So the name comes from
## the texture that is in the window - "symbol_clover.png" reads back as
## "clover" - and a window with no texture yet reads as "-".
func _symbols() -> String:
	var parts: Array[String] = []
	for icon in ui._reel_icons:
		parts.append(_symbol_of(icon))
	return "|".join(parts)


func _symbol_of(icon: TextureRect) -> String:
	var tex := icon.texture
	if tex == null:
		return "-"
	var file := tex.resource_path.get_file()
	if file.ends_with(".png"):
		file = file.substr(0, file.length() - 4)
	if file.begins_with("symbol_"):
		file = file.substr("symbol_".length())
	return file

func _shot(nm: String, cx: int, cy: int, cw: int, ch: int) -> void:
	# `force_draw()` renders into the viewport texture whether or not the
	# window is on screen. `await frame_post_draw` would wait for an actual
	# PRESENTATION, which macOS suspends when the window is occluded - the
	# await then never resumes and the harness hangs (verified 2026-11-10).
	await process_frame
	RenderingServer.force_draw()
	await process_frame
	var img := root.get_texture().get_image()
	if img == null:
		return
	var r := Rect2i(cx, cy, cw, ch).intersection(
		Rect2i(0, 0, img.get_width(), img.get_height()))
	if r.size.x <= 0 or r.size.y <= 0:
		return
	img.get_region(r).save_png("%s/%s.png" % [_out, nm])

func _shot_full(nm: String) -> void:
	await process_frame
	RenderingServer.force_draw()
	await process_frame
	var img := root.get_texture().get_image()
	if img != null:
		img.save_png("%s/%s.png" % [_out, nm])

func _collect(node: Node, out: Array[Button]) -> void:
	if node is Button:
		out.append(node)
	for c in node.get_children():
		_collect(c, out)
