extends SceneTree
## Measure the live nav row AT THE REAL 720px CANVAS WIDTH.
## The previous probe ran at the default window width, so its numbers
## were for a wider layout than the player actually sees.

## Set once the measurements have actually been printed.
var _finished := false


func _init() -> void:
	_run.call_deferred()
	_watchdog.call_deferred()


## Hard ceiling, same reasoning as tests/ui_capture.gd: a probe that awaits a
## signal which never fires strands the process, and a stranded probe looks
## exactly like a slow one. An earlier run of this probe produced an EMPTY
## log and left a Godot process alive, because it was started with
## --headless, where the dummy renderer hands back null textures and the
## measurement never completes. This probe needs a REAL display; the
## watchdog makes a hang impossible either way.
func _watchdog() -> void:
	for i in 300:
		await create_timer(0.1).timeout
		if _finished:
			return
	push_warning("[nav_probe] watchdog fired - the probe never completed")
	print("NAV PROBE VERDICT: FROZEN - the probe never completed")
	quit()

func _run() -> void:
	DisplayServer.window_set_size(Vector2i(720, 1280))
	await process_frame
	var scene: PackedScene = load("res://src/main.tscn")
	var root_node := scene.instantiate()
	root.add_child(root_node)
	await create_timer(1.2).timeout
	_finished = true
	print("P viewport=", root.get_viewport().get_size())
	var wanted := ["Collection", "Digs", "Staff", "Goals", "Ledger"]
	var found := []
	_collect(root_node, wanted, found)
	for b in found:
		var fs: int = b.get_theme_font_size("font_size")
		var need: float = b.get_theme_font("font").get_string_size(b.text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		var icon_w := 0
		if b.icon != null:
			icon_w = b.icon.get_width()
		print("P nav '%s' w=%.1f fs=%d text_need=%.1f icon=%d need_total=%.1f clipped=%s" % [
			b.text, b.size.x, fs, need, icon_w, need + icon_w + 16.0, str(b.clip_text and b.size.x < need + icon_w + 16.0)])
	quit()

func _collect(n: Node, wanted: Array, out: Array) -> void:
	if n is Button and wanted.has((n as Button).text):
		out.append(n)
	for c in n.get_children():
		_collect(c, wanted, out)
