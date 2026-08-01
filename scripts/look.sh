#!/usr/bin/env bash
# LOOK AT ONE PART OF THE PAGE. Screenshot a named element, alone, at any width.
#
#   scripts/look.sh p207               an entry, by its anchor id, at desk width
#   scripts/look.sh p193 390           the same at phone width
#   scripts/look.sh '.sheets'          any CSS selector
#   SCRAWL=numbers scripts/look.sh p207   draw every sign as the number the message sends for it
#
# HOW IT WORKS, and why it was rebuilt 08-01. The first version rendered the WHOLE page tall enough
# to hold the target, then cropped by measured offset. That dies on anything deep: §501 sits about
# 35,000px down and Chrome cannot rasterize a canvas that tall, so the shot came back empty and
# `convert` failed with "no images defined". Now the page is copied with every SIBLING of the
# target (and of each of its ancestors) removed, so the element renders alone with all its CSS
# intact, on a short page that needs no crop. Nothing is measured, nothing is guessed.
#
# Reads the built _site, so run after a build if the source changed.
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:?usage: look.sh <anchor|selector> [width]}"
WIDTH="${2:-760}"

case "$TARGET" in .*|\#*|\[*) SEL="$TARGET" ;; *) SEL="#$TARGET" ;; esac
SAFE="$(echo "$TARGET" | tr -c 'A-Za-z0-9_.-' '_')"
OUT="/tmp/look-${SAFE}-${WIDTH}.png"

CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser)"
[ -n "$CHROME" ] || { echo "no chrome/chromium found" >&2; exit 2; }

PORT="${PORT:-8399}"
if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/listener.html" 2>/dev/null; then
  python3 -m http.server "$PORT" --bind 127.0.0.1 --directory _site >/tmp/look-httpd.log 2>&1 &
  SRV=$!; trap 'kill $SRV 2>/dev/null || true; rm -f _site/.look-iso.html' EXIT; sleep 1
else
  trap 'rm -f _site/.look-iso.html' EXIT
fi

NUMS=""; [ "${SCRAWL:-}" = "numbers" ] && NUMS="nums"
node scripts/look-isolate.js _site/listener.html _site/.look-iso.html "$SEL" $NUMS

# one pass to learn the isolated element's height, one to shoot it at that height
GEOM=$(timeout 60 "$CHROME" --headless=new --no-sandbox --disable-gpu \
  --window-size="$WIDTH",900 --virtual-time-budget=9000 \
  --dump-dom "http://127.0.0.1:$PORT/.look-iso.html" 2>/dev/null \
  | grep -o 'LOOK [0-9]* [0-9]*' | head -1 || true)
[ -n "$GEOM" ] || { echo "could not find $SEL on the page" >&2; exit 1; }
H=$(echo "$GEOM" | cut -d' ' -f2); VW=$(echo "$GEOM" | cut -d' ' -f3)

timeout 180 "$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size="$WIDTH",$(( H + 40 )) --virtual-time-budget=18000 \
  --run-all-compositor-stages-before-draw \
  --screenshot="$OUT" "http://127.0.0.1:$PORT/.look-iso.html" >/dev/null 2>&1

# NOTE ON WIDTH. Headless reports a layout viewport that need not equal --window-size (485 for a
# 390 request on this machine). The measured clientWidth is printed; trust it, not what you typed.
echo "$OUT   (${SEL} alone, ${VW}px layout viewport, height ${H})"
