class_name GameState
extends RefCounted
## Player-facing wrapper around SimCore.
##
## SimCore is the pure economy and knows nothing about who is pressing what.
## This class is the seam: it exposes the handful of actions a player can take
## (assign a dig, move an exhibit, buy an upgrade, spin the reel, end the
## day) and nothing else. The UI never touches SimCore's fields directly.
##
## The important property: manual mode. The balance harness runs SimCore on
## autopilot - it picks the richest dig, restocks the gallery itself, spins
## the reel every day and buys anything affordable. A playable game must do
## none of that without being told. Same maths, different driver.
##
## This class also owns the things that are game-shaped rather than
## economy-shaped: the tutorial, the rolling ledger of events, and the
## save/load round trip. Keeping them here means the UI only ever talks to
## one object, and the whole player-facing state serialises in one place.

signal changed
signal day_ended(summary: Dictionary)
signal reel_spun(result: Dictionary)
signal tutorial_advanced
signal game_loaded

## The dig types a player may assign. Mirrors SimCore.DIGS; kept here so
## the action layer can reject nonsense without the UI having to know.
const DIG_TYPES := ["test_pit", "trench", "shaft"]

var sim: SimCore
var tutorial := Tutorial.new()

## Rolling log of notable events, newest last. Bounded so a long game does
## not grow without limit.
var ledger: Array[Dictionary] = []

const LEDGER_MAX := 200


func _init() -> void:
	sim = SimCore.new()
	sim.manual = true


## Start a completely fresh game. Used by "New Game" and by tests.
func reset() -> void:
	sim = SimCore.new()
	sim.manual = true
	tutorial = Tutorial.new()
	ledger.clear()


# ------------------------------------------------------------------ queries

func money() -> int:
	return sim.money

func day() -> int:
	return sim.day

func charms() -> int:
	return sim.charms

func luck() -> float:
	return sim.reel.luck

func charm_cost() -> int:
	return sim.reel_charm_cost

func sites() -> int:
	return sim.sites

func curators() -> int:
	return sim.curators

func demand() -> int:
	return sim.demand_cap()

func slots_free() -> int:
	return sim.slots_free()

func gallery_slots() -> int:
	return sim.gallery_slots

func upkeep() -> int:
	return sim.daily_upkeep()

func raw_count() -> int:
	return sim.raw_count()

func vault_count() -> int:
	return sim.vault_count()

func on_display() -> int:
	return sim.on_display()

func last_event() -> String:
	return sim.last_event

func pending_dig(site: int) -> String:
	return str(sim.pending_digs.get(site, ""))

func dig_in_progress(site: int) -> Dictionary:
	return sim.digging.get(site, {})

func gallery_counts() -> Dictionary:
	return sim.gallery.duplicate()

func vault_counts() -> Dictionary:
	return sim.vault.duplicate()

func raw_counts() -> Dictionary:
	return sim.raw.duplicate()

func exhibit_value(grade: String) -> int:
	return sim.exhibit_value(grade)

## How many of each grade on display actually earn today. Anything on display
## beyond the demand cap earns nothing but is still stealable - this is the
## split the player is managing, so the UI must show it.
func paying_split() -> Dictionary:
	return sim.paying_split()

## Chance one displayed artefact of a grade is stolen tonight.
func theft_chance(grade: String) -> float:
	return sim.theft_chance(grade)

## How many finds one curator can catalog per day.
func curator_capacity() -> int:
	return sim.curator_capacity

## How many finds the curators can handle today.
func daily_curation() -> int:
	return sim.curators * sim.curator_capacity

func upgrade_cost(kind: String) -> int:
	return sim.upgrade_cost(kind)

func upgrade_count(kind: String) -> int:
	return int(sim.upgrades_bought.get(kind, 0))

func dig_days(dig: String) -> int:
	return sim.dig_days(dig)

func dig_cost(dig: String) -> int:
	return sim.dig_cost(dig)

func can_spin() -> bool:
	return sim.can_spin()

func pending_payout() -> float:
	return sim.pending_payout

## Per-day logs, for the ledger tab. These are the player's own history:
## a management game should let you look back at the curve you climbed.
func revenue_log() -> Array[int]:
	return sim.revenue_log

func opex_log() -> Array[int]:
	return sim.opex_log

func capex_log() -> Array[int]:
	return sim.capex_log

func stolen_log() -> Array[int]:
	return sim.stolen_log

func curated_log() -> Array[int]:
	return sim.curated_log

## Recent ledger entries, newest first.
func recent_events(n: int = 8) -> Array:
	var out := []
	var start := maxi(0, ledger.size() - n)
	for i in range(ledger.size() - 1, start - 1, -1):
		out.append(ledger[i])
	return out


# ------------------------------------------------------------------ actions

## Returns true if the assignment was accepted.
func assign_dig(site: int, dig: String) -> bool:
	if not DIG_TYPES.has(dig):
		return false
	sim.assign_dig(site, dig)
	_log("Site %d: %s assigned." % [site + 1, dig.replace("_", " ")], "dig")
	_tutorial_report("dig_assigned")
	changed.emit()
	return true

func clear_dig(site: int) -> void:
	sim.clear_dig(site)
	changed.emit()

## Returns true if the artefact actually moved.
func display_one(grade: String) -> bool:
	if not sim.display_one(grade):
		return false
	_log("%s moved to the gallery." % grade.capitalize(), "display")
	_tutorial_report("displayed")
	changed.emit()
	return true

## Returns true if the artefact actually moved.
func vault_one(grade: String) -> bool:
	if not sim.vault_one(grade):
		return false
	_log("%s put back in the vault." % grade.capitalize(), "display")
	changed.emit()
	return true

## Sell one vaulted artefact to a dealer for half its value, immediately.
## Returns true if something was sold.
func sell_one(grade: String) -> bool:
	if not sim.sell_one(grade):
		return false
	_log("Sold a %s to a dealer." % grade, "sale")
	changed.emit()
	return true

## Returns true if the purchase went through.
func buy_upgrade(kind: String) -> bool:
	if not sim.buy_upgrade(kind):
		return false
	_log("Bought %s." % kind, "upgrade")
	changed.emit()
	return true

## Spin the Fate Reel. The result is held until the day resolves, so the
## player watches the gamble land before they see the money.
func spin_reel() -> Dictionary:
	var res := sim.spin_reel_now()
	if res.is_empty():
		return {}
	reel_spun.emit(res)
	_tutorial_report("reel_spun")
	changed.emit()
	return res

## Resolve the day: upkeep, dig completion, curation, takings, theft.
func end_day() -> Dictionary:
	var before_money := sim.money
	var before_display := sim.on_display()
	var before_raw := sim.raw_count()
	sim.step()
	var summary := {
		"day": sim.day,
		"money": sim.money,
		"delta": sim.money - before_money,
		"revenue": sim.revenue_today,
		"opex": sim.opex_today,
		"capex": sim.capex_today,
		"stolen": sim.last_stolen,
		"stolen_grades": sim.last_stolen_grades.duplicate(),
		"payout": sim.payout_applied,
		"curated": sim.curated_today,
		"digs_done": sim.digs_completed_today,
		"before_display": before_display,
		"after_display": sim.on_display(),
		"raw_before": before_raw,
		"raw_after": sim.raw_count(),
		"event": sim.last_event,
	}
	_day_narrative(summary)
	day_ended.emit(summary)
	_tutorial_report("day_ended")
	changed.emit()
	return summary


# ------------------------------------------------------------------ ledger

## Write one line into the rolling ledger. `kind` lets the UI tint the line
## so that money, theft and digging are visually distinct.
func _log(text: String, kind: String = "plain") -> void:
	ledger.append({"day": sim.day, "text": text, "kind": kind})
	while ledger.size() > LEDGER_MAX:
		ledger.pop_front()


## Turn the day's numbers into a sentence. The player should be able to read
## one line and know what happened - a management game that makes you do the
## arithmetic is a spreadsheet with pixels.
func _day_narrative(s: Dictionary) -> void:
	var d := int(s["day"])
	var bits: Array[String] = []

	var revenue := int(s["revenue"])
	var opex := int(s["opex"])
	if revenue > 0:
		bits.append("Visitors paid £%d." % revenue)
	else:
		bits.append("No visitors paid today.")

	var curated := int(s["curated"])
	if curated > 0:
		bits.append("Curators catalogued %d find%s." % [curated, "" if curated == 1 else "s"])

	if int(s["digs_done"]) > 0:
		bits.append("%d dig%s finished." % [int(s["digs_done"]),
			"" if int(s["digs_done"]) == 1 else "s"])

	var stolen := int(s["stolen"])
	if stolen > 0:
		var grades: Dictionary = s["stolen_grades"]
		var named: Array[String] = []
		for g in ["crown", "relic", "clay", "rubble"]:
			var n := int(grades.get(g, 0))
			if n > 0:
				named.append("%d %s" % [n, g])
		bits.append("THIEVES TOOK %s!" % ", ".join(named))

	if int(s["raw_after"]) > 0:
		bits.append("%d find%s still waiting in the storeroom." % [
			int(s["raw_after"]), "" if int(s["raw_after"]) == 1 else "s"])

	if opex > 0:
		bits.append("Upkeep £%d." % opex)

	var delta := int(s["delta"])
	if delta != 0:
		bits.append("Net %s£%d." % ["+" if delta > 0 else "-", absi(delta)])

	_log("Day %d — %s" % [d, " ".join(bits)], "day")


# ------------------------------------------------------------------ tutorial

## Tell the tutorial what the player just did. It advances only if that
## completes the current beat.
func _tutorial_report(action: String) -> void:
	if tutorial.report(action):
		tutorial_advanced.emit()


## The player dismissed the tutorial.
func skip_tutorial() -> void:
	tutorial.skip()
	tutorial_advanced.emit()


# ------------------------------------------------------------------ saving

## Everything about the player-facing state, in one dictionary.
func to_dict() -> Dictionary:
	return {
		"sim": sim.to_dict(),
		"tutorial": tutorial.to_dict(),
		"ledger": ledger.duplicate(true),
	}


## Restore from a dictionary produced by to_dict().
func from_dict(d: Dictionary) -> void:
	sim = SimCore.new()
	sim.manual = true
	sim.from_dict(d.get("sim", {}))
	sim.manual = true
	tutorial.from_dict(d.get("tutorial", {}))
	ledger.clear()
	for e in d.get("ledger", []):
		if typeof(e) == TYPE_DICTIONARY:
			ledger.append(e)
	game_loaded.emit()
	changed.emit()


## Write the game to disk.
func save_to_disk() -> bool:
	return SaveSystem.save(to_dict())


## Load the game from disk. Returns true if a game was loaded.
func load_from_disk() -> bool:
	var payload := SaveSystem.load_payload()
	if payload.is_empty():
		return false
	from_dict(payload)
	return true


static func has_save() -> bool:
	return SaveSystem.has_save()
