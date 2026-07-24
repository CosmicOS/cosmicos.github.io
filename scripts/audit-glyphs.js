#!/usr/bin/env node
/* fabricated-glyph audit.  The rule (T1): a sign of the message is EITHER coined as a WORD, or left as
   bare scrawl and read — rendered by the renderer from `_data/sign_scrawl.json` via `.sg data-s="SIGN"`.
   An invented glyph-shape standing in for a transmitted sign is neither, and is unfaithful: it throws
   away the mark the message actually sends (MESSAGE_FORMS_AND_RENDERING.md §64).  Two checks:

     1. NO GLYPH COINS.  Every `.coin[data-sign]` token must contain letters — a word, not a shape.
        (Until 07-23 the founder carried two glyph coins, `◇`=intro and `✳`=unary, chosen out of a
        Unicode palette before this rule existed; 29 of the arc's 72 bare `.gl` spans were downstream
        uses of exactly those two.)
     2. NO HAND-TYPED SIGNS.  A bare `<span class="gl">X</span>` in the prose is only legal when X is
        the keeper's OWN diagram notation — her marks for rooms, beat, step, and lambda-slots, which
        stand for nothing transmitted.  Everything else must be `.sg data-s`, so the renderer fills in
        the real mark and the whole arc shows one picture per sign.

   The allow-list is deliberately tiny and closed.  Adding to it means claiming a mark is HERS, not the
   message's — so it needs a reason, not a shrug.  Note `▸` is genuinely ambiguous: it is her step/toward
   mark here, but is also the fallback char for `cons:1` elsewhere; adjudicated as hers (T1, user's call).
   Exit 1 on any violation.  Usage: node scripts/audit-glyphs.js */
const fs = require('fs'), path = require('path');
const DIR = path.resolve(__dirname, '../_includes/listener');
const SCRAWL = require(path.resolve(__dirname, '../_data/sign_scrawl.json'));

// the keeper's own diagram notation — stands for nothing the message sends
const HERS = {
  '⌂': 'a room',            '⇌': 'the way between rooms', '⟳': 'the beat',
  '▸': 'a step / toward',   '◌': 'a slot', '⬚': 'a slot', '○': 'a slot', '◔': 'a slot',
};

const RENDERER = path.resolve(__dirname, '../js/listener.js');
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html'));
const flags = [];

for (const f of files) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const lineOf = i => src.slice(0, i).split('\n').length;

  // 1. coins must be words
  for (const m of src.matchAll(/<span class="coin[^"]*"[^>]*data-sign="([^"]*)"[^>]*>([^<]*)<\/span>/g)) {
    if (!/[a-z]/i.test(m[2]))
      flags.push(`${f}:${lineOf(m.index)}  coin for "${m[1]}" is the shape ${m[2]}, not a word` +
                 `  — coin a word, or drop the coin and let it read as scrawl`);
  }

  // 2. bare .gl must be her own notation
  for (const m of src.matchAll(/<span class="gl">([^<]*)<\/span>/g)) {
    const g = m[1];
    if (g in HERS) continue;
    const sign = Object.keys(SCRAWL).find(k => k === g);   // exact-name hit is meaningless; report shape
    flags.push(`${f}:${lineOf(m.index)}  hand-typed ${g}` +
               `  — if it is a transmitted sign use .sg data-s; if it is hers, add it to HERS with a reason` +
               (sign ? ` (note: "${g}" is also a sign name)` : ''));
  }
}

/* 3. THE RENDERER MUST NOT INVENT EITHER.  `js/listener.js` also emits marks, and a hardcoded glyph there is
   invisible to the checks above — which is exactly where `⬥`/`⬦` for true/false hid through the whole T8 sweep,
   contradicting the word "holds" coined one line above the widget that showed them.  A mark built by
   concatenation (`'<span class="gl">'+slots[name]+'</span>'`) is fine — that is mark()/slot() doing their job.
   A LITERAL glyph baked into the string is not, unless it is one of her own notation marks. */
{
  const src = fs.readFileSync(RENDERER, 'utf8');
  const lineOf = i => src.slice(0, i).split('\n').length;
  for (const m of src.matchAll(/<span class="gl">([^<'"+]+)/g)) {
    for (const ch of [...m[1]].filter(c => c.trim()))
      if (!(ch in HERS))
        flags.push(`js/listener.js:${lineOf(m.index)}  renderer hardcodes ${ch}` +
                   `  — emit it through mark(), so it shows her coined word if she has one`);
  }
  const slots = src.match(/SLOTS\s*=\s*\[([^\]]*)\]/);
  if (slots) for (const ch of (slots[1].match(/'([^'])'/g) || []).map(x => x[1]))
    if (!(ch in HERS)) flags.push(`js/listener.js:${lineOf(slots.index)}  slot mark ${ch} is not in the allow-list`);
}

if (flags.length) {
  console.log(`✗ ${flags.length} fabricated-glyph violation(s) — a mark the message never sent:`);
  flags.forEach(x => console.log('    ' + x));
  process.exit(1);
} else {
  const n = files.reduce((a, f) => a + [...fs.readFileSync(path.join(DIR, f), 'utf8')
    .matchAll(/<span class="gl">([^<]*)<\/span>/g)].length, 0);
  console.log(`✓ glyphs: no glyph coins; renderer invents nothing; ${n} bare .gl, all the keeper's own notation (${Object.keys(HERS).length} allowed shapes)`);
}
