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

signal changed
signal day_ended(summary: Dictionary)
signal reel_spun(result: Dictionary)

var sim: SimCore

func _init() -> void:
	sim = SimCore.new()
	sim.manual = true

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

# ------------------------------------------------------------------ actions

func assign_dig(site: int, dig: String) -> void:
	sim.assign_dig(site, dig)
	changed.emit()

func clear_dig(site: int) -> void:
	sim.clear_dig(site)
	changed.emit()

func display_one(grade: String) -> void:
	if sim.display_one(grade):
		changed.emit()

func vault_one(grade: String) -> void:
	if sim.vault_one(grade):
		changed.emit()

## Sell one vaulted artefact to a dealer for half its value, immediately.
func sell_one(grade: String) -> void:
	if sim.sell_one(grade):
		changed.emit()

func buy_upgrade(kind: String) -> void:
	if sim.buy_upgrade(kind):
		changed.emit()

## Spin the Fate Reel. The result is held until the day resolves, so the
## player watches the gamble land before they see the money.
func spin_reel() -> Dictionary:
	var res := sim.spin_reel_now()
	if res.is_empty():
		return {}
	reel_spun.emit(res)
	changed.emit()
	return res

## Resolve the day: upkeep, dig completion, curation, takings, theft.
func end_day() -> Dictionary:
	var before_money := sim.money
	var before_display := sim.on_display()
	sim.step()
	var summary := {
		"day": sim.day,
		"money": sim.money,
		"delta": sim.money - before_money,
		"revenue": sim.revenue_today,
		"opex": sim.opex_today,
		"capex": sim.capex_today,
		"stolen": sim.last_stolen,
		"payout": sim.pending_payout,
		"before_display": before_display,
		"after_display": sim.on_display(),
		"event": sim.last_event,
	}
	day_ended.emit(summary)
	changed.emit()
	return summary
