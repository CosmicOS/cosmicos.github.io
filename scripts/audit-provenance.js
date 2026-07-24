#!/usr/bin/env node
/* audit-provenance.js — a wire quote must sit where its pass sits in the message.
 *
 * THE BUG THIS CATCHES (see plans/README.md, P2c, and the confusion ledger):
 *   A `data-code` proves a statement was TRANSMITTED. It does NOT prove it was transmitted THEN.
 *   §591 quoted the wary-era logical `and` (statement #481–484) in a pass about the message building
 *   its own gate parts (#1531–1534) — identical truth tables, so the page read perfectly and was wrong.
 *   §511 quoted `function?` (#679–680) in a pass about `instanceof`/kinds (#1209–1234) — 500 statements
 *   upstream. Both were found by asking, of every wire quote: does its statement index sit in this
 *   pass's stretch? This gate asks that automatically.
 *
 * THE INVARIANT:
 *   The diary is read in pass order, and the message is transmitted in statement order, so the two
 *   run together: pass P's wire quotes come from P's own stretch of the wire. Concretely — order the
 *   passes by number, take each pass's MEDIAN quoted statement-index, and that sequence must not drop.
 *   The median is robust to a pass legitimately reaching a little forward or back within its own
 *   neighbourhood (the message interleaves threads — e.g. §511's `instanceof` demos sit a few
 *   statements past §517's first `point` row; that is a real interleave, not a leak).
 *
 * TWO LEGITIMATE NON-MONOTONE CASES, both handled:
 *   1. READ-BACKS re-show a deliberately old coined sign. A `.readback` block is EXEMPT — its rows are
 *      not judged for provenance (that is the whole point of a read-back).
 *   2. LOCAL INTERLEAVE — one pass reaching a few statements past the next. Absorbed by TOL below,
 *      which is sized from the data: the tightest real dip is 5 and the widest real within-pass spread
 *      is 74, while the two known bugs sat 545 and 1016 upstream. TOL=150 clears the real cases by 2×
 *      and flags the bugs by 3×+. It is a floor on "how far upstream is clearly wrong", not a knob to
 *      tune per-exception (a gate that needs three exceptions on day one is worse than none).
 *
 * Usage:  node scripts/audit-provenance.js
 */
'use strict';
const fs = require('fs'), path = require('path');

const TOL = 150;   // statements a quote may sit below its pass's place before it is called upstream

// code -> first index in the transmitted order (1-based, over code+gate statements) ------------------
const msg = require(path.resolve(__dirname, '../_data/msg.json'));
const byCode = new Map();
let k = 0;
for (const s of msg) if ((s.role === 'code' || s.role === 'gate') && s.code) { k++; if (!byCode.has(s.code)) byCode.set(s.code, k); }
const codesByLen = [...byCode.keys()].sort((a, b) => b.length - a.length);   // longest-first, for greedy split

// A data-of/data-code value anchors one OR MORE statements: a whitespace-separated list, and a single
// token may itself be several statement codes run together (a hand row re-reading a short opening run).
// Decompose every value into the statement indices it names — never silently drop a multi-anchor row.
function indicesOf(value) {
  const out = [];
  for (const tok of value.split(/\s+/).filter(Boolean)) {
    let r = tok;
    while (r.length) {
      const hit = codesByLen.find(c => r.startsWith(c));
      if (!hit) { out.push(null); break; }        // an unrecognised remainder -> flagged as not-in-wire
      out.push(byCode.get(hit)); r = r.slice(hit.length);
    }
  }
  return out;
}

// gather each pass's asserting wire quotes (read-back blocks stripped) --------------------------------
const dir = path.resolve(__dirname, '../_includes/listener');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
const passes = [];                       // {file, pass, rows:[{idx, code, line}]}
const unknown = [];                      // codes not found in the wire (build-frags is the real check; noted here)

for (const file of files) {
  const lines = fs.readFileSync(path.join(file === path.basename(file) ? path.join(dir, file) : file), 'utf8').split('\n');
  let cur = null, rbDepth = 0;           // rbDepth>0 == inside a .readback block (exempt)
  lines.forEach((ln, i) => {
    const stamp = ln.match(/class="stamp">Pass (\d+)/);
    if (stamp) { cur = { file, pass: +stamp[1], rows: [] }; passes.push(cur); }
    if (/class="readback"/.test(ln)) rbDepth += 1;      // enter read-back; count divs to find its end
    if (rbDepth > 0) {
      rbDepth += (ln.match(/<div\b/g) || []).length - (ln.match(/<\/div>/g) || []).length
                 - (/class="readback"/.test(ln) ? 1 : 0);   // the +1 above already opened it
      if (rbDepth < 0) rbDepth = 0;
      return;                                            // skip rows inside a read-back
    }
    const re = /data-(?:code|of)="([0-9 ]+)"/g; let m;
    while ((m = re.exec(ln))) {
      for (const idx of indicesOf(m[1])) {
        if (idx == null) { unknown.push({ file, line: i + 1, code: m[1] }); continue; }
        if (cur) cur.rows.push({ idx, code: m[1], line: i + 1 });
      }
    }
  });
}

const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const ordered = passes.filter(p => p.rows.length).sort((a, b) => a.pass - b.pass);

// walk passes in pass order; a running high-water median is where the message "has reached" -----------
const problems = [];
let runMax = -Infinity;
for (const p of ordered) {
  const med = median(p.rows.map(r => r.idx));
  if (med < runMax - TOL) {
    problems.push({ kind: 'pass', pass: p.pass, file: p.file,
      msg: `pass ${p.pass} (${p.file}) quotes around statement #${med}, but the diary has already reached #${runMax} — the whole pass sits ${runMax - med} statements upstream` });
  }
  const anchor = Math.max(med, runMax - TOL);           // where this pass belongs
  for (const r of p.rows) if (r.idx < anchor - TOL) {
    problems.push({ kind: 'row', pass: p.pass, file: p.file, line: r.line,
      msg: `pass ${p.pass} (${p.file}:${r.line}) quotes statement #${r.idx}, ${anchor - r.idx} upstream of where this pass sits (~#${anchor}) — a wire quote that reads right but was sent long before` });
  }
  runMax = Math.max(runMax, med);
}

if (problems.length) {
  console.error(`✗ provenance: ${problems.length} wire quote(s) sit upstream of their pass ` +
                `(a statement can be real yet quoted at the wrong time):`);
  for (const p of problems) console.error('    ' + p.msg);
  process.exit(1);
}
console.log(`✓ provenance: ${ordered.length} passes read in step with the wire; ` +
            `no quote sits more than ${TOL} statements upstream of its pass` +
            (unknown.length ? ` (${unknown.length} code(s) not in the wire — build-frags is the gate for those)` : ''));
