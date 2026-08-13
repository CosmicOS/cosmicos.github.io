#!/usr/bin/env node
/* PUA -> braille, for the hand-copied artifacts. THE MAP IS SPECIFIED IN scripts/scrawl.js — read it
   there, not here. Run after every copy from ~/cvs/cosmicos, which still emits private-use.
     node scripts/braille-codepoints.js            convert
     node scripts/braille-codepoints.js --check    gate 1 of verify.sh  */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');

/* DOT 7 AND DOT 8 ARE THE TWO BRACKETS, and the quarter that holds BRAILLE PATTERN BLANK is left
   empty on purpose. Everything off the wire wears dot 7; a number wears dot 8 as well, because a
   number is the same six-bit value with the cup drawn round it. Dots 1-6 still spell the value, so
   the id is still a subtraction — and nothing on the page is ever an invisible cell, which the
   earlier map at 0x2800 made three lone signs and eight compound halves. Classical braille agrees:
   it has no dotless digit either (zero is the number sign then `j`), and U+2800 is its SPACE.

   THREE GROUPS, NOT TWO. This file had two, and the second ran eight codepoints past its end: it
   swept the syntax glyphs in with the numbers and mapped them by the same `0x28c0 + offset`, which
   walks off the end of a six-bit quarter and out of the braille block entirely, to U+2901-U+2907 —
   double-headed arrows. Every paren, space and semicolon in the message, 26,894 of them. The shipped
   data does not have that, because it was made before the ranges were merged; so the bug was
   invisible for as long as nobody re-ran the converter on a fresh copy. `--check` could not see it
   either, because it only ever asked whether anything was still private-use. It asks about the
   quarters now, at the foot of this file.

   The names were wrong too, and that is what hid the arithmetic. The second group was called SPID,
   for spider, and it is nothing of the kind — scripts/scrawl.js says so in as many words and has
   since 08-07. BOTH GROUPS ARE OCTO. The generator's own encoder settles it (GlyphCode.showChar1 in
   ~/cvs/cosmicos): a six-bit value lands at base + n for a name and base + 192 + n for a number, and
   the eight syntax marks land at base + 256. Read off the font's glyph names, that is:

     0xf144-0xf183   octo_00NNNNNN   a NAME, no brackets            -> 0x2840 + n
     0xf204-0xf243   octo_11NNNNNN   a NUMBER, both brackets        -> 0x28c0 + n
     0xf244-0xf24b   octo_22_____N   ( ) | $ space ; and two spares -> 0x2880 + n
     0xf100-0xf143   spider_*        a different alphabet; unused here, left alone */
const NAME_LO = 0xf144, NAME_HI = 0xf183, NAME_BRAILLE = 0x2840;   // dot 7
const NUM_LO  = 0xf204, NUM_HI  = 0xf243, NUM_BRAILLE  = 0x28c0;   // dots 7+8
const SYN_LO  = 0xf244, SYN_HI  = 0xf24b, SYN_BRAILLE  = 0x2880;   // dot 8 alone — the wire's punctuation

function braille(cp) {
  if (cp >= NAME_LO && cp <= NAME_HI) return NAME_BRAILLE + cp - NAME_LO;
  if (cp >= NUM_LO  && cp <= NUM_HI)  return NUM_BRAILLE  + cp - NUM_LO;
  if (cp >= SYN_LO  && cp <= SYN_HI)  return SYN_BRAILLE  + cp - SYN_LO;
  return null;                                    // 0xf100–0xf143 is unused by this site; leave it
}

// both spellings occur: `&#xf144;` in the JSON/HTML data, and the bare character in msg.json strings
function convert(text) {
  let n = 0;
  text = text.replace(/&#x([0-9a-fA-F]{4});/g, (m, h) => {
    const b = braille(parseInt(h, 16));
    if (b === null) return m;
    n++; return '&#x' + b.toString(16) + ';';
  });
  text = text.replace(/[\uf100-\uf8ff]/g, ch => {   // escaped, never a literal invisible char in source
    const b = braille(ch.codePointAt(0));
    if (b === null) return ch;
    n++; return String.fromCodePoint(b);
  });
  return { text, n };
}

module.exports = { braille, convert };
if (require.main !== module) return;                 // required by build-frags.js for the same map

const FILES = [
  '_data/sign_scrawl.json', '_data/string_glyphs.json', '_data/msg.json',
  ...fs.readdirSync(path.join(ROOT, '_prose')).map(f => '_prose/' + f),
];

/* GENERATED files are checked and never rewritten. `_includes/listener/*` comes from `_prose` via
   prose.js, and `_site/index.html` from jekyll — sweeping them would hide the real fault and it
   would come back on the next build. This is not hypothetical: the first version of this script
   scanned only the hand-copied sources and passed green while `data-glyphs` on 5 snippet rows was
   still private-use, because build-frags.js computes those with the generator's own encoder
   (GlyphCode.base = 0xf144) instead of reading them out of msg.json. */
const GENERATED = [
  ...(fs.existsSync(path.join(ROOT, '_includes/listener'))
      ? fs.readdirSync(path.join(ROOT, '_includes/listener')).map(f => '_includes/listener/' + f) : []),
  '_site/index.html',
];

let touched = 0, remaining = 0;
for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
  const src = fs.readFileSync(abs, 'utf8');
  const { text, n } = convert(src);
  if (!n) continue;
  if (CHECK) { console.log(`  ${rel}: ${n} private-use glyph(s)`); remaining += n; continue; }
  fs.writeFileSync(abs, text);
  console.log(`  ${rel}: ${n} glyph(s) -> braille`);
  touched++;
}
for (const rel of GENERATED) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
  const { n } = convert(fs.readFileSync(abs, 'utf8'));
  if (!n) continue;
  console.log(`  ${rel}: ${n} private-use glyph(s) — GENERATED, fix whatever writes it`);
  remaining += n;
}

/* AND ARE THEY THE RIGHT BRAILLE. Asking only "is anything still private-use?" is a narrower
   question than this gate's name, and it passed green through the whole time the converter was
   sending the wire's punctuation to U+2901. A glyph that landed in the blank quarter, in the unused
   half of the dot-8 one, or past the end of the block is not private-use and is not a glyph either.
   Three quarters are spoken for; everything else in reach of the map is a stray. */
const ASSIGNED = cp => (cp >= 0x2840 && cp <= 0x287f)      // a NAME
                    || (cp >= 0x2880 && cp <= 0x2887)      // a SPECIAL
                    || (cp >= 0x28c0 && cp <= 0x28ff);     // a NUMBER
function strays(text) {
  const seen = new Map();
  const note = cp => { if (!ASSIGNED(cp)) seen.set(cp, (seen.get(cp) || 0) + 1); };
  for (const m of text.matchAll(/&#x([0-9a-fA-F]{4});/g)) {
    const cp = parseInt(m[1], 16);
    if (cp >= 0x2800 && cp <= 0x29ff) note(cp);
  }
  for (const ch of text) { const cp = ch.codePointAt(0); if (cp >= 0x2800 && cp <= 0x29ff) note(cp); }
  return seen;
}

if (CHECK) {
  let stray = 0;
  for (const rel of [...FILES, ...GENERATED]) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
    const seen = strays(fs.readFileSync(abs, 'utf8'));
    for (const [cp, n] of seen) {
      console.error(`  ${rel}: ${n} × U+${cp.toString(16).toUpperCase()} — not a name, a number or a special`);
      stray += n;
    }
  }
  if (remaining) { console.error(`\n✗ ${remaining} private-use glyph(s) left — run: node scripts/braille-codepoints.js`); process.exit(1); }
  if (stray) { console.error(`\n✗ ${stray} glyph(s) outside the three quarters — see the map at the top of this file`); process.exit(1); }
  console.log('✓ signs are braille codepoints, all inside the three assigned quarters');
} else {
  console.log(touched ? `\n${touched} file(s) converted` : 'nothing to convert — already braille');
}
