extends SceneTree
## Generate a full-fidelity fixture for the web port's economy parity test.
##
## Run:
##   godot --headless --path . --script res://sim/gen_curve_fixtures.gd -- --out=web/tests/fixtures/godot_curve_fixture.json
##
## This dumps the ENTIRE observable state of a 365-day autopilot run --
## every daily ledger, every rolled event, and the final state including
## both RNG states -- so the TypeScript port can be compared element for
## element rather than only on its headline numbers.

func _init() -> void:
	var out_path := "web/tests/fixtures/godot_curve_fixture.json"
	var days := 365
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_path = a.split("=")[1]
		elif a.begins_with("--days="):
			days = int(a.split("=")[1])

	var core := SimCore.new()
	var result := core.run(days)
	var report := SimCore.analyse(
		result["money_curve"],
		core.revenue_log,
		core.opex_log,
		core.capex_log,
		core.reel_revenue_log
	)

	# The event that governed each day, in order. The deck is rolled ahead of
	# the day it governs, so the first entry is the event of day 1 and the
	# last entry is the event of a day that has not been played yet.
	var event_ids: Array = []
	for e in core.event_log:
		event_ids.append(str(e.get("id", "")))

	# GDScript dictionaries iterate in INSERTION order, and JSON.stringify
	# SORTS object keys alphabetically. That would silently destroy the
	# ordering the simulation actually depends on, so every dictionary is
	# emitted as an ordered array of [key, value] pairs instead.
	var ordered := func(d: Dictionary) -> Array:
		var pairs: Array = []
		for k in d:
			pairs.append([str(k), d[k]])
		return pairs

	var digging_pairs: Array = []
	for p in core.digging:
		digging_pairs.append([str(p), core.digging[p]])

	var fixture := {
		"days": days,
		"money_curve": result["money_curve"],
		"revenue_log": core.revenue_log,
		"opex_log": core.opex_log,
		"capex_log": core.capex_log,
		"reel_revenue_log": core.reel_revenue_log,
		"stolen_log": core.stolen_log,
		"curated_log": core.curated_log,
		"event_ids": event_ids,
		"analysis": report,
		"final_state": {
			"day": core.day,
			"money": core.money,
			"sites": core.sites,
			"curators": core.curators,
			"charms": core.charms,
			"raw": ordered.call(core.raw),
			"vault": ordered.call(core.vault),
			"gallery": ordered.call(core.gallery),
			"upgrades_bought": ordered.call(core.upgrades_bought),
			"digging": digging_pairs,
			"reel": core.reel.to_dict(),
			"rng_state": str(core.rng.state),
			"event_rng_state": str(core.event_rng.state),
		},
	}

	var file := FileAccess.open(out_path, FileAccess.WRITE)
	if file == null:
		printerr("could not open %s for writing" % out_path)
		quit(1)
		return
	file.store_string(JSON.stringify(fixture, "  "))
	file.close()
	print("WROTE %s (%d days, %d events)" % [out_path, days, event_ids.size()])
	print("VERDICT: %s (%s)" % [report["verdict"], report["detail"]])
	quit()
