#!/usr/bin/env node
/* audit-numerals.js — THE BOOK HAS NO ARABIC NUMERALS.
 *
 * These keepers write numbers in their own numerals, which are older than the post. The arabic
 * digits in `_prose` are an editing convenience — they grep, they sort, they match the `#pNNN`
 * anchors — and js/listener.js turns every one of them into the keepers' figures at render time
 * (`keeperNumerals`). This checks that the pass reached all of them.
 *
 * WHY A GATE AND NOT A READ-THROUGH. The pass converts what it finds, so a numeral only survives
 * where nobody looked: a page-form invented in a later watch, a block that lands inside something
 * the renderer draws. That is a silent failure — the page looks right, one figure is in the wrong
 * alphabet, and nothing complains. It has already happened once: the first version of the pass
 * named the places a number may appear, and §621's margin note, which is a `.letter`, kept four.
 *
 * ONE QUESTION: is there an arabic digit in the rendered diary that a reader can see?
 * It does NOT check that the figures are the right numbers — reckonNum does that, and scrawl.js
 * has the map. It does not look at the source, where digits are correct and wanted.
 *
 * Usage:  node scripts/audit-numerals.js [rendered-dom.html]      (default /tmp/rendered.html)
 * Run by scripts/render-check.sh against the post-JS DOM, since this is a fact about what the
 * renderer produced and cannot be decided from the source.
 */
'use strict';
const fs = require('fs');
const domFile = process.argv[2] || '/tmp/rendered.html';
if (!fs.existsSync(domFile)) { console.error(`audit-numerals: no DOM at ${domFile}`); process.exit(2); }
const html = fs.readFileSync(domFile, 'utf8');

/* the diary, and only the diary: site chrome is not the keepers' writing and may say what it likes. */
function sliceDiary(s) {
  const open = s.indexOf('<div class="diary">');
  if (open < 0) return null;
  const tag = /<\/?div\b/g; tag.lastIndex = open;
  let depth = 0, m;
  while ((m = tag.exec(s))) {
    depth += m[0] === '</div' ? -1 : 1;
    if (depth === 0) return s.slice(open, tag.lastIndex);
  }
  return s.slice(open);
}

let body = sliceDiary(html);
if (body === null) { console.error('audit-numerals: no .diary in the DOM'); process.exit(2); }

body = body.replace(/<script[\s\S]*?<\/script>/g, '');
/* what the message renderer drew. A digit in there would belong to the wire, not to a keeper —
 * and in practice there are none, since the wire is written in tones, cups and bits. */
body = body.replace(/<(div|span)\b[^>]*\bdata-(?:code|parse)="[^"]*"[^>]*>[\s\S]*?<\/\1>/g, '');

/* attributes go with their tags: `title="207"` is the reader's way back, not ink on the page. */
const text = body.replace(/<[^>]+>/g, ' ');

const bad = [];
const re = /\d+/g; let m;
while ((m = re.exec(text))) {
  const around = text.slice(Math.max(0, m.index - 70), m.index + m[0].length + 70)
                     .replace(/\s+/g, ' ').trim();
  bad.push(`${m[0]}  …${around}…`);
}

if (bad.length) {
  console.log(`✗ ${bad.length} arabic numeral(s) still drawn in the diary — keeperNumerals did not reach them:`);
  bad.slice(0, 12).forEach(b => console.log('    ' + b));
  if (bad.length > 12) console.log(`    … and ${bad.length - 12} more`);
  process.exit(1);
}
console.log('✓ no arabic numerals drawn in the diary');
