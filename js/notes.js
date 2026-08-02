/* notes.js — double-tap a word, leave a note, and it lands in the shared queue.
 *
 * Silent unless scripts/notes-server.py is serving this page: it probes /api/notes once and, if
 * anything at all goes wrong, does nothing and never touches the DOM again. So the published
 * static site and the render-check harness are unaffected — no console errors, no widget.
 *
 * The anchor is captured from the page, not typed: nearest [id] ancestor (p193, station-book…),
 * the tapped word, and ~160 characters of surrounding text, which is enough to find the spot again.
 */
(function () {
  'use strict';
  var API = '/api/notes', on = false, notes = [], pop = null, sel = null;

  var css = [
    /* double-tap-to-zoom eats the second tap on a phone, so the gesture never reaches us.
       manipulation keeps scroll and pinch and drops only the zoom-on-double-tap. */
    'body{touch-action:manipulation}',
    /* on a phone the composer sits at the foot of the screen: anchoring it under the word puts it
       behind the keyboard as soon as the textarea focuses. */
    '@media (max-width:640px){.nt-pop{position:fixed!important;left:8px!important;right:8px!important;',
    '  bottom:10px!important;top:auto!important;width:auto!important}}',
    '.nt-dot{position:absolute;width:9px;height:9px;border-radius:50%;background:#e0a33c;',
    '  box-shadow:0 0 0 2px rgba(224,163,60,.25);cursor:pointer;z-index:60}',
    '.nt-mark{background:rgba(224,163,60,.18);border-bottom:1px dashed #c68a2e;border-radius:2px}',
    '.nt-pop{position:absolute;z-index:70;width:min(340px,92vw);background:#0d1219;color:#dde3ea;',
    '  border:1px solid #33506080;border-radius:9px;padding:10px 11px;box-shadow:0 10px 30px #0009;',
    '  font-family:Georgia,serif;font-size:14px;line-height:1.45}',
    '.nt-pop .nt-anchor{font-family:"inconsolataregular",monospace;font-size:11px;letter-spacing:.12em;',
    '  text-transform:uppercase;color:#7f9bab;margin-bottom:7px}',
    '.nt-pop textarea{width:100%;box-sizing:border-box;min-height:74px;background:#080c11;color:#e6ecf2;',
    '  border:1px solid #2a3a45;border-radius:5px;padding:7px 8px;font:inherit;resize:vertical}',
    '.nt-pop .nt-row{display:flex;gap:8px;margin-top:8px;align-items:center}',
    '.nt-pop button{font:inherit;font-size:13px;padding:4px 12px;border-radius:5px;cursor:pointer;',
    '  border:1px solid #2a3a45;background:#16202a;color:#cdd6df}',
    '.nt-pop button.nt-send{background:#274557;border-color:#3a6076;color:#eaf2f6}',
    '.nt-pop .nt-hint{color:#6b8494;font-size:11.5px;margin-left:auto}',
    '.nt-old{border-top:1px solid #23323d;margin-top:9px;padding-top:8px;font-size:13px;color:#b7c4cf}',
    '.nt-old b{color:#e0a33c;font-weight:normal;font-family:monospace}',
    '.nt-badge{position:fixed;right:14px;bottom:14px;z-index:80;background:#16202a;color:#cdd6df;',
    '  border:1px solid #33506080;border-radius:20px;padding:6px 13px;font-family:monospace;',
    '  font-size:12px;cursor:pointer;box-shadow:0 4px 14px #0007}',
    '.nt-badge b{color:#e0a33c}',
    '.nt-badge i{font-style:normal;color:#7fd18d}',
    '.nt-badge.nt-hot{border-color:#3e7a4d}',
    /* a word you left a note on, so the answer comes back where the question was */
    '.nt-mark{background:rgba(224,163,60,.14);border-bottom:1px dotted #b8862f;cursor:pointer}',
    '.nt-mark.nt-answered{background:rgba(127,209,141,.18);border-bottom:1px solid #5aa06c}',
    '.nt-mark.nt-flash{animation:ntflash 1.4s ease-out 1}',
    '@keyframes ntflash{0%{background:rgba(127,209,141,.55)}100%{background:rgba(224,163,60,.14)}}',
    '.nt-pop .nt-mine{color:#dde3ea;margin:2px 0 6px}',
    '.nt-pop .nt-reply{color:#a9c6b1;border-left:2px solid #3e7a4d;padding-left:9px;margin:6px 0 2px}',
    '.nt-pop .nt-waiting{color:#6b8494;font-style:italic;font-size:13px}',
    '.nt-panel .nt-item{border-top:1px solid #23323d;padding:8px 0;cursor:pointer}',
    '.nt-panel .nt-item:hover{background:#121a22}',
    '.nt-panel .nt-item b{color:#7f9bab;font-family:monospace;font-weight:normal}',
    '.nt-panel .nt-w{color:#e0a33c;font-family:monospace;font-size:12px}',
    '.nt-panel .nt-new{font-style:normal;color:#7fd18d;font-size:11px;border:1px solid #3e7a4d;',
    '  border-radius:9px;padding:0 6px;margin-left:5px}',
    /* sits above the note badge, same corner, so a reload is always a thumb away */
    '.nt-reload{bottom:52px;background:#2a3a20;border-color:#5a7a3e;color:#d8e6c4}',
    '.nt-panel .nt-lost{color:#c98b5a;font-size:12px;font-style:italic;margin:3px 0}',
    '.nt-edited{color:#8fd6a2;font-family:monospace;font-size:11.5px;letter-spacing:.05em;margin:6px 0 0}',
    '.nt-noedit{color:#7a8b96;font-family:monospace;font-size:11.5px;letter-spacing:.05em;margin:6px 0 0}',
    '.nt-sep{border-top:1px solid #23323d;margin:10px 0 8px}'
  ].join('');

  function style() {
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }

  /* ---- find the word under a point (touch) or in the selection (mouse) ---- */
  function isWordChar(c) { return c && /[A-Za-z0-9'’‐-―-]/.test(c); }

  function rangeAtPoint(x, y) {
    var r = null, p;
    if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(x, y);
    else if (document.caretPositionFromPoint) {
      p = document.caretPositionFromPoint(x, y);
      if (p) { r = document.createRange(); r.setStart(p.offsetNode, p.offset); r.collapse(true); }
    }
    if (!r || r.startContainer.nodeType !== 3) return null;
    var node = r.startContainer, t = node.data, a = r.startOffset, b = r.startOffset;
    while (a > 0 && isWordChar(t[a - 1])) a--;
    while (b < t.length && isWordChar(t[b])) b++;
    if (a === b) return null;
    var out = document.createRange(); out.setStart(node, a); out.setEnd(node, b);
    return out;
  }

  function describe(range) {
    var word = range.toString().trim();
    if (!word) return null;
    var el = range.startContainer.parentElement;
    /* Section id first; but a dispatch has no id, so notes on those came back as "—". Fall back to
       the entry's own stamp ("Pass 191 · later"), which is what a reader would say anyway. */
    var sec = el && el.closest('[id]'), name = sec ? sec.id : null;
    if (!name) {
      var entry = el && el.closest('.entry, .taking-up, .register');
      var stamp = entry && entry.querySelector('.stamp, .tu-head, .reg-title');
      if (stamp) name = stamp.textContent.replace(/\s+/g, ' ').trim();
    }
    var block = el && el.closest('p,div.row,div.tally,div.readback,li,h2,.reg-c,.cap,.say') || el;
    var full = (block ? block.textContent : word).replace(/\s+/g, ' ').trim();
    var i = full.indexOf(word), ctx = full;
    if (i >= 0) ctx = full.slice(Math.max(0, i - 70), Math.min(full.length, i + word.length + 70));
    return {
      page: location.pathname, section: name,
      anchor: word, context: ctx, rect: range.getBoundingClientRect()
    };
  }

  /* ---- the composer ---- */
  function close() { if (pop) { pop.remove(); pop = null; sel = null; } }

  function open(d) {
    close(); sel = d;
    pop = document.createElement('div');
    pop.className = 'nt-pop';
    var prior = notes.filter(function (n) {
      return n.status === 'open' && n.anchor === d.anchor && n.section === d.section;
    });
    pop.innerHTML =
      '<div class="nt-anchor">' + (d.section ? d.section + ' &middot; ' : '') +
      '&ldquo;' + d.anchor.replace(/[<&]/g, '') + '&rdquo;</div>' +
      '<textarea placeholder="what about it?"></textarea>' +
      '<div class="nt-row"><button class="nt-send">send</button>' +
      '<button class="nt-cancel">cancel</button>' +
      '<span class="nt-hint">⌘/Ctrl+Enter</span></div>' +
      prior.map(function (n) {
        return '<div class="nt-old"><b>#' + n.id + '</b> ' + n.body.replace(/[<&]/g, '') + '</div>';
      }).join('');
    document.body.appendChild(pop);

    var top = window.scrollY + d.rect.bottom + 8, left = window.scrollX + d.rect.left;
    left = Math.max(8, Math.min(left, document.documentElement.clientWidth - pop.offsetWidth - 8));
    pop.style.top = top + 'px'; pop.style.left = left + 'px';

    var ta = pop.querySelector('textarea');
    ta.focus();
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
      if (e.key === 'Escape') close();
    });
    pop.querySelector('.nt-send').addEventListener('click', send);
    pop.querySelector('.nt-cancel').addEventListener('click', close);
  }

  function send() {
    var ta = pop && pop.querySelector('textarea');
    if (!ta || !ta.value.trim() || !sel) return;
    var d = sel, text = ta.value;
    ta.disabled = true;
    fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: d.page, section: d.section, anchor: d.anchor,
                             context: d.context, body: text })
    }).then(function (r) { return r.json(); })
      .then(function (j) {
        notes.push({ id: j.id, status: 'open', section: d.section, anchor: d.anchor,
                     context: d.context, body: text, reply: null });
        close(); reanchor(); badge();
      })
      .catch(function () { ta.disabled = false; });
  }

  /* ---- REPLIES.  A note you left is answered somewhere else entirely, and coming back to a
     terminal to collect answers is the thing this widget exists to avoid.  So an answered note
     comes back to the word it was left on: the word is marked, and tapping it shows the reply.
     `seen` is per-browser (localStorage) and holds the ids whose reply you have already opened,
     so "3 answered" means three you have not read yet, not three that exist. ---- */
  var SEEN = 'nt-seen';
  function seen() { try { return JSON.parse(localStorage.getItem(SEEN)) || []; } catch (e) { return []; } }
  function markSeen(id) {
    var s = seen(); if (s.indexOf(id) < 0) { s.push(id); try { localStorage.setItem(SEEN, JSON.stringify(s)); } catch (e) {} }
  }
  function unread() {
    var s = seen();
    return notes.filter(function (n) { return n.reply && s.indexOf(n.id) < 0; });
  }

  /* put a mark back on the word a note was left on, so the reply is where the question was */
  function reanchor() {
    document.querySelectorAll('.nt-mark').forEach(function (m) {
      m.replaceWith(document.createTextNode(m.textContent));
    });
    notes.forEach(function (n) {
      if (!n.anchor) return;
      var scope = n.section && document.getElementById(n.section);
      if (!scope) {
        // no id (a dispatch): find the entry whose stamp matches the stored section text
        var all = document.querySelectorAll('.entry, .taking-up, .register');
        for (var i = 0; i < all.length; i++) {
          var st = all[i].querySelector('.stamp, .tu-head, .reg-title');
          if (st && st.textContent.replace(/\s+/g, ' ').trim() === n.section) { scope = all[i]; break; }
        }
      }
      if (!scope) return;
      /* Two notes on the same word: the first wraps it, and the walker then skips that text, so the
         second went off and marked a DIFFERENT occurrence of the word. A mark holds a list now. */
      var already = scope.querySelectorAll('.nt-mark');
      for (var q = 0; q < already.length; q++) {
        if (already[q].textContent === n.anchor) {
          var owner = notes.filter(function (o) {
            return (',' + already[q].getAttribute('data-nt') + ',').indexOf(',' + o.id + ',') >= 0;
          })[0];
          if (owner && owner.context === n.context) {
            already[q].setAttribute('data-nt', already[q].getAttribute('data-nt') + ',' + n.id);
            if (!n.reply) already[q].classList.remove('nt-answered');
            n._lost = false; return;
          }
        }
      }
      var walk = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT),
          best = null, bestScore = -1, node, multi = 0;
      while ((node = walk.nextNode())) {
        if (node.parentElement.closest('.nt-pop, .nt-mark')) continue;
        var at = node.data.indexOf(n.anchor);
        while (at >= 0) {
          // pick the occurrence whose surroundings look most like the stored context
          var around = node.data.slice(Math.max(0, at - 40), at + n.anchor.length + 40);
          var score = 0, ctx = (n.context || '');
          for (var k = 0; k + 8 <= around.length; k++) if (ctx.indexOf(around.substr(k, 8)) >= 0) score++;
          multi++;
          if (score > bestScore) { bestScore = score; best = { node: node, at: at }; }
          at = node.data.indexOf(n.anchor, at + 1);
        }
      }
      /* THE TEXT MOVES UNDER THE NOTES.  A note is usually about a sentence that is then rewritten,
         so the anchor word may be gone, or may now occur somewhere else entirely.  Two rules:
         never guess (a note parked on the wrong word is worse than one parked on none), and never
         drop it silently — a lost anchor still shows in the panel with the text it was left on. */
      if (!best || (bestScore === 0 && multi > 1)) { n._lost = true; return; }
      n._lost = false;
      var r = document.createRange();
      r.setStart(best.node, best.at); r.setEnd(best.node, best.at + n.anchor.length);
      var span = document.createElement('span');
      span.className = 'nt-mark' + (n.reply ? ' nt-answered' : '');
      span.setAttribute('data-nt', n.id);
      try { r.surroundContents(span); } catch (e) { return; }
      span.addEventListener('click', function (e) { e.stopPropagation(); thread(span); });
    });
  }

  /* DID THE BOOK MOVE?  A reply that changed the text and a reply that only explained it read the
     same otherwise, and which one you are looking at is the first thing worth knowing. Green and a
     pen when something was edited, with the change named; flat grey when nothing was. */
  function verdict(n) {
    if (n.changed) return '<div class="nt-edited">&#9998; changed &middot; ' +
      String(n.changed).replace(/[<&]/g, '') + '</div>';
    return '<div class="nt-noedit">answered &middot; nothing edited</div>';
  }

  /* the note and its reply, shown at the word */
  function thread(el) {
    close();
    var ids = (el.getAttribute('data-nt') || '').split(',').map(Number);
    var mine = notes.filter(function (n) { return ids.indexOf(n.id) >= 0; });
    mine.forEach(function (n) { markSeen(n.id); });
    badge();
    el.classList.remove('nt-answered');
    pop = document.createElement('div');
    pop.className = 'nt-pop';
    pop.innerHTML = mine.map(function (n, i) {
      return (i ? '<div class="nt-sep"></div>' : '') +
        '<div class="nt-anchor">#' + n.id + ' &middot; ' + (n.section || '') +
        ' &middot; ' + (n.status === 'done' ? 'answered' : 'open') + '</div>' +
        '<div class="nt-mine">' + n.body.replace(/[<&]/g, '') + '</div>' +
        (n.reply ? verdict(n) + '<div class="nt-reply">' + n.reply.replace(/[<&]/g, '') + '</div>'
                 : '<div class="nt-waiting">no reply yet</div>');
    }).join('') +
      '<div class="nt-row"><button class="nt-cancel">close</button></div>';
    document.body.appendChild(pop);
    var rect = el.getBoundingClientRect();
    pop.style.top = (window.scrollY + rect.bottom + 8) + 'px';
    pop.style.left = Math.max(8, Math.min(window.scrollX + rect.left,
      document.documentElement.clientWidth - pop.offsetWidth - 8)) + 'px';
    pop.querySelector('.nt-cancel').addEventListener('click', close);
  }

  /* ---- the badge: open count, and unread replies ---- */
  function badge() {
    var b = document.querySelector('.nt-badge');
    if (!b) {
      b = document.createElement('div'); b.className = 'nt-badge';
      b.addEventListener('click', panel);
      document.body.appendChild(b);
    }
    var o = notes.filter(function (n) { return n.status === 'open'; }).length, u = unread().length;
    b.innerHTML = '<b>' + o + '</b> open' + (u ? ' <i>' + u + ' answered</i>' : '');
    b.classList.toggle('nt-hot', !!u);
  }

  /* the whole thread list, newest first, each jumping to its word */
  function panel() {
    close();
    var s = seen();
    pop = document.createElement('div');
    pop.className = 'nt-pop nt-panel';
    pop.innerHTML = '<div class="nt-anchor">notes</div>' +
      (notes.length ? notes.slice().reverse().map(function (n) {
        return '<div class="nt-item" data-go="' + n.id + '">' +
          '<b>#' + n.id + '</b> <span class="nt-w">' + (n.anchor || '').replace(/[<&]/g, '') + '</span>' +
          (n.reply && s.indexOf(n.id) < 0 ? ' <i class="nt-new">new</i>' : '') +
          (n._lost ? '<div class="nt-lost">text has changed since &mdash; it was on: &ldquo;'
             + (n.context || '').replace(/[<&]/g, '') + '&rdquo;</div>' : '') +
          '<div class="nt-mine">' + n.body.replace(/[<&]/g, '') + '</div>' +
          (n.reply ? verdict(n) + '<div class="nt-reply">' + n.reply.replace(/[<&]/g, '') + '</div>' : '') +
          '</div>';
      }).join('') : '<div class="nt-waiting">nothing yet</div>') +
      '<div class="nt-row"><button class="nt-cancel">close</button></div>';
    document.body.appendChild(pop);
    pop.style.position = 'fixed'; pop.style.right = '14px'; pop.style.bottom = '56px';
    pop.style.left = 'auto'; pop.style.top = 'auto'; pop.style.maxHeight = '70vh';
    pop.style.overflowY = 'auto';
    pop.querySelector('.nt-cancel').addEventListener('click', close);
    pop.querySelectorAll('.nt-item').forEach(function (it) {
      it.addEventListener('click', function () {
        var id = +it.getAttribute('data-go');
        var m = document.querySelector('.nt-mark[data-nt="' + id + '"]');
        markSeen(id); close(); badge();
        if (m) { m.scrollIntoView({ block: 'center' }); m.classList.remove('nt-answered'); m.classList.add('nt-flash'); }
      });
    });
  }

  /* ---- RELOADING WITHOUT LEAVING YOUR PLACE.
     Pull-to-refresh needs the top of the page, which is a long way up and loses your place when
     you get there. So: the server reports the built page's mtime, we notice when it moves, and
     offer a reload that puts you back. Not automatic — being yanked mid-sentence is worse than
     scrolling. The place is kept as an ENTRY, not a pixel offset, because the edit that triggered
     the reload has almost certainly changed the page's height. ---- */
  var VERSION = null, PLACE = 'nt-place';

  function keepPlace() {
    var best = null;
    document.querySelectorAll('.entry, .taking-up, .register').forEach(function (e) {
      var t = e.getBoundingClientRect().top;
      if (t < 120 && (!best || t > best.top)) best = { top: t, el: e };
    });
    var st = best && best.el.querySelector('.stamp, .tu-head, .reg-title');
    try {
      sessionStorage.setItem(PLACE, JSON.stringify({
        id: best ? best.el.id : null,
        stamp: st ? st.textContent.replace(/\s+/g, ' ').trim() : null,
        into: best ? Math.round(-best.top) : 0
      }));
    } catch (e) {}
  }

  function restorePlace() {
    var p; try { p = JSON.parse(sessionStorage.getItem(PLACE)); } catch (e) { return; }
    if (!p) return;
    try { sessionStorage.removeItem(PLACE); } catch (e) {}
    var el = p.id && document.getElementById(p.id);
    if (!el && p.stamp) {
      var all = document.querySelectorAll('.entry, .taking-up, .register');
      for (var i = 0; i < all.length; i++) {
        var s = all[i].querySelector('.stamp, .tu-head, .reg-title');
        if (s && s.textContent.replace(/\s+/g, ' ').trim() === p.stamp) { el = all[i]; break; }
      }
    }
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + (p.into || 0));
  }

  function reload() { keepPlace(); location.reload(); }

  function stale() {
    var b = document.querySelector('.nt-reload');
    if (b) return;
    b = document.createElement('div');
    b.className = 'nt-badge nt-reload';
    b.innerHTML = '↻ page changed';
    b.addEventListener('click', reload);
    document.body.appendChild(b);
  }

  function checkVersion() {
    fetch('/api/version?page=' + encodeURIComponent(location.pathname))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (VERSION === null) VERSION = j.v;
        else if (j.v && j.v !== VERSION) stale();
      }).catch(function () {});
  }

  /* pick up replies without a reload */
  function poll() {
    checkVersion();
    fetch(API + '?page=' + encodeURIComponent(location.pathname))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var before = JSON.stringify(notes);
        notes = j.notes || [];
        if (JSON.stringify(notes) !== before) { reanchor(); badge(); }
      }).catch(function () {});
  }

  /* ---- input: double-click (desk) and double-tap (touch) ---- */
  function wire() {
    document.addEventListener('dblclick', function (e) {
      if (e.target.closest && e.target.closest('.nt-pop')) return;
      var s = window.getSelection();
      if (!s || s.isCollapsed || !s.rangeCount) return;
      var d = describe(s.getRangeAt(0));
      if (d) open(d);
    });

    var last = 0, lx = 0, ly = 0;
    document.addEventListener('touchend', function (e) {
      if (e.target.closest && e.target.closest('.nt-pop')) return;
      var t = e.changedTouches && e.changedTouches[0]; if (!t) return;
      var now = Date.now();
      if (now - last < 320 && Math.abs(t.clientX - lx) < 26 && Math.abs(t.clientY - ly) < 26) {
        var r = rangeAtPoint(t.clientX, t.clientY);
        if (r) { var d = describe(r); if (d) { e.preventDefault(); open(d); } }
        last = 0;
      } else { last = now; lx = t.clientX; ly = t.clientY; }
    }, { passive: false });

    document.addEventListener('mousedown', function (e) {
      if (pop && !e.target.closest('.nt-pop')) close();
    });
  }

  fetch(API + '?page=' + encodeURIComponent(location.pathname))
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (j) {
      on = true; notes = j.notes || [];
      style(); wire(); reanchor(); badge(); restorePlace(); checkVersion();
      setInterval(poll, 15000);          /* replies land while you are still reading */
    })
    .catch(function () { /* not served by notes-server.py — stay invisible */ });
})();
