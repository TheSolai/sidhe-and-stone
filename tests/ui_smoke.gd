extends SceneTree
## Headless smoke test for the SIDHE & STONE playable UI.
##
## A scene that parses is not a scene that runs. This drives the real UI
## through a full session: build the interface, assign digs, end days, spin
## the reel, move artefacts between vault and gallery, buy upgrades, and
## check the tree for errors at every step.
##
## Run: godot --headless --path . --script res://tests/ui_smoke.gd

const MAIN := preload("res://src/main.gd")

var failures: Array[String] = []
var checks := 0

func check(cond: bool, what: String) -> void:
	checks += 1
	if not cond:
		failures.append(what)
		print("  FAIL: %s" % what)

func _initialize() -> void:
	# The UI builds itself in _ready(), which does not run until the tree
	# starts processing. Doing the assertions here would test an empty
	# node, so the real work happens on the first frame instead.
	pass


func _process(delta: float) -> bool:
	# MainLoop._process returns true to quit. Run once, then stop.
	_run_tests()
	return true


func _run_tests() -> void:
	print("=== SIDHE & STONE UI smoke test ===")
	var ui: GameUI = MAIN.new()
	root.add_child(ui)

	# The UI builds itself in _ready.
	check(ui != null, "UI constructed")
	check(ui.get_child_count() > 0, "UI has children")

	var state: GameState = ui.state
	check(state != null, "state exists")
	check(state.sim.manual == true, "sim runs in manual mode")

	# --- tabs all render
	for tab in 4:
		ui._select_tab(tab)
		check(ui._content.get_child_count() > 0, "tab %d renders content" % tab)

	# --- reel is visible without navigating to a tab
	ui._select_tab(0)
	check(ui._reel_labels.size() == 3, "reel has three windows")
	check(ui._reel_labels[0].is_visible_in_tree(), "reel is visible on the gallery tab")

	# --- odds table toggles
	var was: bool = ui._table_panel.visible
	ui._toggle_table()
	check(ui._table_panel.visible != was, "odds table toggles")

	# --- player assigns a dig to every site
	for i in state.sites():
		state.assign_dig(i, "test_pit")
	check(state.pending_dig(0) == "test_pit", "dig assignment sticks")

	# --- reel spin actually spins and applies a payout
	var charms_before: int = state.charms()
	var res: Dictionary = state.spin_reel()
	check(not res.is_empty(), "reel spin returns a result")
	check(state.charms() == charms_before - state.charm_cost(), "spin costs charms")
	check(state.pending_payout() >= 0.85, "payout is within bounds")
	check(state.pending_payout() <= 2.6, "payout is within bounds")
	check(state.sim.reel.spins == 1, "reel counted the spin")

	# --- ending a day resolves the economy
	var money_before: int = state.money()
	var summary: Dictionary = state.end_day()
	check(state.day() == 1, "day advanced")
	check(summary.has("revenue"), "summary has revenue")
	check(summary.has("stolen"), "summary has theft count")
	check(state.money() != money_before, "money moved on the day")
	check(state.sim.revenue_log.size() == 1, "revenue logged")

	# --- artefacts eventually reach the vault and can be displayed
	var vaulted := false
	for _day in 20:
		for i in state.sites():
			state.assign_dig(i, "test_pit")
		state.end_day()
		if state.vault_count() > 0:
			vaulted = true
			break
	check(vaulted, "digs produce catalogued artefacts within 20 days")

	# --- display / vault movement
	var grade: String = ""
	var counts: Dictionary = state.vault_counts()
	for g in counts:
		if int(counts[g]) > 0:
			grade = g
			break
	check(grade != "", "found a grade to display")
	if grade != "":
		var shown_before: int = state.on_display()
		state.display_one(grade)
		check(state.on_display() == shown_before + 1, "artefact moved to display")
		state.vault_one(grade)
		check(state.on_display() == shown_before, "artefact moved back to the vault")

	# --- selling is the player's action and pays half value
	if grade != "":
		var m: int = state.money()
		var ok: bool = state.sim.sell_one(grade)
		if ok:
			check(state.money() > m, "dealer sale pays out")

	# --- upgrades can be bought
	var cost: int = state.upgrade_cost("site")
	if cost > 0:
		var sites_before: int = state.sites()
		state.sim.money = cost + 10
		state.buy_upgrade("site")
		check(state.sites() == sites_before + 1, "site upgrade adds a site")
		check(state.sim.money < cost + 10, "upgrade cost money")

	# --- the reel never dominates revenue over a long run.
	# The player spins EVERY day here, which is the greediest possible reel
	# usage. If the mechanic were a slot machine, this is where it would show.
	# The loop also PLAYS PROPERLY: it digs, then puts finds on display, then
	# spins, then ends the day. A loop that never displays anything earns
	# nothing, earns no charms, and would starve the reel for reasons that
	# have nothing to do with the reel.
	state.sim.money = 240
	var spins := 0
	for _d in 120:
		for i in state.sites():
			state.assign_dig(i, "test_pit")
		# Restock the gallery from the vault, best grades first.
		for g2 in ["crown", "relic", "clay", "rubble"]:
			while state.vault_count() > 0 and state.slots_free() > 0:
				if not state.sim.display_one(g2):
					break
		if state.can_spin():
			state.spin_reel()
			spins += 1
		state.end_day()
	var reel_total := 0
	var gross := 0
	for i in state.sim.revenue_log.size():
		gross += state.sim.revenue_log[i]
		reel_total += state.sim.reel_revenue_log[i]
	var share := (float(reel_total) / float(gross)) if gross > 0 else 0.0
	print("  reel share of revenue over 120 days, spinning every day: %.1f%%"
		% (share * 100.0))
	print("  spins: %d, avg payout: %.3f, gross revenue: %d"
		% [spins, state.sim.reel.payout_total / maxf(1.0, float(state.sim.reel.spins)), gross])
	check(gross > 0, "the playthrough actually earned revenue")
	check(spins > 20, "the reel was actually spun in the long run")
	check(share < 0.45, "reel does not dominate revenue")
	check(state.sim.reel.payout_total / maxf(1.0, float(state.sim.reel.spins)) < 2.6,
		"average reel payout stays inside the bound")

	# --- every tab still renders after all that
	for tab in 4:
		ui._select_tab(tab)
		check(ui._content.get_child_count() > 0, "tab %d still renders" % tab)

	print("=== %d checks, %d failures ===" % [checks, failures.size()])
	for f in failures:
		print("  - %s" % f)
	if failures.is_empty():
		print("SMOKE TEST PASSED")
	else:
		print("SMOKE TEST FAILED")
	quit(0 if failures.is_empty() else 1)
