#!/usr/bin/env node
/* build-runs.js — data for "the whole run", the block that opens off an entry's head.
 *
 * An entry quotes four or five sayings out of a stretch seventy long; the rest of that stretch is
 * the drilling the keeper reads through. This writes what the page needs to draw it.
 *
 * Writes `_includes/wire_runs.json`:
 *   runs   entry id -> {lo, hi, shown[]}   the stretch, and which places the entry already draws
 *   spine  place -> {c: wire code, p: parse}   every statement inside some run, and nothing else
 *
 * The CODE as well as the parse, so a run row is an ordinary wire quote: listener.js merges the
 * spine into the same `WIRE` table the book's own `.row[data-code]` reads, and one row-stepper then
 * serves both. Without it the three code rungs (tones/cups/atoms) cannot be drawn for these rows at
 * all — the browser has no wire encoder, and the codes cost 12kB over the wire.
 *
 * Inlined with the page rather than fetched: 89kB, 14kB over the wire beside a page already at
 * 570kB, which is cheaper than the failure modes a fetch brings (offline, file://, a QA harness
 * capturing the DOM before the response lands). In `_includes/` for the same reason
 * `wire_quotes.json` is — an include is read as text, never through Jekyll's YAML parser.
 *
 * NOT in it: the author's source line. `plans/listener_index.json` carries that for working
 * purposes; on the built site it would be the answer key.
 *
 * The run derivation and its terms are `runsByEntry` in scripts/wire.js.
 *
 *   node scripts/build-runs.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const WIRE = require('./wire');

/* A RUN WITH NOTHING BETWEEN GETS NO PANEL. If an entry quotes everything in its own run — the
   founder's first pages, where she has three sayings and shows all three — the control would open on
   what the reader is already looking at. Those entries simply do not get one, which is honest: there
   is no more of the message there to show. */
const runs = {};
for (const r of WIRE.runsByEntry(WIRE.scanDiary().rows)) {
  if (r.hi - r.lo + 1 <= r.shown.length) continue;
  runs[r.entry] = { lo: r.lo, hi: r.hi, shown: r.shown };
}

/* The spine, trimmed to what the panels can actually draw. All 1,730 statements would be half again
   as large for statements no panel reaches; the union of the runs IS the panels' data, so the file
   and the feature cannot drift apart. */
const spine = {};
let missing = 0;
for (const r of Object.values(runs))
  for (let i = r.lo; i <= r.hi; i++) {
    if (i in spine) continue;
    if (!WIRE.parses[i]) { missing++; continue; }
    spine[i] = { c: WIRE.codes[i] || null, p: WIRE.parses[i] };
  }

if (missing) {
  console.error(`✗ ${missing} statement(s) inside a run have no parse in _data/msg.json — those rows would draw blank`);
  process.exitCode = 1;
}

const dest = path.join(ROOT, '_includes/wire_runs.json');
fs.writeFileSync(dest, JSON.stringify({ runs, spine }));
const shown = Object.values(runs).reduce((n, r) => n + r.shown.length, 0);
console.log(`_includes/wire_runs.json: ${Object.keys(runs).length} entries with a run to open, ` +
            `${Object.keys(spine).length} statements in them (${shown} already on the page), ` +
            `${(fs.statSync(dest).size / 1024).toFixed(0)}kB`);
