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
  if (!(v >= 0)) return '';
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
  var allFigures = false;          // "in plain figures": force EVERY sign to its own figure (one source w/ hand mode, so the two can't disagree)
  var WIRE  = DATA.wire   || {};   // code -> {parse, spider} for data-code widgets (looked up client-side, not baked)
  var TONE  = { '0':'˩','1':'˨','2':'˦','3':'˥' };
  function wireOf(el){ var c = el.getAttribute('data-code'); return (c && WIRE[c]) ? WIRE[c] : {}; }
  function tones(code, cls){                   // RAW: the four-symbol stream, in real tone chars (copy-pasteable)
    var s = ''; for (var i = 0; i < code.length; i++) s += TONE[code.charAt(i)] || '?';
    // `.tones` is the generated wire-quote look (letter-spaced); `.tn` is the founder writing pitches
    // down in a row. Same characters, one implementation — the caller says which page-furniture it is.
    return '<span class="' + (cls || 'tones') + '">' + s + '</span>';
  }
  function TONE_RUN(code){                     // the pitch characters alone, no wrapper
    var s = ''; for (var i = 0; i < code.length; i++) s += TONE[code.charAt(i)] || '?';
    return s;
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
  function gloss(html, say){ return '<span class="gloss" title="' + say + '" data-v="' + say + '">' + html + '</span>'; }
  function glossify(el, say){ if (say == null) return; el.classList.add('gloss'); el.title = say; el.setAttribute('data-v', say); }
  function signGloss(name){ var id = idOf(name); return id === null ? null : 'sign ' + id; }

  function scrawlSpan(name){
    if (!numeralsOn) { var r = runOf(name); if (r) return r; }
    if (!SCRAWL[name]) return '<span class="gl" style="opacity:.4">▩</span>';
    var g = '<span class="scrawl sign-fb">'+SCRAWL[name]+'</span>', say = signGloss(name);
    return say ? gloss(g, say) : g; }
  /* `data-unworded` on a row — DRAW THIS ONE WITHOUT HER WORDS. Same distinction `.msg` already
     draws between `hand` and `glyph` (her marks vs the message's own signs), narrowed to a single
     row and stopping short of `allFigures`, which forces scrawl and so says nothing before §267.
     A keeper can write any form she has met, so which form a row takes is an EDITORIAL choice about
     what that row is for — not an event in her night. §228 lays three lists side by side to compare
     them: `tirrel` on the first line and the runs on the other two makes three kin look like two
     kin and a stranger, and no sentence can repair a row that draws the comparison wrong. */
  var unworded = false;
  function mark(name){                             // her token once introduced; else the sign in spider scrawl
    if (allFigures) return scrawlSpan(name);                                         // plain-scrawl view: every sign as its scrawl
    if (!unworded && COINED[name] !== undefined) { var t=COINED[name];                    // she has coined it (a `.coin` span above, in reading order) -> her token
      /* her word carries the sign's NUMBER too, so a reader can tie the word she reads back to the
         figure she met before it was named — the join the book is otherwise asking them to hold. */
      var tok = '<span class="gl'+(/[a-z]/i.test(t)?' w':'')+'">'+t+'</span>', say = signGloss(name);
      return say ? gloss(tok, say) : tok; }
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
        return '<span class="fam">'
             + '<span class="bit">▪</span><span class="cup o">⟅</span> '
             + parts.join(' ')
             + ' <span class="cup c">⟆</span></span>';
      return '<span class="fam">' + parts.join('<span class="fj">‿</span>') + '</span>';
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
       the row would vanish — which is why labelled rows used to have to be hand-authored too. Lift it
       out, redraw, put it back.
       A LABELLED ROW MUST BE EXACTLY TWO CHILDREN. `.rows.labeled` is a two-column grid and sets
       `display: contents` on the row, so every child of the row becomes a grid cell — a hand row was
       always `.lbl` + `.fig`, two cells. Dropping the drawn spans in loose gives N cells and the line
       stacks vertically down the two columns. Wrap them in the same `.fig` the hand rows used. */
    var lbl = el.querySelector(':scope > .lbl'), body = LEVELS[at](el);
    el.innerHTML = lbl ? '<span class="fig">' + body + '</span>' : body;
    if (lbl) el.insertBefore(lbl, el.firstChild);
    foldMode = false;
  }

  /* ONE walk, in DOCUMENT ORDER — this is what makes coining linear/positional. A `.coin` span
     sits in the prose exactly where the keeper coins a shorthand; passing it switches that sign
     on (COINED) from there down. Every exhibit after it shows the token; everything before shows
     raw scrawl. The token itself is the span's own visible glyph — no duplication, no pass numbers.
     `.sg` prose marks (is/int) and `.msg`/`.row` exhibits all render through the same COINED map. */
  Array.prototype.forEach.call(
    document.querySelectorAll('.coin[data-sign], [data-cut], .msg, .row[data-parse], .row[data-code], .frag[data-code], .sg[data-s], .num[data-n], .rk[data-n]'),
    function(el){
      // A CUT does NOT return: the marker rides on the very span that does the thing — §232's on the
      // span that coins `tal`, §267's on the rung that first shows a sign written as one glyph.
      var cut = el.getAttribute('data-cut'); if (cut && CUTS[cut]) CUTS[cut]();
      if (el.classList.contains('coin')) { COINED[el.getAttribute('data-sign')] = (el.textContent||'').trim(); return; }
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
      if (el.classList.contains('frag')) { var h = drawAt(el, null); if (h) el.insertAdjacentHTML('beforeend', h); return; }
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

  function current() {
    /* the pass you are READING is the last one whose head has gone by, not the one filling the most
       screen: a long entry's exhibits would otherwise keep the previous pass in the bar for
       screenfuls after you had left it. The line sits a third of the way down, where the eye is. */
    var line = window.innerHeight * 0.33, found = null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].getBoundingClientRect().top <= line) found = entries[i]; else break;
    }
    return found;
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
   doesn't need it, since following it is the better answer to "which pass is this".

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
  var DRAWN   = '[data-code], [data-parse], .msg, .frag';
  var NO_LINK = '.stamp, .tu-head';    // a heading must not become a link to its own entry
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

  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('.gloss');
    Array.prototype.forEach.call(document.querySelectorAll('.gloss.showing'), function(el){
      if (el !== t) el.classList.remove('showing');     // one at a time, so taps don't litter the page
    });
    if (t) t.classList.toggle('showing');
  });
})();

