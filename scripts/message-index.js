#!/usr/bin/env node
/* message-index.js — write plans/MESSAGE_INDEX.md: a complete, skimmable transcription of the transmitted
 * message, one line per statement, index-prefixed. This is MY reference for reasoning about what a diary
 * section actually draws from — read/grep the lines HERE, never a lossy filtered query.
 *   node scripts/message-index.js         # regenerates plans/MESSAGE_INDEX.md
 */
'use strict';
const fs = require('fs'), path = require('path');
const M = require(path.resolve(__dirname, '../_data/msg.json')).filter(x => x && x.code);

// readable: unary -> ⟨N⟩, drop trailing ;, collapse whitespace. Keep | $ ( ) — they ARE the structure.
const clean = s => (s || '')
  .replace(/\(unary((?:\s+[01])+)\)/g, (m, g) => '⟨' + g.trim().split(/\s+/).filter(d => d === '1').length + '⟩')
  .replace(/;\s*$/, '').replace(/\s+/g, ' ').trim();

const out = [];
out.push('# MESSAGE_INDEX — skimmable transcription of the transmitted message');
out.push('');
out.push('Every transmitted statement, in the sender\'s own source (from `_data/msg.json` `lines`). The keeper');
out.push('never sees this form — she receives only tones — but it is the clearest view of *what each statement');
out.push('says*, for reasoning about what a diary section (Pass N) actually draws from.');
out.push('');
out.push('**RULE (for me):** before reasoning about any diary section, READ/grep the relevant lines HERE — the');
out.push('primary source — never infer from a narrow query. Numbers shown `⟨N⟩` (unary decoded); `|` = the');
out.push('sender\'s paren-shorthand (`A B | C` = `A B (C)`); `$x` = a bound-var reference. Blank line before each');
out.push('`intro` (a new sign/concept). Regenerate: `node scripts/message-index.js`.');
out.push('');
out.push('```');
let lastStanza = null;
M.forEach((x, i) => {
  const src = clean((x.lines || []).join(' '));
  const isIntro = /^intro\b/.test(src);
  if (isIntro) out.push('');                                  // blank line segments concepts
  out.push(String(i).padStart(5) + '  ' + src);
});
out.push('```');
out.push('');
out.push('_' + M.length + ' transmitted statements._');

const file = path.resolve(__dirname, '../plans/MESSAGE_INDEX.md');
fs.writeFileSync(file, out.join('\n') + '\n');
console.log('wrote plans/MESSAGE_INDEX.md (' + M.length + ' statements, ' + out.length + ' lines)');
