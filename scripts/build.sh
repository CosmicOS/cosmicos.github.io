#!/usr/bin/env bash
# Rebuild the lesson (listener) in one command.
#   1. build-pics: regenerate the gate pictures from the WIRE (make-image data) so the committed
#      assets/listener/*.png always equal what the message actually transmits — never a stale blob.
#   2. build-frags over ALL includes: verify every quote is a real transmitted statement + rebuild
#      the shared _data/wire_quotes.json. Exits non-zero (and stops the build) on any bad data-code.
#   3. jekyll build -> _site.
# Usage:  scripts/build.sh          # build
# For a flat reviewer read of the page, run:  node scripts/read.js --out FILE
# (it captures the real post-JS DOM via scripts/render-dom.sh and formats it).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "1/3  build-pics (regenerate gate pictures from the wire)…"
node scripts/build-pics.js

echo "2/3  build-frags (verify quotes + rebuild wire_quotes.json)…"
node scripts/build-frags.js

echo "3/3  jekyll build…"
jekyll build --quiet

echo "done -> _site/"
