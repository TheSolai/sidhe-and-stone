extends SceneTree
## Probe: the theme's palette constants resolve and the theme builds.
##
## The constant names are COL_C, COL_D, COL_P and so on - NOT single letters.
## An earlier version of this probe asked for StoneTheme.C, which is not a
## member, and failed to parse. It is kept as a cheap guard that the palette
## constants and the theme builder stay reachable from a bare script.

func _init() -> void:
	print("const from class: ", StoneTheme.COL_C)
	print("const from class: ", StoneTheme.COL_D)
	print("const from class: ", StoneTheme.COL_P)
	print("theme build: ", StoneTheme.build() != null)
	print("crisp font: ", StoneTheme.crisp_font() != null)
	quit()
