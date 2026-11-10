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

const COL_BG := Color("16120f")
const COL_PANEL := Color("241d17")
const COL_PANEL_HI := Color("2f251d")
const COL_LINE := Color("453729")
const COL_OCHRE := Color("d9a441")
const COL_MOSS := Color("7d9a52")
const COL_SLATE := Color("8b99a6")
const COL_CREAM := Color("e8dcc4")
const COL_RUST := Color("c05f3c")
const COL_DIM := Color("8a7d6b")

const GRADE_COL := {
	"rubble": Color("8a8378"),
	"clay": Color("b4794a"),
	"relic": Color("5f9e8f"),
	"crown": Color("e0b23c"),
}

const GRADE_ORDER := ["crown", "relic", "clay", "rubble"]

## Generated pixel art lives in assets/sprites. Every one of these was drawn
## as code with pxl - which means it IS the pixel grid, with binary alpha and
## a fixed palette - and checked against a rendered ASCII grid before it was
## allowed near the UI. See ai/regen_sprites.py for the reproducible build.
const SPRITE_DIR := "res://assets/sprites/"

const GRADE_SPRITE := {
	"crown": "artefact_crown",
	"relic": "artefact_relic",
	"clay": "artefact_clay",
	"rubble": "artefact_rubble",
}

const SYMBOL_STYLE := {
	"clover": {"glyph": "☘", "col": Color("7d9a52"), "name": "Clover"},
	"honey": {"glyph": "❋", "col": Color("e0a83c"), "name": "Honey"},
	"moon": {"glyph": "☾", "col": Color("9fb6cf"), "name": "Moon"},
	"star": {"glyph": "★", "col": Color("f2e2a8"), "name": "Star"},
	"bog": {"glyph": "≈", "col": Color("6d6045"), "name": "Bog"},
	"blight": {"glyph": "☠", "col": Color("8d6f86"), "name": "Blight"},
}

const SYMBOL_ORDER := ["clover", "honey", "moon", "star", "bog", "blight"]

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
var _reel_labels: Array[Label] = []
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
	set_anchors_preset(Control.PRESET_FULL_RECT)

	var bg := ColorRect.new()
	bg.color = COL_BG
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

	_lbl_day = _stat_label("Day 1", COL_CREAM)
	row.add_child(_lbl_day)
	_lbl_money = _stat_label("£240", COL_OCHRE)
	row.add_child(_lbl_money)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(spacer)

	_lbl_charms = _stat_label("☘ 6", COL_MOSS)
	row.add_child(_lbl_charms)
	_lbl_luck = _stat_label("Luck 0.0", COL_SLATE)
	row.add_child(_lbl_luck)

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
	ghead.add_child(_label("MILESTONE", COL_OCHRE, 11))

	_lbl_goal = _label("", COL_CREAM, 12)
	_lbl_goal.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	grow.add_child(_lbl_goal)

	_lbl_goal_sub = _label("", COL_DIM, 11)
	_lbl_goal_sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	grow.add_child(_lbl_goal_sub)

	_bar_goal = ProgressBar.new()
	_bar_goal.show_percentage = false
	_bar_goal.custom_minimum_size = Vector2(0, 6)
	_bar_goal.max_value = 1.0
	_bar_goal.step = 0.001
	_bar_goal.add_theme_stylebox_override("background", _panel_style(COL_BG))
	_bar_goal.add_theme_stylebox_override("fill", _panel_style(COL_OCHRE))
	grow.add_child(_bar_goal)
	return panel


func _build_reel_strip() -> Control:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(COL_PANEL_HI))

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	panel.add_child(col)

	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 8)
	col.add_child(head)

	var title := Label.new()
	title.text = "FATE REEL"
	title.add_theme_color_override("font_color", COL_OCHRE)
	title.add_theme_font_size_override("font_size", 15)
	head.add_child(title)

	head.add_child(_icon("reel_wheel", 26))

	_lbl_payout = Label.new()
	_lbl_payout.text = "×1.00"
	_lbl_payout.add_theme_color_override("font_color", COL_CREAM)
	_lbl_payout.add_theme_font_size_override("font_size", 15)
	head.add_child(_lbl_payout)

	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(sp)

	_btn_table = Button.new()
	_btn_table.text = "Odds"
	_btn_table.flat = true
	_btn_table.add_theme_color_override("font_color", COL_SLATE)
	_btn_table.add_theme_font_size_override("font_size", 13)
	_btn_table.pressed.connect(_toggle_table)
	head.add_child(_btn_table)

	_btn_spin = Button.new()
	_btn_spin.text = "Spin (2☘)"
	_btn_spin.add_theme_font_size_override("font_size", 15)
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
		cell.add_theme_stylebox_override("panel", _panel_style(COL_BG))
		var lbl := Label.new()
		lbl.text = "—"
		lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		lbl.add_theme_font_size_override("font_size", 26)
		cell.add_child(lbl)
		reels.add_child(cell)
		_reel_labels.append(lbl)

	_table_panel = _build_odds_table()
	_table_panel.visible = false
	col.add_child(_table_panel)

	_lbl_status = Label.new()
	_lbl_status.text = ""
	_lbl_status.add_theme_color_override("font_color", COL_DIM)
	_lbl_status.add_theme_font_size_override("font_size", 13)
	_lbl_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(_lbl_status)
	return panel


func _build_odds_table() -> PanelContainer:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(COL_BG))

	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 2)
	panel.add_child(grid)

	var head := Label.new()
	head.text = "Symbol      Payout"
	head.add_theme_color_override("font_color", COL_DIM)
	head.add_theme_font_size_override("font_size", 13)
	grid.add_child(head)
	grid.add_child(_spacer(6, 20))
	grid.add_child(_spacer(6, 20))

	for s in SYMBOL_ORDER:
		var st: Dictionary = SYMBOL_STYLE[s]
		var l := Label.new()
		l.text = "%s %s" % [st["glyph"], st["name"]]
		l.add_theme_color_override("font_color", st["col"])
		l.add_theme_font_size_override("font_size", 13)
		grid.add_child(l)

		var m := Label.new()
		m.text = "×%.2f" % float(ReelCore.SYMBOLS[s]["mult"])
		m.add_theme_color_override("font_color", COL_CREAM)
		m.add_theme_font_size_override("font_size", 13)
		grid.add_child(m)

		grid.add_child(_spacer(6, 20))

	var ev := Label.new()
	ev.text = "EV now %.3f   ·   a miss still pays ×1.00" % state.sim.reel.expected_value()
	ev.add_theme_color_override("font_color", COL_DIM)
	ev.add_theme_font_size_override("font_size", 12)
	ev.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var wrap := HBoxContainer.new()
	wrap.add_child(ev)
	grid.add_child(wrap)
	return panel


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
	_btn_new.add_theme_color_override("font_color", COL_RUST)
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
	_lbl_money.add_theme_color_override("font_color",
		COL_RUST if state.money() < 0 else COL_OCHRE)
	_lbl_charms.text = "☘ %d" % state.charms()
	_lbl_luck.text = "Luck %.1f" % state.luck()

	var pending := state.pending_payout()
	if pending > 1.0:
		_lbl_payout.text = "×%.2f today" % pending
		_lbl_payout.add_theme_color_override("font_color", COL_OCHRE)
	else:
		_lbl_payout.text = "×1.00 today"
		_lbl_payout.add_theme_color_override("font_color", COL_DIM)

	_btn_spin.disabled = not state.can_spin() or _spin_active
	_btn_spin.text = "Spin (%d☘)" % state.charm_cost()

	# The milestone strip: the next goal on the ladder and how close it is.
	var ng := state.next_goal()
	if ng.is_empty():
		_lbl_goal.text = "Every milestone earned. The gallery is yours."
		_lbl_goal.add_theme_color_override("font_color", COL_OCHRE)
		_lbl_goal_sub.text = ""
		_bar_goal.value = 1.0
	else:
		var g: Dictionary = ng["goal"]
		_lbl_goal.text = str(g["title"])
		_lbl_goal.add_theme_color_override("font_color", COL_CREAM)
		_lbl_goal_sub.text = "%s   (%d/%d)" % [str(g["body"]),
			int(ng["progress"]), int(ng["target"])]
		_bar_goal.value = clampf(float(ng["progress"]) / maxf(1.0, float(ng["target"])), 0.0, 1.0)

	for i in _tab_buttons.size():
		_tab_buttons[i].button_pressed = (i == _current_tab)

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
		COL_DIM, 13))
	_content.add_child(case_row)

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
		row.add_child(_label("%s  %s" % [grade.capitalize(), "×%d" % n],
			GRADE_COL[grade], 17))
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
		col.add_child(_label(" · ".join(bits),
			COL_RUST if (earning < n or risk > 0.07) else COL_DIM, 12))
		_content.add_child(card)

	if not any:
		_content.add_child(_hint("The gallery is empty. Move something up from the vault."))

	_content.add_child(_spacer(0, 6))
	_content.add_child(_section_title("Slots"))
	var slots := _label("%d of %d slots in use  ·  %d slot(s) free"
		% [state.on_display(), state.gallery_slots(), state.slots_free()], COL_DIM, 13)
	_content.add_child(slots)

	_content.add_child(_spacer(0, 8))
	_content.add_child(_section_title("Today"))
	_content.add_child(_label("Demand: %d exhibit(s)  ·  Upkeep: £%d/day"
		% [state.demand(), state.upkeep()], COL_DIM, 13))
	_content.add_child(_label("Storeroom: %d raw find(s) waiting to be catalogued"
		% state.raw_count(), COL_DIM, 13))


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
		row.add_child(_label("%s  ×%d" % [grade.capitalize(), n], GRADE_COL[grade], 17))
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
		sell.add_theme_color_override("font_color", COL_RUST)
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

	for i in state.sites():
		var running := state.dig_in_progress(i)
		var card := _card(COL_PANEL_HI)
		var row := _card_row(card)
		row.add_child(_icon("dig_site", 34))
		row.add_child(_label("Site %d" % (i + 1), COL_CREAM, 17))

		if not running.is_empty():
			row.add_child(_spacer(8, 0))
			var dig: String = running["dig"]
			var left := int(running["ready_day"]) - state.day()
			row.add_child(_label("%s — %d day(s) left" % [_dig_name(dig), maxi(0, left)],
				COL_MOSS, 15))
		else:
			row.add_child(_spacer(6, 0))
			var btns := HBoxContainer.new()
			btns.add_theme_constant_override("separation", 6)
			for dig in ["test_pit", "trench", "shaft"]:
				var b := _button("%s £%d · %dd" % [_dig_name(dig), state.dig_cost(dig),
					state.dig_days(dig)], func(d = dig): state.assign_dig(i, d))
				b.add_theme_font_size_override("font_size", 12)
				b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				# Digs are allowed ON CREDIT. Blocking an unaffordable dig
				# would dead-end the game: broke, no finds, no exhibits, no
				# income, and nothing left to press. The debt is the
				# punishment, not a locked button.
				if state.money() < state.dig_cost(dig):
					b.add_theme_color_override("font_color", COL_RUST)
				btns.add_child(b)
			row.add_child(btns)

			var pending := state.pending_dig(i)
			if pending != "":
				row.add_child(_spacer(6, 0))
				row.add_child(_label("Assigned: %s" % _dig_name(pending), COL_OCHRE, 13))

		_content.add_child(card)


func _dig_name(dig: String) -> String:
	match dig:
		"test_pit": return "Test Pit"
		"trench": return "Trench"
		"shaft": return "Shaft"
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
		["archivists", "Archivists", "+8% value on every curated exhibit."],
		["wards", "Ward Fairies", "Reduce the chance of overnight theft."],
	]

	for r in rows:
		var kind: String = r[0]
		var cost := state.upgrade_cost(kind)
		var card := _card(COL_PANEL_HI)
		var row := _card_row(card)
		if kind == "curator":
			row.add_child(_icon("curator", 30))
		row.add_child(_label("%s  (owned %d)" % [r[1], state.upgrade_count(kind)],
			COL_CREAM, 16))
		row.add_child(_spacer(4, 0))
		row.add_child(_label(str(r[2]), COL_DIM, 12))

		var sp := Control.new()
		sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(sp)

		if cost < 0:
			row.add_child(_label("MAX", COL_OCHRE, 15))
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
	for l in _reel_labels:
		l.text = "?"
		l.add_theme_color_override("font_color", COL_DIM)


func _process(delta: float) -> void:
	if not _spin_active:
		return
	_spin_t += delta
	var reels: Array = _spin_result["reels"]
	var all_stopped := true
	for i in _reel_labels.size():
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
				_reel_labels[i].text = SYMBOL_STYLE[s]["glyph"]
				_reel_labels[i].add_theme_color_override("font_color", COL_DIM)
		else:
			# This reel has landed and locked in its result.
			var s: String = reels[i]
			_reel_labels[i].text = SYMBOL_STYLE[s]["glyph"]
			_reel_labels[i].add_theme_color_override("font_color", SYMBOL_STYLE[s]["col"])
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
	_lbl_status.text = msg
	_lbl_status.add_theme_color_override("font_color",
		COL_OCHRE if payout > 1.0 else (COL_RUST if payout < 1.0 else COL_DIM))
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
	_lbl_status.text = "  ·  ".join(bits)
	_lbl_status.add_theme_color_override("font_color", COL_CREAM)
	_autosave()
	_show_day_report(s)
	_refresh()


# ---------------------------------------------------------------- day report

## The end-of-day panel. This is the moment the player actually reads, so it
## says what happened in words, not just in numbers.
func _show_day_report(s: Dictionary) -> void:
	_clear_overlay()

	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.72)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_overlay.add_child(dim)

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

	col.add_child(_report_line("Takings", "£%d" % revenue,
		COL_OCHRE if revenue > 0 else COL_DIM))
	if opex > 0:
		col.add_child(_report_line("Upkeep & dig costs", "-£%d" % opex, COL_DIM))
	if int(s["capex"]) > 0:
		col.add_child(_report_line("Invested", "-£%d" % int(s["capex"]), COL_SLATE))
	col.add_child(_report_line("Net", "%s£%d" % ["+" if delta >= 0 else "-", absi(delta)],
		COL_MOSS if delta >= 0 else COL_RUST))

	col.add_child(_spacer(0, 4))

	var payout := float(s["payout"])
	if absf(payout - 1.0) > 0.001:
		col.add_child(_report_line("Fate Reel", "×%.2f" % payout,
			COL_OCHRE if payout > 1.0 else COL_RUST))

	var curated := int(s["curated"])
	if curated > 0:
		col.add_child(_report_line("Catalogued", "%d find(s)" % curated, COL_CREAM))
	if int(s["digs_done"]) > 0:
		col.add_child(_report_line("Digs finished", "%d" % int(s["digs_done"]), COL_CREAM))

	var stolen := int(s["stolen"])
	if stolen > 0:
		var grades: Dictionary = s["stolen_grades"]
		var named: Array[String] = []
		for g in ["crown", "relic", "clay", "rubble"]:
			var n := int(grades.get(g, 0))
			if n > 0:
				named.append("%d %s" % [n, g])
		col.add_child(_report_line("STOLEN", ", ".join(named), COL_RUST))

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
func _report_line(key: String, value: String, col: Color) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.add_child(_label(key, COL_DIM, 15))
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(sp)
	row.add_child(_label(value, col, 16))
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
	var card := _card(COL_OCHRE)
	var row := _card_row(card)
	row.add_child(_icon("curator", 30))
	row.add_child(_label(state.tutorial.current_title(), COL_OCHRE, 17))
	row.add_child(_spacer(4, 0))
	row.add_child(_label(state.tutorial.current_body(), COL_CREAM, 13))
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(sp)
	if str(state.tutorial.current().get("done", "")) == "":
		row.add_child(_button("Got it", func(): state.tutorial.advance()))
	var skip := _button("Skip", func(): state.skip_tutorial())
	skip.add_theme_color_override("font_color", COL_DIM)
	skip.add_theme_font_size_override("font_size", 12)
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
			_content.add_child(_label(t.to_upper(), COL_OCHRE, 13))

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
		title_col.add_child(_label(str(g["title"]), COL_CREAM if not done else COL_MOSS, 15))
		title_col.add_child(_label(str(g["body"]), COL_DIM, 12))

		if done:
			row.add_child(_label("✓ EARNED", COL_MOSS, 13))
		else:
			row.add_child(_label("%d/%d" % [int(e["progress"]), int(e["target"])],
				COL_OCHRE, 13))

		var reward := _label("Reward: %s" % state.goals.reward_text(g), COL_DIM, 11)
		col.add_child(reward)

		if not done:
			var bar := ProgressBar.new()
			bar.show_percentage = false
			bar.custom_minimum_size = Vector2(0, 5)
			bar.max_value = maxf(1.0, float(e["target"]))
			bar.value = float(e["progress"])
			bar.add_theme_stylebox_override("background", _panel_style(COL_BG))
			bar.add_theme_stylebox_override("fill", _panel_style(COL_OCHRE))
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
		head.add_child(_label("Day", COL_DIM, 13))
		head.add_child(_label("Takings", COL_DIM, 13))
		head.add_child(_label("Costs", COL_DIM, 13))
		head.add_child(_label("Net", COL_DIM, 13))
		head.add_child(_label("Cur", COL_DIM, 13))
		head.add_child(_label("Stol", COL_DIM, 13))

		var n := rev.size()
		var start := maxi(0, n - 40)
		for i in range(n - 1, start - 1, -1):
			var net := int(rev[i]) - int(opx[i]) if i < opx.size() else 0
			var row := HBoxContainer.new()
			row.add_theme_constant_override("separation", 6)
			row.add_child(_label("%d" % (i + 1), COL_CREAM, 13))
			row.add_child(_label("%d" % int(rev[i]), COL_OCHRE, 13))
			row.add_child(_label("%d" % (int(opx[i]) if i < opx.size() else 0), COL_DIM, 13))
			row.add_child(_label("%s%d" % ["+" if net >= 0 else "-", absi(net)],
				COL_MOSS if net >= 0 else COL_RUST, 13))
			row.add_child(_label("%d" % (int(cur[i]) if i < cur.size() else 0), COL_CREAM, 13))
			row.add_child(_label("%d" % (int(stol[i]) if i < stol.size() else 0),
				COL_RUST if (i < stol.size() and int(stol[i]) > 0) else COL_DIM, 13))
			_content.add_child(row)

	_content.add_child(_spacer(0, 10))
	_content.add_child(_section_title("Recent events"))
	var events := state.recent_events(12)
	if events.is_empty():
		_content.add_child(_hint("Nothing recorded yet."))
	for e in events:
		var kind := str(e.get("kind", "plain"))
		var tint := COL_CREAM
		match kind:
			"day": tint = COL_OCHRE
			"display": tint = COL_MOSS
			"upgrade": tint = COL_SLATE
			"sale": tint = COL_RUST
			"dig": tint = COL_DIM
		_content.add_child(_label("Day %d — %s" % [int(e.get("day", 0)),
			str(e.get("text", ""))], tint, 13))


# ---------------------------------------------------------------- save/load

func _on_save_pressed() -> void:
	if state.save_to_disk():
		_lbl_status.text = "Saved."
		_lbl_status.add_theme_color_override("font_color", COL_MOSS)
	else:
		_lbl_status.text = "Could not save."
		_lbl_status.add_theme_color_override("font_color", COL_RUST)


func _on_load_pressed() -> void:
	if state.load_from_disk():
		_lbl_status.text = "Loaded."
		_lbl_status.add_theme_color_override("font_color", COL_MOSS)
		_clear_overlay()
		_refresh()
	else:
		_lbl_status.text = "No save found."
		_lbl_status.add_theme_color_override("font_color", COL_RUST)


## New Game is destructive, so it asks twice. The button arms, then a second
## press within the same session does it. It also clears the save on disk,
## so "new game" means genuinely new and not secretly continuing later.
func _on_new_pressed() -> void:
	if not _new_armed:
		_new_armed = true
		_btn_new.text = "Really?"
		_btn_new.add_theme_color_override("font_color", COL_RUST)
		return
	_new_armed = false
	_btn_new.text = "New Game"
	SaveSystem.clear_save()
	state.reset()
	_clear_overlay()
	_lbl_status.text = "A fresh outfit. Good luck."
	_lbl_status.add_theme_color_override("font_color", COL_OCHRE)
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

	var card := _card(COL_OCHRE)
	var col := _card_col(card)

	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 8)
	col.add_child(head)
	head.add_child(_label("TODAY: %s" % str(ev.get("title", "")),
		COL_OCHRE, 17))

	var body := _label(str(ev.get("text", "")), COL_CREAM, 13)
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
		col.add_child(_label("· ".join(effects), COL_SLATE, 12))

	return card


func _section_title(text: String) -> Control:
	var l := _label(text, COL_OCHRE, 19)
	return l


func _hint(text: String) -> Control:
	var l := _label(text, COL_DIM, 13)
	return l


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


func _panel_style(col: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = col
	s.border_color = COL_LINE
	s.set_border_width_all(1)
	s.set_corner_radius_all(6)
	s.content_margin_left = 10
	s.content_margin_right = 10
	s.content_margin_top = 8
	s.content_margin_bottom = 8
	return s


## Build a card. Returns the PanelContainer so it can be added to the tree;
## the HBox inside it is where row content goes.
func _card(accent: Color) -> PanelContainer:
	var panel := PanelContainer.new()
	var style := _panel_style(COL_PANEL_HI)
	style.border_color = accent.darkened(0.45)
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
