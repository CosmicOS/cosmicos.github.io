#!/usr/bin/env node
/* audit-notation — a keeper may not use her own notation before she invents it.
 *
 * prose-check guards COINED tokens (the words minted in a `.coin` span for a sign on the wire).
 * It does not guard the keeper's own working vocabulary — cup, piece, seam — which she invents in
 * plain prose with no markup around it.  That hole cost a first-page logic error on 07-30: §189 said
 * "the pieces have come thick" and "long runs inside the cups" four passes before §193 discovered
 * both, while §193 itself opened "trying to find where one thing ends and the next begins."  The
 * founding observation of the whole book rested on a segmentation she did not yet have, and every
 * other gate passed it.
 *
 * Add a row whenever a keeper names a piece of her own apparatus.  Exit 1 on any use before its pass.
 */
const fs = require('fs'), path = require('path');
const DIR = path.resolve(__dirname, '../_includes/listener');
const ORDER = require('./arc-order');

const NOTATION = [
  { word: 'cup',   from: 193, why: '§193 — Ren\'s fair copy shows two tones pairing; she reads them as a cup and its lid' },
  { word: 'piece', from: 193, why: '§193 — she cuts at the seam and the run falls into pieces' },
  { word: 'seam',  from: 193, why: '§193 — the doubled-shut she takes for a seam' },
];

const flags = [];
for (const name of ORDER) {
  const src = fs.readFileSync(path.join(DIR, name + '.html'), 'utf8');
  for (const chunk of src.split('<div class="entry').slice(1)) {
    const m = chunk.match(/<div class="stamp">Pass (\d+)/);
    if (!m) continue;
    const pass = +m[1];
    // prose only: strip tags, and drop attribute values so class="cup" is not a hit
    const prose = chunk.replace(/<[^>]+>/g, ' ').toLowerCase();
    for (const { word, from, why } of NOTATION) {
      if (pass >= from) continue;
      if (new RegExp(`\\b${word}s?\\b`).test(prose))
        flags.push(`  §${pass} uses "${word}" before it exists — ${why}`);
    }
  }
}
if (flags.length) {
  console.error(`✗ notation used before it was invented (${flags.length}):`);
  flags.forEach(f => console.error(f));
  process.exit(1);
}
console.log(`✓ notation: ${NOTATION.length} term(s) checked; none used before the pass that invents it`);
