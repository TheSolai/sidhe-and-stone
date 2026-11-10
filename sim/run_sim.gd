extends SceneTree
## Headless economy + Fate Reel balance harness.
##
## Run:
##   godot --headless --path . --script res://sim/run_sim.gd -- --days=365
##
## Optional tuning flags (all prefixed with --):
##   --days=N              simulated days (default 365)
##   --demand-growth=N     how fast market demand grows
##   --market-gain=F       demand multiplier per 'market' upgrade
##   --upkeep-plot=N       daily operating cost per plot
##   --reel-policy=MODE    always | off | never-spins (default always)
##   --reel-cost=N         charms per spin
##   --charm-rate=F        charms earned per paying exhibit
##   --reel-seed=N         RNG seed for reproducible runs
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
		elif a.begins_with("--reel-policy="):
			core.reel_policy = a.split("=")[1]
		elif a.begins_with("--reel-cost="):
			core.reel_charm_cost = int(a.split("=")[1])
		elif a.begins_with("--charm-rate="):
			core.charm_per_unit = float(a.split("=")[1])
		elif a.begins_with("--reel-seed="):
			core.reel.reseed(int(a.split("=")[1]))

	var result := core.run(days)
	var report := SimCore.analyse(
		result["money_curve"],
		core.revenue_log,
		core.opex_log,
		core.capex_log,
		core.reel_revenue_log
	)

	print("=== GameStewKit balance report (%d days) ===" % days)
	print("money: day1=%d  final=%d" % [report["day1"], report["final"]])
	print("operating income/day: early=%.0f  late=%.0f   volatility CV=%.2f" % [
		report["net_early"], report["net_late"], report["net_cv"]])
	print("active days: %.1f%%   capex share of revenue: %.1f%%" % [
		report["active_pct"] * 100.0, report["capex_share"] * 100.0])
	print("reel: %.1f%% of revenue | spins=%d avg payout=%.3f | luck=%.2f | EV(luck)=%.3f EV(0)=%.3f" % [
		report["reel_share"] * 100.0,
		result["reel_spins"],
		result["reel_avg_payout"],
		result["luck"],
		core.reel.expected_value(),
		core.reel.expected_value(0.0)])
	print("owned: plots=%d mills=%d market=%d omens=%d charms=%d" % [
		result["plots"], result["mills"], result["market"],
		result["omens"], result["charms"]])
	print("VERDICT: %s (%s)" % [report["verdict"], report["detail"]])
	quit()
