#!/usr/bin/env node
/* THE HAND-ROW AUDIT — a row drawn in the keeper's hand must declare why it is not a wire quote.
 *
 * WHY THIS EXISTS.  `build-frags` verifies `.row[data-code]` against `_data/msg.json`, so a wire quote
 * cannot depict a statement the message never sent.  It says nothing at all about `<div class="row hand">`,
 * which is hand-authored HTML — and that gap is exactly where §549's fabricated `▮` sat: a row that LOOKED
 * like a quote, was gated by nothing, and showed a mark the message never transmitted.  78 such rows existed
 * on 07-23 (founder 21 · builder 27 · final 28 · cold 2), covering the whole back half of the arc, where the
 * wire quotes run thinnest.  A hand row is legitimate — she tallies, she runs a strip by hand, she feeds a
 * part she built and writes down what it answered — but "legitimate" has to be CLAIMED, not assumed.
 *
 * THE DECLARATION.  Every `.row hand` carries `data-hand="<why>"`, one of four:
 *
 *   hers       her own working: something she tallied, ran, fed or drew.  There is no statement behind it,
 *              and none is claimed.  MUST NOT carry data-of.
 *   undecoded  she has copied a piece as it arrived and cannot yet read it (the founder's cups).
 *   notation   a statement she HAS read, re-written in her own marks (the founder's ● tallies).
 *   abridged   a statement she shortens, folds or schematises — the mass she will not copy, four statements
 *              drawn as one row, a class the size of a wall reduced to what she took from it.
 *
 * The last three claim the wire, so each MUST carry `data-of="<code> …"`: one or more real transmitted
 * statement codes, verified against msg.json exactly as `data-code` is.  That is the part that holds.  When
 * `intro partN` is removed from the message (Paul, 07-23: "those lines I plan to remove eventually"), every
 * row that leaned on it fails LOUDLY instead of silently outliving the thing it depicts.
 *
 * WHAT data-of DOES NOT DO.  It anchors a row to a statement; it does not prove the drawing is faithful to it.
 * Fidelity is still a reading job.  What the gate buys is that the anchor exists, is real, and stays real.
 *
 * THE §549 SHAPE.  A `hers` row built ONLY from transmitted signs and the wire's own atoms — `.gl sg`, `.bit`,
 * `.cup` — is indistinguishable from a quote on the page, whatever the source says.  That is the shape `▮`
 * wore.  So a `hers` row must carry at least one mark or word that is visibly HERS: a tally, a slot, her
 * reading-place, a word token, a `.step`, or a plain label.  If it has none, it is claiming the wire, and must
 * either become a `.row[data-code]` or declare what it abridges.
 *
 * Exit 1 on any violation.  Usage: node scripts/audit-hands.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, '_includes/listener');
const msg = require(path.join(ROOT, '_data/msg.json'));

const WIRE = msg.filter(s => (s.role === 'code' || s.role === 'gate') && s.code).map(s => s.code).join('');
const REAL = new Set(msg.filter(s => (s.role === 'code' || s.role === 'gate') && s.code).map(s => s.code));

const REASONS = {
  hers:      { of: false, what: 'her own working — nothing transmitted behind it, and none claimed' },
  undecoded: { of: true,  what: 'a piece copied as it arrived, not yet read' },
  notation:  { of: true,  what: 'a statement she has read, re-written in her own marks' },
  abridged:  { of: true,  what: 'a statement shortened, folded or schematised' },
};

/* marks and words that are visibly the keeper's, so a row carrying one cannot be mistaken for a quote.
   `.gl sg` / `.bit` / `.cup` are deliberately ABSENT: those are the message's signs and the wire's own
   atoms, and a row made only of them reads as the wire itself. */
const HER_MARK = /class="(tk|tk z|gl w|step|head|coin|say|lbl|does|keeps|beat)"|class="gl"[ >]|style="/;
/* `does` added 08-01: Lio's ledger column of her OWN WORDS for what an engine-order does
   ("fetch the first given"), declared free-text in MARK_INVENTORY and never a mark. Those rows
   used to qualify through `style="` — inline widths that were removed as part of killing
   hand-set alignment. A row carrying her sentences cannot read as a wire quote; the styling
   attribute was never the thing that made it hers. */

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html'));
const flags = [];
const tally = {};

for (const f of files) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const lineOf = i => src.slice(0, i).split('\n').length;
  /* `class="row hand …"` — match ANY trailing classes. A gate keyed to the exact string silently stops
     seeing a row the moment someone adds a modifier, which is how the wrapper-span blind spot (P5) works.
     Widened 07-24 when `.row hand ledger` was introduced. */
  for (const m of src.matchAll(/<div class="row hand[^"]*"([^>]*)>([\s\S]*?)<\/div>\s*(?=<div|<\/div|$)/g)) {
    const attrs = m[1], body = m[2], at = `${f}:${lineOf(m.index)}`;
    const why = (attrs.match(/data-hand="([^"]*)"/) || [])[1];
    const of = (attrs.match(/data-of="([^"]*)"/) || [])[1];

    if (!why) {
      flags.push(`${at}  a hand row with no data-hand — say why it is not a .row[data-code]: ` +
                 Object.keys(REASONS).join(' | '));
      continue;
    }
    const spec = REASONS[why];
    if (!spec) { flags.push(`${at}  data-hand="${why}" is not one of ${Object.keys(REASONS).join(' | ')}`); continue; }
    tally[why] = (tally[why] || 0) + 1;

    if (spec.of && !of)
      flags.push(`${at}  data-hand="${why}" claims the wire (${spec.what}) but names no statement ` +
                 `— add data-of="<code>" so the row breaks loudly if that statement ever leaves the message`);
    if (!spec.of && of)
      flags.push(`${at}  data-hand="hers" is her own working, so it must not carry data-of ` +
                 `— if there IS a statement behind it, say which kind of drawing it is instead`);

    for (const code of (of || '').split(/\s+/).filter(Boolean)) {
      if (!REAL.has(code))
        flags.push(`${at}  data-of code is not a real transmitted statement: ${code.slice(0, 40)}…` +
                   (WIRE.includes(code) ? ' (it occurs in the wire but is not one whole statement)' : ''));
    }

    if (why === 'hers' && !HER_MARK.test(body))
      flags.push(`${at}  a "hers" row built only from the message's signs and the wire's own atoms ` +
                 `— on the page that IS a quote (this is the shape §549's fabricated ▮ wore). ` +
                 `Make it a .row[data-code], or declare what it draws from.`);
  }
}

if (flags.length) {
  console.log(`✗ ${flags.length} undeclared hand row(s) — a drawing that claims nothing is a drawing nothing checks:`);
  flags.forEach(x => console.log('    ' + x));
  process.exit(1);
}
const n = Object.values(tally).reduce((a, b) => a + b, 0);
console.log(`✓ hands: ${n} hand rows, all declared (` +
  Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(' · ') + `); every wire claim anchored to a real statement`);
