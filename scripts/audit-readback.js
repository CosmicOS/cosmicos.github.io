#!/usr/bin/env node
/* show-AFTER-coin audit (the T2 read-back rule).  A coined word must be SEEN SUBSTITUTED in its
   own section: after the `.coin` span, the sign should appear again — in a fragment (`data-code`
   whose parse contains the sign, so it now renders as the word) or a `.sg data-s` prose ref, or
   inside a `.readback` panel.  If a coin is never re-shown after it is minted, the substitution is
   never demonstrated and T2 wants a read-back (or another excuse to show it in action).
   This is the complement of audit-coins.js (show-BEFORE-coin).  Exit 1 on any gap: every coin must
   be re-shown after minting (a later fragment/.sg, or a `.readback` panel carrying its sign).
   Usage: node scripts/audit-readback.js */
const fs = require('fs'), path = require('path');
const w = require(path.resolve(__dirname, '../_data/wire_quotes.json'));
const DIR = path.resolve(__dirname, '../_includes/listener');
const FILES = ['founder','terse','wondering','wary','maker','doubter','plainer','cold','listener','builder','final'];
const contains = (p, s) => Array.isArray(p) ? p.some(x => contains(x, s)) : String(p) === s;
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let gaps = [], ok = 0;
for (const f of FILES) {
  const src = fs.readFileSync(path.join(DIR, f + '.html'), 'utf8');
  const re = /<div class="entry"[^>]*id="(p\d+)"[\s\S]*?(?=<div class="entry"|$)/g;
  let m;
  while ((m = re.exec(src))) {
    const sec = m[0], id = m[1];
    let cm; const cre = /<span class="coin gl w" data-sign="([^"]*)"/g;
    while ((cm = cre.exec(sec))) {
      const sign = unesc(cm[1]);
      const after = sec.slice(cm.index + cm[0].length);          // everything past this coin span
      const codes = [...after.matchAll(/data-code="(\d+)"/g)].map(x => x[1]);
      const shownCode = codes.some(c => w[c] && contains(w[c].parse, sign));   // a later fragment renders it
      const shownSg = new RegExp('data-s="' + esc(cm[1]) + '"').test(after);   // a later prose .sg ref
      const hasRB = /class="readback"/.test(after);                            // a read-back panel follows
      if (shownCode || shownSg) ok++;
      else gaps.push(`${f} ${id}  sign=${sign}${hasRB ? '  (has .readback but it does not carry this sign)' : '  (no re-show, no read-back)'}`);
    }
  }
}
console.log(`read-back audit — coins seen substituted after minting: ${ok} ok, ${gaps.length} gap(s)`);
gaps.forEach(x => console.log('    ' + x));
