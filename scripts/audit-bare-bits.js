#!/usr/bin/env node
/* A BARE BIT-RUN IS A PAYLOAD, NEVER A COUNT.
 *
 * From §267 a count goes down in her own reckoning marks, barred (`.num.barred`, one mark to a base-64
 * digit).  Bits still appear — but only ever INSIDE a cup, as the payload of an atom she is writing out
 * whole (`▫⟅▪▫▫▪⟆`, an "as it comes" rung), or as the place-value figure in §267's own table.
 *
 * A bare bit-run standing loose in a hand row after §267 is therefore a row left behind by a notation
 * change: it says "count" in a hand nobody uses any more, and it collides with the payload reading.
 * Three of these survived the 08-07 change and were found by eye, one at a time — §288's raw rung wrote
 * the count zero as `▫` where the wire has `▫⟅▫⟆`, and its worked reduction wrote `▪▫` and `▪▫▫` for
 * two and four.  Generated rows cannot drift; only hand-written ones can, so only hand rows are checked.
 *
 * EXEMPT, because the bare run is the point rather than a leftover:
 *   .binstack   §267's own table — column one IS the message's place-value figure
 *   .sheets     §193 — the founder cutting tones into cups, two hundred passes before any of this
 *   passes before §267, where she has no mark for a count and writes it as it came
 *
 *   node scripts/audit-bare-bits.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, '_includes/listener');
const FROM = 267;                              // the pass that gives her a mark for a count

let bad = 0, checked = 0;

/* A `.bit` span is legitimate in exactly two positions, and a linear scan of the row's spans settles
   which — no cup-nesting to unpick:
     TAG      immediately before a `cup o`      the ▫ or ▪ that says what sort of atom this is
     PAYLOAD  between a `cup o` and a `cup c`   the number inside the cup
   Anything else is a bare run standing where a count should be, in a hand nobody writes any more. */
function looseBits(html) {
  const spans = [...html.matchAll(/<span class="(bit|cup o|cup c|num[^"]*)"[^>]*>([^<]*)</g)]
                  .map(m => ({ cls: m[1].split(' ')[0], txt: m[2] }));
  const out = [];
  for (let i = 0; i < spans.length; i++) {
    if (spans[i].cls !== 'bit') continue;
    const prev = spans[i - 1], next = spans[i + 1];
    if (next && next.cls === 'cup o') continue;                    // a tag
    if (prev && prev.cls === 'cup o' && next && next.cls === 'cup c') continue;  // a payload
    /* A LONE bit is not a count. Senn's strip (§501) is cells, one mark to a cell, and Lio's trace
       column is the same — both draw single `.bit` spans in a row on purpose. A count is two or more
       bits in ONE span, which is the thing that used to be written where a reckoning mark goes. */
    if (spans[i].txt.length < 2) continue;
    out.push(spans[i].txt);
  }
  return out;
}

for (const file of fs.readdirSync(DIR).filter(f => f.endsWith('.html'))) {
  const src = fs.readFileSync(path.join(DIR, file), 'utf8');
  const lines = src.split('\n');
  // ranges to skip: the two exhibits whose whole subject is a raw figure, and §267 itself
  const skip = [];
  for (const m of src.matchAll(/<div class="(binstack|sheets)"[\s\S]*?\n\s*<\/div>/g))
    skip.push([src.slice(0, m.index).split('\n').length, src.slice(0, m.index + m[0].length).split('\n').length]);
  let pass = 0;
  lines.forEach((ln, i) => {
    const p = ln.match(/id="p(\d+)"/); if (p) pass = +p[1];
    if (pass < FROM || pass === FROM) return;             // §267 is where the figure is the lesson
    if (skip.some(([a, b]) => i + 1 >= a && i + 1 <= b)) return;
    // `class="row hand ledger"` and friends: match the prefix, not the whole attribute. The first
    // version required the closing quote and walked past every modified hand row in the book.
    if (!/class="row hand[^"]*"|class="reduce"|class="fig"/.test(ln)) return;
    checked++;
    const loose = looseBits(ln);
    if (!loose.length) return;
    bad++;
    const lbl = (ln.match(/<span class="lbl">([^<]*)</) || [])[1] || '(no label)';
    console.log(`  ${file}:${i + 1}  §${pass}  [${lbl}]  loose: ${loose.join(', ')}`);
  });
}
console.log(bad
  ? `\n✗ ${bad} hand row(s) write a count as bare bits after §${FROM} (checked ${checked})`
  : `✓ no hand row writes a count as bare bits after §${FROM} (checked ${checked})`);
process.exit(bad ? 1 : 0);
