/* unless-net.js — the UNLESS-gate engine: a grid of arrow elements, compiled into a net that
   settles. THE MESSAGE'S OWN LOGIC PRIMITIVE, and the whole of it.

   ONE COPY. This lived twice — inline in _layouts/gate.html (the circuit editor pages) and again in
   js/circuit-sim.js (the story's live figures) — 416 identical lines apart from one: gate.html's
   copy wrote `node = new UnlessGate()` with no `var`, leaking a global that the other copy had
   already fixed. Neither knew about the other.

   Defines UnlessGate, UnlessNet, Pair, UnlessGrid and gridLoader as globals, which is what
   gate.html's inline script expects and what circuit-sim.js reads from inside its closure.
   Load it BEFORE either. */

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
