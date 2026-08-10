#!/usr/bin/env node
/* "gives"-row audit.  A `.msg` widget carrying `data-value` renders an extra last row, labeled *gives*,
   showing what the fragment YIELDS.  That value comes from sender-side evaluation — so the row can quietly
   hand the keeper an answer she has no way to reach from the wire.  That is a leak with a friendly label on it.

   This gate does NOT try to decide computability; it makes the set CLOSED.  Every `data-value` widget must be
   listed below with the reason the keeper can settle it herself.  Adding one forces someone to write down HOW
   SHE KNOWS — which is the question that would otherwise go unasked.

   The two that exist are the strongest possible case: the message *defines* the two names as exactly these
   claims, so the row reads back a transmitted definition rather than a computed result.
     MESSAGE_INDEX 391  define true  | = 0 0
     MESSAGE_INDEX 392  define false | = 0 1
   …and her own numeracy settles "none is the same as none" independently (a numerate people's own competence,
   not a gift from the sender — see DONT_LEAK.md).  §306 dramatises the check: "I checked the two claims by
   hand, to be sure of them".  Exit 1 on any violation.  Usage: node scripts/audit-values.js */
const fs = require('fs'), path = require('path');
const DIR = path.resolve(__dirname, '../_includes/listener');

// data-src  ->  { value, how she knows }
const JUSTIFIED = {
  '= 0 0': { value: 'true',  why: 'msg 391 `define true | = 0 0` — the name IS this claim, by transmitted definition; and none-equals-none is her own numeracy' },
  '= 0 1': { value: 'false', why: 'msg 392 `define false | = 0 1` — same, the fails-name is bound to this very claim' },
  '(? x | + $x 1) 15': { value: '16', why:
    '§602: the root mold\'s first manner, whose body is on the page one row above (msg 1544 renders it `maker ◌ ⟅join ◌ ▪⟆`). ' +
    'She reads the rule off that row and runs it — no sender-side answer is involved: `join` is her own coined word for the ' +
    'adding she has done since the counting era, and one-more-than-a-count is a numerate people\'s own competence, not a gift ' +
    'from the sender (DONT_LEAK.md). Hand-running the message\'s rules IS her craft, asserted since §0 ("she is the rule-runner"). ' +
    'The message tests the same manner itself at msg 1554, and gets the same answer.' },
};

const flags = [];
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.html'))) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  for (const m of src.matchAll(/<div class="msg"[^>]*>/g)) {
    const tag = m[0];
    const val = (tag.match(/data-value='([^']*)'/) || tag.match(/data-value="([^"]*)"/) || [])[1];
    if (val === undefined) continue;
    const line = src.slice(0, m.index).split('\n').length;
    const srcAttr = (tag.match(/data-src="([^"]*)"/) || [])[1] || '(no data-src)';
    const j = JUSTIFIED[srcAttr];
    if (!j)
      flags.push(`${f}:${line}  "${srcAttr}" gives "${val}" — not justified.\n` +
                 `        A *gives* row shows sender-side evaluation. Say how the keeper reaches this value\n` +
                 `        from the wire (or her own numeracy), then add it to JUSTIFIED in this file.`);
    else if (j.value !== val)
      flags.push(`${f}:${line}  "${srcAttr}" gives "${val}", but it is justified only for "${j.value}"`);
  }
}

if (flags.length) {
  console.log(`✗ ${flags.length} unjustified "gives" row(s) — the keeper is being handed an answer:`);
  flags.forEach(x => console.log('    ' + x));
  process.exit(1);
} else {
  console.log(`✓ values: ${Object.keys(JUSTIFIED).length} "gives" row(s), each one the keeper can settle herself`);
}
