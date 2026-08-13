#!/usr/bin/env bash
# ══ THE COPY FROM ~/cvs/cosmicos, DONE BY A SCRIPT ══════════════════════════════════════════════
#
# This repo carries artifacts built in another one. The copy was manual — a `cp` per file, from a
# table in plans/BUILDING.md — and that document named partial-or-forgotten copies as the main
# foot-gun and asked for this script. Two of the three things it warned about had already happened
# by the time it was written:
#
#   - js/lib_cosmicos.js was copied from build/TINY while the table said build/standard, so every
#     later check compared it against a file it was never made from and reported drift that was not
#     drift. What it IS is one revision behind: 14 bytes, `v == "@" ||` missing from
#     cosmicos_Parse.looksLikeMutation. See the note by that line below.
#   - _data/msg.json was listed as "byte-identical" to its source while step 2b transformed it, so
#     nobody re-derived it for years, and when the transform broke nothing noticed.
#
# CHECKING IS THE DEFAULT. With no arguments this copies nothing and reports the state of every
# mapping; `--apply` performs the copies. A missing source is a LOUD failure and never a silent skip
# — a sync that quietly does nothing is the failure this script exists to prevent.
#
#   scripts/sync-from-cosmicos.sh              compare only, change nothing
#   scripts/sync-from-cosmicos.sh --apply      do the copies, then remap and verify
#   COSMICOS=/path/to/cosmicos scripts/sync-from-cosmicos.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

COSMICOS="${COSMICOS:-$HOME/cvs/cosmicos}"
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
[ -d "$COSMICOS" ] || { echo "no cosmicos checkout at $COSMICOS (set COSMICOS=)" >&2; exit 2; }

red(){ printf '\033[1;31m%s\033[0m\n' "$*"; }; grn(){ printf '\033[1;32m%s\033[0m\n' "$*"; }
ylw(){ printf '\033[1;33m%s\033[0m\n' "$*"; }

# src-relative-to-$COSMICOS | dest-in-this-repo | how
#
# `remap` means the file is NOT a copy: braille-codepoints.js rewrites the generator's private-use
# codepoints on the way in, so dest is expected to DIFFER from src and the real test is the
# reproduction check at the foot of this script.
#
# lib_cosmicos.js comes from build/tiny, which is what was actually shipped; build/standard/bin holds
# a different webpack entry (./build/standard/... vs ./build/tiny/...) and is the wrong file.
MAP="
build/standard/src/assem2.json|_data/msg.json|remap
build/standard/src/primer.json|_data/primer.json|copy
build/standard/wrapped.txt|_includes/wrapped.txt|copy
build/standard/entropy.txt|_includes/entropy.txt|copy
build/tiny/bin/lib_cosmicos.js|js/lib_cosmicos.js|copy
msg/glyph.txt|_includes/glyph.txt|copy
msg/glyph_head.txt|_includes/glyph_head.txt|copy
"

# THESE ARE BUILT, NOT CHECKED IN, over in the other repo — `make glyph` writes msg/glyph*.txt and
# `make font` writes the fontcustom files. They are absent from a fresh checkout, so a missing one
# means "run make there", not "the sync is broken".
NEEDS_MAKE="msg/glyph.txt msg/glyph_head.txt src/font/app/assets/fonts"

missing=0 stale=0 ok=0
echo
printf '  %-46s %s\n' "FROM $COSMICOS" "STATE"
printf '  %-46s %s\n' "$(printf '%.0s-' {1..46})" "-----"

while IFS='|' read -r src dst how; do
  [ -n "$src" ] || continue
  abs="$COSMICOS/$src"
  if [ ! -f "$abs" ]; then
    note=""
    for n in $NEEDS_MAKE; do [ "$src" = "$n" ] && note=" (build it: make glyph / make font)"; done
    printf '  %-46s ' "$src"; red "SOURCE ABSENT$note"
    missing=$((missing+1)); continue
  fi
  if [ "$how" = remap ]; then
    printf '  %-46s ' "$src"; ylw "remapped into $dst — see the check below"
    [ "$APPLY" = 1 ] && cp "$abs" "$dst"
    continue
  fi
  if cmp -s "$abs" "$dst"; then
    printf '  %-46s ' "$src"; grn "up to date"; ok=$((ok+1))
  else
    printf '  %-46s ' "$src"; ylw "DIFFERS from $dst  ($(stat -c%s "$abs") vs $(stat -c%s "$dst") bytes)"
    stale=$((stale+1))
    [ "$APPLY" = 1 ] && { cp "$abs" "$dst"; echo "        copied"; }
  fi
done <<< "$MAP"

# THE FONT is renamed on the way in and then re-cut, so it is not a plain `cp` and is not automated
# here. It is listed so a sync cannot forget it exists.
echo
if [ -d "$COSMICOS/src/font/app/assets/fonts" ]; then
  ylw "  fonts: src/font/app/assets/fonts/fontcustom_* -> fonts/cosmic_spider.* (rename), then"
  echo  "         scripts/remap-font-to-braille.py — BY HAND, and bump ?v= in css/main.css"
else
  echo  "  fonts: source absent (make font) — nothing to do"
fi

if [ "$APPLY" = 1 ]; then
  echo; echo "  remapping private-use codepoints to braille…"
  node scripts/braille-codepoints.js
fi

# THE ONE CHECK THAT TESTS THE MAP RATHER THAN ITS SYMPTOMS. Gate 1 of verify.sh only asks whether
# anything is still private-use, which stayed green for months while the converter was sending the
# wire's punctuation out of the braille block entirely. This asks whether the shipped file is what
# the converter produces from its source, which is the whole claim the sync makes.
echo
if [ -f "$COSMICOS/build/standard/src/assem2.json" ]; then
  if node -e '
      const {convert} = require("./scripts/braille-codepoints.js"), fs = require("fs");
      const src = process.argv[1];
      process.exit(convert(fs.readFileSync(src,"utf8")).text === fs.readFileSync("_data/msg.json","utf8") ? 0 : 1);
    ' "$COSMICOS/build/standard/src/assem2.json"; then
    grn "  ✓ _data/msg.json is exactly what the converter makes from assem2.json"
  else
    red "  ✗ _data/msg.json is NOT reproducible from assem2.json"
    echo  "    Either the copy is stale (re-run with --apply) or the map in"
    echo  "    scripts/braille-codepoints.js has drifted — read the three groups at the top of it."
    stale=$((stale+1))
  fi
fi

echo
if [ "$missing" -gt 0 ]; then red "  $missing source(s) absent — nothing was copied for those"; fi
if [ "$APPLY" = 1 ]; then
  echo "  copied what differed. Now run: scripts/verify.sh"
elif [ "$stale" -gt 0 ]; then
  ylw "  $stale file(s) out of date — re-run with --apply to copy them"
else
  grn "  everything that could be checked is up to date"
fi
[ "$missing" -eq 0 ] && [ "$stale" -eq 0 ]
