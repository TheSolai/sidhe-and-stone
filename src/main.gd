class_name GameUI
extends Control
## SIDHE & STONE - playable vertical slice UI.
##
## Built entirely in code so the layout stays consistent and the scene file
## stays trivial. Everything here is a THIN view over GameState: the UI reads
## state, calls an action, and refreshes. It never mutates the economy
## directly, which is what keeps the balance the harness proves and the
## balance the player feels the same numbers.
##
## Layout, portrait, one thumb:
##   [ top bar:  day | charm + demand | money ]
##   [ milestone card: the next goal and how close it is ]
##   [ FATE REEL: three windows, the spin, the odds ]
##   [ scrolling content: the six screens ]
##   [ bottom bar: utility | destinations | End Day ]
##
## The reel strip is deliberately NOT a tab. A luck mechanic the player has to
## go looking for is a luck mechanic they will forget exists.
##
## The house rules, learned from a study of the reference games and written
## up in design/GUI_REFERENCE_NOTES.md:
##
##   - every resource is an icon plus a naked number. The icon names the
##     thing; the number is the value. Never a bare word, never a unit.
##   - money is the biggest number on the top bar and it sits hard right.
##   - every raised surface is a chunky bevel: light on the top and left,
##     dark on the bottom and right, flat face, hard near-black outline.
##   - every tappable thing is at least 44x44.
##   - one accent colour per screen, used to say "this is the important
##     thing", never to decorate.
##   - multipliers are written x1.5: lowercase x, no space.

## The shared palette, mirrored from art/palette.px.js.
##
## The interface is CREAM PAPER with gold and rust accents, not a dark
## room. Every colour below comes from the one shared palette, so the
## artwork and the interface cannot drift apart. The names are ROLES:
## each one says what the colour is FOR, and the same role has the same
## colour in the web build.
const COL_GROUND := Color("d6d4c8")   ## X - the page behind the panels
const COL_PANEL := Color("e8dcc5")    ## C - panel surface
const COL_CARD := Color("f7f2e3")     ## W - raised card surface
const COL_WELL := Color("f7f2e3")     ## W - recessed well (reel windows)
const COL_LINE := Color("1e1a16")     ## K - the 1px near-black outline
const COL_K := Color("1e1a16")        ## K - outline, and the veil
const COL_TEXT := Color("362a21")     ## D - body text on cream
const COL_DIM := Color("716855")      ## N - secondary text on cream
const COL_GOLD := Color("dda742")     ## Y - gold fill: bars, buttons, rules
const COL_GOLD_INK := Color("e5b63d") ## G - gilt, on a dark ground only
const COL_MOSS := Color("82a156")     ## M - good news
const COL_RUST := Color("c3613d")     ## T - bad news
const COL_SLATE := Color("8896a3")    ## U - neutral metal

## P - secondary text. N is legal on paper white ONLY, so wherever the
## surface is cream (C) or parchment (X) the dim text uses this instead.
const COL_DIM_P := Color("46382a")

## The palette's own KEY names, for the places that need to speak about
## the shared palette rather than about a role. These are the SAME
## palette the sprite files and the web build use, spelled the way they
## spell it: D 362a21, P 46382a, W f7f2e3, Y dda742. Nothing here is a
## new colour; it is the same palette under a second name.
const COL_D := Color("362a21")       ## D - deep shadow, body ink
const COL_P := Color("46382a")       ## P - panel edge, secondary ink
const COL_W := Color("f7f2e3")       ## W - paper white, highlight
const COL_Y := Color("dda742")       ## Y - ochre

## The colour of each grade. Each grade owns a hue so a shelf reads at
## a glance. These are the identity colours from art/ART_DIRECTION.md,
## and they match what each artefact sprite is actually made of.
const GRADE_COL := {
	"rubble": Color("aca496"),
	"clay": Color("b98053"),
	"tablet": Color("8896a3"),
	"relic": Color("5f9f90"),
	"mask": Color("c3613d"),
	"crown": Color("e5b63d"),
}

## Richest first. Mirrors SimCore.GRADE_ORDER - the order decides what
## visitors pay for first, so it must not drift from the simulation.
const GRADE_ORDER := ["crown", "mask", "relic", "tablet", "clay", "rubble"]

## The colour of each dig type. Mirrors DIG_COLOR in the web build: a dig
## is identified by a band of colour, and the name is always written out,
## so the colour never carries the meaning on its own.
const DIG_COL := {
	"test_pit": Color("8896a3"),
	"trench": Color("c69a6b"),
	"cutting": Color("82a156"),
	"shaft": Color("b98053"),
	"deepworks": Color("dda742"),
}

## Every dig the player can assign, in the canonical order. Mirrors
## GameState.DIG_TYPES - the Godot UI must offer every dig the
## simulation accepts, or two of them are unreachable in this build.
const DIG_ORDER := ["test_pit", "trench", "cutting", "shaft", "deepworks"]

## Generated pixel art lives in assets/sprites. Every one of these was drawn
## as code with pxl - which means it IS the pixel grid, with binary alpha and
## a fixed palette - and checked against a rendered ASCII grid before it was
## allowed near the UI. See ai/regen_sprites.py for the reproducible build.
const SPRITE_DIR := "res://assets/sprites/"

const GRADE_SPRITE := {
	"crown": "artefact_crown",
	"mask": "artefact_mask",
	"relic": "artefact_relic",
	"tablet": "artefact_tablet",
	"clay": "artefact_clay",
	"rubble": "artefact_rubble",
}

## The reel symbols. They are drawn as MOTIFS, never as font glyphs,
## so the name here is only a label for the odds table.
const SYMBOL_STYLE := {
	"clover": {"col": Color("82a156"), "name": "Clover"},
	"honey": {"col": Color("dda742"), "name": "Honey"},
	"moon": {"col": Color("a8e8ef"), "name": "Moon"},
	"star": {"col": Color("e5b63d"), "name": "Star"},
	"bog": {"col": Color("716855"), "name": "Bog"},
	"blight": {"col": Color("c3613d"), "name": "Blight"},
}

const SYMBOL_ORDER := ["clover", "honey", "moon", "star", "bog", "blight"]

## The drawn motif for each reel symbol.
##
## These are hand-drawn sprites, never font glyphs. A glyph has no silhouette
## of its own, so a reel full of them reads as a row of emoji rather than as
## objects turning on a wheel. Each symbol is a real 16x16 drawing in the
## shared palette, so it sits in the same world as the rest of the game.
const SYMBOL_SPRITE := {
	"clover": "symbol_clover",
	"honey": "symbol_honey",
	"moon": "symbol_moon",
	"star": "symbol_star",
	"bog": "symbol_bog",
	"blight": "symbol_blight",
}

## When each reel stops, in seconds. A slot machine lands one reel at a time,
## and that stagger is the whole difference between three reels and one wheel
## faking three.
const REEL_STOP_TIMES := [0.55, 0.72, 0.90]

## The BOTTOM BAR: five destinations, each with a drawn icon.
##
## The icon comes FIRST and the label follows, which is the convention the
## reference UI uses, and the count follows the reference too: three to five
## destinations, never six. The game has six screens, so the two artefact
## screens - what is on display and what is in the vault - share ONE
## destination, "Collection", and switch between the two halves with a
## segmented control inside the screen. Five destinations, six screens, and
## exactly one destination lit at a time.
##
## Every one of these is an 18x18 sprite, so the icons in the row are all
## the same size. A row of mixed 18 and 26 pixel icons reads as a mistake,
## and the icon is drawn before the label in every case.
const TABS := [
	{"label": "Collection", "icon": "upgrade_gallery", "tab": 0},
	{"label": "Digs", "icon": "upgrade_site", "tab": 2},
	{"label": "Staff", "icon": "curator", "tab": 3},
	{"label": "Goals", "icon": "symbol_star", "tab": 4},
	{"label": "Ledger", "icon": "artefact_coin", "tab": 5},
]

## Which destination lights up for which screen. The gallery and the vault
## are both the Collection destination, so both light the same button.
const TAB_TO_DEST := {0: 0, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4}

var state := GameState.new()

# --- reel animation state
var _spin_active := false
var _spin_t := 0.0
var _spin_result := {}
var _spin_revealed := false
var _spin_cycle := 0

# --- nodes
var _lbl_day: Label
var _lbl_money: Label
var _lbl_charms: Label
var _lbl_demand: Label
var _lbl_luck: Label
var _reel_icons: Array[TextureRect] = []
var _lbl_payout: Label
var _btn_spin: Button
var _lbl_status: Label
var _content: VBoxContainer
var _tab_buttons: Array[Button] = []
var _current_tab := 0
var _table_panel: PanelContainer
var _btn_table: Button
var _overlay: Control
var _btn_new: Button
var _new_armed := false
var _lbl_goal: Label
var _lbl_goal_sub: Label
var _bar_goal: ProgressBar

var _chip_money: ColorRect
var _chip_status: ColorRect
var _chip_goal: ColorRect
var _odds_body: VBoxContainer


func _ready() -> void:
	state.changed.connect(_on_state_changed)
	state.tutorial_advanced.connect(_on_state_changed)
	_build_ui()
	_refresh()


## Save the game to disk. Called after every day so a crash never costs more
## than the current night.
func _autosave() -> void:
	state.save_to_disk()


# ---------------------------------------------------------------- build

func _build_ui() -> void:

	# The ONE theme, applied to the root, so every button, scrollbar and
	# progress track in the tree is styled from the shared palette instead of
	# Godot's default dark grey.
	theme = StoneTheme.build()
	set_anchors_preset(Control.PRESET_FULL_RECT)

	var bg := ColorRect.new()
	bg.color = COL_GROUND
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)

	var root := VBoxContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_theme_constant_override("separation", 0)
	add_child(root)

	root.add_child(_build_topbar())
	root.add_child(_build_milestone_card())
	root.add_child(_build_reel_zone())

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	# The scrollbar is HIDDEN, but the list still scrolls. A scrollbar is a
	# desktop affordance; on a phone the list just runs off the bottom edge
	# and you can tell that there is more by seeing that it has not stopped.
	# SHOW_NEVER hides the bar and keeps the scroll - DISABLED would take
	# the long screens (the goals ladder, the ledger) away entirely.
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	root.add_child(scroll)

	var pad := MarginContainer.new()
	# The pad must EXPAND to the scroll's width. Without the expand flag a
	# ScrollContainer hands its child only the child's MINIMUM width, so the
	# whole ladder collapsed to 86px and every wrapped label inside it was
	# forced to break one letter per line.
	pad.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pad.add_theme_constant_override("margin_left", 10)
	pad.add_theme_constant_override("margin_right", 10)
	pad.add_theme_constant_override("margin_top", 8)
	pad.add_theme_constant_override("margin_bottom", 10)
	scroll.add_child(pad)

	_content = VBoxContainer.new()
	_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content.add_theme_constant_override("separation", 8)
	pad.add_child(_content)

	root.add_child(_build_bottombar())

	# The overlay layer sits above everything and carries modal panels:
	# the end-of-day report, and the confirm for starting a new game.
	_overlay = Control.new()
	_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_overlay)


## The top bar: the day on the left, the resources in the middle, and the
## money hard on the right.
##
## The order is not decoration. Money is the number the player is playing
## for, so it gets the biggest type and the hardest right edge, and
## everything else is an icon and a number at a size that lets the money
## win.
func _build_topbar() -> Control:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", StoneKit.bevel(COL_PANEL, COL_K))

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	panel.add_child(row)

	_lbl_day = StoneKit.tight("Day 1", COL_TEXT, StoneTheme.FS_MID)
	row.add_child(_lbl_day)

	# Two expanding gaps around the middle group, so the resources sit in
	# the middle of the bar rather than drifting left next to the day.
	var gap1 := Control.new()
	gap1.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(gap1)

	# Charms: the drawn charm carries the resource, the number stays in text.
	var charm_box := HBoxContainer.new()
	charm_box.add_theme_constant_override("separation", 3)
	charm_box.add_child(StoneKit.icon("icon_charm", 18))
	_lbl_charms = StoneKit.tight("6", COL_TEXT, 16)
	charm_box.add_child(_lbl_charms)
	row.add_child(charm_box)

	# Demand: how many exhibits pay today. Icon plus number, no word.
	var demand_box := HBoxContainer.new()
	demand_box.add_theme_constant_override("separation", 3)
	demand_box.add_child(StoneKit.icon("icon_demand", 18))
	_lbl_demand = StoneKit.tight("0", COL_TEXT, 16)
	demand_box.add_child(_lbl_demand)
	row.add_child(demand_box)

	var gap2 := Control.new()
	gap2.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(gap2)

	# Money. The coin names it, the number is naked, and it is the largest
	# number on the bar.
	var money_box := HBoxContainer.new()
	money_box.add_theme_constant_override("separation", 3)
	money_box.add_child(StoneKit.icon("icon_coin", 20))
	_lbl_money = StoneKit.tight("£240", COL_TEXT, 20)
	money_box.add_child(_lbl_money)
	# Negative money is bad news: a rust CHIP says so, the text stays dark.
	_chip_money = StoneKit.chip(COL_RUST)
	_chip_money.visible = false
	money_box.add_child(_chip_money)
	row.add_child(money_box)

	return panel


## The milestone card: the next goal on the ladder and how close it is.
##
## This used to live inside the top bar as a third strip of chips, which is
## what turned the bar into a wall. It is its own card now, directly under
## the bar, so it is still always on screen - a management game where the
## next goal lives on a tab the player has to go and find is a game that
## feels endless - without crowding the numbers.
##
## The title and the description are SEPARATE labels, both full width. They
## used to be one autowrapping label inside a horizontal row, and that
## clipped: a wrapping Label cannot know its height until its width is
## known, and a horizontal container allocates height BEFORE width is
## resolved. The second line was simply cut off.
func _build_milestone_card() -> Control:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", StoneKit.bevel(COL_CARD, COL_K))

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 3)
	panel.add_child(col)

	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 6)
	col.add_child(head)

	head.add_child(StoneKit.tight("NEXT GOAL", COL_DIM_P, StoneTheme.FS_TINY))
	# Good news about the ladder: a moss chip, never moss TEXT.
	_chip_goal = StoneKit.chip(COL_MOSS)
	_chip_goal.visible = false
	head.add_child(_chip_goal)

	_lbl_goal = StoneKit.label("", COL_TEXT, 14)
	col.add_child(_lbl_goal)

	_lbl_goal_sub = StoneKit.label("", COL_DIM_P, 12)
	col.add_child(_lbl_goal_sub)

	_bar_goal = StoneKit.bar(0.0, COL_GOLD, 6)
	col.add_child(_bar_goal)
	return panel


## The Fate Reel: three windows, the spin button, and the odds.
##
## This is the loudest thing on the screen and it is allowed to be - the
## reel is the one moment where the player is watching something happen.
## The spin button sits right next to the windows so the finger does not
## have to travel.
func _build_reel_zone() -> Control:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", StoneKit.bevel(COL_CARD, COL_K))

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	panel.add_child(col)

	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 6)
	col.add_child(head)

	head.add_child(StoneKit.tight("FATE REEL", COL_TEXT, StoneTheme.FS_BODY))
	head.add_child(StoneKit.icon("reel_wheel", 20))

	# The multiplier is written as a number, never as a chip and never as a
	# percentage: x1.5, lowercase x, no space. It lives here, in the panel
	# that shows what the reel is about to do to today's takings, which is
	# where the boosted value is compared.
	_lbl_payout = StoneKit.tight("x1.0", COL_TEXT, StoneTheme.FS_MID)
	head.add_child(_lbl_payout)

	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(sp)

	# Luck lives with the reel, because luck is what the reel reads. It was
	# in the top bar, where it was a word with no meaning next to two
	# numbers that had icons.
	_lbl_luck = StoneKit.tight("Luck 0.0", COL_DIM_P, StoneTheme.FS_SMALL)
	head.add_child(_lbl_luck)

	_btn_table = StoneKit.small_button("Odds", _toggle_table, COL_CARD, COL_K)
	head.add_child(_btn_table)

	# The three reel windows, in a row, with the spin button beside them.
	var reels_row := HBoxContainer.new()
	reels_row.add_theme_constant_override("separation", 6)
	col.add_child(reels_row)

	var reels := HBoxContainer.new()
	reels.add_theme_constant_override("separation", 6)
	reels.alignment = BoxContainer.ALIGNMENT_CENTER
	reels_row.add_child(reels)

	for _i in 3:
		# A WINDOW, not a card: the face is the parchment well and the bevel
		# is inverted, so the symbol sits down inside the machine.
		var cell := PanelContainer.new()
		cell.custom_minimum_size = Vector2(64, 64)
		var well := StoneKit.bevel(COL_WELL, COL_K)
		well.light = COL_W
		well.dark = COL_P
		well.sunken = true
		cell.add_theme_stylebox_override("panel", well)
		# The drawn motif, centred in the window. The texture is 18px with
		# the symbol filling it, so it is shown at 2x - a whole-pixel
		# multiple, so nothing is resampled and nothing blurs.
		var icon := TextureRect.new()
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		icon.custom_minimum_size = Vector2(36, 36)
		icon.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		cell.add_child(icon)
		reels.add_child(cell)
		_reel_icons.append(icon)

	_btn_spin = StoneKit.button("Spin", _on_spin_pressed, COL_GOLD, COL_K)
	_btn_spin.add_theme_font_size_override("font_size", StoneTheme.FS_MID)
	_btn_spin.custom_minimum_size = Vector2(96, 56)
	# The charm sprite, drawn, never a font glyph.
	var charm_tex_path := SPRITE_DIR + "icon_charm.png"
	if ResourceLoader.exists(charm_tex_path):
		_btn_spin.icon = load(charm_tex_path)
		_btn_spin.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		_btn_spin.add_theme_constant_override("h_separation", 4)
	reels_row.add_child(_btn_spin)

	# Status is a single line of dark text with a chip beside it. The chip
	# carries good news (moss) or bad news (rust); the words carry the fact.
	var status_row := HBoxContainer.new()
	status_row.add_theme_constant_override("separation", 6)
	col.add_child(status_row)

	_chip_status = StoneKit.chip(COL_MOSS)
	_chip_status.visible = false
	status_row.add_child(_chip_status)

	_lbl_status = StoneKit.label("", COL_TEXT, StoneTheme.FS_SMALL)
	status_row.add_child(_lbl_status)

	_table_panel = _build_odds_table()
	_table_panel.visible = false
	col.add_child(_table_panel)

	return panel


func _build_odds_table() -> PanelContainer:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", StoneKit.bevel(COL_PANEL, COL_K))

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	panel.add_child(col)

	col.add_child(StoneKit.panel_header("What the wheel shows"))

	# The rows are rebuilt whenever the state refreshes, because the weights
	# move with luck and a stale percentage is worse than no percentage.
	_odds_body = VBoxContainer.new()
	_odds_body.add_theme_constant_override("separation", 4)
	col.add_child(_odds_body)
	_rebuild_odds_body()

	var ev := StoneKit.label("EV now %.3f   -   a miss still pays x1.0" % state.sim.reel.expected_value(),
		COL_DIM_P, 12)
	col.add_child(ev)
	return panel


## One row of the odds table: the drawn motif, the name, the multiplier,
## the weight-derived percentage, and a bar whose fill is the share.
##
## The bar is a FILL, so the symbol colour is legal there. The numbers stay
## in dark ink, because a coloured number on cream is not.
func _rebuild_odds_body() -> void:
	if _odds_body == null:
		return
	for c in _odds_body.get_children():
		_odds_body.remove_child(c)
		c.queue_free()

	var weights: Dictionary = state.sim.reel.weights()
	var total := 0.0
	for s in SYMBOL_ORDER:
		total += float(weights.get(s, 0.0))

	for s in SYMBOL_ORDER:
		var st: Dictionary = SYMBOL_STYLE[s]
		var sym_col: Color = st["col"]
		var share := 0.0
		if total > 0.0:
			share = float(weights.get(s, 0.0)) / total

		var row := VBoxContainer.new()
		row.add_theme_constant_override("separation", 2)
		_odds_body.add_child(row)

		var line := HBoxContainer.new()
		line.add_theme_constant_override("separation", 8)
		row.add_child(line)

		line.add_child(StoneKit.icon(SYMBOL_SPRITE[s], 18))

		var nm := StoneKit.tight(str(st["name"]), COL_TEXT, StoneTheme.FS_SMALL)
		nm.custom_minimum_size = Vector2(64, 0)
		line.add_child(nm)

		var mult := StoneKit.tight(_mult_text(float(ReelCore.SYMBOLS[s]["mult"])), COL_TEXT, StoneTheme.FS_SMALL)
		mult.custom_minimum_size = Vector2(42, 0)
		line.add_child(mult)

		var pct := StoneKit.tight("%.1f%%" % (share * 100.0), COL_DIM_P, StoneTheme.FS_SMALL)
		pct.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		pct.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		line.add_child(pct)

		# The probability bar. The fill is the symbol's own colour.
		row.add_child(StoneKit.bar(share, sym_col, 6))


## The bottom bar: utility on the left, the six destinations, and the
## advance action on the right.
##
## The reference UI never uses one full-width button at the bottom of the
## screen - it uses two or three discrete buttons, with the advance action
## at the far right. That is what this does. "End Day" is not full width;
## it sits in the right-hand corner where the thumb already is.
func _build_bottombar() -> Control:
	# A divider rule separates the bar from the content, so the content
	# behind it is never mistaken for part of the bar.
	var rule := ColorRect.new()
	rule.color = COL_K
	rule.custom_minimum_size = Vector2(0, 2)
	rule.mouse_filter = Control.MOUSE_FILTER_IGNORE

	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", StoneKit.bevel(COL_PANEL, COL_K))

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)
	panel.add_child(col)

	# --- the destinations.
	var nav := HBoxContainer.new()
	nav.add_theme_constant_override("separation", 4)
	col.add_child(nav)

	for i in TABS.size():
		var entry: Dictionary = TABS[i]
		var b := StoneKit.nav_button(str(entry["label"]), str(entry["icon"]),
			_select_tab.bind(int(entry["tab"])))
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		nav.add_child(b)
		_tab_buttons.append(b)

	# --- utility on the left, the advance action on the right.
	var action_row := HBoxContainer.new()
	action_row.add_theme_constant_override("separation", 6)
	col.add_child(action_row)

	_btn_new = StoneKit.small_button("New Game", _on_new_pressed, COL_CARD, COL_RUST)
	action_row.add_child(_btn_new)

	var b_save := StoneKit.small_button("Save", _on_save_pressed, COL_CARD, COL_K)
	action_row.add_child(b_save)

	var b_load := StoneKit.small_button("Load", _on_load_pressed, COL_CARD, COL_K)
	b_load.disabled = not GameState.has_save()
	action_row.add_child(b_load)

	var gap := Control.new()
	gap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	action_row.add_child(gap)

	# The one warm call to action. It is bigger than everything else in the
	# bar, it is not full width, and it is on the right.
	var end := StoneKit.button("End Day", _on_end_day, COL_GOLD, COL_K)
	end.add_theme_font_size_override("font_size", StoneTheme.FS_MID)
	end.custom_minimum_size = Vector2(132, 48)
	action_row.add_child(end)

	var holder := VBoxContainer.new()
	holder.add_theme_constant_override("separation", 0)
	holder.add_child(rule)
	holder.add_child(panel)
	return holder


# ---------------------------------------------------------------- refresh

func _on_state_changed() -> void:
	_refresh()


func _refresh() -> void:
	# sim.day counts COMPLETED days, so the day being played is one more.
	# Without this a new player is greeted with "Day 0".

	_lbl_day.text = "Day %d" % (state.day() + 1)
	_lbl_money.text = _money(state.money())
	_lbl_money.add_theme_color_override("font_color", COL_TEXT)
	_chip_money.visible = state.money() < 0
	_lbl_charms.text = "%d" % state.charms()
	_lbl_demand.text = "%d" % state.demand()
	_lbl_luck.text = "Luck %.1f" % state.luck()

	var pending := state.pending_payout()
	# The neutral payout is x1.0. Anything else is shown as it is, bad news
	# included: a triple blight really does pay x0.85, and hiding that
	# behind a floor of 1.0 would lie to the player.
	_lbl_payout.text = _mult_text(pending if pending > 0.0 else 1.0)

	_btn_spin.disabled = not state.can_spin() or _spin_active
	_btn_spin.text = "Spin"
	_btn_spin.tooltip_text = "Spin the wheel (%d charm)" % state.charm_cost()

	# The milestone strip: the next goal on the ladder and how close it is.
	var ng := state.next_goal()
	if ng.is_empty():
		_lbl_goal.text = "Every milestone earned. The gallery is yours."
		_lbl_goal.add_theme_color_override("font_color", COL_TEXT)
		_lbl_goal_sub.text = ""
		_bar_goal.value = 1.0
		_chip_goal.visible = true
	else:
		var g: Dictionary = ng["goal"]
		_lbl_goal.text = str(g["title"])
		_lbl_goal.add_theme_color_override("font_color", COL_TEXT)
		_lbl_goal_sub.text = "%s   (%d/%d)" % [str(g["body"]),
			int(ng["progress"]), int(ng["target"])]
		_bar_goal.value = clampf(float(ng["progress"]) / maxf(1.0, float(ng["target"])), 0.0, 1.0)
		_chip_goal.visible = false

	_style_tabs()

	# The odds table shows live weights, so it is rebuilt on every refresh.
	if _odds_body != null:
		_rebuild_odds_body()
	_rebuild_content()


## The current screen is the only lit destination.
##
## The reference UI has NO active state at all, which is the one place this
## interface deliberately diverges: a bottom bar where nothing says where
## you are is a bottom bar you have to read to use. Exactly one destination
## is lit, and it is lit with the single accent colour on this screen.
func _style_tabs() -> void:
	var lit := int(TAB_TO_DEST.get(_current_tab, 0))
	for i in _tab_buttons.size():
		var b := _tab_buttons[i]
		var active := (i == lit)
		var s := StoneKit.nav_style(active)
		b.add_theme_stylebox_override("normal", s)
		b.add_theme_stylebox_override("hover", s)
		b.add_theme_stylebox_override("pressed", s)
		b.add_theme_stylebox_override("disabled", s)
		b.add_theme_color_override("font_color", COL_K if active else COL_D)
		b.add_theme_color_override("font_hover_color", COL_K)
		b.add_theme_color_override("font_pressed_color", COL_K)


func _rebuild_content() -> void:
	for c in _content.get_children():
		_content.remove_child(c)
		c.queue_free()

	# The coach sits above everything, because it is the thing the player
	# most needs until they have done it once.
	_build_tutorial_card()

	# The gallery and the vault are two halves of one destination, so they
	# share one screen with a switch at the top of it.
	if _current_tab == 0 or _current_tab == 1:
		_build_collection_switch()

	match _current_tab:
		0: _build_gallery_tab()
		1: _build_vault_tab()
		2: _build_digs_tab()
		3: _build_staff_tab()
		4: _build_goals_tab()
		5: _build_ledger_tab()


## The switch between the two halves of the Collection destination.
##
## Two buttons, one lit. It is the same active-state convention as the
## bottom bar - exactly one of the pair is lit - so the player reads the
## screen the same way everywhere.
func _build_collection_switch() -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	_content.add_child(row)

	for entry in [["Gallery", 0], ["Vault", 1]]:
		var label := str(entry[0])
		var tab := int(entry[1])
		var b := StoneKit.small_button(label, _select_tab.bind(tab),
			COL_CARD if tab == _current_tab else COL_PANEL, COL_K)
		if tab == _current_tab:
			b.add_theme_stylebox_override("normal", StoneKit.bevel(COL_Y, COL_K))
			b.add_theme_stylebox_override("hover", StoneKit.bevel(COL_Y, COL_K))
			b.add_theme_stylebox_override("pressed", StoneKit.bevel(COL_Y, COL_K).pressed())
		row.add_child(b)

	var gap := Control.new()
	gap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(gap)


# ---------------------------------------------------------------- gallery

func _build_gallery_tab() -> void:
	_content.add_child(StoneKit.section("The Gallery"))
	_content.add_child(_event_banner(state.today_event()))

	var gallery := state.gallery_counts()
	var paying := state.paying_split()
	var any := false
	for grade in GRADE_ORDER:
		var n := int(gallery.get(grade, 0))
		if n <= 0:
			continue
		any = true

		var card := StoneKit.card(COL_K)
		var col := StoneKit.card_col(card)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		col.add_child(row)

		# The identity colour of the grade is a block at the leading edge.
		row.add_child(StoneKit.row_block(GRADE_COL[grade], 4))
		row.add_child(StoneKit.icon(GRADE_SPRITE[grade], 18))
		# The grade colour lives in the sprite and in the block. The NAME is
		# written out, so colour is never the only meaning.
		var name_label := StoneKit.tight("%s x%d" % [grade.capitalize(), n], COL_TEXT, StoneTheme.FS_MID)
		row.add_child(name_label)
		row.add_child(StoneKit.spacer(8, 0))
		row.add_child(StoneKit.tight("£%d/day" % state.exhibit_value(grade), COL_DIM_P, StoneTheme.FS_SMALL))
		var sp := Control.new()
		sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(sp)
		var b := StoneKit.small_button("To Vault", func(): state.vault_one(grade))
		row.add_child(b)

		# The second line is the game's central decision, made legible.
		# Two facts the player needs at the moment they decide whether to
		# risk an exhibit: how much of it actually earns, and how likely it
		# is to be stolen tonight. "2 stolen" after the fact tells them
		# nothing they can act on; this does.
		var earning := int(paying.get(grade, 0))
		var bits: Array[String] = []
		if earning < n:
			bits.append("%d earning - %d over the cap" % [earning, n - earning])
		else:
			bits.append("%d earning" % earning)
		var risk := state.theft_chance(grade)
		bits.append("%.1f%% theft risk" % (risk * 100.0))

		# Risk is good-or-bad news, so it gets a CHIP, not coloured text.
		var warned: bool = earning < n or risk > 0.07
		var risk_row := HBoxContainer.new()
		risk_row.add_theme_constant_override("separation", 6)
		if warned:
			risk_row.add_child(StoneKit.chip(COL_RUST))
		risk_row.add_child(StoneKit.tight(" - ".join(bits),
			COL_TEXT if warned else COL_DIM_P, 12))
		col.add_child(risk_row)

		_content.add_child(card)

	if not any:
		_content.add_child(StoneKit.label("The gallery is empty. Move something up from the vault.",
			COL_DIM_P, StoneTheme.FS_SMALL))

	_content.add_child(StoneKit.spacer(0, 4))
	_content.add_child(StoneKit.section("Today"))

	# A status row: icon plus naked number, no words.
	var stats := HBoxContainer.new()
	stats.add_theme_constant_override("separation", 12)
	_content.add_child(stats)

	stats.add_child(StoneKit.icon("icon_demand", 18))
	stats.add_child(StoneKit.tight("%d" % state.demand(), COL_TEXT, 16))
	stats.add_child(StoneKit.tight("paying", COL_DIM_P, 12))

	stats.add_child(StoneKit.icon("icon_coin", 18))
	stats.add_child(StoneKit.tight("%d" % state.upkeep(), COL_TEXT, 16))
	stats.add_child(StoneKit.tight("upkeep", COL_DIM_P, 12))

	stats.add_child(StoneKit.icon("icon_charm", 18))
	stats.add_child(StoneKit.tight("%d" % state.raw_count(), COL_TEXT, 16))
	stats.add_child(StoneKit.tight("waiting", COL_DIM_P, 12))

	# The cases and the visitors, because a museum with people in it reads
	# as a place rather than as a spreadsheet.
	var case_row := HBoxContainer.new()
	case_row.add_theme_constant_override("separation", 8)
	_content.add_child(case_row)
	case_row.add_child(StoneKit.icon("gallery_case", 26))
	case_row.add_child(StoneKit.icon("visitor_a", 18))
	case_row.add_child(StoneKit.icon("visitor_b", 18))
	case_row.add_child(StoneKit.icon("visitor_c", 18))
	case_row.add_child(StoneKit.label("%d of %d slots used" %
		[state.on_display(), state.gallery_slots()], COL_DIM_P, StoneTheme.FS_SMALL))


# ---------------------------------------------------------------- vault

func _build_vault_tab() -> void:
	_content.add_child(StoneKit.section("The Vault"))

	var vault := state.vault_counts()
	var any := false
	for grade in GRADE_ORDER:
		var n := int(vault.get(grade, 0))
		if n <= 0:
			continue
		any = true

		var card := StoneKit.card(COL_K)
		var row := StoneKit.card_row(card)
		row.add_child(StoneKit.row_block(GRADE_COL[grade], 4))
		row.add_child(StoneKit.icon(GRADE_SPRITE[grade], 18))
		row.add_child(StoneKit.tight("%s x%d" % [grade.capitalize(), n], COL_TEXT, StoneTheme.FS_MID))
		row.add_child(StoneKit.spacer(8, 0))
		row.add_child(StoneKit.tight("£%d/day" % state.exhibit_value(grade), COL_DIM_P, StoneTheme.FS_SMALL))
		var sp := Control.new()
		sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(sp)

		var can_show := state.slots_free() > 0
		var show_btn := StoneKit.small_button("Display", func(): state.display_one(grade))
		show_btn.disabled = not can_show
		row.add_child(show_btn)

		var sell := StoneKit.small_button("Sell", func(): state.sell_one(grade))
		sell.add_theme_stylebox_override("normal", StoneKit.bevel(COL_CARD, COL_RUST))
		sell.add_theme_stylebox_override("hover", StoneKit.bevel(COL_W, COL_RUST))
		sell.add_theme_stylebox_override("pressed", StoneKit.bevel(COL_CARD, COL_RUST).pressed())
		row.add_child(sell)

		_content.add_child(card)

	if not any:
		_content.add_child(StoneKit.label("The vault is empty. Digs take days to complete.",
			COL_DIM_P, StoneTheme.FS_SMALL))
	else:
		_content.add_child(StoneKit.label(
			"Vaulted artefacts are safe from thieves but earn nothing. Selling gets half value, now.",
			COL_DIM_P, 12))


func _sell_one(grade: String) -> void:
	state.sell_one(grade)


# ---------------------------------------------------------------- digs

func _build_digs_tab() -> void:
	_content.add_child(StoneKit.section("Dig Sites"))

	if state.money() < 0:
		_content.add_child(StoneKit.label(
			"You are £%d in the red. The fairies will dig on credit, but the bank is patient, not generous."
			% absi(state.money()), COL_DIM_P, 12))

	for i in state.sites():
		var running := state.dig_in_progress(i)
		var card := StoneKit.card(COL_K)
		var col := StoneKit.card_col(card)

		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		col.add_child(row)
		row.add_child(StoneKit.row_block(DIG_COL.get(running.get("dig", ""), COL_SLATE), 4))
		row.add_child(StoneKit.icon("dig_site", 26))
		row.add_child(StoneKit.tight("Site %d" % (i + 1), COL_TEXT, StoneTheme.FS_MID))

		if not running.is_empty():
			var dig: String = running["dig"]
			var left := int(running["ready_day"]) - state.day()
			row.add_child(StoneKit.spacer(8, 0))
			# Progress is good news: a moss chip beside dark text.
			row.add_child(StoneKit.chip_label(COL_MOSS,
				"%s - %d day(s) left" % [_dig_name(dig), maxi(0, left)], StoneTheme.FS_BODY))
			_content.add_child(card)
			continue

		# The dig choices: a grid of chunky targets, each with its cost and
		# its duration under it.
		var grid := GridContainer.new()
		grid.columns = 3
		grid.add_theme_constant_override("h_separation", 6)
		grid.add_theme_constant_override("v_separation", 6)
		col.add_child(grid)

		for dig in DIG_ORDER:
			var cell := VBoxContainer.new()
			cell.add_theme_constant_override("separation", 1)
			cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			grid.add_child(cell)

			var b := StoneKit.button(_dig_name(dig),
				func(d = dig): state.assign_dig(i, d))
			b.add_theme_font_size_override("font_size", StoneTheme.FS_SMALL)
			b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			# Digs are allowed ON CREDIT. Blocking an unaffordable dig
			# would dead-end the game: broke, no finds, no exhibits, no
			# income, and nothing left to press. The debt is the
			# punishment, not a locked button.
			if state.money() < state.dig_cost(dig):
				# Unaffordable dig: the OUTLINE says so, not coloured text.
				b.add_theme_stylebox_override("normal", StoneKit.bevel(COL_CARD, COL_RUST))
				b.add_theme_stylebox_override("hover", StoneKit.bevel(COL_W, COL_RUST))
				b.add_theme_stylebox_override("pressed", StoneKit.bevel(COL_CARD, COL_RUST).pressed())
			cell.add_child(b)
			cell.add_child(StoneKit.tight("£%d - %dd" %
				[state.dig_cost(dig), state.dig_days(dig)], COL_DIM_P, StoneTheme.FS_TINY))

		var pending := state.pending_dig(i)
		if pending != "":
			col.add_child(StoneKit.chip_label(DIG_COL.get(pending, COL_DIM_P),
				"Assigned: %s" % _dig_name(pending), StoneTheme.FS_SMALL))

		_content.add_child(card)


func _dig_name(dig: String) -> String:
	match dig:
		"test_pit": return "Test Pit"
		"trench": return "Trench"
		"cutting": return "Cutting"
		"shaft": return "Shaft"
		"deepworks": return "Deepworks"
	return dig


# ---------------------------------------------------------------- staff

func _build_staff_tab() -> void:
	_content.add_child(StoneKit.section("Staff & Upgrades"))

	var rows := [
		["site", "New Dig Site", "upgrade_site", "More places to dig."],
		["curator", "Curator", "upgrade_curator", "Catalogues more finds per day."],
		["gallery", "Gallery Extension", "upgrade_gallery", "+2 slots and more visitors."],
		["omen", "Omen Reader", "upgrade_omen", "+0.10 luck on the reel."],
		["diggers", "Digger Fairies", "upgrade_diggers", "+6% finds from every dig."],
		["excavators", "Excavators", "upgrade_excavators", "-1 day on every dig."],
		["guides", "Guides", "upgrade_guides", "+1 visitor to the demand cap."],
		["archivists", "Archivists", "upgrade_archivists", "+8% value on every exhibit."],
		["wards", "Ward Fairies", "upgrade_wards", "Less chance of overnight theft."],
	]

	for r in rows:
		var kind: String = r[0]
		var cost := state.upgrade_cost(kind)
		var card := StoneKit.card(COL_K)
		var row := StoneKit.card_row(card)
		row.add_child(StoneKit.row_block(COL_SLATE, 4))
		row.add_child(StoneKit.icon(str(r[2]), 18))
		row.add_child(StoneKit.tight("%s x%d" % [str(r[1]), state.upgrade_count(kind)],
			COL_TEXT, 16))
		row.add_child(StoneKit.spacer(4, 0))
		row.add_child(StoneKit.tight(str(r[3]), COL_DIM_P, 12))

		var sp := Control.new()
		sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(sp)

		if cost < 0:
			row.add_child(StoneKit.tight("MAX", COL_DIM_P, 14))
		else:
			var b := StoneKit.small_button("£%d" % cost, func(): state.buy_upgrade(kind))
			b.disabled = state.money() < cost
			row.add_child(b)
		_content.add_child(card)


# ---------------------------------------------------------------- reel

func _on_spin_pressed() -> void:
	if _spin_active or not state.can_spin():
		return
	_spin_result = state.spin_reel()
	if _spin_result.is_empty():
		return
	_spin_active = true
	_spin_t = 0.0
	_spin_cycle = 0
	_spin_revealed = false
	_btn_spin.disabled = true
	for icon in _reel_icons:
		_set_reel_icon(icon, "")


func _process(delta: float) -> void:
	if not _spin_active:
		return
	_spin_t += delta
	var reels: Array = _spin_result["reels"]
	var all_stopped := true
	for i in _reel_icons.size():
		var stop_t: float = REEL_STOP_TIMES[i] if i < REEL_STOP_TIMES.size() else 0.9
		if _spin_t < stop_t:
			all_stopped = false
			# Each reel runs on its own phase. They used to blink in
			# lockstep - the same symbol in all three windows - which
			# read as one wheel pretending to be three.
			if fmod(_spin_t, 0.08) < delta:
				_spin_cycle += 1
				var phase := _spin_cycle + i * 2
				var s: String = SYMBOL_ORDER[phase % SYMBOL_ORDER.size()]
				_set_reel_icon(_reel_icons[i], s)
		else:
			# This reel has landed and locked in its result.
			var s: String = reels[i]
			_set_reel_icon(_reel_icons[i], s)
	if not all_stopped:
		return

	# Every reel has landed: reveal the real result.
	_spin_active = false
	_spin_revealed = true

	var payout := float(_spin_result["payout"])
	var pattern := str(_spin_result["pattern"])
	var msg := "The reel settles on %s." % _pattern_words(pattern, reels)
	if absf(payout - 1.0) > 0.001:
		msg += " %s on today's takings." % _mult_text(payout)
	else:
		msg += " A miss - still x1.0."

	_set_status(msg, COL_MOSS if payout > 1.0 else COL_RUST, payout != 1.0)

	_refresh()


func _pattern_words(pattern: String, reels: Array) -> String:
	if pattern == "triple":
		return "%s %s %s" % [SYMBOL_STYLE[reels[0]]["name"],
			SYMBOL_STYLE[reels[1]]["name"], SYMBOL_STYLE[reels[2]]["name"]]
	if pattern == "pair":
		var counts := {}
		for r in reels:
			counts[r] = int(counts.get(r, 0)) + 1
		for s in counts:
			if int(counts[s]) == 2:
				return "a pair of %s" % SYMBOL_STYLE[s]["name"]
	return "three different symbols"


func _toggle_table() -> void:
	_table_panel.visible = not _table_panel.visible


# ---------------------------------------------------------------- day

func _on_end_day() -> void:
	var s := state.end_day()
	var bits: Array[String] = []
	bits.append("Day %d" % int(s["day"]))
	bits.append("takings £%d" % int(s["revenue"]))
	if int(s["opex"]) > 0:
		bits.append("costs £%d" % int(s["opex"]))
	if int(s["stolen"]) > 0:
		bits.append("STOLEN: %d" % int(s["stolen"]))
	var delta := int(s["delta"])
	bits.append("net %s£%d" % ["+" if delta >= 0 else "-", absi(delta)])
	var ev := str(s["event"])
	if ev != "":
		bits.append(ev)

	_set_status("  -  ".join(bits), COL_TEXT, false)

	_autosave()
	_show_day_report(s)
	_refresh()


# ---------------------------------------------------------------- day report

## The end-of-day panel. This is the moment the player actually reads, so it
## says what happened in words, not just in numbers.
##
## It is a CENTRED modal over a dimmed backdrop, not a sheet that slides up
## from the bottom. The reference UI puts the panel in the middle of the
## screen with a strong single-colour border and a quiet interior, and that
## is what makes the report feel like a document rather than a notification.
func _show_day_report(s: Dictionary) -> void:
	_clear_overlay()

	_overlay.add_child(_veil())

	var centre := CenterContainer.new()
	centre.set_anchors_preset(Control.PRESET_FULL_RECT)
	_overlay.add_child(centre)

	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(620, 0)
	panel.add_theme_stylebox_override("panel", StoneKit.bevel(COL_CARD, COL_Y))
	centre.add_child(panel)

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	panel.add_child(col)

	# The header has its own shape, inside the frame.
	col.add_child(StoneKit.panel_header("Day %d" % int(s["day"])))

	var revenue := int(s["revenue"])
	var opex := int(s["opex"])
	var delta := int(s["delta"])

	# The rows alternate, so a column of numbers can be read across.
	col.add_child(StoneKit.stat_row("Takings", "£%d" % revenue, COL_GOLD, COL_CARD))
	if opex > 0:
		col.add_child(StoneKit.stat_row("Upkeep & dig costs", "-£%d" % opex, COL_DIM_P, COL_CARD))
	if int(s["capex"]) > 0:
		col.add_child(StoneKit.stat_row("Invested", "-£%d" % int(s["capex"]), COL_SLATE, COL_CARD))
	col.add_child(StoneKit.stat_row("Net", "%s£%d" % ["+" if delta >= 0 else "-", absi(delta)],
		COL_MOSS if delta >= 0 else COL_RUST, COL_PANEL))

	var payout := float(s["payout"])
	if absf(payout - 1.0) > 0.001:
		col.add_child(StoneKit.stat_row("Fate Reel", _mult_text(payout),
			COL_MOSS if payout > 1.0 else COL_RUST, COL_PANEL))

	var curated := int(s["curated"])
	if curated > 0:
		col.add_child(StoneKit.stat_row("Catalogued", "%d" % curated, COL_DIM_P, COL_CARD))

	if int(s["digs_done"]) > 0:
		col.add_child(StoneKit.stat_row("Digs finished", "%d" % int(s["digs_done"]), COL_DIM_P, COL_CARD))

	var stolen := int(s["stolen"])
	if stolen > 0:
		var grades: Dictionary = s["stolen_grades"]
		var named: Array[String] = []
		for g in GRADE_ORDER:
			var n := int(grades.get(g, 0))
			if n > 0:
				named.append("%d %s" % [n, g])
		col.add_child(StoneKit.stat_row("STOLEN", ", ".join(named), COL_RUST, COL_PANEL))

	if int(s["raw_after"]) > 0:
		col.add_child(StoneKit.stat_row("Storeroom", "%d waiting" % int(s["raw_after"]), COL_DIM_P, COL_CARD))

	# The day's event, named in the report so the player can connect the
	# numbers to the cause. "Takings £40" means nothing on its own;
	# "Fair Day" and "Takings £40" means something.
	var day_ev: Dictionary = s.get("day_event", {})
	if not day_ev.is_empty():
		col.add_child(StoneKit.spacer(0, 2))
		col.add_child(_event_banner(day_ev))

	# The footer action row.
	col.add_child(StoneKit.spacer(0, 4))
	var ok := StoneKit.button("Continue", func(): _clear_overlay(), COL_GOLD, COL_K)
	ok.add_theme_font_size_override("font_size", StoneTheme.FS_MID)
	ok.custom_minimum_size = Vector2(0, 48)
	col.add_child(ok)


func _clear_overlay() -> void:
	for c in _overlay.get_children():
		_overlay.remove_child(c)
		c.queue_free()


# ---------------------------------------------------------------- tutorial

## The coach card. It sits at the top of the content area and advances when
## the player performs the action, so it never nags about a thing they have
## already done.
func _build_tutorial_card() -> void:
	if not state.tutorial.active():
		return
	var card := StoneKit.card(COL_Y)
	var col := StoneKit.card_col(card)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	col.add_child(row)
	row.add_child(StoneKit.row_block(COL_Y, 4))
	row.add_child(StoneKit.icon("curator", 18))
	row.add_child(StoneKit.tight(state.tutorial.current_title(), COL_TEXT, 16))

	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(sp)
	if str(state.tutorial.current().get("done", "")) == "":
		var got_it := StoneKit.small_button("Got it", func(): state.tutorial.advance())
		got_it.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(got_it)
	var skip := StoneKit.small_button("Skip", func(): state.skip_tutorial())
	skip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(skip)

	col.add_child(StoneKit.label(state.tutorial.current_body(), COL_DIM_P, StoneTheme.FS_SMALL))


# ---------------------------------------------------------------- goals

## The milestone ladder. Twelve goals in three tiers, every one of them
## something the player has already been doing - the tab does not add
## verbs, it makes the existing loop visible.
func _build_goals_tab() -> void:
	_content.add_child(StoneKit.section("Milestones"))

	var entries := state.goal_list()
	var tier := ""
	for e in entries:
		var g: Dictionary = e["goal"]
		var t := str(g["tier"])
		if t != tier:
			tier = t
			_content.add_child(StoneKit.tight(t.to_upper(), COL_DIM_P, 12))

		var done := bool(e["complete"])
		var accent := COL_MOSS if done else COL_SLATE
		var card := StoneKit.card(COL_K)
		var col := StoneKit.card_col(card)

		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		col.add_child(row)
		row.add_child(StoneKit.row_block(accent, 4))

		var title_col := VBoxContainer.new()
		title_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		title_col.add_theme_constant_override("separation", 1)
		row.add_child(title_col)
		title_col.add_child(StoneKit.label(str(g["title"]), COL_TEXT, StoneTheme.FS_BODY))
		title_col.add_child(StoneKit.label(str(g["body"]), COL_DIM_P, 12))

		if done:
			row.add_child(StoneKit.chip_label(COL_MOSS, "EARNED", StoneTheme.FS_SMALL))
		else:
			row.add_child(StoneKit.tight("%d/%d" % [int(e["progress"]), int(e["target"])],
				COL_TEXT, 14))

		col.add_child(StoneKit.label("Reward: %s" % state.goals.reward_text(g), COL_DIM_P, StoneTheme.FS_TINY))

		if not done:
			col.add_child(StoneKit.bar(float(e["progress"]) / maxf(1.0, float(e["target"])),
				COL_GOLD, 6))

		_content.add_child(card)


# ---------------------------------------------------------------- ledger

## The ledger: the player's own history. A management game where you cannot
## see the curve you climbed is a management game played blind.
func _build_ledger_tab() -> void:
	_content.add_child(StoneKit.section("The Ledger"))

	var rev := state.revenue_log()
	var opx := state.opex_log()
	var cap := state.capex_log()
	var stol := state.stolen_log()
	var cur := state.curated_log()

	if rev.is_empty():
		_content.add_child(StoneKit.label("Nothing yet. End a day and the ledger begins.",
			COL_DIM_P, StoneTheme.FS_SMALL))
	else:
		# A table, with a header row and alternating fills, so the numbers
		# line up in columns and can be read across.
		var head := HBoxContainer.new()
		head.add_theme_constant_override("separation", 8)
		_content.add_child(head)
		head.add_child(StoneKit.tight("Day", COL_DIM_P, 12))
		head.add_child(StoneKit.tight("Takings", COL_DIM_P, 12))
		head.add_child(StoneKit.tight("Costs", COL_DIM_P, 12))
		head.add_child(StoneKit.tight("Net", COL_DIM_P, 12))
		head.add_child(StoneKit.tight("Cur", COL_DIM_P, 12))
		head.add_child(StoneKit.tight("Stol", COL_DIM_P, 12))

		var n := rev.size()
		var start := maxi(0, n - 40)
		for i in range(n - 1, start - 1, -1):
			var net := int(rev[i]) - int(opx[i]) if i < opx.size() else 0
			var row := HBoxContainer.new()
			row.add_theme_constant_override("separation", 8)
			_content.add_child(row)
			row.add_child(StoneKit.tight("%d" % (i + 1), COL_TEXT, StoneTheme.FS_SMALL))
			row.add_child(StoneKit.tight("%d" % int(rev[i]), COL_TEXT, StoneTheme.FS_SMALL))
			row.add_child(StoneKit.tight("%d" % (int(opx[i]) if i < opx.size() else 0), COL_DIM_P, StoneTheme.FS_SMALL))
			# Net: the sign carries the meaning, the chip carries the mood.
			row.add_child(StoneKit.chip(COL_MOSS if net >= 0 else COL_RUST))
			row.add_child(StoneKit.tight("%s%d" % ["+" if net >= 0 else "-", absi(net)],
				COL_TEXT, StoneTheme.FS_SMALL))
			row.add_child(StoneKit.tight("%d" % (int(cur[i]) if i < cur.size() else 0), COL_TEXT, StoneTheme.FS_SMALL))
			row.add_child(StoneKit.tight("%d" % (int(stol[i]) if i < stol.size() else 0),
				COL_TEXT, StoneTheme.FS_SMALL))

	_content.add_child(StoneKit.spacer(0, 8))
	_content.add_child(StoneKit.section("Recent events"))
	var events := state.recent_events(12)
	if events.is_empty():
		_content.add_child(StoneKit.label("Nothing recorded yet.", COL_DIM_P, StoneTheme.FS_SMALL))
	for e in events:
		var kind := str(e.get("kind", "plain"))

		var chip_col := COL_TEXT
		match kind:
			"day": chip_col = COL_GOLD
			"display": chip_col = COL_MOSS
			"upgrade": chip_col = COL_SLATE
			"sale": chip_col = COL_RUST
			"dig": chip_col = COL_DIM_P
		var ev_row := HBoxContainer.new()
		ev_row.add_theme_constant_override("separation", 6)
		_content.add_child(ev_row)
		ev_row.add_child(StoneKit.chip(chip_col))
		# The day narrative already begins "Day 5 - ", so prefixing the day
		# again produced "Day 5 - Day 5 - Visitors paid...". Only prefix the
		# day onto entries that do not already carry one.
		var ev_text := str(e.get("text", ""))
		var ev_prefix := "" if ev_text.begins_with("Day ") else \
			"Day %d - " % int(e.get("day", 0))
		ev_row.add_child(StoneKit.label(ev_prefix + ev_text, COL_TEXT,
			StoneTheme.FS_SMALL))


# ---------------------------------------------------------------- save/load

func _on_save_pressed() -> void:
	if state.save_to_disk():
		_set_status("Saved.", COL_MOSS, true)
	else:
		_set_status("Could not save.", COL_RUST, true)


func _on_load_pressed() -> void:
	if state.load_from_disk():
		_set_status("Loaded.", COL_MOSS, true)
		_clear_overlay()
		_refresh()
	else:
		_set_status("No save found.", COL_RUST, true)


## New Game is destructive, so it asks twice. The button arms, then a second
## press within the same session does it. It also clears the save on disk,
## so "new game" means genuinely new and not secretly continuing later.
func _on_new_pressed() -> void:
	if not _new_armed:
		_new_armed = true
		_btn_new.text = "Really?"
		_btn_new.add_theme_stylebox_override("normal", StoneKit.bevel(COL_CARD, COL_RUST))
		_btn_new.add_theme_stylebox_override("hover", StoneKit.bevel(COL_W, COL_RUST))
		return
	_new_armed = false
	_btn_new.text = "New Game"
	SaveSystem.clear_save()
	state.reset()
	_clear_overlay()

	_set_status("A fresh outfit. Good luck.", COL_MOSS, true)

	_refresh()


# ---------------------------------------------------------------- widgets

## Show or hide a chip, and set its colour.
func _set_chip(c: ColorRect, col: Color, on: bool) -> void:
	if c == null:
		return
	c.visible = on
	if on:
		c.color = col


## Set the status line: dark text, with a chip for good or bad news.
func _set_status(text: String, col: Color, chip: bool) -> void:
	_lbl_status.text = text
	_lbl_status.add_theme_color_override("font_color", COL_TEXT)
	_set_chip(_chip_status, col, chip)


## Show a reel symbol as its drawn sprite.
##
## An empty symbol id clears the texture, so a reel that has not landed yet
## shows an empty window rather than a stale symbol.
func _set_reel_icon(icon: TextureRect, symbol: String) -> void:
	if symbol.is_empty():
		icon.texture = null
		return
	var file: String = SYMBOL_SPRITE.get(symbol, "")
	if file.is_empty():
		icon.texture = null
		return
	var path := SPRITE_DIR + file + ".png"
	if ResourceLoader.exists(path):
		icon.texture = load(path)


## A palette-only dimming veil, used behind a modal panel.
##
## An alpha-blended black rectangle would put colours on screen that are
## not in the shared palette, which quietly breaks the promise that every
## pixel comes from the palette. A two-pixel checkerboard of two palette
## colours dims the screen the same way and keeps every pixel legal.
func _veil() -> Control:
	var img := Image.create(2, 2, false, Image.FORMAT_RGB8)
	img.set_pixel(0, 0, COL_K)
	img.set_pixel(1, 0, COL_GROUND)
	img.set_pixel(0, 1, COL_GROUND)
	img.set_pixel(1, 1, COL_K)
	var veil := TextureRect.new()
	veil.texture = ImageTexture.create_from_image(img)
	veil.stretch_mode = TextureRect.STRETCH_TILE
	veil.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	veil.set_anchors_preset(Control.PRESET_FULL_RECT)
	veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return veil


## The day's event, shown as a banner.
##
## The banner does three things at once: it names the weather, it spells out
## the EFFECT in numbers the player already understands (more visitors, more
## risk, faster cataloguing), and it is deliberately the first thing on the
## Gallery tab, because the event is meant to inform a decision rather than
## decorate one after the fact.
func _event_banner(ev: Dictionary) -> Control:
	if ev.is_empty():
		return StoneKit.spacer(0, 0)

	var card := StoneKit.card(COL_K)
	var col := StoneKit.card_col(card)

	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 8)
	col.add_child(head)
	head.add_child(StoneKit.row_block(COL_GOLD, 4))
	head.add_child(StoneKit.tight("TODAY: %s" % str(ev.get("title", "")), COL_TEXT, 16))

	col.add_child(StoneKit.label(str(ev.get("text", "")), COL_TEXT, StoneTheme.FS_SMALL))

	# The effect line. If the event does nothing measurable, say nothing.
	var effects: Array[String] = []
	var d := float(ev.get("demand", 1.0))
	if absf(d - 1.0) > 0.001:
		effects.append("visitors %s%.0f%%" % ["+" if d > 1.0 else "", (d - 1.0) * 100.0])
	var t := float(ev.get("theft", 1.0))
	if absf(t - 1.0) > 0.001:
		effects.append("theft risk %s%.0f%%" % ["+" if t > 1.0 else "", (t - 1.0) * 100.0])
	var c := int(ev.get("curation", 0))
	if c != 0:
		effects.append("cataloguing %s%d" % ["+" if c > 0 else "", c])
	var ch := int(ev.get("charm", 0))
	if ch != 0:
		effects.append("%d charm(s) from the notice" % ch)
	if not effects.is_empty():
		col.add_child(StoneKit.tight(" - ".join(effects), COL_DIM_P, 12))

	return card


## A multiplier, written the way the reference UI writes one: lowercase x,
## no space, and one decimal.
##
## The payout is money, so it keeps a second decimal when rounding would
## change what the player is owed. The symbol multipliers are whole tenths
## and always show one.
func _mult_text(v: float) -> String:
	# A whole multiplier other than the neutral 1.0 is written without the
	# decimal, because that is how the reference writes it: x1.2, x1.5, x2.
	var tenths := v * 10.0
	if absf(tenths - roundf(tenths)) < 0.05:
		if absf(v - roundf(v)) < 0.001 and absf(v - 1.0) > 0.001:
			return "x%d" % int(roundf(v))
		return "x%.1f" % v
	# A value that is not a whole tenth keeps its second decimal, because
	# rounding it would misstate what the player is owed.
	return "x%.2f" % v


## Money, with a comma every three digits so a big number can be read.
func _money(v: int) -> String:
	var neg := v < 0
	var s := str(absi(v))
	var out := ""
	var count := 0
	for i in range(s.length() - 1, -1, -1):
		out = s[i] + out
		count += 1
		if count % 3 == 0 and i > 0:
			out = "," + out
	return ("-£" if neg else "£") + out


func _select_tab(i: int) -> void:
	_current_tab = i
	_rebuild_content()
	_style_tabs()
