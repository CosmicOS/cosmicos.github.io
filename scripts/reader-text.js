#!/usr/bin/env node
/* reader-text — dump the diary as a reviewer can actually read it.
 *
 * The signs on the page are rendered by JS into private-use codepoints (U+E000–U+F8FF) drawn with the
 * project's scrawl font.  Anywhere outside that font — a text file, a subagent, an email — they arrive as
 * blanks, so sentences turn up with holes in them and whole entries become unreadable.  A blind reviewer on
 * 07-31 had to dump codepoints by hand and invent its own labels before it could review §214–228 at all.
 *
 * So: map each distinct sign to a stable BRAILLE cell (U+2800 block).  256 of them, they render in every
 * font, they are visibly distinct from each other, and — this is the point — they carry no meaning. A
 * reviewer can track "this same mark recurs here and here" without being handed the sender's own name for
 * it, which would tell them what the keeper is still in the middle of working out.
 *
 * DO NOT substitute `data-s` values.  `unary`, `is:int`, `is:square` are the sender's names; putting them in
 * a review text leaks the answer to the thing under review.
 *
 * Usage:  scripts/render-check.sh          (writes /tmp/rendered.html)
 *         node scripts/reader-text.js [out.txt]
 */
const fs = require('fs');
const SRC = '/tmp/rendered.html';
if (!fs.existsSync(SRC)) { console.error(`no ${SRC} — run scripts/render-check.sh first`); process.exit(1); }
let html = fs.readFileSync(SRC, 'utf8');

const body = html.slice(html.indexOf('<div class="diary"') >= 0 ? html.indexOf('<div class="diary"') : 0);

// keep labels off the data they label, and keep entries apart
let t = body
  .replace(/<div class="stamp">/g, '\n\n@@@')
  .replace(/<h2>/g, '\n@@')
  .replace(/<\/(p|div|figure|li|h2)>/g, '\n')
  .replace(/<span class="lbl">([\s\S]*?)<\/span>/g, '[$1] ')
  .replace(/<div class="(more-note|cp-label|cp-item|rb-label|rb-note|peel-say|tu-k)">/g, '  · ')
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
  .replace(/<a class="anchor"[\s\S]*?<\/a>/g, '')
  .replace(/<[^>]+>/g, '');

t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
     .replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&mdash;/g, '—');

// stable braille for each distinct sign, in order of first appearance
const seen = new Map();
t = [...t].map(c => {
  const n = c.codePointAt(0);
  if (n < 0xE000 || n > 0xF8FF) return c;
  if (!seen.has(c)) seen.set(c, String.fromCodePoint(0x2801 + seen.size));
  return seen.get(c);
}).join('');

t = t.replace(/#(?=\n)/g, '')            // strip the heading anchor glyph
     .replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').replace(/@@@/g, '').replace(/@@/g, '');

/* NO LEGEND.  An earlier version appended one — "these N cells are distinct recurring marks, no meanings
 * given".  That is a tell: it announces the text as a constructed test artifact with substitutions and
 * deliberate withholding, which primes a blind reader to look for the trick instead of reading.  A reader on
 * the page gets no legend either; the marks are just marks.  Report the count on stderr, not in the file. */
const out = t.trimStart() + '\n';

const dest = process.argv[2] || '/tmp/reader-text.txt';
fs.writeFileSync(dest, out);
console.log(`${dest}: ${out.split(/\s+/).length} words · ${seen.size} distinct signs mapped to braille`);
