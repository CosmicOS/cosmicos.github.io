#!/usr/bin/env node
/* show-before-POINT audit.  The companion to audit-coins, and the hole it left.
 *
 * audit-coins governs the WORD: a sign must be shown before it is COINED. But it accepts a prior
 * `.sg` ref in running prose as "shown" — so printing the glyph inline is what counts as having
 * shown it, and the FIRST inline glyph of a sign is checked by nothing. Every later one inherits
 * that blessing.
 *
 * That was safe almost everywhere: from §214 on, exhibits are `.row[data-code]`, and the renderer
 * draws each sign in the SAME scrawl the prose uses, so the reader matches glyph to glyph for
 * free. It is NOT safe while the exhibits are `.frag data-view="cups|tones"` — raw wire, not yet
 * segmented into signs. There the prose points in one alphabet at an exhibit drawn in another, and
 * nothing on the page connects them. §207 was found that way, by a reader, not by a gate.
 *
 * THE RULE: a sign's first appearance in prose must sit in an entry that also shows that sign.
 *
 * POINTS AT  = an `.sg[data-s]` inside a `<p>` — running prose.
 * SHOWS      = the same sign drawn in a figure: an `.sg[data-s]` outside any `<p>`, or a
 *              `data-code`/`data-parse`/`data-src` exhibit whose parse contains it.
 * A bare `data-view="cups|tones"` frag shows NEITHER. It is undivided wire, in a different
 * alphabet from the scrawl, and a reader has nothing to match against it.
 *
 * Usage: node scripts/audit-signs.js [--list]      exit 1 on any violation
 */
const fs = require('fs'), path = require('path');
const w = require(path.resolve(__dirname, '../_includes/wire_quotes.json'));
const DIR = path.resolve(__dirname, '../_includes/listener');
const FILES = require('./arc-order');

const contains = (p, s) => Array.isArray(p) ? p.some(x => contains(x, s)) : String(p) === s;
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const SG = /<span class="gl sg"[^>]*data-s="([^"]*)"/g;
const refs = s => [...s.matchAll(SG)].map(x => unesc(x[1]));

// split an entry into its running prose and everything else (the figures)
function split(sec) {
  const paras = sec.match(/<p[ >][\s\S]*?<\/p>/g) || [];
  let rest = sec;
  for (const p of paras) rest = rest.replace(p, '');
  return { prose: paras.join(''), figures: rest };
}

// which signs a chunk of figure-html actually puts on the page
function shows(figures) {
  const signs = new Set(refs(figures));                        // scrawl drawn in the figure
  for (const m of figures.matchAll(/<div [^>]*>/g)) {
    const attrs = m[0];
    const code = (attrs.match(/data-code="(\d+)"/) || [])[1];
    const view = (attrs.match(/data-view="(\w+)"/) || [])[1];
    if (code && w[code] && view !== 'cups' && view !== 'tones') {  // raw wire shows no signs
      // a COMPOUND draws its parts: `tape:make` renders tape's glyphs then a join dot then make's,
      // so a figure carrying the compound is showing the stem. Register every prefix.
      const add = t => { const p = String(t); signs.add(p);
        p.split(':').reduce((a, x) => { const q = a ? a + ':' + x : x; signs.add(q); return q; }, ''); };
      const walk = p => Array.isArray(p) ? p.forEach(walk) : add(p);
      walk(w[code].parse);
    }
    const parse = (attrs.match(/data-(?:parse|src)='([^']*)'/) || [])[1];
    if (parse) for (const t of unesc(parse).match(/[A-Za-z_][\w:*-]*/g) || []) signs.add(t);
  }
  return signs;
}

const seen = new Map();     // sign -> where it was first pointed at
let flags = [];

for (const f of FILES) {
  const src = fs.readFileSync(path.join(DIR, f + '.html'), 'utf8');
  const re = /<div class="entry[^"]*"[^>]*>[\s\S]*?(?=<div class="entry|$)/g;
  let m;
  while ((m = re.exec(src))) {
    const sec = m[0];
    const id = (sec.match(/^<div[^>]*\bid="(p\d+)"/) || [])[1]
            || '§' + ((sec.match(/class="stamp">Pass ([\d]+)/) || [])[1] || '?');
    const { prose, figures } = split(sec);
    const pointed = refs(prose);
    if (!pointed.length) continue;
    const shown = shows(figures);
    for (const sign of pointed) {
      if (seen.has(sign)) continue;
      seen.set(sign, `${f} ${id}`);
      if (!shown.has(sign)) flags.push({ sign, at: `${f} ${id}` });
    }
  }
}

if (process.argv.includes('--list')) {
  console.log(`${seen.size} signs, first pointed at in prose here:`);
  for (const [s, at] of seen) console.log(`    ${flags.some(f => f.sign === s) ? '✗' : ' '} ${s.padEnd(18)} ${at}`);
}
if (flags.length) {
  console.log(`✗ ${flags.length} sign(s) pointed at in prose with no exhibit showing them in the same entry:`);
  flags.forEach(x => console.log(`    ${x.at}  sign=${x.sign}`));
  process.exit(1);
} else {
  console.log(`✓ show-before-point: all ${seen.size} signs are shown in an exhibit where the prose first points at them`);
}
