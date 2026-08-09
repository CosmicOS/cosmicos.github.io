#!/usr/bin/env node
/* cold-read.js — cut the book up so a reader can be stuck the way a real one is.
 *
 * ★ THE RIG THIS FEEDS IS DOCUMENTED IN plans/BLIND_REVIEW_MECHANISM.md — read it before running a
 * review or acting on one.  The runner is scripts/blind-read.sh.  Prefer `--piece` (one entry, fed
 * to an accumulating session) over the prefix mode below; the reasons are at that flag.
 *
 * WHY THIS EXISTS.  Every blind review this project has run handed the reviewer the whole
 * manuscript, and a reviewer holding the whole manuscript CANNOT GET STUCK: they meet a mysterious
 * figure in §214, read on, find it explained in §267, and never report it.  So four rounds of
 * review found flab, tics and stacked closers, and missed every single one of the faults Paul hit
 * in twenty minutes of reading on a phone — all of which were the same fault:
 *
 *     something is used before the reader has been given it.
 *
 * A real reader's experience is linear and irreversible.  To reproduce it the reader must be unable
 * to look ahead.  This emits entries 1..N and nothing after, so the reader reaches the end of the
 * prefix in the same state of knowledge a first-time reader has at that point.
 *
 * The interesting product is the LAST entry of each prefix: run it at N, N+1, N+2 … and each run
 * reports only on its final entry, with everything after genuinely absent rather than merely
 * out of scope.
 *
 * Usage:
 *   node scripts/cold-read.js --list            number every entry in reading order
 *   node scripts/cold-read.js 7                 entries 1..7, last one marked as the one to judge
 *   node scripts/cold-read.js 7 --out /tmp/x    write it somewhere neutrally named
 *
 * Reads /tmp/rendered.html (scripts/render-check.sh), so what it emits is post-JS: the figures are
 * the ones a reader actually sees, not the source markup.
 */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const SRC = '/tmp/rendered.html';
if (!fs.existsSync(SRC)) {
  execFileSync(path.join(__dirname, 'render-check.sh'), { stdio: 'inherit' });
}

// read.js already flattens the post-JS DOM to the reader's text, with stable glyph tokens and no
// leaked source names. Reuse it rather than growing a second renderer that can drift from the page.
// --figures braille, ALWAYS. The default token mode emits `glyph0`, `glyph1` …, which a reader takes
// for broken template output rather than notation — read three (08-06) reported "unreplaced
// placeholders, not text" and then could not check the form where the sign was the point, which is
// the most valuable thing the instrument does. Braille gives each sign one distinct neutral symbol
// and leaks nothing. Do not remove this flag.
const full = execFileSync('node', [path.join(__dirname, 'read.js'), '--figures', 'braille'], {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
});

const SEP = '\n' + '-'.repeat(72) + '\n';
/* A PIECE UNDER TWO LINES IS NOT WORTH A TURN — carry it into the next one.
 *
 * The splitter cuts on the arc's own separators, so a title page or a two-word front-matter block
 * became a piece of its own and got a whole turn of the reader's attention. It cannot say anything
 * useful about three words, and it knows it: the 08-08 read opened with "three words is not enough to
 * have earned interest or lost it", which is a true observation about the RIG rather than the book —
 * a reader on the page sees that heading and the entry under it in one glance. Manufactured findings
 * cost more than the turn does, because each one has to be chased down before it can be dismissed.
 * So a stub rides along with the piece that follows it, which is how the page presents it anyway. */
const MIN_LINES = 2, MIN_WORDS = 20;   // words, because a heading + a title is two LINES and one thought
const raw = full.split(SEP).map(s => s.trim()).filter(Boolean);
const chunks = [];
let carry = '';
for (const c of raw) {
  const merged = carry ? carry + '\n\n' + c : c;
  const lines = merged.split('\n').filter(l => l.trim()).length;
  const words = merged.split(/\s+/).filter(Boolean).length;
  if (lines < MIN_LINES || words < MIN_WORDS) { carry = merged; continue; }
  chunks.push(merged); carry = '';
}
if (carry) chunks.push(carry);            // a trailing stub has nothing to ride with; send it alone

const args = process.argv.slice(2);
if (args.includes('--list')) {
  chunks.forEach((c, i) => {
    const head = c.split('\n')[0].slice(0, 70);
    console.log(String(i + 1).padStart(3) + '  ' + head);
  });
  process.exit(0);
}

/* --piece N emits entry N ALONE, for the incremental rig (see plans/BLIND_REVIEW_MECHANISM.md and
 * scripts/blind-read.sh).  The prefix mode above re-sends the whole book on every run, so a reader
 * meets each entry with no memory of having read the ones before it — the entry is in context but
 * the READING of it is not.  Feeding one piece per turn into a single session instead gives a reader
 * that accumulates, and that is what catches arithmetic that stops adding up two hundred passes
 * later.  Piece 1 carries the standing instructions; the rest are bare. */
/* --freeze DIR cuts EVERY piece in one go, off a single render.
 *
 * `--piece N` renders the whole book to pick chunk N out of it and throws the other hundred away, so
 * a full read did a hundred and one Jekyll builds and a hundred and one Chrome renders to produce a
 * hundred and one chunks of ONE render's worth of text.  That is where the ninety minutes went, and
 * it also made the review a lock on the working tree: every piece was cut from the tree as it stood
 * when its turn came, so editing an entry still queued changed the book under the reader mid-read.
 *
 * Cutting all of them at once fixes both.  The review then reads a fixed manuscript — a snapshot,
 * with a date on it — and the working copy is free the moment the freeze finishes. */
const fi = args.indexOf('--freeze');
if (fi >= 0) {
  const dir = args[fi + 1];
  if (!dir) { console.error('usage: cold-read.js --freeze <dir>'); process.exit(2); }
  fs.mkdirSync(dir, { recursive: true });
  /* BLIND_READ_PROMPT names the prompt file, so one harness can run more than one kind of read
     (the stuck-point read, the wire reconstruction) without editing this. */
  const promptFile = process.env.BLIND_READ_PROMPT || 'blind-read-prompt.txt';
  const preamble = fs.readFileSync(path.join(__dirname, promptFile), 'utf8').trimEnd() + '\n\n';
  chunks.forEach((c, i) => {
    const nnn = String(i + 1).padStart(3, '0');
    fs.writeFileSync(path.join(dir, `piece-${nnn}.txt`), (i === 0 ? preamble : '') + c + '\n');
  });
  fs.writeFileSync(path.join(dir, 'COUNT'), String(chunks.length) + '\n');
  console.error(`froze ${chunks.length} pieces in ${dir}`);
  process.exit(0);
}

const pi = args.indexOf('--piece');
if (pi >= 0) {
  const p = parseInt(args[pi + 1], 10);
  if (!p || p < 1 || p > chunks.length) {
    console.error(`usage: cold-read.js --piece <1..${chunks.length}>`);
    process.exit(2);
  }
  const preamble = p === 1
    ? fs.readFileSync(path.join(__dirname, process.env.BLIND_READ_PROMPT || 'blind-read-prompt.txt'), 'utf8').trimEnd() + '\n\n'
    : '';
  process.stdout.write(preamble + chunks[p - 1] + '\n');
  process.exit(0);
}

const n = parseInt(args[0], 10);
if (!n || n < 1 || n > chunks.length) {
  console.error(`usage: cold-read.js <1..${chunks.length}> [--out FILE]   (--list to see them)`);
  console.error(`       cold-read.js --piece <n>   one entry alone, for the incremental blind read`);
  process.exit(2);
}

const prefix = chunks.slice(0, n);
const out = prefix.map((c, i) =>
  (i === n - 1 ? '\n===== THE PASSAGE TO REPORT ON =====\n\n' : '') + c
).join(SEP) + '\n';

const oi = args.indexOf('--out');
if (oi >= 0 && args[oi + 1]) { fs.writeFileSync(args[oi + 1], out); console.error(`wrote ${args[oi + 1]} (${n} of ${chunks.length} entries)`); }
else process.stdout.write(out);
