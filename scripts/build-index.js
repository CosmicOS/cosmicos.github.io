#!/usr/bin/env node
/* build-index.js — one generated cross-reference for the whole listener lesson, so cross-checking a fact
 * is a lookup, not forensics (Paul, 07-24: "so we don't have to keep doing forensics").
 *
 * WHY THIS EXISTS.  A dozen scripts each re-derive the same maps from _data/msg.json and the includes —
 * code→statement, code→statement-index, sign→scrawl, pass→its stretch of the wire. Every investigation
 * ("where does §511 sit in the message?", "what quotes statement #482?", "which passes show this sign?")
 * rebuilds one of those by hand. This bakes them ONCE, from ground truth, into plans/listener_index.json.
 *
 * GROUND TRUTH IN, DERIVED OUT.  Inputs: _data/msg.json (the wire — the only truth) and _includes/listener/
 * *.html (the diary). Output is regenerable and gitignored (plans/ is gitignored + Jekyll-excluded), so it
 * never churns git and never reaches the built site. Do not hand-edit it; edit this and re-run.
 *
 *   node scripts/build-index.js         # writes plans/listener_index.json
 *
 * SCHEMA (plans/listener_index.json):
 *   statements : { "<seq>": "<source line>" }         # the wire spine, seq 1-based over code+gate statements
 *   byCode     : { "<wire code>": <seq> }             # reverse lookup used everywhere
 *   rows       : [ { file,line,pass,entry,title, kind, value, readback, codes[],indices[],sources[] } ]
 *                                                      # every wire-bearing element in the diary, in doc order
 *   passes     : [ { pass,file,entry,title, rows, kinds{}, idx{min,max,median}, codes[], signsShown[] } ]
 *   signs      : { "<sign>": { scrawl, shownIn:[pass…] } }   # every data-s sign, its scrawl, where shown
 *   coins      : [ { word, sign, file,line,pass } ]          # every coined token (.coin[data-sign])
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, '_includes/listener');
const msg = require(path.join(ROOT, '_data/msg.json'));
const scrawl = require(path.join(ROOT, '_data/sign_scrawl.json'));

// --- the wire spine: seq (1-based over code+gate) -> source; and code -> seq --------------------------
const statements = {};                 // seq -> source line
const byCode = {};                      // code -> seq (first occurrence)
let seq = 0;
for (const s of msg) {
  if ((s.role !== 'code' && s.role !== 'gate') || !s.code) continue;
  seq++; statements[seq] = (s.lines || []).join(' ').replace(/\s+/g, ' ').trim();
  if (!(s.code in byCode)) byCode[s.code] = seq;
}
const codesByLen = Object.keys(byCode).sort((a, b) => b.length - a.length);   // longest-first for greedy split

// A data-of/data-code value names one OR MORE statements: whitespace-separated, and a single token may be
// several statement codes run together. Decompose to the statement seqs (null for an unrecognised remainder).
function decompose(value) {
  const out = [];
  for (const tok of value.split(/\s+/).filter(Boolean)) {
    let r = tok;
    while (r.length) {
      const hit = codesByLen.find(c => r.startsWith(c));
      if (!hit) { out.push(null); break; }
      out.push(byCode[hit]); r = r.slice(hit.length);
    }
  }
  return out;
}

// --- walk the diary in document order -----------------------------------------------------------------
const rows = [];
const signs = {};                       // sign -> {scrawl, shownIn:Set}
const coins = [];
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html')).sort();

for (const file of files) {
  const html = fs.readFileSync(path.join(DIR, file), 'utf8');
  const lines = html.split('\n');
  let pass = null, entry = null, title = null, rbDepth = 0;
  lines.forEach((ln, i) => {
    const line = i + 1;
    const id = ln.match(/class="entry[^"]*" id="p(\d+)"/); if (id) entry = 'p' + id[1];
    const st = ln.match(/class="stamp">Pass ([\d]+)(?:[^<]*)?/); if (st) { pass = +st[1]; title = null; }
    const h2 = ln.match(/<h2>([^<]*)<\/h2>/); if (h2 && title == null) title = h2[1].trim();

    if (/class="readback"/.test(ln)) rbDepth += 1;
    const inReadback = rbDepth > 0;
    if (inReadback) rbDepth += (ln.match(/<div\b/g) || []).length - (ln.match(/<\/div>/g) || []).length
                               - (/class="readback"/.test(ln) ? 1 : 0);
    if (rbDepth < 0) rbDepth = 0;

    // wire-bearing elements: data-code (row/msg/frag) and data-of (hand rows). data-src snippets carry no seq.
    for (const m of ln.matchAll(/data-(code|of)="([0-9 ]+)"/g)) {
      const kindAttr = m[1], value = m[2];
      const indices = decompose(value);
      const kind = kindAttr === 'of' ? 'of'
                 : /class="msg"/.test(ln) ? 'msg' : /class="frag"/.test(ln) ? 'frag' : 'code';
      rows.push({
        file, line, pass, entry, title, kind, value, readback: inReadback,
        codes: value.split(/\s+/).filter(Boolean),
        indices,
        sources: indices.map(x => (x == null ? null : statements[x])),
      });
    }
    // signs shown on the page (the keeper's sign glyphs)
    for (const m of ln.matchAll(/data-s="([^"]+)"/g)) {
      const name = m[1];
      (signs[name] || (signs[name] = { scrawl: scrawl[name] || null, shownIn: new Set() })).shownIn.add(pass);
    }
    // coined tokens
    for (const m of ln.matchAll(/<span class="coin[^"]*" data-sign="([^"]+)">([^<]*)<\/span>/g)) {
      coins.push({ word: m[2], sign: m[1], file, line, pass });
    }
  });
}

// --- per-pass rollups, ordered by pass ----------------------------------------------------------------
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const byPass = new Map();
for (const r of rows) {
  if (r.pass == null) continue;
  const key = r.pass + '|' + r.file;
  const p = byPass.get(key) || { pass: r.pass, file: r.file, entry: r.entry, title: r.title,
    rows: 0, kinds: {}, _idx: [], codes: new Set(), signsShown: new Set() };
  p.rows++; p.kinds[r.kind] = (p.kinds[r.kind] || 0) + 1;
  if (!r.readback) for (const x of r.indices) if (x != null) p._idx.push(x);   // provenance ignores read-backs
  for (const c of r.codes) p.codes.add(c);
  if (!p.title && r.title) p.title = r.title;
  byPass.set(key, p);
}
// attach signsShown per pass
for (const [name, info] of Object.entries(signs)) for (const pass of info.shownIn)
  for (const p of byPass.values()) if (p.pass === pass) p.signsShown.add(name);

const passes = [...byPass.values()].sort((a, b) => a.pass - b.pass).map(p => ({
  pass: p.pass, file: p.file, entry: p.entry, title: p.title, rows: p.rows, kinds: p.kinds,
  idx: p._idx.length ? { min: Math.min(...p._idx), max: Math.max(...p._idx), median: median(p._idx) } : null,
  codes: [...p.codes], signsShown: [...p.signsShown].sort(),
}));

const signsOut = {};
for (const [name, info] of Object.entries(signs))
  signsOut[name] = { scrawl: info.scrawl, shownIn: [...info.shownIn].filter(x => x != null).sort((a, b) => a - b) };

const out = {
  _note: 'GENERATED by scripts/build-index.js — do not hand-edit; regenerate with `node scripts/build-index.js`.',
  _from: { wire: '_data/msg.json', diary: '_includes/listener/*.html' },
  statements, byCode, rows, passes, signs: signsOut, coins,
};
const dest = path.join(ROOT, 'plans/listener_index.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(`plans/listener_index.json: ${Object.keys(statements).length} statements, ${rows.length} wire rows, ` +
            `${passes.length} passes, ${Object.keys(signsOut).length} signs, ${coins.length} coins`);
