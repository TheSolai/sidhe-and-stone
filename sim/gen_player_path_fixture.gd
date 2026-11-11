extends SceneTree
## Generate a fixture for the web port's PLAYER-PATH parity test.
##
## Run:
##   godot --headless --path . --script res://sim/gen_player_path_fixture.gd -- --out=web/tests/fixtures/godot_player_path_fixture.json
##
## The player path is the honest balance harness: it drives GameState -- the
## same object the UI drives, through the same actions -- so it is the run
## that actually proves the milestone ladder is worth something. The web port
## must reproduce it exactly.

func _init() -> void:
	var out_path := "web/tests/fixtures/godot_player_path_fixture.json"
	var days := 180
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_path = a.split("=")[1]
		elif a.begins_with("--days="):
			days = int(a.split("=")[1])

	var state := GameState.new()
	var result := PlayerPath.play(state, days)

	var goal_days: Array = []
	for g in result["goal_days"]:
		goal_days.append({
			"id": str(g["id"]),
			"title": str(g["title"]),
			"day": int(g["day"]),
			"reward_money": int(g["reward_money"]),
			"operating_income_day": int(g["operating_income_day"]),
			"operating_income_daily": float(g["operating_income_daily"]),
			"operating_income_trail": float(g["operating_income_trail"]),
			"revenue_daily": float(g["revenue_daily"]),
			"revenue_trail": float(g["revenue_trail"]),
			"money_after": int(g["money_after"]),
		})

	var fixture := {
		"days": days,
		"money_curve": result["money_curve"],
		"revenue_log": result["revenue_log"],
		"opex_log": result["opex_log"],
		"capex_log": result["capex_log"],
		"reel_revenue_log": result["reel_revenue_log"],
		"goal_days": goal_days,
		"summary": {
			"spins": int(result["spins"]),
			"avg_payout": float(result["avg_payout"]),
			"luck": float(result["luck"]),
			"charms": int(result["charms"]),
			"sites": int(result["sites"]),
			"curators": int(result["curators"]),
			"gallery_upgrades": int(result["gallery_upgrades"]),
			"omens": int(result["omens"]),
		},
		"final_state": {
			"day": state.day(),
			"money": state.money(),
			"charms": state.charms(),
			"completed_goals": state.goals.completed.duplicate(),
			"ledger_size": state.ledger.size(),
		},
	}

	var file := FileAccess.open(out_path, FileAccess.WRITE)
	if file == null:
		printerr("could not open %s for writing" % out_path)
		quit(1)
		return
	file.store_string(JSON.stringify(fixture, "  "))
	file.close()
	print("WROTE %s (%d days, %d goals)" % [out_path, days, goal_days.size()])
	quit()
