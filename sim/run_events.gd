extends SceneTree
## Event-deck balance harness.
##
## Run:
##   godot --headless --path . --script res://sim/run_events.gd -- --days=365
##
## THE QUESTION THIS ANSWERS:
##   "Does the event deck change the economy?"
##
## A deck of daily events is the easiest way to accidentally rebalance a
## management sim without noticing. A rainy day that quietly pays out every
## third week, or a "lucky" event that inflates takings, will change every
## balance number in the game while looking like pure flavour. The player
## would then be playing a different economy from the one the balance
## harness proved.
##
## So this harness measures the deck instead of trusting it:
##
##   1. DECK EV - the deck's own multipliers must average to neutral
##      (demand 1.0, theft 1.0, curation 0.0), with the charm windfall
##      kept deliberately small.
##   2. ECONOMY EV - the SAME simulation run twice, once with the deck on
##      and once with it off, must produce statistically the same economy.
##      This is the real test: it catches effects the table cannot show,
##      like an event that removes an exhibit and so reduces FUTURE
##      revenue, or a charm windfall that buys extra reel spins.
##   3. TEXTURE - the deck must actually show up. If 90% of days are the
##      same event, the deck is decoration. If one event never fires, it
##      is dead content.
##   4. HEADROOM - the healthy thresholds must survive the deck: the
##      reel must still be an amplifier rather than the game, and daily
##      operating income must not become chaotic.
##
## Both the pure-economy run (SimCore) and the player-path run (GameState,
## the same path a real player takes) are measured, because the two can
## disagree: the player path reacts to events, and a reaction is where
## neutrality is hardest to keep.

const DAYS := 365
## How far the decked economy may drift from the undeccked one, as a ratio
## of median daily operating income. 8% is tight enough to catch a real
## rebalance and loose enough to tolerate sampling noise across two
## different random event sequences.
const EV_TOLERANCE := 0.08
## Maximum share of days any single event may take. A deck where one event
## is 40% of all days is not a deck, it is a second game.
const CONCENTRATION_LIMIT := 0.35


func _init() -> void:
	var days := DAYS
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--days="):
			days = int(a.split("=")[1])

	print("=== SIDHE & STONE event deck report (%d days) ===" % days)

	var deck_ev := EventDeck.expected_multipliers()
	print("")
	print("--- deck multipliers ---")
	print("demand EV=%.4f  theft EV=%.4f  curation EV=%.4f  charm EV=%.4f" % [
		float(deck_ev["demand"]), float(deck_ev["theft"]),
		float(deck_ev["curation"]), float(deck_ev["charm"])])

	var failures: Array[String] = []

	# --- 1. the deck's own arithmetic
	if absf(float(deck_ev["demand"]) - 1.0) > 0.0001:
		failures.append("deck demand EV is %.4f, not 1.0 - the deck is a hidden rebalance"
			% float(deck_ev["demand"]))
	if absf(float(deck_ev["theft"]) - 1.0) > 0.0001:
		failures.append("deck theft EV is %.4f, not 1.0 - the deck is a hidden rebalance"
			% float(deck_ev["theft"]))
	if absf(float(deck_ev["curation"])) > 0.0001:
		failures.append("deck curation EV is %.4f, not 0.0" % float(deck_ev["curation"]))
	if float(deck_ev["charm"]) > 0.25:
		failures.append("deck charm EV is %.4f per day, too large to be free flavour"
			% float(deck_ev["charm"]))

	# --- 2. the economy, with and without the deck
	var on := _run_sim(days, true)
	var off := _run_sim(days, false)
	var sim_ratio := _ratio(on["median_op"], off["median_op"])
	print("")
	print("--- economy with deck vs without ---")
	print("pure sim:  median daily operating income  decked=%.0f  bare=%.0f  ratio=%.3f" % [
		on["median_op"], off["median_op"], sim_ratio])
	if absf(sim_ratio - 1.0) > EV_TOLERANCE:
		failures.append("pure sim drifts %.1f%% with the deck (median operating income %.0f vs %.0f)"
			% [absf(sim_ratio - 1.0) * 100.0, on["median_op"], off["median_op"]])

	var pon := _run_player(days, true)
	var poff := _run_player(days, false)
	var player_ratio := _ratio(pon["median_op"], poff["median_op"])
	print("player path: median daily operating income  decked=%.0f  bare=%.0f  ratio=%.3f" % [
		pon["median_op"], poff["median_op"], player_ratio])
	if absf(player_ratio - 1.0) > EV_TOLERANCE:
		failures.append("player path drifts %.1f%% with the deck (median operating income %.0f vs %.0f)"
			% [absf(player_ratio - 1.0) * 100.0, pon["median_op"], poff["median_op"]])

	# --- 3. texture: the deck must show up
	var counts: Dictionary = pon["event_counts"]
	var total := 0
	for id in counts:
		total += int(counts[id])
	print("")
	print("--- deck texture (%d event-days observed) ---" % total)
	for id in counts:
		var share := float(int(counts[id])) / float(maxi(1, total))
		print("  %-18s %4d  %5.1f%%" % [str(id), int(counts[id]), share * 100.0])
		if share > CONCENTRATION_LIMIT:
			failures.append("event '%s' is %.0f%% of all days - the deck has collapsed onto one event"
				% [str(id), share * 100.0])
	if int(counts.size()) < 5:
		failures.append("only %d distinct events fired - the deck is too thin to give a day character"
			% int(counts.size()))
	var quiet := int(counts.get("quiet_day", 0))
	if total > 0 and float(quiet) / float(total) > CONCENTRATION_LIMIT:
		failures.append("'quiet_day' is %.0f%% of all days - the deck is mostly no event"
			% (float(quiet) / float(total) * 100.0))

	# --- 4. the healthy thresholds must survive the deck
	print("")
	print("--- headroom with the deck ---")
	print("pure sim:  CV=%.2f (limit 4.0)  reel share=%.1f%% (limit 45%%)" % [
		on["cv"], on["reel_share"] * 100.0])
	if float(on["cv"]) > 4.0:
		failures.append("decked economy is chaotic: operating income CV %.2f" % float(on["cv"]))
	if float(on["reel_share"]) > 0.45:
		failures.append("reel drives %.1f%% of revenue with the deck" % (float(on["reel_share"]) * 100.0))
	print("player path: CV=%.2f (limit 4.0)  reel share=%.1f%% (limit 45%%)" % [
		pon["cv"], pon["reel_share"] * 100.0])
	if float(pon["cv"]) > 4.0:
		failures.append("decked player path is chaotic: operating income CV %.2f" % float(pon["cv"]))
	if float(pon["reel_share"]) > 0.45:
		failures.append("reel drives %.1f%% of player-path revenue with the deck"
			% (float(pon["reel_share"]) * 100.0))

	# --- verdict
	print("")
	if failures.is_empty():
		print("EVENT VERDICT: neutral (the deck changes the shape of a day, not the slope of a campaign)")
		print("  deck multipliers are zero-mean, the decked economy is within %.0f%% of the bare economy,"
			% (EV_TOLERANCE * 100.0))
		print("  and the decked economy stays inside the healthy CV and reel-share thresholds.")
	else:
		print("EVENT VERDICT: MIS-CALIBRATED")
		for f in failures:
			print("  - %s" % f)

	quit()


## Run the pure economy with the deck on or off.
func _run_sim(days: int, events: bool) -> Dictionary:
	var core := SimCore.new()
	core.events_enabled = events
	var result := core.run(days)
	var report := SimCore.analyse(
		result["money_curve"],
		core.revenue_log,
		core.opex_log,
		core.capex_log,
		core.reel_revenue_log
	)
	return {
		"median_op": _median_op(core.revenue_log, core.opex_log),
		"cv": float(report["net_cv"]),
		"reel_share": float(report["reel_share"]),
	}


## Run the player path with the deck on or off.
func _run_player(days: int, events: bool) -> Dictionary:
	var state := GameState.new()
	state.set_events_enabled(events)
	var result := PlayerPath.play(state, days)
	var counts: Dictionary = {}
	for e in state.event_log():
		var id := str(e.get("id", "?"))
		counts[id] = int(counts.get(id, 0)) + 1
	var report := SimCore.analyse(
		result["money_curve"],
		result["revenue_log"],
		result["opex_log"],
		result["capex_log"],
		result["reel_revenue_log"]
	)
	return {
		"median_op": _median_op(result["revenue_log"], result["opex_log"]),
		"cv": float(report["net_cv"]),
		"reel_share": float(report["reel_share"]),
		"event_counts": counts,
	}


## Median daily operating income. Median rather than mean, because the mean
## is hostage to a single loud day - and the deck's whole job is to
## occasionally produce one.
func _median_op(revenue: Array[int], opex: Array[int]) -> float:
	var ops: Array[int] = []
	for i in range(mini(revenue.size(), opex.size())):
		ops.append(int(revenue[i]) - int(opex[i]))
	if ops.is_empty():
		return 0.0
	var s := ops.duplicate()
	s.sort()
	return float(s[int(s.size() / 2)])


## Ratio of two operating incomes, guarded against a zero baseline.
func _ratio(a: float, b: float) -> float:
	if absf(b) < 1.0:
		return 1.0
	return a / b
