#!/usr/bin/env node
/* THE BEFORE-AND-AFTER GATE — a display convention may not change by assertion.
 *
 * THE RULE (Paul, 08-01, written as a rule because I do not do it naturally):
 *
 *     The convention for displaying the message can never be changed without showing a clear
 *     before and after — what the rendering was before the change, and what it is after.
 *
 * It is symmetric. ADOPTING a notation, REPLACING one, and RETIRING one all need the same debt
 * paid, and paid ON A SPECIFIC LINE: the same transmitted statement, shown in the old form and
 * then in the new one. Not described in both forms. Shown.
 *
 * WHY A GATE.  The reader learns notation only by watching one thing become another thing. I
 * cannot see when this is missing, because I already know what the new form means — so §214
 * shipped two drawn figures with no account of where a figure comes from, and a reader hit it in
 * ninety seconds. A count is the only thing that survives my confidence.
 *
 * WHAT IS CHECKED.  For every coining (`<span class="coin gl w" data-sign="X">word</span>`) there
 * must be at least one statement shown BOTH before the coin span and after it, in the same entry.
 * That is exactly what a `read back` block does — the same lines re-shown once the word exists,
 * now carrying it. On 08-01 ten coins had it and twenty-one did not.
 *
 * THE RATCHET.  The twenty-one are listed in DEBT below. The gate fails on any coin that is not in
 * that list and has no before/after, so the debt cannot grow; and it prints the outstanding list
 * every run, so it cannot be forgotten. Paying one off means DELETING ITS LINE HERE — the list may
 * only shrink, and a line removed can never be silently put back.
 *
 * Usage:  node scripts/audit-before-after.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const DIR = path.resolve(__dirname, '../_includes/listener');
const ORDER = require('./arc-order');

/* Coins that changed the page's notation by assertion, inherited 08-01. DELETE a line when it is
 * paid — never add one. */
const DEBT = new Set([
  // EMPTY. Every coining in the book now shows one real statement both ways.
  // The list may only shrink; a line removed can never be silently put back.
]);

const paid = [], owing = [], broke = [];

for (const f of ORDER) {
  const src = fs.readFileSync(path.join(DIR, f + '.html'), 'utf8');
  const re = /<div class="entry"[\s\S]*?(?=<div class="entry"|$)/g;
  let m;
  while ((m = re.exec(src))) {
    const sec = m[0], id = (sec.match(/id="(p\d+)"/) || [])[1] || '—';
    let cm; const cre = /<span class="coin gl w" data-sign="([^"]*)"/g;
    while ((cm = cre.exec(sec))) {
      const key = id + ' ' + cm[1];
      const before = new Set([...sec.slice(0, cm.index).matchAll(/data-(?:code|of)="([^"]+)"/g)].map(x => x[1]));
      const after = new Set([...sec.slice(cm.index).matchAll(/data-(?:code|of)="([^"]+)"/g)].map(x => x[1]));
      const shown = [...before].some(c => after.has(c));
      if (shown) { paid.push(key); if (DEBT.has(key)) broke.push(key); }
      else if (DEBT.has(key)) owing.push(key);
      else broke.push('NEW: ' + key);
    }
  }
}

const fresh = broke.filter(k => k.startsWith('NEW: '));
const settled = broke.filter(k => !k.startsWith('NEW: '));

if (fresh.length) {
  console.log(`✗ ${fresh.length} coining(s) change the notation with nothing shown both ways:`);
  fresh.forEach(k => console.log('    ' + k.replace('NEW: ', '')));
  console.log('    Show one real statement before the coin and the SAME one after it (a `read back`).');
  process.exit(1);
}
if (settled.length) {
  console.log(`✗ ${settled.length} debt entr(ies) now pay the rule — delete them from DEBT in this file:`);
  settled.forEach(k => console.log('    ' + k));
  process.exit(1);
}
console.log(`✓ before/after: ${paid.length} coining(s) show a line both ways; ${owing.length} still owing`);
if (owing.length) console.log('    owing: ' + [...owing].join(' · '));
