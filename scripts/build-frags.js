#!/usr/bin/env node
/* build-frags.js — bake message widgets from the REAL wire, not a re-invented encoding.
 *
 * Scans includes for  <div class="msg" ... data-src="SNIPPET" ...>  and fills in
 * data-parse / data-tones / data-glyphs (+ data-value).  Author only data-src; run this.
 *   node scripts/build-frags.js               # scans _includes/listener/*.html
 *   node scripts/build-frags.js <file...>     # explicit files
 *
 * FAITHFULNESS (the whole point — see plans/MESSAGE_TARGET.md):
 *  - A data-src that IS a real statement uses that statement's stored code/spider verbatim.
 *  - A data-src that is a *snippet* is encoded through the SAME wire encoder the build uses
 *    (FourSymbolCodecV2 + the canonical vocab), so a snippet is a true slice of the wire.
 *  - At startup we replay all of msg.json through the reconstructed encoder and assert it
 *    reproduces every stored `code`. If it ever doesn't, we ABORT — that check is exactly what
 *    would have caught the V1/V2 drift immediately instead of hiding it. Never re-invent tones.
 */
'use strict';
const fs = require('fs'), path = require('path');
const LIB = process.env.COSMICOS_LIB ||
  path.resolve(__dirname, '../../cosmicos/build/standard/lib/cosmicos.js');
const C = require(LIB).cosmicos;
const JSDIR = path.resolve(path.dirname(LIB), '../js/src/cosmicos');
const { FourSymbolCodecV2 } = require(path.join(JSDIR, 'FourSymbolCodecV2.js'));
const { GlyphCode } = require(path.join(JSDIR, 'GlyphCode.js'));
const { convert: toBraille } = require('./braille-codepoints.js');
const msg = require(path.resolve(__dirname, '../_data/msg.json'));

// --- reconstruct the exact wire encoder: same vocab setup as CosmicDrive.js, then replay msg in order.
const state = new C.State(); state.useIntVocab();
const ev = new C.Evaluate(state); ev.applyOldOrder(); ev.addStdMin();
const wireVocab = ev.getVocab();
const wireCodec = new FourSymbolCodecV2(wireVocab, true);   // true = int-string mode, as the build uses
const octo = new GlyphCode('octo');

function encodeParse(parse) {                                // parse tree -> wire four-symbol string
  const s = new C.Statement(''); s.content = JSON.parse(JSON.stringify(parse));
  wireCodec.encode(s); return s.content[0];
}

// Replay every transmitted statement IN ORDER: this both populates the canonical vocab and
// proves the reconstruction matches the wire. Index real statements for verbatim reuse.
const byLine = new Map();                                    // normalized source -> statement
const norm = s => s.replace(/;\s*$/, '').replace(/\s+/g, ' ').trim();
(function replayAndVerify() {
  const drift = [];
  for (const st of msg) {
    if ((st.role !== 'code' && st.role !== 'gate') || !st.parse) continue;
    let code; try { code = encodeParse(st.parse); } catch (e) { drift.push(st.lines.join(' ') + ' — ' + e.message); continue; }
    if (st.code && code !== st.code) drift.push(st.lines.join(' ') + '  got ' + code + ' want ' + st.code);
    byLine.set(norm(st.lines.join(' ')), st);
  }
  if (drift.length) {
    console.error('FATAL: reconstructed wire encoder disagrees with _data/msg.json on ' +
      drift.length + ' statement(s). The diary must not render invented tones. First:\n  ' + drift[0]);
    process.exit(1);
  }
})();

// --- snippet helpers (only used when a data-src is NOT a verbatim statement) ---
function parseSnippet(src) {                                 // src -> parse tree (names, not ids)
  const v = new C.Vocab(), st = new C.Statement(src);
  new C.ParseCodec(v).encode(st);
  return st.content.length === 1 ? st.content[0] : st.content;
}
function value(src) {
  const l = console.log, e = console.error; console.log = console.error = () => {};
  try { const s = new C.State(); s.useIntVocab(); const ev2 = new C.Evaluate(s); ev2.applyOldOrder(); ev2.addStdMin();
        return ev2.evaluateLine(src.replace(/;\s*$/, '')); }
  catch (_) { return null; } finally { console.log = l; console.error = e; }
}

const attr = (s, name) => { const m = s.match(new RegExp(name + '="([^"]*)"')); return m ? m[1] : null; };
const setAttr = (s, name, val, quote) => {
  const q = quote || '"', re = new RegExp('\\s*' + name + '=(["\']).*?\\1');
  const piece = ' ' + name + '=' + q + val + q;
  return re.test(s) ? s.replace(re, piece) : s + piece;
};
const dropAttr = (s, name) => s.replace(new RegExp('\\s*' + name + '=(["\']).*?\\1'), '');

// --- literal wire quotes: a `<div class="frag" data-code="…" data-at="tones|cups">` is a copy-pasteable
//     quote of the wire, RENDERED CLIENT-SIDE by listener.js. build-frags only VERIFIES the code occurs in the
//     transmitted wire (so a typo/stale quote errors loudly) and keeps the source clean (label only). ---
const WIRE = msg.filter(s => (s.role === 'code' || s.role === 'gate') && s.code).map(s => s.code).join('');
const BY_CODE = {};                         // code -> {parse, spider} for looking up .msg[data-code] widgets client-side
for (const s of msg) if ((s.role === 'code' || s.role === 'gate') && s.code) BY_CODE[s.code] = { parse: s.parse, spider: s.spider };
const usedCodes = new Set();                // .msg[data-code] widgets collected across all files -> _includes/wire_quotes.json

function buildFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  let real = 0, snip = 0, quote = 0; const errs = [];
  html = html.replace(/<div class="msg"([^>]*)>/g, (m, attrs) => {
    const codeAttr = attr(attrs, 'data-code');
    if (codeAttr) {                                        // CLEAN wire-keyed widget: verify, collect, keep source clean
      if (!WIRE.includes(codeAttr)) { errs.push('msg data-code NOT found in the transmitted wire: ' + codeAttr); return m; }
      if (!BY_CODE[codeAttr]) { errs.push('msg data-code is not a single statement (no parse/spider): ' + codeAttr); return m; }
      usedCodes.add(codeAttr);
      let a = attrs;                                        // strip any baked source/derived attrs; listener.js looks the rest up
      ['data-src', 'data-parse', 'data-tones', 'data-glyphs', 'data-value'].forEach(n => { a = dropAttr(a, n); });
      real++;
      return '<div class="msg"' + a + '>';
    }
    const src = attr(attrs, 'data-src');
    if (!src) return m;
    let a = attrs;
    try {
      const hit = byLine.get(norm(src));
      let parse, tones, glyphs;
      if (hit) {                                             // a real statement -> use the wire's own record
        parse = hit.parse; tones = hit.code; glyphs = hit.spider; real++;
      } else {                                               // a snippet -> a true slice of the wire
        parse = parseSnippet(src); tones = encodeParse(parse); glyphs = octo.addString(tones); snip++;
      }
      a = setAttr(a, 'data-parse', JSON.stringify(parse), "'");
      a = setAttr(a, 'data-tones', tones, '"');
      // GlyphCode.base is 0xf144 in the generator, so a SNIPPET's glyphs come back private-use while
      // a real statement's (hit.spider, out of msg.json) are already braille. Same map, one place.
      a = setAttr(a, 'data-glyphs', toBraille(glyphs).text, '"');
      a = dropAttr(a, 'data-code');                          // no stale competing tone attribute
      const head = Array.isArray(parse) ? parse[0] : null;
      const binding = ['define', '@', 'intro', 'assign', 'make'].indexOf(head) >= 0;
      const val = binding ? null : value(src);
      a = (val !== null && val !== undefined) ? setAttr(a, 'data-value', JSON.stringify(val), "'") : dropAttr(a, 'data-value');
    } catch (e) { errs.push(src + ' — ' + e.message); }
    return '<div class="msg"' + a + '>';
  });
  // literal-wire display exhibits: VERIFY the code is in the wire, strip any baked content, keep source clean
  // (the .flood div has no data-code and is skipped; listener.js renders the real characters at load).
  html = html.replace(/<div class="frag"([^>]*\bdata-code="[^"]*"[^>]*)>([\s\S]*?)<\/div>/g, (m, attrs, inner) => {
    const code = attr(attrs, 'data-code'), view = attr(attrs, 'data-at');
    if (!code || !view) return m;
    if (!WIRE.includes(code)) { errs.push('frag data-code NOT found in the transmitted wire: ' + code); return m; }
    if (view !== 'tones' && view !== 'cups') { errs.push('frag data-at must be tones|cups, got: ' + view); return m; }
    const lbl = (inner.match(/<span class="lbl">[\s\S]*?<\/span>/) || [''])[0];
    quote++;
    return '<div class="frag"' + attrs + '>' + lbl + '</div>';   // clean: label only, no baked spans
  });

  // generated .row[data-code]: a QUOTE of a real statement, rendered in her hand by listener.js. Verify it IS a real
  // transmitted statement and register its parse. (.row[data-parse] = a hypothesis / hand-composed row; not checked here.)
  // class="row" may carry extra classes (a peel rung is `row msg-view`). Matching the attribute
  // EXACTLY meant such a row was silently skipped here and then rendered BLANK on the page, with
  // every gate green — found 08-06 on the closing entry.
  // ★ AND THE SAME BUG A SECOND TIME, 08-08: this insisted the row be EMPTY (`></div>`). Once a
  // generated row could carry a `<span class="lbl">` it stopped matching, its code never reached
  // wire_quotes.json, and it rendered blank — invisible unless that code was used nowhere else in
  // the book, which is why it survived four labelled exhibits before showing. Match the row's
  // CONTENT, not its emptiness. The registration check below is the real guard.
  html = html.replace(/<div class="row[^"]*"([^>]*\bdata-code="[^"]*"[^>]*)>(?:(?!<\/div>)[\s\S])*<\/div>/g, (m, attrs) => {
    const code = attr(attrs, 'data-code');
    if (!BY_CODE[code]) { errs.push('row data-code is not a real transmitted statement: ' + code); return m; }
    usedCodes.add(code); quote++;
    return m;
  });
  fs.writeFileSync(file, html);
  console.log(`${path.basename(file)}: ${real} statement(s) + ${snip} snippet(s) + ${quote} wire-quote(s)` +
    (errs.length ? `\n  ERRORS:\n   ` + errs.join('\n   ') : ''));
  if (errs.length) process.exitCode = 1;   // a bad data-code fails the build (build.sh stops before jekyll)
}

let files = process.argv.slice(2);
if (!files.length) {
  const dir = path.resolve(__dirname, '../_includes/listener');
  files = fs.readdirSync(dir).filter(f => f.endsWith('.html')).map(f => path.join(dir, f));
}
files.forEach(buildFile);

/* The client-side lookup table for .msg[data-code] widgets: code -> {parse, spider}. listener.js reads it via
   window.LISTENER.wire.

   IT LIVES IN _includes/, NOT _data/, AND THAT IS LOAD-BEARING (07-24).  Jekyll parses every _data/*.json
   through safe_yaml/libyaml, which caps a flow-mapping SIMPLE KEY at 1024 characters — and this table is keyed
   by the whole wire code.  So while it sat in _data/, any statement whose code exceeded 1024 chars could not be
   quoted at all: `jekyll build` died with "did not find expected ',' or '}'" naming wire_quotes.json rather than
   the offending statement.  class String (#1550, 1074 chars) was unquotable for that reason alone.  An {% include %}
   is read as TEXT, never YAML-parsed, so the cap is gone and the key length no longer matters.  Do not move this
   back to _data/ for tidiness. */
const table = {};
for (const code of usedCodes) table[code] = BY_CODE[code];
/* ★ EVERY `.row[data-code]` ON THE PAGE MUST BE IN THE BUNDLE IT WILL BE LOOKED UP IN.
   The collector above has now been too narrow TWICE — once by demanding an exact class, once by
   demanding an empty row — and both times the symptom was identical: a row rendering blank on the
   page with every gate green, because `listener.js` resolves `data-code` through wire_quotes.json
   and silently returns when the code is absent. Checking the regex is not the fix; checking the
   RESULT is. Scan the built includes for every row code and fail if one did not make it in. */
{
  const missing = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    for (const m of html.matchAll(/<div class="row[^"]*"[^>]*\bdata-code="([^"]*)"/g))
      if (!table[m[1]]) missing.push(`${path.basename(f)}: ${m[1].slice(0, 40)}…`);
  }
  if (missing.length) {
    console.error(`\n✗ ${missing.length} row data-code(s) never reached wire_quotes.json — these render BLANK:`);
    missing.forEach(x => console.error('    ' + x));
    process.exitCode = 1;
  }
}
fs.writeFileSync(path.resolve(__dirname, '../_includes/wire_quotes.json'), JSON.stringify(table));
console.log(`_includes/wire_quotes.json: ${Object.keys(table).length} entr${Object.keys(table).length === 1 ? 'y' : 'ies'}`);
