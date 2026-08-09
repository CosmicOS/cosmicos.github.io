#!/usr/bin/env node
/* para-review.js — walk EVERY paragraph of the book, one at a time, and record a verdict on each.
 *
 * ★ WHY THIS EXISTS, and it is the same reason `blind-read.sh` exists.
 *
 * Pointed at one paragraph, I can usually see what is wrong with it and fix it. Left to choose my own
 * targets I do not traverse — I search. I run a density measure, or grep for a pattern, or read the
 * chunks I already suspect, and then I report having "read" a keeper when what I opened was two
 * contiguous ranges out of five. Every pass over this book has ended that way, and the failure is not
 * carelessness: finding candidates FEELS like the work, converges quickly, and produces a confident
 * summary. Traversal feels like nothing and takes sixty turns.
 *
 * So the discipline goes in the script, exactly as it did for the blind read. **This decides what I
 * look at next; I do not.** A paragraph is not reviewed until a verdict is recorded against its id,
 * and `--status` prints what is still unvisited, so "I have been through it" is checkable instead of
 * remembered.
 *
 *   node scripts/para-review.js --status              how far in, what is left
 *   node scripts/para-review.js --next [n]            the next n unreviewed, IN ORDER, with context
 *   node scripts/para-review.js --show <id>           one paragraph again, with its neighbours
 *   node scripts/para-review.js --verdict <id> ok|fix "why"
 *   node scripts/para-review.js --list fix            everything marked for fixing
 *
 * Paragraphs come from `_prose/*.html` in `scripts/arc-order.js` order — the source, not the render,
 * because this reviews WORDS. (Anything about how a figure comes out on the page is a `read.js` job.)
 * Each paragraph is shown with what sits immediately before and after it, marked `[EXHIBIT]` where an
 * exhibit does — you cannot judge whether prose is carrying evidence that belongs in an exhibit
 * without knowing whether an exhibit is standing right there.
 *
 * WHAT TO ASK OF EACH ONE — the four ways a paragraph in this book gets hard, all found the slow way:
 *   1. It carries an exhibit's job: it DESCRIBES evidence instead of showing it.
 *   2. Near-synonyms, several jobs each — cup/cut/shut/lid/run/piece — so word-shape stops helping.
 *   3. It grades its own demonstration: the work lands, then a sentence says what it proved.
 *      Test: does the sentence cost the speaker something, drive an action, or get spent later?
 *   4. It cites an earlier entry compressed — a past claim, its exception and its role in one
 *      sentence, none of it loaded in the reader.
 * See plans/README.md items 2b and 3c. **The list is a prompt, not a checklist: read the paragraph.**
 *
 * State lives in plans/para-review.json (gitignored). Verdicts are cheap; write one for every
 * paragraph, including "ok". A silent skip is indistinguishable from a paragraph nobody opened.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const STATE = path.join(ROOT, 'plans/para-review.json');

function order() {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/arc-order.js'), 'utf8');
  const out = [];
  for (const m of src.matchAll(/'(k\d+-[a-z]+)'/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/* Every paragraph, in reading order, each with the block before and after it. A paragraph is
   identified by keeper+pass+ordinal, NOT by a running number — insert one paragraph anywhere and a
   running number renumbers the whole book, silently invalidating every verdict after it. */
function collect() {
  const items = [];
  for (const k of order()) {
    const f = path.join(ROOT, '_prose', k + '.html');
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    let pass = '?', nth = 0;
    /* A DISPATCH CARRIES NO id="pNNN" — its pass number lives only in the stamp. Match both, or every
       dispatch paragraph is filed under the previous entry and the ids lie about where they are.
       The container list below is the real one, taken by enumerating `<div class=` across _prose;
       a missing class shows up as a paragraph ending in a colon whose `after` says "paragraph",
       which is how `sheets` (§193's two-pen comparison) was caught. Re-enumerate if a block is
       added. */
    const re = /id="p(\d+)"|<span class="pf-k">Pass<\/span>\s*(\d+)|<p>([\s\S]*?)<\/p>|\{\{EX:([a-z0-9-]+)\}\}|<div class="(rows|readback|peel|tally|letter|later|board|fold|sheets|binstack|engine|register|gauge|cap|seekmap-bar|hd)/g;
    let m, prev = null;
    while ((m = re.exec(src))) {
      if (m[1] || m[2]) { const np = m[1] || m[2]; if (np !== pass) { pass = np; nth = 0; } continue; }
      if (m[4] || m[5]) { prev = '[EXHIBIT' + (m[4] ? ' ' + m[4] : ' ' + m[5]) + ']'; continue; }
      /* A SIGN SPAN IS EMPTY IN THE SOURCE — the renderer fills it. Strip tags naively and every
         sentence built around a sign loses its subject: §528 read "…still be two. is what lets a made
         thing be this one", which looks like a dropped word and is not. Put the sign's name back as
         ⟨name⟩ so the sentence can be judged; a `.coin` already contains its word, so it needs nothing. */
      const text = m[3]
        .replace(/<span class="gl sg" data-s="([^"]+)"><\/span>/g, '⟨$1⟩')
        .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      items.push({ id: `${k}:${pass}:${++nth}`, keeper: k, pass, text, before: prev });
      prev = 'paragraph';
    }
    // second pass: fill in what follows each paragraph
    for (let i = 0; i < items.length - 1; i++)
      if (items[i].keeper === k) items[i].after = items[i + 1] && items[i + 1].keeper === k
        ? (items[i + 1].before === 'paragraph' ? 'paragraph' : items[i + 1].before) : '(end of entry)';
  }
  // `after` for a paragraph is whatever `before` the NEXT one saw
  for (let i = 0; i < items.length; i++)
    items[i].after = (items[i + 1] && items[i + 1].keeper === items[i].keeper)
      ? items[i + 1].before : '(end)';
  return items;
}

const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 1) + '\n');

const args = process.argv.slice(2);
const items = collect();
const done = items.filter(i => state[i.id]);
const left = items.filter(i => !state[i.id]);

function print(i) {
  console.log(`\n── ${i.id}  (${i.keeper} §${i.pass})`);
  console.log(`   before: ${i.before || '(entry opens)'}   after: ${i.after}`);
  console.log(`   ${i.text}`);
}

if (args.includes('--status') || !args.length) {
  const fix = Object.values(state).filter(v => v.verdict === 'fix').length;
  console.log(`paragraphs ${done.length}/${items.length} reviewed · ${fix} marked fix · ${left.length} left`);
  const byK = {};
  for (const i of items) { byK[i.keeper] = byK[i.keeper] || [0, 0]; byK[i.keeper][1]++; if (state[i.id]) byK[i.keeper][0]++; }
  for (const k of Object.keys(byK)) console.log(`  ${k.padEnd(12)} ${byK[k][0]}/${byK[k][1]}`);
  if (left.length) console.log(`\nnext: ${left[0].id}`);
  process.exit(0);
}
if (args[0] === '--next') { left.slice(0, parseInt(args[1], 10) || 8).forEach(print); process.exit(0); }
if (args[0] === '--show') { const i = items.find(x => x.id === args[1]); i ? print(i) : console.error('no such id'); process.exit(i ? 0 : 2); }
if (args[0] === '--list') {
  items.filter(i => state[i.id] && state[i.id].verdict === (args[1] || 'fix'))
       .forEach(i => console.log(`${i.id}  ${state[i.id].note}\n   ${i.text.slice(0, 120)}…`));
  process.exit(0);
}
if (args[0] === '--verdict') {
  const [, id, verdict, ...rest] = args;
  if (!items.find(x => x.id === id)) { console.error('no such paragraph: ' + id); process.exit(2); }
  if (!['ok', 'fix'].includes(verdict)) { console.error('verdict must be ok or fix'); process.exit(2); }
  state[id] = { verdict, note: rest.join(' ') };
  save(); console.log(`${id} → ${verdict}`);
  process.exit(0);
}
console.error('see the header for usage');
process.exit(2);
