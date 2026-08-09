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

# COUNT THE SIGN GLYPHS, not `.gl`. `.gl` used to hold the lambda-slot hollows and so ran to hundreds;
# those were removed on 08-08 (a bound name is a sign and renders as its scrawl), leaving `.gl` at
# single digits and this check red for the wrong reason. `.scrawl` is what a rendered row is made of,
# so it is the honest proxy for "the rows rendered".
n_gl=$( { grep -o 'class="scrawl' "$DOM" || true; } | wc -l)
n_bit=$( { grep -o 'class="bit"' "$DOM" || true; } | wc -l)
n_box=$( { grep -o '▩' "$DOM" || true; } | wc -l)
n_frag=$( { grep -oE 'class="frag"[^>]*>[^<]*<span class="lbl">[^<]*</span></div>' "$DOM" || true; } | wc -l)  # label-only = unrendered
echo "  rendered scrawl spans: $n_gl   bit spans: $n_bit"
echo "  ▩ unrenderable signs in DOM: $n_box"
echo "  label-only (unrendered) frags: $n_frag"
[ "$n_gl" -gt 100 ] || { echo "❌ suspiciously few rendered glyph spans — rows likely didn't render"; fail=1; }
[ "$n_box" -eq 0 ]  || { echo "❌ ▩ present — a sign has no glyph/scrawl"; fail=1; }
[ "$n_frag" -eq 0 ] || { echo "❌ some .frag widgets rendered label-only (JS didn't fill them)"; fail=1; }

# THE BOOK HAS NO ARABIC NUMERALS — checked here and not in verify.sh's static gates, because it is
# a fact about what the renderer PRODUCED. See scripts/audit-numerals.js for why it is worth a gate.
node scripts/audit-numerals.js "$DOM" | sed 's/^/  /' || fail=1

echo
echo "  post-JS DOM  -> $DOM"
echo "  rendered text-> $TXT   (what a reader sees; grep it to spot-check any section)"
[ "$fail" -eq 0 ] && echo "✓ RENDER OK" || { echo "✗ RENDER BROKEN"; exit 1; }
