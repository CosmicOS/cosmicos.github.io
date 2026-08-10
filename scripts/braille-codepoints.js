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
   it has no dotless digit either (zero is the number sign then `j`), and U+2800 is its SPACE. */
const OCTO_LO = 0xf144, OCTO_HI = 0xf183, OCTO_BRAILLE = 0x2840;   // a NAME  — dot 7
const SPID_LO = 0xf204, SPID_HI = 0xf24b, SPID_BRAILLE = 0x28c0;   // a NUMBER — dots 7+8

function braille(cp) {
  if (cp >= OCTO_LO && cp <= OCTO_HI) return OCTO_BRAILLE + cp - OCTO_LO;
  if (cp >= SPID_LO && cp <= SPID_HI) return SPID_BRAILLE + cp - SPID_LO;
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

if (CHECK) {
  if (remaining) { console.error(`\n✗ ${remaining} private-use glyph(s) left — run: node scripts/braille-codepoints.js`); process.exit(1); }
  console.log('✓ signs are braille codepoints (nothing in the private-use area)');
} else {
  console.log(touched ? `\n${touched} file(s) converted` : 'nothing to convert — already braille');
}
