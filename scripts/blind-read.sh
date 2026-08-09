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

# ★ FREEZE THE BOOK FIRST, THEN READ THE FREEZE.  One build, one render, all 101 pieces cut at once
# (`cold-read.js --freeze`).  Two things follow, and both matter:
#   · the working tree is FREE for the ~90 minutes the reader takes.  Cutting each piece as its turn
#     came meant the reader was reading the live tree, so editing an entry still queued changed the
#     book under it mid-read and the run had to be thrown away and restarted.
#   · it is no longer slow.  The old way rebuilt the whole site per piece to select one chunk.
# The freeze is kept, so a resume continues the SAME manuscript rather than re-cutting whatever the
# tree says now — which is the point of it.  Delete $OUT/frozen to take a fresh snapshot.
OUT_FROZEN="$OUT/frozen"
if [ -f "$OUT_FROZEN/COUNT" ]; then
  echo "reading the frozen copy in $OUT_FROZEN — the working tree is free"
else
  node scripts/cold-read.js --freeze "$OUT_FROZEN"
  echo "frozen. edit away."
fi
TOTAL=$(cat "$OUT_FROZEN/COUNT")
FROM="${1:-1}"
TO="${2:-$TOTAL}"

# No tools at all: a reader that can search WILL identify the project, and then it is not blind.
# This is belt and braces — the prompt forbids it too, and the reader is asked to stop if it
# recognizes the document.  Check the reports for that admission on the way back.
DIS="Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,Task,Agent,NotebookEdit,TodoWrite"


# ★ NEVER RESUME BEHIND THE READER.  RESUME.txt is the only thing that knows how far it got, and it
# moves while you are reading it — a number copied out of it ten minutes ago is stale.  Resuming at a
# piece the reader has ALREADY had resends entries it has read: it recognizes the replay and reports
# on a reread instead of on first contact ("third resend in a row — the last new piece is still
# 246"), which is the one thing this whole rig exists to capture, and the real report for that piece
# is overwritten in $OUT.  Cost five entries on 08-08, recovered only because the reader's own
# session transcript still held them.  Default to RESUME.txt; refuse to go backwards without --again.
NEXT=$(sed -n 's/^next_piece=//p' "$OUT/RESUME.txt" 2>/dev/null || true)
if [ -z "${1:-}" ] && [ -n "$NEXT" ]; then
  FROM="$NEXT"
  echo "resuming where the reader actually is: piece $FROM"
elif [ -n "$NEXT" ] && [ "$FROM" -lt "$NEXT" ] && [ "${3:-}" != "--again" ]; then
  echo "REFUSING: the reader has already read through piece $((NEXT - 1)); starting at $FROM would resend" >&2
  echo "  resume with:  scripts/blind-read.sh $NEXT       (or omit the number entirely)" >&2
  echo "  to resend anyway:  scripts/blind-read.sh $FROM $TO --again" >&2
  exit 1
fi
# ★ READ THE SESSION ID *AFTER* RESOLVING FROM, NOT BEFORE. This used to sit above the block that
# resolves FROM out of RESUME.txt, so with no arguments FROM was still 1, the read was skipped, and
# the script then refused its own resume: "no session to resume — start from 1, or the reader has no
# memory of the book". The documented way to continue a run (omit the number) could never work.
SID=""
[ "$FROM" -gt 1 ] && [ -f "$OUT/RESUME.txt" ] && SID=$(sed -n 's/^session_id=//p' "$OUT/RESUME.txt")

if [ "$FROM" -gt 1 ] && [ -z "$SID" ]; then
  echo "no session to resume in $OUT/RESUME.txt — start from 1, or the reader has no memory of the book" >&2
  exit 1
fi

echo "blind read: pieces $FROM..$TO of $TOTAL -> $OUT   (cwd $NEUTRAL)"
for n in $(seq "$FROM" "$TO"); do
  nnn=$(printf '%03d' "$n")
  cp "$OUT_FROZEN/piece-$nnn.txt" "$OUT/piece-$nnn.txt"
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
