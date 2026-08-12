#!/usr/bin/env bash
# Rebuild the lesson (listener) in one command.
#   0. prose -> arc: splice _prose/<keeper>.html + <keeper>.blocks.json back into the GENERATED
#      _includes/listener/*.html.  MUST BE FIRST AND WAS MISSING UNTIL 08-12: the diary's source is
#      _prose/, so without this an edit to the story built the OLD page, silently and with every gate
#      green — you look at the site, your paragraph is not there, and nothing tells you why.
#      verify.sh has always done this as its step 0; the two now agree.
#   1. build-pics: regenerate the gate pictures from the WIRE (make-image data) so the committed
#      assets/listener/*.png always equal what the message actually transmits — never a stale blob.
#   2. build-frags over ALL includes: verify every quote is a real transmitted statement + rebuild
#      the shared _includes/wire_quotes.json. Exits non-zero (and stops the build) on any bad data-code.
#   3. build-runs: rebuild _includes/wire_runs.json — which stretch of the message each entry sits in,
#      and the marks for the statements in it the entry never shows ("the whole run" panels).
#      AFTER build-frags, because it reads the data-code attributes that step verifies.
#   4. inventory-marks: rewrite plans/MARK_INVENTORY.md and _includes/mark_cuts.json — what each mark
#      is and which pass cuts it, for the panel a reader gets on tapping one.
#   5. build-index: refresh plans/listener_index.json (the cross-reference — kept fresh with the diary
#      so a lookup never lies; gitignored + Jekyll-excluded, so it costs the site nothing).
#   6. jekyll build -> _site.
# Usage:  scripts/build.sh          # build
# For a flat reviewer read of the page, run:  node scripts/read.js --out FILE
# (it captures the real post-JS DOM via scripts/render-dom.sh and formats it).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "0/7  prose -> arc (splice _prose/ into the generated _includes/listener/*.html)…"
node scripts/prose.js build

echo "1/7  build-pics (regenerate gate pictures from the wire)…"
node scripts/build-pics.js

echo "2/7  build-frags (verify quotes + rebuild wire_quotes.json)…"
node scripts/build-frags.js

echo "3/7  build-runs (rebuild wire_runs.json — each entry's stretch of the message)…"
node scripts/build-runs.js

echo "4/7  inventory-marks (rebuild MARK_INVENTORY.md + mark_cuts.json — the tap sheet)…"
node scripts/inventory-marks.js > /dev/null

echo "5/7  build-index (refresh the cross-reference in plans/listener_index.json)…"
node scripts/build-index.js

echo "6/7  jekyll build…"
jekyll build --quiet

echo "done -> _site/"
