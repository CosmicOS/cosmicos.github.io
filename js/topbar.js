/* ---- listener: the top bar ----
   WHERE AM I IN FOUR HUNDRED PASSES. The book is one page, eleven watches and fifty-five entries,
   and a reader who scrolls into the middle of it has no way to answer "whose watch is this?" short
   of scrolling back to the last taking-up. Nothing else on the page does this job.

   IT IS BUILT FROM THE PAGE, NOT FROM A LIST. The watches come out of the DOM (`section.watch`),
   their spans out of the entries inside them, their widths out of their measured heights. There is
   no roster here to fall out of step with `scripts/arc-order.js` — this file names no keeper and
   knows no pass.

   WIDTH IS HEIGHT. A segment is as wide as its watch is TALL, not as wide as its watch is long in
   passes. Every watch is about thirty-six passes — a working life — so a bar drawn from passes
   would be eleven equal blocks saying nothing. Drawn from height it is the real shape of the book,
   and the lit segment is really where the reader is rather than where a count says they ought to be.

   It runs AFTER js/listener.js, and it has to: the renderer redraws every row on load, and a height
   measured before that is the height of an empty page. It also borrows `reckonNum` from there, so
   the pass on the bar goes down in the keepers' own numerals like every other figure in the book. */
(function () {
  var bar = document.getElementById('topbar');
  if (!bar) return;

  /* ── MASTHEAD OR RULE. Site-wide; everything after it is the story's. ──
     TWO THRESHOLDS, AND THE GAP BETWEEN THEM IS THE WHOLE FIX. Condensing takes ~90px of layout
     height out of a bar that is IN FLOW, so everything below jumps up and the browser adjusts the
     scroll to compensate. With one threshold that is a loop: measured, a single press of the down
     arrow scrolled to 18px, crossed the line, condensed, got pulled back to 0 by the adjustment,
     un-crossed the line, and expanded again — the reader taps down and the page bounces back to
     where it started. Nothing about that is fixable by choosing a better single number, because the
     scroll correction is the same size as the thing that triggers it.
     So: condense on the way DOWN past `DOWN`, expand on the way UP past `UP`, and keep the gap
     comfortably larger than the height the bar gives back. Then the correction can never carry the
     page back across the line it just crossed.
     (This replaced an IntersectionObserver on a sentinel at the top of the page. The observer was
     the cheaper instrument and answered the wrong question — it can say whether one point is on
     screen, and what this needs is two points and a memory of which way you were going.) */
  var DOWN = 220, UP = 60;      // px. DOWN-UP must exceed the bar's masthead-to-condensed difference.
  var condensed = null;
  function setBar() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    var want = condensed === null ? y > DOWN         // first call: whatever the page loaded at
             : condensed ? !(y < UP)                 // condensed: stay until well back up
             : y > DOWN;                             // masthead: stay until well down
    if (want === condensed) return;
    condensed = want;
    bar.classList.toggle('condensed', want);
  }
  /* ONE SCROLL LISTENER FOR THE WHOLE BAR. There were two, each with its own rAF gate — the
     condensing and the where-you-are — which meant two handlers and two frames of work for one
     scroll. Callbacks are collected here and the story pushes its own onto the same list. */
  var onFrame = [setBar], frameTick = false;
  function runFrame() {
    if (frameTick) return;
    frameTick = true;
    requestAnimationFrame(function () {
      frameTick = false;
      for (var i = 0; i < onFrame.length; i++) onFrame[i]();
    });
  }
  /* A PAGE OPENED AT A DEEP ANCHOR STARTS CONDENSED, and must not be seen unfolding into a masthead
     and collapsing again. The class goes on before the first paint the reader sees, and the
     transition is suppressed for that one frame so it is a state and not an animation. */
  bar.classList.add('tb-still');
  setBar();
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { bar.classList.remove('tb-still'); });
  });
  window.addEventListener('scroll', runFrame, { passive: true });
  window.addEventListener('resize', function () { remeasure(); runFrame(); });
  var onResize = [];                                  // things that must re-measure when the box moves
  function remeasure() { for (var i = 0; i < onResize.length; i++) onResize[i](); }

  /* ── LETTING GO OF THE MENU ──
     It OPENS on click, which is the device-agnostic answer: touch has no hover, a first tap on a
     hover-triggered menu gets eaten activating the hover state, and a menu that opens because the
     pointer crossed it opens when nobody asked. What was actually wrong was the other half — it had
     no way to close except pressing the button again, so it sat there after the reader had plainly
     moved on. So: open deliberately, DISMISS easily, which is the pairing every one of these wants.

     Three ways out, and the first is the one that makes it stop feeling sticky:
       - the pointer leaves it (only where a pointer really hovers), after a short grace so that
         crossing the gap between the button and the panel does not count as leaving;
       - Escape, which also puts focus back on the button where the reader left it;
       - a press anywhere else on the page.
     None of them is the keyboard's business — `<details>` already handles that, and this only ever
     CLOSES the element, so with the script gone the menu still opens and still works. */
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
  /* NO WATCHES, NO INSTRUMENT. The bar itself is site furniture and every page has it; everything
     below is the story's own and is built only where the story is. So this file adds its elements
     rather than finding them, and `_includes/header.html` needs to know nothing about the listener. */
  if (!watches.length) return;

  var where = document.createElement('span'); where.className = 'tb-where';
  where.innerHTML = '<span class="tb-keeper"></span><span class="tb-pass"></span>';
  bar.querySelector('.tb-inner').appendChild(where);
  var arcEl = document.createElement('div');
  arcEl.className = 'tb-arc';
  arcEl.setAttribute('role', 'navigation');
  arcEl.setAttribute('aria-label', 'the watches');
  bar.appendChild(arcEl);
  var keeperEl = where.querySelector('.tb-keeper'), passEl = where.querySelector('.tb-pass');

  /* THE GLOSS SAYS WHAT IS THERE AND NOTHING MORE — the same rule the marks obey. A segment's title
     is the keeper and her span, in the reader's own figures, because this is the instrument and not
     the book. Nothing here interprets a watch. */
  watches.forEach(function (w) {
    var seg = document.createElement('a');
    seg.className = 'tb-seg';
    seg.href = '#p' + w.first;
    seg.title = w.name + ' · ' + w.first + '–' + w.last;
    seg.setAttribute('aria-label', seg.title);
    arcEl.appendChild(seg);
    w.seg = seg;
  });

  /* MEASURE ONCE PER LAYOUT, NOT ONCE PER SCROLL. Reading offsetTop/offsetHeight inside a scroll
     handler forces a synchronous layout on every frame of a very long document; the numbers only
     change when the window does. */
  /* MEASURE ONCE PER LAYOUT — INCLUDING THE ENTRIES. The comment here always said that, and
     `update()` then read a `getBoundingClientRect()` per entry on every scroll frame, AFTER writing
     classes and a custom property to the segments in the same pass. Write-then-read in one frame
     forces a synchronous layout, so the handler this note exists to keep cheap was thrashing layout
     down a 21,000px document. Entry offsets move only when the box does, so they belong here. */
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
  onFrame.push(update);                  // the one scroll listener registered above drives this too
  onResize.push(measure);
  /* an exhibit that opens or a font that lands late changes every height below it */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); update(); });
})();
