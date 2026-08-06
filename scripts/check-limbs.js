#!/usr/bin/env node
// Gate: these people have SIXTEEN FEET and no other limb.
//
// `GLOSSARY.md` rules it: "foot — a limb, and the only limb-word there is. Sixteen of them.
// Never 'hand', 'finger', 'digit'. Handwriting is her cut or her writing, never her hand."
// Nothing enforced it, and nine slips had settled into the prose — including "Kell's hand wrote"
// sitting in the same paragraph as "your feet know a mark cut in stone" and "with all sixteen down".
//
// The subtle one, and the reason this checks phrases and not just words: "a second pair of hands"
// is wrong TWICE. The limb word is wrong, and so is the pairing — sixteen feet do not come in
// pairs, so translating it to "a second pair of feet" keeps the human anatomy and fixes nothing.
// Body idioms have to be dropped, not swapped limb-for-limb. Hence PAIRED below.
//
// Scope: the prose only. plans/ docs may name the forbidden words to state the rule, and this
// file is full of them.
const fs = require('fs'), path = require('path');

// limb words that are never right in the prose, in any sense — body part, metonym ("a hand awake
// at Kell"), handwriting ("in her own hand"), or verb ("it didn't hand me the knot"). Every one of
// those reads as human anatomy in a book that has spent eleven keepers building something else.
const LIMB = ['hand', 'hands', 'handed', 'handing', 'handful', 'handfuls', 'handwriting', 'barehanded',
  'finger', 'fingers', 'fingertip', 'fingertips', 'fingered',
  'thumb', 'thumbs', 'palm', 'palms', 'knuckle', 'knuckles', 'fist', 'fists', 'wrist', 'wrists',
  'digit', 'digits', 'toe', 'toes', 'limb', 'limbs', 'arm', 'arms', 'elbow', 'elbows'];

// pairing applied to feet: the anatomy is sixteen, not eight twos.
const PAIRED = [/\b(a|another|second|third|spare|extra|pair|pairs)\s+pair\s+of\s+(feet|foot)\b/i,
  /\bpair\s+of\s+feet\b/i, /\bboth\s+feet\b/i, /\beither\s+foot\b/i];

const files = [];
const walk = d => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'archive' || e.name === 'node_modules' || e.name === '_site' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (/\.html$/.test(e.name)) files.push(p);
  }
};
['_prose'].forEach(d => { if (fs.existsSync(d)) walk(d) });

// strip tags before matching: class="hand" and data-hand="hers" are the hand-ROW declaration
// (scripts/audit-hands.js), a different thing entirely, and must not trip this.
const strip = s => s.replace(/<[^>]*>/g, ' ');
const reLimb = new RegExp('\\b(' + LIMB.join('|') + ')\\b', 'gi');

let bad = 0;
for (const f of files) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const t = strip(line);
    let m; reLimb.lastIndex = 0;
    while ((m = reLimb.exec(t))) {
      bad++;
      console.log(`    ${f}:${i + 1}  "${m[0]}" — the only limb is a foot, and there are sixteen`);
    }
    for (const re of PAIRED) {
      const p = t.match(re);
      if (p) { bad++; console.log(`    ${f}:${i + 1}  "${p[0]}" — sixteen feet do not come in pairs`); }
    }
  });
}
if (bad) { console.log(`✗ ${bad} limb slip(s) — see GLOSSARY.md "foot"`); process.exit(1); }
console.log('✓ limbs (sixteen feet, no hands, no pairs)');
