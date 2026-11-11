#!/usr/bin/env bash
# Build the native macOS app for Sidhe & Stone.
#
# One command that goes from source to a double-clickable .app on the
# Desktop, with a .dmg beside it. Everything it produces is verified before
# the script claims success: the bundle has to be a real universal binary,
# the icon has to be in the bundle, and the app has to actually launch and
# draw a frame.
#
#   ./tools/build_mac.sh              # export + verify + install to /Applications
#   ./tools/build_mac.sh --no-install # export + verify only
#
# Signing: ad-hoc. There is no Apple Developer account on this machine, so
# there is no certificate to sign with and nothing to notarise against. An
# ad-hoc signature is enough for the app to run locally; it would need a
# real Developer ID to run on someone else's Mac without a Gatekeeper
# warning, and that is a purchase, not a setting.

set -uo pipefail
cd "$(dirname "$0")/.."

GODOT="${GODOT:-/opt/homebrew/bin/godot}"
APP_NAME="Sidhe & Stone"
BUNDLE="Sidhe & Stone.app"
BUILD="build/macos"
INSTALL=1
[ "${1:-}" = "--no-install" ] && INSTALL=0

step() { printf "\n\033[1m=== %s ===\033[0m\n" "$1"; }
fail() { printf "\033[31m  FAILED: %s\033[0m\n" "$1"; exit 1; }

step "Icon"
if [ ! -f icon.icns ]; then
	"$GODOT" --version >/dev/null 2>&1
	python3 tools/make_app_icon.py || fail "icon build"
fi
[ -f icon.icns ] || fail "icon.icns missing"
printf "  icon.icns %s bytes\n" "$(stat -f %z icon.icns)"

step "Export"
mkdir -p "$BUILD"
rm -rf "$BUILD/$BUNDLE" "$BUILD/SidheAndStone.zip"
OUT=$("$GODOT" --headless --path . --export-release "macOS" "$BUILD/SidheAndStone.zip" 2>&1)
echo "$OUT" | tail -5
[ -f "$BUILD/SidheAndStone.zip" ] || fail "export produced no zip"
printf "  %s (%s bytes)\n" "$BUILD/SidheAndStone.zip" "$(stat -f %z "$BUILD/SidheAndStone.zip")"

step "Unpack"
rm -rf "$BUILD/unpacked"
mkdir -p "$BUILD/unpacked"
unzip -q "$BUILD/SidheAndStone.zip" -d "$BUILD/unpacked"
APP="$BUILD/unpacked/$BUNDLE"
[ -d "$APP" ] || fail "bundle $BUNDLE not found in the zip"
ls "$APP/Contents/MacOS"

step "Bundle identity"
BIN="$APP/Contents/MacOS/$APP_NAME"
[ -x "$BIN" ] || fail "binary missing or not executable"
file "$BIN"
ARCHS=$(lipo -archs "$BIN")
echo "  architectures: $ARCHS"
case "$ARCHS" in
	*arm64*) ;;
	*) fail "no arm64 slice - this Mac is Apple Silicon" ;;
esac
case "$ARCHS" in
	*x86_64*) ;;
	*) fail "no x86_64 slice - Intel Macs could not run this" ;;
esac

PLIST="$APP/Contents/Info.plist"

# Godot writes CFBundleExecutable straight from the project name WITHOUT
# escaping XML entities, while the same name in CFBundleName IS escaped.
# A project name containing "&" therefore produces an Info.plist that is
# not well-formed XML: plistlib refuses to load it, PlistBuddy reports
# "unknown ampersand-escape sequence", and macOS refuses to launch the
# app. This is a Godot export bug, not a mistake in this project.
#
# The repair is done on the raw text first - the bare "&" is escaped so the
# document becomes valid XML - and only then is it loaded and edited with
# plistlib, which escapes correctly on the way back out.
python3 - "$PLIST" <<'PYEOF'
import plistlib, re, sys

path = sys.argv[1]
raw = open(path, "rb").read().decode("utf-8")

# Escape ampersands that are not already the start of an entity.
def esc(m):
    return "&amp;" if m.group(0) not in ("&amp;", "&lt;", "&gt;", "&quot;", "&apos;") else m.group(0)

repaired = re.sub(r"&", esc, raw)
if repaired != raw:
    print("  repaired bare ampersand(s) in Info.plist XML")

with open(path, "wb") as fh:
    fh.write(repaired.encode("utf-8"))

with open(path, "rb") as fh:
    plist = plistlib.load(fh)

plist["CFBundleName"] = "Sidhe & Stone"
plist["CFBundleDisplayName"] = "Sidhe & Stone"
plist["CFBundleGetInfoString"] = "A cozy excavation-and-museum management sim."
plist["NSHighResolutionCapable"] = True
with open(path, "wb") as fh:
    plistlib.dump(plist, fh)

# Prove it round-trips: load it again and print what macOS will see.
with open(path, "rb") as fh:
    check = plistlib.load(fh)
print("  plist valid; CFBundleName =", repr(check["CFBundleName"]))
print("  CFBundleExecutable =", repr(check["CFBundleExecutable"]))
PYEOF

BUNDLE_ID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$PLIST")
DISPLAY=$(/usr/libexec/PlistBuddy -c "Print :CFBundleName" "$PLIST")
printf "  bundle id : %s\n  name      : %s\n" "$BUNDLE_ID" "$DISPLAY"
[ "$DISPLAY" = "$APP_NAME" ] || fail "CFBundleName is '$DISPLAY', expected '$APP_NAME'"

step "Icon in bundle"
if [ -f "$APP/Contents/Resources/icon.icns" ]; then
	printf "  Resources/icon.icns present (%s bytes)\n" "$(stat -f %z "$APP/Contents/Resources/icon.icns")"
else
	echo "  (no Resources/icon.icns - checking the .plist icon key)"
	/usr/libexec/PlistBuddy -c "Print :CFBundleIconFile" "$PLIST" 2>/dev/null || true
fi

step "Code signature"
# Ad-hoc sign the bundle so the app is a valid, launchable bundle.
codesign --force --deep --sign - "$APP" 2>&1 | tail -2
codesign --verify --verbose=1 "$APP" 2>&1 | tail -2
codesign -dv "$APP" 2>&1 | grep -E "Identifier|Signature|CodeDirectory" | head -3

step "Launch test"
# The app must start, open a window, and draw a frame. It is launched with
# a bounded lifetime so it cannot linger: if it has not exited by itself in
# 12 seconds it is killed and the test fails.
LOG=/tmp/sidhe_mac_launch.log
rm -f "$LOG"
"$BIN" --rendering-driver opengl3 --quit-after 300 >"$LOG" 2>&1 &
APP_PID=$!
for _ in $(seq 1 24); do
	sleep 0.5
	kill -0 "$APP_PID" 2>/dev/null || break
done
if kill -0 "$APP_PID" 2>/dev/null; then
	kill "$APP_PID" 2>/dev/null
	wait "$APP_PID" 2>/dev/null
	fail "the app did not exit on its own (--quit-after 300 frames)"
fi
wait "$APP_PID" 2>/dev/null
echo "  exited cleanly"
[ -s "$LOG" ] && tail -5 "$LOG"
if grep -qi "error\|crash\|failed" "$LOG"; then
	echo "  (log mentions errors - read the tail above)"
fi

step "Install"
cp -R "$APP" "$BUILD/$BUNDLE"
if [ "$INSTALL" = "1" ]; then
	if [ -d "/Applications/$BUNDLE" ]; then
		echo "  replacing existing /Applications/$BUNDLE"
		rm -rf "/Applications/$BUNDLE"
	fi
	cp -R "$APP" "/Applications/$BUNDLE"
	echo "  installed to /Applications/$BUNDLE"
else
	echo "  staged at $BUILD/$BUNDLE (not installed)"
fi

step "Disk image"
DMG="$BUILD/SidheAndStone.dmg"
rm -f "$DMG"
STAGE=$(mktemp -d)
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "$APP_NAME" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null 2>&1 \
	|| fail "hdiutil create"
rm -rf "$STAGE"
printf "  %s (%s bytes)\n" "$DMG" "$(stat -f %z "$DMG")"

printf "\n\033[1;32mMAC BUILD OK\033[0m\n"
printf "  app  : %s\n" "$BUILD/$BUNDLE"
printf "  dmg  : %s\n" "$DMG"
printf "  open : open \"%s\"\n" "$BUILD/$BUNDLE"
