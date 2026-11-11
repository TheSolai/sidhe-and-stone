class_name StoneBevel
extends StyleBox
## A chunky pixel bevel, drawn as a custom stylebox.
##
## The house look is a CHUNKY BEVEL: a light edge along the top and left, a
## dark edge along the bottom and right, a flat face, and a hard near-black
## outline. That is what makes a cream rectangle read as a physical object
## rather than as a spreadsheet cell.
##
## WHY A CUSTOM STYLEBOX AND NOT A Control SUBCLASS
##
## A Control that overrides _draw() paints OVER whatever the engine drew
## for it, so a Button subclass that fills its own rectangle hides the
## engine's own label. That was measured, not guessed. A StyleBox is
## different: the engine draws the stylebox FIRST and the label SECOND, so
## the bevel goes underneath the text and the text stays crisp and
## selectable by the engine.
##
## Everything here is drawn with hard integer rectangles and flat colours.
## There is no alpha, no gradient and no anti-aliased edge, so every pixel
## on screen is a colour the shared palette actually contains.

## The flat face of the control.
var face: Color = Color("e8dcc5")
## The highlight along the top and left edges.
var light: Color = Color("f7f2e3")
## The shadow along the bottom and right edges.
var dark: Color = Color("46382a")
## The hard outline.
var ink: Color = Color("1e1a16")
## How thick the light/dark bevel is, in pixels.
var bevel: int = 2
## How thick the near-black outline is, in pixels.
var outline: int = 1
## Optional corner radius. Zero for the house style; a pill for a header.
var radius: int = 0
## When true the light and dark edges swap, so the control reads as SUNKEN
## rather than raised. This is what a pressed button looks like.
var sunken: bool = false


func _init() -> void:
	# The text sits inside the bevel, never on top of it.
	content_margin_left = 10
	content_margin_right = 10
	content_margin_top = 6
	content_margin_bottom = 6


## A copy of this bevel with different colours.
func with_face(fill: Color) -> StoneBevel:
	var b := duplicate() as StoneBevel
	b.face = fill
	return b


## A copy of this bevel, pressed: the bevel is inverted.
func pressed() -> StoneBevel:
	var b := duplicate() as StoneBevel
	b.sunken = true
	return b


## Godot 4.7 names the StyleBox virtual `_draw`, not `draw`.
## `draw` is a plain native method on StyleBox, so overriding THAT
## is never called by the engine -- and the compiler rejects it.
func _draw(to_canvas_item: RID, rect: Rect2) -> void:
	# Integer edges. A half-pixel bevel would smear across two pixels and
	# produce a colour the palette does not contain.
	var x0 := floorf(rect.position.x)
	var y0 := floorf(rect.position.y)
	var x1 := ceilf(rect.position.x + rect.size.x)
	var y1 := ceilf(rect.position.y + rect.size.y)
	var w := x1 - x0
	var h := y1 - y0
	if w <= 0.0 or h <= 0.0:
		return

	var o := float(outline)
	var b := float(bevel)
	var hi := light
	var lo := dark
	if sunken:
		hi = dark
		lo = light

	# The face, first: everything else sits on top of it.
	RenderingServer.canvas_item_add_rect(to_canvas_item, Rect2(x0, y0, w, h), face)

	if radius > 0:
		# A pill is a different shape, so it is drawn as a rounded rect and
		# the bevel becomes a single hairline of ink instead.
		RenderingServer.canvas_item_add_rect(to_canvas_item, Rect2(x0, y0, w, o), ink)
		RenderingServer.canvas_item_add_rect(to_canvas_item, Rect2(x0, y1 - o, w, o), ink)
		RenderingServer.canvas_item_add_rect(to_canvas_item, Rect2(x0, y0, o, h), ink)
		RenderingServer.canvas_item_add_rect(to_canvas_item, Rect2(x1 - o, y0, o, h), ink)
		return

	# The highlight: top and left.
	RenderingServer.canvas_item_add_rect(to_canvas_item,
		Rect2(x0 + o, y0 + o, w - 2.0 * o, b), hi)
	RenderingServer.canvas_item_add_rect(to_canvas_item,
		Rect2(x0 + o, y0 + o, b, h - 2.0 * o), hi)

	# The shadow: bottom and right.
	RenderingServer.canvas_item_add_rect(to_canvas_item,
		Rect2(x0 + o, y1 - o - b, w - 2.0 * o, b), lo)
	RenderingServer.canvas_item_add_rect(to_canvas_item,
		Rect2(x1 - o - b, y0 + o, b, h - 2.0 * o), lo)

	# The outline, last, so it is never covered by the bevel.
	RenderingServer.canvas_item_add_rect(to_canvas_item, Rect2(x0, y0, w, o), ink)
	RenderingServer.canvas_item_add_rect(to_canvas_item, Rect2(x0, y1 - o, w, o), ink)
	RenderingServer.canvas_item_add_rect(to_canvas_item, Rect2(x0, y0, o, h), ink)
	RenderingServer.canvas_item_add_rect(to_canvas_item, Rect2(x1 - o, y0, o, h), ink)
