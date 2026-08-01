#!/usr/bin/env node
/* READ A SCRAWL GLYPH AS A NUMBER.  Scrawl is not an alphabet to be looked up — it is derived, and
 * one glyph is one base-64 digit.  This decodes it, so no tool ever has to take a mark on trust.
 *
 * WHERE THE NUMBER COMES FROM (verified 2026-08-01 against all 232 wire quotes, 0 mismatches):
 *   The font (~/cvs/cosmicos/src/font/generate_glyphs.ts) lays down two tools in the private use
 *   area.  SPIDER (bits=4) fills 0xf100–0xf143: 68 atom glyphs, idx = ((open*2+close)*17 + n),
 *   n=0..15 or 16 for "no number" — that one renders the WIRE, atom by atom.  OCTO (bits=6) fills
 *   0xf144–0xf183: 64 glyphs, one per 6-bit value.  A SIGN is drawn with an octo glyph, so
 *
 *        id = codepoint - 0xf144            (0..63)
 *
 *   and that id is not a lookup key — it is the binary number the message actually sends inside
 *   that sign's cup.  `intro` is f156 -> 18, and its wire head is ▪ ⟅ 10010 ⟆ = 18.  `unary` is
 *   f14b -> 7, wire ⟅ 111 ⟆ = 7.  A compound (`is:int`) is two glyphs and therefore two ids.
 *
 * WHY THIS EXISTS.  Working from screenshots and text dumps I could see a scrawl glyph but not
 * READ one, so I checked the `data-s` attribute instead and trusted the renderer had put the right
 * mark there.  That is the same trust that let §207 ship pointing at a mark it never showed.  A
 * number is checkable against the wire; a hooked stroke is not.
 *
 *   node scripts/scrawl.js f156          a codepoint -> its id, and the signs that use it
 *   node scripts/scrawl.js 18            an id -> its glyph and signs
 *   node scripts/scrawl.js --table       every single-glyph sign, by id
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

const OCTO_BASE = 0xf144, OCTO_TOP = 0xf183;   // 64 six-bit glyphs
const SPIDER_BASE = 0xf100, SPIDER_TOP = 0xf143;

/** a codepoint -> {kind, id, …}.  null if it is not a message glyph at all. */
function decode(cp) {
  if (cp >= OCTO_BASE && cp <= OCTO_TOP) return { kind: 'sign', id: cp - OCTO_BASE };
  if (cp >= SPIDER_BASE && cp <= SPIDER_TOP) {
    const i = cp - SPIDER_BASE, n = i % 17, oc = (i - n) / 17;
    return { kind: 'atom', open: !!(oc & 2), close: !!(oc & 1), num: n === 16 ? null : n };
  }
  return null;
}
/** every id in a "&#xf174;&#xf175;" string */
const ids = s => [...s.matchAll(/&#x([0-9a-f]+);/gi)].map(m => decode(parseInt(m[1], 16))).filter(Boolean);
/** short human form: 48 · 48·49 for a compound */
const label = s => ids(s).map(d => d.kind === 'sign' ? d.id
  : `${d.open ? '⟅' : ''}${d.num === null ? '·' : d.num}${d.close ? '⟆' : ''}`).join('·');

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
