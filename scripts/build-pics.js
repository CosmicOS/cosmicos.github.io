#!/usr/bin/env node
/* Regenerate the listener's gate pictures from the WIRE — the only faithful source.
 *
 * The message literally transmits each figure as a `make-image(H, W, rows)` statement, where every
 * row is a W-char string of ':' (lit) and '.' (dark).  Unpacking those numbers into a lit/dark grid
 * is exactly what the keeper does by hand — so this generator does, byte-for-byte, what the fiction
 * says she does.  (The build repo's PPM renders are NOT used: those are an 8×-scaled, styled drawing
 * produced by sender-side tooling and never appear on the wire — using them would be a leak.)
 *
 * Output: assets/listener/<name>.png, one per gate, referenced by <img class="pic" src=…>.
 * Deterministic (same wire → same bytes).  Run standalone or via build.sh; audit-assets validates.
 * Usage: node scripts/build-pics.js
 */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const msg = require(path.join(ROOT, '_data/msg.json'));
const OUT = path.join(ROOT, 'assets/listener');

const DARK = [8, 11, 9], LIT = [143, 230, 168];          // the established .pic palette (matches gate NOT)
const MAP = {                                            // wire image name -> asset basename
  'test-image': 'test', 'cos_not_image': 'not', 'cos_true:*_image': 'and', 'cos_true:+_image': 'or',
  'cos_nor_image': 'nor', 'cos_osc_image': 'osc', 'cos_sr_image': 'sr', 'cos_d_image': 'd',
};

const crc32 = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return buf => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type, 'latin1'), data]); return Buffer.concat([u32(data.length), body, u32(crc32(body))]); };
function pngTruecolor(W, H, grid) {
  const raw = Buffer.alloc(H * (1 + W * 3)); let o = 0;
  for (let y = 0; y < H; y++) {
    raw[o++] = 0;                                        // filter: none
    const s = grid[y] || '';
    for (let x = 0; x < W; x++) { const c = s[x] === ':' ? LIT : DARK; raw[o++] = c[0]; raw[o++] = c[1]; raw[o++] = c[2]; }
  }
  const ihdr = Buffer.concat([u32(W), u32(H), Buffer.from([8, 2, 0, 0, 0])]);   // 8-bit, truecolor
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const rows = Array.isArray(msg) ? msg : Object.values(msg).find(Array.isArray);
const defOf = name => { for (const r of rows) { const p = r.parse; if (Array.isArray(p) && p[0] === '@' && p[1] === name && Array.isArray(p[2]) && p[2][1] === 'make-image') return p[2]; } return null; };

fs.mkdirSync(OUT, { recursive: true });
let made = 0, missing = [];
for (const [wire, base] of Object.entries(MAP)) {
  const mk = defOf(wire);
  if (!mk) { missing.push(wire); continue; }
  const H = +mk[2], W = +mk[3], grid = mk[4].slice(2).map(r => Array.isArray(r) ? r[0] : r);
  fs.writeFileSync(path.join(OUT, base + '.png'), pngTruecolor(W, H, grid));
  console.log(`  ${base}.png  ${W}×${H}  (from wire ${wire})`);
  made++;
}
if (missing.length) { console.error('✗ wire defines not found: ' + missing.join(', ')); process.exit(1); }
console.log(`✓ built ${made} gate picture(s) from the wire -> assets/listener/`);
