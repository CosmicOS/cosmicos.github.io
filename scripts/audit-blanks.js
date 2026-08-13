#!/usr/bin/env node
/* audit-blanks.js — EVERY CONTAINER THE RENDERER FILLS MUST COME BACK WITH MARKS IN IT.
 *
 * NOT audit-drawn.js, which is a different question and was here first: that one asks whether the
 * signs a row draws are signs the wire actually sent there. This one asks whether the row drew at
 * all. One is about invention, the other about absence.
 *
 * The prose ships these containers empty: a `.row[data-code]` in _includes/listener/* is an opening
 * tag, an attribute holding the wire, and a closing tag. js/listener.js puts the marks in at load.
 * So one that comes back with no marks means the renderer walked past it, and that is the failure
 * this gate exists for — listener.js has thrown and blanked every message row about four times,
 * while the page still looked populated, because the prose around the rows is static HTML.
 *
 * WHY NOT A COUNT. render-check.sh asked `scrawl spans > 100` for a book that draws 2420 of them, so
 * 96% of the message could stop rendering and the gate said RENDER OK. Measured, not argued: with
 * all but the first 40 rows blanked it printed "✓ RENDER OK" and "rendered scrawl spans: 605".
 * Raising the floor would not fix the shape of that check — a threshold is a guess about how much
 * loss is too much, it wants re-guessing every time the book grows, and it cannot see a whole arc go
 * dark while the rest of the page clears the bar. There is no number here to maintain: the
 * containers come from the prose and the marks come from the renderer, so the question is total and
 * self-scaling. Blank one row and this fails.
 *
 * AND NOT "IS IT EMPTY", EITHER, which was the first try at this and was worth about 2 rows out of
 * 353. A row that never drew is not empty — the steppers hang a `.simpler` button on every row after
 * the walk is done, so an undrawn row comes back holding a button and nothing else. The chrome is
 * not the content. What is asked here is whether anything the RENDERER makes is in there: a span
 * with a class, any class but `lbl`, which the prose supplies itself.
 *
 * Usage:  node scripts/audit-blanks.js [rendered-dom.html]      (default /tmp/rendered.html)
 * Run by scripts/render-check.sh against the post-JS DOM, since an undrawn container is a fact about
 * what the renderer produced and cannot be decided from the source.
 */
'use strict';
const fs = require('fs');
const domFile = process.argv[2] || '/tmp/rendered.html';
if (!fs.existsSync(domFile)) { console.error(`audit-blanks: no DOM at ${domFile}`); process.exit(2); }
const html = fs.readFileSync(domFile, 'utf8');

/* THE DRAWING HALF OF THE RENDERER'S OWN SELECTOR, kept in step with the walk at js/listener.js:621
   by hand. The other three it matches — `.entry[id]`, `.coin[data-sign]`, `[data-cut]` — annotate an
   element that already has its content and would look undrawn here for good reasons, so they are out.

   THE CLASS IS A TOKEN, NOT A SUBSTRING, and `\bmsg\b` is not the test: a hyphen is a word boundary,
   so that pattern takes `msg-line`, `msg-view` and `msg-index` too and reports 51 `.msg` containers
   where the page has 4. It also cannot be pinned to a tag — a `.frag` is a div when it stands alone
   and a span when it sits in a sentence, and half of them are the second kind. */
const WANT = [
  ['.msg',             'msg',  null],
  ['.row[data-code]',  'row',  'data-code'],
  ['.row[data-parse]', 'row',  'data-parse'],
  ['.frag[data-code]', 'frag', 'data-code'],
  ['.sg[data-s]',      'sg',   'data-s'],
  ['.num[data-n]',     'num',  'data-n'],
  ['.rk[data-n]',      'rk',   'data-n'],
];

/* A ROW MAY HOLD A ROW — a run panel draws its stretch inside one — so the end of a container is
   found by counting its own tag, not by taking the next closing one. */
function inner(tag, from) {
  const re = new RegExp('<(/?)' + tag + '\\b', 'g'); re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(html))) { depth += m[1] ? -1 : 1; if (!depth) return html.slice(from, m.index); }
  return html.slice(from);
}
const drawn = seg => [...seg.matchAll(/<span[^>]*\bclass="([^"]+)"/g)]
  .some(c => c[1].trim().split(/\s+/)[0] !== 'lbl');

/* the nearest anchor above it, so a failure names a place to go and look */
function anchorAt(i) {
  const at = html.lastIndexOf('id="p', i);
  return at < 0 ? '?' : html.slice(at + 4, html.indexOf('"', at + 4));
}

const count = WANT.map(() => 0), missed = WANT.map(() => 0);
for (const m of html.matchAll(/<([a-z]+)\s[^>]*class="([^"]*)"[^>]*>/g)) {
  const toks = m[2].trim().split(/\s+/);
  for (let i = 0; i < WANT.length; i++) {
    const [name, cls, attr] = WANT[i];
    if (!toks.includes(cls)) continue;
    if (attr && !new RegExp('\\s' + attr + '=').test(m[0])) continue;
    count[i]++;
    if (!drawn(inner(m[1], m.index + m[0].length))) {
      if (++missed[i] <= 3) console.error(`    undrawn ${name} at or after #${anchorAt(m.index)}`);
    }
  }
}
const total = count.reduce((a, b) => a + b, 0), bare = missed.reduce((a, b) => a + b, 0);
const tally = WANT.map(([name], i) => `${name} ${count[i] - missed[i]}/${count[i]}`);

console.log(`  drawn: ${tally.join('   ')}`);
if (bare) {
  console.error(`✗ ${bare} of ${total} containers came back with no marks in them — the renderer did not draw them`);
  process.exit(1);
}
console.log(`  ✓ all ${total} containers the renderer fills came back drawn`);
