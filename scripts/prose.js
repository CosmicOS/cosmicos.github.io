#!/usr/bin/env node
/* prose.js — separate the diary's PROSE from its EXHIBITS, so prose can be read and rewritten.
 *
 * WHY.  `_includes/listener/*.html` interleaves the keeper's sentences with 300+ opaque wire strings
 * (`data-code="12100103121113223…"`), inline SVG, base64-free图 markup and hand-drawn rows.  Editing a
 * paragraph meant navigating around all of it; a rebuild harness that tried to do it mechanically
 * truncated two files on 07-30 and every gate passed anyway.  Prose is written by reading, so the
 * thing you read has to be prose.
 *
 * MODEL.  Source of truth is split in two:
 *
 *   _prose/<keeper>.html         the keeper's words, with {{EX:n}} where an exhibit goes.   <- EDIT THIS
 *   _prose/<keeper>.blocks.json  the exhibit blocks, verbatim, in order.                    <- generated
 *
 * `build` splices them back into _includes/listener/<keeper>.html, which is now GENERATED — do not
 * hand-edit it.  `pull` goes the other way (one-time import, or re-import if someone edits the HTML).
 * Both directions assert an exact byte round-trip, so a splice can never silently drop or reorder a
 * wire quote.
 *
 * Usage:
 *   node scripts/prose.js pull     import _includes/listener/*.html  -> _prose/*   (asserts round-trip)
 *   node scripts/prose.js build    _prose/* -> _includes/listener/*.html           (asserts round-trip)
 *   node scripts/prose.js check    build to memory and diff; non-zero if out of sync
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ARC = path.join(ROOT, '_includes/listener');
const PROSE = path.join(ROOT, '_prose');
const ORDER = require('./arc-order');

/* An exhibit is any block that carries message data or hand-drawn notation.  Everything else is
 * prose.  Keep this list in sync with inventory-marks.js's class inventory. */
const OPEN = [
  { re: /<div class="rows">/g,      tag: 'div' },
  { re: /<div class="frag[^"]*"/g,  tag: 'div' },
  { re: /<div class="peel">/g,      tag: 'div' },
  { re: /<div class="readback">/g,  tag: 'div' },
  { re: /<div class="copied">/g,    tag: 'div' },
  { re: /<div class="reduce">/g,    tag: 'div' },
  { re: /<div class="fold">/g,      tag: 'div' },
  { re: /<div class="msg" /g,       tag: 'div' },
  { re: /<div class="seekmap"/g,    tag: 'div' },
  { re: /<figure class="circuit"/g, tag: 'figure' },
];
const VOID = [/<img class="pic"[^>]*>/g];

function extract(src) {
  const marks = [];
  for (const { re, tag } of OPEN) { re.lastIndex = 0; let m; while ((m = re.exec(src))) marks.push({ i: m.index, tag }); }
  for (const re of VOID) { re.lastIndex = 0; let m; while ((m = re.exec(src))) marks.push({ i: m.index, tag: null, len: m[0].length }); }
  marks.sort((a, b) => a.i - b.i);

  const blocks = []; let out = '', cur = 0;
  for (const mk of marks) {
    if (mk.i < cur) continue;                    // nested inside a block already taken
    let end;
    if (mk.tag === null) end = mk.i + mk.len;
    else {
      const openRe = new RegExp(`<${mk.tag}\\b`, 'g'), closeRe = new RegExp(`</${mk.tag}>`, 'g');
      let depth = 0, p = mk.i;
      for (;;) {
        openRe.lastIndex = p; closeRe.lastIndex = p;
        const o = openRe.exec(src), c = closeRe.exec(src);
        if (!c) throw new Error(`unbalanced <${mk.tag}> at ${mk.i}`);
        if (o && o.index < c.index) { depth++; p = o.index + 1; }
        else { depth--; p = c.index + 1; if (depth === 0) { end = c.index + c[0].length; break; } }
      }
    }
    out += src.slice(cur, mk.i) + `{{EX:${blocks.length}}}`;
    blocks.push(src.slice(mk.i, end));
    cur = end;
  }
  return { shell: out + src.slice(cur), blocks };
}

const splice = (shell, blocks) => shell.replace(/\{\{EX:(\d+)\}\}/g, (_, n) => {
  if (blocks[+n] === undefined) throw new Error(`{{EX:${n}}} has no block`);
  return blocks[+n];
});

function pull() {
  fs.mkdirSync(PROSE, { recursive: true });
  for (const name of ORDER) {
    const src = fs.readFileSync(path.join(ARC, name + '.html'), 'utf8');
    const { shell, blocks } = extract(src);
    if (splice(shell, blocks) !== src) throw new Error(`round-trip FAILED for ${name} — refusing to write`);
    fs.writeFileSync(path.join(PROSE, name + '.html'), shell);
    fs.writeFileSync(path.join(PROSE, name + '.blocks.json'), JSON.stringify(blocks, null, 1));
    const words = shell.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    console.log(`  ${name.padEnd(11)} ${String(blocks.length).padStart(2)} exhibits · ${words} words of prose`);
  }
}

function render(name) {
  const shell = fs.readFileSync(path.join(PROSE, name + '.html'), 'utf8');
  const blocks = JSON.parse(fs.readFileSync(path.join(PROSE, name + '.blocks.json'), 'utf8'));
  const out = splice(shell, blocks);
  const used = new Set([...shell.matchAll(/\{\{EX:(\d+)\}\}/g)].map(m => +m[1]));
  const dropped = blocks.map((_, i) => i).filter(i => !used.has(i));
  return { out, dropped };
}

function build({ write = true } = {}) {
  let stale = 0;
  for (const name of ORDER) {
    const { out, dropped } = render(name);
    const target = path.join(ARC, name + '.html');
    const old = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    const note = dropped.length ? `  ⚠ ${dropped.length} exhibit(s) no longer referenced: ${dropped.join(',')}` : '';
    if (old === out) { console.log(`  ${name.padEnd(11)} unchanged${note}`); continue; }
    stale++;
    if (write) { fs.writeFileSync(target, out); console.log(`  ${name.padEnd(11)} written${note}`); }
    else console.log(`  ${name.padEnd(11)} OUT OF SYNC${note}`);
  }
  return stale;
}

const cmd = process.argv[2];
if (cmd === 'pull') { console.log('prose ← arc'); pull(); console.log('✓ pulled, round-trip exact'); }
else if (cmd === 'build') { console.log('arc ← prose'); build(); console.log('✓ built'); }
else if (cmd === 'check') {
  const stale = build({ write: false });
  if (stale) { console.error(`✗ ${stale} arc file(s) do not match _prose/ — run: node scripts/prose.js build`); process.exit(1); }
  console.log('✓ arc matches _prose/');
} else { console.error('usage: prose.js pull|build|check'); process.exit(2); }
