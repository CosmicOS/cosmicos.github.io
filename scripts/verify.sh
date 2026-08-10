#!/usr/bin/env bash
# One command to answer "is the listener lesson still good?" — runs the three gates in order
# and stops loudly at the first failure. Run before considering any prose/renderer/data change done.
#
#   1. prose-check    — every coined token appears at/after the pass that coins it (no premature marks)
#   2. audit-coins    — show-before-coin: a sign is shown (fragment/.sg) before its word is coined
#   3. audit-signs    — show-before-point: the mark itself. audit-coins governs the WORD and takes a
#                       prose `.sg` as proof the sign was shown, so the FIRST inline glyph is checked
#                       by nothing. This requires a figure showing the sign where the prose first
#                       points at it — the §207 hole, found by a reader in 2026-08-01.
#   3. audit-readback — show-after-coin: every coined word is re-shown after minting (fragment/.sg/.readback)
#   4. audit-watch    — the change of watch: a taking-up record at every handoff, chaining hand to hand
#   5. audit-glyphs   — no invented glyph coins; no hand-typed sign in prose (only her own notation)
#   6. audit-values   — a "gives" row shows sender-side evaluation: the set is closed & each justified
#   7. inventory-marks — every span class that puts a mark on the page is declared & within its shapes
#   8. audit-hands    — every hand-drawn row declares why it is not a wire quote; every wire claim is anchored
#      audit-drawn    — and every sign a row DRAWS is one that statement actually sent (no invented or
#      audit-msg      — and every .msg block declares what it is (wire | fragment | hers) and IS it
#                       doubled marks; omission is fine, invention is not) — caught §221 printing a stem twice
#   9. audit-provenance — every wire quote sits where its pass sits in the message (a statement can be real
#                         yet quoted at the wrong time; caught §511 and §591, both real yet upstream)
#  10. audit-assets   — every image (inline or referenced) decodes and validates; no broken material ships
#  11. build         — build-frags verifies every data-code is a real transmitted statement, then jekyll build
#  12. render-check   — renders the story (/) through real headless Chrome; fails on JS errors / unrendered signs
#
#  (plus STEP 0, added 07-24: build-frags runs FIRST too, so the audits at 2-3 resolve data-codes against a
#   fresh table rather than a stale one — see the comment at that step.)
#
# Usage:  scripts/verify.sh
# (render-check needs Chrome/Chromium; it rebuilds _site itself, so step 11's build is the fast, loud pre-check.)
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m── %s ──\033[0m\n' "$1"; }

# STEP 0 — regenerate the wire lookup table BEFORE the audits that read it.
# audit-coins and audit-readback resolve a `data-code` through _includes/wire_quotes.json, which
# build-frags writes — but build-frags only ran at step 11. So the first verify after adding a NEW
# data-code read a stale table, could not find the new statement, and reported a show-before-coin
# violation that did not exist (hit 07-24 on §544). A gate that cries wolf gets prose "fixed" to
# satisfy it, which is worse than no gate. Cheap and idempotent, so just run it first.
step "0/15  prose -> arc, then build-frags (refresh the wire table the audits resolve against)"
# The diary's SOURCE is _prose/*.html (the keeper's words) + _prose/*.blocks.json (the exhibits).
# _includes/listener/*.html is GENERATED from those and must not be hand-edited; regenerate first so
# every gate below reads what the prose actually says.  The splice asserts an exact round-trip, which
# is what stops an edit from silently dropping a wire quote (it happened on 07-30 and all 12 gates
# passed the corrupted files).
node scripts/prose.js build
node scripts/build-frags.js > /dev/null

step "1/15  prose-check (coined tokens introduced before use)"
node scripts/prose-check.js
node scripts/check-american.js
node scripts/check-limbs.js
# A sign must be a BRAILLE codepoint, never a private-use one — a private-use character has no
# identity outside this font, so it vanishes the moment anyone copies a line off the page. The
# `_data/` artifacts are hand-copied from the generator, which still emits private-use, so this
# catches a copy that skipped scripts/braille-codepoints.js.
node scripts/braille-codepoints.js --check
# and a hand row may not write a count as bare bits after §267 — the notation moved and the hand rows
# do not move with it. Three survived the 08-07 change and were found one at a time, by eye.
node scripts/audit-bare-bits.js

step "2/15  audit-coins (show-before-coin: sign shown before its word is coined)"
node scripts/audit-coins.js

step "3/15  audit-signs (show-before-point: a figure shows the sign where the prose first points)"
node scripts/audit-signs.js

step "4/15  audit-before-after (a notation may not change by assertion — show one line both ways)"
node scripts/audit-before-after.js

step "5/15  audit-readback (show-after-coin: every coined word re-shown after minting)"
node scripts/audit-readback.js

step "6/15  audit-watch (a taking-up record at every handoff, succession unbroken)"
node scripts/audit-watch.js

step "7/15  audit-glyphs (no fabricated marks: coins are words, signs are .sg)"
node scripts/audit-glyphs.js
node scripts/audit-notation.js

step "8/15  audit-values (every "gives" row is one the keeper can settle herself)"
node scripts/audit-values.js

step "9/15 inventory-marks (every mark class declared; closed shape inventories)"
node scripts/inventory-marks.js --check

step "10/15 audit-hands (every hand-drawn row declares why it is not a wire quote)"
node scripts/audit-hands.js
node scripts/audit-drawn.js
node scripts/audit-msg.js

step "11/15 audit-provenance (every wire quote sits where its pass sits in the message)"
node scripts/audit-provenance.js

step "12/15 audit-assets (embedded images decode + validate — no broken material reaches a reader)"
node scripts/audit-assets.js

step "13/15  build (verify wire quotes + jekyll build)"
scripts/build.sh

step "14/15  render-check (real post-JS DOM through headless Chrome)"
scripts/render-check.sh

printf '\n\033[1;32m✓ all gates passed\033[0m\n'

# The gates check the DATA. Green says nothing about the prose, and green is when the register slips.
# Answer this by READING what you wrote, never by remembering how you wrote it. Recall says yes every time.
printf '\033[1;33mDID YOU USE THE WRITING CHECKLIST?\033[0m (plans/README.md, top — go read the lines)\n'
