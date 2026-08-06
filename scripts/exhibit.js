#!/usr/bin/env node
/* READ ONE EXHIBIT. Decode a block back to the marks it puts on the page, with its pass, its
 * type, its declarations, and the prose either side of it.
 *
 * Built 2026-08-01. Exhibits live as escaped HTML strings in `_prose/*.blocks.json`, which is safe
 * (byte round-trip, gates, provenance) and miserable to read: every inspection meant writing a
 * throwaway decoder, and `git diff` on blocks.json says nothing about what changed in a figure.
 * This makes reading one cheap, which is the precondition for checking it.
 *
 *   node scripts/exhibit.js k1-maren            list every exhibit: name, kind, pass, first marks
 *   node scripts/exhibit.js k5-bram cons        decode one by name, with the prose around it
 *   node scripts/exhibit.js --all               every keeper, one line each
 *
 * Blocks are keyed by NAME, not position — the name says what the exhibit shows. See prose.js for
 * why, and for the rule that they are never renumbered.
 *
 * It does NOT verify anything. A hand-drawn exhibit can still assert something false — the §193
 * sheets claimed "one round, two phases" and were not — and no gate checks that. This only makes
 * the claim visible so a person can.  */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), PROSE = path.join(ROOT, '_prose');
const ORDER = require('./arc-order.js');
const { label } = require('./scrawl.js');
const STAMP = require('./stamp');
const scrawlMap = JSON.parse(fs.readFileSync(path.join(ROOT, '_data/sign_scrawl.json'), 'utf8'));
const KEEPERS = (ORDER.ORDER || ORDER.order || ORDER);

const strip = h => h
  .replace(/<span class="cup o"[^>]*>⟅<\/span>/g, '⟅')
  .replace(/<span class="cup c"[^>]*>⟆<\/span>/g, '⟆')
  .replace(/<span class="pc"[^>]*>\s*<\/span>/g, ' ')
  .replace(/<span class="step"[^>]*>([^<]*)<\/span>/g, ' [$1] ')
  .replace(/<span class="lbl"[^>]*>([^<]*)<\/span>/g, '$1\t')
  .replace(/<span class="say"[^>]*>([^<]*)<\/span>/g, '   — $1')
  // a sign shows as the NUMBER the message sends for it, then its name. Never a bare name: the
  // number is checkable against the wire, the name is only what the attribute claims. See scrawl.js.
  .replace(/<span class="gl sg"[^>]*data-s="([^"]*)"[^>]*>[^<]*<\/span>/g,
    (_, n) => scrawlMap[n] ? `⟨${label(scrawlMap[n])} ${n}⟩` : `⟨?? ${n}⟩`)
  .replace(/<span class="coin gl w"[^>]*data-sign="([^"]*)"[^>]*>([^<]*)<\/span>/g, '«$2»')
  .replace(/<[^>]+>/g, '')
  .replace(/&mdash;/g, '—').replace(/&middot;/g, '·').replace(/&#39;/g, "'")
  .replace(/[ \t]+$/gm, '');

function load(name) {
  const html = fs.readFileSync(path.join(PROSE, name + '.html'), 'utf8');
  const blocks = JSON.parse(fs.readFileSync(path.join(PROSE, name + '.blocks.json'), 'utf8'));
  return { html, blocks };
}
// which pass each marker sits in, and the prose immediately before/after it
function context(html, n) {
  const m = html.indexOf(`{{EX:${n}}}`);
  if (m < 0) return { pass: '?', before: '(marker not referenced)', after: '' };
  const passes = STAMP.all(html.slice(0, m));
  const pass = passes.length ? passes[passes.length - 1] : '?';
  const ps = [...html.slice(0, m).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)];
  const nx = html.slice(m).match(/<p[^>]*>([\s\S]*?)<\/p>/);
  const clean = s => s ? s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
  return { pass, before: clean(ps.length ? ps[ps.length - 1][1] : ''), after: clean(nx && nx[1]) };
}
const kind = b => (b.match(/class="([a-z][a-z -]*)"/) || [, '?'])[1];

const args = process.argv.slice(2);
if (args[0] === '--all' || !args.length) {
  for (const k of KEEPERS) {
    const { html, blocks } = load(k);
    const kinds = {};
    Object.values(blocks).forEach(b => { const t = kind(b); kinds[t] = (kinds[t] || 0) + 1; });
    const orphan = Object.keys(blocks).filter(n => !html.includes(`{{EX:${n}}}`));
    console.log(`  ${k.padEnd(12)} ${String(Object.keys(blocks).length).padStart(3)} exhibits  ` +
      Object.entries(kinds).map(([t, n]) => `${t}×${n}`).join(' ') +
      (orphan.length ? `   ⚠ UNREFERENCED: ${orphan.join(',')}` : ''));
  }
  process.exit(0);
}

const name = args[0];
if (!KEEPERS.includes(name)) { console.error(`unknown keeper "${name}" — one of: ${KEEPERS.join(' ')}`); process.exit(2); }
const { html, blocks } = load(name);

if (args[1] === undefined) {
  Object.entries(blocks).forEach(([n, b]) => {
    const c = context(html, n);
    const first = strip(b).split('\n').map(s => s.trim()).filter(Boolean)[1] || '';
    console.log(`  EX:${n.padEnd(24)} §${String(c.pass).padEnd(4)} ${kind(b).padEnd(11)} ${first.slice(0, 52)}`);
  });
  process.exit(0);
}

const n = args[1];
if (!blocks[n]) {
  console.error(`${name} has no EX:${n}\n  names: ${Object.keys(blocks).join(' ')}`);
  process.exit(2);
}
const c = context(html, n);
const hands = [...blocks[n].matchAll(/data-hand="([^"]*)"/g)].map(m => m[1]);
const codes = [...blocks[n].matchAll(/data-code="(\d+)"/g)].map(m => m[1]);

console.log(`\n${name}  EX:${n}   §${c.pass}   <${kind(blocks[n])}>`);
console.log(`  wire rows: ${codes.length}${codes.length ? ' (rendered from data-code)' : ''}` +
            `   hand rows: ${hands.length}${hands.length ? ' — ' + [...new Set(hands)].join(', ') : ''}`);
console.log(`\n  lead-in:  …${c.before.slice(-150)}`);
console.log('\n' + strip(blocks[n]).split('\n').filter(s => s.trim()).map(s => '    ' + s.trim()).join('\n'));
if (c.after) console.log(`\n  after:    ${c.after.slice(0, 150)}…`);
console.log();
