#!/usr/bin/env node
/* THE DRAWN-SIGN AUDIT — a row may not draw a sign the wire never sent in that statement.
 *
 * WHY THIS EXISTS.  `audit-hands.js` checks that every `.row hand` DECLARES why it is not a wire
 * quote and that its `data-of` codes are real statements.  It never looks at what the row actually
 * draws.  So a row could cite a true statement and then depict something else entirely, and every
 * gate would pass.
 *
 * That is not hypothetical.  §221's tally rows each carried a spurious leading `data-s="is"` in
 * front of `data-s="is:square"`.  The wire sends `is:square | unary N`, and `is:square` is ONE sign
 * written as two scrawl glyphs — a shared stem `is` and a leaf `square`, which is the family
 * structure a later keeper names outright.  Drawing `is` and then `is:square` prints the stem
 * TWICE: three glyphs where the message sent two.  On the page it read as a stutter, and a blind
 * reader stopped on it and could not resolve it.  Six rows, in the founder's most-quoted exhibit.
 *
 * THE RULE, and why it is a subsequence and not an equality.  A keeper may legitimately draw LESS
 * than the wire sent: she abridges, she drops the doubled-shut once it tells her nothing, she shows
 * one member of a pair on its own line, she writes a count as ● and ◦ instead of nested cups.  All
 * of that is her notation and it is the point of the book.  What she may never do is draw a sign
 * that is not there, or draw one twice when it came once.  So: the sequence of scrawl glyphs the
 * row's sign-spans expand to must be a SUBSEQUENCE of the glyphs the statement actually sent.
 * Omission is allowed and ordering must hold; invention and duplication are not.
 *
 * Rows with no `data-s` spans are not this audit's business — `build-frags` gates `data-code`, and
 * `audit-hands` gates the declaration.
 */
const fs = require('fs'), path = require('path');

const msg = {};
for (const e of JSON.parse(fs.readFileSync('_data/msg.json', 'utf8'))) if (e.code) msg[e.code] = e;
const signs = JSON.parse(fs.readFileSync('plans/listener_index.json', 'utf8')).signs;

const glyphs = s => (s.match(/&#x[0-9a-f]+;/gi) || []).map(x => x.toLowerCase());
const subseq = (small, big) => { const it = big[Symbol.iterator](); return small.every(c => { for (const b of it) if (b === c) return true; return false; }); };

const files = fs.readdirSync('_prose').filter(f => /\.(html|blocks\.json)$/.test(f)).map(f => path.join('_prose', f));
let bad = 0;
for (const f of files) {
  // blocks.json is keyed by exhibit name (see prose.js), so take the values, not the keys.
  const txt = f.endsWith('.json')
    ? Object.values(JSON.parse(fs.readFileSync(f, 'utf8'))).join(' ')
    : fs.readFileSync(f, 'utf8');
  const re = /data-of="([0-9]+)"([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(txt))) {
    const [, code, body] = m;
    const e = msg[code]; if (!e) continue;                       // build-frags gates code validity
    const named = (body.match(/data-s="([^"]+)"/g) || []).map(s => s.slice(8, -1));
    if (!named.length) continue;
    if (named.some(s => !signs[s])) continue;                    // audit-signs gates unknown names
    const drawn = named.flatMap(s => glyphs(signs[s].scrawl));
    if (!subseq(drawn, glyphs(e.spider))) {
      bad++;
      console.log(`    ${f}  ${JSON.stringify(e.lines).slice(0, 60)}`);
      console.log(`      draws ${named.join(' ')}  ->  ${drawn.join(' ')}`);
      console.log(`      wire sent            ->  ${glyphs(e.spider).join(' ')}`);
    }
  }
}
if (bad) { console.log(`✗ ${bad} row(s) draw a sign the wire never sent there`); process.exit(1); }
console.log('✓ drawn signs (every drawn sign is one the statement actually sent)');
