/* circuit-sim.js — live UNLESS-gate simulator for the listener lesson.
   Engine ported verbatim from the site's gate pages; renderer ported from drawgate-txt.pl so
   live figures are pixel-consistent with the .pic gate stills. Reads .circuit[data-net]. */
(function () {
 function UnlessGate() {
   this.state = true;
   this.nextState = true;
   this.forced = false;
   this.hidden = false;
   this.src = null;
   this.dest = null;

   this.block = function() {
     this.nextState = false;
   }

   this.prepareForUpdate = function() {
     if (!this.forced) {
       this.nextState = true;
       if (this.src!=null) {
	 this.nextState = this.src.state;
       }
     }
   }

   this.update = function() {
     if (!this.forced) {
       if (this.state) {
	 if (this.dest!=null && !this.hidden) {
	   this.dest.block();
	 }
       }
     }
   }


   this.finalizeUpdate = function() {
     if (!this.forced) {
       this.state = this.nextState;
     }
     //this.forced = false;
   }

   this.set = function(state) {
     this.state = state;
     this.forced = true;
   }

   this.getSource = function() {
     return this.src;
   }

   this.getDestination = function() {
     return this.dest;
   }
 }


 ////////////////////////////////////////////////////////////////////////
 // UnlessNet

 function UnlessNet() {
   this.net = [];
   this.nodes = new Object();
   this.names = new Object();
   this.key = 1;

   this.add = function(name) {
     if (this.nodes[name]==null) {
       var node = new UnlessGate();
       node.key = this.key;
       this.key = this.key+1;
       this.nodes[name] = node;
       this.names[node.key] = name;
       this.net.push(node);
     }
   }

   this.get = function(name) {
     return this.nodes[name];
   }

   this.setSource = function(name,srcName) {
     var ref = this.nodes[name];
     if (ref!=null) {
       ref.src = this.nodes[srcName];
     }
   }

   this.setDestination = function(name,destName) {
     var ref = this.nodes[name];
     if (ref!=null) {
       ref.dest = this.nodes[destName];
     }
   }

   this.update = function() {
     for (var i=0; i<this.net.length; i++) {
       this.net[i].prepareForUpdate();
     }
     for (var i=0; i<this.net.length; i++) {
       this.net[i].update();
     }
     for (var i=0; i<this.net.length; i++) {
       this.net[i].finalizeUpdate();
     }
   }

   this.toString = function() {
     var sb = "";
     for (var i=0; i<this.net.length; i++) {
       var u = this.net[i];
       if (!u.hidden) {
	 var name = this.names[u.key];
	 var src = u.getSource();
	 var dest = u.getDestination();
	 var srcName = "[1]";
	 var destName = "[0]";
	 if (src!=null) { srcName = this.names[src.key]; }
	 if (dest!=null) { destName = this.names[dest.key]; }
	 var line = "node " + name + " (" + srcName + ":" +
		    destName + ") = " + u.state + "\n";
	 sb = sb + line;
       }
     }
     return sb;
   }

   this.disconnect = function() {
     for (var i=0; i<this.net.length; i++) {
       var u = this.net[i];
       u.src = null;
       u.dest = null;
     }
   }
 }

 ////////////////////////////////////////////////////////////////////////
 // Pair

 function Pair(x,y) {
   this.x = x;
   this.y = y;
   this.key = 257*x+y;
   this.equals = function(p) {
     return p.x==this.x && p.y==this.y;
   }
 }


 ////////////////////////////////////////////////////////////////////////
 // UnlessGrid

 function UnlessGrid() {
   this.points = new Object();
   this.pointsList = [];
   this.names = new Object();
   this.externalize = new Object();
   this.ct = 0;
   this.xbase = -1;
   this.ybase = -1;

   this.add = function(x,y,dx,dy,label) {
     this.points[(new Pair(x,y)).key] = new Pair(dx,dy);
     this.pointsList.push(new Pair(x,y));
     if (label!=null) {
       this.names[label] = new Pair(x,y);
       this.externalize[this.getName(x,y)] = label;
     }
     if (this.xbase<0) {
       this.xbase = x;
       this.ybase = y;
       if (dy!=0) {
	 this.xbase++;
	 this.ybase++;
       }
     }
     this.ct++;
   }

   this.nearby = function(x,y) {
     for (var i=0; i<this.pointsList.length; i++) {
       var pt = this.get(i);
       var nx = (pt.x-x)*(pt.x-x);
       var ny = (pt.y-y)*(pt.y-y);
       if (pt.dx!=0) {
	 ny *= 5;
       } else {
	 nx *= 5;
       }
       var diff = nx+ny;
       if (diff<1) {
	 return i;
       }
     }
     return -1;
   }

   this.wobble = function(x0,y0) {
     var idx = this.nearby(x0,y0);
     var near = null;
     var flipped = false;
     if (idx>=0) {
       near = this.get(idx);
       var dx = x0-near.x;
       var dy = y0-near.y;
       var s = 1;
       var p = this.pointsList[idx];
       var dp = this.points[p.key];
       if (Math.abs(dx)>Math.abs(dy)) {
	 if (dx*dp.x<0) {
	   dp.x = -dp.x;
	   flipped = true;
	 }
       } else {
	 if (dy*dp.y<0) {
	   dp.y = -dp.y;
	   flipped = true;
	 }
       }
     }
     return flipped;
   }

   this.getExternalName = function(x,y) {
     return this.externalize[this.getName(x,y)];
   }

   this.append = function(x,y,net) {
     var x0 = Math.floor(x+0.5);
     var y0 = Math.floor(y+0.5);
     var dx = Math.abs(x0-this.xbase);
     var dy = Math.abs(y0-this.ybase);
     var gx = 0;
     var gy = 0;
     if (dx%2==0 && dy%2==0) {
       gx = 1;
     } else {
       gy = 1;
     }
     if ((dx+dy)%2==1) {
       return null;
     }
     var name = this.getName(x0,y0);
     this.add(x0,y0,gx,gy);
     net.add(name);
     this.wobble(x,y);
     net.disconnect();
     this.connect(net);
   }

   this.getName = function(x,y) {
     return "(" + x + "," + y + ")";
   }

   this.getLabel = function(label) {
     var p = this.names[label];
     return this.getName(p.x,p.y);
   }

   this.length = function() {
     return this.ct;
   }

   this.get = function(i) {
     if (i<0) {
       return null;
     }
     var p = this.pointsList[i];
     var dp = this.points[p.key];
     var x = p.x;
     var y = p.y;
     var dx = dp.x;
     var dy = dp.y;
     var name = this.getName(x,y);
     return {x: x, y: y, dx: dx, dy: dy, name: name};
   }

   this.render = function(net) {
     var str = "";
     for (var i=0; i<this.ct; i++) {
       var p = this.pointsList[i];
       var dp = this.points[p.key];
       var x = p.x;
       var y = p.y;
       var dx = dp.x;
       var dy = dp.y;
       var name = this.getName(x,y);
       var unit = net.get(name);
       var v = 0;
       var b = unit.state;
       if (b) { v = 1; }
       if (unit.hidden) continue;
       str += x + " " + y + " " + dy + " " + dx;
       var ext = this.externalize[name];
       if (ext!=null) {
	 str += " " + ext;
       }
       str += "\n";
     }
     return str;
   }

   this.renderCos = function(net) {
     var str = "(vector \n";
     for (var i=0; i<this.ct; i++) {
       var p = this.pointsList[i];
       var dp = this.points[p.key];
       var x = p.x;
       var y = p.y;
       var dx = dp.x;
       var dy = dp.y;
       var name = this.getName(x,y);
       var unit = net.get(name);
       var v = 0;
       var b = unit.state;
       if (b) { v = 1; }
       if (unit.hidden) continue;
       var ext = this.externalize[name];
       if (ext==null) {
	 ext = 0;
       }
       var line = "  (vector ";
       line += (x-dx) + " " + (y-dy) + " " + (x+dx) + " " + (y+dy);
       line += " " + v;
       line += " " + ext;
       line += ")";
       str += line;
       str += "\n";
     }
     str += ")\n";
     return str;
   }

   this.connect = function(net) {
     for (var i=0; i<this.ct; i++) {
       var p = this.pointsList[i];
       var rec = this.points[p.key];
       var x = p.x;
       var y = p.y;
       var dx = rec.x;
       var dy = rec.y;
       var x0 = x+dx*2;
       var y0 = y+dy*2;
       var x90 = x+dx+dy;
       var y90 = y+dy-dx;
       var x270 = x+dx-dy;
       var y270 = y+dy+dx;
       var rec0 = this.points[(new Pair(x0,y0)).key];
       var rec90 = this.points[(new Pair(x90,y90)).key];
       var rec270 = this.points[(new Pair(x270,y270)).key];
       var blocking = false;
       var lr = false;
       if (rec90!=null && rec270!=null) {
	 if (rec90.equals(rec270)) {
	   blocking = true;
	   lr = true;
	 }
       }
       if (rec0!=null) {
	 if (rec0.equals(rec)) {
	   blocking = false;
	 }
       }
       if (blocking) {
	 // set appropriate destination
	 net.setDestination(this.getName(x,y),
			    this.getName(x+dx+rec90.x,y+dy+rec90.y));
       }
       if (!blocking) {
	 if (rec0!=null) {
	   if (rec0.equals(rec)) {
	     // good to src
	     net.setSource(this.getName(x0,y0),
			   this.getName(x,y));
	   }
	 }
	 if (!lr) {
	   if (rec90!=null) {
	     if (x90-rec90.x==x+dx &&
		 y90-rec90.y==y+dy) {
	       // good to src
	       net.setSource(this.getName(x90,y90),
			     this.getName(x,y));
	     }
	   }
	   if (rec270!=null) {
	     if (x270-rec270.x==x+dx &&
		 y270-rec270.y==y+dy) {
	       // good to src
	       net.setSource(this.getName(x270,y270),
			     this.getName(x,y));
	     }
	   }
	 }
       }
     }	
   }

   this.compile = function() {
     var net = new UnlessNet();
     for (var i=0; i<this.ct; i++) {
       var p = this.pointsList[i];
       var dp = this.points[p.key];
       var x = p.x;
       var y = p.y;
       var dx = dp.x;
       var dy = dp.y;
       net.add(this.getName(x,y));
     }
     this.connect(net);
     return net;
   }
 }


 ////////////////////////////////////////////////////////////////////////
 // GridLoader

 function gridLoader(str) {
   var grid = new UnlessGrid();
   str = str + "\n";
   var parts = [];
   var part = "";
   for (var i=0; i<str.length; i++) {
     var ch = str.charAt(i);
     if (ch==' '||ch=='\n'||ch=='\r'||ch=='.') {
       if (part!="") {
	 parts.push(part);
       }
       part = "";
     }
     if (ch=='\n'||ch=='\r'||ch=='.') {
       if (parts.length>=4) {
	 var x = parseInt(parts[0]);
	 var y = parseInt(parts[1]);
	 var dx = parseInt(parts[3]);
	 var dy = parseInt(parts[2]);
	 var name = parts[4];
	 grid.add(x,y,dx,dy,name);
       }
       parts = [];
     }
     if ((ch>='0'&&ch<='9')||(ch>='A'&&ch<='Z')||(ch>='a'&&ch<='z')||
	 ch=='_'||ch=='-') {
       part = part + ch;
     }
   }
   return grid;
 }


 ////////////////////////////////////////////////////////////////////////
 // Renderer — port of drawgate-txt.pl: an element list (+ live states) -> a lit/dark (:/. ) grid,
 // pixel-consistent with the .pic gate images (same shafts, rails, arrowheads, border, palette),
 // so a live figure and a still one read as the same drawn hand.  (drawgate swaps the 3rd/4th
 // field vs the grid, hence dx<-pt.dy, dy<-pt.dx below.)

 var DARK = [8, 11, 9], LIT = [143, 230, 168];   // the .pic palette (matches every gate still)

 function drawGrid(grid, net) {
   var S = 6, S2 = 8, arr = {}, key = function (x, y) { return x + ' ' + y; }, i, i2, j, k;
   for (i = 0; i < grid.length(); i++) {
     var pt = grid.get(i), node = net.get(pt.name); if (node.hidden) continue;
     var xmid = pt.x, ymid = pt.y, dx = pt.dy, dy = pt.dx, v = node.state ? 1 : 0;
     for (i2 = -S + 1; i2 < S; i2++) arr[key(xmid * S2 + dy * i2, ymid * S2 + dx * i2)] = 1;               // shaft
     if (v) for (i2 = -S + 1; i2 < S - 1; i2++) {                                                          // solid rails (true)
       arr[key(xmid * S2 + dy * i2 + dx, ymid * S2 + dx * i2 - dy)] = 1;
       arr[key(xmid * S2 + dy * i2 - dx, ymid * S2 + dx * i2 + dy)] = 1;
     }
     for (i2 = 0; i2 < 3; i2++) for (j = -i2; j <= i2; j++)                                                // arrowhead
       arr[key(xmid * S2 + dy * (S - i2) - dx * j, ymid * S2 + dx * (S - i2) + dy * j)] = 1;
   }
   var xmax = 0, ymax = 0, xmin = 1e9, ymin = 1e9;
   for (k in arr) { var p = k.split(' '), x = +p[0], y = +p[1]; if (x > xmax) xmax = x; if (y > ymax) ymax = y; if (x < xmin) xmin = x; if (y < ymin) ymin = y; }
   var d1 = ymax + ymin + 8, d2 = xmax + xmin + 8, g = [];
   for (var yy = 0; yy < d1; yy++) { var s = ''; for (var xx = 0; xx < d2; xx++) { var b = (xx === 0 || xx === d2 - 1 || yy === 0 || yy === d1 - 1); s += (b || arr[key(xx, yy)]) ? ':' : '.'; } g.push(s); }
   return { W: d2, H: d1, g: g };
 }

 function paint(cvs, d) {
   cvs.width = d.W; cvs.height = d.H;
   var ctx = cvs.getContext('2d'), img = ctx.createImageData(d.W, d.H), o = 0;
   for (var y = 0; y < d.H; y++) { var row = d.g[y]; for (var x = 0; x < d.W; x++) { var c = row[x] === ':' ? LIT : DARK; img.data[o++] = c[0]; img.data[o++] = c[1]; img.data[o++] = c[2]; img.data[o++] = 255; } }
   ctx.putImageData(img, 0, 0);
 }

 ////////////////////////////////////////////////////////////////////////
 // Widget — a reusable live simulator for any UNLESS-gate circuit.  Reads its network from
 // data-net (rows separated by ';'), draws in the keeper's ink, and lets the reader feed the
 // mouths and sweep.  Degrades to the still <img class="pic"> inside it when JS is off.

 function initCircuit(box) {
   var netStr = (box.getAttribute('data-net') || '').replace(/;/g, '\n');
   if (!netStr) return;
   var grid = gridLoader(netStr), net = grid.compile();
   var labels = []; for (var L in grid.names) labels.push(L);
   var disp = {}; (box.getAttribute('data-mouths') || '').split(',').forEach(function (pr) { var q = pr.split(':'); if (q[1]) disp[q[0].trim()] = q[1].trim(); });
   var forcing = {};                                            // label -> true(lit) | false(dark) | undefined(free)

   var img = box.querySelector('img');                          // the .pic fallback (shown with no JS)
   var wrap = document.createElement('div'); wrap.className = 'circuit-live';
   var frame = document.createElement('div'); frame.className = 'circuit-frame';
   var cvs = document.createElement('canvas'); cvs.className = 'circuit-cvs'; frame.appendChild(cvs); wrap.appendChild(frame);
   var bar = document.createElement('div'); bar.className = 'circuit-bar'; wrap.appendChild(bar);

   /* Which way is a mouth QUIET? An undriven part in this family sits high (see prepareForUpdate:
      with no source it goes true), so on a circuit whose inputs are active-low, resting them low is
      holding them asserted for ever — the forbidden condition, and it free-runs. data-rest="high"
      lets such a circuit idle the way it is built to. */
   var restHigh = {};
   (box.getAttribute('data-rest') || '').split(',').forEach(function (n) { if (n.trim()) restHigh[n.trim()] = 1; });
   var REST = function (L) { return !!restHigh[L]; };
   labels.forEach(function (L) { forcing[L] = REST(L); net.get(grid.getLabel(L)).set(REST(L)); });
   function readOut() { return net.get(grid.get(grid.length() - 1).name).state; }   // the tail = the answer she reads

   /* Has it stopped moving? A sweep advances the whole net by one rank, so on anything with loops
      in it the tail keeps changing for a while after you touch a mouth, and a reading taken before
      it stops is a reading of the middle of the motion, not of the answer. Nothing subtle is needed
      to tell: sweep, and see whether every part stands where it stood. The message settles a
      circuit for as many sweeps as it has parts (its `sim` is driven by the circuit's own length),
      which is the same idea with the counting done in advance. */
   function shot() {
     var s = '', i;
     for (i = 0; i < grid.length(); i++) s += net.get(grid.get(i).name).state ? '1' : '0';
     return s;
   }
   var settled = false, turns = false;
   var timer = null;
   function say() {
     var word = readOut() ? 'whole' : 'broken';
     var raised = labels.some(function (L) { return forcing[L] !== REST(L); });
     if (turns) {                                            // it came back to where it had been
       sayEl.textContent = 'it will not rest — ' + word;
     } else if (!labels.length) {                            // the ring: no mouths to feed it with
       sayEl.textContent = timer ? 'it will not rest — ' + word : 'still — set it going';
     } else if (!settled) {
       sayEl.textContent = 'still going through it — ' + word;
     } else {
       sayEl.textContent = (raised ? 'under your hand — ' : 'it holds — ') + word;
     }
   }
   function render() { paint(cvs, drawGrid(grid, net)); say(); }
   function sweep() { var was = shot(); net.update(); settled = (shot() === was); if (settled) turns = false; render(); }

   /* Sweep until it stops moving — or until it is plain that it never will. Two outcomes, and the
      difference between them is the whole of §574:
        every part stands where it stood  -> it has settled, and the tail is the answer
        it comes back to a state it was already in -> it turns, and there is no answer to read
      The ring is the second by construction. The latch is the second too if you raise both mouths
      and let go, which is a real thing to find and not a fault. So this must never be a fixed
      count of sweeps: a count cannot tell a slow part from a turning one. */
   function settle() {
     var seen = Object.create(null), s = shot(), i;
     settled = false; turns = false;
     for (i = 0; i < 500; i++) {
       if (s in seen) { turns = true; break; }               // been here before: it is going round
       seen[s] = 1;
       net.update();
       var now = shot();
       if (now === s) { settled = true; break; }             // nothing moved: it is still
       s = now;
     }
     render();
   }

   var relabel = [];
   labels.forEach(function (L) {
     var b = document.createElement('button'); b.type = 'button'; b.className = 'c-in';
     function lab() { b.innerHTML = (disp[L] || L) + ' <span class="sw ' + (forcing[L] ? 'lit' : 'dark') + '"></span>'; }
     b.addEventListener('click', function () {                     // rest(low) <-> raised(high), both forced
       forcing[L] = !forcing[L]; net.get(grid.getLabel(L)).set(forcing[L]); lab(); settled = false; turns = false; render();
     });
     lab(); relabel.push(lab); bar.appendChild(b);
   });
   if (labels.length) {
     var hoff = document.createElement('button'); hoff.type = 'button'; hoff.className = 'c-off'; hoff.textContent = 'let it fall quiet';
     hoff.addEventListener('click', function () { labels.forEach(function (L) { forcing[L] = REST(L); net.get(grid.getLabel(L)).set(REST(L)); }); relabel.forEach(function (f) { f(); }); render(); });
     bar.appendChild(hoff);
   }
   var sweepB = document.createElement('button'); sweepB.type = 'button'; sweepB.className = 'c-sweep'; sweepB.textContent = 'sweep';
   sweepB.addEventListener('click', function () { stop(); sweep(); }); bar.appendChild(sweepB);
   // One sweep is one rank. On a part with loops in it that is a long way short of the answer, and
   // clicking twenty-one times to see a both-knot answer is not reading, it is drudgery.
   var settleB = document.createElement('button'); settleB.type = 'button'; settleB.className = 'c-settle';
   settleB.textContent = 'sweep till still';
   settleB.addEventListener('click', function () { stop(); settle(); }); bar.appendChild(settleB);
   var runB = document.createElement('button'); runB.type = 'button'; runB.className = 'c-run'; runB.textContent = 'let it run';
   function stop() { if (timer) { clearInterval(timer); timer = null; runB.textContent = 'let it run'; } }
   function run() { if (timer) return; runB.textContent = 'rest'; timer = setInterval(sweep, 560); }
   runB.addEventListener('click', function () { if (timer) stop(); else run(); }); bar.appendChild(runB);
   var sayEl = document.createElement('span'); sayEl.className = 'circuit-say'; bar.appendChild(sayEl);

   if (img) img.style.display = 'none';
   box.appendChild(wrap);
   // Load settled. A part with mouths should present its resting reading, not the middle of the
   // motion it happens to start in. The ring has no mouths and is left alone: "set it going" is
   // its right first word, and settling it would only report what §574 spends the pass finding out.
   if (labels.length) settle(); else render();
   /* A part with a beat has no state until it has been beaten once — true of the real thing, and
      not what a reader should meet on a page about a part that holds. data-start names mouths to
      pulse once at load, which is what its world does to it anyway. */
   (box.getAttribute('data-start') || '').split(',').forEach(function (n) {
     var L = n.trim(); if (!L || !(L in forcing)) return;
     forcing[L] = !REST(L); net.get(grid.getLabel(L)).set(forcing[L]); settle();
     forcing[L] = REST(L);  net.get(grid.getLabel(L)).set(forcing[L]); settle();
   });
   relabel.forEach(function (f) { f(); });
 }

 (function () {
   var boxes = document.querySelectorAll('.circuit');
   if (!boxes.length) return;
   Array.prototype.forEach.call(boxes, initCircuit);
 })();

})();
