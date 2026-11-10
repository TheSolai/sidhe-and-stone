extends SceneTree
## Headless economy balance harness.
##
## Run:
##   godot --headless --path . --script res://sim/run_sim.gd -- --days=365
##
## Optional tuning flags (all prefixed with --):
##   --days=N              simulated days (default 365)
##   --demand-growth=N     how fast market demand grows
##   --market-gain=F       demand multiplier per 'market' upgrade
##   --upkeep-plot=N       daily operating cost per plot
##
## Exit code is always 0; read the VERDICT line. This harness is the reason
## to build the economy as pure logic: balance is measurable without a
## single sprite, scene or sound effect.

func _init() -> void:
	var days := 365
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--days="):
			days = int(a.split("=")[1])

	var core := SimCore.new()
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--demand-growth="):
			core.demand_growth = float(a.split("=")[1])
		elif a.begins_with("--market-gain="):
			core.market_gain = float(a.split("=")[1])
		elif a.begins_with("--upkeep-plot="):
			core.upkeep_per_plot = int(a.split("=")[1])

	var result := core.run(days)
	var report := SimCore.analyse(
		result["money_curve"],
		core.revenue_log,
		core.expense_log
	)

	print("=== GameStewKit balance report (%d days) ===" % days)
	print("money: day1=%d  final=%d" % [report["day1"], report["final"]])
	print("net income/day: early=%.0f  late=%.0f" % [report["net_early"], report["net_late"]])
	print("active days: %.1f%%" % (report["active_pct"] * 100.0))
	print("owned: plots=%d mills=%d market=%d" % [result["plots"], result["mills"], result["market"]])
	print("VERDICT: %s (%s)" % [report["verdict"], report["detail"]])
	quit()
