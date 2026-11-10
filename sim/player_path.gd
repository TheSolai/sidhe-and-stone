class_name PlayerPath
extends RefCounted
## A competent player, expressed as code.
##
## The balance harness used to drive SimCore on autopilot, which meant it
## proved balance for an economy the player never experiences: the autopilot
## buys upgrades itself, restocks its own gallery, and - crucially - never
## sees a milestone payout, because milestones live in GameState. That broke
## the GDD's own invariant: proved balance must equal felt balance.
##
## This class closes the gap. It drives GameState - the same object the UI
## drives, through the same actions - and it plays like a player rather than
## like a spreadsheet:
##
##   * opens with shallow digs until there is stock to sell, then goes deep
##   * puts the best finds on the gallery floor, a little beyond the demand
##     cap, because that is the tension the game is about
##   * spins the reel when it can afford to
##   * buys upgrades when it can afford to, keeping a buffer
##
## It is not optimal play. It is honest play, and honest play is what the
## balance numbers have to survive.

## Digs in order of depth. The player prefers a rich find, but only once the
## outfit can actually sell what it digs.
const DIG_ORDER := ["shaft", "trench", "test_pit"]
const UPGRADE_PRIORITY := ["site", "curator", "gallery", "omen", "archivists", "wards", "diggers"]

## How much cash the player keeps unspent as a buffer before buying an
## upgrade. Greedy players who spend to zero never recover from a bad night.
const BUFFER := 60


## Play `days` days through `state`. Returns a report dictionary.
static func play(state: GameState, days: int) -> Dictionary:
	var curve: Array[int] = []
	var goal_days: Array[Dictionary] = []

	# Record the day each milestone lands on, and what the economy was doing
	# at the time. The reward for a milestone has to be scaled against the
	# income the player has at that moment, not against some global average.
	state.goal_achieved.connect(func(g: Dictionary) -> void:
		var d := state.day()
		goal_days.append({
			"id": str(g["id"]),
			"title": str(g["title"]),
			"day": d,
			"reward_money": Goals.reward_money(g),
			"operating_income_day": _day_operating_income(state, d),
			"operating_income_daily": _daily_operating_income(state, 7),
			"operating_income_trail": _trailing_operating_income(state, 7),
			"revenue_daily": _daily_revenue(state, 7),
			"revenue_trail": _trailing_revenue(state, 7),
			"money_after": state.money(),
		}))

	for _i in days:
		_play_one_day(state)
		curve.append(state.money())

	return {
		"days": days,
		"money_curve": curve,
		"goal_days": goal_days,
		"revenue_log": state.revenue_log(),
		"opex_log": state.opex_log(),
		"capex_log": state.capex_log(),
		"reel_revenue_log": state.reel_revenue_log(),
		"spins": state.sim.reel.spins,
		"avg_payout": (state.sim.reel.payout_total / float(state.sim.reel.spins)) if state.sim.reel.spins > 0 else 0.0,
		"luck": state.luck(),
		"charms": state.charms(),
		"sites": state.sites(),
		"curators": state.curators(),
		"gallery_upgrades": state.upgrade_count("gallery"),
		"omens": state.upgrade_count("omen"),
	}


## One day of competent play.
static func _play_one_day(state: GameState) -> void:
	_assign_digs(state)
	_restock_gallery(state)
	if state.can_spin():
		state.spin_reel()
	state.end_day()
	_buy_upgrades(state)


## Dig the richest site the player can currently afford.
##
## A competent player does NOT open a six-day shaft while the gallery floor
## is still empty: that is six days of upkeep with nothing to sell, and it
## buries the outfit in debt before it has ever made a penny. So depth comes
## AFTER the first stock. This single rule is what keeps the opening week
## solvent, and the opening week's solvency is what makes the early
## milestones meaningful rather than compensatory.
static func _assign_digs(state: GameState) -> void:
	var money: int = state.money()
	var selling: bool = state.on_display() > 0
	for site in state.sites():
		if not state.dig_in_progress(site).is_empty():
			continue
		var chosen := ""
		for d in DIG_ORDER:
			if state.dig_cost(d) > money:
				continue
			if not selling and d == "shaft":
				continue  # no deep digs until there is stock to sell
			chosen = d
			break
		if chosen == "":
			chosen = "test_pit"  # cheapest; credit is allowed
		state.assign_dig(site, chosen)


## Put the best finds on display, a little beyond what visitors will buy.
## Going past the demand cap earns nothing but risks theft - which is the
## decision the game asks the player to make, so the harness makes it too.
static func _restock_gallery(state: GameState) -> void:
	var wanted := int(ceil(float(state.demand()) * 1.3))
	var vault := state.vault_counts()
	for g in ["crown", "relic", "clay", "rubble"]:
		while int(vault.get(g, 0)) > 0 and state.on_display() < wanted:
			if not state.display_one(g):
				break
			vault[g] = int(vault.get(g, 0)) - 1


## Buy upgrades in priority order, keeping a cash buffer.
static func _buy_upgrades(state: GameState) -> void:
	for kind in UPGRADE_PRIORITY:
		var cost: int = state.upgrade_cost(kind)
		if cost < 0:
			continue
		if state.money() - cost < BUFFER:
			continue
		state.buy_upgrade(kind)


## Operating income (revenue minus recurring operating cost) on one day.
static func _day_operating_income(state: GameState, day_index: int) -> int:
	var rev := state.revenue_log()
	var op := state.opex_log()
	var i := day_index - 1
	if i < 0 or i >= rev.size():
		return 0
	return int(rev[i]) - int(op[i])


## Mean DAILY operating income over the last `n` days, ending today.
## This is the number a milestone reward is scaled against: what the player
## actually takes home per day at the moment the milestone lands.
static func _daily_operating_income(state: GameState, n: int) -> float:
	var rev := state.revenue_log()
	var op := state.opex_log()
	if rev.is_empty():
		return 0.0
	var start := maxi(0, rev.size() - n)
	var total := 0
	for i in range(start, rev.size()):
		total += int(rev[i]) - int(op[i])
	return float(total) / float(rev.size() - start)


## Mean operating income over the last `n` days, ending today.
static func _trailing_operating_income(state: GameState, n: int) -> float:
	var rev := state.revenue_log()
	var op := state.opex_log()
	if rev.is_empty():
		return 0.0
	var start := maxi(0, rev.size() - n)
	var total := 0
	for i in range(start, rev.size()):
		total += int(rev[i]) - int(op[i])
	return float(total) / float(rev.size() - start)


## Mean DAILY gross takings over the last `n` days, ending today.
##
## This, not net income, is the honest yardstick for a milestone reward. Net
## income understates what the player is worth in the early game, because the
## early game is deliberately spent INVESTING: dig costs land in the
## operating line, so a player who is working hard reads as barely breaking
## even. Gross takings are the number the player actually sees on the day
## report, so a reward scaled against it feels the same as it does to them.
##
## It is a WINSORIZED MEAN, and the reasoning matters:
##
##   * A plain mean is right about the typical case, but the daily event
##     deck can put one loud day in the window: a Fair Day lifts takings by
##     40%. That single day would inflate the yardstick the reward is
##     scaled against, so a milestone landing right after a fair would be
##     measured against an income the player will never see again.
##   * A plain MEDIAN is the obvious other answer, and it is WRONG here. In
##     the early game most days earn nothing at all - the gallery is empty
##     until the curators have caught up - and those zeros are STRUCTURAL,
##     not noise. The median of a mostly-zero window is 0, which would make
##     every early milestone read as "landed on a day with no takings" and
##     fail the ladder for no reason at all.
##
## So: mean over the window, with any single day's takings capped at twice
## the median of the days the player actually earned. One outsized day
## cannot move the yardstick much; a genuinely earning player still measures
## correctly; and a sparse early window still measures as "a little income",
## not as zero.
static func _daily_revenue(state: GameState, n: int) -> float:
	var rev := state.revenue_log()
	if rev.is_empty():
		return 0.0
	var start := maxi(0, rev.size() - n)
	var window: Array[int] = []
	for i in range(start, rev.size()):
		window.append(int(rev[i]))
	return _winsorized_mean(window)


## Mean of a window, with a single outsized day capped.
##
## The cap is twice the median of the EARNING days in the window. Using the
## earning days rather than all of them is what keeps the early game
## working: if the player earned on one day only, that day's takings are
## the median of the earning days and therefore uncapped, so the window
## still measures as the small income it actually was.
static func _winsorized_mean(window: Array[int]) -> float:
	if window.is_empty():
		return 0.0

	var earning: Array[int] = []
	for v in window:
		if v > 0:
			earning.append(v)

	var cap := -1
	if not earning.is_empty():
		earning.sort()
		cap = earning[int(earning.size() / 2)] * 2

	var total := 0.0
	for v in window:
		total += float(mini(v, cap) if cap > 0 else v)
	return total / float(window.size())


## Total gross takings over the last `n` days.
static func _trailing_revenue(state: GameState, n: int) -> float:
	var rev := state.revenue_log()
	if rev.is_empty():
		return 0.0
	var start := maxi(0, rev.size() - n)
	var total := 0
	for i in range(start, rev.size()):
		total += int(rev[i])
	return float(total)
