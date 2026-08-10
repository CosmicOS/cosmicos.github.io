#!/usr/bin/env node
// Gate: American English only, in prose AND in plans/ docs.
// Added 2026-07-30 after repeated slips. "Be careful" is not a control; this is.
const fs=require('fs'),path=require('path');
const BR=['behaviour','behaviours','labour','colour','colours','honour','honours','neighbour','neighbours',
 'favour','favours','flavour','centre','centres','metre','metres','theatre','realise','realised','realising',
 'recognise','recognised','recognising','organise','organised','apologise','summarise','generalise',
 'generalises','generalised','defence','offence','practise','licence','grey','sceptic','sceptical',
 'travelling','travelled','marvelled','signalled','modelling','modelled','cancelled','fuelled','whilst','amongst'];
const files=[];
const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
  if(e.name==='archive'||e.name==='node_modules'||e.name==='_site'||e.name.startsWith('.'))continue;
  const p=path.join(d,e.name);
  if(e.isDirectory())walk(p); else if(/\.(md|html)$/.test(e.name))files.push(p);}};
['plans','_includes/listener'].forEach(d=>{if(fs.existsSync(d))walk(d)});
if(fs.existsSync('index.html'))files.push('index.html');
let bad=0;
const re=new RegExp('\\b('+BR.join('|')+')\\b','gi');
for(const f of files){
  const s=fs.readFileSync(f,'utf8').split('\n');
  s.forEach((line,i)=>{let m;re.lastIndex=0;
    // Markdown blockquote = somebody else's words, verbatim. VOICE_RESEARCH.md is full of them, and
    // correcting another writer's spelling would falsify the sample. Only quoted lines are exempt.
    if(/^\s*>/.test(line))return;
    while((m=re.exec(line))){bad++;console.log(`    ${f}:${i+1}  "${m[0]}"`);}});
}
if(bad){console.log(`✗ ${bad} British spelling(s) — American English only`);process.exit(1);}
console.log('✓ American English (prose and plans/)');
