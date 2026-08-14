#!/usr/bin/env node
/* check.js — evaluate expressions IN THE MESSAGE'S OWN CONTEXT (all defs loaded).
 * Settles a hand-authored truth-table or a piece of arithmetic against real semantics.
 *   node scripts/check.js "unless $true $false"
 *   node scripts/check.js < exprs.txt          # one per line
 *
 * A TOOL, NOT A GATE, which is why verify.sh does not run it: it answers what you ask, and there is
 * no stored set of expressions with expected values for it to regress against. It also needs the
 * evaluator from the SIBLING cosmicos checkout, which this repo does not contain — so it could not
 * run in a clean clone or in CI even if there were.
 */
'use strict';
const path = require('path'), fs = require('fs');
const LIB = process.env.COSMICOS_LIB || path.resolve(__dirname, '../../cosmicos/build/standard/lib/cosmicos.js');
let C;
try {
  C = require(LIB).cosmicos;
} catch (e) {
  console.error('check.js needs the evaluator from the cosmicos repo, and did not find it at:\n  ' + LIB +
                '\nBuild it there (npm run build), or point COSMICOS_LIB at build/standard/lib/cosmicos.js.');
  process.exit(2);
}
const msg = require(path.resolve(__dirname, '../_data/msg.json'));
const _l = console.log, _e = console.error;
const mute = () => { console.log = console.error = () => {}; };
const un   = () => { console.log = _l; console.error = _e; };

function makeEvaluator() {
  const s = new C.State(); s.useIntVocab();
  const e = new C.Evaluate(s); e.applyOldOrder(); e.addStdMin();
  mute();
  for (const st of msg) { if (st.role !== 'code') continue;
    try { e.evaluateLine(st.lines.join(' ').replace(/;\s*$/, '')); } catch (_) {} }
  un();
  return e;
}
const norm = v => (v === 1 ? true : v === 0 ? false : v);   // evaluator returns 1/0 for some booleans
const E = makeEvaluator();
function check(src) { mute(); let v; try { v = norm(E.evaluateLine(src.replace(/;\s*$/, ''))); }
  catch (x) { v = 'ERR:' + x.message; } un(); return v; }

const args = process.argv.slice(2);
const exprs = args.length ? [args.join(' ')]
  : fs.readFileSync(0, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
for (const s of exprs) console.log(String(JSON.stringify(check(s))).padEnd(8), ' ', s);
