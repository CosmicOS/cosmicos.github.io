#!/usr/bin/env node
/* Write a copy of the built page showing ONE element and nothing else.
 *
 * look.sh used to render the whole page tall enough to contain the target and crop to it. That
 * breaks for anything deep in the book: §501 sits ~35,000px down and Chrome cannot rasterize a
 * canvas that tall, so the screenshot came back empty and `convert` failed with "no images
 * defined". Isolating instead keeps every ancestor (so all CSS still applies) and drops every
 * sibling, leaving a short page that needs no crop at all — and it is far faster.
 *
 *   node scripts/look-isolate.js <src.html> <dest.html> <selector> [scrawl-numbers]
 */
const fs = require('fs');
const [src, dest, sel, nums] = process.argv.slice(2);
if (!src || !dest || !sel) { console.error('usage: look-isolate.js <src> <dest> <selector> [nums]'); process.exit(2); }

const numsJs = nums ? `
  document.querySelectorAll('.scrawl').forEach(function(e){
    var out=[]; for (var ch of e.textContent){ var c=ch.codePointAt(0);
      out.push(c>=0x2840&&c<=0x287f ? String(c-0x2840) : c>=0x2880&&c<=0x28ff ? '~' : ch); }
    e.textContent=out.join('\\u00b7');
    e.style.cssText='font-family:monospace;font-size:.8em;letter-spacing:0;color:#ffd479;'
      +'border-bottom:1px solid #6f5a2a;padding:0 2px';
  });` : '';

const inject = `<script>window.addEventListener('load',function(){setTimeout(function(){
  var t=document.querySelector(${JSON.stringify(sel)});
  if(!t){document.title='LOOK none';return;}
  ${numsJs}
  for (var n=t; n && n!==document.body && n.parentNode; n=n.parentNode) {   // stop AT body: walking past it strips <head> and the stylesheet with it
    var p=n.parentNode;
    Array.prototype.slice.call(p.children).forEach(function(c){
      // NEVER drop style/link/script: this page carries its <style> INSIDE <body> (Jekyll puts
      // page content there), so removing siblings blindly strips the whole stylesheet.
      if (c!==n && !/^(STYLE|LINK|SCRIPT)$/.test(c.tagName)) p.removeChild(c); });
  }
  document.body.style.cssText+=';padding:14px 0;margin:0';
  var r=t.getBoundingClientRect();
  document.title='LOOK '+Math.round(r.height)+' '+document.documentElement.clientWidth;
},900);});</script></body>`;

const html = fs.readFileSync(src, 'utf8');
if (!html.includes('</body>')) { console.error(`${src} has no </body>`); process.exit(1); }
fs.writeFileSync(dest, html.replace('</body>', inject));
