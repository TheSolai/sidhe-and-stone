class_name EventDeck
extends RefCounted
## The day's weather - the events that give a day its character.
##
## Pure logic, no engine dependencies, deterministic under a fixed seed, so
## the balance harness can measure what the events do to the economy.
##
## DESIGN INTENT:
##   A management sim where every day is identical is a spreadsheet with a
##   skin. The Fate Reel injects variance into ONE number - today's payout
##   multiplier. The event deck injects variance into the DECISIONS: what
##   is worth putting on display, whether a dig is worth starting, how
##   exposed the crown should be tonight. Without it there is nothing to
##   react to, and a player's only choice is to do the same thing every day.
##
## THE EV RULE (why these multipliers are what they are):
##   Events must not, on average, make the player richer or poorer. A deck
##   that quietly paid out would be a hidden economy change, and the
##   balance harness would then be measuring a game nobody plays. So
##   demand, theft and curation are chosen in symmetric pairs around their
##   neutral values, and the harness ASSERTS that the deck's expected
##   multipliers are exactly 1.0 / 1.0 / 0.0. Events change the shape of a
##   day, not the slope of a campaign.
##
##   Charms are the one deliberate exception: a notice in the paper is a
##   small flat windfall, and its expected value is asserted to stay under
##   0.25 charms a day. Charms buy reel spins, so the harness also proves
##   the reel's share of revenue stays small once events are in play. A
##   windfall that moved the economy would show up there.
##
## THE REACTION RULE:
##   An event is only interesting if the player can do something about it.
##   Each one therefore changes a number the player already sees - demand,
##   theft risk, curator throughput, charms - rather than inventing a new
##   stat to read. The event is announced at the START of the day, before
##   the player commits to what to display, so it can actually inform a
##   decision rather than explain one after the fact.

## Each event carries:
##   title    - the headline shown to the player
##   text     - one line of flavour, shown on the day report
##   weight   - how often it comes up, relative to the others
##   demand   - multiplier on how many exhibits visitors will pay for
##   theft    - multiplier on the chance an exhibit is stolen tonight
##   curation - change in curator throughput for the day (a curator is off,
##              or an extra pair of hands turns up)
##   charm    - charms earned out of the blue
const EVENTS := {
	"fair_day": {
		"title": "Fair Day",
		"text": "The village fair has come to town. Half the county is queueing at the door.",
		"weight": 10,
		"demand": 1.4,
		"theft": 1.3,
		"curation": 0,
		"charm": 0,
	},
	"rain": {
		"title": "Rain on the Cobbles",
		"text": "Rain all afternoon. The queue never formed, but the pickpockets loved it.",
		"weight": 10,
		"demand": 0.6,
		"theft": 0.7,
		"curation": 0,
		"charm": 0,
	},
	"warded_night": {
		"title": "The Wardens Walk",
		"text": "The wardens patrol the galleries tonight. Nothing will go missing.",
		"weight": 8,
		"demand": 1.0,
		"theft": 0.4,
		"curation": 0,
		"charm": 0,
	},
	"thief_moon": {
		"title": "Thief's Moon",
		"text": "There is a low red moon over the dig, and the town feels untrustworthy.",
		"weight": 8,
		"demand": 1.0,
		"theft": 1.6,
		"curation": 0,
		"charm": 0,
	},
	"curator_holiday": {
		"title": "Curator's Holiday",
		"text": "One of the curators has taken the day. The storeroom will have to wait.",
		"weight": 7,
		"demand": 1.0,
		"theft": 1.0,
		"curation": -1,
		"charm": 0,
	},
	"extra_hands": {
		"title": "An Extra Pair of Hands",
		"text": "A volunteer has turned up to help catalogue. Twice the usual work.",
		"weight": 7,
		"demand": 1.0,
		"theft": 1.0,
		"curation": 1,
		"charm": 0,
	},
	"museum_notice": {
		"title": "A Notice in the Paper",
		"text": "A piece about the museum ran in the county paper. People are charmed by it.",
		"weight": 8,
		"demand": 1.0,
		"theft": 1.0,
		"curation": 0,
		"charm": 2,
	},
	"quiet_day": {
		"title": "An Ordinary Day",
		"text": "Nothing out of the ordinary. The gallery opens, and it opens again.",
		"weight": 22,
		"demand": 1.0,
		"theft": 1.0,
		"curation": 0,
		"charm": 0,
	},
}

## Total weight of the deck. Used for the EV assertion.
static func total_weight() -> int:
	var total := 0
	for id in EVENTS:
		total += int(EVENTS[id]["weight"])
	return total

## Draw the next event. Uses the caller's RNG so the whole simulation
## stays reproducible from a single seed.
func roll(rng: RandomNumberGenerator) -> Dictionary:
	var total := total_weight()
	if total <= 0:
		return _describe("quiet_day")
	var pick := rng.randi_range(1, total)
	var acc := 0
	for id in EVENTS:
		acc += int(EVENTS[id]["weight"])
		if pick <= acc:
			return _describe(id)
	return _describe("quiet_day")

## The event's multipliers, with the keys the simulation expects.
func _describe(id: String) -> Dictionary:
	var def: Dictionary = EVENTS[id]
	return {
		"id": id,
		"title": str(def["title"]),
		"text": str(def["text"]),
		"demand": float(def["demand"]),
		"theft": float(def["theft"]),
		"curation": int(def["curation"]),
		"charm": int(def["charm"]),
	}

## A do-nothing event, used when the deck is switched off.
##
## The harness turns the deck off to measure what the deck is worth. That
## measurement is only honest if "off" means "the ordinary day" and not
## "a day with some arbitrary different event", so this returns a real
## event with neutral multipliers.
static func neutral() -> Dictionary:
	return {
		"id": "neutral",
		"title": "An Ordinary Day",
		"text": "Nothing out of the ordinary.",
		"demand": 1.0,
		"theft": 1.0,
		"curation": 0,
		"charm": 0,
	}

## Expected value of every multiplier across the whole deck.
##
## This is the number the balance harness asserts on. If the deck's
## expected demand is not 1.0, then events are quietly rebalancing the
## economy, and every balance number measured through them is a number
## about the wrong game.
static func expected_multipliers() -> Dictionary:
	var out := {"demand": 0.0, "theft": 0.0, "curation": 0.0, "charm": 0.0}
	var total := 0
	for id in EVENTS:
		var def: Dictionary = EVENTS[id]
		var w := int(def["weight"])
		total += w
		out["demand"] += float(def["demand"]) * float(w)
		out["theft"] += float(def["theft"]) * float(w)
		out["curation"] += float(def["curation"]) * float(w)
		out["charm"] += float(def["charm"]) * float(w)
	if total > 0:
		for k in out.keys():
			out[k] = float(out[k]) / float(total)
	return out
