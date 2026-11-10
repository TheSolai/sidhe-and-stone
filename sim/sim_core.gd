class_name SimCore
extends RefCounted
## Pure-logic economy model for a Kairosoft-style production sim.
##
## No engine dependencies on purpose: this file can be unit-tested and run
## headless for thousands of simulated days, so the economy can be balanced
## numerically BEFORE any art, UI or audio exists. That is the whole point
## of shipping this inside a headless-capable engine.
##
## The economic model has four parts:
##   1. Demand caps  - the village buys at most N units of each item per day.
##                      You cannot sell infinite wheat. This is the ceiling.
##   2. Escalating costs - every upgrade costs more than the last, and running
##                      more plots/mills costs more every day.
##   3. Reinvestment   - surplus money buys upgrades that raise demand, which
##                      lets you sell more. This is the intended growth loop.
##   4. The Fate Reel - a luck mechanic that amplifies a day's production.
##                      It is deliberately MARGINAL: the harness enforces that
##                      it never dominates revenue, so the management layer
##                      always matters more than the gamble.
##
## LEDGER SEPARATION (important, learned the hard way):
##   Capital expenditure (buying a plot, a mill, an omen) is INVESTMENT, not
##   operating loss. Folding it into the daily expense line made every
##   upgrade look like a catastrophic loss day and the harness cried
##   "CHAOTIC" for an economy that was actually perfectly healthy. Operating
##   costs (upkeep, seed purchases) and capital expenditure are therefore
##   tracked on separate lines, and the volatility test looks only at
##   operating income.

const CROPS := {
	"turnip": {"days": 1, "seed": 10, "yield": 3, "value": 6},
	"barley": {"days": 3, "seed": 28, "yield": 8, "value": 14},
	"wheat": {"days": 5, "seed": 70, "yield": 18, "value": 34},
}

## raw -> processed
const RECIPES := {
	"mill": {"in": {"wheat": 2}, "out": "flour", "qty": 3, "value": 30},
}

## Upgrades. Cost escalates geometrically so progression paces itself.
## "omen" is the luck upgrade: it hires a fortune-telling fairy who improves
## the Fate Reel's odds, and is the main reason to ever touch the reel.
const UPGRADES := {
	"plot": {"base": 180, "escalate": 1.45, "max": 24},
	"mill": {"base": 520, "escalate": 1.55, "max": 6},
	"market": {"base": 700, "escalate": 1.60, "max": 12},
	"omen": {"base": 620, "escalate": 1.50, "max": 6, "luck": 0.10},
}

## Daily market demand per item, before demand growth and market upgrades.
var demand: Dictionary = {"turnip": 5, "barley": 8, "wheat": 10, "flour": 12}

## Demand grows slowly with calendar time.
var demand_growth: float = 900.0

## Each 'market' upgrade multiplies demand by this factor.
var market_gain: float = 1.32

## Daily operating cost per plot, and per mill.
var upkeep_per_plot: int = 3
var upkeep_per_mill: int = 18

## --- Fate Reel tuning ---
## Charms spent per spin. Charms are earned from sales, so every spin costs
## real production income: that opportunity cost is what makes the reel a
## decision rather than a free money printer.
var reel_charm_cost: int = 2
## "always" spins whenever affordable, "off" never spins.
var reel_policy: String = "always"
## Charm earned per unit sold.
var charm_per_unit: float = 0.05

var day: int = 0
var money: int = 120
var plots: int = 4
var mills: int = 0
var charms: int = 6
var bag: Dictionary = {}
var planted: Dictionary = {}   # plot index -> {crop, ready_day}
var upgrades_bought: Dictionary = {"plot": 0, "mill": 0, "market": 0, "omen": 0}

## The luck mechanic.
var reel := ReelCore.new()

## Per-day ledgers for balance analysis.
var revenue_log: Array[int] = []      # gross revenue after the reel multiplier
var opex_log: Array[int] = []         # upkeep + seeds (recurring)
var capex_log: Array[int] = []        # upgrade purchases (investment)
var reel_revenue_log: Array[int] = [] # revenue attributable to the reel

## Greedy but not optimal: buys the most expensive crop it can afford.
func _pick_crop() -> String:
	var affordable: Array[String] = []
	for name in CROPS:
		if money >= int(CROPS[name]["seed"]):
			affordable.append(name)
	if affordable.is_empty():
		return ""
	affordable.sort_custom(func(a, b): return int(CROPS[a]["seed"]) > int(CROPS[b]["seed"]))
	return affordable[0]

func _add_bag(item: String, qty: int) -> void:
	bag[item] = int(bag.get(item, 0)) + qty

func _upgrade_cost(kind: String) -> int:
	var bought := int(upgrades_bought[kind])
	var def: Dictionary = UPGRADES[kind]
	return int(round(float(def["base"]) * pow(float(def["escalate"]), bought)))

func _try_buy_upgrades() -> void:
	for kind in UPGRADES:
		var bought := int(upgrades_bought[kind])
		if bought >= int(UPGRADES[kind]["max"]):
			continue
		var cost := _upgrade_cost(kind)
		if money >= cost:
			money -= cost
			capex_today += cost
			upgrades_bought[kind] = bought + 1
			match kind:
				"plot":
					plots += 1
				"mill":
					mills += 1
				"market":
					pass
				"omen":
					reel.luck = minf(0.9, reel.luck + float(UPGRADES["omen"]["luck"]))

func _process() -> void:
	for _i in mills:
		for r in RECIPES:
			var rec: Dictionary = RECIPES[r]
			var need: Dictionary = rec["in"]
			var can := true
			for k in need:
				if int(bag.get(k, 0)) < int(need[k]):
					can = false
					break
			if not can:
				continue
			for k in need:
				bag[k] = int(bag[k]) - int(need[k])
			_add_bag(rec["out"], int(rec["qty"]))

func _demand_for(item: String) -> int:
	var base := int(demand.get(item, 8))
	var market_mult := pow(market_gain, float(int(upgrades_bought["market"])))
	var time_mult := 1.0 + float(day) / demand_growth
	return int(round(float(base) * market_mult * time_mult))

## Spin the Fate Reel if policy allows and charms suffice.
## Returns the payout multiplier (1.0 if no spin).
func _spin_reel() -> float:
	if reel_policy == "off":
		return 1.0
	if charms < reel_charm_cost:
		return 1.0
	charms -= reel_charm_cost
	var res := reel.spin()
	return float(res["payout"])

func _sell(multiplier: float) -> void:
	for item in bag.keys():
		var units := int(bag[item])
		if units <= 0:
			continue
		var v := int(CROPS.get(item, {}).get("value", 0))
		for r in RECIPES:
			if RECIPES[r]["out"] == item:
				v = int(RECIPES[r]["value"])
		var sold := mini(units, _demand_for(item))
		var base_rev := sold * v
		var effective := int(round(float(base_rev) * multiplier))
		money += effective
		revenue_today += effective
		reel_revenue_today += effective - base_rev
		charms += int(round(float(sold) * charm_per_unit))
		bag[item] = units - sold

var revenue_today: int = 0
var opex_today: int = 0
var capex_today: int = 0
var reel_revenue_today: int = 0

## Advance one day.
func step() -> void:
	day += 1
	revenue_today = 0
	opex_today = 0
	capex_today = 0
	reel_revenue_today = 0

	# operating costs: scale with what you own
	var upkeep := plots * upkeep_per_plot + mills * upkeep_per_mill
	money -= upkeep
	opex_today += upkeep

	# harvest anything ready
	for p in planted.keys():
		if day >= int(planted[p]["ready_day"]):
			var crop: String = planted[p]["crop"]
			_add_bag(crop, int(CROPS[crop]["yield"]))
			planted.erase(p)

	# plant into free plots
	for p in range(plots):
		if planted.has(p):
			continue
		var crop := _pick_crop()
		if crop == "":
			continue
		var seed_cost := int(CROPS[crop]["seed"])
		money -= seed_cost
		opex_today += seed_cost
		planted[p] = {"crop": crop, "ready_day": day + int(CROPS[crop]["days"])}

	_process()
	var mult := _spin_reel()
	_sell(mult)
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
		"plots": plots,
		"mills": mills,
		"market": int(upgrades_bought["market"]),
		"omens": int(upgrades_bought["omen"]),
		"charms": charms,
		"luck": reel.luck,
		"reel_spins": reel.spins,
		"reel_avg_payout": (reel.payout_total / float(reel.spins)) if reel.spins > 0 else 0.0,
		"money_curve": money_curve,
	}

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
## because buying a mill is progress, not a loss.
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
