#!/usr/bin/env node
/* reader-text — dump the diary as a reviewer can actually read it.
 *
 * The signs used to be private-use codepoints (U+E000–U+F8FF) drawn with the project's scrawl font, and
 * anywhere outside that font — a text file, a subagent, an email — they arrived as blanks, so sentences
 * turned up with holes in them and whole entries were unreadable.  A blind reviewer on 07-31 had to dump
 * codepoints by hand and invent its own labels before it could review §214–228 at all.
 *
 * This script's answer was to substitute a stable braille cell for each distinct sign.  Since 08-07 it
 * does not have to: THE PAGE ITSELF EMITS BRAILLE (see scripts/braille-codepoints.js — the font carries a
 * braille codepoint per glyph, and the data uses it).  The substitution loop is gone.  What a reviewer
 * gets now is the real character off the page, which is better than a stand-in in two ways: it survives a
 * copy back out of the review, and it is the same cell in every document instead of being numbered by
 * order of first appearance in this one.
 *
 * The property that mattered is kept for free — a braille cell carries no meaning to a reviewer.  It can
 * be told apart from its neighbours and tracked across a read; it does not hand over the sender's name for
 * the thing, which would leak what the keeper is still in the middle of working out.
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
  /* A FOLD'S LINE BREAKS ARE ITS CONTENT. `data-fold` renders a nested statement as indented
   * lines — §501's rule table is "a small table with nothing in it but lines of one shape", and the
   * shape is only visible because it breaks. Stripping the <br> collapsed it to one unbroken wall,
   * so a blind reviewer would have judged a figure the page does not show (08-01). Indentation is
   * carried by margin-left on a span, which no text dump can see, so the break alone must survive. */
  .replace(/<div class="stamp">/g, '\n\n@@@')
  /* A HEAD FIELD KEY sits tag-to-tag against its value — `<span class="pf-k">on watch</span>Maren` —
   * so a bare tag-strip has always produced "on watchMaren", and since 08-01 "Pass189" as well. Give
   * the key its own trailing space before anything else touches it. */
  .replace(/<span class="pf-k">([\s\S]*?)<\/span>/g, '$1 ')
  .replace(/<h2>/g, '\n@@')
  .replace(/<\/(p|div|figure|li|h2)>/g, '\n')
  .replace(/<span class="lbl">([\s\S]*?)<\/span>/g, '[$1] ')
  .replace(/<div class="(more-note|cp-label|cp-item|rb-label|rb-note|peel-say|tu-k)">/g, '  · ')
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
  .replace(/<a class="anchor"[\s\S]*?<\/a>/g, '')
  /* FIGURES AND DRAWINGS. Until 08-01 these dumped as blank lines, so three blind reviews read the book
   * with its circuits and its seeker map silently deleted — and unmarked, so no reviewer could tell a
   * figure had ever been there. What they were assessing when they discussed "the tactile diagrams" was
   * Tamsin's caption, which is prose. Emit the alt/aria text the markup already carries, bracketed so a
   * reviewer knows it is a projection of a picture and not the keeper's own words. No data-s values ever
   * (NO-LEAK): describe the shape, never name the sender's signs. */
  .replace(/<img[^>]*\balt="([^"]*)"[^>]*>/g, (_, a) => `\n  [FIGURE — ${a}]\n`)
  .replace(/<svg[^>]*\baria-label="([^"]*)"[^>]*>[\s\S]*?<\/svg>/g, (_, a) => `\n  [DRAWING — ${a}]\n`)
  /* Interactive controls are furniture, not text. They were leaking into the dump as loose words
   * ("sweep let it run still — set it going") in the middle of a keeper's paragraph. */
  .replace(/<button[\s\S]*?<\/button>/g, '')
  .replace(/<span class="circuit-say"[\s\S]*?<\/span>/g, '')
  /* A blind reviewer on 07-31 filed two of its findings against this exporter rather than the book:
     an italicized quotation read as a doubled word ("as as before"), and ~15 run-together lines where
     adjacent spans lost the space between them ("bothfails fails fails holds"). Both are transport
     damage, and both landed in the review as prose defects. Mark emphasis, and keep tags apart. */
  .replace(/<em>([\s\S]*?)<\/em>/g, '“$1”')
  /* spans the stylesheet lays out as BLOCKS — a ledger row, a line of a letter, an item on a bench list.
     Stripping the tag runs them together into one paragraph, which is not what any reader sees. */
  .replace(/<span class="(ln|sig|row|key)"[^>]*>/g, '\n  ')
  /* `[ \t]*`, NOT `\s*`. A fold breaks a line with a real newline plus indent (listener.js:91),
   * not a <br>, and that newline sits between two spans — so eating it here collapsed §501's rule
   * table into one unbroken wall. The table IS "lines of one shape"; the lines are the content.
   * Caught 08-01 while preparing a blind read, before the reviewer saw the mangled version. */
  .replace(/<\/span>[ \t]*<span/g, '</span> <span')
  .replace(/<[^>]+>/g, ' ')
  .replace(/(?<!^)[ \t]{2,}/gm, ' ');   // keep LEADING whitespace: a fold's indent is its nesting depth

t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
     .replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&mdash;/g, '—');

// the signs are already braille; count the distinct ones for the report, substitute nothing.
// Anything still in the private-use area is a BUG (a file that missed braille-codepoints.js), so it
// is counted separately and named on stderr rather than being quietly papered over.
const seen = new Set(), stray = new Set();
for (const c of t) {
  const n = c.codePointAt(0);
  if (n >= 0x2800 && n <= 0x28ff) seen.add(c);
  else if (n >= 0xE000 && n <= 0xF8FF) stray.add(c);
}

t = t.replace(/#[ \t]*(?=\n)/g, '')      // strip the heading anchor glyph (tags now leave a space behind it)
     .replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').replace(/@@@/g, '').replace(/@@/g, '');

/* NO LEGEND.  An earlier version appended one — "these N cells are distinct recurring marks, no meanings
 * given".  That is a tell: it announces the text as a constructed test artifact with substitutions and
 * deliberate withholding, which primes a blind reader to look for the trick instead of reading.  A reader on
 * the page gets no legend either; the marks are just marks.  Report the count on stderr, not in the file. */
const out = t.trimStart() + '\n';

const dest = process.argv[2] || '/tmp/reader-text.txt';
fs.writeFileSync(dest, out);
console.log(`${dest}: ${out.split(/\s+/).length} words · ${seen.size} distinct signs`);
if (stray.size) {
  console.error(`✗ ${stray.size} private-use codepoint(s) on the page — they will not survive a copy.`);
  console.error(`  Run: node scripts/braille-codepoints.js`);
  process.exit(1);
}
