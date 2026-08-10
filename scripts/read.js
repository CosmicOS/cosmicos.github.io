#!/usr/bin/env node
/* read.js — mechanically generate a flat REVIEWER READ of the story at /.
 *
 * This FORMATS the real post-JS DOM; it does NOT render anything itself. The page is drawn
 * by exactly one renderer — js/listener.js, in a real browser — and scripts/render-dom.sh
 * captures what it produced. read.js takes that DOM and flattens it to plain text, so the
 * read can never drift from the page (there is no second renderer to keep mirrored).
 *
 * What the flattening preserves, for a review that must check sameness / difference /
 * recurrence of the message's signs WITHOUT leaking anything the keeper is blind to
 * (see plans/LISTENER_CANON.md, "PREP A READ FOR A REVIEWER"):
 *   - tones / cups / bits / her cracked marks are already literal characters in the DOM —
 *     kept as-is;
 *   - every message FIGURE (a private-use scrawl codepoint the keeper hasn't aliased) is a
 *     tofu box in plain text, so each distinct one becomes a stable token glyph0, glyph1, …
 *     assigned in first-seen order and REUSED across the whole read (recurrence stays checkable);
 *   - the §189 tone-wall is summarized (it fades off-screen; its length is unstated);
 *   - a bitmap or an SVG becomes ⟦a drawing on the page: {alt}⟧ (play/step controls dropped), so a
 *     flat read isn't blind to those beats. NAMED AS A DRAWING ON PURPOSE: it was ⟦animation: …⟧,
 *     which a blind reader took for a stage direction leaking out of the authoring — "that is not in
 *     the world of this book" — and reported as a defect in the prose. The stand-in has to announce
 *     that it stands in for something a sighted reader SEES, or it manufactures findings;
 *   - no explanatory header and no figure-key footer — hand over just the diary.
 *
 * Usage:  node scripts/read.js [--through N] [--out FILE] [--dom FILE]
 *   --through N   only entries up to and including Pass N (default: all)
 *   --out FILE    write there (default: stdout)
 *   --dom FILE    format this already-rendered DOM (default: render a fresh one via
 *                 scripts/render-dom.sh — which builds + runs the real page through Chrome)
 */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const STAMP = require('./stamp');
const ROOT = path.resolve(__dirname, '..');

// ---- args ----
const argv = process.argv.slice(2);
let through = Infinity, outFile = null, domFile = null, figMode = 'token';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--through') through = parseInt(argv[++i], 10);
  else if (argv[i] === '--out') outFile = argv[++i];
  else if (argv[i] === '--dom') domFile = argv[++i];
  else if (argv[i] === '--figures') figMode = argv[++i];  // 'token' (glyphN, default) | 'braille' (one distinct symbol per figure)
}

// ---- get the real post-JS DOM (render fresh unless one was handed to us) ----
if (!domFile) {
  domFile = '/tmp/read-dom.html';
  execFileSync(path.resolve(__dirname, 'render-dom.sh'), [domFile], { stdio: ['ignore', 'ignore', 'inherit'] });
}
/* EVERY FIGURE BACK INTO THE READER'S OWN NUMERALS, before anything else looks at this file.
 * The page writes numbers in the keepers' numerals (js/listener.js, `keeperNumerals`), which is
 * right for the book and wrong for a flat read, three ways:
 *   - a reviewer cannot cite a pass, and the whole point of a read is being able to say where;
 *   - `--through N` reads the pass number off the stamp, and there is no longer a digit in it;
 *   - the codepoints are braille only as an ADDRESS into the scrawl face — a reader sees an alien
 *     figure, not a dot pattern — so putting them in plain text tells a text-only reviewer a lie
 *     about what is drawn, and invites a finding about a notation nobody can see.
 * The numerals are not content a reader has to decode; nothing in the book turns on reading one.
 * So the read says the number and stays quiet about the shape. Done on the whole DOM at once so
 * the stamp parser, the `--through` filter and the body all agree. */
const html = fs.readFileSync(domFile, 'utf8')
  /* the inner spans are matched EXPLICITLY, not with `[\s\S]*?`: a lazy match stops at the first
   * `</span>`, which is the first PLACE of the number, and leaves the rest — "Pass 189 ⣽". */
  .replace(/<(span|a) class="(?:rknum|passref)"[^>]*\b(?:data-v|title)="(?:pass )?(\d+)"[^>]*>(?:<span class="scrawl">[^<]*<\/span>)*<\/\1>/g, '$2');

// ---- the figure registry, and it should now never fire.  Since 08-07 a sign IS a braille codepoint
//      (scripts/braille-codepoints.js), so it survives into plain text as itself and falls straight
//      through decodeEntities below.  This stays as a net: anything still in the private-use area is a
//      file that missed the conversion, and a tofu box in a review is worse than a labelled stand-in. ----
const glyphReg = new Map();
function glyphToken(cp) {
  if (!glyphReg.has(cp)) {
    const n = glyphReg.size;
    // braille mode: one distinct Unicode symbol per figure (recurrence is self-evident, needs no explaining);
    // token mode: a stable glyphN word (survives plain-text tofu, but clutters the prose)
    glyphReg.set(cp, figMode === 'braille' ? String.fromCodePoint(0x2801 + n) : 'glyph' + n);
  }
  return glyphReg.get(cp);
}
// figures render inline as a single symbol in braille mode; as a spaced word in token mode
function figWrap(tok) { return figMode === 'braille' ? tok : ' ' + tok + ' '; }

// ---- entity decoding: named + numeric; numeric PUA figures route to glyphToken() ----
const NAMED = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
                mdash: '—', ndash: '–', hellip: '…', middot: '·' };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const cp = body[1] === 'x' ? parseInt(body.slice(1).replace(/^x/i, ''), 16) : parseInt(body.slice(1), 10);
      if (cp >= 0xE000 && cp <= 0xF8FF) return figWrap(glyphToken(cp));
      return String.fromCodePoint(cp);
    }
    return (body in NAMED) ? NAMED[body] : m;
  });
}
// literal private-use scrawl chars in the text -> the same stable glyphN tokens
function neutralizePUA(s) { return s.replace(/[\uE000-\uF8FF]/g, ch => figWrap(glyphToken(ch.charCodeAt(0)))); }

// ---- flatten a chunk of DOM HTML (prose + already-rendered rows/exhibits/widgets) to text ----
function flatten(frag) {
  let s = frag;
  s = s.replace(/<div class="flood-run">([\s\S]*?)<\/div>/g, (_, g) => {          // §189 tone-wall -> summarize
    const opener = g.replace(/<[^>]+>/g, '').replace(/\s+/g, '').slice(0, 60);
    return ' «the raw stream, dense and unbroken, wrapping and fading out past the visible edge; it opens ' + opener + '…» ';
  });
  // advanced renderings a flat read would otherwise DROP or turn to noise: surface each as a bracketed
  // token carrying its alt/aria-label, so a text-only review isn't blind to the picture/animation beats
  // (§544–579 bitmaps, §619/622 seeker animations). Do this BEFORE the generic tag-strip below.
  s = s.replace(/<div class="seekmap-bar">[\s\S]*?<\/div>/g, '');                  // drop play/pause/step controls
  /* AND EVERY OTHER BUTTON. The seekmap bar was dropped by NAME, so the circuit simulator's own
     controls (js/circuit-sim.js: "sweep", "sweep till still", "let it run", "set it going") survived
     and ran together into the reader's text as `sweepsweep till stilllet it runstill — set it going`.
     A blind reader meets that as broken output in the middle of an entry. Nothing a reader CLICKS
     belongs in a flat read; drop the element, not the class. */
  s = s.replace(/<button\b[\s\S]*?<\/button>/g, '');
  /* and the live status readout, which read.js sees because it reads the POST-JS DOM: the simulator
     writes 'still — set it going' into it, an instruction to click, in a text-only read where there
     is nothing to click. */
  s = s.replace(/<span class="(?:seekmap|circuit)-say"[\s\S]*?<\/span>/g, '');
  s = s.replace(/<svg\b[^>]*\baria-label="([^"]*)"[^>]*>[\s\S]*?<\/svg>/g, ' ⟦a drawing on the page: $1⟧ ');
  s = s.replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/g, ' ⟦a drawing on the page: $1⟧ ');
  s = s.replace(/<span class="lbl"[^>]*>([\s\S]*?)<\/span>/g, '($1) ');            // a way-of-showing label -> ( … )
  s = s.replace(/<span class="pf-k">([\s\S]*?)<\/span>/g, '\t$1 ');                // head field key: it sits tag-to-tag
  // against its value, so a bare strip gives "on watchMaren". Its gap is a column width on the page.
  // The fence goes BEFORE the key too: without it the PREVIOUS field's value runs into this key
  // ("on watch Rencycle Jeren") at the head of nearly every entry.

  // Spans that the stylesheet lays out as their own line or their own column. The CELL rule below
  // only catches an inline style="display:inline-block", so these were butted onto whatever
  // preceded them — gluing a caption's lines together and welding a gloss onto the end of the marks
  // it glosses. Both are unreadable in the flat read and neither is wrong on the page.
  const CLS = c => new RegExp('<span class="(?:[^"]*\\s)?' + c + '(?:\\s[^"]*)?"[^>]*>', 'g');
  s = s.replace(CLS('ln'), '\n');                                                 // .ln  is display:block
  s = s.replace(CLS('say'), '\t');                                                // .say is set off beside the row
  /* A GRID CELL IS A CELL EVEN WITHOUT AN INLINE STYLE. The CELL rule below only catches
     `style="display:inline-block"`, so every exhibit the stylesheet lays out as a max-content grid —
     `.binstack`, `.rows.ledgered`, `.rows.beats`, `.rows.glossed` — came out with its columns welded
     together: §267's six-column table read `the figureis▪ in frontone mark`, which a reader takes for
     broken output rather than a table. That is what voided read three. The rows are `display:contents`
     and the cells are these classes, plus the bare `<span>` the binstack header uses. */
  ['fig','num','ord','does','trace','beat','keeps'].forEach(c => { s = s.replace(CLS(c), '\t'); });
  s = s.replace(/<span>/g, '\t');
  s = s.replace(/<(?:br)\s*\/?>/g, '\n');
  s = s.replace(/<\/(?:p|div|li|h1|h2|h3|tr)>/g, '\n');                            // block breaks -> newlines
  // A span laid out as a COLUMN (fixed-width inline-block) is a table cell: on the page its width
  // separates it from the next cell, but a plain tag-strip butts them together ("say your kinda mark
  // of its kind"), which reads as a typo and hides the question->answer pairing the row exists to show.
  // Mark each cell boundary now, restore it as a gap after whitespace is collapsed.
  const CELL = '[^>]*style="[^"]*display:\\s*inline-block[^"]*"[^>]*';
  s = s.replace(new RegExp('<span' + CELL + '>([^<]*)</span>', 'g'), '\t$1\t');     // a leaf cell: fence both sides
  s = s.replace(new RegExp('<span' + CELL + '>', 'g'), '\t');                       // a cell wrapping more markup
  s = s.replace(/<[^>]+>/g, '');                                                   // drop remaining tags (keep inner text)
  s = decodeEntities(s);
  s = neutralizePUA(s);
  return s.split('\n').map(l => l.replace(/ +/g, ' ').replace(/\t/g, '   ').trim()).join('\n')
          .replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
}

// ---- balanced-div slicer: inner HTML of each top-level <div class="CLASS"> ----
function sliceBlocks(str, cls) {
  // match cls as a whole space-delimited class token, so varied entry types
  // (class="entry dispatch") are sliced too — but NOT a different class that merely
  // contains it as a substring (class="sect-entry" must not match cls="entry").
  const open = new RegExp('<div class="(?:[^"]*\\s)?' + cls + '(?:\\s[^"]*)?"[^>]*>', 'g');
  const tag = /<div\b[^>]*>|<\/div>/g;
  const out = [];
  let m;
  while ((m = open.exec(str))) {
    const start = m.index + m[0].length;
    tag.lastIndex = start;
    let depth = 1, t;
    while (depth > 0 && (t = tag.exec(str))) depth += t[0] === '</div>' ? -1 : 1;
    if (depth === 0) out.push(str.slice(start, tag.lastIndex - '</div>'.length));
    open.lastIndex = tag.lastIndex;
  }
  return out;
}

// position-aware slice so standalone blocks (the change-of-watch records) interleave with entries in order
function sliceBlocksPos(str, cls) {
  const open = new RegExp('<div class="(?:[^"]*\\s)?' + cls + '(?:\\s[^"]*)?"[^>]*>', 'g');
  const tag = /<div\b[^>]*>|<\/div>/g;
  const out = []; let m;
  while ((m = open.exec(str))) {
    const start = m.index + m[0].length; tag.lastIndex = start;
    let depth = 1, t;
    while (depth > 0 && (t = tag.exec(str))) depth += t[0] === '</div>' ? -1 : 1;
    if (depth === 0) out.push({ pos: m.index, inner: str.slice(start, tag.lastIndex - 6) });
    open.lastIndex = tag.lastIndex;
  }
  return out;
}

/* THE STATION BOOK that opens the page. It is neither an .entry nor a .taking-up, so it fell
   straight through this read and three passes of review never saw the book's first page (08-01).
   It is a RULED FORM, and a form flattened one cell per line stops being a form — so rebuild it
   with padded columns, the way `.reg-grid`'s max-content columns draw it on screen. */
function registerText(inner) {
  const one = (cls) => (inner.match(new RegExp(`<div class="${cls}">([\\s\\S]*?)</div>`)) || [])[1] || '';
  const cells = (cls) => [...inner.matchAll(new RegExp(`<div class="${cls}[^"]*">([\\s\\S]*?)</div>`, 'g'))]
    .map(m => decodeEntities(m[1].replace(/<[^>]+>/g, '')).trim());
  const heads = cells('reg-k'), body = cells('reg-c');
  const n = heads.length || 1;
  const rows = [heads, ...Array.from({ length: Math.ceil(body.length / n) }, (_, i) => body.slice(i * n, i * n + n))];
  const w = heads.map((_, c) => Math.max(...rows.map(r => (r[c] || '').length)));
  const table = rows.map(r => r.map((v, c) => (v || '').padEnd(w[c])).join('  ').trimEnd());
  return [decodeEntities(one('reg-title')), decodeEntities(one('reg-sub')), '',
          table[0], table.slice(1).join('\n'), '', decodeEntities(one('reg-foot'))].join('\n');
}

// ---- assemble the read ----
const chunks = [];
const preface = sliceBlocks(html, 'preface')[0];
if (preface) chunks.push('PREFACE\n\n' + flatten(preface));
const register = sliceBlocks(html, 'register')[0];
if (register) chunks.push(registerText(register));

// entries and taking-up records, merged in document order
const items = [
  ...sliceBlocksPos(html, 'entry').map(x => ({ ...x, kind: 'entry' })),
  ...sliceBlocksPos(html, 'taking-up').map(x => ({ ...x, kind: 'record' })),
].sort((a, b) => a.pos - b.pos);

for (const it of items) {
  if (it.kind === 'record') {                                                     // a spare change-of-watch record
    const rec = flatten(it.inner);
    const recPass = parseInt((rec.match(/pass\s+(\d+)/i) || [])[1], 10);
    if (!isNaN(recPass) && recPass > through) continue;
    chunks.push(rec);
    continue;
  }
  const inner = it.inner;
  const stamp = STAMP.text(inner);
  const h2 = (inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || '';           // may wrap a "#" anchor-link
  const title = h2.replace(/<a class="anchor-link"[\s\S]*?<\/a>/g, '').replace(/<[^>]+>/g, '').trim();
  const passNo = parseInt((stamp.match(/(\d+)/) || [])[1], 10);
  if (!isNaN(passNo) && passNo > through) continue;                               // skip later entries entirely
  const body = inner.replace(STAMP.BLOCK, '').replace(/<h2[^>]*>[\s\S]*?<\/h2>/, '');
  chunks.push('[' + stamp + ']  ' + title + '\n\n' + flatten(body));
}

// NO explanatory header, NO figure-key footer: a key that named "the message's own signs" or
// mapped the figures would leak the frame and the encoding. Hand over just the diary.
const out = chunks.join('\n\n' + '-'.repeat(72) + '\n\n') + '\n';

if (outFile) { fs.writeFileSync(path.resolve(ROOT, outFile), out); console.error('wrote ' + outFile + ' (' + glyphReg.size + ' figures)'); }
else process.stdout.write(out);
