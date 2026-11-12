class_name StoneSfx
extends Node
## Runtime sound engine for SIDHE & STONE.
##
## There are no audio assets in this game. Every sound is synthesised at
## runtime into an AudioStreamWAV buffer, exactly like the sibling web
## build does with the Web Audio API (web/src/ui/audio.ts). No .wav, no
## .ogg, nothing to download, nothing to ship.
##
## The sound design is shared with the web port:
##   - short, soft, slightly woody (a sine fundamental plus a quiet second
##     harmonic, so it reads as a small wooden thing rather than a test tone)
##   - never loud. The web master gain is 0.22; here the buffers are
##     normalised to modest peaks and the caller supplies volume_db.
##   - the game is meant to sit open in a background tab, so nothing here
##     should ever make a player wince.
##
## Usage:
##     var sfx := StoneSfx.new()
##     add_child(sfx)
##     sfx.play("click")
##     sfx.play("win", -4.0, 1.05)
##
## play() is safe to call at any time, including before any sound has been
## built and with a name that does not exist. It never crashes and never
## spams the log.
##
## Pitch is NOT baked into the buffers. The caller varies it per call with
## the pitch argument, which is applied to the AudioStreamPlayer.

## Sample rate of every generated buffer.
const MIX_RATE := 44100

## How many players exist so overlapping sounds do not cut each other off.
const POOL_SIZE := 6

## Hard ceiling: no generated sample may exceed this fraction of full scale.
const CLIP_LIMIT := 0.9

## Master feel: the web port runs its master gain at 0.22. We normalise each
## sound to a target peak instead, which keeps the mix soft but readable.
const MASTER := 0.45

var _pool: Array[AudioStreamPlayer] = []
var _pool_index := 0
var _streams: Dictionary = {}
var _specs: Dictionary = {}


func _ready() -> void:
	_ensure_pool()
	_build_all()


## Create the player pool lazily. Safe to call more than once.
func _ensure_pool() -> void:
	if not _pool.is_empty():
		return
	for i in POOL_SIZE:
		var p := AudioStreamPlayer.new()
		p.name = "SfxPlayer%d" % i
		add_child(p)
		_pool.append(p)


## Play a named sound.
##
## Unknown names are ignored. volume_db and pitch are applied to the player,
## not to the shared buffer, so the same stream can be reused at any pitch.
func play(name: String, volume_db: float = 0.0, pitch: float = 1.0) -> void:
	var stream: AudioStreamWAV = stream_for(name)
	if stream == null:
		return
	_ensure_pool()
	if _pool.is_empty():
		return
	var player: AudioStreamPlayer = _pool[_pool_index]
	_pool_index = (_pool_index + 1) % _pool.size()
	player.stream = stream
	player.volume_db = clampf(volume_db, -40.0, 6.0)
	player.pitch_scale = clampf(pitch, 0.25, 4.0)
	player.play()


## The generated stream for a sound name, or null if the name is unknown.
## Exposed so probes and tools can inspect the buffer without playing it.
func stream_for(name: String) -> AudioStreamWAV:
	if _streams.has(name):
		return _streams[name]
	if _specs.is_empty():
		_build_all()
	if not _specs.has(name):
		return null
	var stream: AudioStreamWAV = _synth(_specs[name])
	_streams[name] = stream
	return stream


## Every sound name this engine knows about.
func sound_names() -> PackedStringArray:
	var out := PackedStringArray()
	for k in _specs.keys():
		out.append(String(k))
	return out


func _build_all() -> void:
	_specs = {
		"click": {
			"peak": 0.40,
			"notes": [
				{"f": 520.0, "t": 0.0, "d": 0.040, "g": 1.0, "tau": 0.011, "h": [1.0, 0.30, 0.10]},
			],
		},
		"reel_stop": {
			"peak": 0.42,
			"notes": [
				{"f": 300.0, "t": 0.0, "d": 0.090, "g": 0.9, "tau": 0.028, "h": [1.0, 0.34, 0.12]},
				{"f": 150.0, "t": 0.0, "d": 0.090, "g": 0.55, "tau": 0.034, "h": [1.0, 0.18]},
			],
		},
		"win": {
			"peak": 0.45,
			"notes": [
				{"f": 660.0, "t": 0.0, "d": 0.350, "g": 1.0, "tau": 0.130, "h": [1.0, 0.28, 0.08]},
				{"f": 990.0, "t": 0.090, "d": 0.260, "g": 0.72, "tau": 0.110, "h": [1.0, 0.22, 0.06]},
			],
		},
		"lose": {
			"peak": 0.34,
			"notes": [
				{"f": 392.0, "t": 0.0, "d": 0.300, "g": 1.0, "tau": 0.100, "h": [1.0, 0.17, 0.05]},
				{"f": 294.0, "t": 0.110, "d": 0.190, "g": 0.80, "tau": 0.090, "h": [1.0, 0.14]},
			],
		},
		"chime": {
			"peak": 0.50,
			"notes": [
				{"f": 880.0, "t": 0.0, "d": 0.600, "g": 1.0, "tau": 0.220, "h": [1.0, 0.44, 0.22, 0.10]},
				{"f": 1320.0, "t": 0.030, "d": 0.500, "g": 0.38, "tau": 0.160, "h": [1.0, 0.30]},
			],
		},
		"day_end": {
			"peak": 0.40,
			"notes": [
				{"f": 160.0, "t": 0.0, "d": 0.250, "g": 1.0, "tau": 0.090, "h": [1.0, 0.18]},
				{"f": 240.0, "t": 0.0, "d": 0.250, "g": 0.32, "tau": 0.070, "h": [1.0]},
			],
		},
	}


## Turn a note list into an AudioStreamWAV.
##
## Each note is a fundamental frequency with a start time, a duration, an
## amplitude, an exponential decay constant and a list of harmonic gains.
## The sum is scaled so the loudest sample hits the requested peak, then
## clamped well below full scale.
func _synth(spec: Dictionary) -> AudioStreamWAV:
	var notes: Array = spec["notes"]
	var target_peak := float(spec.get("peak", 0.4)) * MASTER

	var total := 0.0
	for n in notes:
		total = maxf(total, float(n["t"]) + float(n["d"]))
	total += 0.02

	var frames := int(ceil(total * float(MIX_RATE)))
	var samples := PackedFloat32Array()
	samples.resize(frames)

	var peak := 0.0
	for i in frames:
		var t := float(i) / float(MIX_RATE)
		var v := 0.0
		for n in notes:
			var nt := t - float(n["t"])
			var dur := float(n["d"])
			if nt < 0.0 or nt > dur:
				continue
			# Fast exponential attack (no click) into an exponential decay.
			var env := exp(-nt / float(n["tau"])) * (1.0 - exp(-nt / 0.004))
			# Short release so the note ends at zero instead of stepping.
			var tail := dur - nt
			if tail < 0.012:
				env *= tail / 0.012
			var f := float(n["f"])
			var tone := 0.0
			var harmonics: Array = n["h"]
			for k in harmonics.size():
				tone += float(harmonics[k]) * sin(TAU * f * float(k + 1) * nt)
			v += float(n["g"]) * tone * env
		samples[i] = v
		peak = maxf(peak, absf(v))

	var scale := 1.0
	if peak > 0.00001:
		scale = target_peak / peak

	var data := PackedByteArray()
	data.resize(frames * 2)
	for i in frames:
		var s := clampf(samples[i] * scale, -CLIP_LIMIT, CLIP_LIMIT)
		data.encode_s16(i * 2, int(round(s * 32767.0)))

	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = MIX_RATE
	stream.stereo = false
	stream.data = data
	return stream
