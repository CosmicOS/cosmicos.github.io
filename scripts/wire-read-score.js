#!/usr/bin/env node
/* wire-read-score.js — check a wire-reconstruction read against the wire itself.
 *
 * The read (scripts/wire-read-prompt.txt) asks a blind reader to reconstruct the message's
 * four-symbol sequence from what the book shows. Its answers are strings, and `_data/msg.json`
 * settles them, so nothing here is a judgement: a run either is a statement of the message or it
 * is not.
 *
 * WHAT IT REPORTS
 *   · COVERAGE — how many of the message's statements the reader has put back, against how many the
 *     book ever puts on the page (the honest denominator; the rest were never shown to anybody).
 *   · MISSES — runs long enough to be a claim that match NO statement. These are the valuable half:
 *     a confident wrong reconstruction means the notation let the reader build something the message
 *     never sent. A short run is usually a fragment mid-sentence, so there is a length floor.
 *
 *   · ROTATIONS — right marks, wrong offset. This is a WRONG ANSWER, not a category of its own. A
 *     rotated run is a different string from the statement, and the book's whole claim is that a
 *     keeper can find the head: that is what §193's five-tone seam is for. It stops being wrong only
 *     if a later piece produces the same statement correctly oriented, which is reported as FIXED —
 *     so the pair of numbers says where the book leaves a reader misoriented and where it repairs it.
 *
 * Usage:  node scripts/wire-read-score.js [dir]        (default <scratchpad>/wire-read)
 */
'use strict';
const fs = require('fs'), path = require('path');

const TONE = { '0': '˩', '1': '˨', '2': '˦', '3': '˥' };
const toneOf = code => [...code].map(c => TONE[c] || '?').join('');
const MIN = 12;
const MARK = { '▪': '˨', '▫': '˩', '⟅': '˦', '⟆': '˥' };   // ▪=1 ▫=0 ⟅=2 ⟆=3, then coded as tones
const marksToTones = r => [...r].map(c => MARK[c]).join('');                       // shorter than this is a fragment, not a claim

const dir = process.argv[2] || path.join(
  process.env.TMPDIR || '/tmp', 'claude-1000', '-home-paulfitz-cvs-cosmicos-github-io',
  '563ed569-0d23-4c0f-b88e-397a4e0b6a4d', 'scratchpad', 'wire-read');
const root = path.resolve(__dirname, '..');

const msg = JSON.parse(fs.readFileSync(path.join(root, '_data/msg.json'), 'utf8'));
const wire = new Map();               // tone string -> stanza number
msg.forEach((s, i) => { if (s.code) wire.set(toneOf(s.code), i); });

/* the denominator: what the book actually puts on the page. A statement the book never shows is not
   something the reader failed to recover. */
const idx = JSON.parse(fs.readFileSync(path.join(root, 'plans/listener_index.json'), 'utf8'));
const shown = new Set();
for (const r of idx.rows) for (const c of (r.codes || [])) shown.add(toneOf(c));

const files = fs.readdirSync(dir).filter(f => /^\d+\.json$/.test(f)).sort();
const got = new Map();                // tone string -> first piece that produced it
const misses = [];
const rotations = [];

for (const f of files) {
  let result = '';
  try { result = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).result || ''; } catch { continue; }
  if (typeof result !== 'string' || result.startsWith('API Error')) continue;
  const piece = f.replace('.json', '');
  for (const line of result.split('\n')) {
    /* every contiguous run, and the whole line's tones joined — the reader groups a long run with
       spaces or backticks for legibility, and either form should count. */
    /* TWO ALPHABETS, ONE MESSAGE. The reader answers in tones early on and in the book's own marks
       later, because that is what the page gives it — and they are the same four symbols:
       ▪=1 ▫=0 ⟅=2 ⟆=3. Reading only tones scored the whole late book at nothing. */
    const runs = (line.match(/[˩˨˦˥]+/g) || [])
      .concat((line.match(/[▪▫⟅⟆]+/g) || []).map(marksToTones));
    if (!runs.length) continue;
    const cands = new Set(runs.filter(Boolean));
    if (runs.length > 1) cands.add(runs.join(''));
    let hitThisLine = false;
    for (const c of cands) if (wire.has(c)) { hitThisLine = true; if (!got.has(c)) got.set(c, piece); }
    if (!hitThisLine) {
      const longest = [...cands].sort((a, b) => b.length - a.length)[0];
      if (!longest || longest.length < MIN) continue;
      /* A ROTATION IS NOT A WRONG ANSWER. The message comes round, and until §193 nothing on the
         page marks where a round begins — so a reader copying the stream honestly enters it
         mid-way. Check the run against each statement doubled; if it sits inside, the reader has
         the right marks at the wrong offset, which is the book's own subject and not a miss. */
      let rot = null;
      for (const [t, n] of wire) {
        if (t.length >= MIN && (t + t + t).includes(longest.slice(0, Math.min(longest.length, t.length)))) { rot = n; break; }
      }
      if (rot !== null) rotations.push({ piece, stanza: rot, tone: [...wire].find(([, n]) => n === rot)[0] });
      else misses.push({ piece, run: longest, line: line.trim().slice(0, 90) });
    }
  }
}

const shownGot = [...got.keys()].filter(t => shown.has(t));
const pct = n => shown.size ? (100 * n / shown.size).toFixed(1) + '%' : '—';

console.log(`reports read            ${files.length}`);
console.log(`statements the book shows anywhere   ${shown.size}`);
console.log(`  of those, reconstructed            ${shownGot.length}   (${pct(shownGot.length)})`);
const extra = [...got.keys()].filter(t => !shown.has(t));
if (extra.length) console.log(`  reconstructed but never shown on the page: ${extra.length} (inferred by the reader)`);
/* a rotation is wrong when given; it is FIXED if the same statement is later produced upright. */
/* `>=`, not `>`: the reader often prints the stream as it came AND the round set upright in the
   same report, which is the correction happening immediately rather than later. */
const fixed = rotations.filter(r => got.has(r.tone) && got.get(r.tone) >= r.piece);
const stillWrong = rotations.filter(r => !(got.has(r.tone) && got.get(r.tone) >= r.piece));
console.log(`\nWRONG ANSWERS  ${rotations.length + misses.length}`);
console.log(`  wrong offset (rotation)   ${rotations.length}   of which fixed later: ${fixed.length}`);
for (const r of stillWrong.slice(0, 10)) console.log(`      piece ${r.piece}  stanza ${r.stanza} — still rotated`);
for (const r of fixed.slice(0, 10)) console.log(`      piece ${r.piece}  stanza ${r.stanza} — fixed at piece ${got.get(r.tone)}`);
console.log(`  matches no statement      ${misses.length}`);
for (const m of misses.slice(0, 15)) console.log(`    piece ${m.piece}  ${m.run.slice(0, 46)}${m.run.length > 46 ? '…' : ''}`);
if (misses.length > 15) console.log(`    … and ${misses.length - 15} more`);
