#!/usr/bin/env bash
# blind-read.sh — run the incremental blind read.  See plans/BLIND_REVIEW_MECHANISM.md.
#
# Feeds the book to a reader ONE ENTRY PER TURN, in a single accumulating session, rooted in an
# empty directory so the reader cannot see the repo, its path, its memory or its git history.
# A subagent CANNOT do this: its environment names the working directory and carries the project's
# instructions and memory into context.  Only a separate session in a neutral directory is blind.
#
#   scripts/blind-read.sh                 read the whole book from piece 1
#   scripts/blind-read.sh 65              resume from piece 65 using the recorded session
#   scripts/blind-read.sh 65 89           pieces 65..89
#
# Output: $OUT/NNN.json per piece, progress.txt, RESUME.txt.  Reports are the `result` field.
# One reader, in sequence.  NEVER fan out — parallel readers each start from nothing, which throws
# away the accumulated reading that is the entire point.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${BLIND_READ_OUT:-${TMPDIR:-/tmp}/blind-read}"
NEUTRAL="${BLIND_READ_DIR:-${TMPDIR:-/tmp}/blind-read-cwd}"
mkdir -p "$OUT" "$NEUTRAL"

TOTAL=$(node scripts/cold-read.js --list | tail -1 | awk '{print $1}')
FROM="${1:-1}"
TO="${2:-$TOTAL}"

# No tools at all: a reader that can search WILL identify the project, and then it is not blind.
# This is belt and braces — the prompt forbids it too, and the reader is asked to stop if it
# recognizes the document.  Check the reports for that admission on the way back.
DIS="Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,Task,Agent,NotebookEdit,TodoWrite"

SID=""
[ "$FROM" -gt 1 ] && [ -f "$OUT/RESUME.txt" ] && SID=$(sed -n 's/^session_id=//p' "$OUT/RESUME.txt")
if [ "$FROM" -gt 1 ] && [ -z "$SID" ]; then
  echo "no session to resume in $OUT/RESUME.txt — start from 1, or the reader has no memory of the book" >&2
  exit 1
fi

echo "blind read: pieces $FROM..$TO of $TOTAL -> $OUT   (cwd $NEUTRAL)"
for n in $(seq "$FROM" "$TO"); do
  nnn=$(printf '%03d' "$n")
  node scripts/cold-read.js --piece "$n" > "$OUT/piece-$nnn.txt"
  # Retry once, then STOP. Never skip. A lost report costs one data point; a skipped PIECE puts a
  # hole in the reader's accumulated context, and every report after it is then a reading of a book
  # with an entry missing — so it reports confusion that isn't real, and those false findings get
  # "fixed" in prose that was fine. Halting is recoverable: resume from the piece named below.
  # (The original set -e halted too, which was right; what was wrong is that it did so silently.)
  for try in 1 2; do
    if [ -z "$SID" ]; then
      ( cd "$NEUTRAL" && claude -p --output-format json --disallowed-tools "$DIS" ) \
        < "$OUT/piece-$nnn.txt" > "$OUT/$nnn.json" 2>&1 || true
    else
      ( cd "$NEUTRAL" && claude -p --output-format json --resume "$SID" --disallowed-tools "$DIS" ) \
        < "$OUT/piece-$nnn.txt" > "$OUT/$nnn.json" 2>&1 || true
    fi
    grep -q '"result": *"API Error' "$OUT/$nnn.json" || break
    echo "  piece $nnn errored, retry $try"
    if [ "$try" = 2 ]; then
      echo "STOPPED at piece $nnn — failed twice. Do NOT skip it." >&2
      echo "  resume with:  scripts/blind-read.sh $n" >&2
      exit 1
    fi
  done
  NEW=$(python3 -c "import json,sys;print(json.load(open('$OUT/$nnn.json')).get('session_id',''))" 2>/dev/null || true)
  if [ -n "$NEW" ]; then
    SID="$NEW"
    printf 'session_id=%s\nnext_piece=%s\n' "$SID" "$((n + 1))" > "$OUT/RESUME.txt"
  fi
  echo "$nnn" >> "$OUT/progress.txt"
  echo "  piece $nnn done"
done
echo FINISHED >> "$OUT/progress.txt"
echo "done — reports in $OUT/NNN.json (the 'result' field)"
