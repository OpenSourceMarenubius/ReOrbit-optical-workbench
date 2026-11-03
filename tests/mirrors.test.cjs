const {test}=require('node:test'),assert=require('node:assert/strict'),O=require('../engine.js'),Z=require('../zemax.js');
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const p=surfaces=>({wavelength:1550,pupil:8,field:0,imageDistance:50,surfaces});
const fold=(tilt=45,thickness=0)=>({type:'prism',radius:0,tilt,thickness,diameter:20,material:'AIR',interaction:'reflect'});
test('reflection reverses the normal component and preserves tangential direction',()=>{
  const d=[Math.cos(.3),Math.sin(.3),0],r=O.reflect(d,[-1,0,0]);near(r[0],-d[0]);near(r[1],d[1]);near(Math.hypot(...r),1);
});
test('45-degree plane mirror folds both ray direction and image plane by 90 degrees',()=>{
  const q=p([fold()]),ray=O.trace(q,0,0);O.validate(q);assert.equal(ray.status,'ok');near(ray.direction[0],0);near(ray.direction[1],1);near(ray.image[0],0);near(ray.image[1],50);near(ray.imageLocal[0],50);assert.equal(O.paraxial(q),null);
});
test('two folding mirrors carry later surfaces in their reflected local frames',()=>{
  const q=p([fold(45,40),fold(-45)]),surfaces=O.geometry(q),ray=O.trace(q,0,0);O.validate(q);
  near(surfaces[1].frame.origin[0],0);near(surfaces[1].frame.origin[1],40);near(ray.direction[0],1);near(ray.direction[1],0);near(ray.image[0],50);near(ray.image[1],40);
});
test('concave spherical mirror paraxial EFL is half the absolute radius',()=>{
  const q=p([{radius:-100,thickness:0,diameter:10,material:'AIR',interaction:'reflect'}]);O.validate(q);near(O.paraxial(q),50,1e-5);assert.ok(O.bestFocus(q)>49&&O.bestFocus(q)<51);
});
test('a paraboloidal mirror focuses a parallel axial beam at R/2',()=>{
  const q=p([{type:'asphere',radius:-100,conic:-1,coefficients:[],thickness:0,diameter:10,material:'AIR',interaction:'reflect'}]);O.validate(q);near(O.bestFocus(q),50,1e-6);assert.ok(O.bundle(q).rms<1e-7);
});
test('a plane fold relocates best focus without changing its optical path or RMS minimum',()=>{
  const lens=[{radius:30,thickness:8,material:'N-BK7',diameter:20},{radius:0,thickness:0,material:'AIR',diameter:20}],q=p(lens);q.pupil=6;
  const original=O.bestFocus(q);const folded=p([{...lens[0]},{...lens[1],thickness:20},fold()]);folded.pupil=6;
  near(O.bestFocus(folded),original-20,1e-5);near(O.paraxial(folded),O.paraxial(q),1e-5);
});
test('spot statistics use the rotated image plane, not fixed world transverse axes',()=>{
  const q=p([fold()]);q.emission={mode:'point',distance:100,halfAngle:2};const b=O.bundle(q);assert.ok(b.rms>1);for(const r of b.valid)near(r.image[1],50);assert.ok(b.valid.some(r=>Math.abs(r.imageLocal[1])>1));
});
test('ideal reflection is wavelength independent and round-trips in project JSON',()=>{
  const q=p([fold()]),blue=O.bundle({...q,wavelength:486.1}),ir=O.bundle(q);assert.deepEqual(blue,ir);assert.deepEqual(O.bundle(JSON.parse(JSON.stringify(q))),ir);
});
test('mirror action cannot silently introduce a refractive-index jump',()=>{
  assert.throws(()=>O.validate(p([{...fold(),material:'N-BK7'}])),/incoming medium/);assert.throws(()=>O.validate(p([{...fold(),interaction:'split'}])),/reflection/);
});
const zmx=(middle)=>`MODE SEQ\nUNIT MM\nSURF 0\nTYPE STANDARD\nCURV 0\nDISZ INFINITY\n${middle}\nSURF 9\nTYPE STANDARD\nCURV 0\nDISZ 0\nDIAM 1`;
test('single-mirror ZMX files insert an ideal reflector and retain its radius',()=>{
  const r=Z.parse(zmx('SURF 1\nTYPE STANDARD\nCURV -0.01\nDISZ -50\nDIAM 5\nGLAS MIRROR').replace('SURF 9','SURF 2'));assert.equal(r.canImport,true,r.errors.join('\n'));assert.equal(r.surfaces.length,1);assert.equal(r.surfaces[0].radius,-100);assert.equal(r.surfaces[0].interaction,'reflect');assert.equal(r.surfaces[0].material,'AIR');
});
test('ZMX mirror parity converts later radii and negative real-path spacings',()=>{
  const middle='SURF 1\nTYPE STANDARD\nCURV -0.01\nDISZ -40\nDIAM 5\nGLAS MIRROR\nSURF 2\nTYPE STANDARD\nCURV 0.02\nDISZ -5\nDIAM 5\nGLAS N-BK7\nSURF 3\nTYPE STANDARD\nCURV -0.02\nDISZ -50\nDIAM 5';
  const text=zmx(middle).replace('SURF 9','SURF 4'),r=Z.parse(text);assert.equal(r.canImport,true,r.errors.join('\n'));assert.equal(r.surfaces[0].thickness,40);assert.equal(r.surfaces[1].radius,-50);assert.equal(r.surfaces[2].radius,50);assert.equal(r.surfaces[1].thickness,5);
  assert.equal(Z.parse(text.replace('DISZ -40','DISZ 40')).canImport,false);
});
test('beam diagnostics distinguish geometric angular spread from sample survival',()=>{
  const q=p([fold()]),d=O.beamDiagnostics(q);assert.equal(d.raysReachingImage,401);near(d.outgoingAngularRmsMrad,0);assert.equal(d.geometricSurvivalFraction,1);
  q.emission={mode:'point',distance:100,halfAngle:2};assert.ok(O.beamDiagnostics(q).outgoingAngularRmsMrad>10);
});
