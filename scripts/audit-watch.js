#!/usr/bin/env node
/* taking-up audit.  Every keeper after the founder inherits the log at a formal change of watch, and
   canon (LISTENER_CHARACTERS.md "The taking-up record") puts a `.taking-up` register block at EVERY
   handoff — born §232, when Ren the cutter cuts the first one.  Seven of the ten went missing once
   (a sweep that did the first three and stopped), and nothing caught it but a reader's eye.  So:
     - the founder has no record (nobody handed her the watch); every other file opens with exactly one
     - its Pass number is the file's own first pass, and pass numbers ascend down the line
     - the succession CHAINS: file N's "Watch begins" is file N+1's "Watch ended", name for name
     - register-names parse as `[given] Tip [tide] Hind [room]`, from the station's tide- and room-books
     - the creed is present, and drifts only by COPYING — each one is its predecessor or one small slip
       from it (across→through, walk→talk, …), never a fresh composition
   Exit 1 on any violation.  Usage: node scripts/audit-watch.js */
const fs = require('fs'), path = require('path');
const DIR = path.resolve(__dirname, '../_includes/listener');
const FILES = require('./arc-order');
const STAMP = require('./stamp');
const KEEPERS = ['Maren','Ren','Iso','Neru','Bram','Vess','Ona','Senn','Cael','Tamsin','Lio'];
/* 'Ford' left the tide-book on 08-01: it collided with Low Ford (a station on the net) and with Ford
   (the net works Fenn leaves for), so a reader met one word as three referents — and the tide-name was
   the only one of the three that wasn't load-bearing. 'Sill' replaces it. Keep this list closed; the
   register-name is flavor, and flavor must not take a word the story needs. */
const TIDES = ['Ful','Sut','Slack','Neap','Bore','Sill','Race'];
const ROOMS = ['Star','Kettle','Barge','Lamp','Skeel','Salt'];

const flags = [];
const bad = (f, msg) => flags.push(`${f.padEnd(10)} ${msg}`);

// one small slip apart: same word count, and at most one word differing
const slip = (a, b) => {
  const x = a.toLowerCase().split(/\s+/), y = b.toLowerCase().split(/\s+/);
  return x.length === y.length && x.filter((w, i) => w !== y[i]).length <= 1;
};

let prevBegins = null, prevPass = 0, prevCreed = null;
for (let i = 0; i < FILES.length; i++) {
  const f = FILES[i];
  const src = fs.readFileSync(path.join(DIR, f + '.html'), 'utf8');
  const recs = [...src.matchAll(/<div class="taking-up">([\s\S]*?<\/div>)\s*<\/div>/g)];

  if (i === 0) {                                   // the founder was handed nothing
    if (recs.length) bad(f, 'has a taking-up record, but nobody handed the founder the watch');
    const m = src.match(/Pass (\d+)/);
    prevPass = m ? +m[1] : 0;
    prevBegins = KEEPERS[0];
    continue;
  }
  if (recs.length !== 1) { bad(f, `${recs.length} taking-up records, expected exactly 1`); continue; }

  const rec = recs[0][1];
  // the record must head the file — before the first entry it introduces
  if (recs[0].index > src.indexOf('<div class="entry')) bad(f, 'taking-up sits after the first entry');

  const head = (rec.match(/<div class="tu-head">([^<]*)<\/div>/) || [])[1] || '';
  const lines = [...rec.matchAll(/<span class="tu-k">([^<]*):<\/span>\s*([^<]*)</g)].map(m => [m[1], m[2].trim()]);
  const creed = ((rec.match(/<div class="tu-creed">([^<]*)<\/div>/) || [])[1] || '').trim();

  // Pass N · Cycle X — the pass is the file's own first pass, and the line only moves forward
  const hp = head.match(/^Pass (\d+) · Cycle \S+$/);
  if (!hp) { bad(f, `malformed head: "${head}"`); }
  else {
    const pass = +hp[1], first = STAMP.first(src.slice(recs[0].index + recs[0][0].length));
    if (pass !== first) bad(f, `record stamped Pass ${pass}, but the era opens at Pass ${first}`);
    if (pass <= prevPass) bad(f, `Pass ${pass} does not follow Pass ${prevPass}`);
    prevPass = pass;
  }

  // ended / begins, in that order, and the names chain hand to hand
  const keys = lines.map(l => l[0]);
  if (keys.join('|') !== 'Watch ended|Watch begins') { bad(f, `lines are ${keys.join(' + ') || '(none)'}`); continue; }
  const [ended, begins] = lines.map(l => l[1]);
  for (const name of [ended, begins]) {
    const nm = name.match(/^(\S+) Tip (\S+) Hind (\S+)$/);
    if (!nm) { bad(f, `register-name does not parse: "${name}"`); continue; }
    if (!KEEPERS.includes(nm[1])) bad(f, `"${nm[1]}" is not a keeper of the line`);
    if (!TIDES.includes(nm[2])) bad(f, `"${nm[2]}" is not a tide in the tide-book`);
    if (!ROOMS.includes(nm[3])) bad(f, `"${nm[3]}" is not a room on the islet`);
  }
  if (ended.split(' ')[0] !== prevBegins) bad(f, `"Watch ended: ${ended}" — the log was left by ${prevBegins}`);
  if (begins.split(' ')[0] !== KEEPERS[i]) bad(f, `"Watch begins: ${begins}" — this era is ${KEEPERS[i]}'s`);
  prevBegins = begins.split(' ')[0];

  // the creed is copied, never composed
  if (!creed) bad(f, 'no creed');
  else if (prevCreed && !slip(prevCreed, creed)) bad(f, `creed "${creed}" is not a copy of "${prevCreed}"`);
  if (creed) prevCreed = creed;
}

if (flags.length) {
  console.log(`✗ ${flags.length} taking-up violation(s) — the change of watch is broken:`);
  flags.forEach(x => console.log('    ' + x));
  process.exit(1);
} else {
  console.log(`✓ taking-up: ${FILES.length - 1} handoffs, unbroken ${KEEPERS[0]}→${KEEPERS[KEEPERS.length - 1]}`);
}
