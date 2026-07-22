#!/usr/bin/env node
/* Asset integrity gate.  Broken material in the lesson — a truncated or corrupt image — must never
   reach a human's eyes to be found; a machine finds it first.  Scans the listener includes for BOTH
   inline `data:image/*;base64,…` assets AND referenced local files (`<img … src="/assets/…png">`),
   and validates every PNG chunk-by-chunk (8-byte signature, IHDR first, every chunk length in-bounds,
   CRC32 correct, IEND present).  A referenced file that is missing is also a failure.  Exit 1 on any
   broken asset, naming file:line, source, fault, and alt-text.
   (Born 2026-07-22: two truncated gate PNGs in builder.html reached the reader before any gate
    caught them — no IEND, garbled render.  The pictures have since moved to files built from the
    wire by build-pics.js; this gate guards both shapes.)
   Usage: node scripts/audit-assets.js */
const fs = require('fs'), path = require('path');
const DIR = path.resolve(__dirname, '../_includes/listener');

// CRC32 with the PNG/zlib polynomial, for per-chunk verification (catches corruption, not just cut-off).
const crc32 = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return buf => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();

function checkPng(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(sig)) return 'bad PNG signature';
  let i = 8, first = true, sawIEND = false;
  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    const end = i + 12 + len;                          // length(4) + type(4) + data(len) + crc(4)
    if (end > buf.length) return `truncated: chunk '${type}' (len ${len}) runs past end of ${buf.length}-byte file`;
    if (first && type !== 'IHDR') return `first chunk '${type}', expected IHDR`;
    first = false;
    if (buf.readUInt32BE(i + 8 + len) !== crc32(buf.subarray(i + 4, i + 8 + len))) return `bad CRC in chunk '${type}'`;
    if (type === 'IEND') { sawIEND = true; break; }
    i = end;
  }
  return sawIEND ? null : 'no IEND chunk (truncated)';
}

const ROOT = path.resolve(__dirname, '..');
const lineAt = (src, i) => src.slice(0, i).split('\n').length;
const altBefore = (src, i) => (src.slice(Math.max(0, i - 600), i).match(/alt="([^"]*)"[^"]*$/) || [])[1] || '';

let bad = [], total = 0;
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.html'))) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');

  // (a) inline data-URI images
  let m; const inl = /data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/g;
  while ((m = inl.exec(src))) {
    total++;
    const fmt = m[1], alt = altBefore(src, m.index);
    let err = null, buf = null;
    try { buf = Buffer.from(m[2], 'base64'); } catch { err = 'base64 will not decode'; }
    if (buf) {
      if ((m[2].length % 4) !== 0) err = 'base64 length not a multiple of 4 (clipped)';
      else if (fmt === 'png') err = checkPng(buf);
      else if (buf.length < 8) err = 'decodes to fewer than 8 bytes';
    }
    if (err) bad.push(`${f}:${lineAt(src, m.index)}  [inline ${fmt}] ${err}${alt ? `  — alt: "${alt.slice(0, 64)}"` : ''}`);
  }

  // (b) referenced local image files
  const ref = /<img\b[^>]*\bsrc="(\/[^"]+\.(png|jpe?g|gif|webp))"/gi;
  while ((m = ref.exec(src))) {
    total++;
    const rel = m[1].replace(/^\//, ''), ext = m[2].toLowerCase(), alt = altBefore(src, m.index);
    const file = path.join(ROOT, rel);
    let err = null;
    if (!fs.existsSync(file)) err = `referenced file missing: ${m[1]}`;
    else if (ext === 'png') err = checkPng(fs.readFileSync(file));
    if (err) bad.push(`${f}:${lineAt(src, m.index)}  [ref ${rel}] ${err}${alt ? `  — alt: "${alt.slice(0, 64)}"` : ''}`);
  }
}
if (bad.length) {
  console.log(`✗ ${bad.length}/${total} embedded asset(s) BROKEN — a reader would meet these before you do:`);
  bad.forEach(x => console.log('    ' + x));
  process.exit(1);
}
console.log(`✓ assets: all ${total} image(s) present and valid (signature + chunks + CRC + IEND)`);
