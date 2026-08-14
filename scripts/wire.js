#!/usr/bin/env node
/* wire.js — the two derivations every script here keeps re-answering, in one place.
 *
 *   spine      order every transmitted statement (`code` + `gate`, 1-based) and map a code back to
 *              its place. `decompose()` splits a data-code/data-of value into those places.
 *   scanDiary  walk `_includes/listener/*.html` in document order for every wire-bearing element,
 *              with the pass/entry it sits in, plus signs and coined words.
 *   runsByEntry  the stretch of the message an entry sits in (see the note above it).
 *
 * Used by build-index.js and build-runs.js. NOT by audit-provenance.js, on purpose: that gate exists
 * to catch a quote sitting in the wrong pass, and a gate sharing its derivation with what it checks
 * catches half of what it is for.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const STAMP = require('./stamp');

// ── THE SPINE ────────────────────────────────────────────────────────────────────────────────────
const msg = require(path.join(ROOT, '_data/msg.json'));
const statements = {};                  // seq -> the author's own source line(s), flattened
const parses = {};                      // seq -> the parse tree (what the page renders from)
const codes = {};                       // seq -> its wire code. NOT the inverse of byCode: that keeps
                                        // only a code's FIRST place, so every later repeat of an
                                        // identical statement would come back with no code at all.
const byCode = {};                      // code -> seq (first occurrence)
/* seq -> the stanza it is in message.html, which is `id="line-<stanza>"` there. NOT seq plus a
   constant: message.html numbers every stanza, and the prose, comments and file markers between the
   statements push the two apart from 3 at the opening to 215 by the end. */
const stanzas = {};
let seq = 0;
for (const s of msg) {
  if ((s.role !== 'code' && s.role !== 'gate') || !s.code) continue;
  seq++;
  statements[seq] = (s.lines || []).join(' ').replace(/\s+/g, ' ').trim();
  parses[seq] = s.parse;
  codes[seq] = s.code;
  stanzas[seq] = s.stanza;
  if (!(s.code in byCode)) byCode[s.code] = seq;
}
const codesByLen = Object.keys(byCode).sort((a, b) => b.length - a.length);   // longest-first for greedy split

/* A data-of/data-code value names one OR MORE statements: whitespace-separated, and a single token
   may be several statement codes run together. Decompose to the statement seqs (null for a remainder
   that is not in the wire at all — never silently dropped). */
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

// ── THE DIARY SCAN ───────────────────────────────────────────────────────────────────────────────
/* Returns { rows, signs, coins } over `_includes/listener/*.html` in document order.
     rows  : [ {file,line,pass,entry,title, kind, value, readback, codes[], indices[]} ]
     signs : { "<sign>": Set(pass) }        — every `data-s` sign and the passes it is shown in
     coins : [ {word, sign, file, line, pass} ]
   `entry` is the `id` of the `.entry` the row sits in, which is unique across the whole book and is
   what the page anchors on; `pass` is the number in its stamp. */
function scanDiary(dir) {
  dir = dir || path.join(ROOT, '_includes/listener');
  const rows = [], signs = {}, coins = [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort();

  for (const file of files) {
    const html = fs.readFileSync(path.join(dir, file), 'utf8');
    const lines = html.split('\n');
    let pass = null, entry = null, title = null, rbDepth = 0;
    lines.forEach((ln, i) => {
      const line = i + 1;
      const id = ln.match(/class="entry[^"]*" id="p(\d+)"/); if (id) entry = 'p' + id[1];
      const st = ln.match(STAMP.PASS); if (st) { pass = +st[1]; title = null; }
      const h2 = ln.match(/<h2>([^<]*)<\/h2>/); if (h2 && title == null) title = h2[1].trim();

      if (/class="readback"/.test(ln)) rbDepth += 1;
      const inReadback = rbDepth > 0;
      if (inReadback) rbDepth += (ln.match(/<div\b/g) || []).length - (ln.match(/<\/div>/g) || []).length
                                 - (/class="readback"/.test(ln) ? 1 : 0);
      if (rbDepth < 0) rbDepth = 0;

      // wire-bearing elements: data-code (row/msg/frag) and data-of (hand rows). data-src snippets carry no seq.
      for (const m of ln.matchAll(/data-(code|of)="([0-9 ]+)"/g)) {
        const kindAttr = m[1], value = m[2];
        const kind = kindAttr === 'of' ? 'of'
                   : /class="msg"/.test(ln) ? 'msg' : /class="frag"/.test(ln) ? 'frag' : 'code';
        rows.push({
          file, line, pass, entry, title, kind, value, readback: inReadback,
          codes: value.split(/\s+/).filter(Boolean),
          indices: decompose(value),
        });
      }
      // signs shown on the page (the keeper's sign glyphs)
      for (const m of ln.matchAll(/data-s="([^"]+)"/g))
        (signs[m[1]] || (signs[m[1]] = new Set())).add(pass);
      // coined tokens
      for (const m of ln.matchAll(/<span class="coin[^"]*" data-sign="([^"]+)"[^>]*>([^<]*)<\/span>/g))
        coins.push({ word: m[2], sign: m[1], file, line, pass });
    });
  }
  return { rows, signs, coins };
}

/* ── THE RUN A PASS SITS IN ──────────────────────────────────────────────────────────────────────
   An entry quotes a handful of sayings; they sit in ONE stretch of the message, and that stretch is
   mostly statements the entry never shows. This is the derivation of that stretch, and it is the
   whole basis of the page's "the whole run" panels, so it says its terms out loud:

     - Take the entry's own quoted statement places. THE ENTRY'S OWN — nothing here is assigned, and
       no statement is claimed for a pass by a rule of mine. The run is bounded by what the keeper
       actually put on her page; everything the panel adds sits BETWEEN two things she quoted.
     - Drop read-backs. A read-back deliberately re-shows an old sign, so it is not evidence about
       where this pass sits — the same exemption `audit-provenance.js` makes, for the same reason.
     - Drop quotes further than TOL from the median. Two things land here: the RING WRAP (§595 and
       §622 quote the message's first line, which is genuinely on the wire that night because the
       message has come round again) and the occasional deliberate reach back to an old statement.
       Either would stretch the run across a thousand sayings the pass has nothing to do with.
     - The run is then [min, max] of what is left. A pass quoting one statement has a run of one, and
       its panel draws that one row: the control is on every entry that has a run at all, so that
       finding nothing new in it is a reading and not a missing button (scripts/build-runs.js).

   TOL is `audit-provenance.js`'s number and means the same thing there and here — how far from its
   pass's place a quote can sit before it is something other than local interleave. */
const TOL = 150;
function runsByEntry(rows) {
  const by = new Map();
  for (const r of rows) {
    if (r.readback || !r.entry) continue;
    const a = by.get(r.entry) || { entry: r.entry, pass: r.pass, at: [] };
    for (const i of r.indices) if (i != null) a.at.push(i);
    by.set(r.entry, a);
  }
  const out = [];
  for (const e of by.values()) {
    if (!e.at.length) continue;
    const sorted = [...e.at].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const keep = sorted.filter(x => Math.abs(x - med) <= TOL);
    if (!keep.length) continue;
    out.push({
      entry: e.entry, pass: e.pass,
      lo: keep[0], hi: keep[keep.length - 1],
      shown: [...new Set(keep)].sort((a, b) => a - b),
    });
  }
  return out.sort((a, b) => a.pass - b.pass);
}

module.exports = { msg, statements, parses, codes, stanzas, byCode, count: seq, decompose, scanDiary, runsByEntry, TOL };
