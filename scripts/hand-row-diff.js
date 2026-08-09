#!/usr/bin/env node
/* DOES THIS HAND ROW NEED TO BE A HAND ROW?
 *
 * A `.row.hand` is hand-authored HTML. `audit-hands` checks that it DECLARES why it is not a wire
 * quote and that its `data-of` names a real statement — but, in that gate's own words, "it does not
 * prove the drawing is faithful to it. Fidelity is still a reading job." A `.row[data-code]` has no
 * such hole: `build-frags` renders it from `_data/msg.json`, so it cannot depict a statement the
 * message never sent, and it re-draws itself for free when the notation changes. When the lambda-slot
 * hollows were deleted on 08-08 every generated row fixed itself and two hand rows had to be edited
 * by hand; §549's fabricated `▮` survived for months precisely because it sat in a hand row.
 *
 * The renderer already draws each era correctly from position alone — the `tally` merge before §232,
 * the empty cups from §246, the numerals from §267. So a hand row whose whole content is "the
 * statement, in the notation standing here" is a hand-maintained copy of the renderer's own output.
 *
 * THIS MEASURES THAT, rather than assuming it. For every hand row that CLAIMS a statement
 * (notation | undecoded | abridged — `hers` claims none and is left alone), it drops a twin
 * `.row[data-code]` in beside it, renders the real page once, and compares the two drawings.
 *
 *   same      the hand row is a copy of what the renderer produces -> convert it, delete the HTML
 *   differs   the drawing is NOT what the renderer would draw. Either the hand row is wrong, or the
 *             difference is the point (she wrote it her own way and the entry says so). Read it.
 *
 * It perturbs only `_includes/listener/*.html`, which are GENERATED, and restores them with
 * `prose.js build` before it exits.
 *
 *   node scripts/hand-row-diff.js            report the split
 *   node scripts/hand-row-diff.js --list same    just the ids, for conversion
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, '_includes/listener');
const CLAIMS = new Set(['notation', 'undecoded', 'abridged']);
const ROW = /<div class="row hand"([^>]*)>([\s\S]*?)<\/div>/g;

function eachRow(src, fn) {
  return src.replace(ROW, (whole, attrs, inner) => {
    const kind = (attrs.match(/data-hand="([a-z]+)"/) || [])[1];
    const of = (attrs.match(/data-of="([0-9 ]+)"/) || [])[1];
    return fn(whole, attrs, inner, kind, of);
  });
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html'));
const backup = new Map();
let n = 0;
const index = [];                              // probe id -> {file, kind, of, line}
for (const f of files) {
  const p = path.join(DIR, f);
  const src = fs.readFileSync(p, 'utf8');
  backup.set(p, src);
  const out = eachRow(src, (whole, attrs, inner, kind, of) => {
    if (!CLAIMS.has(kind) || !of || /\s/.test(of.trim())) return whole;   // multi-code: not a 1:1 twin
    const id = 'probe' + (n++);
    index.push({ id, file: f, kind, of, html: whole });
    return whole.replace('<div class="row hand"', `<div class="row hand" data-probe="${id}"`)
         + `<div class="row" data-code="${of}" data-twin="${id}"></div>`;
  });
  fs.writeFileSync(p, out);
}
console.log(`probing ${index.length} statement-claiming hand rows…`);

try {
  cp.execSync('bash scripts/render-dom.sh /tmp/handdiff.html', { cwd: ROOT, stdio: 'pipe' });
  const dom = fs.readFileSync('/tmp/handdiff.html', 'utf8');
  /* Strip the row's own furniture before comparing: a `.lbl` ("as I wrote it") and a `.say` gloss are
     the EXHIBIT's labelling, not the drawing, and a twin row never has them. Leaving them in made every
     labelled row look like a divergence. */
  const text = h => h
    .replace(/<span class="(?:lbl|say|peel-say|step)"[\s\S]*?<\/span>/g, '')
    .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const grab = (attr, id) => {
    const m = dom.match(new RegExp(`<div[^>]*${attr}="${id}"[^>]*>([\\s\\S]*?)</div>\\s*(?=<div|</)`));
    return m ? text(m[1]) : null;
  };
  const same = [], differs = [], missing = [];
  for (const r of index) {
    const a = grab('data-probe', r.id), b = grab('data-twin', r.id);
    if (a == null || b == null) { missing.push(r); continue; }
    (a === b ? same : differs).push({ ...r, hand: a, gen: b });
  }
  if (process.argv[2] === '--list') {
    console.log(JSON.stringify((process.argv[3] === 'differs' ? differs : same)
      .map(r => ({ file: r.file, kind: r.kind, of: r.of, html: r.html })), null, 1));
  } else {
    console.log(`\n  SAME    ${same.length}  — the renderer already draws these; convert and delete the HTML`);
    console.log(`  DIFFERS ${differs.length}  — read each one`);
    if (missing.length) console.log(`  ?       ${missing.length}  — probe not found in DOM`);
    const by = {};
    for (const r of same) by[r.file] = (by[r.file] || 0) + 1;
    console.log('\n  same, by keeper:');
    Object.entries(by).forEach(([f, c]) => console.log(`    ${f.padEnd(16)} ${c}`));
    /* WHY it differs, because the answer changes the fix. `tones` and `fragment` are both things the
       renderer could do from msg.json if asked; only `other` needs a human. */
    const cls = r => {
      const t = r.hand.replace(/[\s·]/g, '');
      if (t && /^[\u02e9\u02e8\u02e6\u02e5\u02c9]+$/.test(t)) return 'tones';
      if (r.gen.replace(/\s/g,'').includes(r.hand.replace(/\s/g,'')) && r.hand.length) return 'fragment';
      return 'other';
    };
    const groups = {};
    differs.forEach(r => (groups[cls(r)] = groups[cls(r)] || []).push(r));
    console.log('\n  why they differ:');
    Object.entries(groups).forEach(([k, v]) => console.log(`    ${k.padEnd(9)} ${v.length}`));
    if (process.env.SHOW_OTHER) {
      (groups.other || []).forEach(r => {
        console.log(`\n    §${r.pass}  ${r.kind}`);
        console.log(`      hand: ${r.hand.slice(0, 120)}`);
        console.log(`      gen : ${r.gen.slice(0, 120)}`);
      });
    }
    if (false) {
      differs.slice(0, 20).forEach(r => {
        console.log(`\n    ${r.file}  ${r.kind}  ${r.of.slice(0, 28)}…`);
        console.log(`      hand: ${r.hand.slice(0, 110)}`);
        console.log(`      gen : ${r.gen.slice(0, 110)}`);
      });
    }
  }
} finally {
  for (const [p, src] of backup) fs.writeFileSync(p, src);
  console.log('\n_includes restored.');
}
