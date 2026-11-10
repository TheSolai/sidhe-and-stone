extends SceneTree
## The player-path balance harness.
##
## Run:
##   godot --headless --path . --script res://sim/run_player_balance.gd -- --days=180
##
## WHY THIS EXISTS
##
## The original harness drove SimCore directly, on autopilot. That proved the
## economy was balanced for a SIMULATION - not for a game. Milestones live in
## GameState, so an autopilot never saw a milestone payout, never had its
## spending decisions changed by one, and never proved that the ladder the
## player climbs is worth anything.
##
## The GDD's invariant is that proved balance equals felt balance. That is
## only true if the harness plays the player's game: same object, same
## actions, same rewards. So this harness drives GameState through
## PlayerPath - a competent player written as code.
##
## It also measures the MILESTONE LADDER, which is the part that was wrong.
## A milestone reward has to be worth a meaningful slice of the income the
## player has at the moment it lands. Too small and the ladder stops
## mattering; too large and the milestone replaces the game. This harness
## MEASURES that ratio on every run and fails if a reward drifts outside
## the band, so the rule cannot rot.
##
## Optional flags (all prefixed with --):
##   --days=N          simulated days (default 180)
##   --reel-policy=M   always | off (default always)
##   --reel-cost=N     charms per spin
##   --charm-rate=F    charms earned per paying exhibit
##   --reel-seed=N     RNG seed for reproducible runs
##
## Exit code is always 0; read the VERDICT lines.

## A milestone reward should be worth roughly this many days of the player's
## gross takings at the moment it lands. Four days is enough to feel like an
## event and small enough that the player still has to keep trading.
const TARGET_DAYS := 4.0
## ...and never outside this band, expressed as a multiple of DAILY gross
## takings. Below the floor the milestone is wallpaper; above the ceiling it
## replaces the game.
const RATIO_FLOOR := 1.0
const RATIO_CEILING := 12.0


func _init() -> void:
	var days := 180
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--days="):
			days = int(a.split("=")[1])

	var state := GameState.new()
	var core := state.sim
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--reel-policy="):
			core.reel_policy = a.split("=")[1]
		elif a.begins_with("--reel-cost="):
			core.reel_charm_cost = int(a.split("=")[1])
		elif a.begins_with("--charm-rate="):
			core.charm_per_unit = float(a.split("=")[1])
		elif a.begins_with("--reel-seed="):
			core.reel.reseed(int(a.split("=")[1]))

	var result := PlayerPath.play(state, days)

	# --- the economy report, judged on operating income like the old harness
	var report := SimCore.analyse(
		result["money_curve"],
		result["revenue_log"],
		result["opex_log"],
		result["capex_log"],
		result["reel_revenue_log"]
	)

	print("=== SIDHE & STONE player-path balance report (%d days) ===" % days)
	print("money: day1=%d  final=%d" % [report["day1"], report["final"]])
	print("operating income/day: early=%.0f  late=%.0f   volatility CV=%.2f" % [
		report["net_early"], report["net_late"], report["net_cv"]])
	print("active days: %.1f%%   capex share of revenue: %.1f%%" % [
		report["active_pct"] * 100.0, report["capex_share"] * 100.0])
	print("reel: %.1f%% of revenue | spins=%d avg payout=%.3f | luck=%.2f" % [
		report["reel_share"] * 100.0, result["spins"], result["avg_payout"], result["luck"]])
	print("owned: sites=%d curators=%d gallery=%d omens=%d charms=%d" % [
		result["sites"], result["curators"], result["gallery_upgrades"],
		result["omens"], result["charms"]])
	print("ECONOMY VERDICT: %s (%s)" % [report["verdict"], report["detail"]])

	# --- the milestone ladder, measured
	print("")
	print("=== milestone ladder (player path) ===")
	print("%-20s %5s %9s %10s %8s %8s" % [
		"goal", "day", "reward", "takings/day", "ratio", "suggest"])
	var ladder_failures: Array[String] = []
	for g in result["goal_days"]:
		var reward := int(g["reward_money"])
		var daily := float(g["revenue_daily"])
		var ratio := 0.0
		if daily > 1.0 and reward > 0:
			ratio = float(reward) / daily
		var suggest := 0
		if daily > 1.0:
			suggest = int(round(TARGET_DAYS * daily / 50.0)) * 50
		print("%-20s %5d %9d %10.0f %8s %8d" % [
			str(g["title"]), int(g["day"]), reward, daily,
			("%.2f" % ratio) if ratio > 0.0 else "-", suggest])

		# Only cash milestones can be measured against income. A milestone
		# paid in charms or luck is a different kind of gift.
		if reward <= 0:
			continue
		if daily <= 1.0:
			# The goal landed while the gallery was not yet earning. A cash
			# reward here is pure noise: it dwarfs the takings it is supposed
			# to scale against, and it quietly patches a hole in the economy
			# instead of rewarding progress.
			ladder_failures.append("%s landed on day %d with no takings (£%d reward)"
				% [str(g["title"]), int(g["day"]), reward])
			continue
		if ratio < RATIO_FLOOR:
			ladder_failures.append("%s pays %.2fx daily takings (floor %.1fx) - the milestone stops mattering"
				% [str(g["title"]), ratio, RATIO_FLOOR])
		elif ratio > RATIO_CEILING:
			ladder_failures.append("%s pays %.2fx daily takings (ceiling %.1fx) - the milestone replaces the game"
				% [str(g["title"]), ratio, RATIO_CEILING])

	if ladder_failures.is_empty():
		print("LADDER VERDICT: healthy (every cash milestone is worth %.1f-%.1fx daily takings)"
			% [RATIO_FLOOR, RATIO_CEILING])
	else:
		print("LADDER VERDICT: MIS-SCALED")
		for f in ladder_failures:
			print("  - %s" % f)

	quit()
