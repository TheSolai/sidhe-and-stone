class_name Goals
extends RefCounted
## The player's ladder of milestones.
##
## A management game needs to show the player where they are going, not just
## where they are. Without this the game is a daily treadmill: every day is
## the same decision with a bigger number on it, and the player has no way
## to tell "I am making progress" from "I am spinning the wheels".
##
## The ladder is deliberately shallow - three tiers, twelve goals - and every
## goal is a thing the player has ALREADY been doing, just noticed. Nothing
## here asks for a new verb. "Catalogue 10 finds" is what a curator does.
##
## Rewards are granted automatically the moment a goal completes, and the
## completion is written into the ledger, so the ladder also doubles as the
## game's narrative spine: the ledger is no longer only losses and daily
## takings, it also records the things you built.
##
## ## Why the rewards are scaled the way they are
##
## A milestone reward has to be worth roughly FOUR DAYS of the player's
## operating income at the moment it lands. That sounds arbitrary; it is
## not. It is the only rule that keeps the ladder meaningful at BOTH ends
## of the curve:
##
##   * Too small and the milestone stops mattering. The player earns more
##     in one afternoon than the reward is worth, and the ladder becomes
##     wallpaper. The Renown tier was in exactly this state before this
##     rule was applied - "Renowned" paid £5,000 on a day the gallery
##     turned over £5,872.
##   * Too large and the milestone replaces the game. The player stops
##     trading and starts waiting for the payout.
##
## So the rewards are not a flat list of round numbers. They scale with
## the economy the player is standing in, and the balance harness MEASURES
## that ratio on every run and fails the build if a reward drifts outside
## the 1x-12x band. The rule lives in the harness, not in a comment.
##
## The ladder is also ordered by when each goal actually lands, measured
## over a full year of play. The tiers are therefore phases of the game,
## not decoration: Opening is the first week, Steady Trade is the first
## month, Renown is everything after.

const TIERS := ["Opening", "Steady Trade", "Renown"]

const GOALS := [
	{
		"id": "open_doors",
		"tier": "Opening",
		"title": "Open Doors",
		"body": "End your first day of trading.",
		"metric": "days",
		"target": 1,
		"reward": {"charms": 3, "luck": 0.02},
	},
	{
		"id": "first_exhibit",
		"tier": "Opening",
		"title": "Something to Show",
		"body": "Put one exhibit on the gallery floor.",
		"metric": "on_display",
		"target": 1,
		"reward": {"charms": 2, "luck": 0.03},
	},
	{
		"id": "house_of_oddities",
		"tier": "Opening",
		"title": "A House of Oddities",
		"body": "Keep 4 exhibits on display at once.",
		"metric": "on_display",
		"target": 4,
		"reward": {"money": 250},
	},
	{
		"id": "apprentice",
		"tier": "Opening",
		"title": "Curator's Apprentice",
		"body": "Catalogue 10 finds.",
		"metric": "curated_total",
		"target": 10,
		"reward": {"money": 550},
	},
	{
		"id": "clean_sweep",
		"tier": "Opening",
		"title": "A Clean Sweep",
		"body": "Go 7 nights without losing a thing to thieves.",
		"metric": "clean_nights",
		"target": 7,
		"reward": {"charms": 3, "luck": 0.05},
	},
	{
		"id": "treasury",
		"tier": "Steady Trade",
		"title": "The Treasury Grows",
		"body": "Keep 10 pieces in the vault.",
		"metric": "vault_count",
		"target": 10,
		"reward": {"money": 950},
	},
	{
		"id": "crown_on_show",
		"tier": "Steady Trade",
		"title": "A Crown on Show",
		"body": "Display a crown.",
		"metric": "crowns_displayed",
		"target": 1,
		"reward": {"money": 2050},
	},
	{
		"id": "good_day",
		"tier": "Steady Trade",
		"title": "A Very Good Day",
		"body": "Earn £300 in a single day.",
		"metric": "max_day_revenue",
		"target": 300,
		"reward": {"money": 250},
	},
	{
		"id": "grander_gallery",
		"tier": "Steady Trade",
		"title": "A Grander Gallery",
		"body": "Extend the gallery to 8 slots.",
		"metric": "gallery_slots",
		"target": 8,
		"reward": {"money": 2500},
	},
	{
		"id": "institution",
		"tier": "Steady Trade",
		"title": "An Institution",
		"body": "Trade for 30 days.",
		"metric": "days",
		"target": 30,
		"reward": {"money": 12500},
	},
	{
		"id": "strongbox",
		"tier": "Renown",
		"title": "Full Coffers",
		"body": "Take £5,000 across the gallery's whole history.",
		"metric": "total_revenue",
		"target": 5000,
		"reward": {"money": 2500},
	},
	{
		"id": "renowned",
		"tier": "Renown",
		"title": "Renowned",
		"body": "Trade for 60 days.",
		"metric": "days",
		"target": 60,
		"reward": {"money": 36000, "charms": 5},
	},
]

## Ids of goals already completed. Kept here so the ladder's history saves
## with the game.
var completed: Array[String] = []


func _init() -> void:
	pass


## True if this goal has already been earned.
func is_complete(id: String) -> bool:
	return completed.has(id)


## Mark a goal complete. Returns false if it already was.
func complete(id: String) -> bool:
	if completed.has(id):
		return false
	completed.append(id)
	return true


## How far along the player is on one goal, in the goal's own units.
## Every metric is something the player has already done - none of them
## asks for a new verb, they just make the existing loop visible.
func progress_for(goal: Dictionary, ctx: Dictionary) -> float:
	match str(goal["metric"]):
		"days":
			return float(ctx.get("days", 0))
		"on_display":
			return float(ctx.get("on_display", 0))
		"curated_total":
			return float(ctx.get("curated_total", 0))
		"money":
			return float(ctx.get("money", 0))
		"vault_count":
			return float(ctx.get("vault_count", 0))
		"gallery_slots":
			return float(ctx.get("gallery_slots", 0))
		"clean_nights":
			return float(ctx.get("clean_nights", 0))
		"crowns_displayed":
			return float(ctx.get("crowns_displayed", 0))
		"max_day_revenue":
			return float(ctx.get("max_day_revenue", 0))
		"total_revenue":
			return float(ctx.get("total_revenue", 0))
	return 0.0


## A short human-readable reward, for the card.
func reward_text(goal: Dictionary) -> String:
	var r: Dictionary = goal["reward"]
	var bits: Array[String] = []
	if r.has("money"):
		bits.append("£%d" % int(r["money"]))
	if r.has("charms"):
		bits.append("%d☘" % int(r["charms"]))
	if r.has("luck"):
		bits.append("+%.2f luck" % float(r["luck"]))
	return " · ".join(bits)


## The money a goal pays, for the balance harness. Zero for goals that pay
## only in charms or luck.
static func reward_money(goal: Dictionary) -> int:
	var r: Dictionary = goal["reward"]
	if r.has("money"):
		return int(r["money"])
	return 0


## The goal the player is working toward right now: the first one on the
## ladder that is not yet complete. Returns {} when the ladder is done.
func next_goal(ctx: Dictionary) -> Dictionary:
	for g in GOALS:
		if not completed.has(str(g["id"])):
			return g
	return {}


func to_dict() -> Dictionary:
	return {"completed": completed.duplicate()}


func from_dict(d: Dictionary) -> void:
	completed.clear()
	for id in d.get("completed", []):
		completed.append(str(id))
