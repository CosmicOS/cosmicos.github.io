#!/usr/bin/env node
/* EVERY .msg BLOCK MUST SAY WHAT IT IS, AND BE IT.
 *
 * A `.msg` widget shows one saying in several forms at once — source, parse, tones, spider — and it
 * carries its own `data-tones`, typed in by hand. That makes it the one exhibit on the page that can
 * claim the message sent something it never sent, and until 08-08 nothing checked it. Two of the four
 * in the book were showing statements that appear NOWHERE in the wire, and one of them had prose
 * beside it telling the reader what the message had done.
 *
 * A `.row[data-code]` cannot drift, because the renderer builds it from msg.json. A hand row cannot
 * hide, because `data-hand` declares whose hand it is and `audit-hands` checks the declaration. The
 * `.msg` block had neither, so it inherited the authority of a wire quote with none of the checking.
 *
 * So: declare it, in the block, next to the thing being declared.
 *
 *   data-msg="wire"      the tones ARE a transmitted statement. Checked against _data/msg.json.
 *   data-msg="fragment"  the tones are a sub-expression of one. Checked as a substring of some code.
 *   data-msg="hers"      a keeper's own constructed example — a line she wrote and ran herself. Then it
 *                        must be shown ONLY in her hand: `data-modes="hand"`.
 *
 * On that last rule, because the obvious version of it is wrong. The first draft said a `hers` block
 * must carry no `data-tones` — but `prose.js build` derives tones from the parse and stamps them into
 * every `.msg` block itself, so that rule outlawed the builder's own output. Tones are a MECHANISM
 * here, not a claim. What makes a claim is the VIEW: `raw` prints the tone string and `glyph` prints
 * the message's own figures, and either one says "this came down". `hand` prints what she wrote. So a
 * keeper's own example is fine to hold tones and must not be shown in the wire's two views.
 *
 *   node scripts/audit-msg.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

const msg = JSON.parse(fs.readFileSync(path.join(ROOT, '_data/msg.json'), 'utf8'));
const codes = msg.map(m => m && m.code).filter(Boolean);
const blob = codes.join('|');

let bad = 0, seen = 0;
for (const file of fs.readdirSync(path.join(ROOT, '_includes/listener')).filter(f => f.endsWith('.html'))) {
  const src = fs.readFileSync(path.join(ROOT, '_includes/listener', file), 'utf8');
  const lines = src.split('\n');
  let pass = '?';
  lines.forEach((ln, i) => {
    const p = ln.match(/id="p(\d+)"/); if (p) pass = p[1];
    for (const m of ln.matchAll(/<div class="msg"[^>]*>/g)) {
      seen++;
      const tag  = m[0];
      const kind = (tag.match(/data-msg="([a-z]+)"/) || [])[1];
      const tones = (tag.match(/data-tones="(\d+)"/) || [])[1];
      const code  = (tag.match(/data-code="(\d+)"/) || [])[1];
      const where = `${file}:${i + 1}  §${pass}`;
      /* A block that carries data-code is looked up in the wire by the renderer, exactly like a
         `.row[data-code]`, so it cannot claim anything the message did not send. It needs no
         declaration beyond the code being real. */
      if (code) {
        if (!codes.includes(code)) { console.log(`  ${where}  data-code is not a statement`); bad++; }
        continue;
      }
      if (!kind) {
        console.log(`  ${where}  no data-msg — say what it is: wire | fragment | hers`); bad++; continue;
      }
      if (kind === 'wire' && !codes.includes(tones)) {
        console.log(`  ${where}  data-msg="wire" but these tones are not a statement`); bad++;
      } else if (kind === 'fragment' && !(tones && blob.includes(tones))) {
        console.log(`  ${where}  data-msg="fragment" but these tones are in no statement`); bad++;
      } else if (kind === 'hers' && (tag.match(/data-modes="([^"]*)"/) || [])[1] !== 'hand') {
        console.log(`  ${where}  data-msg="hers" must be data-modes="hand" — raw and glyph are the wire's views`); bad++;
      } else if (!['wire', 'fragment', 'hers'].includes(kind)) {
        console.log(`  ${where}  data-msg="${kind}" is not a kind`); bad++;
      }
    }
  });
}
console.log(bad
  ? `\n✗ ${bad} of ${seen} .msg block(s) undeclared or not what they claim`
  : `✓ .msg blocks: all ${seen} declared, and each is what it says it is`);
process.exit(bad ? 1 : 0);
