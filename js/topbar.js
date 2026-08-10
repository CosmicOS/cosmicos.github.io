/* ---- the top bar: site nav everywhere, and on the story an arc of the eleven watches ----
   Built from the DOM (`section.watch`), so there is no roster here to fall out of step with
   `scripts/arc-order.js` — this file names no keeper and knows no pass.

   WIDTH IS HEIGHT. A segment is as wide as its watch is TALL, not as long in passes: every watch is
   about thirty-six passes, so a bar drawn from passes would be eleven equal blocks saying nothing.

   Runs AFTER js/listener.js, and must: the renderer redraws every row on load, so a height measured
   before that is the height of an empty page. It also borrows `reckonNum` from there. */
(function () {
  var bar = document.getElementById('topbar');
  if (!bar) return;

  /* ── MASTHEAD OR RULE ──
     TWO THRESHOLDS, because condensing takes ~90px out of a bar that is IN FLOW: the page shifts and
     the browser corrects the scroll by the same amount that triggered the change. With one line, a
     single press of the down arrow crossed it at 18px, condensed, was pulled back to 0, and expanded
     again. No single number can be stable. The gap must stay larger than the height given back. */
  var DOWN = 220, UP = 60;      // px. DOWN-UP must exceed the bar's masthead-to-condensed difference.
  var condensed = false;
  function setBar() {
    var y = window.pageYOffset;
    var want = condensed ? y >= UP : y > DOWN;   // stay until well past the OTHER line
    if (want === condensed) return;
    condensed = want;
    bar.classList.toggle('condensed', want);
  }
  /* ONE SCROLL LISTENER FOR THE WHOLE BAR, and one rAF gate. There were two of each — the condensing
     and the where-you-are — which is two handlers and two frames of work for one scroll. */
  var frameTick = false;
  function onScroll() {
    if (frameTick) return;
    frameTick = true;
    requestAnimationFrame(function () { frameTick = false; setBar(); update(); });
  }
  /* A PAGE OPENED AT A DEEP ANCHOR STARTS CONDENSED, and must not be seen unfolding into a masthead
     and collapsing again. The class goes on before the first paint the reader sees, and the
     transition is suppressed for that one frame so it is a state and not an animation. */
  bar.classList.add('tb-still');
  setBar();
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { bar.classList.remove('tb-still'); });
  });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measure(); setBar(); update(); });

  /* ── LAND THE ANCHOR JUMP AGAIN ONCE THE PAGE HAS STOPPED MOVING ──
     Following `…/#p595` lands the entry under the bar about one load in eight. The browser jumps to
     the fragment, and only THEN does the bar take its condensed state and the renderer finish
     drawing the rows — removing ~73px from above the target, which slides it up behind the bar with
     nothing to correct it. Measured: the entry sits at y=4 instead of y=78.
     So the jump is made again after the page settles. It is abandoned the moment the reader touches
     the page, because re-scrolling somebody who has started reading is worse than the bug. */
  if (location.hash.length > 1) {
    var landing = document.getElementById(location.hash.slice(1));
    if (landing) {
      var moved = false;
      var giveUp = function () { moved = true; };
      ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (e) {
        window.addEventListener(e, giveUp, { once: true, passive: true });
      });
      var land = function () { if (!moved) landing.scrollIntoView(); };   // honors scroll-margin-top
      requestAnimationFrame(function () { requestAnimationFrame(land); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(land);
      window.addEventListener('load', land);
    }
  }

  /* ── LETTING GO OF THE MENU. It opens on click (touch has no hover); this is only the other half,
     so that it stops being sticky once the reader has moved on. Everything here CLOSES — `<details>`
     does the opening and the keyboard, so with the script gone the menu still works. The grace timer
     is so that crossing the gap to the panel does not count as leaving. */
  var menu = bar.querySelector('.tb-menu');
  if (menu) {
    var summary = menu.querySelector('summary'), shutTimer = null;
    var hold = function () { clearTimeout(shutTimer); shutTimer = null; };
    var shut = function () { hold(); menu.open = false; };

    if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      menu.addEventListener('mouseleave', function () { hold(); shutTimer = setTimeout(shut, 400); });
      menu.addEventListener('mouseenter', hold);
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) { shut(); if (summary) summary.focus(); }
    });
    document.addEventListener('pointerdown', function (e) {
      if (menu.open && !menu.contains(e.target)) shut();
    });
  }

  var watches = [];
  Array.prototype.forEach.call(document.querySelectorAll('section.watch'), function (sec) {
    var entries = sec.querySelectorAll('.entry[id]');
    if (!entries.length) return;
    var passes = Array.prototype.map.call(entries, function (e) { return +e.id.slice(1); });
    watches.push({
      el: sec,
      name: sec.getAttribute('data-keeper') || '',
      first: passes[0], last: passes[passes.length - 1],
      entries: entries,
      seg: null, top: 0, height: 1
    });
  });
  /* NO WATCHES, NO INSTRUMENT — `measure` and `update` below simply do nothing, so the two listeners
     above stay one pair for every page. The bar itself is site furniture and every page has it;
     everything here is the story's own, which is why this file ADDS its elements rather than finding
     them and `_includes/header.html` needs to know nothing about the listener. */
  var keeperEl = null, passEl = null, arcEl = null;
  if (watches.length) buildArc();

  function buildArc() {
    var where = document.createElement('span'); where.className = 'tb-where';
    where.innerHTML = '<span class="tb-keeper"></span><span class="tb-pass"></span>';
    bar.querySelector('.tb-inner').appendChild(where);
    arcEl = document.createElement('div');
    arcEl.className = 'tb-arc';
    arcEl.setAttribute('role', 'navigation');
    arcEl.setAttribute('aria-label', 'the watches');
    bar.appendChild(arcEl);
    keeperEl = where.querySelector('.tb-keeper'); passEl = where.querySelector('.tb-pass');

    /* a segment's label says the keeper and her span in the READER's figures — this is the instrument,
       not the book, and nothing on it interprets a watch. */
    watches.forEach(function (w) {
      var seg = document.createElement('a');
      seg.className = 'tb-seg';
      seg.href = '#p' + w.first;
      seg.title = w.name + ' · ' + w.first + '–' + w.last;
      seg.setAttribute('aria-label', seg.title);
      arcEl.appendChild(seg);
      w.seg = seg;
    });
  }


  /* MEASURE ONCE PER LAYOUT — INCLUDING THE ENTRIES. A note here always said as much, and `update()`
     then read a `getBoundingClientRect()` per entry on every scroll frame, AFTER writing classes and
     a custom property to the segments in the same pass. Write-then-read in one frame forces a
     synchronous layout, so the handler the note exists to keep cheap was thrashing layout down a
     21,000px document. Entry offsets move only when the box does, so they belong here. */
  function measure() {
    watches.forEach(function (w) {
      var r = w.el.getBoundingClientRect();
      w.top = r.top + window.pageYOffset;
      w.height = Math.max(1, r.height);
      w.seg.style.flexGrow = w.height;
      w.tops = Array.prototype.map.call(w.entries, function (e) {
        return e.getBoundingClientRect().top + window.pageYOffset;
      });
    });
  }

  var shownPass = null, shownWatch = null;
  function update() {
    if (!watches.length) return;
    /* THE READING LINE is a third of the way down the viewport, not the top edge: what a reader is
       reading is what sits under their eye, and an entry whose head has just scrolled off the top
       is still the entry they are in. */
    var y = window.pageYOffset + window.innerHeight / 3;

    var cur = 0;
    for (var i = 0; i < watches.length; i++) if (y >= watches[i].top) cur = i;

    watches.forEach(function (w, i) {
      w.seg.classList.toggle('here', i === cur);
      w.seg.classList.toggle('done', i < cur);
    });
    /* the lit segment fills as the reader crosses that watch, so the bar answers "how far through
       this one" as well as "which one" */
    var w = watches[cur], f = (y - w.top) / w.height;
    w.seg.style.setProperty('--f', Math.max(0, Math.min(1, f)));

    var pass = w.first;
    for (var j = 0; j < w.tops.length; j++)          // cached in measure(); no layout read in here
      if (y >= w.tops[j]) pass = +w.entries[j].id.slice(1);

    if (w !== shownWatch) { keeperEl.textContent = w.name; shownWatch = w; }
    if (pass !== shownPass) {
      /* her numerals, barred like every count a keeper writes, with the figure on the title so a
         reader who has not learned them yet can still read the bar. */
      passEl.innerHTML = (typeof reckonNum === 'function') ? reckonNum(pass, true) : String(pass);
      passEl.title = 'pass ' + pass;
      shownPass = pass;
    }
  }

  measure(); update();
  /* an exhibit that opens or a font that lands late changes every height below it */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); update(); });
})();
