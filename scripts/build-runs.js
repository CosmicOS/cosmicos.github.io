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
 * Inlined with the page rather than fetched: 204kB, 27kB over the wire beside a page already at
 * 796kB, which is cheaper than the failure modes a fetch brings (offline, file://, a QA harness
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

/* EVERY ENTRY WITH A RUN GETS ONE — including the fifteen that quote their whole stretch, the
   founder's first pages among them. Those were skipped until 08-12, on the reasoning that the panel
   would open on what the reader is already looking at. The reasoning was about the panel and not
   about the reader: from the outside, an entry with no control and an entry whose control you have
   not spotted are the same entry, and the founder's opening — five entries with nothing to press —
   is where a reader learns whether there is anything to press at all. It also withholds a fact those
   entries alone can give: the stretch IS the page, nothing between two of her sayings went unshown.
   Every row in those panels comes up banded, and that band is the answer. */
const runs = {};
for (const r of WIRE.runsByEntry(WIRE.scanDiary().rows))
  runs[r.entry] = { lo: r.lo, hi: r.hi, shown: r.shown };

/* The spine, trimmed to what the panels can actually draw. All 1,730 statements would be half again
   as large for statements no panel reaches; the union of the runs IS the panels' data, so the file
   and the feature cannot drift apart. */
const spine = {};
let missing = 0;
for (const r of Object.values(runs))
  for (let i = r.lo; i <= r.hi; i++) {
    if (i in spine) continue;
    if (!WIRE.parses[i]) { missing++; continue; }
    /* `s` is where the statement sits in message.html — `#line-<s>`. Carried per statement rather
       than computed on the page, because the gap between a statement's place and its stanza there
       is not a constant: see `stanzas` in scripts/wire.js. */
    spine[i] = { c: WIRE.codes[i] || null, p: WIRE.parses[i], s: WIRE.stanzas[i] };
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
