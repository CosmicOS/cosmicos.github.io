#!/usr/bin/env bash
# Rebuild the lesson (listener) in one command.
#   1. build-pics: regenerate the gate pictures from the WIRE (make-image data) so the committed
#      assets/listener/*.png always equal what the message actually transmits — never a stale blob.
#   2. build-frags over ALL includes: verify every quote is a real transmitted statement + rebuild
#      the shared _includes/wire_quotes.json. Exits non-zero (and stops the build) on any bad data-code.
#   3. build-runs: rebuild _includes/wire_runs.json — which stretch of the message each entry sits in,
#      and the marks for the statements in it the entry never shows ("the whole run" panels).
#      AFTER build-frags, because it reads the data-code attributes that step verifies.
#   4. build-index: refresh plans/listener_index.json (the cross-reference — kept fresh with the diary
#      so a lookup never lies; gitignored + Jekyll-excluded, so it costs the site nothing).
#   5. jekyll build -> _site.
# Usage:  scripts/build.sh          # build
# For a flat reviewer read of the page, run:  node scripts/read.js --out FILE
# (it captures the real post-JS DOM via scripts/render-dom.sh and formats it).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "1/5  build-pics (regenerate gate pictures from the wire)…"
node scripts/build-pics.js

echo "2/5  build-frags (verify quotes + rebuild wire_quotes.json)…"
node scripts/build-frags.js

echo "3/5  build-runs (rebuild wire_runs.json — each entry's stretch of the message)…"
node scripts/build-runs.js

echo "4/5  build-index (refresh the cross-reference in plans/listener_index.json)…"
node scripts/build-index.js

echo "5/5  jekyll build…"
jekyll build --quiet

echo "done -> _site/"
