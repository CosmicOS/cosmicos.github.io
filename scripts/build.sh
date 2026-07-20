#!/usr/bin/env bash
# Rebuild the lesson (listener) in one command.
#   1. build-frags over ALL includes: verify every quote is a real transmitted statement + rebuild
#      the shared _data/wire_quotes.json. Exits non-zero (and stops the build) on any bad data-code.
#   2. jekyll build -> _site.
# Usage:  scripts/build.sh          # build
# For a flat reviewer read of the page, run:  node scripts/read.js --out FILE
# (it captures the real post-JS DOM via scripts/render-dom.sh and formats it).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "1/2  build-frags (verify quotes + rebuild wire_quotes.json)…"
node scripts/build-frags.js

echo "2/2  jekyll build…"
jekyll build --quiet

echo "done -> _site/"
