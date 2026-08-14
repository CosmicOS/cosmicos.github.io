/* ---- listener: message renderer + the peel ----
   Logic only. Data (her marks + sign glyphs) is injected by the page as `window.LISTENER`
   (a tiny inline <script> with liquid), since liquid does not run inside a .js file. */

/* ---- THE KEEPERS' NUMERALS ----
   TOP LEVEL, not inside a renderer, because two passes want them: the exhibit renderer (a `.rk` or
   `.num` span the prose put there on purpose) and the numeral pass at the foot of this file (every
   figure the book writes, in a stamp or a sentence). One implementation, two callers. */

/* her reckoning mark for a value: bare for a name, barred for a count. Map: scripts/scrawl.js. */
function reckon(v, barred){
  v = Number(v);
  if (!(v >= 0 && v < 64)) return '';
  // BARE or BARRED, and that is the tag. The sender draws a NAME's number bare and a COUNT's number
  // with a bar at the head and one at the foot — the same distinction the wire carries as `▪` or `▫`
  // in front of the cup, moved into the shape of the mark. `<span class="num barred" data-n="4">`.
  return '<span class="scrawl">&#x' + ((barred ? 0x28c0 : 0x2840) + v).toString(16) + ';</span>';
}
/* A NUMBER IN THE KEEPERS' OWN NUMERALS, whatever its size. `<span class="rk" data-n="200">`.
   Base sixty-four with place value, as many marks as it takes — theirs, older than the post, and so
   NOT waiting on §267. That pass is only where Ren starts writing the MESSAGE's counts in them; it
   invents nothing about the numerals themselves and no keeper ever explains them, any more than we
   explain that forty-two takes two digits.
   This exists so an ordinary large figure can go down in an ordinary line long before the message
   forces one. Without that, the first number too big for a single mark lands inside an exhibit at
   §310 and reads as an unannounced change of notation in a book where four keepers have made
   showing a change before and after a rule — which is exactly how it read on the blind read. */
function reckonNum(v, barred){
  v = Math.abs(Number(v));
  /* FINITE, OR NOTHING. `Number('1210010…')` on a long run of digits is Infinity, and the loop below
     divides by 64 until it reaches zero — which Infinity never does, so the page hung with no request
     outstanding and no error, just a main thread that never came back. A 400-digit span of the raw
     four-symbol message in the preface found it. Nothing that size is a count a keeper wrote. */
  if (!(v >= 0) || !isFinite(v)) return '';
  var d = []; do { d.unshift(v % 64); v = Math.floor(v / 64); } while (v > 0);
  return d.map(function(x){ return reckon(x, barred); }).join('');
}

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
  /* THE SAME WALK, KEPT AS TWO PLACES — where a sign first appears on the page, and the pass whose
     prose gives it a word. The tap panel cites them; nothing here is a second traversal or a table
     anybody maintains, so a sign that moves takes its citation with it. `walking` shuts the record
     off at the end of the walk, because everything drawn after it is a panel and not a place in the
     book. Declared HERE, beside `COINED`, because `mark()` reads all three. */
  var COINED_AT = {}, SEEN_AT = {}, walking = true;
  var allFigures = false;          // "in plain figures": force EVERY sign to its own figure (one source w/ hand mode, so the two can't disagree)
  var WIRE  = DATA.wire   || {};   // code -> {parse, spider} for data-code widgets (looked up client-side, not baked)
  /* the run bundle's statements join the SAME table, so a row in an open run is an ordinary wire
     quote and every rung works on it without a second code path. Existing entries win: those carry
     `spider` too, and this one does not. */
  (function(sp){ for (var k in sp) if (sp[k].c && !WIRE[sp[k].c]) WIRE[sp[k].c] = { parse: sp[k].p }; })
    ((DATA.runs && DATA.runs.spine) || {});
  var TONE  = { '0':'˩','1':'˨','2':'˦','3':'˥' };
  function wireOf(el){ var c = el.getAttribute('data-code'); return (c && WIRE[c]) ? WIRE[c] : {}; }
  function TONE_RUN(code){                     // RAW: the four-symbol stream in real tone chars, no wrapper
    var s = ''; for (var i = 0; i < code.length; i++) s += TONE[code.charAt(i)] || '?';
    return s;
  }
  // `.tones` is the generated wire-quote look (letter-spaced); `.tn` is the founder writing pitches
  // down in a row. Same characters, one implementation — the caller says which page-furniture it is.
  function tones(code, cls){
    return '<span class="' + (cls || 'tones') + '">' + TONE_RUN(code) + '</span>';
  }
  function cupsOf(code) {                    // 1-before-2 = a lone marker outside the cup; 2/3 = cups; else bits
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
  function atomsOf(code) {
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
  function num(bits){                          // a number -> packed bits (place-value)
    return bits.map(function(b){ return '<span class="bit">'+(b==='1'?'▪':'▫')+'</span>'; }).join('');
  }
  // number rendering is FORM-DRIVEN: a (unary …) form -> ● tallies (counting era); a bare int -> packed bits.
  /* A RUN IS A RUN — no grouping. This used to put a gap after every fifth `●`, which is counting on
     one hand, and these people have sixteen feet and none. `check-limbs.js` guards exactly that and
     could not see it: the gate reads `_prose`, so it governs WORDS, and this was a MARK. Nothing
     about them makes five a group either — four tones, base sixty-four numerals, sixteen feet. */
  function tally(n){ n=Math.abs(Number(n)); var s=''; for(var i=0;i<n;i++){ s+='<span class="tk">●</span>'; } return s+'<span class="tk z">◦</span>'; }
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
  /* `data-fold` — MAY THIS EXHIBIT BREAK ACROSS LINES AT ALL. Nothing more. It used to carry a depth
     or a depth range ("5-7": break only between those depths), which was the wrong axis and became a
     default nobody revisited: 52 of the 59 exhibits that had it carried the identical `"1"`. Where a
     statement breaks is decided by width now, in `form` below, so there is no number to get wrong. */
  var foldMode = false;
  /* SCRAWL IS THEIR NUMERALS, AND A KEEPER CANNOT USE IT UNTIL SHE CAN READ A CUP AS A NUMBER.
     A sign arrives as a lone bit and a cup holding its id in bits. Writing that id in one glyph is
     transcription, but it needs place value, and Ren does not crack place value until §267. So
     before that a sign is written the only way it can be: as its run. After it the glyphs are
     available for every sign, meaning known or not, and the runs stop.
     POSITIONAL, keyed to `data-cut="numerals"`, like every other cut in this file — NOT a pass
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
  /* ★ AND A THIRD STATE, BEFORE THE FIRST (added 08-08). The two switches above run merged -> split,
     but `tally` and `●`/`◦` are CUT AT §214 — before that entry Maren has no shorthand at all and writes
     the cups out as they came. The renderer used to start already holding her shorthand, so a generated
     row placed anywhere in §189-§207 came out in a notation she had not invented yet, and the only way
     to draw those pages was hand-authored HTML — which is the one kind of row nothing checks against the
     wire. `data-cut="tally"` on her §214 sentence turns it on where she cuts it. */
  var talliedOn = false;
  var splitOn = false, nilOn = false, MERGED = '<span class="nil w">tally</span>';
  /* ══ THE CUTS — `data-cut` ═══════════════════════════════════════════════════════════════════════
     `data-at` above asks WHICH RUNG OF THE LADDER a row is drawn at, and the answer is editorial.
     This asks the other question, and the answer is not editorial at all: WHAT HAS BEEN CUT BY HERE?
     A keeper cuts a shorthand on a particular night, and from that point the page has it and before
     it the page does not. So a cut is POSITIONAL — the attribute rides on the very span where she
     says the words, never on a pass number — and it is one-way. `data-at` may reach back down the
     ladder freely; nothing may reach forward past a cut.
     Five attributes, one use each, all this shape, until 08-09. Listed in the order they happen. */
  var CUTS = {
    tally:    function(){ talliedOn  = true; },   // §214 Maren cuts ●/◦ and the word `tally`
    join:     function(){ joinOn     = true; },   // §221 and the join standing for a name-cup's wrapper
    split:    function(){ splitOn    = true; },   // §232 Ren takes the founder's merged pair apart
    nil:      function(){ nilOn      = true; },   // §246 and cuts a mark for the half that stayed away
    numerals: function(){ numeralsOn = true; }    // §267 and can write a sign's number as one glyph
  };
  /* THE JOIN IS A NOTATION LIKE ANY OTHER, SO IT STARTS OFF. Until Maren cuts it at §221 a
     compound goes down the way the wire sends it, a name-cup shut round its parts. The mark that
     replaces that wrapper does not exist before she says so, and a page that draws it earlier is
     showing the reader a mark nobody introduced. POSITIONAL, `data-cut="join"`, on the rung where
     she first writes the short form — the same placement as `numerals` and for the same reason. */
  var joinOn = false;
  /* A SIGN'S ID, OFF ITS BRAILLE. One glyph is one base-64 digit (the map is in scripts/scrawl.js),
     so a sign whose id will not fit in one spells itself across two or three, most significant
     first — `map` is ⡁⡉, digits 1 and 9, id 73. This returned null for those until 08-12, which cost
     the thirteen multi-glyph signs (`map` §384 down to `door` §540) both their figure and their run.
     A COMPOUND KEY is a different thing and is not this function's: `is:int` is two signs standing
     together, not one big id, and `mark()` splits it on the colon and draws each part. */
  function idOf(name){
    if (name.indexOf(':') > 0) return null;           // a compound key is signs standing together, not one id
    var g = SCRAWL[name]; if (!g) return null;
    var re = /&#x([0-9a-f]+);/gi, m, id = 0, n = 0;
    while ((m = re.exec(g))) {
      var d = parseInt(m[1], 16) - 0x2840;
      if (d < 0 || d > 63) return null;               // outside the name range: a numeral glyph, not a name
      id = id * 64 + d; n++;
    }
    return n ? id : null;
  }
  function runOf(name){                         // a sign as she can write it before she has numerals
    if (name.indexOf(':') > 0) {                // signs standing together: each one's run, in order
      var ps = name.split(':').map(runOf);
      return ps.every(Boolean) ? ps.join(' ') : null;
    }
    var id = idOf(name); if (id === null) return null;
    return '<span class="bit">▪</span><span class="cup o">⟅</span>'
      + id.toString(2).split('').map(function(b){ return '<span class="bit">'+(b==='1'?'▪':'▫')+'</span>'; }).join('')
      + '<span class="cup c">⟆</span>';
  }
  /* ── THE GLOSS, AND THE ONE RULE THAT GOVERNS IT ──
     A reader gets lost among the figures long before the keepers do — they have a lifetime and a
     press, the reader has a scroll. So a mark can be asked what it is: pointer for a hover, a tap
     on a touch screen (js at the foot of this file, `.gloss`).

     IT SAYS WHAT THE WIRE SENT. IT NEVER SAYS WHAT IT MEANS.
     A sign's number is not a hint — the wire spells it out, `▪⟅▪▫▫▫⟆`, in every statement the sign
     appears in, and §267 is Ren learning to write that same number shorter. Handing it over in the
     reader's own numerals is a change of alphabet and nothing else. What the sign DOES is the thing
     the keepers spend four hundred passes earning, and the moment a keeper earns it the page prints
     her word for it anyway. So: numbers, never meanings. If a gloss is ever tempted to say more
     than the wire said, it has stopped being an aid and become the answer key. */
  /* A drawn sign carries a handle so it can be ASKED, not only hovered — the panel at the foot of
     this file reads it. It goes on the wrapper the sign already has rather than in a new one, so
     nothing about the spacing of a row changes.
     The handle is the sign's NUMBER — `data-sid="237"` — because that is the sign's identity on the
     wire, spelled out in every statement it stands in, and it is what the hover already says. Not a
     secret kept: the source of this page is a teaching text and holds the whole sign table in plain
     sight. It is the panel's OUTPUT that is governed, by the same rule as every gloss here: what the
     wire sent, never what it means. The author's key (`hydrogen`, `equals-Object-Z`) is what it
     means, so it stays on this side of the render and a test reads the panel back to check. */
  function sidOf(name){
    var ps = name.split(':'), out = [], i, id;
    for (i = 0; i < ps.length; i++) { id = idOf(ps[i]); if (id === null) return null; out.push(id); }
    return out.join('.');
  }
  /* A compound with a plain number among its parts — `cons:0` — has no one id, so it gets no handle
     and no panel: the number is not a sign and the wire does not send it as one. */
  function sidAttr(name){ var sid = name ? sidOf(name) : null; return sid ? ' data-sid="' + sid + '"' : ''; }
  function gloss(html, say, name){
    return '<span class="gloss"' + sidAttr(name)
      + ' title="' + say + '" data-v="' + say + '">' + html + '</span>'; }
  function glossify(el, say){ if (say == null) return; el.classList.add('gloss'); el.title = say; el.setAttribute('data-v', say); }
  function signGloss(name){ var id = idOf(name); return id === null ? null : 'sign ' + id; }

  function scrawlSpan(name){
    if (!numeralsOn) { var r = runOf(name); if (r) return r; }
    if (!SCRAWL[name]) return '<span class="gl" style="opacity:.4">▩</span>';
    var g = '<span class="scrawl sign-fb">'+SCRAWL[name]+'</span>', say = signGloss(name);
    return say ? gloss(g, say, name) : g; }
  /* `data-unworded` on a row — DRAW THIS ONE WITHOUT HER WORDS. Same distinction `.msg` already
     draws between `hand` and `glyph` (her marks vs the message's own signs), narrowed to a single
     row and stopping short of `allFigures`, which forces scrawl and so says nothing before §267.
     A keeper can write any form she has met, so which form a row takes is an EDITORIAL choice about
     what that row is for — not an event in her night. §228 lays three lists side by side to compare
     them: `tirrel` on the first line and the runs on the other two makes three kin look like two
     kin and a stranger, and no sentence can repair a row that draws the comparison wrong. */
  var unworded = false;
  function mark(name){                             // her token once introduced; else the sign in spider scrawl
    if (walking && openEntry && SEEN_AT[name] === undefined) SEEN_AT[name] = openEntry;   // first drawn here
    if (allFigures) return scrawlSpan(name);                                         // plain-scrawl view: every sign as its scrawl
    if (!unworded && COINED[name] !== undefined) { var t=COINED[name];                    // she has coined it (a `.coin` span above, in reading order) -> her token
      /* her word carries the sign's NUMBER too, so a reader can tie the word she reads back to the
         figure she met before it was named — the join the book is otherwise asking them to hold. */
      var tok = '<span class="gl'+(/[a-z]/i.test(t)?' w':'')+'">'+t+'</span>', say = signGloss(name);
      return say ? gloss(tok, say, name) : tok; }
    /* AN UNCOINED COMPOUND. On the wire it is a name-cup shut round its parts — `▪⟅ ▪⟅a⟆ ▪⟅b⟆ ⟆`,
       flat, however many parts there are. One mark between the parts stands for the whole of that
       wrapper: the tag in front and both halves of the cup, three marks for one.
       It reads unambiguously at any number of parts because the SPACING already carries the
       distinction — separate signs are set apart by a real word-space, a compound's parts are tight
       against their join — and because nothing in the message ever nests a compound inside a
       compound (checked: zero statements open an atom three deep).
       The mark was `·` until 08-09, which was wrong: the station uses `·` as an ordinary field
       separator in Ren's ledger and every taking-up head, so it was not this notation's at all.
       `‿` is used nowhere else in the book. Cut on the page at §221, before and after — and until
       that cut (`joinOn`) the wrapper is written out in full, because that is what she has. */
    if (name.indexOf(':')>0) {
      var parts = name.split(':').map(function(p){ return /^-?\d+$/.test(p)?bitsOf(p):mark(p); });
      if (!joinOn)
        return '<span class="fam"' + sidAttr(name) + '>'
             + '<span class="bit">▪</span><span class="cup o">⟅</span> '
             + parts.join(' ')
             + ' <span class="cup c">⟆</span></span>';
      return '<span class="fam"' + sidAttr(name) + '>' + parts.join('<span class="fj">‿</span>') + '</span>';
    }
    return scrawlSpan(name);                                                             // else: the sign in real spider scrawl (the base)
  }
  /* A maker's slot is one name (`? x`) or a cup of them (`lambda (x y)`, and typed as `(x number)`),
     which is what the wire sends. Draw it as it came. */
  function params(p){
    if (!Array.isArray(p)) return mark(p);
    return '<span class="cup o">⟅</span>' + p.map(params).join(' ') + '<span class="cup c">⟆</span>';
  }

  /* A BOUND NAME IS A SIGN AND RENDERS AS ONE. It has an id on the wire like anything else — x is 43,
     sent as ▪⟅101011⟆ — so it draws as its scrawl, and the same scrawl standing in the head and again
     in the body IS the correspondence. Four invented shapes (◌ ⬚ ○ ◔) used to stand here instead,
     justified by "a bound name has no sign on the wire", which was simply false. Removed 08-08: the
     message that comes in is rendered in the notation live at that moment, and nothing is substituted
     for it without the paired line. */
  function strblob(s){                          // a string -> its glyph sequence (substrate); bytes-in-cup only if unmapped
    var t=s.replace(/^"|"$/g,'');
    if (STR[t]) return '<span class="scrawl">'+STR[t]+'</span>';
    var b='';
    for (var i=0;i<t.length;i++){ b += ('0000000'+t.charCodeAt(i).toString(2)).slice(-8); }
    return '<span class="cup o">⟅</span>'+b.split('').map(function(x){ return '<span class="bit">'+(x==='1'?'▪':'▫')+'</span>'; }).join('')+'<span class="cup c">⟆</span>';
  }
  /* `col` — the column this node starts at; `seq` — the column its pipe-sequence lines up at.
     Both are columns, not counters: the layout question is whether a LINE is too long. */
  function hand(node, col, seq, cont){          // HAND: a parse node -> her marks
    col = col || 0;
    if (!Array.isArray(node)){
      var s=String(node);
      if (/^-?\d+$/.test(s)) return numAtom(node);   // a whole atom, tag and cup and all
      if (s.charAt(0)==='"') return strblob(s);                                   // string -> opaque byte-blob
      return mark(s);                                                            // a sign OR a :-compound (name or op) -> mark(), which pills+dots any compound
    }
    if (node[0]===-2){ var rn=node[1];   // a NAME with nothing in its cup (▪⟅⟆) — reaches over exactly the ONE name behind it
      return NIL_NAME+' '+mark(rn); }
    if (node[0]===-1) return form(node.slice(1), 'front', col, seq);   // front-standing cup -> goes down as it came, members bare behind it
    return form(node, 'cup', col, seq);                               // round-shutting cup
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
  /* ── LAYING A STATEMENT OUT ──────────────────────────────────────────────────────────────────
     Two rules, and the first is why the old one failed.

     THE LAST ARGUMENT IS A SEQUENCE STEP, NOT A LEVEL. The message is written with `|` precisely to
     keep a run of clauses from becoming a stack of parentheses: `f a | g b | h c` is `f a (g b (h c))`.
     In the parse that is a right spine — stanza 1164 is four author lines at two indents and SEVEN
     levels of nesting — so indenting by structural depth marches the clauses rightward, which is the
     opposite of what the pipe is for. A last argument keeps its parent's indent. Only real branching
     costs a level.

     BREAK ON WIDTH, NOT ON DEPTH. A form goes down flat if it fits the line and breaks if it does
     not. Depth was always the wrong axis: what a reader cannot follow is a long line, and a deep
     statement whose parts are short is perfectly readable. This also means the common case needs no
     setting at all, which is the point — `data-fold` is now only an ON SWITCH, its old numbers
     ignored. 335 exhibits carry no switch and render exactly as before.

     THE BREAK IS DECIDED BY THE PARENT. A joint is a place BETWEEN two siblings; a child cannot see
     whether anything precedes it, and the version that let it decide put a line-break straight after
     an opening cup — `⟅` stranded at the end of a line with its contents on the next. ── */
  var WIDTH = 56;                                // marks that fit one line of an exhibit at --sz-mark
  var STEP  = 2;                                 // the author's own indent step (see msg.json `lines`)
  function bare(html){ return html.replace(/<[^>]+>/g, '').replace(/\n[ ]*/g, ''); }
  function pad(n){ var s=''; while (s.length < n) s += ' '; return s; }

  /* `col` is the COLUMN THIS FORM STARTS AT, not a nesting counter, because what a reader cannot
     follow is a long line and a counter does not know where a line begins. `seq` is the column the
     current pipe-sequence lines up at: every clause of one spine goes there, so a run of clauses
     reads as a column and not as a staircase. Only a BRANCH opens a new sequence, one step in. */
  function form(items, wrap, col, seq){
    col = col || 0; seq = seq || (col + STEP);
    var head = items[0], selfBracketed = false;
    function kids(arr, brk){
      var n = arr.length;
      return arr.map(function(node, i){
        var last = (i === n - 1);
        if (!brk || i === 0 || !Array.isArray(node)) return hand(node, col, seq, last);
        /* a LAST child is the next clause of this spine: same column, same sequence.
           anything else is a branch: one step in, and it starts a sequence of its own. */
        var at = last ? seq : seq + STEP;
        return '\n' + pad(at) + hand(node, at, last ? seq : at + STEP, last);
      }).join(' ');
    }
    function build(brk){
      var kd = function(a){ return kids(a, brk); }, inner;
      selfBracketed = false;
      /* These three bring a bracket of their own, and it stands for the wire's CUP one-for-one — the same bargain
         as `tirrel`, undoable for the same reason. But a cup is the only thing it can stand for. A front-mark is
         not a cup; it is an atom with an empty cup that reaches to the end of its enclosure, and no closing
         bracket can spell that. So a self-bracketed form swallows a `cup` wrap and NEVER a `front` one — else
         §400's list loses the very mark Vess spends the entry complaining about. */
      if (head==='vector'){ selfBracketed = true;   // a list
        inner = '<span class="cup lo">⟦</span>'+kd(items.slice(1))+'<span class="cup lc">⟧</span>'; }
      else if (Array.isArray(head) && head[0]==='list'){ selfBracketed = true;  // (list N) e1 e2 … -> her strung list, an alien (ogham) feather-bracket, NOT human [a,b,c]
        inner = '<span class="lst o">᚛</span>'+kd(items.slice(1))+'<span class="lst c">᚜</span>'; }
      else if (head==='s' && items.length===2 && String(items[1]).charAt(0)==='"'
               && STR[String(items[1]).replace(/^"|"$/g,'')]){                    // a string -> its glyph blob (substrate)
        selfBracketed = true; inner = '<span class="scrawl">'+STR[String(items[1]).replace(/^"|"$/g,'')]+'</span>'; }
      else if (head==='unary')
        /* Maren's notation covers ONE shape: `tally ●…◦`, a count with the empty cup in front. `●` and `◦` were
           cut inside that shape and have no life outside it — `◦` is defined as "the one at the END", of that
           run. A CUPPED count has no empty cup, so `tally` cannot apply and neither can the marks she cut with
           it. Until Ren takes the pair apart there is no way to write one at all, so it goes down as it came. */
        inner = !talliedOn                  ? rawUnary(items)           // before §214: no ● and no ◦ yet, so as it came
              : (wrap==='front' && !splitOn)    ? tally(unaryVal(items))    // `tally` swallows the long run: it IS the pair
              : !splitOn                        ? rawUnary(items)           // no name for a cupped count at all yet
              : mark('unary')+' '+tally(unaryVal(items));                   // split: ●/◦ hold, and the run is `tal` once she coins it
      else if (head==='?'||head==='lambda')                             // a lambda: its parameter IS an anonymous slot
        inner = mark(head)+' '+params(items[1])+' '+kd(items.slice(2));
      else if (head==='define'||head==='@'||head==='make'||head==='assign')  // binds a NAME -> render it as a sign (scrawl/token), not a hollow slot
        inner = mark(head)+' '+params(items[1])+' '+kd(items.slice(2));
      else inner = kd(items);
      return inner;
    }
    function dress(inner){
      if (wrap==='bare' || (selfBracketed && wrap==='cup')) return inner;   // its own bracket already spells the cup
      // before §232 an empty cup in front of the long run is not two marks to her, it is one word: `tally`.
      // after the split it is a thing with no name, written out as it came, until she cuts `◇` for it at §246.
      var front = (talliedOn && !splitOn && head==='unary') ? MERGED : (nilOn ? NIL : NIL_RAW);
      return wrap==='front' ? front+' '+inner
           : '<span class="cup o">⟅</span>'+inner+'<span class="cup c">⟆</span>';
    }
    var flat = dress(build(false));
    if (!foldMode) return flat;
    if (col + bare(flat).length <= WIDTH) return flat;   // it fits as it stands: leave it alone
    return dress(build(true));                           // it does not: open it at the joints
  }
  /* ══ THE LADDER OF REPRESENTATIONS — `data-at` ══════════════════════════════════════════════════
     One question, asked of every exhibit: AT WHAT LEVEL is this statement drawn? It used to be asked
     in three vocabularies that could not be compared — `data-modes="hand,glyph,raw"` on a `.msg`,
     `data-view="tones|cups|atoms"` on a `.frag` (a separate renderer at the foot of this file, with
     its own copy of the tone map), and `data-as="tones"` plus a flag on a `.row`. Three names for
     the pitches alone. One attribute now, one ordered set of rungs, one implementation; a `.row` and
     a `.frag` take one rung, a `.msg` takes a comma list and stacks them labeled.

         tones     the four pitches, and nothing else — all the founder has on her first nights
         cups      the pitches read as cups and bits, every token stood apart (§193's state)
         atoms     the same marks, a tag stuck to its cup (§207 on)
         figures   the parse, every sign forced to its own figure — the message in its OWN signs
         unworded  the parse in the page's notation, figures where she has words
         hand      the parse in the page's notation, her words and all

     THE BREAK IS BETWEEN `atoms` AND `figures`, and it is not a matter of degree: the first three
     rungs need only the code, and the last three need the PARSE. A statement can be drawn in cups
     before anybody has worked out what its parts are; it cannot be drawn in figures until they have.
     That is the founder's whole first season, and it is why `.frag` could ever have been a separate
     renderer in the first place.

     WHICH RUNG IS AN EDITORIAL CHOICE, NEVER AN EVENT IN A KEEPER'S NIGHT. She can write any form
     she has met, so the question a rung answers is what this exhibit is FOR — and no sentence can
     repair a row that draws the comparison wrong. (§228 lays three lists side by side to compare
     them; `hand` drew her word on the first line and the runs on the other two, so three kin read as
     two kin and a stranger. `unworded` on that one row is the whole fix.)
     What a rung may NOT do is draw a mark ahead of its cutting — that is the era switches' job, and
     they stay positional. A rung reaches back down the ladder, never up it. */
  function parseOf(el){ return wireOf(el).parse || JSON.parse(el.getAttribute('data-parse')); }
  /* `data-span="a-b"` — DRAW ONLY PART OF THE STATEMENT, the part between those two places in the
     wire. Only the three code rungs take it, and that is not a limitation to work around: a keeper
     holding up the front eight marks of a line is pointing at a stretch of the STREAM, which is a
     thing that exists before anybody has worked out where the parts of it begin and end. There is no
     such thing as half a parse.
     The offsets are into the CODE, which is the wire itself, so they cannot drift the way a count of
     drawn marks would. And one code place draws exactly one mark at all three rungs, so the length of
     a span is the number of marks it puts on the page — which is what makes it checkable.
     This is the last thing that kept a row hand-authored for showing a FRAGMENT, and hand HTML is
     the one kind of row nothing checks against the wire (§549's fabricated `▮` lived in one for
     months). `scripts/hand-row-diff.js` searches rung × span and names the attribute to use. */
  function codeOf(el){
    var c = el.getAttribute('data-code') || el.getAttribute('data-tones') || '';
    var m = /^(\d+)-(\d+)$/.exec(el.getAttribute('data-span') || '');
    return m ? c.slice(+m[1], +m[2]) : c;
  }
  var LEVELS = {
    /* `.tn` is the founder writing pitches down in a ROW; `.tones` is the generated wire-quote look
       a `.frag`/`.msg` wears. Same characters, one implementation, and which furniture it takes is
       the caller's business, not the rung's. */
    tones: function(el){
      var code = codeOf(el);
      var cls  = el.classList.contains('row') ? 'tn' : 'tones';
      /* `data-echo` — mark every place a given run of tones stands inside this one. The run is a
         CODE, not typed marks, so the band is derived and cannot claim a recurrence that isn't
         there: §622 shows the message's first line standing whole at the end of a line sent four
         hundred passes later, and asking a reader to count sixty-seven tones is not showing it. */
      var echo = el.getAttribute('data-echo');
      if (echo && code.indexOf(echo) >= 0)
        return '<span class="' + cls + '">'
             + code.split(echo).map(TONE_RUN).join('<span class="echo">' + TONE_RUN(echo) + '</span>')
             + '</span>';
      return tones(code, cls);
    },
    cups:  function(el){ return cupsOf(codeOf(el)); },
    atoms: function(el){ return atomsOf(codeOf(el)); },
    // NOT the octo `spider` (a byte-level transliteration whose figures disagreed with the per-sign
    // ones) — the same source and renderer as `hand`, so a sign draws identically in both.
    figures:  function(el){ allFigures = true;  var h = form(parseOf(el), 'bare', 0); allFigures = false; return h; },
    unworded: function(el){ unworded   = true;  var h = form(parseOf(el), 'bare', 0); unworded   = false; return h; },
    hand:     function(el){ return form(parseOf(el), 'bare', 0); }
  };
  function drawAt(el, dflt){
    var at = el.getAttribute('data-at') || dflt;
    return LEVELS[at] ? LEVELS[at](el) : '';
  }
  function renderVal(v){                       // what a fragment YIELDS (from Evaluate), in her marks
    // through mark(), like every other sign in the arc: her coined word once she has one (holds/fails, §306),
    // the real scrawl before that. NEVER a shape of our own — the widget teaches the word one line above.
    if (v===true)  { return mark('true'); }
    if (v===false) { return mark('false'); }
    // a yielded number is a number: she writes it the way she writes every other count. It was never
    // on the wire — she worked it out — which is all the more reason it goes down in her own marks.
    if (typeof v==='number') return numAtomValue(v);
    return '';
  }
  var LEVEL_LABEL = { tones:'as it comes', cups:'in cups', atoms:'in atoms',
                      figures:'in plain figures', unworded:'in its own signs', hand:'as I set it down' };
  /* THE ORDER OF THE RUNGS, AS DATA. It was only ever prose in the block above, plus the accidental
     key order of two objects — so nothing could ask "what is one rung simpler than this?", which is
     what the step-down control on each row needs. Simplest first. The break after `atoms` is the
     one in that block: below it a rung needs only the code, above it it needs the parse. */
  var LADDER = ['tones', 'cups', 'atoms', 'figures', 'unworded', 'hand'];
  var NEEDS_PARSE = 3;                             // index of the first rung that cannot work off the code alone
  function renderMsg(el){                       // a .msg widget: several rungs of the ladder at once, labeled
    (el.getAttribute('data-at')||'hand,figures,tones').split(',').forEach(function(at){
      var row = document.createElement('div'); row.className = 'msg-line';
      row.innerHTML = '<span class="lbl">'+(LEVEL_LABEL[at]||at)+'</span>'
                    + '<span class="msg-view">'+(LEVELS[at] ? LEVELS[at](el) : '')+'</span>';
      el.appendChild(row);
    });
    var val = el.getAttribute('data-value');
    if (val !== null) {
      var vs = document.createElement('div'); vs.className = 'msg-line msg-val';
      vs.innerHTML = '<span class="lbl">gives</span><span class="msg-view">'+renderVal(JSON.parse(val))+'</span>';
      el.appendChild(vs);
    }
  }
  function renderRow(el){                        // a generated <div class="row" data-parse|data-code> -> one line, at one rung
    /* The parse rungs need a parse and the code rungs do not — a row drawn in tones is the statement
       as the founder has it on her first nights, heard and written down and not parsed at all. That
       used to be the last reason a row still had to be hand-authored HTML, which is the one kind of
       row nothing checks against the wire. */
    var at = el.getAttribute('data-at') || 'hand';
    if (!LEVELS[at]) return;
    if (at === 'hand' || at === 'figures' || at === 'unworded') {
      if (!el.getAttribute('data-parse') && !wireOf(el).parse) return;
      allFigures = false;
      foldMode = el.hasAttribute('data-fold');   // an ON SWITCH; layout decides where, by width (see `form`)
    }
    /* KEEP AN EXHIBIT'S LABEL. Redrawing replaces every child, so a `<span class="lbl">` written into
       the row would vanish — which is why labeled rows used to have to be hand-authored too. Lift it
       out, redraw, put it back.
       A LABELED ROW MUST BE EXACTLY TWO CHILDREN. `.rows.labeled` is a two-column grid and sets
       `display: contents` on the row, so every child of the row becomes a grid cell — a hand row was
       always `.lbl` + `.fig`, two cells. Dropping the drawn spans in loose gives N cells and the line
       stacks vertically down the two columns. Wrap them in the same `.fig` the hand rows used. */
    var lbl = el.querySelector(':scope > .lbl'), body = LEVELS[at](el);
    el.innerHTML = lbl ? '<span class="fig">' + body + '</span>' : body;
    if (lbl) el.insertBefore(lbl, el.firstChild);
    foldMode = false;
  }

  /* ── WHAT THE PAGE HAD REACHED, AT EACH ROW ─────────────────────────────────────────────────────
     The notation state is positional, so when the walk below ends it holds the END OF THE BOOK.
     Anything that draws a row LATER — a run panel, a reader stepping a row down the ladder — would
     put Lio's words on Maren's page. So the walk records what it held as it passed.

     PER ROW, not per entry. A keeper coins a word partway down a night, and 143 of the book's 437
     wire rows have a coining or a cut later in their own entry — so an entry-level state would
     redraw a third of the book in a hand its page had not reached yet.
     Copy-on-write: one frozen state is shared by every row until a cut or a coining moves the world,
     which happens 40 times in the whole book. `NOTATION` keeps the entry-foot states too, which is
     what a run panel wants — that block is the reader asking what else was in the night, so it is
     drawn in the hand the entry ends in. */
  var NOTATION = {}, openEntry = null;
  var ROWSTATE = new WeakMap(), held = null;
  function snapshot(){
    var c = {}; for (var k in COINED) if (COINED.hasOwnProperty(k)) c[k] = COINED[k];
    return { tallied: talliedOn, split: splitOn, nil: nilOn, numerals: numeralsOn, join: joinOn, coined: c };
  }
  function restore(s){
    talliedOn = s.tallied; splitOn = s.split; nilOn = s.nil; numeralsOn = s.numerals; joinOn = s.join;
    COINED = s.coined; allFigures = false; unworded = false;
  }
  function standing(){ return held || (held = snapshot()); }   // the state as it stands, made once
  function moved(){ held = null; }                             // a cut or a coining: the next ask rebuilds

  /* ONE walk, in DOCUMENT ORDER — this is what makes coining linear/positional. A `.coin` span
     sits in the prose exactly where the keeper coins a shorthand; passing it switches that sign
     on (COINED) from there down. Every exhibit after it shows the token; everything before shows
     raw scrawl. The token itself is the span's own visible glyph — no duplication, no pass numbers.
     `.sg` prose marks (is/int) and `.msg`/`.row` exhibits all render through the same COINED map. */
  Array.prototype.forEach.call(
    document.querySelectorAll('.entry[id], .coin[data-sign], [data-cut], .msg, .row[data-parse], .row[data-code], .frag[data-code], .sg[data-s], .num[data-n], .rk[data-n]'),
    function(el){
      /* an entry OPENS here, so whatever the walk holds now is where the previous one left off.
         An entry is an ancestor of everything in it, so it is reached before its own contents. */
      if (el.classList.contains('entry')) {
        if (openEntry) NOTATION[openEntry] = snapshot();
        openEntry = el.id; return;
      }
      // A CUT does NOT return: the marker rides on the very span that does the thing — §232's on the
      // span that coins `tal`, §267's on the rung that first shows a sign written as one glyph.
      var cut = el.getAttribute('data-cut'); if (cut && CUTS[cut]) CUTS[cut]();
      if (cut) moved();
      if (el.classList.contains('coin')) { var cn = el.getAttribute('data-sign');
        COINED[cn] = (el.textContent||'').trim(); COINED_AT[cn] = openEntry; moved(); return; }
      if (el.classList.contains('msg')) { renderMsg(el); return; }
      if (el.classList.contains('sg'))  { allFigures = false; el.innerHTML = mark(el.getAttribute('data-s')); return; }
      /* both carry the figure as a gloss (note #40): the reader can ask an inline number what it
         says without the page telling them anything the wire did not. */
      if (el.classList.contains('rk'))  { el.innerHTML = reckonNum(el.getAttribute('data-n'), !el.classList.contains('bare')); glossify(el, el.getAttribute('data-n')); return; }
      if (el.classList.contains('num')) { el.innerHTML = reckonNum(el.getAttribute('data-n'), el.classList.contains('barred')); glossify(el, el.getAttribute('data-n')); return; }
      /* A `.frag` is a wire quote a keeper is holding up to be READ OFF, so it keeps whatever the
         prose put in it (a `.lbl`, a caption) and the marks are APPENDED. That is the only thing
         separating it from a `.row`, which is redrawn whole. It joins this walk now rather than
         running in a pass of its own, so a frag can take a parse rung like anything else — and so
         there is one tone map in this file instead of two. */
      if (el.classList.contains('frag')) { ROWSTATE.set(el, standing());
        var h = drawAt(el, null); if (h) el.insertAdjacentHTML('beforeend', h); return; }
      if (el.hasAttribute('data-parse') || el.hasAttribute('data-code')) { ROWSTATE.set(el, standing()); renderRow(el); }
    }
  );
  if (openEntry) NOTATION[openEntry] = snapshot();     // the last entry closes on the end of the book
  walking = false;                                    // everything drawn from here on is a panel, not a place in the book

  /* ══ ONE RUNG SIMPLER — the step-down control on a drawn line ════════════════════════════════════
     A reader who cannot make anything of `same ⟅tal ●●●●○⟆ ⟅tal ●●●●○⟆` has, until now, nowhere to go
     but the prose around it. The rungs to go to already exist and are already how this page draws
     everything; what was missing was a way to ask. So every drawn line gets a control that steps it
     one rung DOWN the ladder, and round to where it started when it runs out.

     DOWN ONLY, which is not a limitation but the rule: `data-at` may reach back down the ladder and
     never up it, so every step this offers is one the page was already allowed to draw.

     "THE NEXT ONE THAT IS DISTINCT." Rungs collapse constantly — `hand`, `unworded` and `figures`
     are the same drawing for any statement with no coined word in it, which is most of them early
     on. A control that appeared to do nothing on two presses out of three would read as broken, so
     candidates are drawn and compared by their marks, and the first that actually differs wins.

     IN THE HAND THAT ROW WAS DRAWN IN (ROWSTATE), never the state the walk ended holding. */
  var addSteppers = (function(){
    function bareMarks(html){ return html.replace(/<[^>]+>/g, ''); }
    function rungAt(el){ return el.getAttribute('data-at') || 'hand'; }
    function canDraw(el, rung){
      /* below the break a rung needs only the code; above it, the parse. And `data-span` is a slice
         of the STREAM — there is no such thing as half a parse — so a spanned row stays on the code
         rungs however far down it is asked to go. */
      if (LADDER.indexOf(rung) < NEEDS_PARSE) return !!codeOf(el);
      if (el.getAttribute('data-span')) return false;
      return !!(el.getAttribute('data-parse') || wireOf(el).parse);
    }
    function drawAtRung(el, rung){
      var was = snapshot(), state = ROWSTATE.get(el);
      if (state) restore(state);
      foldMode = el.hasAttribute('data-fold');
      var html = '';
      try { html = LEVELS[rung](el); } catch (e) { html = ''; }
      foldMode = false; restore(was);
      return html;
    }
    // the next rung below `from` whose marks differ from what is on the page; null if there is none
    function nextDistinct(el, from, shownMarks){
      for (var i = LADDER.indexOf(from) - 1; i >= 0; i--) {
        var rung = LADDER[i];
        if (!canDraw(el, rung)) continue;
        var html = drawAtRung(el, rung);
        if (html && bareMarks(html) !== shownMarks) return { rung: rung, html: html };
      }
      return null;
    }

    /* WHERE THE MARKS LIVE INSIDE A ROW. A labeled row is a two-cell grid with `display: contents`,
       so a third child becomes a third grid cell and the line stacks — the control has to go INSIDE
       the cell holding the marks, not beside it. `.fig` is that cell where there is one. */
    function body(el){ return el.querySelector(':scope > .fig') || el; }

    function fit(el){
      if (el.classList.contains('flood')) return false;         // the §189 wall: not a statement
      var home = rungAt(el);
      if (!LEVELS[home]) return false;
      return !!nextDistinct(el, home, bareMarks(drawAtRung(el, home) || el.innerHTML));
    }

    function control(el){
      var home = rungAt(el), at = home;
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'simpler';
      btn.textContent = '↓';
      function say(){
        btn.title = at === home ? 'show it one step simpler'
                                : LEVEL_LABEL[at] + ' — press for the next, or to come back';
        btn.setAttribute('aria-label', btn.title);
      }
      say();
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var host = body(el);
        var next = nextDistinct(el, at, bareMarks(drawAtRung(el, at)));
        if (!next) { next = { rung: home, html: drawAtRung(el, home) }; }   // round back to where it began
        at = next.rung;
        var keep = host.querySelector(':scope > .lbl');
        host.innerHTML = next.html;
        if (keep) host.insertBefore(keep, host.firstChild);
        host.appendChild(btn);
        el.classList.toggle('stepped', at !== home);
        say();
      });
      body(el).appendChild(btn);
    }

    return function(root){
      Array.prototype.forEach.call(
        (root || document).querySelectorAll('.row[data-code], .row[data-parse], .frag[data-code], .run-row[data-code]'),
        function(el){ if (fit(el)) control(el); });
    };
  })();
  addSteppers(document);

  /* ══ THE WHOLE RUN ═══════════════════════════════════════════════════════════════════════════════
     An entry holds up four or five sayings out of a stretch seventy long; the rest of that stretch is
     the drilling the keeper is reading through. This opens it, on request, in the marks that page had
     reached, with the ones the entry itself draws carrying a band.

     Which stretch is `runsByEntry` in scripts/wire.js, not a judgement made here — every statement
     added sits BETWEEN two the keeper put on her page herself.
     One rung, `hand`: the panel is for bulk and repetition, which the drawn form shows and the tones
     do not. `foldMode` on, so a long statement opens at its joints.
     No caption over it. Every fact one could carry — how long the stretch is, which rows are also
     below — is already in front of the reader (plans/README.md §2b). */
  (function(){
    var R = DATA.runs || {}, RUNS = R.runs || {}, SPINE = R.spine || {};
    function build(entry, run){
      var was = snapshot();                                  // the walk's own end state, put back below
      restore(NOTATION[entry.id] || was);
      var shown = {}, i;
      for (i = 0; i < run.shown.length; i++) shown[run.shown[i]] = 1;
      // the panel holds rows directly — a wrapper would be a third frame inside two inset boxes
      var panel = document.createElement('div');
      panel.className = 'run'; panel.id = entry.id + '-run';
      var rows = '';
      for (i = run.lo; i <= run.hi; i++) {
        var st = SPINE[i]; if (!st || !st.c) continue;       // not in the bundle: draw nothing, claim nothing
        rows += '<div class="run-row' + (shown[i] ? ' here' : '') + '" data-code="' + st.c +
                '" data-at="hand" data-fold></div>';
      }
      panel.innerHTML = rows;
      foldMode = true;
      Array.prototype.forEach.call(panel.querySelectorAll('.run-row'), function(r){
        ROWSTATE.set(r, NOTATION[entry.id] || was);          // the hand the entry ends in
        r.innerHTML = LEVELS.hand(r);
      });
      foldMode = false;
      restore(was);
      addSteppers(panel);
      return panel;
    }

    Object.keys(RUNS).forEach(function(id){
      var entry = document.getElementById(id); if (!entry) return;
      /* after the head, before the first paragraph. A dispatch has no note and no watch line, so
         hang it off whichever of the three the entry has. */
      var head = entry.querySelector(':scope > h2') || entry.querySelector(':scope > .passfields')
              || entry.querySelector(':scope > .stamp');
      if (!head) return;

      /* a `<details>`, like the top bar's menu: it brings the opening, the keyboard and the focus
         ring, so the script below is only the closing. One item today; the next thing that wants to
         hang off an entry goes in beside it. */
      var menu = document.createElement('details');
      menu.className = 'entry-menu';
      menu.setAttribute('data-autoshut', '');    // js/topbar.js does the closing — see autoShut there
      menu.innerHTML =
        '<summary aria-label="more for this pass" title="more for this pass">⋮</summary>' +
        '<div class="entry-menu-pop">' +
          '<label class="run-check"><input type="checkbox" aria-controls="' + id + '-run">' +
          '<span>Show whole run</span></label>' +
        '</div>';
      entry.appendChild(menu);

      var box = menu.querySelector('input'), panel = null;
      box.addEventListener('change', function(){
        if (!panel) {                                        // built on the first ask: 40 of these
          panel = build(entry, RUNS[id]);                    // at load is a thousand rows nobody wanted
          head.parentNode.insertBefore(panel, head.nextSibling);
        }
        panel.classList.toggle('open', box.checked);
      });

    });
  })();

  /* SEALED IN ITS OWN CLOSURE, like the two blocks above it. It reads the renderer (DATA, atomsOf,
     SCRAWL, COINED and the two walk records) and writes nothing back, so nothing below the walk can
     reach it and it can reach nothing but what it names. This block was NOT wrapped until 08-12 and
     that is not cosmetic: it was first written into `keeperNumerals` by mistake, where `DATA` and
     `atomsOf` are not in scope at all, and the mistake was invisible because a bare block inside a
     900-line function has no edge to be on the wrong side of. */
  (function(){
    /* ══ ASK A MARK WHERE IT CAME FROM ═══════════════════════════════════════════════════════════════
       A reader four hundred passes past §221 meets `‿` with nothing to get back to the wrapper it
       stands for — 32 of the 34 wrong reconstructions in the blind reads are that failure.

       The sheet is GENERATED from the mark inventory (`_includes/mark_cuts.json`), so a mark the
       renderer draws and nobody declares cannot acquire an explanation here — that stays a hole in the
       inventory, where a gate can see it.

       ★ IT MUST NOT COST THE READER A SELECTION. The panel hangs off <body>, so it is never inside a
       range anybody is copying; and a click that ended a drag is a selection, not a question. */
    var SHEET = DATA.marks || {};
    var KIND  = { HERS: 'a keeper\'s own mark', STRUCTURE: 'the wire\'s own' };
    var pop = null, popFor = null;

    /* The class must match WHOLE — `nil w` is the founder's word, `nil` is Ren's mark, and they are
       cut fourteen passes and one argument apart. Up a few levels, because a mark can be tapped
       through a wrapper (`.fam` round a compound). */
    function askedFor(node){
      for (var e = node, i = 0; e && e.nodeType === 1 && i < 4; e = e.parentNode, i++) {
        if (typeof e.className === 'string' && SHEET[e.className]) return e;
        // a drawn sign (`data-sid`, set in gloss()), or the coining span itself, which names its sign
        if (e.getAttribute && (nameOfSid(e.getAttribute('data-sid'))
                               || SCRAWL[e.getAttribute('data-sign')])) return e;
      }
      return null;
    }
    /* A SIGN ALREADY ANSWERS ON HOVER — `title="sign 18"`, the cheap version, and worth keeping for a
       reader who only wants the figure and does not want to press anything. But the panel says that and
       four things more, so with both up the browser's own tooltip is a second answer to a question
       already answered, sitting on top of the first. The title comes off while the panel is open and
       goes back when it shuts, so hovering still works and asking does not stutter. */
    var hushed = null;
    function hush(el){ var t = el.getAttribute('title');
      if (t !== null) { hushed = [el, t]; el.removeAttribute('title'); } }
    function unhush(){ if (hushed) { hushed[0].setAttribute('title', hushed[1]); hushed = null; } }
    function shutAsk(){ unhush(); if (pop) { pop.remove(); pop = null; popFor = null; } }

    /* ══ AND A SIGN, WHICH IS THE HARDER HALF ═════════════════════════════════════════════════════════
       A mark means the same wherever it is met, so its answer is one row in a sheet. A sign wears two
       faces — the scrawl it arrives in, and the word a keeper cuts for it later — and the reader who
       needs help is the one who has lost the join between them, three hundred passes past the pass
       where it was made. So the panel shows BOTH faces and the run underneath, which is the only thing
       that was ever true of both.

       NOTHING HERE IS DECLARED ANYWHERE. The two faces, the run and the two passes all fall out of what
       the renderer already holds: `SCRAWL` off the sign table, `COINED` off the walk, the run off the
       sign's own id. That is why there are no thirty-nine hand-written lines to go stale — and why the
       gate on it is not "did somebody write this down" but "does the wire contain what this claims".

       ★ AND IT MAY NOT REACH FORWARD. A reader at §193 tapping ⡒ is standing before anybody has named
       anything; handing her `sarn` there is the page telling her something the book has not. The word
       appears only from the pass that cuts it — the same rule every mark on this page already obeys,
       and the only thing about a sign that is positional at all. */
    /* Number back to name, built once off the sign table the renderer already holds. The name stays in
       here and never reaches the page: what the panel prints is the scrawl, the run, and — once a
       keeper has cut it — her word. */
    var BY_SID = null;
    function nameOfSid(sid){
      if (!sid) return null;
      if (!BY_SID) { BY_SID = {}; for (var k in SCRAWL) { var s = sidOf(k); if (s && !(s in BY_SID)) BY_SID[s] = k; } }
      return BY_SID[sid] || null;
    }
    function passAt(el){ var e = el.closest ? el.closest('.entry[id]') : null; return e ? +e.id.slice(1) : 0; }
    function signPanel(el, name){
      var d = document.createElement('div'); d.className = 'mk-pop';
      var word = COINED[name], cutAt = COINED_AT[name];
      var told = word !== undefined && cutAt && passAt(el) >= +cutAt.slice(1);
      var faces = '<span class="scrawl">' + SCRAWL[name] + '</span>'
                + (told ? '<span class="mk-word">' + word + '</span>' : '');
      var h = '<span class="mk-face">' + faces + '</span>'
            + '<span class="mk-kind">a sign the wire sends</span>';
      var run = runOf(name);
      if (run) h += '<p class="mk-stands"><span class="mk-lbl">comes in as</span> '
                  + '<span class="mk-run">' + run + '</span></p>';
      var where = told ? cutAt : SEEN_AT[name];
      if (where) h += '<a class="mk-cut passref" href="#' + where + '">'
                    + (told ? 'named at ' : 'first on the page at ')
                    + reckonNum(where.slice(1), true) + '</a>';
      d.innerHTML = h;
      return d;
    }

    function askPanel(el, row){
      var d = document.createElement('div');
      d.className = 'mk-pop';
      var face = (el.textContent || '').slice(0, 8);
      var h = (face ? '<span class="mk-face">' + face + '</span>' : '')
            + '<span class="mk-kind">' + KIND[row.k] + '</span>'
            + '<p class="mk-say">' + row.s + '</p>';
      if (row.c) h += '<p class="mk-stands"><span class="mk-lbl">stands for</span> '
                    + '<span class="mk-run">' + atomsOf(row.c) + '</span></p>';
      h += '<a class="mk-cut passref" href="#' + row.e + '">cut at '
         + reckonNum(row.e.slice(1), true) + '</a>';
      d.innerHTML = h;
      return d;
    }

    /* Page coordinates, so the panel travels with the text it belongs to and no scroll handler is
       needed. Beside and below where it can be; flipped up when the foot of the window is closer. */
    function place(d, el){
      var r = el.getBoundingClientRect(), doc = document.documentElement;
      var sx = window.pageXOffset, sy = window.pageYOffset, pad = 8;
      d.style.left = '-9999px'; d.style.top = '0';
      var w = d.offsetWidth, h = d.offsetHeight;
      var x = Math.min(r.left + sx, sx + doc.clientWidth - w - pad);
      var y = r.bottom + sy + pad;
      if (r.bottom + pad + h > doc.clientHeight && r.top - pad - h > 0) y = r.top + sy - h - pad;
      d.style.left = Math.max(sx + pad, x) + 'px';
      d.style.top = y + 'px';
    }

    var downAt = null;
    document.addEventListener('pointerdown', function(e){ downAt = [e.clientX, e.clientY]; }, true);
    document.addEventListener('click', function(e){
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // let the browser have its own gestures
      if (pop && pop.contains(e.target)) { if (e.target.closest('.mk-cut')) shutAsk(); return; }
      if (downAt && Math.abs(e.clientX - downAt[0]) + Math.abs(e.clientY - downAt[1]) > 6) return shutAsk();
      var sel = window.getSelection();
      if (sel && !sel.isCollapsed) return shutAsk();
      var el = askedFor(e.target);
      if (!el || el === popFor) return shutAsk();                 // ask it again to put it away
      shutAsk();
      var row = typeof el.className === 'string' && SHEET[el.className];
      pop = row ? askPanel(el, row)
                : signPanel(el, nameOfSid(el.getAttribute('data-sid')) || el.getAttribute('data-sign'));
      popFor = el; hush(el);
      document.body.appendChild(pop);
      place(pop, el);
    });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') shutAsk(); });
  })();
})();
