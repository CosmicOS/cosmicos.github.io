/* ---- listener: message renderer + the peel ----
   Logic only. Data (her marks + sign glyphs) is injected by the page as `window.LISTENER`
   (a tiny inline <script> with liquid), since liquid does not run inside a .js file. */

/* modular message renderer: render(fragment, notation)
   A shown message is DATA (raw `code` tones + `parse` tree, straight from msg.json).
   A notation is a function fragment->html. Add notations here; glyphs live in CSS (:root). */
(function () {
  var DATA  = window.LISTENER || {};
  var SCRAWL= DATA.scrawl || {};   // wire sign name -> its real spider-scrawl glyph(s) — THE BASE (what she writes before understanding)
  var STR   = DATA.strings|| {};   // string literal -> its glyph sequence (the substrate carries what she can't read)
  var COINED = {};                 // sign -> token, built LINEARLY as we walk the page: a `.coin` span in the prose
                                   // (where the keeper coins a shorthand) switches that sign on FROM THAT POINT down.
                                   // THE source of truth for coining. Re-coining = a later `.coin` for the same sign wins.
  var allFigures = false;          // "in plain figures": force EVERY sign to its own figure (one source w/ hand mode, so the two can't disagree)
  var WIRE  = DATA.wire   || {};   // code -> {parse, spider} for data-code widgets (looked up client-side, not baked)
  var TONE  = { '0':'˩','1':'˨','2':'˦','3':'˥' };
  function wireOf(el){ var c = el.getAttribute('data-code'); return (c && WIRE[c]) ? WIRE[c] : {}; }
  function tones(code){                        // RAW: the four-symbol stream, in real tone chars (copy-pasteable)
    var s = ''; for (var i = 0; i < code.length; i++) s += TONE[code.charAt(i)] || '?';
    return '<span class="tones">' + s + '</span>';
  }
  function num(bits){                          // a number -> packed bits (place-value)
    return bits.map(function(b){ return '<span class="bit">'+(b==='1'?'▪':'▫')+'</span>'; }).join('');
  }
  // number rendering is FORM-DRIVEN: a (unary …) form -> ● tallies (counting era); a bare int -> packed bits.
  function tally(n){ n=Math.abs(Number(n)); var s=''; for(var i=0;i<n;i++){ if(i>0&&i%5===0) s+='<span class="gp"></span>'; s+='<span class="tk">●</span>'; } return s+'<span class="tk z">◦</span>'; }
  function unaryVal(items){ var c=0; for(var i=1;i<items.length;i++) if(String(items[i])==='1') c++; return c; }  // (unary 1 1 0) -> 2
  function bitsOf(n){ return num(Math.abs(Number(n)).toString(2).split('')); }
  var foldMode = false, foldMax = Infinity;        // fold: break+indent nested makings (per data-fold); foldMax caps depth
  function indent(d){ var s=''; for(var i=0;i<d;i++) s+='   '; return s; }
  function scrawlSpan(name){ return SCRAWL[name] ? '<span class="scrawl sign-fb">'+SCRAWL[name]+'</span>' : '<span class="gl" style="opacity:.4">▩</span>'; }
  function mark(name){                             // a bound var -> its slot; else her token (once introduced); else the sign in spider scrawl
    if (slots && (name in slots)) return '<span class="gl">'+slots[name]+'</span>';  // bound-var name (e.g. (x) from assign) -> slot
    if (allFigures) return scrawlSpan(name);                                         // plain-scrawl view: every sign as its scrawl
    if (COINED[name] !== undefined) { var t=COINED[name];                                 // she has coined it (a `.coin` span above, in reading order) -> her token
      return '<span class="gl'+(/[a-z]/i.test(t)?' w':'')+'">'+t+'</span>'; }              //   a WORD token (has letters) gets `.w` so it reads as her coined word, not a glyph
    if (name.indexOf(':')>0)                                                             // an uncoined COMPOUND — operation OR name — render its parts as a pill w/ · joins,
      return '<span class="fam">'+name.split(':').map(function(p){ return /^-?\d+$/.test(p)?bitsOf(p):mark(p); }).join('<span class="fj">·</span>')+'</span>';  //   so the part-count is legible (no opaque glyph-run)
    return scrawlSpan(name);                                                             // else: the sign in real spider scrawl (the base)
  }
  // bound names (lambda params / $var refs) -> HER established slot-marks (§300: ◌ a slot, ⬚ another), not the sender's letters
  var SLOTS=['◌','⬚','○','◔'], slots, slotN;   // hollow slot-marks, no numerals
  function resetSlots(){ slots={}; slotN=0; }
  function slot(name){ if (COINED[name] !== undefined) return mark(name);  // an already-coined sign, not a fresh lambda slot
    if(!(name in slots)) slots[name]=SLOTS[slotN++] || '⬚';
    return '<span class="gl">'+slots[name]+'</span>'; }
  function strblob(s){                          // a string -> its glyph sequence (substrate); bytes-in-cup only if unmapped
    var t=s.replace(/^"|"$/g,'');
    if (STR[t]) return '<span class="scrawl">'+STR[t]+'</span>';
    var b='';
    for (var i=0;i<t.length;i++){ b += ('0000000'+t.charCodeAt(i).toString(2)).slice(-8); }
    return '<span class="cup o">⟅</span>'+b.split('').map(function(x){ return '<span class="bit">'+(x==='1'?'▪':'▫')+'</span>'; }).join('')+'<span class="cup c">⟆</span>';
  }
  function hand(node, depth){                   // HAND: a parse node -> her marks
    depth = depth || 0;
    if (!Array.isArray(node)){
      var s=String(node);
      if (slots && (s in slots)) return mark(s);                                  // a hinted/bound name (incl. compound) -> her coined glyph, wins over family
      if (/^-?\d+$/.test(s)) return bitsOf(node);
      if (s.charAt(0)==='"') return strblob(s);                                   // string -> opaque byte-blob
      return mark(s);                                                            // a sign OR a :-compound (name or op) -> mark(), which pills+dots any compound
    }
    if (node[0]===-2){ var rn=node[1]; return (slots && (rn in slots)) ? '<span class="gl">'+slots[rn]+'</span>' : mark(rn); }  // $ref: a bound lambda-slot, else a free NAME (scrawl/token)
    var items = (node[0]===-1) ? node.slice(1) : node;         // strip grouping marker
    return form(items, true, depth+1);                        // group -> may be cupped, one level deeper
  }
  function form(items, cupped, depth){          // render a form; special heads, else a (cupped) sequence
    depth = depth || 0;
    var kids = function(arr){ return arr.map(function(n){ return hand(n, depth); }).join(' '); };
    var head = items[0];
    if (head==='unary')  return tally(unaryVal(items));                                // a counting-era number -> tallies
    if (head==='vector') return '<span class="cup lo">⟦</span>'+kids(items.slice(1))+'<span class="cup lc">⟧</span>';  // a list
    if (Array.isArray(head) && head[0]==='list')  // (list N) e1 e2 … -> her strung list, an alien (ogham) feather-bracket, NOT human [a,b,c]
      return '<span class="lst o">᚛</span>'+kids(items.slice(1))+'<span class="lst c">᚜</span>';
    if (head==='s' && items.length===2 && String(items[1]).charAt(0)==='"'){       // a string -> its glyph blob (substrate)
      var sc=String(items[1]).replace(/^"|"$/g,''); if (STR[sc]) return '<span class="scrawl">'+STR[sc]+'</span>'; }
    if (head==='?'||head==='lambda')                                  // a lambda: its parameter IS an anonymous slot
      return mark(head)+' '+slot(items[1])+' '+kids(items.slice(2));
    if (head==='define'||head==='@'||head==='make'||head==='assign')  // binds a NAME -> render it as a sign (scrawl/token), not a hollow slot
      return mark(head)+' '+mark(items[1])+' '+kids(items.slice(2));
    var body = kids(items);
    if (!cupped) return body;
    var cup = '<span class="cup o">⟅</span>'+body+'<span class="cup c">⟆</span>';
    return (foldMode && depth>0 && depth<=foldMax) ? '\n'+indent(depth)+cup : cup;   // fold: nested making onto its own indented line
  }
  var MODES = {
    raw:   function(el){ return tones(el.getAttribute('data-code') || el.getAttribute('data-tones')); },
    // the message in its OWN signs: render the parse with every sign forced to its figure — same source & renderer as
    // hand mode, so a sign draws identically in both (hand just swaps CRACKED signs for her marks). NOT the octo `spider`
    // (that's a byte-level transliteration whose figures disagreed with the per-sign ones).
    glyph: function(el){ allFigures = true; resetSlots();
      var h = form(wireOf(el).parse || JSON.parse(el.getAttribute('data-parse')), false); allFigures = false; return h; },
    hand:  function(el){ resetSlots(); return form(wireOf(el).parse || JSON.parse(el.getAttribute('data-parse')), false); }
  };
  function renderVal(v){                       // what a fragment YIELDS (from Evaluate), in her marks
    if (v===true)  return '<span class="gl">⬥</span>';
    if (v===false) return '<span class="gl">⬦</span>';
    if (typeof v==='number') return num(Math.abs(v).toString(2).split(''));
    return '';
  }
  var LABEL = { raw:'as it comes', glyph:'in plain figures', hand:'in my hand' };
  function renderMsg(el){                       // a .msg widget: lay every way-of-showing out at once, labeled
    var modes = (el.getAttribute('data-modes')||'hand,glyph,raw').split(',');
    modes.forEach(function(mode){
      var row = document.createElement('div'); row.className = 'msg-line';
      row.innerHTML = '<span class="lbl">'+(LABEL[mode]||mode)+'</span><span class="msg-view">'+MODES[mode](el)+'</span>';
      el.appendChild(row);
    });
    var val = el.getAttribute('data-value');
    if (val !== null) {
      var vs = document.createElement('div'); vs.className = 'msg-line msg-val';
      vs.innerHTML = '<span class="lbl">gives</span><span class="msg-view">'+renderVal(JSON.parse(val))+'</span>';
      el.appendChild(vs);
    }
  }
  function renderRow(el){                        // a generated <div class="row" data-parse|data-code> -> her hand, one line
    var p = el.getAttribute('data-parse');
    var parse = p ? JSON.parse(p) : (wireOf(el).parse || null);
    if (!parse) return;
    allFigures = false; resetSlots();
    var fm = el.getAttribute('data-fold');
    foldMode = el.hasAttribute('data-fold'); foldMax = (fm && /^\d+$/.test(fm)) ? +fm : Infinity;
    el.innerHTML = form(parse, false, 0);
    foldMode = false;
  }

  /* ONE walk, in DOCUMENT ORDER — this is what makes coining linear/positional. A `.coin` span
     sits in the prose exactly where the keeper coins a shorthand; passing it switches that sign
     on (COINED) from there down. Every exhibit after it shows the token; everything before shows
     raw scrawl. The token itself is the span's own visible glyph — no duplication, no pass numbers.
     `.sg` prose marks (is/int) and `.msg`/`.row` exhibits all render through the same COINED map. */
  Array.prototype.forEach.call(
    document.querySelectorAll('.coin[data-sign], .msg, .row[data-parse], .row[data-code], .sg[data-s]'),
    function(el){
      if (el.classList.contains('coin')) { COINED[el.getAttribute('data-sign')] = (el.textContent||'').trim(); return; }
      if (el.classList.contains('msg')) { renderMsg(el); return; }
      if (el.classList.contains('sg'))  { allFigures = false; resetSlots(); el.innerHTML = mark(el.getAttribute('data-s')); return; }
      renderRow(el);
    }
  );
})();

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
      ? 'feeling it out — ⌂ ' + tag[room] + (fresh ? ', a room I had not yet touched' : '')
      : 'the whole shape of it, felt, and the round it keeps';
    prev = room;
  }
  function step() { visit(round[at]); at = (at + 1) % round.length; }

  seeker.style.transition = 'none';                     // place at the start without a glide
  moveTo(start); prev = start;
  rooms[start].g.classList.add('seen', 'here'); mapped = 1;
  sayEl.textContent = 'under my hand where it was set going — ⌂ ' + tag[start];
  box.getBoundingClientRect();                          // flush, then restore the transition
  seeker.style.transition = '';
  seeker.classList.add('on');

  function play()  { playing = true;  toggle.textContent = 'pause'; if (!timer) timer = setInterval(step, 1100); }
  function pause() { playing = false; toggle.textContent = 'play';  if (timer) { clearInterval(timer); timer = null; } }
  toggle.addEventListener('click', function () { if (playing) pause(); else play(); });
  stepB.addEventListener('click', function () { if (playing) pause(); step(); });
  playing = false; toggle.textContent = 'play';   // start paused: step-driven (reading/tracing), not auto-running
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
    if (r1 === r2) { box.classList.add('meet'); sayEl.textContent = 'they cross — ⌂ ' + tag[r1]; setTimeout(function () { box.classList.remove('meet'); }, 750); }
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
  stepB.addEventListener('click', function () { if (playing) pause(); step(); });
  playing = false; toggle.textContent = 'play';   // start paused: step-driven (reading/tracing), not auto-running
})();

/* wire quotes (§193 etc.): render <div class="frag" data-code="…" data-view="tones|cups"> to
   REAL characters at load — copy-pasteable, source stays clean. data-code is the literal wire. */
(function () {
  var TONE = { '0': '˩', '1': '˨', '2': '˦', '3': '˥' };
  function tones(code) {
    var s = ''; for (var i = 0; i < code.length; i++) s += TONE[code.charAt(i)] || '?';
    return '<span class="tones">' + s + '</span>';
  }
  function cups(code) {                      // 1-before-2 = a lone marker outside the cup; 2/3 = cups; else bits
    var out = [], bits = '';
    function flush() { if (bits) { var b = ''; for (var j = 0; j < bits.length; j++) b += bits.charAt(j) === '1' ? '▪' : '▫';
      out.push('<span class="bit">' + b + '</span>'); bits = ''; } }
    for (var i = 0; i < code.length; i++) { var d = code.charAt(i);
      if (d === '1' && code.charAt(i + 1) === '2') { flush(); out.push('<span class="bit">▪</span>'); }
      else if (d === '2') { flush(); out.push('<span class="cup">⟅</span>'); }
      else if (d === '3') { flush(); out.push('<span class="cup">⟆</span>'); }
      else bits += d;
    }
    flush(); return out.join(' ');
  }
  Array.prototype.forEach.call(document.querySelectorAll('.frag[data-code]'), function (el) {
    var code = el.getAttribute('data-code'), view = el.getAttribute('data-view');
    if (!code || !view) return;
    var html = view === 'tones' ? tones(code) : view === 'cups' ? cups(code) : '';
    if (html) el.insertAdjacentHTML('beforeend', html);   // appended after the <span class="lbl">
  });
})();
