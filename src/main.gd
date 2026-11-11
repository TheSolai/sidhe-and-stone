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
##   [ top bar:  day / money / charms / luck ]
##   [ FATE REEL strip - always visible ]
##   [ scrolling content: Gallery / Vault / Digs / Staff ]
##   [ End Day ]
##
## The reel strip is deliberately NOT a tab. A luck mechanic the player has to
## go looking for is a luck mechanic they will forget exists.

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

const TABS := ["Gallery", "Vault", "Digs", "Staff", "Goals", "Ledger"]

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
var _lbl_luck: Label
var _lbl_demand: Label
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
var _chip_payout: ColorRect
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
	root.add_theme_constant_override("separation", 8)
	add_child(root)

	root.add_child(_build_topbar())
	root.add_child(_build_reel_strip())

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	root.add_child(scroll)

	_content = VBoxContainer.new()
	_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content.add_theme_constant_override("separation", 8)
	scroll.add_child(_content)

	root.add_child(_build_footer())

	# The overlay layer sits above everything and carries modal panels:
	# the end-of-day report, and the confirm for starting a new game.
	_overlay = Control.new()
	_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_overlay)


func _build_topbar() -> Control:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(COL_PANEL))

	# A PanelContainer stretches EVERY child to the full rect, so the stats
	# row and the milestone strip have to live in one column, not two
	# siblings. Two siblings meant the milestone strip was drawn on top of
	# the day and money.
	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 4)
	panel.add_child(stack)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	stack.add_child(row)


	_lbl_day = _stat_label("Day 1", COL_TEXT)
	row.add_child(_lbl_day)

	# Money: the drawn coin carries "money", the number stays in text.
	var money_box := HBoxContainer.new()
	money_box.add_theme_constant_override("separation", 3)
	money_box.add_child(_icon("icon_coin", 18))
	_lbl_money = _stat_label("£240", COL_TEXT)
	money_box.add_child(_lbl_money)
	# Negative money is bad news: a rust CHIP says so, the text stays dark.
	_chip_money = _chip(COL_RUST)
	_chip_money.visible = false
	money_box.add_child(_chip_money)
	row.add_child(money_box)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(spacer)

	# Charms: the drawn charm carries the resource, the count stays in text.
	var charm_box := HBoxContainer.new()
	charm_box.add_theme_constant_override("separation", 3)
	charm_box.add_child(_icon("icon_charm", 18))
	_lbl_charms = _stat_label("6", COL_TEXT)
	charm_box.add_child(_lbl_charms)
	row.add_child(charm_box)

	var luck_box := HBoxContainer.new()
	luck_box.add_theme_constant_override("separation", 3)
	luck_box.add_child(_chip(COL_SLATE))
	_lbl_luck = _stat_label("Luck 0.0", COL_TEXT)
	luck_box.add_child(_lbl_luck)
	row.add_child(luck_box)

	# Demand: how many exhibits pay today. The drawn icon carries it, the
	# number stays in text.
	var demand_box := HBoxContainer.new()
	demand_box.add_theme_constant_override("separation", 3)
	demand_box.add_child(_icon("icon_demand", 18))
	_lbl_demand = _stat_label("0", COL_TEXT)
	demand_box.add_child(_lbl_demand)
	row.add_child(demand_box)
	

	# The milestone strip. A management game where the next goal lives on a
	# tab the player has to go and find is a game that feels endless. This
	# line is always on screen, so the ladder is never more than a glance
	# away - it is the thing that makes "day 40" feel different from "day 4".
	#
	# The title and the description are SEPARATE labels, both full width.
	# They used to be one autowrapping label inside the header row, and that
	# clipped: a wrapping Label cannot know its height until its width is
	# known, and a horizontal container allocates height BEFORE width is
	# resolved. The second line was simply cut off. Stacked full-width
	# labels in the vertical stack do not have that problem.
	var grow := VBoxContainer.new()
	grow.add_theme_constant_override("separation", 3)
	stack.add_child(grow)

	var ghead := HBoxContainer.new()
	ghead.add_theme_constant_override("separation", 6)
	grow.add_child(ghead)

	ghead.add_child(_label("MILESTONE", COL_DIM_P, 11))
	# Good news about the ladder: a moss chip, never moss TEXT.
	_chip_goal = _chip(COL_MOSS)
	_chip_goal.visible = false
	ghead.add_child(_chip_goal)
	

	_lbl_goal = _label("", COL_TEXT, 12)
	_lbl_goal.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	grow.add_child(_lbl_goal)

	_lbl_goal_sub = _label("", COL_DIM_P, 11)
	_lbl_goal_sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	grow.add_child(_lbl_goal_sub)

	_bar_goal = ProgressBar.new()
	_bar_goal.show_percentage = false
	_bar_goal.custom_minimum_size = Vector2(0, 6)
	_bar_goal.max_value = 1.0
	_bar_goal.step = 0.001
	_bar_goal.add_theme_stylebox_override("background", _panel_style(COL_GROUND))
	_bar_goal.add_theme_stylebox_override("fill", _panel_style(COL_GOLD))
	grow.add_child(_bar_goal)
	return panel


func _build_reel_strip() -> Control:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(COL_CARD))

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	panel.add_child(col)

	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 8)
	col.add_child(head)

	var title := Label.new()
	title.text = "FATE REEL"
	title.add_theme_color_override("font_color", COL_TEXT)
	title.add_theme_font_size_override("font_size", 15)
	head.add_child(title)

	head.add_child(_icon("reel_wheel", 26))


	# A good or bad multiplier is a CHIP beside the number, not a coloured
	# number: coloured text on a cream surface is not in the palette rules.
	_chip_payout = _chip(COL_MOSS)
	_chip_payout.visible = false
	head.add_child(_chip_payout)

	_lbl_payout = Label.new()
	_lbl_payout.text = "×1.00"
	_lbl_payout.add_theme_color_override("font_color", COL_TEXT)
	_lbl_payout.add_theme_font_size_override("font_size", 15)
	head.add_child(_lbl_payout)
	

	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(sp)

	_btn_table = Button.new()
	_btn_table.text = "Odds"
	_btn_table.flat = true
	_btn_table.add_theme_color_override("font_color", COL_DIM)
	_btn_table.add_theme_font_size_override("font_size", 13)
	_btn_table.pressed.connect(_toggle_table)
	head.add_child(_btn_table)


	_btn_spin = Button.new()
	_btn_spin.text = "Spin (2 charms)"
	_btn_spin.add_theme_font_size_override("font_size", 15)
	# The one warm call to action, so it gets the ochre fill with dark ink.
	_btn_spin.add_theme_stylebox_override("normal", _box_style(COL_GOLD, COL_K))
	_btn_spin.add_theme_stylebox_override("hover", _box_style(COL_GOLD_INK, COL_K))
	_btn_spin.add_theme_stylebox_override("pressed", _box_style(COL_GOLD, COL_K))
	_btn_spin.add_theme_color_override("font_color", COL_K)
	_btn_spin.add_theme_color_override("font_hover_color", COL_K)
	_btn_spin.add_theme_color_override("font_pressed_color", COL_K)
	# The charm sprite, drawn, never a font glyph.
	var charm_tex_path := SPRITE_DIR + "icon_charm.png"
	if ResourceLoader.exists(charm_tex_path):
		_btn_spin.icon = load(charm_tex_path)
		_btn_spin.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_btn_spin.pressed.connect(_on_spin_pressed)
	head.add_child(_btn_spin)
	

	# The three reel windows.
	var reels := HBoxContainer.new()
	reels.add_theme_constant_override("separation", 6)
	reels.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_child(reels)

	for _i in 3:
		var cell := PanelContainer.new()
		cell.custom_minimum_size = Vector2(74, 58)
		cell.add_theme_stylebox_override("panel", _panel_style(COL_WELL))
		# The drawn motif, centred in the window. The texture is 18px with
		# the symbol filling it, so it is shown at 1:1 and never resampled.
		var icon := TextureRect.new()
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		icon.custom_minimum_size = Vector2(44, 44)
		icon.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		cell.add_child(icon)
		reels.add_child(cell)
		_reel_icons.append(icon)

	_table_panel = _build_odds_table()
	_table_panel.visible = false
	col.add_child(_table_panel)


	# Status is a single line of dark text with a chip beside it. The chip
	# carries good news (moss) or bad news (rust); the words carry the fact.
	var status_row := HBoxContainer.new()
	status_row.add_theme_constant_override("separation", 6)
	col.add_child(status_row)

	_chip_status = _chip(COL_MOSS)
	_chip_status.visible = false
	status_row.add_child(_chip_status)

	_lbl_status = Label.new()
	_lbl_status.text = ""
	_lbl_status.add_theme_color_override("font_color", COL_TEXT)
	_lbl_status.add_theme_font_size_override("font_size", 13)
	_lbl_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_lbl_status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status_row.add_child(_lbl_status)
	
	return panel



func _build_odds_table() -> PanelContainer:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(COL_PANEL))

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	panel.add_child(col)

	var head := Label.new()
	head.text = "What the wheel shows"
	head.add_theme_color_override("font_color", COL_TEXT)
	head.add_theme_font_size_override("font_size", 14)
	col.add_child(head)

	# The rows are rebuilt whenever the state refreshes, because the weights
	# move with luck and a stale percentage is worse than no percentage.
	_odds_body = VBoxContainer.new()
	_odds_body.add_theme_constant_override("separation", 5)
	col.add_child(_odds_body)
	_rebuild_odds_body()

	var ev := Label.new()
	ev.text = "EV now %.3f   ·   a miss still pays ×1.00" % state.sim.reel.expected_value()
	ev.add_theme_color_override("font_color", COL_DIM_P)
	ev.add_theme_font_size_override("font_size", 12)
	ev.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
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

		line.add_child(_icon(SYMBOL_SPRITE[s], 16))

		var nm := Label.new()
		nm.text = str(st["name"])
		nm.add_theme_color_override("font_color", COL_TEXT)
		nm.add_theme_font_size_override("font_size", 13)
		nm.custom_minimum_size = Vector2(74, 0)
		line.add_child(nm)

		var mult := Label.new()
		mult.text = "×%.2f" % float(ReelCore.SYMBOLS[s]["mult"])
		mult.add_theme_color_override("font_color", COL_TEXT)
		mult.add_theme_font_size_override("font_size", 13)
		mult.custom_minimum_size = Vector2(48, 0)
		line.add_child(mult)

		var pct := Label.new()
		pct.text = "%.1f%%" % (share * 100.0)
		pct.add_theme_color_override("font_color", COL_DIM_P)
		pct.add_theme_font_size_override("font_size", 13)
		pct.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		pct.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		line.add_child(pct)

		# The probability bar. The fill is the symbol's own colour.
		var bar := ProgressBar.new()
		bar.show_percentage = false
		bar.custom_minimum_size = Vector2(0, 7)
		bar.max_value = 1.0
		bar.value = share
		bar.add_theme_stylebox_override("background", _flat_style(COL_GROUND))
		bar.add_theme_stylebox_override("fill", _flat_style(sym_col))
		row.add_child(bar)
	


func _build_footer() -> Control:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(COL_PANEL))

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	panel.add_child(col)

	var tabs := HBoxContainer.new()
	tabs.add_theme_constant_override("separation", 6)
	col.add_child(tabs)

	for i in TABS.size():
		var b := Button.new()
		b.text = TABS[i]
		b.toggle_mode = true
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.add_theme_font_size_override("font_size", 15)
		b.pressed.connect(_select_tab.bind(i))
		tabs.add_child(b)
		_tab_buttons.append(b)

	var io_row := HBoxContainer.new()
	io_row.add_theme_constant_override("separation", 6)
	col.add_child(io_row)

	var b_save := _button("Save", _on_save_pressed)
	b_save.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b_save.add_theme_font_size_override("font_size", 13)
	io_row.add_child(b_save)

	var b_load := _button("Load", _on_load_pressed)
	b_load.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b_load.add_theme_font_size_override("font_size", 13)
	b_load.disabled = not GameState.has_save()
	io_row.add_child(b_load)

	_btn_new = _button("New Game", _on_new_pressed)
	_btn_new.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_btn_new.add_theme_font_size_override("font_size", 13)
	_outlined(_btn_new, COL_RUST)
	io_row.add_child(_btn_new)

	var end := Button.new()
	end.text = "End Day"
	end.custom_minimum_size = Vector2(0, 52)
	end.add_theme_font_size_override("font_size", 19)
	end.pressed.connect(_on_end_day)
	col.add_child(end)
	return panel


# ---------------------------------------------------------------- refresh

func _on_state_changed() -> void:
	_refresh()


func _refresh() -> void:
	# sim.day counts COMPLETED days, so the day being played is one more.
	# Without this a new player is greeted with "Day 0".

	_lbl_day.text = "Day %d" % (state.day() + 1)
	_lbl_money.text = "£%d" % state.money()
	_lbl_money.add_theme_color_override("font_color", COL_TEXT)
	_chip_money.visible = state.money() < 0
	_lbl_charms.text = "%d" % state.charms()
	_lbl_luck.text = "Luck %.1f" % state.luck()
	_lbl_demand.text = "%d" % state.demand()

	var pending := state.pending_payout()
	if pending > 1.0:
		_lbl_payout.text = "×%.2f today" % pending
		_set_chip(_chip_payout, COL_MOSS, true)
	else:
		_lbl_payout.text = "×1.00 today"
		_set_chip(_chip_payout, COL_MOSS, false)

	_btn_spin.disabled = not state.can_spin() or _spin_active
	_btn_spin.text = "Spin (%d charms)" % state.charm_cost()
	

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
	

	for i in _tab_buttons.size():
		_tab_buttons[i].button_pressed = (i == _current_tab)


	# The odds table shows live weights, so it is rebuilt on every refresh.
	if _odds_body != null:
		_rebuild_odds_body()
	_rebuild_content()


func _rebuild_content() -> void:
	for c in _content.get_children():
		_content.remove_child(c)
		c.queue_free()

	# The coach sits above everything, because it is the thing the player
	# most needs until they have done it once.
	_build_tutorial_card()

	match _current_tab:
		0: _build_gallery_tab()
		1: _build_vault_tab()
		2: _build_digs_tab()
		3: _build_staff_tab()
		4: _build_goals_tab()
		5: _build_ledger_tab()


# ---------------------------------------------------------------- gallery

func _build_gallery_tab() -> void:
	_content.add_child(_section_title("The Gallery"))
	_content.add_child(_event_banner(state.today_event()))
	_content.add_child(_hint(
		"Visitors pay for the %d most valuable exhibits on display today. "
		% state.demand()
		+ "Anything beyond that earns nothing but can still be stolen."))


	var case_row := HBoxContainer.new()
	case_row.add_theme_constant_override("separation", 8)
	case_row.add_child(_icon("gallery_case", 44))
	case_row.add_child(_label("Exhibits on display bring visitors through the door.",
		COL_DIM_P, 13))
	_content.add_child(case_row)

	# The people in the museum. Three DIFFERENT visitors, so the gallery
	# reads as a place with people in it rather than a row of display cases.
	var visitor_row := HBoxContainer.new()
	visitor_row.add_theme_constant_override("separation", 4)
	visitor_row.add_child(_icon("visitor_a", 28))
	visitor_row.add_child(_icon("visitor_b", 28))
	visitor_row.add_child(_icon("visitor_c", 28))
	visitor_row.add_child(_label("Visitors in today: %d" % state.demand(), COL_DIM_P, 13))
	_content.add_child(visitor_row)
	

	var gallery := state.gallery_counts()
	var paying := state.paying_split()
	var any := false
	for grade in GRADE_ORDER:
		var n := int(gallery.get(grade, 0))
		if n <= 0:
			continue
		any = true

		var card := _card(GRADE_COL[grade])
		var col := _card_col(card)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		col.add_child(row)
		row.add_child(_icon(GRADE_SPRITE[grade], 34))
		# The grade colour lives in the sprite and in the card's outline.
		# The NAME is written out, so colour is never the only meaning.
		row.add_child(_label("%s  %s" % [grade.capitalize(), "×%d" % n],
			COL_TEXT, 17))
		row.add_child(_spacer(8, 0))
		row.add_child(_label("£%d/day each" % state.exhibit_value(grade), COL_DIM, 13))
		var sp := Control.new()
		sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(sp)
		var b := _button("To Vault", func(): state.vault_one(grade))
		row.add_child(b)
	

		# The second line is the game's central decision, made legible.
		# Two facts the player needs at the moment they decide whether to
		# risk an exhibit: how much of it actually earns, and how likely it
		# is to be stolen tonight. "2 stolen" after the fact tells them
		# nothing they can act on; this does.
		var earning := int(paying.get(grade, 0))
		var bits: Array[String] = []
		if earning < n:
			bits.append("%d earning · %d over the cap" % [earning, n - earning])
		else:
			bits.append("%d earning" % earning)
		var risk := state.theft_chance(grade)
		bits.append("%.1f%% theft risk tonight" % (risk * 100.0))

		# Risk is good-or-bad news, so it gets a CHIP, not coloured text.
		var warned: bool = earning < n or risk > 0.07
		var risk_row := HBoxContainer.new()
		risk_row.add_theme_constant_override("separation", 6)
		if warned:
			risk_row.add_child(_chip(COL_RUST))
		risk_row.add_child(_label(" · ".join(bits),
			COL_TEXT if warned else COL_DIM, 12))
		col.add_child(risk_row)
	
		_content.add_child(card)

	if not any:
		_content.add_child(_hint("The gallery is empty. Move something up from the vault."))

	_content.add_child(_spacer(0, 6))
	_content.add_child(_section_title("Slots"))

	var slots := _label("%d of %d slots in use  ·  %d slot(s) free"
		% [state.on_display(), state.gallery_slots(), state.slots_free()], COL_DIM_P, 13)
	_content.add_child(slots)

	_content.add_child(_spacer(0, 8))
	_content.add_child(_section_title("Today"))

	# Demand wears the drawn demand icon, and the number stays in text.
	var demand_row := HBoxContainer.new()
	demand_row.add_theme_constant_override("separation", 6)
	demand_row.add_child(_icon("icon_demand", 16))
	demand_row.add_child(_label("Demand: %d exhibit(s)  ·  Upkeep: £%d/day"
		% [state.demand(), state.upkeep()], COL_DIM_P, 13))
	_content.add_child(demand_row)

	_content.add_child(_label("Storeroom: %d raw find(s) waiting to be catalogued"
		% state.raw_count(), COL_DIM_P, 13))
	


# ---------------------------------------------------------------- vault

func _build_vault_tab() -> void:
	_content.add_child(_section_title("The Vault"))
	_content.add_child(_hint(
		"Vaulted artefacts are safe from thieves but earn nothing. "
		+ "This is the central decision of the game: how much to put at risk."))

	var vault := state.vault_counts()
	var any := false
	for grade in GRADE_ORDER:
		var n := int(vault.get(grade, 0))
		if n <= 0:
			continue
		any = true

		var card := _card(GRADE_COL[grade])
		var row := _card_row(card)
		row.add_child(_icon(GRADE_SPRITE[grade], 34))
		# The grade colour is in the sprite and the card outline; the name is
		# written out. Colour supplements, it never carries the meaning alone.
		row.add_child(_label("%s  ×%d" % [grade.capitalize(), n], COL_TEXT, 17))
		row.add_child(_spacer(8, 0))
		row.add_child(_label("£%d/day each" % state.exhibit_value(grade), COL_DIM, 13))
		var sp := Control.new()
		sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(sp)

		var can_show := state.slots_free() > 0
		var show_btn := _button("Display", func(): state.display_one(grade))
		show_btn.disabled = not can_show
		row.add_child(show_btn)

		var sell := _button("Sell", func(): state.sell_one(grade))
		_outlined(sell, COL_RUST)
		row.add_child(sell)
	
		_content.add_child(card)

	if not any:
		_content.add_child(_hint("The vault is empty. Digs take days to complete - be patient."))

	_content.add_child(_spacer(0, 6))
	_content.add_child(_hint(
		"Selling to a dealer gets half value, immediately. It is the safety "
		+ "valve for when the purse is empty."))


func _sell_one(grade: String) -> void:
	state.sell_one(grade)


# ---------------------------------------------------------------- digs

func _build_digs_tab() -> void:
	_content.add_child(_section_title("Dig Sites"))
	_content.add_child(_hint(
		"Assign each site a dig. Deeper digs take longer, cost more, and "
		+ "yield rarer finds - but rarer finds attract more thieves."))
	if state.money() < 0:
		_content.add_child(_hint(
			"You are £%d in the red. The fairies will dig on credit, but the "
			% absi(state.money())
			+ "bank is patient, not generous. Sell something from the vault, "
			+ "or put a find on display."))


	var dig_demand_row := HBoxContainer.new()
	dig_demand_row.add_theme_constant_override("separation", 6)
	dig_demand_row.add_child(_icon("icon_demand", 16))
	dig_demand_row.add_child(_label("Visitors today: %d  ·  demand %d exhibit(s)"
		% [state.demand(), state.demand()], COL_DIM_P, 13))
	_content.add_child(dig_demand_row)
	for i in state.sites():
		var running := state.dig_in_progress(i)
		var card := _card(COL_CARD)
		var row := _card_row(card)
		row.add_child(_icon("dig_site", 34))
		row.add_child(_label("Site %d" % (i + 1), COL_TEXT, 17))

		if not running.is_empty():
			row.add_child(_spacer(8, 0))
			var dig: String = running["dig"]
			var left := int(running["ready_day"]) - state.day()

			# Progress is good news: a moss chip beside dark text.
			row.add_child(_chip_label(COL_MOSS,
				"%s — %d day(s) left" % [_dig_name(dig), maxi(0, left)], 15))
		
		else:
			row.add_child(_spacer(6, 0))
			var btns := HBoxContainer.new()
			btns.add_theme_constant_override("separation", 6)
			for dig in DIG_ORDER:
				var b := _button("%s £%d · %dd" % [_dig_name(dig), state.dig_cost(dig),
					state.dig_days(dig)], func(d = dig): state.assign_dig(i, d))
				b.add_theme_font_size_override("font_size", 12)
				b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				# Digs are allowed ON CREDIT. Blocking an unaffordable dig
				# would dead-end the game: broke, no finds, no exhibits, no
				# income, and nothing left to press. The debt is the
				# punishment, not a locked button.

				if state.money() < state.dig_cost(dig):
					# Unaffordable dig: the OUTLINE says so, not coloured text.
					_outlined(b, COL_RUST)
				
				btns.add_child(b)
			row.add_child(btns)

			var pending := state.pending_dig(i)
			if pending != "":
				row.add_child(_spacer(6, 0))
				row.add_child(_chip_label(DIG_COL.get(pending, COL_DIM),
					"Assigned: %s" % _dig_name(pending), 13))

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
	_content.add_child(_section_title("Staff & Upgrades"))
	_content.add_child(_hint(
		"Every purchase is capital, not operating cost - it raises what you "
		+ "can earn later rather than costing you now."))

	var rows := [
		["site", "New Dig Site", "More places to dig."],
		["curator", "Curator", "Catalogues more finds per day. The throughput bottleneck."],
		["gallery", "Gallery Extension", "+2 slots and ×1.32 visitor demand."],
		["omen", "Omen Reader", "+0.10 luck. Improves the Fate Reel's odds."],
		["diggers", "Digger Fairies", "+6% finds from every dig."],
		["excavators", "Excavators", "-1 day on every dig, including digs already underway."],
		["guides", "Guides", "+1 visitor to the demand cap. More people paying."],
		["archivists", "Archivists", "+8% value on every curated exhibit."],
		["wards", "Ward Fairies", "Reduce the chance of overnight theft."],
	]

	for r in rows:
		var kind: String = r[0]
		var cost := state.upgrade_cost(kind)
		var card := _card(COL_CARD)
		var row := _card_row(card)
		if kind == "curator":
			row.add_child(_icon("curator", 30))
		row.add_child(_label("%s  (owned %d)" % [r[1], state.upgrade_count(kind)],
			COL_TEXT, 16))
		row.add_child(_spacer(4, 0))
		row.add_child(_label(str(r[2]), COL_DIM, 12))

		var sp := Control.new()
		sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(sp)

		if cost < 0:
			row.add_child(_label("MAX", COL_DIM, 15))
		else:
			var b := _button("£%d" % cost, func(): state.buy_upgrade(kind))
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
	if payout > 1.0:
		msg += " ×%.2f on today's takings." % payout
	elif payout < 1.0:
		msg += " ×%.2f on today's takings." % payout
	else:
		msg += " A miss — still ×1.00."

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

	_set_status("  ·  ".join(bits), COL_TEXT, false)
	
	_autosave()
	_show_day_report(s)
	_refresh()


# ---------------------------------------------------------------- day report

## The end-of-day panel. This is the moment the player actually reads, so it
## says what happened in words, not just in numbers.
func _show_day_report(s: Dictionary) -> void:
	_clear_overlay()

	_overlay.add_child(_veil())

	var centre := CenterContainer.new()
	centre.set_anchors_preset(Control.PRESET_FULL_RECT)
	_overlay.add_child(centre)

	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(600, 0)
	panel.add_theme_stylebox_override("panel", _panel_style(COL_PANEL))
	centre.add_child(panel)

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	panel.add_child(col)

	col.add_child(_section_title("Day %d" % int(s["day"])))

	var revenue := int(s["revenue"])
	var opex := int(s["opex"])
	var delta := int(s["delta"])


	col.add_child(_report_line("Takings", "£%d" % revenue, COL_GOLD, revenue > 0))
	if opex > 0:
		col.add_child(_report_line("Upkeep & dig costs", "-£%d" % opex, COL_DIM))
	if int(s["capex"]) > 0:
		col.add_child(_report_line("Invested", "-£%d" % int(s["capex"]), COL_SLATE, true))
	col.add_child(_report_line("Net", "%s£%d" % ["+" if delta >= 0 else "-", absi(delta)],
		COL_MOSS if delta >= 0 else COL_RUST, true))
	

	col.add_child(_spacer(0, 4))

	var payout := float(s["payout"])

	if absf(payout - 1.0) > 0.001:
		col.add_child(_report_line("Fate Reel", "×%.2f" % payout,
			COL_MOSS if payout > 1.0 else COL_RUST, true))

	var curated := int(s["curated"])
	if curated > 0:
		col.add_child(_report_line("Catalogued", "%d find(s)" % curated, COL_TEXT))
	
	if int(s["digs_done"]) > 0:
		col.add_child(_report_line("Digs finished", "%d" % int(s["digs_done"]), COL_TEXT))

	var stolen := int(s["stolen"])
	if stolen > 0:
		var grades: Dictionary = s["stolen_grades"]
		var named: Array[String] = []
		for g in GRADE_ORDER:
			var n := int(grades.get(g, 0))
			if n > 0:
				named.append("%d %s" % [n, g])
		col.add_child(_report_line("STOLEN", ", ".join(named), COL_RUST, true))

	if int(s["raw_after"]) > 0:
		col.add_child(_report_line("Storeroom", "%d waiting" % int(s["raw_after"]), COL_DIM))

	var ev := str(s["event"])
	if ev != "":
		col.add_child(_hint(ev))

	# The day's event, named in the report so the player can connect the
	# numbers to the cause. "Takings £40" means nothing on its own;
	# "Fair Day" and "Takings £40" means something.
	var day_ev: Dictionary = s.get("day_event", {})
	if not day_ev.is_empty():
		col.add_child(_spacer(0, 2))
		col.add_child(_event_banner(day_ev))

	col.add_child(_spacer(0, 4))
	var ok := _button("Continue", func(): _clear_overlay())
	ok.custom_minimum_size = Vector2(0, 46)
	ok.add_theme_font_size_override("font_size", 18)
	col.add_child(ok)


## One label/value line in the day report.

func _report_line(key: String, value: String, col: Color, chip: bool = false) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.add_child(_label(key, COL_DIM_P, 15))
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(sp)
	if chip:
		row.add_child(_chip(col))
	var value_label := Label.new()
	value_label.text = value
	value_label.add_theme_color_override("font_color", COL_TEXT)
	value_label.add_theme_font_size_override("font_size", 16)
	row.add_child(value_label)
	return row
	


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
	var card := _card(COL_GOLD)
	var row := _card_row(card)
	row.add_child(_icon("curator", 30))
	row.add_child(_label(state.tutorial.current_title(), COL_TEXT, 17))
	row.add_child(_spacer(4, 0))
	row.add_child(_label(state.tutorial.current_body(), COL_TEXT, 13))
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(sp)
	if str(state.tutorial.current().get("done", "")) == "":
		var got_it := _button("Got it", func(): state.tutorial.advance())
		# The body text wraps to three lines, so this row is tall. A button
		# stretches to the row height by default, which turned "Got it" into
		# a 45x123 vertical strip. Keep the natural height, centred.
		got_it.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(got_it)
	var skip := _button("Skip", func(): state.skip_tutorial())
	skip.add_theme_color_override("font_color", COL_TEXT)
	skip.add_theme_font_size_override("font_size", 12)
	skip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(skip)
	_content.add_child(card)


# ---------------------------------------------------------------- goals

## The milestone ladder. Twelve goals in three tiers, every one of them
## something the player has already been doing - the tab does not add
## verbs, it makes the existing loop visible.
func _build_goals_tab() -> void:
	_content.add_child(_section_title("Milestones"))
	_content.add_child(_hint(
		"Three tiers, twelve goals. Each one pays out the moment you reach "
		+ "it - you do not claim them, you earn them."))

	var entries := state.goal_list()
	var tier := ""
	for e in entries:
		var g: Dictionary = e["goal"]
		var t := str(g["tier"])
		if t != tier:
			tier = t
			_content.add_child(_label(t.to_upper(), COL_DIM_P, 13))

		var done := bool(e["complete"])
		var accent := COL_MOSS if done else COL_SLATE
		var card := _card(accent)
		var col := _card_col(card)

		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		col.add_child(row)

		var title_col := VBoxContainer.new()
		title_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		title_col.add_theme_constant_override("separation", 1)
		row.add_child(title_col)
		title_col.add_child(_label(str(g["title"]), COL_TEXT, 15))
		title_col.add_child(_label(str(g["body"]), COL_DIM, 12))

		if done:
			row.add_child(_chip_label(COL_MOSS, "EARNED", 13))
		else:
			row.add_child(_label("%d/%d" % [int(e["progress"]), int(e["target"])],
				COL_TEXT, 13))

		var reward := _label("Reward: %s" % state.goals.reward_text(g), COL_DIM, 11)
		col.add_child(reward)

		if not done:
			var bar := ProgressBar.new()
			bar.show_percentage = false
			bar.custom_minimum_size = Vector2(0, 5)
			bar.max_value = maxf(1.0, float(e["target"]))
			bar.value = float(e["progress"])
			bar.add_theme_stylebox_override("background", _panel_style(COL_GROUND))
			bar.add_theme_stylebox_override("fill", _panel_style(COL_GOLD))
			col.add_child(bar)

		_content.add_child(card)


# ---------------------------------------------------------------- ledger

## The ledger: the player's own history. A management game where you cannot
## see the curve you climbed is a management game played blind.
func _build_ledger_tab() -> void:
	_content.add_child(_section_title("The Ledger"))
	_content.add_child(_hint(
		"Every day, written down. Watch the middle column: that is the shape of "
		+ "the outfit you are building."))

	var rev := state.revenue_log()
	var opx := state.opex_log()
	var cap := state.capex_log()
	var stol := state.stolen_log()
	var cur := state.curated_log()

	if rev.is_empty():
		_content.add_child(_hint("Nothing yet. End a day and the ledger begins."))
	else:
		var head := HBoxContainer.new()
		head.add_theme_constant_override("separation", 6)
		_content.add_child(head)

		head.add_child(_label("Day", COL_DIM_P, 13))
		head.add_child(_label("Takings", COL_DIM_P, 13))
		head.add_child(_label("Costs", COL_DIM_P, 13))
		head.add_child(_label("Net", COL_DIM_P, 13))
		head.add_child(_label("Cur", COL_DIM_P, 13))
		head.add_child(_label("Stol", COL_DIM_P, 13))

		var n := rev.size()
		var start := maxi(0, n - 40)
		for i in range(n - 1, start - 1, -1):
			var net := int(rev[i]) - int(opx[i]) if i < opx.size() else 0
			var row := HBoxContainer.new()
			row.add_theme_constant_override("separation", 6)
			row.add_child(_label("%d" % (i + 1), COL_TEXT, 13))
			row.add_child(_label("%d" % int(rev[i]), COL_TEXT, 13))
			row.add_child(_label("%d" % (int(opx[i]) if i < opx.size() else 0), COL_DIM_P, 13))
			# Net: the sign carries the meaning, the chip carries the mood.
			row.add_child(_chip(COL_MOSS if net >= 0 else COL_RUST))
			row.add_child(_label("%s%d" % ["+" if net >= 0 else "-", absi(net)],
				COL_TEXT, 13))
			row.add_child(_label("%d" % (int(cur[i]) if i < cur.size() else 0), COL_TEXT, 13))
			if i < stol.size() and int(stol[i]) > 0:
				row.add_child(_chip(COL_RUST))
			row.add_child(_label("%d" % (int(stol[i]) if i < stol.size() else 0),
				COL_TEXT, 13))
			_content.add_child(row)

	_content.add_child(_spacer(0, 10))
	_content.add_child(_section_title("Recent events"))
	var events := state.recent_events(12)
	if events.is_empty():
		_content.add_child(_hint("Nothing recorded yet."))
	for e in events:
		var kind := str(e.get("kind", "plain"))

		var chip_col := COL_TEXT
		match kind:
			"day": chip_col = COL_GOLD
			"display": chip_col = COL_MOSS
			"upgrade": chip_col = COL_SLATE
			"sale": chip_col = COL_RUST
			"dig": chip_col = COL_DIM
		var ev_row := HBoxContainer.new()
		ev_row.add_theme_constant_override("separation", 6)
		ev_row.add_child(_chip(chip_col))
		ev_row.add_child(_label("Day %d — %s" % [int(e.get("day", 0)),
			str(e.get("text", ""))], COL_TEXT, 13))
		_content.add_child(ev_row)
	


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
		_outlined(_btn_new, COL_RUST)
		return
	_new_armed = false
	_btn_new.text = "New Game"
	SaveSystem.clear_save()
	state.reset()
	_clear_overlay()

	_set_status("A fresh outfit. Good luck.", COL_MOSS, true)
	
	_refresh()


# ---------------------------------------------------------------- widgets

func _stat_label(text: String, col: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_color_override("font_color", col)
	l.add_theme_font_size_override("font_size", 16)
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return l


func _label(text: String, col: Color, size: int = 15) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_color_override("font_color", col)
	l.add_theme_font_size_override("font_size", size)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	# An autowrapping Label inside an HBoxContainer reports a minimum width of
	# roughly one character, so without this the container squeezes it into a
	# 1px column and every letter wraps onto its own line. Expanding the
	# label gives it the row's remaining width to wrap across.
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return l


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
		return _spacer(0, 0)

	var card := _card(COL_GOLD)
	var col := _card_col(card)

	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 8)
	col.add_child(head)
	head.add_child(_label("TODAY: %s" % str(ev.get("title", "")),
		COL_TEXT, 17))

	var body := _label(str(ev.get("text", "")), COL_TEXT, 13)
	col.add_child(body)

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
		col.add_child(_label("· ".join(effects), COL_DIM, 12))

	return card


func _section_title(text: String) -> Control:
	var l := _label(text, COL_TEXT, 19)
	return l



func _hint(text: String) -> Control:
	# Hints sit on the parchment page, where N is not a legal text colour.
	var l := _label(text, COL_DIM_P, 13)
	return l
	
	return l



## A small solid colour chip.
##
## The palette rule forbids accent colours as TEXT on cream, but allows them
## as fills, bars, chips and outlines. This is the chip: a small square of a
## palette colour that sits beside a line of dark text and carries the
## meaning - good news, bad news, money, identity - without colouring the
## words themselves.
func _chip(col: Color, px: int = 8) -> ColorRect:
	var c := ColorRect.new()
	c.color = col
	c.custom_minimum_size = Vector2(px, px)
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c


## A chip beside a line of dark text.
func _chip_label(col: Color, text: String, size: int = 13) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 5)
	row.add_child(_chip(col))
	var l := Label.new()
	l.text = text
	l.add_theme_color_override("font_color", COL_TEXT)
	l.add_theme_font_size_override("font_size", size)
	row.add_child(l)
	return row


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


## A button whose meaning is carried by its OUTLINE rather than by coloured
## text. Dark ink on the cream button, a coloured border for the emphasis.
func _outlined(b: Button, col: Color) -> void:
	b.add_theme_color_override("font_color", COL_TEXT)
	b.add_theme_color_override("font_hover_color", COL_TEXT)
	b.add_theme_color_override("font_pressed_color", COL_TEXT)
	b.add_theme_stylebox_override("normal", _box_style(COL_PANEL, col))
	b.add_theme_stylebox_override("hover", _box_style(COL_CARD, col))
	b.add_theme_stylebox_override("pressed", _box_style(COL_PANEL, col))
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
func _spacer(w: float, h: float) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(w, h)
	return c


## A generated sprite as a UI icon.
##
## The textures are tiny (13-23 px) and must stay crisp, so the filter is
## NEAREST and the texture is scaled by the layout rather than resampled.
func _icon(file: String, px: int = 40) -> TextureRect:
	var tr := TextureRect.new()
	var path := SPRITE_DIR + file + ".png"
	if ResourceLoader.exists(path):
		tr.texture = load(path)
	tr.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	tr.custom_minimum_size = Vector2(px, px)
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return tr


## Show a reel symbol as its drawn sprite.
##
## An empty symbol id clears the texture, so a reel that has not landed yet
## shows an empty window rather than a stale symbol. The tint is applied
## through modulate, so the drawn art keeps its own colours while a spinning
## reel can be dimmed to say "not settled yet".
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



## A flat filled box with a border and no corner radius: the house style.
func _box_style(fill: Color, border: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = fill
	s.border_color = border
	s.set_border_width_all(2)
	s.set_corner_radius_all(0)
	s.content_margin_left = 8
	s.content_margin_right = 8
	s.content_margin_top = 4
	s.content_margin_bottom = 4
	return s


## A flat filled box with no border.
func _flat_style(fill: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = fill
	s.set_corner_radius_all(0)
	return s
func _panel_style(col: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = col
	s.border_color = COL_LINE
	s.set_border_width_all(1)
	s.set_corner_radius_all(0)
	s.content_margin_left = 10
	s.content_margin_right = 10
	s.content_margin_top = 8
	s.content_margin_bottom = 8
	return s


## Build a card. Returns the PanelContainer so it can be added to the tree;
## the HBox inside it is where row content goes.
func _card(accent: Color) -> PanelContainer:
	var panel := PanelContainer.new()
	var style := _panel_style(COL_CARD)
	style.border_color = accent
	panel.add_theme_stylebox_override("panel", style)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	panel.add_child(row)
	return panel


## The content row inside a card.
func _card_row(panel: PanelContainer) -> HBoxContainer:
	return panel.get_child(0) as HBoxContainer


## The vertical body inside a card, for cards that carry more than one line.
## The card is rebuilt as a single column so the second line sits UNDER the
## title rather than fighting it for width in the same row.
func _card_col(panel: PanelContainer) -> VBoxContainer:
	# The original row is REMOVED from the panel, not just emptied. A
	# PanelContainer stretches every child to the full rect, so leaving an
	# empty row in there put a second full-size container on top of the
	# column - invisible, but it sat over the card's buttons.
	var row := panel.get_child(0) as HBoxContainer
	panel.remove_child(row)
	for c in row.get_children():
		row.remove_child(c)
		c.queue_free()
	row.queue_free()
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)
	panel.add_child(col)
	return col


func _button(text: String, cb: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.pressed.connect(cb)
	return b


func _select_tab(i: int) -> void:
	_current_tab = i
	for j in _tab_buttons.size():
		_tab_buttons[j].button_pressed = (j == i)
	_rebuild_content()
