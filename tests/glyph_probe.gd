extends SceneTree
## Probe: which characters the default font actually has.
##
## The unsupported characters are written as CODEPOINTS rather than as
## literal glyphs, so this file never puts a character the font cannot draw
## into a string. The rule for the game is: never render a glyph outside
## the supported set. The supported set is:
##   x 00D7  MULTIPLICATION SIGN
##   x 00A3  POUND SIGN
##   x 00B7  MIDDLE DOT
##   x 2014  EM DASH
##   x 2026  HORIZONTAL ELLIPSIS

const SUPPORTED := ["×", "£", "·", "—", "…"]
## Characters the game must never render, as codepoints.
const FORBIDDEN := [0x2618, 0x2713, 0x2610, 0x2605, 0x25CF, 0x25B2, 0x25A0, 0x2192]

func _init() -> void:
	var f: Font = ThemeDB.get_default_theme().default_font
	for ch in SUPPORTED:
		print(ch, " U+", ch.unicode_at(0), " has=", f.has_char(ch.unicode_at(0)))
	print("--- must never be rendered ---")
	for cp in FORBIDDEN:
		print("U+", cp, " has=", f.has_char(cp))
	quit()
