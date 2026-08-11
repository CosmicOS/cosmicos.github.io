#!/usr/bin/env bash
# LOOK AT ONE PART OF THE PAGE. A thin wrapper on scripts/look.js, which is where the work and the
# reasoning live. Kept as a shell entry point because it is the name in the habit and in the notes.
#
#   scripts/look.sh p207                     an entry, by its anchor id, at desk width
#   scripts/look.sh p193 390                 the same at phone width — a REAL 390 now
#   scripts/look.sh '.sheets'                any CSS selector
#   scripts/look.sh --page 390 --scroll=3000 the whole page, at a width, in a scrolled state
#   scripts/look.sh --page --click='.tb-menu summary'   …after opening something
#   scripts/look.sh p239 --click=A --click=B            …--click may repeat, in order
#   scripts/look.sh p193 --hover='.row'                 …a hover-only control
#   SCRAWL=numbers scripts/look.sh p207      every sign as the number the message sends for it
#
# IT USED TO DRIVE CHROME DIRECTLY, and that harness lied about anything involving time or scroll:
# `--virtual-time-budget` never delivers IntersectionObserver callbacks, and `--window-size` under
# ~500px is silently clamped, so a phone check was really a 485px check and a picture of anything
# scroll-driven showed a state no reader ever sees. See the note at the top of look.js.
#
# Reads the built _site, so run scripts/build.sh after changing the source.
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/look.js "$@"
