/* THE STAMP, in one place.
 *
 * WHY THIS EXISTS.  Eight scripts each hand-rolled `/class="stamp">Pass (\d+)/` against the head of
 * an entry.  On 08-01 the stamp's ruling changed — the word `Pass` was wrapped so it could sit in the
 * head's key column beside ON WATCH and NOTE — and six gates broke one at a time, each with its own
 * error a hundred lines deep, exactly the way renaming the arc used to break six gates before
 * `arc-order.js` existed.  So the stamp's shape is one export now.  Anything that reads a pass number
 * off an entry head requires this; nothing re-derives it.
 *
 * Both rulings match, because the file this parses is generated and an old build may still be on disk:
 *     <div class="stamp">Pass 189</div>
 *     <div class="stamp"><span class="pf-k">Pass</span>189</div>
 */
'use strict';

/* the pass number off an entry head. Capture group 1 is the number. Not global — clone with
 * `new RegExp(PASS.source, 'g')` where you need to walk every stamp in a file. */
const PASS = /class="stamp">(?:<span[^>]*>)?Pass(?:<\/span>)?\s*(\d+)/;

/* the whole stamp div, for stripping it out of a body. Lazy, so it stops at the first </div>. */
const BLOCK = /<div class="stamp">[\s\S]*?<\/div>/;

/* the stamp's text as a reader sees it — "Pass 191 · later" — with the key's markup taken back out. */
const text = src => {
  const m = src.match(/<div class="stamp">([\s\S]*?)<\/div>/);
  /* tags become a SPACE, not nothing: the key and its value sit tag-to-tag with no whitespace
   * between them, so stripping to '' gives "Pass189". */
  return m ? m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
};

/* the first pass number in a chunk of source, or NaN. */
const first = src => +((src.match(PASS) || [])[1]);

/* every pass number in a chunk of source, in document order. */
const all = src => [...src.matchAll(new RegExp(PASS.source, 'g'))].map(m => +m[1]);

module.exports = { PASS, BLOCK, text, first, all };
