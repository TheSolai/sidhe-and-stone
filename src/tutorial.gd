class_name Tutorial
extends RefCounted
## The first-run coach.
##
## KairoSoft's onboarding is the craft of the genre: a new player must
## understand the CENTRAL decision within three minutes, or they never come
## back. Sidhe & Stone's central decision is vault-versus-display, so that
## is what the tutorial teaches - not "here are the buttons", but "here is
## the choice you will be making forever".
##
## The tutorial is a small ordered list of beats. Each beat has a title, a
## body, and the moment it is considered COMPLETE. Completion is checked
## against real game state, so the tutorial advances because the player did
## the thing - never because a timer elapsed.
##
## It is skippable, always. A player who wants to dig immediately should not
## have to click through a tutorial to do it.

## Every beat, in order.
##
## `done` is a String tag: when the game reports an action with this tag,
## the beat completes. An empty tag means the beat completes when the player
## presses its single "Got it" button.
const BEATS := [
	{
		"id": "welcome",
		"title": "Sidhe & Stone",
		"body": "You run a small excavation outfit on the west coast of Ireland. "
			+ "Dig into the old mounds, catalog what comes up, and decide what "
			+ "the public gets to see.",
		"done": "",
	},
	{
		"id": "dig",
		"title": "Send them digging",
		"body": "Your fairies need to know where to dig. Open Dig Sites and "
			+ "assign a dig to a site. Test pits are quick and cheap but "
			+ "shallow. Shafts take days and days, and can bring back a crown.",
		"done": "dig_assigned",
	},
	{
		"id": "wait",
		"title": "Time passes",
		"body": "Digs take days. End the day and the finds arrive as dirty "
			+ "lumps in the storeroom. Your curators clean and label them "
			+ "each day - they are the bottleneck, so more finds without more "
			+ "curators just piles up.",
		"done": "day_ended",
	},
	{
		"id": "display",
		"title": "The first decision",
		"body": "Open the Vault and press Display to put a find on show. "
			+ "This is the heart of the game: a displayed artefact earns money "
			+ "every day, but it can be stolen overnight. A vaulted one is "
			+ "safe and earns nothing.",
		"done": "displayed",
	},
	{
		"id": "reel",
		"title": "The Fate Reel",
		"body": "Charms come from takings. Spend them on the reel to multiply "
			+ "a day's earnings. A miss still pays ×1.00 - it never takes "
			+ "money away. Higher luck makes the good symbols more likely.",
		"done": "reel_spun",
	},
	{
		"id": "done",
		"title": "You're the curator now",
		"body": "Dig, catalogue, display, take the takings, reinvest. The "
			+ "gallery only pays for so many exhibits a day, so the real "
			+ "question is always: how much do I dare put on show?",
		"done": "",
	},
]

var index: int = 0
var skipped: bool = false


func _init() -> void:
	index = 0


## Is there a beat waiting to be shown?
func active() -> bool:
	return not skipped and index < BEATS.size()


## The current beat, or {} when there is none.
func current() -> Dictionary:
	if not active():
		return {}
	return BEATS[index]


## The current beat's title.
func current_title() -> String:
	var b := current()
	return str(b.get("title", ""))


## The current beat's body text.
func current_body() -> String:
	var b := current()
	return str(b.get("body", ""))


## Does the current beat complete when this action happens?
func wants(action: String) -> bool:
	var b := current()
	if b.is_empty():
		return false
	return str(b.get("done", "")) == action and action != ""


## Report an action the player took. Returns true if it completed the beat.
func report(action: String) -> bool:
	if not wants(action):
		return false
	index += 1
	return true


## The player pressed "Got it" on a beat that has no completion condition.
func advance() -> void:
	if not active():
		return
	# A beat with a completion action is finished by DOING it, not by
	# pressing a button. Only manual beats advance on the button.
	if str(current().get("done", "")) == "":
		index += 1


## The player dismissed the tutorial entirely.
func skip() -> void:
	skipped = true
	index = BEATS.size()


## How far through the tutorial the player is, 0.0 to 1.0. Used by the UI
## to show a small progress hint.
func progress() -> float:
	if skipped:
		return 1.0
	if BEATS.is_empty():
		return 1.0
	return clampf(float(index) / float(BEATS.size()), 0.0, 1.0)


func to_dict() -> Dictionary:
	return {"index": index, "skipped": skipped}


func from_dict(d: Dictionary) -> void:
	index = int(d.get("index", 0))
	skipped = bool(d.get("skipped", false))
