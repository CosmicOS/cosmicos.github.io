#!/usr/bin/env node
/* check.js — evaluate expressions IN THE MESSAGE'S OWN CONTEXT (all defs loaded).
 * Regression-checks hand-authored truth-tables / arithmetic against real semantics.
 *   node scripts/check.js "unless $true $false"
 *   node scripts/check.js < exprs.txt          # one per line
 */
'use strict';
const path = require('path'), fs = require('fs');
const LIB = process.env.COSMICOS_LIB || path.resolve(__dirname, '../../cosmicos/build/standard/lib/cosmicos.js');
const C = require(LIB).cosmicos;
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
