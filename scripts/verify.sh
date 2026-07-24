#!/usr/bin/env bash
# One command to answer "is the listener lesson still good?" — runs the three gates in order
# and stops loudly at the first failure. Run before considering any prose/renderer/data change done.
#
#   1. prose-check    — every coined token appears at/after the pass that coins it (no premature marks)
#   2. audit-coins    — show-before-coin: a sign is shown (fragment/.sg) before its word is coined
#   3. audit-readback — show-after-coin: every coined word is re-shown after minting (fragment/.sg/.readback)
#   4. audit-watch    — the change of watch: a taking-up record at every handoff, chaining hand to hand
#   5. audit-glyphs   — no invented glyph coins; no hand-typed sign in prose (only her own notation)
#   6. audit-values   — a "gives" row shows sender-side evaluation: the set is closed & each justified
#   7. inventory-marks — every span class that puts a mark on the page is declared & within its shapes
#   8. audit-hands    — every hand-drawn row declares why it is not a wire quote; every wire claim is anchored
#   9. audit-assets   — every image (inline or referenced) decodes and validates; no broken material ships
#  10. build         — build-frags verifies every data-code is a real transmitted statement, then jekyll build
#  11. render-check   — renders listener.html through real headless Chrome; fails on JS errors / unrendered signs
#
# Usage:  scripts/verify.sh
# (render-check needs Chrome/Chromium; it rebuilds _site itself, so step 10's build is the fast, loud pre-check.)
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m── %s ──\033[0m\n' "$1"; }

step "1/11  prose-check (coined tokens introduced before use)"
node scripts/prose-check.js

step "2/11  audit-coins (show-before-coin: sign shown before its word is coined)"
node scripts/audit-coins.js

step "3/11  audit-readback (show-after-coin: every coined word re-shown after minting)"
node scripts/audit-readback.js

step "4/11  audit-watch (a taking-up record at every handoff, succession unbroken)"
node scripts/audit-watch.js

step "5/11  audit-glyphs (no fabricated marks: coins are words, signs are .sg)"
node scripts/audit-glyphs.js

step "6/11  audit-values (every "gives" row is one the keeper can settle herself)"
node scripts/audit-values.js

step "7/11 inventory-marks (every mark class declared; closed shape inventories)"
node scripts/inventory-marks.js --check

step "8/11 audit-hands (every hand-drawn row declares why it is not a wire quote)"
node scripts/audit-hands.js

step "9/11 audit-assets (embedded images decode + validate — no broken material reaches a reader)"
node scripts/audit-assets.js

step "10/11  build (verify wire quotes + jekyll build)"
scripts/build.sh

step "11/11  render-check (real post-JS DOM through headless Chrome)"
scripts/render-check.sh

printf '\n\033[1;32m✓ all gates passed\033[0m\n'
