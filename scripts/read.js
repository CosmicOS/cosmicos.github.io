#!/usr/bin/env node
/* read.js — mechanically generate a flat REVIEWER READ of listener.html.
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
const ROOT = path.resolve(__dirname, '..');

// ---- args ----
const argv = process.argv.slice(2);
let through = Infinity, outFile = null, domFile = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--through') through = parseInt(argv[++i], 10);
  else if (argv[i] === '--out') outFile = argv[++i];
  else if (argv[i] === '--dom') domFile = argv[++i];
}

// ---- get the real post-JS DOM (render fresh unless one was handed to us) ----
if (!domFile) {
  domFile = '/tmp/read-dom.html';
  execFileSync(path.resolve(__dirname, 'render-dom.sh'), [domFile], { stdio: ['ignore', 'ignore', 'inherit'] });
}
const html = fs.readFileSync(domFile, 'utf8');

// ---- the one shared figure registry: a scrawl codepoint the keeper hasn't aliased is a tofu
//      box in plain text; give each distinct one a stable glyphN, first-seen order, whole read ----
const glyphReg = new Map();
function glyphToken(cp) {
  if (!glyphReg.has(cp)) glyphReg.set(cp, 'glyph' + glyphReg.size);
  return glyphReg.get(cp);
}

// ---- entity decoding: named + numeric; numeric PUA figures route to glyphToken() ----
const NAMED = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
                mdash: '—', ndash: '–', hellip: '…', middot: '·' };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const cp = body[1] === 'x' ? parseInt(body.slice(1).replace(/^x/i, ''), 16) : parseInt(body.slice(1), 10);
      if (cp >= 0xE000 && cp <= 0xF8FF) return ' ' + glyphToken(cp) + ' ';
      return String.fromCodePoint(cp);
    }
    return (body in NAMED) ? NAMED[body] : m;
  });
}
// literal private-use scrawl chars in the text -> the same stable glyphN tokens
function neutralizePUA(s) { return s.replace(/[\uE000-\uF8FF]/g, ch => " " + glyphToken(ch.charCodeAt(0)) + " "); }

// ---- flatten a chunk of DOM HTML (prose + already-rendered rows/exhibits/widgets) to text ----
function flatten(frag) {
  let s = frag;
  s = s.replace(/<div class="flood-run">([\s\S]*?)<\/div>/g, (_, g) => {          // §189 tone-wall -> summarize
    const opener = g.replace(/<[^>]+>/g, '').replace(/\s+/g, '').slice(0, 60);
    return ' «the raw stream, dense and unbroken, wrapping and fading out past the visible edge; it opens ' + opener + '…» ';
  });
  s = s.replace(/<span class="lbl"[^>]*>([\s\S]*?)<\/span>/g, '($1) ');            // a way-of-showing label -> ( … )
  s = s.replace(/<(?:br)\s*\/?>/g, '\n');
  s = s.replace(/<\/(?:p|div|li|h1|h2|h3|tr)>/g, '\n');                            // block breaks -> newlines
  s = s.replace(/<[^>]+>/g, '');                                                   // drop remaining tags (keep inner text)
  s = decodeEntities(s);
  s = neutralizePUA(s);
  return s.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
          .replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
}

// ---- balanced-div slicer: inner HTML of each top-level <div class="CLASS"> ----
function sliceBlocks(str, cls) {
  const open = new RegExp('<div class="' + cls + '"[^>]*>', 'g');
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

// ---- assemble the read ----
const chunks = [];
const preface = sliceBlocks(html, 'preface')[0];
if (preface) chunks.push('PREFACE\n\n' + flatten(preface));

for (const inner of sliceBlocks(html, 'entry')) {
  const stamp = (inner.match(/<div class="stamp">([^<]*)<\/div>/) || [])[1] || '';
  const h2 = (inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || '';           // may wrap a "#" anchor-link
  const title = h2.replace(/<a class="anchor-link"[\s\S]*?<\/a>/g, '').replace(/<[^>]+>/g, '').trim();
  const passNo = parseInt((stamp.match(/(\d+)/) || [])[1], 10);
  if (!isNaN(passNo) && passNo > through) continue;                               // skip later entries entirely
  const body = inner.replace(/<div class="stamp">[^<]*<\/div>/, '').replace(/<h2[^>]*>[\s\S]*?<\/h2>/, '');
  chunks.push('[' + stamp + ']  ' + title + '\n\n' + flatten(body));
}

// NO explanatory header, NO figure-key footer: a key that named "the message's own signs" or
// mapped the figures would leak the frame and the encoding. Hand over just the diary.
const out = chunks.join('\n\n' + '-'.repeat(72) + '\n\n') + '\n';

if (outFile) { fs.writeFileSync(path.resolve(ROOT, outFile), out); console.error('wrote ' + outFile + ' (' + glyphReg.size + ' figures)'); }
else process.stdout.write(out);
