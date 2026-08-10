#!/usr/bin/env node
// Gate: American English only — in the prose, in plans/, AND in the code I write comments in.
// Added 2026-07-30 after repeated slips. "Be careful" is not a control; this is.
//
// THE CODE WAS NOT COVERED AND HAD DRIFTED (08-10). This walked .md and .html only, on the reasoning
// that the gate is about the book. But most of what gets written here is comment prose — "colour",
// "centring", "labelled" and "grey" had all settled into css/main.css, js/listener.js and half the
// scripts, unseen, because the one thing checking spelling could not see them. The story's rule and
// the repo's rule are the same rule; the gate now covers both.
// VENDORED FILES ARE NOT MINE TO CORRECT: cosmicos.js and lib_cosmicos.js are compiled output and
// jqconsole.js is somebody else's library, so they are skipped by name rather than by folder.
const fs=require('fs'),path=require('path');
const BR=['behaviour','behaviours','labour','colour','colours','honour','honours','neighbour','neighbours',
 'favour','favours','flavour','centre','centres','metre','metres','theatre','realise','realised','realising',
 'recognise','recognised','recognising','organise','organised','apologise','summarise','generalise',
 'generalises','generalised','defence','offence','practise','licence','grey','sceptic','sceptical',
 'travelling','travelled','marvelled','signalled','modelling','modelled','cancelled','fuelled','whilst','amongst',
 // added 08-10 when the gate first looked at the code it had never covered
 'centred','centring','labelled','labelling','levelled','behavioural','colourful','greyish','spelt','learnt'];
const files=[];
const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
  if(e.name==='archive'||e.name==='node_modules'||e.name==='_site'||e.name.startsWith('.'))continue;
  const p=path.join(d,e.name);
  if(e.isDirectory())walk(p); else if(/\.(md|html)$/.test(e.name))files.push(p);}};
['plans','_includes/listener'].forEach(d=>{if(fs.existsSync(d))walk(d)});
if(fs.existsSync('index.html'))files.push('index.html');

const VENDORED=new Set(['cosmicos.js','lib_cosmicos.js','jqconsole.js','site.js']);
const walkCode=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
  if(e.name==='node_modules'||e.name.startsWith('.'))continue;
  const p=path.join(d,e.name);
  if(e.isDirectory())walkCode(p);
  else if(/\.(js|css|sh|py)$/.test(e.name)&&!VENDORED.has(e.name))files.push(p);}};
['js','css','scripts','tests'].forEach(d=>{if(fs.existsSync(d))walkCode(d)});
let bad=0;
const re=new RegExp('\\b('+BR.join('|')+')\\b','gi');
for(const f of files){
  const s=fs.readFileSync(f,'utf8').split('\n');
  s.forEach((line,i)=>{let m;re.lastIndex=0;
    // Markdown blockquote = somebody else's words, verbatim. VOICE_RESEARCH.md is full of them, and
    // correcting another writer's spelling would falsify the sample. Only quoted lines are exempt.
    if(/^\s*>/.test(line))return;
    // this file lists the words it is looking for; it cannot be its own violation
    if(f.endsWith('check-american.js'))return;
    while((m=re.exec(line))){bad++;console.log(`    ${f}:${i+1}  "${m[0]}"`);}});
}
if(bad){console.log(`✗ ${bad} British spelling(s) — American English only`);process.exit(1);}
console.log(`✓ American English (${files.length} files: prose, plans/ and the code)`);
