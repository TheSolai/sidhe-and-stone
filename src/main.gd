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

const SYMBOL_STYLE := {
	"clover": {"glyph": "☘", "col": Color("7d9a52"), "name": "Clover"},
	"honey": {"glyph": "❋", "col": Color("e0a83c"), "name": "Honey"},
	"moon": {"glyph": "☾", "col": Color("9fb6cf"), "name": "Moon"},
	"star": {"glyph": "★", "col": Color("f2e2a8"), "name": "Star"},
	"bog": {"glyph": "≈", "col": Color("6d6045"), "name": "Bog"},
	"blight": {"glyph": "☠", "col": Color("8d6f86"), "name": "Blight"},
}

const SYMBOL_ORDER := ["clover", "honey", "moon", "star", "bog", "blight"]

const TABS := ["Gallery", "Vault", "Digs", "Staff"]

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


func _ready() -> void:
	state.changed.connect(_on_state_changed)
	_build_ui()
	_refresh()


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


func _build_topbar() -> Control:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(COL_PANEL))

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	panel.add_child(row)

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
	_lbl_day.text = "Day %d" % state.day()
	_lbl_money.text = "£%d" % state.money()
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

	for i in _tab_buttons.size():
		_tab_buttons[i].button_pressed = (i == _current_tab)

	_rebuild_content()


func _rebuild_content() -> void:
	for c in _content.get_children():
		_content.remove_child(c)
		c.queue_free()

	match _current_tab:
		0: _build_gallery_tab()
		1: _build_vault_tab()
		2: _build_digs_tab()
		3: _build_staff_tab()


# ---------------------------------------------------------------- gallery

func _build_gallery_tab() -> void:
	_content.add_child(_section_title("The Gallery"))
	_content.add_child(_hint(
		"Visitors pay for the %d most valuable exhibits on display today. "
		% state.demand()
		+ "Anything beyond that earns nothing but can still be stolen."))

	var gallery := state.gallery_counts()
	var any := false
	for grade in GRADE_ORDER:
		var n := int(gallery.get(grade, 0))
		if n <= 0:
			continue
		any = true
		var card := _card(GRADE_COL[grade])
		var row := _card_row(card)
		row.add_child(_label("%s  %s" % [grade.capitalize(), "×%d" % n],
			GRADE_COL[grade], 17))
		row.add_child(_spacer(8, 0))
		var value := _label("£%d/day each" % state.exhibit_value(grade), COL_DIM, 13)
		row.add_child(value)
		var sp := Control.new()
		sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(sp)
		var b := _button("To Vault", func(): state.vault_one(grade))
		row.add_child(b)
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

	for i in state.sites():
		var running := state.dig_in_progress(i)
		var card := _card(COL_PANEL_HI)
		var row := _card_row(card)
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
				b.disabled = state.money() < state.dig_cost(dig)
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
	# Cycle through symbols for a beat before settling.
	if _spin_t < 0.9:
		if fmod(_spin_t, 0.08) < delta:
			_spin_cycle += 1
			for i in _reel_labels.size():
				var s: String = SYMBOL_ORDER[_spin_cycle % SYMBOL_ORDER.size()]
				_reel_labels[i].text = SYMBOL_STYLE[s]["glyph"]
				_reel_labels[i].add_theme_color_override("font_color", COL_DIM)
		return

	# Settled: reveal the real result.
	_spin_active = false
	_spin_revealed = true
	var reels: Array = _spin_result["reels"]
	for i in _reel_labels.size():
		var s: String = reels[i]
		_reel_labels[i].text = SYMBOL_STYLE[s]["glyph"]
		_reel_labels[i].add_theme_color_override("font_color", SYMBOL_STYLE[s]["col"])

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
	return l


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
