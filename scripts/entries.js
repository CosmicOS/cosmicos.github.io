/* WALKING THE ENTRIES OF AN ARC FILE, in one place.
 *
 * Four scripts each hand-rolled `/<div class="entry"[^>]*id="(p\d+)"[\s\S]*?(?=<div class="entry"|$)/g`,
 * already in three slightly different forms — one without the id, one that brace-matched the body
 * instead. The same hole `arc-order.js` and `stamp.js` were made to close: the entry head's shape is
 * one export now, and nothing re-derives it.
 *
 *   split(src)   each entry from its head to the next head (or end of file)
 *   bodies(src)  the same entries, but only what is INSIDE the entry div (brace-matched)
 *
 * Both give { id, pass, html, index }. `index` is the offset of the head in `src`.
 */
'use strict';

/* the entry head. Capture group 1 is the pass number. Not global — clone with
 * `new RegExp(HEAD.source, 'g')` to walk a file. */
const HEAD = /<div class="entry"[^>]*\bid="p(\d+)"[^>]*>/;

function heads(src) {
  const re = new RegExp(HEAD.source, 'g');
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push({ pass: +m[1], id: 'p' + m[1], index: m.index, end: re.lastIndex });
  return out;
}

/* head to next head. What an audit scanning for coin spans wants: everything the entry is
 * responsible for, including the exhibits under it. */
function split(src) {
  const hs = heads(src);
  return hs.map((h, i) => ({
    id: h.id, pass: h.pass, index: h.index,
    html: src.slice(h.index, i + 1 < hs.length ? hs[i + 1].index : src.length),
  }));
}

/* only what is inside the entry div, found by counting divs. Stricter than split(): trailing
 * content after the last entry in a file is not part of it. */
function bodies(src) {
  return heads(src).map(h => {
    const tag = /<div\b[^>]*>|<\/div>/g;
    tag.lastIndex = h.end;
    let depth = 1, t;
    while (depth > 0 && (t = tag.exec(src))) depth += t[0] === '</div>' ? -1 : 1;
    const stop = depth === 0 ? tag.lastIndex - '</div>'.length : src.length;
    return { id: h.id, pass: h.pass, index: h.index, html: src.slice(h.end, stop) };
  });
}

module.exports = { HEAD, heads, split, bodies };
