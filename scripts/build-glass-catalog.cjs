// Offline extraction of SCHOTT's public AGF numerical material data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'vendor/schott-june-2025.agf'),'utf8');
const records=[];let current=null;
for(const line of source.split(/\r?\n/)){
  const tokens=line.trim().split(/\s+/),key=tokens.shift();
  if(key==='NM'){current={name:tokens[0],formula:Number(tokens[1]),nd:Number(tokens[3]),vd:Number(tokens[4]),manufacturer:'SCHOTT',description:''};records.push(current);}
  else if(current&&key==='GC')current.description=tokens.join(' ').trim();
  else if(current&&key==='CD')current.cd=tokens.map(Number);
  else if(current&&key==='LD')current.range=tokens.map(Number);
}
const supported=[],excluded=[];
for(const r of records){
  if(r.formula!==2){excluded.push({name:r.name,reason:'Unsupported AGF dispersion formula '+r.formula});continue;}
  if(!r.cd||r.cd.length<6||!r.cd.every(Number.isFinite)||r.cd.slice(6).some(v=>v!==0)||!r.range||r.range.length!==2||!r.range.every(Number.isFinite)||r.range[0]<=0||r.range[1]<=r.range[0]||!Number.isFinite(r.nd)||!Number.isFinite(r.vd))throw new Error('Invalid catalogue record '+r.name);
  if(supported.some(s=>s.name===r.name))throw new Error('Duplicate catalogue name '+r.name);
  supported.push({name:r.name,manufacturer:r.manufacturer,description:r.description,nd:r.nd,vd:r.vd,B:[r.cd[0],r.cd[2],r.cd[4]],C:[r.cd[1],r.cd[3],r.cd[5]],rangeNm:r.range.map(v=>v*1000)});
}
supported.sort((a,b)=>a.name.localeCompare(b.name));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const data={edition:'SCHOTT June 2025',source:'https://media.schott.com/api/public/content/a79c07aa61da4c05a2c0bbab93d09a7f?download=true&v=3b65e351',retrieved:'2026-11-02',archiveSha256:hash('vendor/schott-zemax.zip'),agfSha256:hash('vendor/schott-june-2025.agf'),recordCount:records.length,excluded,glasses:supported};
fs.writeFileSync(path.join(root,'glass-data.js'),'/* Generated from public SCHOTT AGF numerical data; see vendor/README.md. */\n(function(root){const data='+JSON.stringify(data,null,2)+';if(typeof module==="object"&&module.exports)module.exports=data;else root.GlassData=data;})(typeof globalThis!=="undefined"?globalThis:this);\n');
console.log(JSON.stringify({records:records.length,supported:supported.length,excluded}));
