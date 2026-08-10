#!/usr/bin/env node
/* READ A SCRAWL GLYPH AS A NUMBER.  ** THE ONE PLACE THE MAP IS SPECIFIED. **
 *
 * A glyph is not an alphabet letter to look up — it is a base-64 digit, and that digit is the number
 * the message sends inside the sign's own cup.  `intro` is 18, and its wire head is ▪⟅10010⟆.
 *
 * A braille codepoint is 0x2800 + its dot mask, so:
 *
 *     dots 1-6   the six-bit value          dot 1 is the LOW bit
 *     dot 7      it came off the wire
 *     dot 8      it wears the brackets      = the font's own open/close pair
 *
 *     a NAME     0x2840 + id     id = cp - 0x2840
 *     a NUMBER   0x28c0 + id     the same value, bracketed
 *     specials   0x2880 + n      ( ) | $ space ;   — `|` and `$` are her ◇ and ◆
 *
 * The 0x2800 quarter is EMPTY on purpose: U+2800 is BRAILLE PATTERN BLANK, the block's space, and a
 * glyph there is invisible in a text dump.  Classical braille has no dotless digit either — zero is
 * ⠼⠚.  Only two of the four 64-cell quarters are needed, so the one with the blank is not used.
 * Braille at all because a private-use codepoint vanishes when anyone copies a line off the page.
 *
 * WHY THIS EXISTS.  Working from screenshots I could see a glyph but not READ one, so I checked the
 * `data-s` attribute instead and trusted the renderer.  That is the trust that let §207 ship pointing
 * at a mark it never showed.  A number is checkable against the wire; a hooked stroke is not.
 *
 *   node scripts/scrawl.js 2852         a codepoint -> its id, and the signs that use it
 *   node scripts/scrawl.js 18           an id -> its glyph and signs
 *   node scripts/scrawl.js --table      every single-glyph sign, by id
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

/* The two groups this site actually uses, and what each one IS. Corrected 08-07: the second was
   labeled SPIDER here and is nothing of the kind — spider glyphs (0xf100–0xf143 as shipped) appear
   nowhere on the page. Both groups are OCTO. The difference is the bracket bits in the glyph name:
     bare   `octo_00NNNNNN`  a sign, drawn with no brackets       -> id is the six-bit value
     cupped `octo_11NNNNNN`  the same value with BOTH brackets    -> what the string glyphs use
   plus eight `octo_22_____N` specials at the top of the cupped group. */
const OCTO_BASE = 0x2840, OCTO_TOP = 0x287f;   // a NAME: dot 7, dots 1-6 = the id
const CUP_BASE  = 0x28c0, CUP_TOP  = 0x28ff;   // a NUMBER: dots 7+8, the same value bracketed
const SPECIAL_BASE = 0x2880, SPECIAL_TOP = 0x2887;

/** a codepoint -> {kind, id, …}.  null if it is not a message glyph at all. */
function decode(cp) {
  if (cp >= OCTO_BASE && cp <= OCTO_TOP) return { kind: 'sign', id: cp - OCTO_BASE };
  if (cp >= CUP_BASE && cp <= CUP_TOP) return { kind: 'cupped', id: cp - CUP_BASE };
  if (cp >= SPECIAL_BASE && cp <= SPECIAL_TOP) return { kind: 'special', id: cp - SPECIAL_BASE };
  return null;
}
/** every id in a "&#xf174;&#xf175;" string */
const ids = s => [...s.matchAll(/&#x([0-9a-f]+);/gi)].map(m => decode(parseInt(m[1], 16))).filter(Boolean);
/** short human form: 48 · 48·49 for a compound */
const label = s => ids(s).map(d => d.kind === 'sign' ? d.id
  : d.kind === 'cupped' ? `⟅${d.id}⟆` : `*${d.id}`).join('·');

module.exports = { decode, ids, label, OCTO_BASE };
if (require.main !== module) { return; }

const scrawl = JSON.parse(fs.readFileSync(path.join(ROOT, '_data/sign_scrawl.json'), 'utf8'));
const byId = new Map();
for (const [name, g] of Object.entries(scrawl)) {
  const d = ids(g);
  if (d.length === 1 && d[0].kind === 'sign') (byId.get(d[0].id) || byId.set(d[0].id, []).get(d[0].id)).push(name);
}
const arg = process.argv[2];
if (arg === '--table' || !arg) {
  console.log('  id  codepoint  sign(s)');
  for (const id of [...byId.keys()].sort((a, b) => a - b))
    console.log(`  ${String(id).padStart(2)}  0x${(id + OCTO_BASE).toString(16)}     ${byId.get(id).join(', ')}`);
  process.exit(0);
}
const cp = /^[0-9a-f]{4}$/i.test(arg) ? parseInt(arg, 16) : null;
const id = cp !== null ? decode(cp) : { kind: 'sign', id: Number(arg) };
if (!id) { console.error(`0x${arg} is not a message glyph`); process.exit(2); }
if (id.kind === 'atom') { console.log(`0x${arg}  ATOM (wire)  open=${id.open} close=${id.close} num=${id.num}`); process.exit(0); }
console.log(`id ${id.id}   codepoint 0x${(id.id + OCTO_BASE).toString(16)}   sign(s): ${(byId.get(id.id) || ['—']).join(', ')}`);
console.log(`the message sends this as the binary number in the sign's cup: ⟅ ${id.id.toString(2)} ⟆`);
