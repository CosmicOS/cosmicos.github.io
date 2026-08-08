#!/usr/bin/env node
/* prose-check.js — guard the prose/render "coining" invariant for listener.
 *
 * Coining is POSITIONAL and lives entirely in the markup: a `<span class="coin gl" data-sign="X">TOKEN</span>`
 * in the prose is where the keeper coins her shorthand; from that point in document order the renderer shows the
 * token, before it raw scrawl (js/listener.js, one document-order walk). There is no pass table and no aliases.json;
 * the coin spans ARE the source of truth. This check keeps the hand-typed prose honest against that:
 *   (1) PREMATURE TOKEN (error): a token glyph appears in prose (outside a coin span) BEFORE the coin span that
 *       coins it — i.e. the keeper uses a shorthand she hasn't cut yet. Document order = the include order below.
 *   (2) ORPHAN MARK (warning): a mark-range glyph in prose that is neither a coined token, nor structural
 *       (tones/cups/bits/tallies/slots), nor on the INTENTIONAL hand-notation allow-list.
 *
 * Widgets (.row/.msg/.frag/.peel), .sg spans, and the coin spans themselves are masked out (they are renderer
 * output / the coining act, not a prose "use"). Exits non-zero on any premature token.
 *
 * Usage:  node scripts/prose-check.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const dir = path.resolve(__dirname, '..', '_includes/listener');
// document order = the {% include %} order in listener.html
const ORDER = require('./arc-order');

// structural glyphs legitimately hand-typed in prose (notation, not sign-references)
// ◇ ◆ are THE EMPTIES (see inventory-marks `.nil`/`.nil n`): the two atom forms with nothing in the cup,
// written as one mark each — hollow for ▫⟅⟆, filled for ▪⟅⟆, the same run as ▪/▫ and ●/◦.
const STRUCT = new Set([...'˩˨˦˥⟅⟆⟦⟧᚛᚜▪▫●◦◇◆◌⬚○◔·—–…“”‘’×÷≠≤≥→←↔⇛«»▩✱']);
// INTENTIONAL hand-drawn notation — a keeper's own drawn mark, not a coined alias for a sign.
const INTENTIONAL = {
  '⟳': 'the beat/tick mark (seeker + mutable-cell clock)',
  '▮': 'the bare post §549 — an intro with no definition',
  '▤': 'the flat-field/grid sketch (builder §484)',
  '⧈': 'gate truth-table notation (builder)',
  '⊛': 'the self-reference mark (final §615)',
  '⌝': 'closes the ⌜ quote bracket (a pair)',
  '⇝': 'reachability/path notation (plainer §455)',
  '◃': 'the Turing-tape notation (cold §501)',
  '▵': 'field-stem notation (plainer — a shared stem for field names; cf. ▹ removed from cold §484)',
  '⇌': 'the §540 room-map diagram (door)',
  '⬤': 'physics mote (proton, builder §544)',
  '∙':  'physics mote (electron, builder §544)',
  '◯': 'physics mote (neutron, builder §544)',
};

// read each file, keep raw (for coin-span positions) and a length-preserving MASK (widgets/tags/coin/sg -> spaces,
// so prose-glyph offsets still line up with coin-span offsets). Global position = running base + in-file offset.
const raw = {}, masked = {}, base = {};
let running = 0;
const MASK_RE = /<div class="(?:row|msg|frag)"[^>]*>[\s\S]*?<\/div>|<div class="peel"[\s\S]*?<\/div>\s*<\/div>|<span class="gl sg"[^>]*>[\s\S]*?<\/span>|<span class="coin[^"]*"[^>]*>[\s\S]*?<\/span>|<[^>]+>/g;
for (const f of ORDER) {
  const p = path.join(dir, f + '.html');
  raw[f] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  masked[f] = raw[f].replace(MASK_RE, m => ' '.repeat(m.length));
  base[f] = running; running += raw[f].length + 100;
}
const gpos = (f, off) => base[f] + off;

// collect coin spans: token glyph -> earliest global position it is coined
const coinFirst = {}, tokenSet = new Set();
const COIN_RE = /<span class="coin[^"]*" data-sign="[^"]*"[^>]*>([^<]*)<\/span>/g;
for (const f of ORDER) {
  let m; COIN_RE.lastIndex = 0;
  while ((m = COIN_RE.exec(raw[f]))) {
    const tok = m[1].trim(); if (!tok) continue;
    tokenSet.add(tok);
    const g = gpos(f, m.index);
    if (coinFirst[tok] == null || g < coinFirst[tok]) coinFirst[tok] = g;
  }
}

const premature = [], orphans = {};
for (const f of ORDER) {
  const s = masked[f];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i], cp = ch.codePointAt(0);
    const isMark = (cp >= 0x2190 && cp <= 0x2BFF) || (cp >= 0x16A0 && cp <= 0x16FF) ||
                   (cp >= 0xE000 && cp <= 0xF8FF) || (cp >= 0x2600 && cp <= 0x27BF);
    if (!isMark || STRUCT.has(ch)) continue;
    if (tokenSet.has(ch)) {
      if (gpos(f, i) < coinFirst[ch]) premature.push(`${f} @${i}: "${ch}" used in prose before it is coined`);
    } else if (!(ch in INTENTIONAL)) {
      const k = `${ch} (U+${cp.toString(16)})`; (orphans[k] = orphans[k] || new Set()).add(f);
    }
  }
}

let fail = 0;
if (premature.length) { fail = 1; console.log('❌ PREMATURE TOKENS (prose uses a shorthand before its coin span):'); premature.forEach(x => console.log('    ' + x)); }
else console.log('✓ no premature tokens (every prose token appears at/after its coin span)');
const oe = Object.entries(orphans);
if (oe.length) { console.log('⚠ ORPHAN marks (not a coined token / structural / intentional):'); oe.forEach(([k, s]) => console.log('    ' + k + '  in: ' + [...s].join(', '))); }
else console.log('✓ no unexpected orphan marks');
console.log(`  (${tokenSet.size} coined tokens across ${ORDER.length} files)`);
process.exit(fail);
