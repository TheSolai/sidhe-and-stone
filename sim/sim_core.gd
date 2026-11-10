class_name SimCore
extends RefCounted
## Pure-logic economy model for SIDHE & STONE.
##
## A cozy KairoSoft-style management sim about excavating Irish fairy mounds,
## cataloguing what you find, curating exhibits, and attracting scholars and
## donors.
##
## THE LOOP
##   excavate  ->  curate  ->  vault / gallery  ->  takings  ->  reinvest
##
## No engine dependencies on purpose: this file is unit-testable and runs
## headless for thousands of simulated days, so the economy can be balanced
## numerically BEFORE any art, UI or audio exists. That is the whole point of
## shipping this inside a headless-capable engine.
##
## WHY THE ECONOMY IS SHAPED THIS WAY
##   1. DEMAND CAPS. Scholars and donors buy at most N exhibits a day. You
##      cannot exhibit infinite artefacts, so a bigger site alone does not
##      make money - it makes unsold stock.
##   2. ESCALATING COSTS. Every dig site, curator and gallery upgrade costs
##      more than the last, and running them costs more every day.
##   3. REINVESTMENT. Surplus buys sites, curators, fairies and gallery
##      upgrades that raise throughput and demand. That is the growth loop.
##   4. THE FATE REEL. A luck mechanic that amplifies a day's takings. It is
##      deliberately MARGINAL: the harness enforces that it never dominates
##      revenue, so the management layer always matters more than the gamble.
##
## LEDGER SEPARATION (important, learned the hard way):
##   Capital expenditure (buying a site, a curator, a fairy) is INVESTMENT, not
##   operating loss. Folding it into the daily expense line made every upgrade
##   look like a catastrophic loss day and the harness cried "CHAOTIC" for an
##   economy that was actually perfectly healthy. Operating costs (upkeep,
##   dig costs) and capital expenditure are tracked on separate lines, and the
##   volatility test looks only at operating income.

# ---------------------------------------------------------------- artefacts

## A find's curated value (what it earns per day on display) and how
## attractive it is to thieves. Crowns pull double the attention of rubble.
const FINDS := {
	"rubble": {"value": 18, "theft": 1.00},
	"clay":   {"value": 45, "theft": 1.15},
	"relic":  {"value": 110, "theft": 1.30},
	"crown":  {"value": 300, "theft": 1.60},
}

# ---------------------------------------------------------------- excavation

## Three excavation types, each with its own time, cost, yield and grade
## distribution. Deeper digs pay more but tie up a site for longer and yield
## rarer, more theft-prone finds.
const DIGS := {
	"test_pit": {"days": 1, "cost": 12, "finds": 2,
		"grades": {"rubble": 70, "clay": 30}},
	"trench": {"days": 3, "cost": 40, "finds": 4,
		"grades": {"rubble": 10, "clay": 55, "relic": 35}},
	"shaft": {"days": 6, "cost": 95, "finds": 3,
		"grades": {"clay": 25, "relic": 60, "crown": 15}},
}

# ---------------------------------------------------------------- upgrades

## Reinvestment catalogue. Cost escalates geometrically so progression paces
## itself. "omen" is the luck upgrade: it hires a fortune-telling fairy who
## improves the Fate Reel's odds, and is the main reason to ever touch the reel.
const UPGRADES := {
	"site":      {"base": 180, "escalate": 1.45, "max": 24},
	"curator":   {"base": 520, "escalate": 1.55, "max": 8},
	"gallery":   {"base": 700, "escalate": 1.60, "max": 12},
	"omen":      {"base": 620, "escalate": 1.50, "max": 6, "luck": 0.10},
	"diggers":   {"base": 240, "escalate": 1.40, "max": 6},
	"archivists":{"base": 380, "escalate": 1.45, "max": 6},
	"wards":     {"base": 300, "escalate": 1.40, "max": 4},
}

# ---------------------------------------------------------------- demand

## Visitors who actually pay on a given day. Only the top N exhibited
## artefacts earn, so displaying more than the demand cap is wasted risk.
var visitor_demand: int = 4
## Demand grows slowly with calendar time.
var demand_growth: float = 900.0
## Each 'gallery' upgrade multiplies demand by this factor.
var market_gain: float = 1.32
## Base number of exhibit slots. Each gallery upgrade adds slots too.
var gallery_slots: int = 4
var gallery_slot_gain: int = 2

# ---------------------------------------------------------------- costs

## Daily operating cost per dig site, curator and ward.
var upkeep_per_site: int = 2
var upkeep_per_curator: int = 8
var upkeep_per_ward: int = 4

## How many finds one curator can catalogue per day.
var curator_capacity: int = 3
## Curated value bonus per hired archivist.
var archivist_bonus: float = 0.08
## Extra finds per hired digger fairy.
var digger_bonus: float = 0.06
## Base daily theft chance per exhibited artefact, before grade and wards.
var theft_base: float = 0.05
## Theft reduction per hired ward fairy.
var ward_reduction: float = 0.012
## Maximum artefacts stolen in a single night.
var theft_cap: int = 2
## Fraction of value a dealer pays for a vaulted artefact sold on the sly.
var dealer_rate: float = 0.5

# ---------------------------------------------------------------- Fate Reel

## Charms spent per spin. Charms are earned from takings, so every spin costs
## real production income: that opportunity cost is what makes the reel a
## decision rather than a free money printer.
var reel_charm_cost: int = 2
## "always" spins whenever affordable, "off" never spins.
var reel_policy: String = "always"
## Charm earned per exhibit earning takings.
##
## This rate is the reel's throttle, and it is deliberately tied to SUCCESS.
## A struggling outfit barely sells anything, earns almost no charms, and so
## can rarely spin: the luck mechanic is a reward for having built
## something, not a lifeline for having built nothing. A healthy economy
## earns a spin roughly every other day, which is often enough to make it
## feel present and rare enough to make each one a decision.
##
## Measured (365 days, autopilot): at 0.05 the reel ran 162 spins and 3.7%
## of revenue; at 0.15 it runs ~343 spins and 7.8%; above that it saturates
## at one spin per day and the share stops moving. 0.15 is the knee.
var charm_per_unit: float = 0.15

# ---------------------------------------------------------------- state

var day: int = 0
var money: int = 240
var sites: int = 3
var curators: int = 1
var charms: int = 6

## Raw finds waiting to be catalogued, by grade.
var raw: Dictionary = {}
## Curated exhibits held in the vault, by grade.
var vault: Dictionary = {}
## Curated exhibits currently on display, by grade.
var gallery: Dictionary = {}
## Digs in progress, site index -> {dig, ready_day}.
var digging: Dictionary = {}

var upgrades_bought: Dictionary = {
	"site": 0, "curator": 0, "gallery": 0, "omen": 0,
	"diggers": 0, "archivists": 0, "wards": 0,
}

## The luck mechanic.
var reel := ReelCore.new()

## Per-day ledgers for balance analysis.
var revenue_log: Array[int] = []      # gross revenue after the reel multiplier
var opex_log: Array[int] = []         # upkeep + dig costs (recurring)
var capex_log: Array[int] = []        # upgrade purchases (investment)
var reel_revenue_log: Array[int] = [] # revenue attributable to the reel

## Deterministic RNG for dig grades and theft, so runs are reproducible.
var rng := RandomNumberGenerator.new()

var revenue_today: int = 0
var opex_today: int = 0
var capex_today: int = 0
var reel_revenue_today: int = 0

## ---------------------------------------------------------------------------
## PLAYER MODE
## ---------------------------------------------------------------------------
## The headless harness runs the economy on autopilot: it picks the richest
## dig, restocks the gallery itself, spins the reel every day and buys any
## upgrade it can afford. That is exactly what you want for balance analysis
## and exactly what you do NOT want for a playable game.
##
## In manual mode the same simulation code answers to the player instead:
## digs are assigned by hand, exhibits are moved between vault and gallery by
## hand, the reel is spun by hand, and upgrades are bought by hand. Nothing
## about the maths changes, which is the point: the balance the harness
## proves is the balance the player feels.
var manual: bool = false
## site index -> dig type the player has assigned for the next day.
var pending_digs: Dictionary = {}
## Set when the player asks for a reel spin. Consumed by the next step().
## (Manual mode spins through spin_reel_now() instead, so the player sees the
## result land before the day resolves.)
## The most recent reel result, for the UI to display.
var last_spin: Dictionary = {}
## A short human-readable note about what just happened, for the UI ticker.
var last_event: String = ""

## ---------------------------------------------------------------------------
## PUBLIC API FOR THE UI
## ---------------------------------------------------------------------------
## Everything the interface needs to show the player their situation and act
## on it. Kept in one place so the UI never reaches into private state.

## The player's payout multiplier for the day, set by a spin before the day
## resolves. The reel is spun and ANIMATED first, then the day is resolved
## with the result already known - the player watches the gamble land before
## they see the money, which is the entire emotional point of a reel.
var pending_payout: float = 1.0
## The last spin the player asked for, for the UI to animate.
var pending_spin: Dictionary = {}

## How many artefacts visitors will pay for today.
func demand_cap() -> int:
	return _demand()

## Curated value of one exhibit of a grade, after archivist bonuses.
func exhibit_value(grade: String) -> int:
	return _exhibit_value(grade)

## How many artefacts are currently on display.
func on_display() -> int:
	var n := 0
	for g in gallery:
		n += int(gallery[g])
	return n

## Free display slots right now.
func slots_free() -> int:
	return maxi(0, gallery_slots - on_display())

## Cost of the next purchase of an upgrade, or -1 if it is maxed.
func upgrade_cost(kind: String) -> int:
	if not UPGRADES.has(kind):
		return -1
	if _count(kind) >= int(UPGRADES[kind]["max"]):
		return -1
	return _upgrade_cost(kind)

## Buy one of an upgrade. Returns true if it was bought.
func buy_upgrade(kind: String) -> bool:
	if not UPGRADES.has(kind):
		return false
	var cost := upgrade_cost(kind)
	if cost < 0 or money < cost:
		return false
	money -= cost
	capex_today += cost
	upgrades_bought[kind] = _count(kind) + 1
	match kind:
		"site":
			sites += 1
		"curator":
			curators += 1
		"gallery":
			gallery_slots += gallery_slot_gain
		"omen":
			reel.luck = minf(0.9, reel.luck + float(UPGRADES["omen"]["luck"]))
	last_event = "Bought %s" % kind
	return true

## Assign a dig type to a site for the next day.
func assign_dig(site: int, dig: String) -> void:
	if not DIGS.has(dig):
		return
	if site < 0 or site >= sites:
		return
	pending_digs[site] = dig

## Forget a site's pending assignment, leaving it idle.
func clear_dig(site: int) -> void:
	pending_digs.erase(site)

## Move one curated artefact from the vault onto display.
func display_one(grade: String) -> bool:
	if int(vault.get(grade, 0)) <= 0:
		return false
	if slots_free() <= 0:
		return false
	vault[grade] = int(vault[grade]) - 1
	_add(gallery, grade, 1)
	return true

## Move one displayed artefact back into the vault.
func vault_one(grade: String) -> bool:
	if int(gallery.get(grade, 0)) <= 0:
		return false
	gallery[grade] = int(gallery[grade]) - 1
	_add(vault, grade, 1)
	return true

## Spin the Fate Reel on the player's behalf, spending charms. The result is
## held as pending_payout and applied when the day resolves.
## Returns {} if the player cannot afford a spin.
func spin_reel_now() -> Dictionary:
	if charms < reel_charm_cost:
		return {}
	charms -= reel_charm_cost
	var res := reel.spin()
	pending_spin = res
	pending_payout = float(res["payout"])
	return res

## Whether the player can currently afford a spin.
func can_spin() -> bool:
	return charms >= reel_charm_cost

## Total artefacts waiting to be catalogued.
func raw_count() -> int:
	var n := 0
	for g in raw:
		n += int(raw[g])
	return n

## Total curated artefacts sitting in the vault.
func vault_count() -> int:
	var n := 0
	for g in vault:
		n += int(vault[g])
	return n

## Daily operating cost of everything currently owned.
func daily_upkeep() -> int:
	return sites * upkeep_per_site + curators * upkeep_per_curator \
		+ _count("wards") * upkeep_per_ward

## How long a dig of this type takes, in days.
func dig_days(dig: String) -> int:
	return int(DIGS.get(dig, DIGS["test_pit"])["days"])

## Cost of a dig of this type.
func dig_cost(dig: String) -> int:
	return int(DIGS.get(dig, DIGS["test_pit"])["cost"])

## Thefts that happened last night, for the ticker.
var last_stolen: int = 0

func _init() -> void:
	rng.seed = 20261110

# ---------------------------------------------------------------- helpers

func _count(kind: String) -> int:
	return int(upgrades_bought.get(kind, 0))

func _pick_grade(weights: Dictionary) -> String:
	var total := 0
	for g in weights:
		total += int(weights[g])
	if total <= 0:
		return "rubble"
	var roll := rng.randi_range(1, total)
	var acc := 0
	for g in weights:
		acc += int(weights[g])
		if roll <= acc:
			return g
	return "rubble"

## Greedy but not optimal: opens the most expensive dig it can afford.
func _pick_dig() -> String:
	var affordable: Array[String] = []
	for name in DIGS:
		if money >= int(DIGS[name]["cost"]):
			affordable.append(name)
	if affordable.is_empty():
		return ""
	affordable.sort_custom(func(a, b): return int(DIGS[a]["cost"]) > int(DIGS[b]["cost"]))
	return affordable[0]

func _add(store: Dictionary, grade: String, qty: int) -> void:
	store[grade] = int(store.get(grade, 0)) + qty

func _upgrade_cost(kind: String) -> int:
	var bought := _count(kind)
	var def: Dictionary = UPGRADES[kind]
	return int(round(float(def["base"]) * pow(float(def["escalate"]), bought)))

func _try_buy_upgrades() -> void:
	for kind in UPGRADES:
		if manual:
			continue  # the player buys upgrades by hand
		var bought := _count(kind)
		if bought >= int(UPGRADES[kind]["max"]):
			continue
		var cost := _upgrade_cost(kind)
		if money >= cost:
			money -= cost
			capex_today += cost
			upgrades_bought[kind] = bought + 1
			match kind:
				"site":
					sites += 1
				"curator":
					curators += 1
				"gallery":
					gallery_slots += gallery_slot_gain
				"omen":
					reel.luck = minf(0.9, reel.luck + float(UPGRADES["omen"]["luck"]))

# ---------------------------------------------------------------- stages

## Open new digs on any idle site.
func _open_digs() -> void:
	for p in range(sites):
		if digging.has(p):
			continue
		var dig := ""
		if manual:
			# Only dig what the player assigned. Idle sites stay idle - an
			# unused site is the player's problem, not the simulation's.
			dig = str(pending_digs.get(p, ""))
			if dig == "":
				continue
		else:
			dig = _pick_dig()
		if dig == "":
			continue
		var cost := int(DIGS[dig]["cost"])
		money -= cost
		opex_today += cost
		digging[p] = {"dig": dig, "ready_day": day + int(DIGS[dig]["days"])}
		if manual:
			pending_digs.erase(p)

## Finish any dig whose time is up, yielding raw finds.
func _finish_digs() -> void:
	for p in digging.keys():
		var info: Dictionary = digging[p]
		if day < int(info["ready_day"]):
			continue
		var def: Dictionary = DIGS[info["dig"]]
		var n := int(round(float(def["finds"]) * (1.0 + digger_bonus * float(_count("diggers")))))
		for _i in n:
			_add(raw, _pick_grade(def["grades"]), 1)
		digging.erase(p)

## Catalogue raw finds into curated exhibits. Curators are the throughput
## bottleneck: more finds without more curators just piles up in the storeroom.
func _curate() -> void:
	var bonus := 1.0 + archivist_bonus * float(_count("archivists"))
	var capacity := curators * curator_capacity
	var grades := ["crown", "relic", "clay", "rubble"]
	for _i in capacity:
		var moved := false
		for g in grades:
			if int(raw.get(g, 0)) > 0:
				raw[g] = int(raw[g]) - 1
				_add(vault, g, 1)
				moved = true
				break
		if not moved:
			break

## Curated value of one exhibit of a grade, after archivist bonuses.
func _exhibit_value(grade: String) -> int:
	var base := float(FINDS.get(grade, FINDS["rubble"])["value"])
	var bonus := 1.0 + archivist_bonus * float(_count("archivists"))
	return int(round(base * bonus))

## Move the most valuable vaulted artefacts onto display. Displaying beyond
## the demand cap earns nothing but still risks theft, so the game only puts
## out a little more than it expects to sell.
func _restock_gallery() -> void:
	if manual:
		return  # the player curates the display by hand
	var wanted := mini(gallery_slots, int(ceil(float(_demand()) * 1.3)))
	var on_display := 0
	for g in gallery:
		on_display += int(gallery[g])
	var space := maxi(0, wanted - on_display)
	if space <= 0:
		return
	var grades := ["crown", "relic", "clay", "rubble"]
	for _i in space:
		var moved := false
		for g in grades:
			if int(vault.get(g, 0)) > 0:
				vault[g] = int(vault[g]) - 1
				_add(gallery, g, 1)
				moved = true
				break
		if not moved:
			break

## Nightly theft. Displayed artefacts are exposed; vaulted ones are not.
func _theft() -> int:
	var chance := maxf(0.005, theft_base - ward_reduction * float(_count("wards")))
	var stolen := 0
	for g in gallery.keys():
		if stolen >= theft_cap:
			break
		var n := int(gallery[g])
		for _i in n:
			if stolen >= theft_cap:
				break
			var p := chance * float(FINDS.get(g, FINDS["rubble"])["theft"])
			if rng.randf() < p:
				gallery[g] = int(gallery[g]) - 1
				stolen += 1
	return stolen

## Visitors pay for the most valuable exhibits on display, up to the demand cap.
func _demand() -> int:
	var mult := pow(market_gain, float(_count("gallery")))
	var time_mult := 1.0 + float(day) / demand_growth
	return maxi(1, int(round(float(visitor_demand) * mult * time_mult)))

## Spin the Fate Reel if policy allows and charms suffice.
## Returns the payout multiplier (1.0 if no spin).
func _spin_reel() -> float:
	if manual:
		# The player already spun (and watched it land) before the day
		# resolved. Apply that payout exactly once, then reset it.
		var p := pending_payout
		pending_payout = 1.0
		pending_spin = {}
		return p
	if reel_policy == "off":
		return 1.0
	if charms < reel_charm_cost:
		return 1.0
	charms -= reel_charm_cost
	var res := reel.spin()
	last_spin = res
	return float(res["payout"])

## Collect the day's takings, multiplied by the reel.
func _collect_takings(multiplier: float) -> void:
	var cap := _demand()
	var grades := ["crown", "relic", "clay", "rubble"]
	var paid := 0
	for g in grades:
		if paid >= cap:
			break
		var n := int(gallery.get(g, 0))
		for _i in n:
			if paid >= cap:
				break
			paid += 1
			var base_rev := _exhibit_value(g)
			var effective := int(round(float(base_rev) * multiplier))
			money += effective
			revenue_today += effective
			reel_revenue_today += effective - base_rev

	# Charms accrue once per paying exhibit, not per coin.
	charms += int(round(float(paid) * charm_per_unit))

## Sell one vaulted artefact to a dealer for half its value, immediately.
## The player's decision, not an automatic safety valve.
func sell_one(grade: String) -> bool:
	if int(vault.get(grade, 0)) <= 0:
		return false
	vault[grade] = int(vault[grade]) - 1
	var cash := int(round(float(_exhibit_value(grade)) * dealer_rate))
	money += cash
	revenue_today += cash
	last_event = "Sold a %s to a dealer for %d" % [grade, cash]
	return true

## Sell a vaulted artefact to a dealer for quick cash. A safety valve so a
## player who over-invests cannot spiral into an unrecoverable hole.
func _dealer_sale() -> void:
	if manual:
		# A dealer must never quietly sell the player's artefacts. In manual
		# mode the player does it explicitly, from the Vault tab.
		return
	if money >= 60:
		return
	for g in ["rubble", "clay", "relic", "crown"]:
		if int(vault.get(g, 0)) > 0:
			vault[g] = int(vault[g]) - 1
			var cash := int(round(float(_exhibit_value(g)) * dealer_rate))
			money += cash
			revenue_today += cash
			last_event = "A dealer bought a %s for %d" % [g, cash]
			return

# ---------------------------------------------------------------- day

## Advance one day.
func step() -> void:
	day += 1
	revenue_today = 0
	opex_today = 0
	capex_today = 0
	reel_revenue_today = 0

	# operating costs: scale with what you own
	var upkeep := sites * upkeep_per_site + curators * upkeep_per_curator \
		+ _count("wards") * upkeep_per_ward
	money -= upkeep
	opex_today += upkeep

	_finish_digs()
	_curate()
	_open_digs()
	_restock_gallery()
	last_stolen = _theft()

	var mult := _spin_reel()
	_collect_takings(mult)
	_dealer_sale()
	_try_buy_upgrades()

	revenue_log.append(revenue_today)
	opex_log.append(opex_today)
	capex_log.append(capex_today)
	reel_revenue_log.append(reel_revenue_today)

func run(days: int) -> Dictionary:
	var money_curve: Array[int] = []
	for _i in days:
		step()
		money_curve.append(money)
	return {
		"days": days,
		"money": money,
		"plots": sites,
		"mills": curators,
		"market": _count("gallery"),
		"omens": _count("omen"),
		"charms": charms,
		"luck": reel.luck,
		"reel_spins": reel.spins,
		"reel_avg_payout": (reel.payout_total / float(reel.spins)) if reel.spins > 0 else 0.0,
		"money_curve": money_curve,
	}

# ---------------------------------------------------------------- analysis

static func _median(values: Array[int]) -> float:
	if values.is_empty():
		return 0.0
	var s := values.duplicate()
	s.sort()
	return float(s[int(s.size() / 2)])

static func _stdev(values: Array[float]) -> float:
	if values.size() < 2:
		return 0.0
	var mean := 0.0
	for v in values:
		mean += v
	mean /= float(values.size())
	var acc := 0.0
	for v in values:
		acc += pow(v - mean, 2.0)
	return sqrt(acc / float(values.size() - 1))

## Balance report. Judges the economy, not the bank balance: cumulative money
## is supposed to grow, so the verdict is driven by OPERATING NET INCOME
## (revenue minus recurring operating cost). Capital expenditure is excluded
## because buying a curator is progress, not a loss.
##
## Hard rules the harness enforces:
##   * the reel must never dominate revenue (it is an amplifier, not the game)
##   * operating income must not become chaotically volatile
##   * luck must be worth buying (EV rises measurably with luck)
static func analyse(curve: Array[int], revenue: Array[int], opex: Array[int], capex: Array[int], reel_rev: Array[int]) -> Dictionary:
	if curve.size() < 12:
		return {"verdict": "insufficient data"}
	var n := curve.size()
	var third := n / 3

	var op_first: Array[int] = []
	var op_last: Array[int] = []
	var op_all: Array[float] = []
	for i in range(n):
		var op := int(revenue[i]) - int(opex[i])
		op_all.append(float(op))
		if i < third:
			op_first.append(op)
		elif i >= n - third:
			op_last.append(op)

	var m_first := _median(op_first)
	var m_last := _median(op_last)
	var active_days := 0
	for i in range(1, n):
		if curve[i] > curve[i - 1]:
			active_days += 1
	var active_pct := float(active_days) / float(n)

	# Reel share of gross revenue.
	var reel_total := 0
	for r in reel_rev:
		reel_total += int(r)
	var gross := 0
	for r in revenue:
		gross += int(r)
	var reel_share := (float(reel_total) / float(gross)) if gross > 0 else 0.0

	# Capital expenditure as a share of revenue: the reinvestment rate.
	var cap_total := 0
	for c in capex:
		cap_total += int(c)
	var capex_share := (float(cap_total) / float(gross)) if gross > 0 else 0.0

	# Volatility of daily operating income.
	var mean_op := 0.0
	for v in op_all:
		mean_op += v
	mean_op /= float(op_all.size())
	var sd := _stdev(op_all)
	var cv: float = (sd / abs(mean_op)) if abs(mean_op) > 1.0 else 99.0

	var verdict := "healthy"
	var detail := "operating income stable across the curve"
	if m_first <= 0.0:
		verdict = "STALLS — early game earns nothing"
		detail = "first third median operating income <= 0"
	elif m_last < m_first * 0.5:
		verdict = "DECLINING — late game earns less than early game"
		detail = "late operating income %.0f vs early %.0f" % [m_last, m_first]
	elif m_last > maxf(m_first * 50.0, 500.0):
		verdict = "RUNAWAY — operating income explodes"
		detail = "late operating income %.0f vs early %.0f" % [m_last, m_first]
	elif active_pct < 0.35:
		verdict = "STALLS — player idles too often"
		detail = "only %.0f%% of days made a profit" % (active_pct * 100.0)
	elif reel_share > 0.45:
		verdict = "REEL DOMINATES — luck mechanic is eating the management game"
		detail = "reel drove %.0f%% of revenue" % (reel_share * 100.0)
	elif cv > 4.0:
		verdict = "CHAOTIC — daily operating income too volatile"
		detail = "operating income CV %.1f (mean %.0f, sd %.0f)" % [cv, mean_op, sd]

	return {
		"verdict": verdict,
		"detail": detail,
		"net_early": m_first,
		"net_late": m_last,
		"active_pct": active_pct,
		"reel_share": reel_share,
		"capex_share": capex_share,
		"net_cv": cv,
		"day1": curve[0],
		"final": curve[n - 1],
	}
