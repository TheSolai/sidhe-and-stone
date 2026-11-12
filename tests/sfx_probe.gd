extends SceneTree
## Probe: the runtime sound engine builds all six sounds as real buffers.
##
## There are no audio files in this project, so this probe is the proof that
## the synthesis works: every sound must produce a non-empty, non-silent
## AudioStreamWAV whose samples stay inside the clip threshold.
##
## Run with:
##   godot --headless --path . --script res://tests/sfx_probe.gd

const NAMES := ["click", "reel_stop", "win", "lose", "chime", "day_end"]
const CLIP_LIMIT := 0.9


func _initialize() -> void:
	# The scene tree root may not exist during script construction in every
	# Godot build, so defer the actual work until we are sure it does.
	if root == null:
		_run.call_deferred()
	else:
		_run()


func _run() -> void:
	var failures: Array[String] = []

	# Load by path so the probe does not depend on the global class cache
	# having been regenerated for a brand new script file.
	var script: Script = load("res://src/sfx.gd")
	if script == null:
		print("SFX PROBE VERDICT: FAILED - could not load res://src/sfx.gd")
		quit(1)
		return

	var sfx = script.new()
	if sfx == null:
		print("SFX PROBE VERDICT: FAILED - could not instantiate StoneSfx")
		quit(1)
		return

	root.add_child(sfx)

	for n in NAMES:
		var stream = sfx.stream_for(n)
		if stream == null:
			failures.append("%s: stream is null" % n)
			print("%s: FAILED - stream is null" % n)
			continue

		var data: PackedByteArray = stream.data
		if data.size() <= 0:
			failures.append("%s: empty buffer" % n)
			print("%s: FAILED - empty buffer" % n)
			continue

		if stream.format != AudioStreamWAV.FORMAT_16_BITS:
			failures.append("%s: wrong format" % n)
		if stream.mix_rate != 44100:
			failures.append("%s: wrong mix rate" % n)
		if stream.stereo:
			failures.append("%s: not mono" % n)

		var frames := data.size() / 2
		var duration_ms := float(frames) / float(stream.mix_rate) * 1000.0

		var peak := 0.0
		var nonzero := 0
		for i in frames:
			var raw := data.decode_s16(i * 2)
			var amp := absf(float(raw) / 32767.0)
			if amp > 0.00001:
				nonzero += 1
			peak = maxf(peak, amp)

		if nonzero == 0:
			failures.append("%s: buffer is all zeros" % n)
		if peak > CLIP_LIMIT:
			failures.append("%s: peak %.3f exceeds clip limit %.2f" % [n, peak, CLIP_LIMIT])

		print("%s: %.1f ms, peak %.3f, frames %d, nonzero %d" % [
			n, duration_ms, peak, frames, nonzero,
		])

	# Unknown names must be a no-op, not a crash.
	var unknown = sfx.stream_for("no_such_sound")
	if unknown != null:
		failures.append("unknown name returned a stream")
	sfx.play("no_such_sound")

	if failures.is_empty():
		print("SFX PROBE VERDICT: ok - 6 sounds")
		quit(0)
	else:
		print("SFX PROBE VERDICT: FAILED - %s" % ", ".join(failures))
		quit(1)
