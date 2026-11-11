extends SceneTree
## Generates the authoritative RNG fixtures used by the web port's parity
## tests. Every call records the generator state AFTER the call, so the
## TypeScript implementation can be checked step by step rather than only
## on its output values.
##
## Run from the project root:
##   godot --headless --path . --script res://sim/gen_rng_fixtures.gd

const SEEDS := [1, 2, 7, 12345, 20261110, 999999]

func _init() -> void:
	var out := {}

	for s in SEEDS:
		var rec := {}

		# --- randi, with the state after every call ---
		var a := RandomNumberGenerator.new()
		a.seed = s
		rec["state_after_seed"] = str(a.state)
		var ai: Array = []
		var ais: Array = []
		for i in range(40):
			ai.append(a.randi())
			ais.append(str(a.state))
		rec["randi"] = ai
		rec["randi_state"] = ais

		# --- randf, with the state after every call ---
		var b := RandomNumberGenerator.new()
		b.seed = s
		var bf: Array = []
		var bfs: Array = []
		for i in range(40):
			bf.append(b.randf())
			bfs.append(str(b.state))
		rec["randf"] = bf
		rec["randf_state"] = bfs

		# --- randf_range(0, 10) ---
		var h := RandomNumberGenerator.new()
		h.seed = s
		var hf: Array = []
		var hfs: Array = []
		for i in range(20):
			hf.append(h.randf_range(0.0, 10.0))
			hfs.append(str(h.state))
		rec["randf_range"] = hf
		rec["randf_range_state"] = hfs

		# --- randi_range(1, 10) ---
		var d := RandomNumberGenerator.new()
		d.seed = s
		var dv: Array = []
		var ds: Array = []
		for i in range(40):
			dv.append(d.randi_range(1, 10))
			ds.append(str(d.state))
		rec["range_1_10"] = dv
		rec["range_1_10_state"] = ds

		# --- randi_range(3, 9) ---
		var f := RandomNumberGenerator.new()
		f.seed = s
		var fv: Array = []
		var fs: Array = []
		for i in range(40):
			fv.append(f.randi_range(3, 9))
			fs.append(str(f.state))
		rec["range_3_9"] = fv
		rec["range_3_9_state"] = fs

		# --- randi_range(1, 97) ---
		var g := RandomNumberGenerator.new()
		g.seed = s
		var gv: Array = []
		var gs: Array = []
		for i in range(40):
			gv.append(g.randi_range(1, 97))
			gs.append(str(g.state))
		rec["range_1_97"] = gv
		rec["range_1_97_state"] = gs

		# --- degenerate ranges: from == to must consume NO draw ---
		var c := RandomNumberGenerator.new()
		c.seed = s
		var cs: Array = []
		for i in range(5):
			c.randi_range(1, 1)
			cs.append(str(c.state))
		rec["range_1_1_state"] = cs

		var z := RandomNumberGenerator.new()
		z.seed = s
		var zs: Array = []
		for i in range(5):
			z.randi_range(0, 0)
			zs.append(str(z.state))
		rec["range_0_0_state"] = zs

		# --- reversed bounds ---
		var r := RandomNumberGenerator.new()
		r.seed = s
		var rv: Array = []
		var rs: Array = []
		for i in range(20):
			rv.append(r.randi_range(10, 1))
			rs.append(str(r.state))
		rec["range_reversed"] = rv
		rec["range_reversed_state"] = rs

		# --- state save / restore round trip ---
		var q := RandomNumberGenerator.new()
		q.seed = s
		for i in range(7):
			q.randi()
		var saved := q.state
		var after_saved: Array = []
		for i in range(5):
			after_saved.append(q.randi())
		var q2 := RandomNumberGenerator.new()
		q2.seed = 999
		q2.state = saved
		var after_restore: Array = []
		for i in range(5):
			after_restore.append(q2.randi())
		rec["save_restore_saved_state"] = str(saved)
		rec["save_restore_continued"] = after_saved
		rec["save_restore_restored"] = after_restore

		out[str(s)] = rec

	var file := FileAccess.open("res://web/tests/fixtures/godot_rng_fixtures.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(out))
	file.close()
	print("WROTE web/tests/fixtures/godot_rng_fixtures.json for ", SEEDS.size(), " seeds")
	quit()
