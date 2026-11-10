#!/usr/bin/env python3
"""Unit tests for the pxl preflight validator.

The preflight check exists to catch generated-code failures BEFORE they cost
a build + model-repair round trip. That only works if the validator itself is
correct, so it gets its own tests.

Run: python3 ai/test_preflight.py
"""

import importlib.util
import sys
from pathlib import Path

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location("pxl_gen", HERE / "pxl_gen.py")
pxl_gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pxl_gen)


# (label, source, should_be_flagged)
CASES = [
    ("sql-style comment",
     'use("pico8")\n-- a sql comment\nsprite("a",{w:8,h:8},`..`)', True),

    ("multi-character pal key",
     'use("pico8")\npal({ KK: "#1b1630" })\nsprite("a",{w:8,h:8},`..`)', True),

    ("undefined key in grid",
     'use("pico8")\nsprite("a",{w:8,h:8},`zz`)', True),

    ("undefined quoted colour key",
     'use("pico8")\nsprite("a",{w:8,h:8},rect(0,0,4,4,"z"))', True),

    ("pico8 key k is not built in",
     'use("pico8")\nsprite("a",{w:8,h:8},rect(0,0,4,4,"k"))', True),

    ("ramps needs 2+ characters",
     'use("pico8")\nramps("k")\nsprite("a",{w:8,h:8},`..`)', True),

    ("shades needs 2+ characters",
     'use("pico8")\nshades("k")\nsprite("a",{w:8,h:8},`..`)', True),

    ("sprite without canvas size",
     'use("pico8")\nsprite("a", `..`)', True),

    ("filled blob silhouette",
     'use("pico8")\nsprite("a",{w:16,h:16},`\n'
     '  1111111111111111\n  1111111111111111\n  1111111111111111\n'
     '  1111111111111111\n  1111111111111111\n  1111111111111111\n'
     '  1111111111111111\n  1111111111111111`)', True),

    ("asset name is not a colour key",
     'use("pico8")\npal({ K: "#1b1630", S: "#c2c3c7" })\n'
     'sprite("a",{w:16,h:16,outline:"K"},\n'
     '`\n  ...KK...\n  ..KSSK..\n  ...KK...`)', False),

    ("valid pico8 file",
     'use("pico8")\nsprite("a",{w:16,h:16},\n'
     '`\n  ...aa...\n  ..abba..\n  ...aa...`)', False),

    ("valid file with declared palette",
     'use("pico8")\npal({ K: "#1b1630", S: "#c2c3c7" })\n'
     'sprite("a",{w:16,h:16,outline:"K"},\n'
     '`\n  ...KK...\n  ..KSSK..\n  ...KK...`)', False),

    ("empty file", "", True),
]


def main() -> int:
    failures = 0
    for label, code, should_flag in CASES:
        problems = pxl_gen.preflight(code)
        flagged = len(problems) > 0
        if flagged != should_flag:
            failures += 1
            print(f"FAIL {label}: expected flagged={should_flag}, got {flagged}")
            for p in problems:
                print(f"       {p}")
        else:
            print(f"ok   {label} ({len(problems)} issue(s))")

    print()
    if failures:
        print(f"PREFLIGHT TESTS FAILED: {failures}/{len(CASES)}")
        return 1
    print(f"PREFLIGHT TESTS PASSED: {len(CASES)}/{len(CASES)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
