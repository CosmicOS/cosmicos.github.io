#!/usr/bin/env bash
# Serve the site locally and rebuild it as files change.
#
#   ./go.sh [port]        (default 4000)
#
# `jekyll serve --watch` REBUILDS _site, IT DOES NOT RUN scripts/build.sh — so it sees an edit to
# _includes/listener/*.html but not one to _prose/, which is where the diary's source lives. Editing
# prose means running scripts/build.sh; this is for pushing CSS and markup around.
#
# To read the built site on a phone and leave notes on it, use scripts/notes-server.py instead.
set -euo pipefail
cd "$(dirname "$0")"

port="${1:-4000}"

# Only a server on this port — the old version ran a bare `killall ruby`. Nothing to kill is normal.
pkill -f "jekyll serve.*--port ${port}" 2>/dev/null || true

echo "serving http://127.0.0.1:${port}/  (prose edits need scripts/build.sh; ^C to stop)"
exec jekyll serve --watch --port "${port}" --baseurl ''
