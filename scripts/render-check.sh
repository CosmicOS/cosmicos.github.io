#!/usr/bin/env bash
# QA gate: capture the real post-JS DOM (scripts/render-dom.sh runs the real js/listener.js
# through headless Chrome) and FAIL LOUDLY on any JS console error or unrenderable sign.
# This catches browser-side breakage no static check can: listener.js has thrown and blanked
# every message row while the page still LOOKED populated (prose is static HTML). Run after
# every revision to the renderer, the data, or the arc files:  scripts/render-check.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DOM="${1:-/tmp/rendered.html}"; ERR="${DOM%.html}.err"
scripts/render-dom.sh "$DOM"

# strip tags -> readable rendered text (what the reader actually sees, post-JS).
# A fixed-width inline-block span is a table CELL; without a gap the strip butts cells together
# ("say your kinda mark of its kind"). Turn each cell boundary into spaces before dropping tags.
# (scripts/read.js is the real reviewer read and does this properly; this is the grep-aid version.)
TXT="${DOM%.html}.txt"
sed -e 's/<span[^>]*display: *inline-block[^>]*>/   /g' \
    -e 's/<[^>]*>//g' -e 's/&#x\([0-9a-f]*\);/[glyph]/gi' "$DOM" | sed '/^[[:space:]]*$/d' > "$TXT"

fail=0
echo
if grep -qiE 'CONSOLE.*(Uncaught|Error|is not|Cannot read|not defined)' "$ERR"; then
  echo "❌ JS CONSOLE ERRORS (the rendered page is broken):"
  grep -iE 'CONSOLE.*(Uncaught|Error|is not|Cannot read|not defined)' "$ERR" | sed 's/^/    /'
  fail=1
else
  echo "✓ no JS console errors"
fi

# THE SPAN COUNTS ARE REPORTED, NEVER ASSERTED ON. This used to demand `scrawl spans > 100` against a
# real count of 2420, so 96% of the book could go dark and the gate still said RENDER OK — measured,
# not supposed. audit-blanks.js asks the total question instead (is any container the renderer fills
# still empty?), which needs no threshold and cannot be cleared by the surviving rows.
n_gl=$( { grep -o 'class="scrawl' "$DOM" || true; } | wc -l)
n_bit=$( { grep -o 'class="bit"' "$DOM" || true; } | wc -l)
n_box=$( { grep -o '▩' "$DOM" || true; } | wc -l)
echo "  rendered scrawl spans: $n_gl   bit spans: $n_bit"
echo "  ▩ unrenderable signs in DOM: $n_box"
[ "$n_box" -eq 0 ]  || { echo "❌ ▩ present — a sign has no glyph/scrawl"; fail=1; }

node scripts/audit-blanks.js "$DOM" || fail=1

# THE BOOK HAS NO ARABIC NUMERALS — checked here and not in verify.sh's static gates, because it is
# a fact about what the renderer PRODUCED. See scripts/audit-numerals.js for why it is worth a gate.
node scripts/audit-numerals.js "$DOM" | sed 's/^/  /' || fail=1

echo
echo "  post-JS DOM  -> $DOM"
echo "  rendered text-> $TXT   (what a reader sees; grep it to spot-check any section)"
[ "$fail" -eq 0 ] && echo "✓ RENDER OK" || { echo "✗ RENDER BROKEN"; exit 1; }
