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
 *   _prose/<keeper>.html         the keeper's words, with {{EX:name}} where an exhibit goes.  <- EDIT THIS
 *   _prose/<keeper>.blocks.json  the exhibit blocks, verbatim, keyed by name.                <- generated
 *
 * Exhibits are referenced BY NAME, not by position, so inserting one is a one-line job: add the
 * block under an unused key and put `{{EX:thatkey}}` where it goes. Nothing else moves. (Names also
 * remove a real hazard: with positional `{{EX:7}}` markers, transposing two of them silently
 * swapped two exhibits and no gate could see it.)
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

/* WHERE THE TAG NAMES COME FROM.  Exhibits used to be referenced by position — `{{EX:7}}` meant
 * "the eighth element of the array".  That made inserting an exhibit a renumbering job across the
 * whole file, which is both fiddly and a live correctness risk: `splice` looks blocks up BY INDEX,
 * so transposing two markers silently swaps two exhibits and every gate stays green.  It also put a
 * standing tax on the one thing this project most wants to be cheap — adding more of the message to
 * the page.  Names are looked up, so a new exhibit just needs an unused name and nothing else moves.
 *
 * ★ A NAME SAYS WHAT THE EXHIBIT SHOWS — `define-cons`, `fibonacci`, `vessel-readback`.  Anchor it to
 * the content, because the content is the durable thing.  Everything else about an exhibit moves:
 * its position moves when one is inserted, and its PASS NUMBER moves too — the pass numbers were
 * invented casually by an early session and are expected to be re-evaluated, so a name built on one
 * buys a rewrite of every marker in the book on the day they change.  What an exhibit is showing
 * does not move.  The file already says which keeper it is, so the name does not repeat that.
 *
 * `pull` mints a default from the block's first wire statement, which is usually right and is always
 * safe to improve — RENAME FREELY: change the key and its `{{EX:…}}` marker together and the gates
 * will confirm it.  A better name is a real improvement to the file, not churn.
 *
 * ★ THESE ARE NOT NUMBERED AND MUST NEVER BE RENUMBERED.  There is no ordering, contiguity or
 * gap-free requirement.  To add an exhibit: pick an unused name, add the block, put `{{EX:name}}`
 * where it goes.  Nothing else moves.  `pull` keeps existing names (matched on exact content) and
 * mints only for genuinely new blocks, so a re-import never renames underneath you. */
const MSG = path.join(ROOT, '_data/msg.json');
let _byCode = null;
const sourceOf = code => {
  if (!_byCode) {
    _byCode = new Map();
    for (const e of JSON.parse(fs.readFileSync(MSG, 'utf8'))) if (e.code && e.lines) _byCode.set(e.code, e.lines[0]);
  }
  return _byCode.get(code) || '';
};

/* Words that say nothing about WHICH exhibit this is — operators, plumbing, and the demo scaffolding
 * the sender wraps almost everything in. */
const NOISE = new Set(['define', 'intro', 'assign', 'let', 'if', 'not', 'begin', 'lambda', 'vector',
  'list', 'demo', 'test', 'x', 'y', 'z', 'n', 'ret', 'true', 'false', 'e']);

function mintName(body) {
  const kind = (body.match(/class="([a-z][a-z:-]*)/) || [, ''])[1].split(' ')[0];
  const code = (body.match(/data-(?:code|of)="([0-9]+)"/) || [])[1];
  let stem = '';
  if (code) {
    const words = sourceOf(code)
      .replace(/[$|(){};,]/g, ' ')
      .split(/[\s:]+/)                                   // `demo:make-cell:x` is three words, not one
      .map(w => w.replace(/[^a-z0-9-]/gi, '').toLowerCase())
      .filter(w => w && !/^\d+$/.test(w) && !NOISE.has(w))
      .filter((w, i, a) => w !== a[i - 1]);               // `make-cell make-cell` says it once
    stem = [...new Set(words)].slice(0, 2).join('-');
  }
  if (!stem) stem = kind === 'rows' ? 'rows' : (kind || 'exhibit');
  if (kind === 'readback' || kind === 'copied') stem = stem === kind ? kind : `${stem}-${kind}`;
  return stem.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'exhibit';
}

function extract(src, prior = null) {
  const marks = [];
  for (const { re, tag } of OPEN) { re.lastIndex = 0; let m; while ((m = re.exec(src))) marks.push({ i: m.index, tag }); }
  for (const re of VOID) { re.lastIndex = 0; let m; while ((m = re.exec(src))) marks.push({ i: m.index, tag: null, len: m[0].length }); }
  marks.sort((a, b) => a.i - b.i);

  const used = new Set();
  /* content -> [names it had last time], consumed in order so repeated content stays stable */
  const kept = new Map();
  if (prior) for (const [k, v] of Object.entries(prior)) {
    if (!kept.has(v)) kept.set(v, []);
    kept.get(v).push(k);
  }

  const blocks = {}; let out = '', cur = 0;
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
    const body = src.slice(mk.i, end);
    let name = null;
    const reuse = kept.get(body);
    while (reuse && reuse.length && name === null) { const c = reuse.shift(); if (!used.has(c)) name = c; }
    if (name === null) {
      const stem = mintName(body);
      name = stem;
      for (let k = 2; used.has(name); k++) name = `${stem}-${k}`;   // same subject shown twice
    }
    used.add(name);
    out += src.slice(cur, mk.i) + `{{EX:${name}}}`;
    blocks[name] = body;
    cur = end;
  }
  return { shell: out + src.slice(cur), blocks };
}

const splice = (shell, blocks) => shell.replace(/\{\{EX:([^}]+)\}\}/g, (_, n) => {
  if (blocks[n] === undefined) throw new Error(`{{EX:${n}}} has no block`);
  return blocks[n];
});

function pull() {
  fs.mkdirSync(PROSE, { recursive: true });
  for (const name of ORDER) {
    const src = fs.readFileSync(path.join(ARC, name + '.html'), 'utf8');
    const bf = path.join(PROSE, name + '.blocks.json');
    let prior = null;
    if (fs.existsSync(bf)) { const p = JSON.parse(fs.readFileSync(bf, 'utf8')); if (!Array.isArray(p)) prior = p; }
    const { shell, blocks } = extract(src, prior);
    if (splice(shell, blocks) !== src) throw new Error(`round-trip FAILED for ${name} — refusing to write`);
    fs.writeFileSync(path.join(PROSE, name + '.html'), shell);
    fs.writeFileSync(bf, JSON.stringify(blocks, null, 1));
    const words = shell.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    console.log(`  ${name.padEnd(11)} ${String(Object.keys(blocks).length).padStart(2)} exhibits · ${words} words of prose`);
  }
}

function render(name) {
  const shell = fs.readFileSync(path.join(PROSE, name + '.html'), 'utf8');
  const blocks = JSON.parse(fs.readFileSync(path.join(PROSE, name + '.blocks.json'), 'utf8'));
  const out = splice(shell, blocks);
  const used = new Set([...shell.matchAll(/\{\{EX:([^}]+)\}\}/g)].map(m => m[1]));
  const dropped = Object.keys(blocks).filter(k => !used.has(k));
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
