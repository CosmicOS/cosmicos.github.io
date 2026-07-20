#!/usr/bin/env bash
# The SINGLE source of the real post-JS DOM: build, serve _site, and render listener.html
# through headless Chrome (running the real js/listener.js), then write the post-JS DOM.
#
# Both consumers read what THIS produces, so there is exactly one renderer (js/listener.js)
# and one capture of it:
#   - scripts/render-check.sh  — QA gate (asserts no JS errors / no unrendered signs)
#   - scripts/read.js          — the flat reviewer read (formats this DOM; renders nothing)
#
# Usage:  scripts/render-dom.sh [OUTFILE]     # default /tmp/rendered.html
# Writes the post-JS DOM to OUTFILE and Chrome's stderr to OUTFILE-with-.err.
# All diagnostics go to stderr; nothing but progress is printed.
set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser)"
[ -n "$CHROME" ] || { echo "no chrome/chromium found" >&2; exit 2; }

DOM="${1:-/tmp/rendered.html}"; ERR="${DOM%.html}.err"

echo "building…" >&2; scripts/build.sh >/dev/null 2>&1

PORT="${PORT:-8391}"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory _site >/tmp/rc-httpd.log 2>&1 &
SRV=$!; trap 'kill $SRV 2>/dev/null || true' EXIT
sleep 1

echo "rendering http://127.0.0.1:$PORT/listener.html through $(basename "$CHROME")…" >&2
timeout 90 "$CHROME" --headless=new --no-sandbox --disable-gpu --enable-logging=stderr --v=1 \
  --virtual-time-budget=8000 --dump-dom "http://127.0.0.1:$PORT/listener.html" >"$DOM" 2>"$ERR"
