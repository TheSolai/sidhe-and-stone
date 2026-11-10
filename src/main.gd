extends Control
## Minimal mobile shell: portrait, touch-friendly, safe-area aware.
## Replace with your grid/UI, but keep this structure.

const GRID := 4
var cell := 64
var origin := Vector2.ZERO

func _ready() -> void:
	cell = int(min(size.x, size.y) * 0.16)
	origin = (size - Vector2(cell * GRID, cell * GRID)) * 0.5
	print("GameStewKit alive — viewport %s, cell %d" % [size, cell])

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.11, 0.12, 0.16))
	for y in GRID:
		for x in GRID:
			var r := Rect2(origin + Vector2(x * cell, y * cell), Vector2(cell - 4, cell - 4))
			draw_rect(r, Color(0.22, 0.26, 0.34))
			draw_rect(r, Color(0.35, 0.42, 0.55), false, 2.0)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var t := event as InputEventScreenTouch
		if t.pressed:
			var gx := int((t.position.x - origin.x) / cell)
			var gy := int((t.position.y - origin.y) / cell)
			if gx >= 0 and gy >= 0 and gx < GRID and gy < GRID:
				print("tapped plot %d,%d" % [gx, gy])
				queue_redraw()
