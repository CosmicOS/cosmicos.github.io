/* listener-widgets.js — the standalone pieces of the lesson: the exhibits that are their own little
 * worlds, the link furniture on an entry head, and the sweep that puts the keepers' numerals over
 * every arabic digit in the diary.
 *
 * SPLIT OUT OF js/listener.js ON 08-12, and the reason is that it was never joined to it. Nothing
 * here touches the renderer's closure — no notation state, no ladder, no `mark()`. It reached 1,386
 * lines in one file because it all arrived through the same door, not because it belongs together,
 * and a 900-line function with six unrelated worlds parked behind it is where a section gets
 * inserted into the wrong scope (which is exactly what happened to the tap panel on 08-11).
 *
 * The ONE thing it wants from listener.js is `reckonNum`, which is a top-level declaration there and
 * so is on the page by the time this runs. Load order is index.html's: listener.js, then this.
 */
/* A button whose label changes is a button that changes width, and these bars are centered, so the
   play/pause toggle slid every button beside it along the row each time it was pressed — under the
   finger of a reader who is pressing the same button over and over. Give it the width of its widest
   label, measured from the button itself rather than declared in the stylesheet: the wording, the
   font and the font-size all move, and a hard-coded width silently stops matching any of them.
   (`ch` is not the answer either — in this face a character advance is not one ch.)
   The twin of this lives in js/circuit-sim.js, for the let-it-run/rest toggle. */
function pinWidth(btn, labels) {
  if (!btn) return;
  var was = btn.textContent, w = 0;
  labels.forEach(function (t) { btn.textContent = t; w = Math.max(w, btn.getBoundingClientRect().width); });
  btn.textContent = was;
  // getBoundingClientRect measures the border box, so say min-width in the same terms or the padding
  // gets counted twice and every pinned button comes out a padding too wide.
  if (w) { btn.style.boxSizing = 'border-box'; btn.style.minWidth = Math.ceil(w) + 'px'; }
}

/* the seeker's map (§619): the least-recently-seen patrol, drawn and followed.
   World + walk are the real message (msg.json #1420-1448): rooms 0..4, four doors, start at 2. */
(function () {
  var box = document.getElementById('seekmap');
  if (!box) return;
  box.classList.add('reveal');                          // JS present: dim the undiscovered (else full map shows)
  var seeker = document.getElementById('seekmap-seeker');
  var sayEl  = document.getElementById('seekmap-say');
  var toggle = document.getElementById('seekmap-toggle');
  var stepB  = document.getElementById('seekmap-step');
  var rooms = {};
  Array.prototype.forEach.call(box.querySelectorAll('.room'), function (g) {
    rooms[g.getAttribute('data-room')] = { g: g, x: +g.getAttribute('data-x'), y: +g.getAttribute('data-y') };
  });
  var doorEls = box.querySelectorAll('.door');
  function doorOf(a, b) {
    var found = null, k1 = a + '-' + b, k2 = b + '-' + a;
    Array.prototype.forEach.call(doorEls, function (d) {
      var k = d.getAttribute('data-door'); if (k === k1 || k === k2) found = d;
    });
    return found;
  }
  var tag = { '0': '▫', '1': '▪', '2': '▪▫', '3': '▪▪', '4': '▪▫▫' };
  var start = '2';                                       // set going in the stairs (msg #1444)
  var round = ['4', '2', '0', '3', '0', '1', '0', '2'];  // its walk (msg #1448)
  var at = 0, prev = null, mapped = 0, timer = null, playing = true;

  function moveTo(room) { var r = rooms[room]; seeker.setAttribute('cx', r.x); seeker.setAttribute('cy', r.y); }
  function visit(room) {
    var g = rooms[room].g, fresh = !g.classList.contains('seen');
    if (prev !== null) { var d = doorOf(prev, room); if (d) d.classList.add('seen'); }
    g.classList.add('seen');
    Object.keys(rooms).forEach(function (k) { rooms[k].g.classList.remove('here'); });
    g.classList.add('here');
    moveTo(room);
    g.classList.add('press'); setTimeout(function () { g.classList.remove('press'); }, 200);
    if (fresh) mapped++;
    sayEl.textContent = mapped < 5
      ? 'feeling it out — the room ' + tag[room] + (fresh ? ', a room I had not yet touched' : '')
      : 'the whole shape of it, felt, and the round it keeps';
    prev = room;
  }
  function step() { visit(round[at]); at = (at + 1) % round.length; }

  seeker.style.transition = 'none';                     // place at the start without a glide
  moveTo(start); prev = start;
  rooms[start].g.classList.add('seen', 'here'); mapped = 1;
  sayEl.textContent = 'under my feet where it was set going — the room ' + tag[start];
  box.getBoundingClientRect();                          // flush, then restore the transition
  seeker.style.transition = '';
  seeker.classList.add('on');

  function play()  { playing = true;  toggle.textContent = 'pause'; if (!timer) timer = setInterval(step, 1100); }
  function pause() { playing = false; toggle.textContent = 'play';  if (timer) { clearInterval(timer); timer = null; } }
  toggle.addEventListener('click', function () { if (playing) pause(); else play(); });
  pinWidth(toggle, ['play', 'pause']);
  stepB.addEventListener('click', function () { if (playing) pause(); step(); });
  playing = false; toggle.textContent = 'play';   // start paused: step-driven (reading/tracing), not auto-running
})();

/* the engine walking a strip (§501). Every number below is transcribed off the wire, not invented:
   the TABLE is msg.json #1176 (demo:tape:function:+:1), the STRIP is the one #1177 runs it on, and the
   step rule is #1169 (tape:do) over #1167 (tape:next) — read the cell under the stone, look the pair up
   in the table for the condition you stand in, write, step, pass into the next condition, stop at end.
   In #1167 the step code is 1=on, 0=back, anything else=stand still. Keep it that way. */
(function () {
  var box = document.getElementById('engine');
  if (!box) return;
  var stone  = document.getElementById('engine-stone');
  var condEl = document.getElementById('engine-cond');
  var sayEl  = document.getElementById('engine-say');
  var toggle = document.getElementById('engine-toggle');
  var stepB  = document.getElementById('engine-step');

  var BLANK = null;                                  // the empty cell: (vector) on the wire
  /* Two rules, and the engine cannot tell them apart — which is the entry's whole point. The first is
     the wire's (#1176) and counts the strip up by one. The second is the plainest of Senn's own, three
     lines, and turns every mark over. Both are checked in her text: the wire's takes 1001 to 1010, hers
     takes 1001 to 0110. */
  var RULES = [{
    name: 'the rule that came out of the sky',
    table: {                                         // condition -> mark read -> [next condition, step, write]
      'out':  { '1': ['out',  1, '1'], '0': ['out',  1, '0'], 'b': ['add',  0, 'b'] },
      'add':  { '1': ['add',  0, '0'], '0': ['home', 0, '1'], 'b': ['end',  2, '1'] },
      'home': { '1': ['home', 0, '1'], '0': ['home', 0, '0'], 'b': ['end',  1, 'b'] },
      'end':  {}
    },
    say: { out:  'running out to the far end, setting down what it found',
           add:  'the end. Turn back, and add one',
           home: 'the marks are set. It is only walking home',
           end:  'and it stopped, and the strip stood changed' }
  }, {
    name: 'the plainest rule I could write',
    table: {
      'out':  { '1': ['out',  1, '0'], '0': ['out',  1, '1'], 'b': ['end',  2, 'b'] },
      'end':  {}
    },
    say: { out:  'turning over every mark it meets',
           end:  'and it stopped, and the strip stood changed' }
  }];
  var which = 0, TABLE = RULES[0].table, SAY = RULES[0].say;
  var CELLS = {}, MIN = -1, MAX = 4;
  Array.prototype.forEach.call(box.querySelectorAll('.cell'), function (g) {
    CELLS[g.getAttribute('data-i')] = { g: g, mk: g.querySelector('.mk'),
                                        x: +g.querySelector('rect').getAttribute('x') + 27 };
  });

  var strip, at, cond, halted;
  function reset() {
    strip = { '-1': BLANK, '0': '1', '1': '0', '2': '0', '3': '1', '4': BLANK };  // #1177's strip
    at = 0; cond = 'out'; halted = false;
    draw(); condEl.classList.remove('done'); box.classList.remove('idle');
    sayEl.textContent = 'the stone on the first cell, and ' + RULES[which].name + ' on the page';
  }
  function glyph(v) { return v === BLANK ? '' : (v === '1' ? '▪' : '▫'); }
  function draw() {
    for (var i = MIN; i <= MAX; i++) {
      var c = CELLS[i]; if (!c) continue;
      c.mk.textContent = glyph(strip[i]);
      c.g.classList.toggle('blank', strip[i] === BLANK);
      c.g.classList.toggle('at', i === at);
    }
    stone.setAttribute('cx', CELLS[at] ? CELLS[at].x : 0);
    condEl.textContent = halted ? 'the condition that means halt' : SAY[cond];
  }
  function step() {
    if (halted) { reset(); return; }
    var read = strip[at] === BLANK ? 'b' : strip[at];
    var row = TABLE[cond] && TABLE[cond][read];
    if (!row) { halted = true; draw(); return; }
    var wrote = row[2] === 'b' ? BLANK : row[2], changed = wrote !== strip[at];
    strip[at] = wrote;
    var cell = CELLS[at];
    if (cell && changed) { cell.g.classList.add('wrote'); setTimeout(function () { cell.g.classList.remove('wrote'); }, 220); }
    var moved = row[1] === 1 ? 1 : (row[1] === 0 ? -1 : 0);
    var wasReading = read === 'b' ? 'nothing' : (read === '1' ? 'one' : 'none');
    var nowWriting = wrote === BLANK ? 'nothing' : (wrote === '1' ? 'one' : 'none');
    at = Math.max(MIN, Math.min(MAX, at + moved));
    cond = row[0];
    halted = (cond === 'end');
    box.classList.toggle('idle', cond === 'home');
    draw();
    sayEl.textContent = halted
      ? SAY.end
      : 'reading ' + wasReading + ': write ' + nowWriting + ', '
        + (moved === 1 ? 'step on' : moved === -1 ? 'step back' : 'stand where I stood');
    if (halted) { condEl.classList.add('done'); pause(); }
  }

  var timer = null, playing = false;
  function play()  { playing = true;  toggle.textContent = 'pause'; if (!timer) timer = setInterval(step, 900); }
  function pause() { playing = false; toggle.textContent = 'play';  if (timer) { clearInterval(timer); timer = null; } }
  toggle.addEventListener('click', function () { if (playing) pause(); else play(); });
  pinWidth(toggle, ['play', 'pause']);
  stepB.addEventListener('click', function () { if (playing) pause(); step(); });
  var swapB = document.getElementById('engine-swap');
  if (swapB) swapB.addEventListener('click', function () {
    pause(); which = (which + 1) % RULES.length;
    TABLE = RULES[which].table; SAY = RULES[which].say; reset();
  });

  stone.style.transition = 'none'; reset(); box.getBoundingClientRect();
  stone.style.transition = ''; stone.classList.add('on');
})();

/* self-linking headers: click a pass title to pin the URL to its anchor (and copy the link) */
(function () {
  Array.prototype.forEach.call(document.querySelectorAll('.entry[id]'), function (entry) {
    var id = entry.id, h2 = entry.querySelector('h2');
    if (!h2) return;
    var a = document.createElement('a');
    a.className = 'anchor-link'; a.href = '#' + id; a.textContent = '#';
    a.setAttribute('aria-label', 'link to this pass');
    h2.appendChild(a);
    var timer = null;
    function flash(msg) {
      a.textContent = msg; a.classList.add('flash');
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { a.textContent = '#'; a.classList.remove('flash'); }, 1500);
    }
    function pin(e) {
      if (e) e.preventDefault();
      if (history.replaceState) history.replaceState(null, '', '#' + id); else location.hash = id;
      var url = location.origin + location.pathname + '#' + id;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { flash('link copied'); },
                                                function () { flash('url set — copy from the bar'); });
      } else { flash('url set — copy from the bar'); }
    }
    a.addEventListener('click', pin);
    h2.addEventListener('click', function (e) { if (e.target !== a) pin(e); });
  });
})();

/* THE URL FOLLOWS THE PASS YOU ARE READING, so the address bar is always the link to where you are
   and there is nothing to find and click first. `replaceState`, never `pushState`: the back button
   has to leave the page, not walk you up eighty-nine entries. It also does not move the view, which
   `location.hash = …` would — this must be able to run mid-scroll without touching the scroll.
   Nothing on the page styles `:target`, so a passing entry does not light up as you go by.
   The title is still clickable; that one also copies the link and says so. */
(function () {
  if (!history.replaceState) return;
  var entries = [].slice.call(document.querySelectorAll('.entry[id]'));
  if (!entries.length) return;
  var bare = location.pathname + location.search, at = null, queued = false;

  var lastIdx = 0;
  function current() {
    /* the pass you are READING is the last one whose head has gone by, not the one filling the most
       screen: a long entry's exhibits would otherwise keep the previous pass in the bar for
       screenfuls after you had left it. The line sits a third of the way down, where the eye is.

       WALK FROM WHERE THE ANSWER WAS, not from the top of the book. This used to scan from entry
       zero every frame, so the cost grew with how far the reader had got: measured, 4 forced layout
       reads per scroll frame in the founder's watch, 22 in the middle, 47 in Lio's — the page got
       heavier the longer you read it, which is precisely backwards. Scrolling is incremental and the
       answer moves by a step, so start from the last one and step. It still reads live layout, so
       nothing goes stale when an exhibit opens or a font lands. */
    var line = window.innerHeight * 0.33;
    var i = Math.min(lastIdx, entries.length - 1);
    while (i + 1 < entries.length && entries[i + 1].getBoundingClientRect().top <= line) i++;
    while (i >= 0 && entries[i].getBoundingClientRect().top > line) i--;
    lastIdx = i < 0 ? 0 : i;
    return i < 0 ? null : entries[i];
  }
  function update() {
    queued = false;
    var el = current(), id = el ? el.id : null;
    if (id === at) return;
    /* NOTHING ABOVE THE LINE YET. Clear the anchor only when the reader is genuinely at the top of
       the page — never merely because no entry qualifies. Someone arriving on `…/#p595`
       is at the top for the instant before the browser jumps, and clearing there would throw away
       the very link they followed. */
    if (id === null && window.pageYOffset > 4) return;
    at = id;
    history.replaceState(null, '', id ? '#' + id : bare);
  }
  function onScroll() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  /* NOT run on load: the browser has its own anchor jump to make, and whatever is in the bar when
     the reader arrives is already right. The first scroll takes it from there. */
})();

/* the geo-world (§619): two seekers in a looping world; they cross at the hub.
   World, starts, and the meeting are the real message (msg.json #1832-1858); the round is its own rule, run on. */
(function () {
  var box = document.getElementById('geomap');
  if (!box) return;
  box.classList.add('reveal');
  var sayEl = document.getElementById('geomap-say');
  var toggle = document.getElementById('geomap-toggle');
  var stepB = document.getElementById('geomap-step');
  var s1 = document.getElementById('geomap-s1'), s2 = document.getElementById('geomap-s2');
  var rooms = {};
  Array.prototype.forEach.call(box.querySelectorAll('.room'), function (g) {
    rooms[g.getAttribute('data-room')] = { g: g, x: +g.getAttribute('data-x'), y: +g.getAttribute('data-y') };
  });
  var doorEls = box.querySelectorAll('.door');
  function doorOf(a, b) {
    var f = null, k1 = a + '-' + b, k2 = b + '-' + a;
    Array.prototype.forEach.call(doorEls, function (d) { var k = d.getAttribute('data-door'); if (k === k1 || k === k2) f = d; });
    return f;
  }
  var tag = { '0': '▫', '1': '▪', '2': '▪▫', '3': '▪▪' };
  var start1 = '1', round1 = ['2', '3', '2', '0', '1'];   // from dublin
  var start2 = '3', round2 = ['2', '0', '1', '2', '3'];   // from genoa
  var at = 0, prev1 = null, prev2 = null, timer = null, playing = true;

  function moveTo(sel, room, dx) { var r = rooms[room]; sel.setAttribute('cx', r.x + dx); sel.setAttribute('cy', r.y); }
  function ink(room, prev) { if (prev !== null) { var d = doorOf(prev, room); if (d) d.classList.add('seen'); } rooms[room].g.classList.add('seen'); }
  function press(room) { var g = rooms[room].g; g.classList.add('press'); setTimeout(function () { g.classList.remove('press'); }, 200); }
  function step() {
    var r1 = round1[at], r2 = round2[at];
    ink(r1, prev1); ink(r2, prev2);
    moveTo(s1, r1, -5); moveTo(s2, r2, 5);
    Object.keys(rooms).forEach(function (k) { rooms[k].g.classList.remove('here'); });
    rooms[r1].g.classList.add('here'); rooms[r2].g.classList.add('here');
    press(r1); if (r2 !== r1) press(r2);
    if (r1 === r2) { box.classList.add('meet'); sayEl.textContent = 'they cross — the room ' + tag[r1]; setTimeout(function () { box.classList.remove('meet'); }, 750); }
    else sayEl.textContent = 'two, each on a round of its own';
    prev1 = r1; prev2 = r2; at = (at + 1) % round1.length;
  }

  s1.style.transition = 'none'; s2.style.transition = 'none';
  moveTo(s1, start1, -5); moveTo(s2, start2, 5);
  rooms[start1].g.classList.add('seen'); rooms[start2].g.classList.add('seen');
  prev1 = start1; prev2 = start2;
  box.getBoundingClientRect();
  s1.style.transition = ''; s2.style.transition = '';
  s1.classList.add('on'); s2.classList.add('on');
  sayEl.textContent = 'two seekers, set going in a world that loops';

  function play()  { playing = true;  toggle.textContent = 'pause'; if (!timer) timer = setInterval(step, 1100); }
  function pause() { playing = false; toggle.textContent = 'play';  if (timer) { clearInterval(timer); timer = null; } }
  toggle.addEventListener('click', function () { if (playing) pause(); else play(); });
  pinWidth(toggle, ['play', 'pause']);
  stepB.addEventListener('click', function () { if (playing) pause(); step(); });
  playing = false; toggle.textContent = 'play';   // start paused: step-driven (reading/tracing), not auto-running
})();

/* THE BOOK HAS NO ARABIC NUMERALS — the sweep that draws every figure in the keepers' own.
   (The wire-quote renderer that used to wrap this lived here with its own copy of the tone map and
   its own names for the pitches; it is folded into the one ladder above, `data-at`.) */
/* THE BOOK HAS NO ARABIC NUMERALS. Every figure in it — a pass in a stamp, a pass cited in a
   sentence, a count in one of Ren's tally rows — goes down in the keepers' own numerals, which are
   older than the post and are simply how these people write a number. Arabic digits in the source
   are an editing convenience (they grep, they sort, they match the `#pNNN` anchors); this pass is
   where they stop being the reader's problem.

   WHY HERE AND NOT IN `_prose`: a scrawl numeral typed into the prose is a fact to keep true by
   hand, it cannot be searched, and it puts the anchor and its text out of step the day an entry
   moves. The source stays plain, so adding an entry stays one line.

   Two jobs, because the same sweep may as well do both:
     - a three-figure number WITH an entry on the page becomes a quiet link to it. The book cross-
       references constantly ("at 297", "since 239") and by the late watches sends a reader four
       hundred passes back. The anchor is CHECKED first, so a reference to a pass that has no entry
       of its own (a dispatch, a margin note) stays plain rather than becoming a dead jump.
     - everything else becomes a plain numeral.
   Linking is confined to prose hosts. A stamp must not link, or every entry heading becomes a
   link to itself.

   READING IT BACK. Both kinds carry the figure as a `title`, so hovering says it in the reader's
   own numerals. Touch has no hover, so a plain numeral also toggles `.showing` on tap; a link
   doesn't need it, since following it is the better answer to "which pass is this". Nor does a
   sign, since 08-12 — the panel is the better answer there, and the toggler below leaves it alone.

   TEXT NODES ONLY, collected before any are replaced — never an attribute, and never inside a
   rendered exhibit, where a digit would belong to the message rather than to a keeper. */
(function keeperNumerals(){
  /* THE RULE IS STATED AS AN EXCLUSION, ON PURPOSE. Listing the places a number may appear means
     every new page-form — a letter, a board, a ledger somebody rules in a later watch — quietly
     keeps its arabic until somebody notices. (That is how §621's margin note kept four.) So:
     everything in the diary, EXCEPT what the message renderer drew, where a digit would belong to
     the wire and not to a keeper. A `.lbl` is authored prose even though it sits inside a drawn
     exhibit, so it comes back in. */
  /* DRAWN = carries wire data. Keyed on the attribute rather than on `.row`, because that is what
     makes a row the wire's — it is what build-frags checks too, so the gate and the renderer agree
     about which rows came from the message. A hand row has no such attribute and is swept like any
     other writing: it is a keeper drawing a line of the wire in her own hand, figures and all. */
  /* `.raw-wire` is the message in its four-symbol form — digits by definition, and not a figure
     anybody wrote down, so the sweep leaves it exactly as it came. */
  var DRAWN   = '[data-code], [data-parse], .msg, .frag, .raw-wire';
  /* WHERE A FIGURE MUST NOT BECOME A LINK. A heading would link to its own entry; and every row of
     the cheat sheet is ALREADY an anchor to the pass it names, so linking the figure inside it
     produced `<a href="#p189"><b><a href="#p189">…</a></b> …</a>` — a nested anchor, which is
     invalid, and which the browser resolves by breaking the line, so every entry in the index had
     its number stranded on a line of its own. The figure still draws in her numerals and still says
     its value on hover; it is the surrounding row that carries the link. */
  var NO_LINK = '.stamp, .tu-head, .msg-index';
  var root = document.querySelector('.diary');
  if (!root) return;

  var ids = {};
  Array.prototype.forEach.call(document.querySelectorAll('[id]'), function(el){
    var m = /^p(\d+)$/.exec(el.id); if (m) ids[m[1]] = true;
  });

  var seen = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n;
  while ((n = w.nextNode())) {
    if (!/\d/.test(n.nodeValue)) continue;
    var host = n.parentElement; if (!host) continue;
    if (host.closest(DRAWN) && !host.closest('.lbl')) continue;
    seen.push([n, !host.closest(NO_LINK)]);
  }

  seen.forEach(function(pair){
    var node = pair[0], mayLink = pair[1], txt = node.nodeValue;
    var frag = document.createDocumentFragment(), last = 0, re = /\b(\d+)\b/g, m;
    while ((m = re.exec(txt))) {
      frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
      var v = m[1], el;
      if (mayLink && v.length === 3 && ids[v]) {
        el = document.createElement('a');
        el.className = 'passref'; el.href = '#p' + v; el.title = 'pass ' + v;
      } else {
        el = document.createElement('span');
        el.className = 'rknum gloss'; el.title = v; el.setAttribute('data-v', v);
      }
      el.innerHTML = reckonNum(v, true);                // barred: a figure a keeper writes is a count
      frag.appendChild(el); last = m.index + m[0].length;
    }
    if (!last) return;
    frag.appendChild(document.createTextNode(txt.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });

  /* THE BADGE IS FOR A GLOSS WITH NOWHERE BETTER TO SEND THE READER. A keeper's numeral has only
     the one thing to say, so a tap says it beside the figure and that is the whole answer. A SIGN
     no longer works that way: tapping one opens the panel, which gives the figure as the run the
     wire sent, both faces, and the pass — so a badge saying `sign 18` on top of it is the same
     question answered twice, in two boxes, one over the other. Signs carry `data-sid`; they are
     skipped here and answered there. */
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('.gloss');
    if (t && t.hasAttribute('data-sid')) t = null;
    Array.prototype.forEach.call(document.querySelectorAll('.gloss.showing'), function(el){
      if (el !== t) el.classList.remove('showing');     // one at a time, so taps don't litter the page
    });
    if (t) t.classList.toggle('showing');
  });
})();

