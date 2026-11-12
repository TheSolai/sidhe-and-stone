extends SceneTree
## Measure the enlarged type for truncation and overlap on EVERY screen.
##
## A label that no longer fits its box is a word with its ending cut off.
## Godot does not report that as an error: a Label with autowrap off just
## clips, and a Button with clip_text off just overflows its neighbour.
## So the only honest way to find the damage is to MEASURE the laid-out
## rectangle against the width the text actually needs, using the same
## font instance the text is drawn with.
##
## Run: godot --headless --path . --script res://tests/type_overflow_probe.gd

const MAIN := preload("res://src/main.gd")

var problems: Array[String] = []
var measured := 0
var _started := false
var _finished := false


func _process(_delta: float) -> bool:
	if not _started:
		_started = true
		_run()
		return false
	return _finished


func _text_width(ctrl: Control, text: String, fs: int) -> float:
	var face: Font = ctrl.get_theme_font("font")
	if face == null:
		face = ctrl.get_theme_font("normal_font")
	if face == null:
		return 0.0
	return face.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x


func _walk(node: Node, path: String, out: Array) -> void:
	for child in node.get_children():
		if child is Control:
			out.append([child, path + "/" + str(child.name)])
		_walk(child, path + "/" + str(child.name), out)


func _run() -> void:
	print("=== native type overflow probe ===")
	var ui: GameUI = MAIN.new()
	root.add_child(ui)
	await process_frame
	await process_frame

	var tabs := 6
	for tab in tabs:
		ui._select_tab(tab)
		await process_frame
		await process_frame

		var controls: Array = []
		_walk(ui, "tab%d" % tab, controls)

		for entry in controls:
			var ctrl: Control = entry[0]
			var path: String = entry[1]
			if not ctrl.is_visible_in_tree():
				continue
			if ctrl is Label:
				var l := ctrl as Label
				if l.text.strip_edges() == "":
					continue
				var fs: int = l.get_theme_font_size("font_size")
				var need: float = _text_width(l, l.text, fs)
				measured += 1
				# A wrapped label may legitimately be taller than one line.
				if l.autowrap_mode == TextServer.AUTOWRAP_OFF:
					if need > l.size.x + 0.5:
						problems.append("%s Label needs %.0fpx but has %.0fpx : %s" % [
							path, need, l.size.x, l.text.substr(0, 28)])
			elif ctrl is Button:
				var b := ctrl as Button
				if b.text.strip_edges() == "":
					continue
				var fs: int = b.get_theme_font_size("font_size")
				var need: float = _text_width(b, b.text, fs)
				measured += 1
				if need > b.size.x + 0.5:
					problems.append("%s Button needs %.0fpx but has %.0fpx : %s" % [
						path, need, b.size.x, b.text.substr(0, 28)])

	print("  measured %d text controls across %d tabs" % [measured, tabs])
	if problems.is_empty():
		print("  NO TRUNCATION FOUND")
	else:
		print("  %d truncation problems:" % problems.size())
		for p in problems:
			print("    " + p)
	_finished = true
	quit(0 if problems.is_empty() else 1)
