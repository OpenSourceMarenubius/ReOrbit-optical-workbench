const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const G=require('../glasses.js'),data=require('../glass-data.js'),O=require('../engine.js'),Z=require('../zemax.js');
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const lens=glass=>({wavelength:587.6,pupil:12,field:0,imageDistance:48,surfaces:[{radius:52,thickness:5,material:glass,diameter:25},{radius:-52,thickness:0,material:'AIR',diameter:25}]});
test('catalogue preserves provenance, exact names and explicit unsupported formula entries',()=>{
  assert.equal(data.recordCount,366);assert.equal(G.list.length,366);assert.equal(new Set(G.list.map(g=>g.name.toUpperCase())).size,G.list.length);
  assert.equal(data.glasses.length+data.excluded.length,data.recordCount);assert.deepEqual(data.excluded,[{name:'B270',reason:'Unsupported AGF dispersion formula 1'}]);
  const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(__dirname+'/../'+file)).digest('hex');
  assert.equal(hash('vendor/schott-zemax.zip'),data.archiveSha256);assert.equal(hash('vendor/schott-june-2025.agf'),data.agfSha256);
  assert.equal(G.get('bk7').name,'BK7');assert.equal(G.get(' n-bk7 ').name,'N-BK7');assert.notEqual(G.get('BK7'),G.get('N-BK7'));
});
test('all supported dispersion curves agree with independently tabulated catalogue nd',()=>{
  for(const g of data.glasses){
    const n=G.index(g.name,587.5618);near(n,g.nd,3e-5);
    assert.ok(g.rangeNm[0]>0&&g.rangeNm[1]>g.rangeNm[0]);assert.equal(g.B.length,3);assert.equal(g.C.length,3);
  }
});
test('catalogue Abbe values agree with dispersion at the d/F/C spectral lines',()=>{
  for(const g of data.glasses){const n=G.index(g.name,587.5618),f=G.index(g.name,486.1327),c=G.index(g.name,656.2725);near((n-1)/(f-c),g.vd,.08);}
});
test('known crown and flint indices at visible and near-IR wavelengths match published values',()=>{
  near(G.index('N-SF11',587.6),1.78472,1e-5);near(G.index('N-SF11',1529.6),1.74377,1e-5);near(G.index('N-BAF10',587.6),1.67003,1e-5);near(G.index('N-F2',587.6),1.62005,1e-5);near(G.index('SF2',587.6),1.64769,1e-5);near(G.index('N-BK7',587.6),1.5168,1e-5);
  assert.equal(G.index('AIR',1550),1);
});
test('search matches case, partial names, punctuation and manufacturer/description tokens',()=>{
  assert.ok(G.search('sf11').some(g=>g.name==='N-SF11'));assert.equal(G.search('n-bk7')[0].name,'N-BK7');assert.ok(G.search('n bk7').some(g=>g.name==='N-BK7'));assert.ok(G.search('SCHOTT SF2').some(g=>g.name==='SF2'));assert.ok(G.search('radiation resistant').length>0);assert.deepEqual(G.search('no-such-glass-xyz'),[]);
});
test('unsupported names, wavelengths and data-range extrapolation are blocked',()=>{
  assert.throws(()=>G.index('B270',587.6),/Unsupported/);assert.throws(()=>G.index('NOT-IN-CATALOG',587.6),/substitution/);assert.throws(()=>G.index('N-BK7',NaN));assert.throws(()=>G.index('N-BK7',1701));
  const limited=G.list.find(g=>g.name!=='AIR'&&g.rangeNm[0]>380);assert.ok(limited);assert.throws(()=>G.index(limited.name,380),/only valid/);
});
test('glass choice changes focal power and retains the previous N-BK7 trace',()=>{
  const a=lens('N-BK7'),b=lens('N-SF11');O.validate(a);O.validate(b);assert.ok(O.paraxial(b)<O.paraxial(a));assert.notEqual(O.bundle(a).rms,O.bundle(b).rms);
  const n=1.5167984379050088;near(O.index('N-BK7',587.6),n,1e-12);
});
test('ZMX imports exact catalogue glass names including legacy records without substitution',()=>{
  const sample=fs.readFileSync(__dirname+'/fixtures/demo-singlet.zmx','utf8');
  for(const name of ['N-SF11','N-BAF10','N-F2','F2','SF2','BK7']){const r=Z.parse(sample.replace('GLAS N-BK7','GLAS '+name));assert.equal(r.canImport,true,r.errors.join('\n'));assert.equal(r.surfaces[0].material,name);}
});
test('catalogue selections survive project JSON and use full dispersion after reopening',()=>{
  const p=lens('N-SF11'),q=JSON.parse(JSON.stringify(p));assert.deepEqual(O.bundle(p),O.bundle(q));q.wavelength=1550;assert.notEqual(O.index(q.surfaces[0].material,1550),O.index(q.surfaces[0].material,587.6));
});
