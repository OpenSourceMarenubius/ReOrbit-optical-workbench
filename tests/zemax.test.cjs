const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Z=require('../zemax.js'),O=require('../engine.js');
const text=fs.readFileSync(__dirname+'/fixtures/demo-singlet.zmx','utf8').replace(/\r\n?/g,'\n');
const parse=s=>Z.parse(s,'demo-singlet.zmx');
const project=()=>({name:'Existing design',wavelength:1550,pupil:10,field:1,imageDistance:77,emission:{mode:'point',distance:120,halfAngle:4},surfaces:[{radius:52,thickness:5,material:'N-BK7',diameter:25},{radius:-52,thickness:0,material:'AIR',diameter:25}]});
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('reads a full sequential singlet and drops only object/image external spacing',()=>{
  const r=parse(text);assert.deepEqual(r.errors,[]);assert.equal(r.canImport,true);assert.equal(r.surfaces.length,2);
  near(r.surfaces[0].radius,52);near(r.surfaces[1].radius,-52);assert.equal(r.surfaces[0].thickness,5);assert.equal(r.surfaces[1].thickness,0);assert.equal(r.surfaces[0].diameter,25);assert.equal(r.surfaces[0].material,'N-BK7');assert.equal(r.surfaces[1].material,'AIR');assert.equal(r.surfaces[0].supplier.comment,'Front surface');
  assert.ok(r.warnings.some(w=>w.includes('Coatings')));assert.ok(r.warnings.some(w=>w.includes('STOP')));
});
test('converts all physical lengths for centimetres and inches, including reciprocal curvature',()=>{
  for(const [unit,scale] of [['CM',10],['IN',25.4]]){
    const r=parse(text.replace('UNIT MM','UNIT '+unit).replaceAll('DIAM 12.5','DIAM 1.25'));assert.equal(r.canImport,true);near(r.surfaces[0].radius,52*scale);near(r.surfaces[0].thickness,5*scale);near(r.surfaces[0].diameter,2.5*scale);
  }
});
test('zero curvature is a plane, D scientific exponents are accepted',()=>{
  const r=parse(text.replace('CURV -1.9230769230769232E-2','CURV 0').replace('DISZ 5\n','DISZ 5D0\n'));assert.equal(r.canImport,true);assert.equal(r.surfaces[1].radius,0);assert.equal(r.surfaces[0].thickness,5);
});
test('virtual/infinite external image distances are omitted while physical lens spacings stay finite',()=>{
  for(const distance of ['-48','INFINITY','-INFINITY']){const r=parse(text.replace('  DISZ 48','  DISZ '+distance));assert.equal(r.canImport,true);assert.equal(r.surfaces[1].thickness,0);}
  assert.equal(parse(text.replace('  DISZ 5','  DISZ INFINITY')).canImport,false);
});
test('decodes UTF-8 and UTF-16 in both byte orders, with and without BOM',()=>{
  const utf8=new TextEncoder().encode(text),le=Buffer.from(text,'utf16le'),be=Buffer.from(le);be.swap16();
  for(const bytes of [utf8,le,be,Buffer.concat([Buffer.from([255,254]),le]),Buffer.concat([Buffer.from([254,255]),be])])assert.equal(parse(Z.decode(bytes).text).canImport,true);
});
test('rejects binary/oversized data and malformed required numbers',()=>{
  assert.throws(()=>Z.decode(Uint8Array.from([80,75,3,4])));assert.throws(()=>Z.decode(new Uint8Array(1000001)));
  for(const replacement of ['abc','NaN','1foo','1e999'])assert.equal(parse(text.replace('DISZ 5\n','DISZ '+replacement+'\n')).canImport,false);
});
test('blocks unsupported glass without substituting N-BK7',()=>{
  for(const glass of ['MYSTERY-GLASS','NOT-IN-CATALOG','___BLANK']){const r=parse(text.replace('GLAS N-BK7','GLAS '+glass));assert.equal(r.canImport,false);assert.ok(r.errors.some(e=>e.includes(glass)));}
});
test('blocks unsupported surface types, mirrors, coordinate breaks, solves and unknown optical records',()=>{
  for(const record of ['TYPE COORDBRK','TYPE PARAXIAL','TYPE FRESNELL','PARM 1 1e-5','MIRR 1','PKUP 1 2 3','CLAP 1 2 3','MYSTERY 2']){const r=parse(text.replace('  STOP','  '+record));assert.equal(r.canImport,false,record);}
});
test('blocks ambiguous units, surface numbers, missing apertures, bad boundaries and configurations',()=>{
  for(const modified of [text.replace('UNIT MM X W X CM MR CPMM',''),text.replace('UNIT MM','UNIT FURLONG'),text.replace('SURF 2','SURF 7'),text.replace('MNUM 1','MNUM 2'),text.replace('MODE SEQ','MODE NSC'),text.replace('  DIAM 12.5 1 0 0 1 ""',''),text.replace('SURF 0\n  TYPE STANDARD\n  CURV 0','SURF 0\n  TYPE STANDARD\n  CURV 1'),text.replace('  DISZ 5','  DISZ -5')])assert.equal(parse(modified).canImport,false);
});
test('blocks noncircular and offset apertures and non-default ignore flags',()=>{
  for(const modified of [text.replace('DIAM 12.5 1','DIAM 12.5 4'),text.replace('DIAM 12.5 1 0 0','DIAM 12.5 1 1 0'),text.replace('  STOP','  OBDC 0 1'),text.replace('  STOP','  HIDE 1 0')])assert.equal(parse(modified).canImport,false);
});
test('appends supplier assembly atomically and preserves source, wavelength and image distance',()=>{
  const p=project(),before=JSON.stringify(p),next=Z.insert(p,parse(text),2,12,17);
  assert.equal(JSON.stringify(p),before);assert.equal(next.surfaces.length,4);assert.equal(next.surfaces[1].thickness,12);assert.equal(next.surfaces[2].thickness,5);assert.equal(next.surfaces[3].thickness,0);assert.equal(next.wavelength,1550);assert.equal(next.imageDistance,77);assert.deepEqual(next.emission,p.emission);O.validate(next);
});
test('prepends and inserts into an interior AIR gap with explicit replacement gaps',()=>{
  const p=project(),r=parse(text),front=Z.insert(p,r,0,NaN,15);assert.equal(front.surfaces[1].thickness,15);assert.equal(front.surfaces[2].radius,52);
  const long=Z.insert(p,r,2,30,10),middle=Z.insert(long,r,2,10,20);assert.equal(middle.surfaces.length,6);assert.equal(middle.surfaces[1].thickness,10);assert.equal(middle.surfaces[3].thickness,20);assert.equal(middle.surfaces[4].radius,52);
});
test('invalid insertions leave the original untouched, including inside glass and crossing geometry',()=>{
  const p=project(),r=parse(text),before=JSON.stringify(p);
  for(const run of [()=>Z.insert(p,r,1),()=>Z.insert(p,r,2,0),()=>Z.insert(p,r,-1),()=>Z.insert(p,{...r,canImport:false},2)])assert.throws(run);
  const negativeExit=project();negativeExit.surfaces=[{radius:-52,thickness:5,material:'N-BK7',diameter:25},{radius:52,thickness:0,material:'AIR',diameter:25}];
  assert.throws(()=>Z.insert(negativeExit,{...r,surfaces:[{...r.surfaces[0],radius:-52},r.surfaces[1]]},2,.01),/cross/);
  assert.equal(JSON.stringify(p),before);
});
test('surface capacity is enforced and imported provenance round-trips in project JSON',()=>{
  const p=project(),r=parse(text);while(p.surfaces.length<24)p.surfaces.push(...structuredClone(project().surfaces));p.surfaces.forEach((s,i)=>{if(i<p.surfaces.length-1&&s.thickness===0)s.thickness=20;});assert.throws(()=>Z.insert(p,r,24),/24/);
  const next=Z.insert(project(),r,2),loaded=JSON.parse(JSON.stringify(next));O.validate(loaded);assert.deepEqual(loaded,next);
});

test('text import accepts both Unix and Windows line endings',()=>{
  for(const input of [text,text.replace(/\n/g,'\r\n')]){const result=parse(input);assert.equal(result.canImport,true);assert.equal(result.surfaces.length,2);}
});
