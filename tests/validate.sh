#!/usr/bin/env bash
# The standing validation workflow for SIDHE & STONE.
#
# One command that runs everything worth running before a change is trusted.
# Each step is cheap except the captures, and the captures are the only ones
# that need a real display.
#
#   ./tests/validate.sh          # logic only (fast, safe in CI)
#   ./tests/validate.sh --visual # also capture frames (needs a display)
#
# Exit code is non-zero if any step fails.

set -uo pipefail
cd "$(dirname "$0")/.."

GODOT="${GODOT:-/opt/homebrew/bin/godot}"
VISUAL=0
[ "${1:-}" = "--visual" ] && VISUAL=1

FAILURES=0
step() { printf "\n\033[1m=== %s ===\033[0m\n" "$1"; }
fail() { printf "\033[31m  FAILED: %s\033[0m\n" "$1"; FAILURES=$((FAILURES + 1)); }

# --------------------------------------------------------------- logic checks

step "UI smoke test (the game actually runs)"
SMOKE_OUT=$("$GODOT" --headless --path . --script res://tests/ui_smoke.gd 2>&1)
echo "$SMOKE_OUT" | grep -E "checks,|SMOKE TEST|FAIL:" || true
if echo "$SMOKE_OUT" | grep -q "SMOKE TEST PASSED"; then
	echo "  ok"
else
	fail "UI smoke test"
	echo "$SMOKE_OUT" | tail -20
fi

step "Economy baseline (365 days, SimCore autopilot)"
SIM_OUT=$("$GODOT" --headless --path . --script res://sim/run_sim.gd -- --days=365 2>&1)
echo "$SIM_OUT" | grep -E "VERDICT|operating income|reel:" || true
if echo "$SIM_OUT" | grep -q "VERDICT: healthy"; then
	echo "  ok"
else
	fail "economy baseline"
	echo "$SIM_OUT" | tail -20
fi

step "Player-path balance + milestone ladder (180 days, GameState)"
PATH_OUT=$("$GODOT" --headless --path . --script res://sim/run_player_balance.gd -- --days=180 2>&1)
echo "$PATH_OUT" | sed -n '/milestone ladder/,$p' || true
if echo "$PATH_OUT" | grep -q "ECONOMY VERDICT: healthy"; then
	echo "  economy ok"
else
	fail "player-path economy"
fi
if echo "$PATH_OUT" | grep -q "LADDER VERDICT: healthy"; then
	echo "  ladder ok"
else
	fail "milestone ladder scaling"
fi

# ------------------------------------------------------------- visual checks

if [ "$VISUAL" = "1" ]; then
	OUT="${OUT_DIR:-/tmp/gsk_validate}"
	rm -rf "$OUT"; mkdir -p "$OUT"

	step "UI capture (every tab + modals)"
	# caffeinate keeps the display awake. Without it the screen sleeps
	# mid-capture, the viewport freezes, and every frame comes out
	# IDENTICAL - while still saving without error. The capture harness
	# detects that now, but there is no reason to let it happen.
	UI_LOG="$OUT/ui.log"
	caffeinate -dimsu "$GODOT" --path . --script res://tests/ui_capture.gd -- --out="$OUT" 2>&1 \
		| tee "$UI_LOG" | grep -E "capture\]|VERDICT|WARNING" || true
	if [ ! -f "$OUT/09_odds.png" ]; then
		fail "UI capture produced no frames"
	elif grep -q "CAPTURE VERDICT: FROZEN" "$UI_LOG"; then
		# A frozen capture is a FAILED capture. It saves nine valid PNGs
		# that are all the same picture, and every one of them reports
		# err=0 - so without this check, a dead screen passes as a green run.
		fail "UI capture froze (identical consecutive frames)"
	else
		echo "  ok"
	fi

	step "Reel capture (the stagger, asserted on glyphs)"
	REEL_OUT="${OUT_DIR:-/tmp/gsk_validate}_reel"; rm -rf "$REEL_OUT"; mkdir -p "$REEL_OUT"
	REEL_LOG="$REEL_OUT/reel.log"
	caffeinate -dimsu "$GODOT" --path . --script res://tests/reel_spin_capture.gd -- --out="$REEL_OUT" 2>&1 \
		| tee "$REEL_LOG" | grep -E "reel\]" || true
	# The reel must land on three DIFFERENT symbols, and the windows must
	# stop in sequence rather than in lockstep. This is asserted on GLYPHS,
	# not on pixels: a vision model describes a crop unreliably, but a glyph
	# string is exact.
	SETTLED=$(grep -E "settled glyphs:" "$REEL_LOG" | tail -1 | sed 's/.*settled glyphs: //')
	STAGGER=$(grep -E "staggered frame glyphs:" "$REEL_LOG" | tail -1 | sed 's/.*staggered frame glyphs: //')
	if [ -n "$SETTLED" ]; then
		# three symbols, and all three different
		A=$(echo "$SETTLED" | cut -d'|' -f1)
		B=$(echo "$SETTLED" | cut -d'|' -f2)
		C=$(echo "$SETTLED" | cut -d'|' -f3)
		if [ "$A" != "$B" ] && [ "$B" != "$C" ] && [ "$A" != "$C" ]; then
			echo "  settled on three different symbols: $SETTLED"
		else
			fail "the reel settled on a repeated symbol: $SETTLED"
		fi
		if [ -n "$STAGGER" ] && [ "$STAGGER" != "$SETTLED" ]; then
			echo "  ok"
		else
			fail "the reel did not stagger (staggered == settled)"
		fi
	else
		fail "the reel capture produced no glyph output"
	fi
fi

# --------------------------------------------------------------------- verdict

printf "\n"
if [ "$FAILURES" -eq 0 ]; then
	printf "\033[32mVALIDATION PASSED\033[0m\n"
	exit 0
fi
printf "\033[31mVALIDATION FAILED (%d step(s))\033[0m\n" "$FAILURES"
exit 1
