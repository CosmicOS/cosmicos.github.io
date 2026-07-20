#!/usr/bin/env node
/* tics.js — inventory the systemic prose patterns the re-review flagged, per entry, so the
 * "ration the swell / kill the tic / scrub the foreshadow" sweep is a concrete worklist with a
 * budget, not a vibe. Run before and after the sweep; counts must fall to budget. */
'use strict';
const fs=require('fs'),path=require('path');
const dir=path.resolve(__dirname,'..','_includes/listener');
const ORDER=['founder','terse','wondering','wary','maker','doubter','plainer','cold','listener','builder','final'];
const P={
  foreshadow:/\bthe someone\b|\ba someone\b|is coming\b|meant to (live|walk|rise|be made|be spoken|hold)|waiting, on|the one (who walks|at the (end|far))|someone is expected|what (the|it) .{0,25}(is for|was for)\b/gi,
  mortality:/\bbones now\b|\bis gone\b|will not (see|live to see)|across our deaths|dying hand|hand to (failing|dying) hand|the watch .{0,12}(gone )?(cold|dark)|\bdust\b|set down (her|his) pen|laid down (her|his) pen/gi,
  plain:/\bplain(ly|er|est|ness)?\b/gi,
  cold:/\bcold(er|ed)?\b|\bcooled\b/gi,
  lamp:/until the lamp (died|burned)|past my hour|sat (with|a long) .{0,30}(long|hour|lamp)|kept me from sleep/gi,
};
function sentences(t){return t.split(/(?<=[.!?])\s+/).filter(Boolean);}
function isSwellCloser(last){ // "not X. Y." antithesis OR lands on an abstract Big-Noun
  if(/\b(not|never)\b[^.]{2,60}\.\s*[A-Z][^.]{2,60}\.?$/.test(last)) return 'not-X-but-Y';
  if(/\b(It is|It was|That is|This is|And that is|What .{0,20} is) [^.]{0,40}\b(not|never)\b/.test(last)) return 'antithesis';
  if(/\b(a |the |an )?(mind|self|someone|keeper|companion|dwelling|doer|maker|life|world|road|difference|point|tool|beginning|floor|now|verb)\.?$/i.test(last.trim())) return 'big-noun';
  return null;
}
let tot={foreshadow:0,mortality:0,plain:0,cold:0,lamp:0,swell:0,eulogy:0};
for(const f of ORDER){
  const h=fs.readFileSync(path.join(dir,f+'.html'),'utf8');
  const re=/<div class="entry" id="p(\d+)"[^>]*>/g;let m;
  while((m=re.exec(h))){const p=+m[1],start=m.index+m[0].length;const tag=/<div\b[^>]*>|<\/div>/g;tag.lastIndex=start;let d=1,t;while(d>0&&(t=tag.exec(h)))d+=t[0]==='</div>'?-1:1;
    const body=h.slice(start,tag.lastIndex-6);
    const prose=(body.match(/<p[^>]*>[\s\S]*?<\/p>/g)||[]).map(x=>x.replace(/<[^>]+>/g,'')).join('\n');
    if(!prose.trim())continue;
    const c={};for(const k in P)c[k]=(prose.match(P[k])||[]).length;
    const ps=prose.split('\n').filter(Boolean);
    const swell=ps.length?isSwellCloser(sentences(ps[ps.length-1]).slice(-1)[0]||''):null;
    const eul=ps.length?/(is gone|bones now|is dead|set down (her|his) pen|laid down (her|his) pen)/.test(sentences(ps[0])[0]||''):false;
    for(const k in c)tot[k]+=c[k]; if(swell)tot.swell++; if(eul)tot.eulogy++;
    const flags=[]; if(swell)flags.push('SWELL:'+swell); if(eul)flags.push('EULOGY'); if(c.foreshadow)flags.push('fore:'+c.foreshadow); if(c.mortality)flags.push('mort:'+c.mortality); if(c.lamp)flags.push('lamp:'+c.lamp); if(c.plain>2)flags.push('plain:'+c.plain); if(c.cold>1)flags.push('cold:'+c.cold);
    if(flags.length)console.log('§'+p+' ('+f+')  '+flags.join('  '));
  }
}
console.log('\nTOTALS:',JSON.stringify(tot));
