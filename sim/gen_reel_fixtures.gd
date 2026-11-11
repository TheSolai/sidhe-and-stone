extends SceneTree
## Generates the authoritative reel and event-deck fixtures used by the web
## port's parity tests.
##
## The economy curve fixture already proves the reel end to end, because the
## reel's lifetime stats are part of the final state it compares. This
## fixture is narrower and much sharper: it pins the reel's own behaviour
## -- every spin's reels, payout and pattern, the weights at each luck
## level, the analytic expected value, the pattern distribution, the full
## payout table, and the RNG state after every spin.
##
## It also pins the event deck: the weight table, the expected multipliers,
## and a long deterministic roll sequence with the RNG state after each
## roll.
##
## FLOATS ARE WRITTEN AS RAW IEEE-754 BYTES, not as JSON numbers.
##
## Godot's JSON writer prints a float with about 15 significant digits, so
## 0.04756089286925843 comes back out as 0.0475608928692584. Comparing the
## TypeScript port against a rounded fixture with exact equality would fail
## for a reason that has nothing to do with the port, and comparing with a
## tolerance would be too loose to catch a genuine divergence in
## floating-point accumulation order -- which is exactly the kind of
## divergence this fixture exists to catch.
##
## So every float is stored as the hex of its eight little-endian bytes.
## That round-trips exactly, and the TypeScript test decodes it back into
## a float64 and compares bit for bit.
##
## Run from the project root:
##   godot --headless --path . --script res://sim/gen_reel_fixtures.gd

const SEEDS := [1, 7, 20261110]
const LUCK_LEVELS := [0.0, 0.25, 0.5, 0.75, 0.9]
const SPINS := 60


## A float as the hex of its eight little-endian IEEE-754 bytes.
func fx(value: float) -> String:
	return PackedFloat64Array([value]).to_byte_array().hex_encode()


func _init() -> void:
	var out := {}

	# ---------------------------------------------------------------- reel
	for s in SEEDS:
		var rec := {}

		# The weights at each luck level, in symbol-table order.
		#
		# Stored as an ordered array of [symbol, weight] pairs, NOT as a
		# JSON object. Godot's JSON writer sorts object keys, which would
		# lose the insertion order -- and the insertion order is exactly
		# what the reel's random draw walks, so it is the thing worth
		# pinning.
		var weights_by_luck := {}
		for luck in LUCK_LEVELS:
			var r := ReelCore.new(s)
			r.luck = luck
			var per_luck := []
			for symbol in r.weights():
				per_luck.append([symbol, fx(r.weights()[symbol])])
			weights_by_luck[str(luck)] = per_luck
		rec["weights_by_luck"] = weights_by_luck

		# The analytic expected value at each luck level.
		var ev_by_luck := {}
		for luck in LUCK_LEVELS:
			var r := ReelCore.new(s)
			ev_by_luck[str(luck)] = fx(r.expected_value(luck))
		rec["expected_value_by_luck"] = ev_by_luck

		# The pattern distribution at each luck level.
		var dist_by_luck := {}
		for luck in LUCK_LEVELS:
			var r := ReelCore.new(s)
			var per_luck := {}
			for pattern in r.pattern_distribution():
				per_luck[pattern] = fx(r.pattern_distribution()[pattern])
			dist_by_luck[str(luck)] = per_luck
		rec["pattern_distribution_by_luck"] = dist_by_luck

		# Every spin, with the RNG state after it.
		var reel := ReelCore.new(s)
		var spins := []
		var states := []
		for i in range(SPINS):
			var res := reel.spin()
			spins.append({
				"reels": res["reels"],
				"payout": fx(res["payout"]),
				"pattern": res["pattern"],
			})
			states.append(str(reel.rng.state))
		rec["spins"] = spins
		rec["rng_state_after_spin"] = states
		rec["stats"] = {
			"spins": reel.spins,
			"payout_total": fx(reel.payout_total),
			"biggest_win": fx(reel.biggest_win),
			"worst_spin": fx(reel.worst_spin),
			"triple_hits": reel.triple_hits,
		}
		rec["final_rng_state"] = str(reel.rng.state)

		# The payout of every possible three-reel combination, so the
		# payout table itself is pinned rather than only its outcomes.
		var payouts := {}
		var ids := ["clover", "honey", "moon", "star", "bog", "blight"]
		for a in ids:
			for b in ids:
				for c in ids:
					payouts["%s,%s,%s" % [a, b, c]] = fx(ReelCore.payout_for([a, b, c]))
		rec["all_payouts"] = payouts

		out[str(s)] = rec

	out["_spins"] = SPINS
	out["_luck_levels"] = LUCK_LEVELS
	out["_float_encoding"] = "hex-le-f64"

	# ---------------------------------------------------------- event deck
	var deck := {}
	deck["total_weight"] = EventDeck.total_weight()
	deck["expected_multipliers"] = {
		"demand": fx(EventDeck.expected_multipliers()["demand"]),
		"theft": fx(EventDeck.expected_multipliers()["theft"]),
		"curation": fx(EventDeck.expected_multipliers()["curation"]),
		"charm": fx(EventDeck.expected_multipliers()["charm"]),
	}

	var neutral := EventDeck.neutral()
	deck["neutral_event"] = {
		"id": neutral["id"],
		"title": neutral["title"],
		"text": neutral["text"],
		"demand": fx(neutral["demand"]),
		"theft": fx(neutral["theft"]),
		"curation": neutral["curation"],
		"charm": neutral["charm"],
	}

	# A long roll sequence, with the RNG state after each roll.
	var deck_rng := RandomNumberGenerator.new()
	deck_rng.seed = 20261110
	var deck_obj := EventDeck.new()
	var rolls := []
	var roll_states := []
	for i in range(200):
		var ev := deck_obj.roll(deck_rng)
		rolls.append(ev["id"])
		roll_states.append(str(deck_rng.state))
	deck["rolls"] = rolls
	deck["rng_state_after_roll"] = roll_states

	# Every event's own definition, so the deck's contents are pinned
	# rather than only its statistics.
	var events := []
	for id in EventDeck.EVENTS:
		var def: Dictionary = EventDeck.EVENTS[id]
		events.append({
			"id": id,
			"title": def["title"],
			"text": def["text"],
			"weight": def["weight"],
			"demand": fx(def["demand"]),
			"theft": fx(def["theft"]),
			"curation": def["curation"],
			"charm": def["charm"],
		})
	deck["events"] = events

	out["_event_deck"] = deck

	var file := FileAccess.open("res://web/tests/fixtures/godot_reel_fixture.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(out, "  "))
	file.close()
	print("wrote web/tests/fixtures/godot_reel_fixture.json")
	quit()
