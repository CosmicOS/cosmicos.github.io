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
  function rawUnary(items){                    // a count nobody has a shorthand for yet: every mark as it came
    var out = mark('unary');
    for (var i=1;i<items.length;i++)
      out += ' <span class="bit">▫</span><span class="cup o">⟅</span><span class="bit">'
           + (String(items[i])==='1' ? '▪' : '▫') + '</span><span class="cup c">⟆</span>';
    return out;
  }
  function unaryVal(items){ var c=0; for(var i=1;i<items.length;i++) if(String(items[i])==='1') c++; return c; }  // (unary 1 1 0) -> 2
  function bitsOf(n){ return num(Math.abs(Number(n)).toString(2).split('')); }   // the bits alone: a PAYLOAD, never a whole atom
  /* A COUNT IS AN ATOM AND HAS TO LOOK LIKE ONE. `hand()` used to write a plain number as its bits and
     nothing else — so `▫⟅▪⟆` came out `▪`, the tag and both cup marks gone, undeclared, from the first
     exhibit of §267 onward. Two things were wrong with that beyond the missing declaration:
       - The mark it KEPT is the payload; the mark it DROPPED is the one that says what kind of thing
         this is. Two paragraphs later the same entry recovers that distinction ("the mark in front
         says which sort you have: a name, or a plain count").
       - Every other abbreviation in the book substitutes a NEW mark for a fixed run of tones — `●` for
         `▫⟅▪⟆`, `◇` for `▫⟅⟆`, a reckoning mark for `▪⟅N⟆`. Those cannot be misread at any depth.
         Bare bits reuse the wire's OWN symbols one layer up, so `⟅▪▫▫⟆` stops having one reading.
     The same atom appeared twice in one row of §267 written two different ways — `▪` on the left of
     `= 1 (unary 1 0)` and `●` inside the run on the right. So: a count goes down as it comes, and any
     shortening of it has to be cut on the page like every other one. */
  function numAtomValue(n){        // the count itself, in whatever notation the page has reached
    var v = Math.abs(Number(n));
    if (!numeralsOn) return bitsOf(v);
    var d = []; do { d.unshift(v % 64); v = Math.floor(v / 64); } while (v > 0);
    return d.map(function(x){ return reckon(x, true); }).join('');
  }
  function numAtom(n){
    /* before §267 she has no mark for a count, so it goes down as it came: tag, cup, bits. */
    if (numeralsOn) return numAtomValue(n);
    return '<span class="bit">▫</span><span class="cup o">⟅</span>' + bitsOf(n) + '<span class="cup c">⟆</span>';
  }
  /* fold: break+indent nested makings (per data-fold). foldMax caps how DEEP breaking goes; foldMin sets a
     FLOOR, so the shallow scaffolding of a big statement can stay inline while the interesting run deeper
     down breaks one-per-line. Added 07-24: with a cap alone, a statement whose payload sits below its own
     setup had only two useless renderings — payload crammed on one line (cap low), or setup exploded into
     40 lines of scaffolding (cap high). data-fold="5-7" says: break only between those depths. */
  var foldMode = false, foldMin = 0, foldMax = Infinity;
  function indent(d){ var s=''; for(var i=0;i<d;i++) s+='   '; return s; }
  /* SCRAWL IS THEIR NUMERALS, AND A KEEPER CANNOT USE IT UNTIL SHE CAN READ A CUP AS A NUMBER.
     A sign arrives as a lone bit and a cup holding its id in bits. Writing that id in one glyph is
     transcription, but it needs place value, and Ren does not crack place value until §267. So
     before that a sign is written the only way it can be: as its run. After it the glyphs are
     available for every sign, meaning known or not, and the runs stop.
     POSITIONAL, keyed to `[data-numerals]`, like every other era switch in this file — NOT a pass
     number. It was `NUMERALS_FROM = 267`, which turned the glyphs on at the TOP of §267, four
     exhibits before she works out that she can write one: the reader met `⠉` on a row while the
     entry was still spelling out why a mark has a number at all. Same defect the founder's merged
     mark had at §232, and the same fix — the switch stands where she says the words. */
  var numeralsOn = false;
  /* THE FOUNDER'S MERGED MARK, AND WHAT COMES OF TAKING IT APART.
     §214 Maren defines `●`/`◦` for the small cups, and `tally` for `▫⟅⟆ ▪⟅▪▪▪⟆` TOGETHER — one word for the
     pair, because in every count she has, they stand together. That is a rule about the FRONT FORM only.
     A count also arrives cupped — `⟅ ▪⟅▪▪▪⟆ ▫⟅▪⟆ ▫⟅▫⟆ ⟆`, no empty cup — and there `tally` cannot apply and
     she has no name for the long run alone. So it goes down as it came: `⟅▪⟅▪▪▪⟆ ● ◦⟆`. Writing `⟅●◦⟆` there
     would be using a convention nobody has stated, which is exactly the nonsense this replaced.
     Ren splits the pair at §232 on the first such statement (39, `= (unary 1 0) (unary 1 0)`), keyed to
     `[data-split]` on her sentence — she argues her way to it two thirds of the way down the entry and
     everything above it is still written in Maren's hand.
     TWO SEPARATE SWITCHES, because the two runs earn their shorthands on different nights. `tal` is just a
     COINING of the sign `unary` (a `.coin[data-sign="unary"]` in her §232 prose), so `mark('unary')` picks it
     up like any other coined word — the run is all over her page and shortening it pays at once. The empty
     cup is NOT on her page that night; it is the piece that did not come. So it stays written out until §246,
     where it has arrived on its own often enough to be worth a mark, and `[data-nil]` switches `▫⟅⟆` to `◇`. */
  var splitOn = false, nilOn = false, MERGED = '<span class="nil w">tally</span>';
  // a sign's id, off its braille codepoint. The map is in scripts/scrawl.js.
  function idOf(name){
    var g = SCRAWL[name]; if (!g) return null;
    var m = /&#x([0-9a-f]+);/i.exec(g); if (!m) return null;
    if (/&#x[0-9a-f]+;.*&#x/i.test(g)) return null;      // a multi-glyph sign: leave it to the compound path
    var id = parseInt(m[1], 16) - 0x2840;
    return (id >= 0 && id < 64) ? id : null;
  }
  function runOf(name){                         // a sign as she can write it before she has numerals
    var id = idOf(name); if (id === null) return null;
    return '<span class="bit">▪</span><span class="cup o">⟅</span>'
      + id.toString(2).split('').map(function(b){ return '<span class="bit">'+(b==='1'?'▪':'▫')+'</span>'; }).join('')
      + '<span class="cup c">⟆</span>';
  }
  /* her reckoning mark for a value: bare for a name, barred for a count. Map: scripts/scrawl.js. */
  function reckon(v, barred){
    v = Number(v);
    if (!(v >= 0 && v < 64)) return '';
    // BARE or BARRED, and that is the tag. The sender draws a NAME's number bare and a COUNT's number
    // with a bar at the head and one at the foot — the same distinction the wire carries as `▪` or `▫`
    // in front of the cup, moved into the shape of the mark. `<span class="num barred" data-n="4">`.
    return '<span class="scrawl">&#x' + ((barred ? 0x28c0 : 0x2840) + v).toString(16) + ';</span>';
  }
  function scrawlSpan(name){
    if (!numeralsOn) { var r = runOf(name); if (r) return r; }
    return SCRAWL[name] ? '<span class="scrawl sign-fb">'+SCRAWL[name]+'</span>' : '<span class="gl" style="opacity:.4">▩</span>'; }
  function mark(name){                             // a bound var -> its slot; else her token (once introduced); else the sign in spider scrawl
    if (slots && (name in slots)) return '<span class="gl">'+slots[name]+'</span>';  // bound-var name (e.g. (x) from assign) -> slot
    if (allFigures) return scrawlSpan(name);                                         // plain-scrawl view: every sign as its scrawl
    if (COINED[name] !== undefined) { var t=COINED[name];                                 // she has coined it (a `.coin` span above, in reading order) -> her token
      return '<span class="gl'+(/[a-z]/i.test(t)?' w':'')+'">'+t+'</span>'; }              //   a WORD token (has letters) gets `.w` so it reads as her coined word, not a glyph
    if (name.indexOf(':')>0)                                                             // an uncoined COMPOUND — operation OR name — render its parts as a pill w/ · joins,
      return '<span class="fam">'+name.split(':').map(function(p){ return /^-?\d+$/.test(p)?bitsOf(p):mark(p); }).join('<span class="fj">·</span>')+'</span>';  //   so the part-count is legible (no opaque glyph-run)
    return scrawlSpan(name);                                                             // else: the sign in real spider scrawl (the base)
  }
  // bound names (lambda params / $var refs) -> HER slot-marks, not the sender's letters. Hollow shapes because
  // §288 is where she meets the thing: "a new mark takes a HOLLOW for a slot, then a body that leans on that slot".
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
      if (/^-?\d+$/.test(s)) return numAtom(node);   // a whole atom, tag and cup and all
      if (s.charAt(0)==='"') return strblob(s);                                   // string -> opaque byte-blob
      return mark(s);                                                            // a sign OR a :-compound (name or op) -> mark(), which pills+dots any compound
    }
    if (node[0]===-2){ var rn=node[1];   // a NAME with nothing in its cup (▪⟅⟆) — reaches over exactly the ONE name behind it
      return NIL_NAME+' '+((slots && (rn in slots)) ? '<span class="gl">'+slots[rn]+'</span>' : mark(rn)); }  // a bound lambda-slot, else a free NAME (scrawl/token)
    if (node[0]===-1) return form(node.slice(1), 'front', depth+1);   // front-standing cup -> goes down as it came, members bare behind it
    return form(node, 'cup', depth+1);                                // round-shutting cup -> cupped, one level deeper
  }
  /* THE EMPTIES. There is no third construct on the wire: an atom is a TYPE TAG and a cup, and these two are
     that same pair of atoms WITH NOTHING IN THE CUP. ▫⟅⟆ is a number with nothing in it; ▪⟅⟆ is a name with
     nothing in it. What tells them apart is how far each reaches, and the message settles it — ▫⟅⟆ is in tail
     position 3289 times out of 3289, so it runs to the end of its enclosure; ▪⟅⟆ is followed by a sibling
     1220 times, so it cannot, and it takes exactly the one name behind it (all 2416, always one, always a name).
     She writes each as ONE mark, hollow for the hollow tag and filled for the filled one, the same way ▪/▫ and
     ●/◦ already run. That is an abbreviation, not a reading: three marks stand behind each, written above, so
     it can be undone — the same bargain as `tirrel`, and it costs nothing to be wrong about what they mean. */
  var NIL      = '<span class="nil">◇</span>';        // ▫⟅⟆ — reaches to the end of its enclosure
  var NIL_NAME = '<span class="nil n">◆</span>';      // ▪⟅⟆ — reaches over the one name behind it
  var NIL_RAW  = '<span class="bit">▫</span><span class="cup o">⟅</span><span class="cup c">⟆</span>';  // before §246, as it came
  // WRAP is the whole of the keepers' bracketing rule: `cup` = a cup that shuts round its members;
  // `front` = the empty number-cup above, whose members run on behind it unshut; `bare` = the statement
  // itself, which has no enclosure to mark. Nothing may swallow a group's boundary.
  function form(items, wrap, depth){            // render a form; special heads, else a wrapped sequence
    depth = depth || 0;
    var kids = function(arr){ return arr.map(function(n){ return hand(n, depth); }).join(' '); };
    var head = items[0], inner, selfBracketed = false;
    /* These three bring a bracket of their own, and it stands for the wire's CUP one-for-one — the same bargain
       as `tirrel`, undoable for the same reason. But a cup is the only thing it can stand for. A front-mark is
       not a cup; it is an atom with an empty cup that reaches to the end of its enclosure, and no closing
       bracket can spell that. So a self-bracketed form swallows a `cup` wrap and NEVER a `front` one — else
       §400's list loses the very mark Vess spends the entry complaining about. */
    if (head==='vector'){ selfBracketed = true;   // a list
      inner = '<span class="cup lo">⟦</span>'+kids(items.slice(1))+'<span class="cup lc">⟧</span>'; }
    else if (Array.isArray(head) && head[0]==='list'){ selfBracketed = true;  // (list N) e1 e2 … -> her strung list, an alien (ogham) feather-bracket, NOT human [a,b,c]
      inner = '<span class="lst o">᚛</span>'+kids(items.slice(1))+'<span class="lst c">᚜</span>'; }
    else if (head==='s' && items.length===2 && String(items[1]).charAt(0)==='"'
             && STR[String(items[1]).replace(/^"|"$/g,'')]){                    // a string -> its glyph blob (substrate)
      selfBracketed = true; inner = '<span class="scrawl">'+STR[String(items[1]).replace(/^"|"$/g,'')]+'</span>'; }
    else if (head==='unary')
      /* Maren's notation covers ONE shape: `tally ●…◦`, a count with the empty cup in front. `●` and `◦` were
         cut inside that shape and have no life outside it — `◦` is defined as "the one at the END", of that
         run. A CUPPED count has no empty cup, so `tally` cannot apply and neither can the marks she cut with
         it. Until Ren takes the pair apart there is no way to write one at all, so it goes down as it came. */
      inner = (wrap==='front' && !splitOn) ? tally(unaryVal(items))     // `tally` swallows the long run: it IS the pair
            : !splitOn                        ? rawUnary(items)           // no name for a cupped count at all yet
            : mark('unary')+' '+tally(unaryVal(items));                   // split: ●/◦ hold, and the run is `tal` once she coins it
    else if (head==='?'||head==='lambda')                             // a lambda: its parameter IS an anonymous slot
      inner = mark(head)+' '+slot(items[1])+' '+kids(items.slice(2));
    else if (head==='define'||head==='@'||head==='make'||head==='assign')  // binds a NAME -> render it as a sign (scrawl/token), not a hollow slot
      inner = mark(head)+' '+mark(items[1])+' '+kids(items.slice(2));
    else inner = kids(items);
    if (wrap==='bare' || (selfBracketed && wrap==='cup')) return inner;   // its own bracket already spells the cup
    // before §232 an empty cup in front of the long run is not two marks to her, it is one word: `tally`.
    // after the split it is a thing with no name, written out as it came, until she cuts `◇` for it at §246.
    var front = (!splitOn && head==='unary') ? MERGED : (nilOn ? NIL : NIL_RAW);
    var out = wrap==='front' ? front+' '+inner
            : '<span class="cup o">⟅</span>'+inner+'<span class="cup c">⟆</span>';
    return (foldMode && depth>0 && depth>=foldMin && depth<=foldMax) ? '\n'+indent(depth)+out : out;   // fold: nested making onto its own indented line
  }
  var MODES = {
    raw:   function(el){ return tones(el.getAttribute('data-code') || el.getAttribute('data-tones')); },
    // the message in its OWN signs: render the parse with every sign forced to its figure — same source & renderer as
    // hand mode, so a sign draws identically in both (hand just swaps CRACKED signs for her marks). NOT the octo `spider`
    // (that's a byte-level transliteration whose figures disagreed with the per-sign ones).
    glyph: function(el){ allFigures = true; resetSlots();
      var h = form(wireOf(el).parse || JSON.parse(el.getAttribute('data-parse')), 'bare'); allFigures = false; return h; },
    hand:  function(el){ resetSlots(); return form(wireOf(el).parse || JSON.parse(el.getAttribute('data-parse')), 'bare'); }
  };
  function renderVal(v){                       // what a fragment YIELDS (from Evaluate), in her marks
    // through mark(), like every other sign in the arc: her coined word once she has one (holds/fails, §306),
    // the real scrawl before that. NEVER a shape of our own — the widget teaches the word one line above.
    if (v===true)  { resetSlots(); return mark('true'); }
    if (v===false) { resetSlots(); return mark('false'); }
    // a yielded number is a number: she writes it the way she writes every other count. It was never
    // on the wire — she worked it out — which is all the more reason it goes down in her own marks.
    if (typeof v==='number') return numAtomValue(v);
    return '';
  }
  var LABEL = { raw:'as it comes', glyph:'in plain figures', hand:'as I set it down' };
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
    foldMode = el.hasAttribute('data-fold');
    var rng = fm && fm.match(/^(\d+)-(\d+)$/);                       // "M-N": break only between depths M and N
    foldMin = rng ? +rng[1] : 0;
    foldMax = rng ? +rng[2] : ((fm && /^\d+$/.test(fm)) ? +fm : Infinity);
    el.innerHTML = form(parse, 'bare', 0);
    foldMode = false;
  }

  /* ONE walk, in DOCUMENT ORDER — this is what makes coining linear/positional. A `.coin` span
     sits in the prose exactly where the keeper coins a shorthand; passing it switches that sign
     on (COINED) from there down. Every exhibit after it shows the token; everything before shows
     raw scrawl. The token itself is the span's own visible glyph — no duplication, no pass numbers.
     `.sg` prose marks (is/int) and `.msg`/`.row` exhibits all render through the same COINED map. */
  Array.prototype.forEach.call(
    document.querySelectorAll('.coin[data-sign], [data-split], [data-nil], [data-numerals], .msg, .row[data-parse], .row[data-code], .sg[data-s], .num[data-n]'),
    function(el){
      // era flags do NOT return: a marker rides on the very span that does the thing — §232's on the
      // span that coins `tal`, §267's on the rung that first shows a sign written as one glyph.
      if (el.hasAttribute('data-split'))    splitOn    = true;   // §232: Ren takes the founder's pair apart, here
      if (el.hasAttribute('data-nil'))      nilOn      = true;   // §246: and cuts a mark for the half that stayed away
      if (el.hasAttribute('data-numerals')) numeralsOn = true;   // §267: and can write a sign's number as one glyph
      if (el.classList.contains('coin')) { COINED[el.getAttribute('data-sign')] = (el.textContent||'').trim(); return; }
      if (el.classList.contains('msg')) { renderMsg(el); return; }
      if (el.classList.contains('sg'))  { allFigures = false; resetSlots(); el.innerHTML = mark(el.getAttribute('data-s')); return; }
      if (el.classList.contains('num')) { el.innerHTML = reckon(el.getAttribute('data-n'), el.classList.contains('barred')); return; }
      if (el.hasAttribute('data-parse') || el.hasAttribute('data-code')) renderRow(el);
    }
  );
})();

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
  /* ATOMS: the same marks as `cups`, but held in the groups they are actually in. `cups` puts one
     space between EVERY token, so `▫⟅▪⟆` — one atom, the number one — reads as four loose marks, and
     a row of unary units becomes a field of floating cups with nothing to tell a tagged one from a
     bare one. That is right for the founder's first pages, where she has cut the tones into cups and
     bits and has NOT yet found that a mark and the cup behind it go together. It is wrong from §207
     on, and it is wrong wherever the point of the exhibit is which cups wear a mark. So: a tag sticks
     to its cup and its contents; a space falls only between siblings; a BARE cup keeps its space on
     both sides, which is what makes it visible. Matches how the hand rows have always been written. */
  function atoms(code) {
    var out = '', tagged = [], i = 0;
    function put(sep, s) { out += (out && sep ? ' ' : '') + s; }
    while (i < code.length) {
      if (code.slice(i) === '2233') { put(true, '<span class="cup">⟅⟅⟆⟆</span>'); break; }
      var d = code.charAt(i);
      if ((d === '0' || d === '1') && code.charAt(i + 1) === '2') {         // type tag, then its cup
        put(true, '<span class="bit">' + (d === '1' ? '▪' : '▫') + '</span>' +
                  '<span class="cup">⟅</span>');
        tagged.push(true); i += 2;
      } else if (d === '2') {                                              // a cup wearing nothing
        put(true, '<span class="cup">⟅</span>'); tagged.push(false); i++;
      } else if (d === '3') {
        put(!tagged.pop(), '<span class="cup">⟆</span>'); i++;
      } else {                                                            // the numeral in a cup
        var bits = '';
        while (i < code.length && (code.charAt(i) === '0' || code.charAt(i) === '1') &&
               code.charAt(i + 1) !== '2') { bits += code.charAt(i) === '1' ? '▪' : '▫'; i++; }
        if (!bits) { i++; continue; }                                     // guard: never spin
        put(false, '<span class="bit">' + bits + '</span>');
      }
    }
    return out;
  }
  Array.prototype.forEach.call(document.querySelectorAll('.frag[data-code]'), function (el) {
    var code = el.getAttribute('data-code'), view = el.getAttribute('data-view');
    if (!code || !view) return;
    var html = view === 'tones' ? tones(code) : view === 'cups' ? cups(code)
             : view === 'atoms' ? atoms(code) : '';
    if (html) el.insertAdjacentHTML('beforeend', html);   // appended after the <span class="lbl">
  });
})();
