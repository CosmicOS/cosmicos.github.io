/* THE FOUR WIRE SYMBOLS, in one place.
 *
 * `0123` is how _data/msg.json stores a statement; `˩˨˦˥` is how the page and the tools show it.
 * The renderer draws from its own copy (js/listener.js is loaded by a browser and cannot require
 * this), so `--check` below asserts the two agree — inventory-marks already gates which SHAPES the
 * renderer may draw, but nothing gated the MAPPING, and a swapped pair there would render every
 * tone row wrong with every gate still green.
 *
 *   node scripts/tones.js --check
 */
'use strict';

const TONE = { '0': '˩', '1': '˨', '2': '˦', '3': '˥' };

/* the marks a keeper writes, back to the tones they came in as: ▪=1 ▫=0 ⟅=2 ⟆=3 */
const MARK = { '▫': TONE['0'], '▪': TONE['1'], '⟅': TONE['2'], '⟆': TONE['3'] };

const toneOf = code => [...code].map(c => TONE[c] || '?').join('');
const marksToTones = run => [...run].map(c => MARK[c]).join('');

module.exports = { TONE, MARK, toneOf, marksToTones };

if (require.main === module && process.argv.includes('--check')) {
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '../js/listener.js'), 'utf8');
  const m = /var TONE\s*=\s*\{([^}]*)\}/.exec(src);
  if (!m) {
    console.log('✗ tones: no `var TONE = {…}` found in js/listener.js');
    process.exit(1);
  }
  const theirs = {};
  for (const p of m[1].matchAll(/'(\d)'\s*:\s*'(.)'/g)) theirs[p[1]] = p[2];
  const keys = new Set([...Object.keys(TONE), ...Object.keys(theirs)]);
  const bad = [...keys].filter(k => TONE[k] !== theirs[k]);
  if (bad.length) {
    console.log('✗ tones: js/listener.js disagrees with scripts/tones.js on ' +
                bad.map(k => `${k} (${TONE[k] || '—'} vs ${theirs[k] || '—'})`).join(', '));
    process.exit(1);
  }
  console.log(`✓ tones: the renderer's four symbols match (${[...keys].sort().map(k => k + '=' + TONE[k]).join(' ')})`);
}
