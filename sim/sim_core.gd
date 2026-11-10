class_name SimCore
extends RefCounted
## Pure-logic economy model for a Kairosoft-style production sim.
##
## No engine dependencies on purpose: this file can be unit-tested and run
## headless for thousands of simulated days, so the economy can be balanced
## numerically BEFORE any art, UI or audio exists. That is the whole point
## of shipping this inside a headless-capable engine.
##
## The economic model has three parts:
##   1. Demand caps  - the village buys at most N units of each item per day.
##                      You cannot sell infinite wheat. This is the ceiling.
##   2. Escalating costs - every upgrade costs more than the last, and running
##                      more plots/mills costs more every day.
##   3. Reinvestment   - surplus money buys upgrades that raise demand, which
##                      lets you sell more. This is the intended growth loop.

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
const UPGRADES := {
	"plot": {"base": 180, "escalate": 1.45, "max": 24},
	"mill": {"base": 520, "escalate": 1.55, "max": 6},
	"market": {"base": 700, "escalate": 1.60, "max": 12},
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

var day: int = 0
var money: int = 120
var plots: int = 4
var mills: int = 0
var bag: Dictionary = {}
var planted: Dictionary = {}   # plot index -> {crop, ready_day}
var upgrades_bought: Dictionary = {"plot": 0, "mill": 0, "market": 0}

## Per-day ledger for balance analysis.
var revenue_log: Array[int] = []
var expense_log: Array[int] = []

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
			expenses_today += cost
			upgrades_bought[kind] = bought + 1
			match kind:
				"plot":
					plots += 1
				"mill":
					mills += 1
				"market":
					pass

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

func _sell() -> void:
	for item in bag.keys():
		var units := int(bag[item])
		if units <= 0:
			continue
		var v := int(CROPS.get(item, {}).get("value", 0))
		for r in RECIPES:
			if RECIPES[r]["out"] == item:
				v = int(RECIPES[r]["value"])
		var sold := mini(units, _demand_for(item))
		money += sold * v
		revenue_today += sold * v
		bag[item] = units - sold

var revenue_today: int = 0
var expenses_today: int = 0

## Advance one day.
func step() -> void:
	day += 1
	revenue_today = 0
	expenses_today = 0

	# operating costs: scale with what you own
	var upkeep := plots * upkeep_per_plot + mills * upkeep_per_mill
	money -= upkeep
	expenses_today += upkeep

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
		expenses_today += seed_cost
		planted[p] = {"crop": crop, "ready_day": day + int(CROPS[crop]["days"])}

	_process()
	_sell()
	_try_buy_upgrades()

	revenue_log.append(revenue_today)
	expense_log.append(expenses_today)

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
		"money_curve": money_curve,
	}

static func _median(values: Array[int]) -> float:
	if values.is_empty():
		return 0.0
	var s := values.duplicate()
	s.sort()
	return float(s[int(s.size() / 2)])

## Balance report. Judges the economy, not the bank balance: cumulative money
## is supposed to grow, so the verdict is driven by DAILY NET INCOME.
static func analyse(curve: Array[int], revenue: Array[int], expense: Array[int]) -> Dictionary:
	if curve.size() < 12:
		return {"verdict": "insufficient data"}
	var n := curve.size()
	var third := n / 3

	var net_first: Array[int] = []
	var net_last: Array[int] = []
	for i in range(n):
		var net := int(revenue[i]) - int(expense[i])
		if i < third:
			net_first.append(net)
		elif i >= n - third:
			net_last.append(net)

	var m_first := _median(net_first)
	var m_last := _median(net_last)
	var active_days := 0
	for i in range(1, n):
		if curve[i] > curve[i - 1]:
			active_days += 1
	var active_pct := float(active_days) / float(n)

	var verdict := "healthy"
	var detail := "net income stable across the curve"
	if m_first <= 0.0:
		verdict = "STALLS — early game earns nothing"
		detail = "first third median net income <= 0"
	elif m_last < m_first * 0.5:
		verdict = "DECLINING — late game earns less than early game"
		detail = "late net income %.0f vs early %.0f" % [m_last, m_first]
	elif m_last > maxf(m_first * 50.0, 500.0):
		verdict = "RUNAWAY — net income explodes"
		detail = "late net income %.0f vs early %.0f" % [m_last, m_first]
	elif active_pct < 0.35:
		verdict = "STALLS — player idles too often"
		detail = "only %.0f%% of days made a profit" % (active_pct * 100.0)

	return {
		"verdict": verdict,
		"detail": detail,
		"net_early": m_first,
		"net_late": m_last,
		"active_pct": active_pct,
		"day1": curve[0],
		"final": curve[n - 1],
	}
