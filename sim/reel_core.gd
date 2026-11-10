class_name ReelCore
extends RefCounted
## The Fate Reel - the luck mechanic for the fairy management sim.
##
## Pure logic, no engine dependencies, deterministic under a fixed seed, so the
## balance harness can measure whether the reel is a fair gamble or a slot
## machine that eats the economy.
##
## DESIGN INTENT (why a reel at all):
##   In a Kairosoft-style sim the production loop is deterministic and
##   predictable. That is comfortable, but it is also flat - once you know
##   the optimal build, nothing surprising happens. The reel injects variance
##   exactly where the player has a decision: should I spend charms (a
##   scarce resource earned from sales) to buy a chance at a better day's
##   production, or bank the deterministic income and spend charms elsewhere?
##
##   The reel must therefore be a MARGINAL amplifier, not the economy. If the
##   reel drove most of the revenue, the management layer would stop mattering
##   and the game would collapse into "spin forever". The harness enforces
##   that as a hard rule.
##
## FAIRNESS RULES baked into the payout table:
##   * The multiplier is BOUNDED, both ways. Best case 2.6x, worst case 0.85x.
##     An unbounded multiplier (like a 12x jackpot on a late-game day) creates
##     absolute swings that swamp the economy and make the game unreadable.
##   * The neutral outcome pays exactly 1.0x - a miss is a wasted charm, never
##     a punishment. Cozy games punish through opportunity cost, not by
##     taking money back.
##   * EV at zero luck sits near 1.0. The reel does not print money for free.
##   * Luck shifts weights toward the rewarding end, so EV rises with luck.
##     Luck is therefore the thing the player is really buying, and the reel
##     is the lens that displays it.
##   * A player who never spins still earns a fair, steady income. The reel
##     is upside, never the foundation.

## Symbol table.
##   mult   - payout multiplier for this symbol
##   weight - base selection weight
##   good   - whether luck increases this symbol's weight
const SYMBOLS := {
	"clover": {"mult": 1.30, "weight": 26.0, "good": true},
	"honey":  {"mult": 1.60, "weight": 16.0, "good": true},
	"moon":   {"mult": 2.00, "weight": 8.0,  "good": true},
	"star":   {"mult": 2.60, "weight": 4.0,  "good": true},
	"bog":    {"mult": 0.90, "weight": 26.0, "good": false},
	"blight": {"mult": 0.85, "weight": 22.0, "good": false},
}

## A partial match (two of a kind) pays this fraction of the symbol's bonus
## over 1.0. A pair of clovers pays 1 + 0.30 * 0.35 = 1.105x.
const PAIR_BONUS_FRACTION := 0.35

## A total miss pays exactly this - the neutral outcome. No punishment.
const MISS_PAYOUT := 1.0

## How hard luck pushes the weights around.
const LUCK_SPREAD := 0.8

## Current luck stat, 0.0 - 1.0. Raised by hired fairies and upgrades.
var luck: float = 0.0

## Deterministic RNG so balance runs are reproducible.
var rng := RandomNumberGenerator.new()
var seed_value: int = 20261110

## Lifetime stats for balance analysis.
var spins: int = 0
var payout_total: float = 0.0
var biggest_win: float = 0.0
var worst_spin: float = 99.0
var triple_hits: int = 0

func _init(new_seed: int = 20261110) -> void:
	seed_value = new_seed
	rng.seed = seed_value

func reseed(new_seed: int) -> void:
	seed_value = new_seed
	rng.seed = seed_value

## Weight of each symbol after luck is applied.
func weights() -> Dictionary:
	var out := {}
	for s in SYMBOLS:
		var def: Dictionary = SYMBOLS[s]
		var w := float(def["weight"])
		if bool(def["good"]):
			w *= (1.0 + luck * LUCK_SPREAD)
		else:
			w *= maxf(0.05, 1.0 - luck * LUCK_SPREAD * 0.9)
		out[s] = w
	return out

## Payout multiplier for a given reel configuration.
## reels - three symbol ids.
static func payout_for(reels: Array) -> float:
	var counts := {}
	for r in reels:
		counts[r] = int(counts.get(r, 0)) + 1
	var best := ""
	var best_count := 0
	var best_mult := 0.0
	for s in counts:
		var c := int(counts[s])
		var m := float(SYMBOLS[s]["mult"])
		if c > best_count or (c == best_count and m > best_mult):
			best = s
			best_count = c
			best_mult = m
	if best_count == 3:
		return best_mult
	if best_count == 2:
		return 1.0 + (best_mult - 1.0) * PAIR_BONUS_FRACTION
	return MISS_PAYOUT

## Spin the reel. Returns {reels: Array[String], payout: float, pattern: String}.
## payout is a MULTIPLIER applied to that day's production.
func spin() -> Dictionary:
	var w := weights()
	var total := 0.0
	for s in w:
		total += float(w[s])

	var reels: Array[String] = []
	for _i in 3:
		var roll := rng.randf() * total
		var acc := 0.0
		var chosen := "clover"
		for s in w:
			acc += float(w[s])
			if roll <= acc:
				chosen = s
				break
		reels.append(chosen)

	var counts := {}
	for r in reels:
		counts[r] = int(counts.get(r, 0)) + 1
	var best_count := 0
	for s in counts:
		best_count = maxi(best_count, int(counts[s]))

	var payout := payout_for(reels)
	var pattern := "miss"
	if best_count == 3:
		pattern = "triple"
		triple_hits += 1
	elif best_count == 2:
		pattern = "pair"

	spins += 1
	payout_total += payout
	biggest_win = maxf(biggest_win, payout)
	worst_spin = minf(worst_spin, payout)
	return {"reels": reels, "payout": payout, "pattern": pattern}

## Analytic expected value of one spin at the given luck. Exact, not sampled:
## there are only 216 three-reel outcomes, so this costs nothing and has no
## sampling noise in the balance report.
func expected_value(at_luck: float = -1.0) -> float:
	var saved := luck
	if at_luck >= 0.0:
		luck = at_luck
	var w := weights()
	var total := 0.0
	for s in w:
		total += float(w[s])
	var p := {}
	for s in w:
		p[s] = float(w[s]) / total

	var ev := 0.0
	for a in p.keys():
		for b in p.keys():
			for c in p.keys():
				var prob := float(p[a]) * float(p[b]) * float(p[c])
				ev += prob * payout_for([a, b, c])

	luck = saved
	return ev

## Probability distribution of outcome patterns, for reporting.
func pattern_distribution() -> Dictionary:
	var w := weights()
	var total := 0.0
	for s in w:
		total += float(w[s])
	var p := {}
	for s in w:
		p[s] = float(w[s]) / total
	var out := {"triple": 0.0, "pair": 0.0, "miss": 0.0}
	for a in p.keys():
		for b in p.keys():
			for c in p.keys():
				var prob := float(p[a]) * float(p[b]) * float(p[c])
				var reels := [a, b, c]
				var counts := {}
				for r in reels:
					counts[r] = int(counts.get(r, 0)) + 1
				var best_count := 0
				for s in counts:
					best_count = maxi(best_count, int(counts[s]))
				var pat := "miss"
				if best_count == 3:
					pat = "triple"
				elif best_count == 2:
					pat = "pair"
				out[pat] = float(out[pat]) + prob
	return out

## Simulated coefficient of variation of the payout multiplier. This is the
## honest measure of how swingy the reel feels: bounded multipliers mean this
## stays small even late in the game.
func simulate_cv(spins: int = 20000) -> float:
	var saved_seed := seed_value
	var saved_luck := luck
	rng.seed = seed_value
	var vals: Array[float] = []
	for _i in spins:
		var reel := [_pick(), _pick(), _pick()]
		vals.append(payout_for(reel))
	var mean := 0.0
	for v in vals:
		mean += v
	mean /= float(vals.size())
	var acc := 0.0
	for v in vals:
		acc += pow(v - mean, 2.0)
	var cv := sqrt(acc / float(vals.size() - 1)) / maxf(0.0001, abs(mean))
	rng.seed = saved_seed
	luck = saved_luck
	return cv

## One random reel, using the current weights.
func _pick() -> String:
	var w := weights()
	var total := 0.0
	for s in w:
		total += float(w[s])
	var roll := rng.randf() * total
	var acc := 0.0
	for s in w:
		acc += float(w[s])
		if roll <= acc:
			return s
	return "clover"


## Snapshot the reel for saving.
##
## The RNG state is stored as a STRING on purpose: it is a uint64 and JSON
## numbers are doubles, so round-tripping it as a number would corrupt the
## sequence and silently change every future spin.
func to_dict() -> Dictionary:
	return {
		"luck": luck,
		"seed": seed_value,
		"rng_state": str(rng.state),
		"spins": spins,
		"payout_total": payout_total,
		"biggest_win": biggest_win,
		"worst_spin": worst_spin,
		"triple_hits": triple_hits,
	}


## Restore a reel snapshot. See to_dict() for why the RNG state is a string.
func from_dict(d: Dictionary) -> void:
	luck = float(d.get("luck", 0.0))
	seed_value = int(d.get("seed", 20261110))
	spins = int(d.get("spins", 0))
	payout_total = float(d.get("payout_total", 0.0))
	biggest_win = float(d.get("biggest_win", 0.0))
	worst_spin = float(d.get("worst_spin", 99.0))
	triple_hits = int(d.get("triple_hits", 0))
	var st := str(d.get("rng_state", ""))
	if st.is_valid_int():
		rng.state = int(st)
	else:
		rng.seed = seed_value
