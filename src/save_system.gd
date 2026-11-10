class_name SaveSystem
extends RefCounted
## Disk persistence for Sidhe & Stone.
##
## Saves live in user:// so they survive a restart on every platform, and in
## JSON so that a save you can read is a save you can debug.
##
## The write is ATOMIC: the payload goes to a temporary file which is then
## renamed over the real one. A crash halfway through a write therefore
## leaves the previous good save intact, rather than a half-written file
## that cannot be loaded. Losing a player's night to a bad shutdown is not
## a bug you want to hear about.

const SAVE_DIR := "user://saves"
const SAVE_PATH := "user://saves/sidhe_and_stone.save"
const SETTINGS_PATH := "user://settings.json"

## The version of the save format. Bumped whenever the shape changes in a
## way an older build could not read. A save with a newer version is
## rejected rather than silently half-loaded.
const SAVE_VERSION := 1


static func ensure_dir() -> void:
	if not DirAccess.dir_exists_absolute(SAVE_DIR):
		DirAccess.make_dir_recursive_absolute(SAVE_DIR)


## Write a payload to the save slot.
##
## Returns true on success. Never throws: a failed save is a warning, not
## a crash, because the player has other things to do.
static func save(payload: Dictionary) -> bool:
	ensure_dir()
	var body := {
		"version": SAVE_VERSION,
		"payload": payload,
	}
	var tmp_path := SAVE_PATH + ".tmp"
	var f := FileAccess.open(tmp_path, FileAccess.WRITE)
	if f == null:
		push_warning("SaveSystem: could not open %s (err %d)" % [tmp_path, FileAccess.get_open_error()])
		return false
	f.store_string(JSON.stringify(body, "\t"))
	f.close()

	# Replace the real save only once the new one is fully written.
	if FileAccess.file_exists(SAVE_PATH):
		var old := SAVE_PATH + ".old"
		if FileAccess.file_exists(old):
			DirAccess.remove_absolute(old)
		DirAccess.rename_absolute(SAVE_PATH, old)
	if DirAccess.rename_absolute(tmp_path, SAVE_PATH) != OK:
		# The rename failed - put the old one back rather than lose it.
		if FileAccess.file_exists(SAVE_PATH + ".old"):
			DirAccess.rename_absolute(SAVE_PATH + ".old", SAVE_PATH)
		return false
	return true


## Load a payload from the save slot. Returns {} if there is nothing to load.
static func load_payload() -> Dictionary:
	if not FileAccess.file_exists(SAVE_PATH):
		return {}
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if f == null:
		return {}
	var text := f.get_as_text()
	f.close()
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_warning("SaveSystem: save file is not valid JSON")
		return {}
	var body: Dictionary = parsed
	var version := int(body.get("version", 0))
	if version > SAVE_VERSION:
		push_warning("SaveSystem: save is version %d, this build understands %d"
			% [version, SAVE_VERSION])
		return {}
	var payload: Variant = body.get("payload", {})
	if typeof(payload) != TYPE_DICTIONARY:
		return {}
	return payload


static func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)


## Delete the save slot. Used by "New Game" so a fresh start is genuinely
## fresh rather than silently continuing from stale state.
static func clear_save() -> void:
	ensure_dir()
	for p in [SAVE_PATH, SAVE_PATH + ".tmp", SAVE_PATH + ".old"]:
		if FileAccess.file_exists(p):
			DirAccess.remove_absolute(p)


## Small key/value settings, separate from the save so that changing a
## setting never risks the player's game state.
static func save_settings(s: Dictionary) -> void:
	var f := FileAccess.open(SETTINGS_PATH, FileAccess.WRITE)
	if f == null:
		return
	f.store_string(JSON.stringify(s, "\t"))
	f.close()


static func load_settings() -> Dictionary:
	if not FileAccess.file_exists(SETTINGS_PATH):
		return {}
	var f := FileAccess.open(SETTINGS_PATH, FileAccess.READ)
	if f == null:
		return {}
	var text := f.get_as_text()
	f.close()
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		return {}
	return parsed
