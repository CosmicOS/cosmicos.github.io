#!/usr/bin/env node
/* cold-read.js — cut the book into a PREFIX, so a reader can be stuck the way a real one is.
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
const full = execFileSync('node', [path.join(__dirname, 'read.js')], {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
});

const SEP = '\n' + '-'.repeat(72) + '\n';
const chunks = full.split(SEP).map(s => s.trim()).filter(Boolean);

const args = process.argv.slice(2);
if (args.includes('--list')) {
  chunks.forEach((c, i) => {
    const head = c.split('\n')[0].slice(0, 70);
    console.log(String(i + 1).padStart(3) + '  ' + head);
  });
  process.exit(0);
}

const n = parseInt(args[0], 10);
if (!n || n < 1 || n > chunks.length) {
  console.error(`usage: cold-read.js <1..${chunks.length}> [--out FILE]   (--list to see them)`);
  process.exit(2);
}

const prefix = chunks.slice(0, n);
const out = prefix.map((c, i) =>
  (i === n - 1 ? '\n===== THE PASSAGE TO REPORT ON =====\n\n' : '') + c
).join(SEP) + '\n';

const oi = args.indexOf('--out');
if (oi >= 0 && args[oi + 1]) { fs.writeFileSync(args[oi + 1], out); console.error(`wrote ${args[oi + 1]} (${n} of ${chunks.length} entries)`); }
else process.stdout.write(out);
