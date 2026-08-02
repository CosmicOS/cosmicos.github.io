#!/usr/bin/env node
/* show-before-coin audit.  A coined word must not be introduced before the message SHOWS the sign:
   the sign should render as scrawl in a fragment (or a `.sg` ref) BEFORE its `.coin` span, in the
   same section — "leave in scrawl until understood and coined". prose-check only enforces
   coin-before-USE (token order); this enforces show-before-COIN. Exit 1 on any violation.
   Usage: node scripts/audit-coins.js */
const fs = require('fs'), path = require('path');
const w = require(path.resolve(__dirname, '../_includes/wire_quotes.json'));
const DIR = path.resolve(__dirname, '../_includes/listener');
const FILES = require('./arc-order');
const contains = (p, s) => Array.isArray(p) ? p.some(x => contains(x, s)) : String(p) === s;
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let flags = [];
for (const f of FILES) {
  const src = fs.readFileSync(path.join(DIR, f + '.html'), 'utf8');
  const re = /<div class="entry"[^>]*id="(p\d+)"[\s\S]*?(?=<div class="entry"|$)/g;
  let m;
  while ((m = re.exec(src))) {
    const sec = m[0], id = m[1];
    let cm; const cre = /<span class="coin gl w" data-sign="([^"]*)"/g;
    while ((cm = cre.exec(sec))) {
      const sign = unesc(cm[1]), before = sec.slice(0, cm.index);
      const codes = [...before.matchAll(/data-code="(\d+)"/g)].map(x => x[1]);
      const shownCode = codes.some(c => w[c] && contains(w[c].parse, sign));
      const shownSg = new RegExp('data-s="' + esc(cm[1]) + '"').test(before);
      /* A COMPOUND is shown when every one of its parts is. `is:int` is two marks that always run
       * together; a keeper shows the pair by writing them side by side, and there is no separate act
       * of "showing the compound". Demanding one made me write a line of prose whose only job was to
       * satisfy this gate — which is the gate writing the book. (08-02) */
      const parts = sign.split(':');
      const shownParts = parts.length > 1 &&
        parts.every(p => new RegExp('data-s="[^"]*\\b' + esc(p) + '\\b[^"]*"').test(before));
      if (!shownCode && !shownSg && !shownParts) flags.push(`${f} ${id}  sign=${sign}`);
    }
  }
}
if (flags.length) {
  console.log(`✗ ${flags.length} show-before-coin violation(s) — a coin appears before its sign is shown:`);
  flags.forEach(x => console.log('    ' + x));
  process.exit(1);
} else {
  console.log('✓ show-before-coin: every coin follows a fragment (or .sg ref) that shows its sign');
}
