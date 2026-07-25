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
  // Slot-marks only.  A bound name has no sign of its own on the wire — it is a position in a maker, so there
  // is nothing transmitted to render and a shape is the only option.  Hollow because §288 is where she meets
  // it: "a new mark takes a HOLLOW for a slot, then a body that leans on that slot".
  '◌': 'a slot', '⬚': 'a slot', '○': 'a slot', '◔': 'a slot',
};
/* KILLED 07-23 (user: "there are perfectly good scrawls; you need some compelling reason to use something
   else — and even then it should generally be a regular coining"):
     ⌂ -> .sg data-s="room"  (msg 1301 `intro room`, scrawl f147f148)
     ⇌ -> .sg data-s="door"  (msg 1299 `intro door`, scrawl f147f146)
     ⟳ -> deleted; every row already carried the words "a beat"/"the beat" beside it
     ▸ -> `.step` "then" as a sequence separator; deleted where the row already said "it turns toward"
   None had earned its place: ⇌ was never glossed anywhere, ▸ meant two different things and was also the
   fallback char for cons:1, and ⌂/⟳ were only inferable from adjacent words that could carry the load alone. */

/* 5. NO REAL-WORLD SHAPES.  A closed blacklist of glyphs whose SHAPE carries an Earth referent.  These are a
   worse fault than an invented mark: an invented mark is merely unearned, but a picture of a human artifact
   smuggles our world into her notation — the same family as the banned horse/city-name imagery, and invisible
   to every other check because the shape "reads well".  ⌂ (a pitched roof over a square = a human dwelling)
   stood for the transmitted `room` sign in the renderer's seeker captions, in the §619 map, and as the no-JS
   fallback on 12 spans, for months (Paul, 07-24: "that's semantic leakage, has to be plugged").  `room` has a
   real scrawl (f147f148) and she has her own word for it.  Scanned EVERYWHERE, including inside .sg fallbacks
   and renderer string literals, because that is exactly where it hid. */
const REAL_WORLD = { '\u2302': 'a human house (pitched roof) — use the `room` scrawl, or her word' };

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

/* 1b. ONE WORD, ONE MARK.  A coined word must not answer to two different marks: both render as the word, so
   the reader cannot tell which mark is on the page.  Until 07-23 `maker` was cut for BOTH `?` (f150) and
   `lambda` (f15e) — plainer re-used Iso's name because lambda really is the same doing said shorter, which is
   a good reason and still the wrong outcome (Paul: "let's not have her do that, that's confusing").  She now
   declines to name it and reads it in its own mark, which is T1's rule anyway: coin only where a name
   illuminates.  Same escape clause as 3b: identical scrawl means it IS one mark, so sharing is fine. */
{
  const byWord = {};
  for (const f of files)
    for (const m of fs.readFileSync(path.join(DIR, f), 'utf8')
        .matchAll(/<span class="coin[^"]*"[^>]*data-sign="([^"]*)"[^>]*>([^<]*)<\/span>/g))
      (byWord[m[2].trim()] = byWord[m[2].trim()] || new Set()).add(m[1]);
  for (const [word, set] of Object.entries(byWord)) {
    if (set.size < 2) continue;
    const scrawls = new Set([...set].map(x => SCRAWL[x]));
    if (scrawls.size !== 1 || scrawls.has(undefined))
      flags.push(`the word "${word}" is cut for ${set.size} DIFFERENT marks (${[...set].join(', ')}) ` +
                 `— both render as "${word}", so a reader cannot tell which mark is on the page`);
  }
}

/* 4. NO UNCOINED WORD TOKENS.  `.gl w` is declared in MARK_INVENTORY as "a coined word token … the rendered
   form of a `.coin[data-sign]`".  A `.gl w` with no coin anywhere is a word wearing the costume of a cut
   mark: it LOOKS like a sign she has named, and no gate sees it, because prose-check/audit-coins/
   audit-readback all key off `.coin[data-sign]` and there is none.  Until 07-23 the arc carried 20 such
   tokens — `switch` `field` `both-knot` `ring` `mold` — every one inside a hand row, which is exactly where
   an unearned mark hides (same family as §549's ▮).  Two legitimate outcomes when this fires: cut the sign
   properly (show → coin → read back), or, if the word is not a sign at all — her own label, or a family of
   several marks that cannot share one word (see 1b) — style it as a plain label, not `.gl w`.
   Document order matters: the coin must come first, which prose-check enforces separately. */
{
  const coined = new Set();
  const ORDER = ['founder','terse','wondering','wary','maker','doubter','plainer','cold','listener','builder','final'];
  for (const f of ORDER) {
    const src = fs.readFileSync(path.join(DIR, f + '.html'), 'utf8');
    const lineOf = i => src.slice(0, i).split('\n').length;
    for (const m of src.matchAll(/<span class="(coin gl w|gl w)"[^>]*>([^<]*)<\/span>/g)) {
      const word = m[2].trim();
      if (m[1] === 'coin gl w') { coined.add(word); continue; }
      if (!coined.has(word))
        flags.push(`${f}.html:${lineOf(m.index)}  .gl w token "${word}" is never coined` +
                   `  — cut it (show → .coin[data-sign] → read back), or make it a plain label if it is not a sign`);
    }
  }
}

/* 3b. FALLBACK COHERENCE.  The text inside a `.sg` span is the no-JS fallback — the renderer overwrites it —
   so it is invisible in normal reading and drifts silently.  It is NOT harmless: it is what a source-reader
   sees, and mis-reading a fallback as "the mark" is how ▮/⬥ were mis-diagnosed three times in one session.
   Two rules:  a sign is drawn ONE way (at most one shape, plus optionally its coined word);  and a shape means
   ONE sign — unless those signs ARE THE SAME MARK ON THE WIRE, i.e. identical scrawl in sign_scrawl.json (10
   such aliases exist, e.g. `true:*`/`map`).  Sharing a coined WORD is NOT sufficient and was my first, wrong
   rule: `?` (f150) and `lambda` (f15e) are both cut "maker" but are different marks, so one shape for both
   claimed they look alike when they do not.  A fallback depicts the MARK, so the wire decides, not the word. */
{
  const bySign = {}, byShape = {}, coined = {};
  for (const f of files) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    for (const m of src.matchAll(/<span class="gl sg" data-s="([^"]*)">([^<]*)<\/span>/g)) {
      (bySign[m[1]] = bySign[m[1]] || new Set()).add(m[2]);
      (byShape[m[2]] = byShape[m[2]] || new Set()).add(m[1]);
    }
  }
  for (const [sign, set] of Object.entries(bySign)) {
    const shapes = [...set].filter(x => !/[a-z]/i.test(x));
    if (shapes.length > 1) flags.push(`sign "${sign}" is drawn ${shapes.length} ways: ${shapes.join(' ')} — pick one`);
  }
  for (const [shape, set] of Object.entries(byShape)) {
    if (set.size < 2 || /[a-z]/i.test(shape)) continue;
    const scrawls = new Set([...set].map(s => SCRAWL[s]));
    if (scrawls.size !== 1 || scrawls.has(undefined))
      flags.push(`shape ${shape} is the fallback for ${set.size} signs (${[...set].join(', ')}) ` +
                 `that are DIFFERENT marks on the wire — a fallback depicts the mark, so one shape, one mark`);
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

{
  const targets = files.map(f => [f, fs.readFileSync(path.join(DIR, f), 'utf8')]);
  targets.push(['js/listener.js', fs.readFileSync(RENDERER, 'utf8')]);
  targets.push(['listener.html', fs.readFileSync(path.resolve(__dirname, '../listener.html'), 'utf8')]);
  for (const [name, src] of targets) {
    const lineOf = i => src.slice(0, i).split('\n').length;
    for (const [ch, why] of Object.entries(REAL_WORLD)) {
      let i = -1;
      while ((i = src.indexOf(ch, i + 1)) !== -1)
        flags.push(`${name}:${lineOf(i)}  real-world shape ${ch} — ${why}`);
    }
  }
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
