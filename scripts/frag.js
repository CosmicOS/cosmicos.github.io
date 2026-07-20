#!/usr/bin/env node
/* frag.js — turn a CosmicOS source snippet into faithful {src, parse, tones, value}
 * using the project's OWN codecs/evaluator (never hand-rolled).
 *   node scripts/frag.js "and $x | not $y"        # one snippet -> JSON
 *   node scripts/frag.js < snippets.txt           # one per line -> JSON array
 * parse/tones are always reliable; value is null for message-defined symbols
 * (e.g. `unless`) until their defs are loaded — primitives (+ * = and not if…) evaluate.
 */
'use strict';
const path = require('path');
const LIB = process.env.COSMICOS_LIB ||
  path.resolve(__dirname, '../../cosmicos/build/standard/lib/cosmicos.js');
const C = require(LIB).cosmicos;

function parse(src) {
  const v = new C.Vocab(), st = new C.Statement(src);
  new C.ParseCodec(v).encode(st);
  return st.content.length === 1 ? st.content[0] : st.content;
}
function tones(src) {
  const v = new C.Vocab(), st = new C.Statement(src);
  new C.ChainCodec([new C.ParseCodec(v), new C.NormalizeCodec(v), new C.FourSymbolCodec(v)]).encode(st);
  return st.content[0];
}
function mkEval() {
  const s = new C.State(); s.useIntVocab();
  const e = new C.Evaluate(s); e.applyOldOrder(); e.addStdMin(); return e;
}
function value(src) {
  const log = console.log, err = console.error;   // the lib prints diagnostics; keep stdout clean
  console.log = console.error = () => {};
  try { return mkEval().evaluateLine(src.replace(/;\s*$/, '')); }
  catch (e) { return null; }
  finally { console.log = log; console.error = err; }
}
function frag(src) {
  src = src.trim();
  return { src, parse: parse(src), tones: tones(src), value: value(src) };
}

const args = process.argv.slice(2);
if (args.length) {
  console.log(JSON.stringify(frag(args.join(' ')), null, 2));
} else {
  const lines = require('fs').readFileSync(0, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
  console.log(JSON.stringify(lines.map(frag), null, 2));
}
