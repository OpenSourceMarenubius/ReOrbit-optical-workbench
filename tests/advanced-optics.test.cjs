const {test}=require('node:test');
const assert=require('node:assert/strict');
const O=require('../engine.js'),Z=require('../zemax.js'),fs=require('node:fs');
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const singlet=()=>({wavelength:587.6,pupil:12,field:0,imageDistance:55,surfaces:[{radius:30,thickness:8,material:'N-BK7',diameter:20},{radius:0,thickness:0,material:'AIR',diameter:20}]});
const wedge=()=>({...singlet(),surfaces:[{type:'prism',radius:0,tilt:-10,thickness:8,material:'N-BK7',diameter:20},{type:'prism',radius:0,tilt:10,thickness:0,material:'AIR',diameter:20}]});
const sample=fs.readFileSync(__dirname+'/fixtures/demo-singlet.zmx','utf8');
const asphericText=sample.replace('  TYPE STANDARD\n  COMM "Front surface"','  TYPE EVENASPH\n  COMM "Front surface"').replace('  CONI 0','  CONI -1\n  PARM 1 1e-4\n  PARM 2 2e-7\n  PARM 8 1e-22');
test('paraboloid and polynomial sag and slope agree with independent formulas',()=>{
  const s={type:'asphere',radius:30,conic:-1,coefficients:[.001,2e-5],diameter:20};
  for(const r of [0,1,5,10]){near(O.surfaceSag(s,r),r*r/60+.001*r*r+2e-5*r**4);near(O.radialSlope(s,r),r/30+.002*r+8e-5*r**3);}
});
test('analytic surface gradient matches numerical sag derivatives',()=>{
  const s={type:'asphere',radius:30,conic:-.6,coefficients:[0,1e-5,-1e-9],diameter:20,z:0},x=3,y=4,h=1e-4,n=O.normalAt(s,[O.surfaceSag(s,x,y),x,y]);
  near(n[1],(O.surfaceSag(s,x+h,y)-O.surfaceSag(s,x-h,y))/(2*h));near(n[2],(O.surfaceSag(s,x,y+h)-O.surfaceSag(s,x,y-h))/(2*h));
});
test('asphere root solver intersects known axial and oblique paraboloid points',()=>{
  const s={type:'asphere',radius:30,conic:-1,coefficients:[],diameter:20,z:3};
  for(const x of [-10,-5,0,5,10])near(O.intersect([-20,x,0],[1,0,0],s)[0],3+x*x/60);
  // Choose a known surface point and launch directly toward it from an arbitrary origin.
  const target=[3+25/60,5,0],origin=[-20,1,0],v=target.map((t,i)=>t-origin[i]),d=v.map(t=>t/Math.hypot(...v)),hit=O.intersect(origin,d,s);
  hit.forEach((t,i)=>near(t,target[i]));
});
test('zero-coefficient, zero-conic asphere reproduces the spherical ray trace',()=>{
  const p=singlet(),a=O.bundle(p);p.surfaces[0]={...p.surfaces[0],type:'asphere',conic:0,coefficients:Array(8).fill(0)};
  const b=O.bundle(p);assert.equal(a.valid.length,b.valid.length);near(a.rms,b.rms,1e-8);
  for(let i=0;i<a.valid.length;i++)for(let j=0;j<3;j++)near(a.valid[i].image[j],b.valid[i].image[j],1e-8);
});
test('aspheric lenses focus with finite geometry and change ray aberrations',()=>{
  const p=singlet(),sphere=O.bundle(p).rms;p.surfaces[0]={...p.surfaces[0],type:'asphere',conic:-1,coefficients:[0,1e-6]};
  O.validate(p);assert.ok(Math.abs(O.bundle(p).rms-sphere)>1e-5);p.imageDistance=O.bestFocus(p);const best=O.bundle(p).rms;
  assert.ok(Number.isFinite(best));assert.ok(O.bundle({...p,imageDistance:p.imageDistance+.1}).rms>best);
});
test('asphere cone aiming still covers both first-lens edges evenly',()=>{
  const p=singlet();p.surfaces[0]={...p.surfaces[0],type:'asphere',conic:-1,coefficients:[0,1e-6]};p.emission={mode:'point',distance:100,halfAngle:4};
  const filled=O.fillFirstLens(p),rays=O.meridionalRays(filled);for(let i=0;i<11;i++)near(rays[i].points[1][1],-10+2*i);
});
test('prism deviation agrees with two independent scalar Snell-law steps',()=>{
  const p=wedge(),n=O.index('N-BK7',p.wavelength),ray=O.trace(p,0,0),rad=Math.PI/180;
  O.validate(p);assert.equal(ray.status,'ok');
  const inside=10*rad+Math.asin(Math.sin(-10*rad)/n),expected=-10*rad+Math.asin(n*Math.sin(inside+10*rad));
  near(Math.atan2(ray.direction[1],ray.direction[0]),expected);assert.ok(expected>0);assert.equal(O.paraxial(p),null);
});
test('parallel tilted plates exit parallel and wavelength changes prism deviation',()=>{
  const p=wedge();p.surfaces[1].tilt=-10;const ray=O.trace(p,0,0);near(ray.direction[1],0);near(ray.direction[0],1);
  p.surfaces[1].tilt=10;const blue=O.trace({...p,wavelength:486.1},0,0),red=O.trace({...p,wavelength:1550},0,0);assert.ok(blue.direction[1]>red.direction[1]);
});
test('prism total internal reflection terminates the ray and is reported',()=>{
  const p=wedge();p.surfaces[0].tilt=0;p.surfaces[1].tilt=50;p.surfaces[0].thickness=30;
  O.validate(p);assert.equal(O.trace(p,0,0).status,'TIR');
});
test('crossing faces, invalid conic domains and unsupported hidden parameters are rejected',()=>{
  const p=wedge();p.surfaces[0].thickness=1;assert.throws(()=>O.validate(p),/cross/);
  for(const shape of [{type:'asphere',radius:2,conic:0},{type:'asphere',conic:NaN},{type:'asphere',coefficients:[NaN]},{type:'standard',conic:-1},{type:'prism',radius:30},{type:'asphere',tilt:10}]){const q=singlet();Object.assign(q.surfaces[0],shape);assert.throws(()=>O.validate(q));}
});
test('STANDARD conics and EVENASPH coefficients import without approximation',()=>{
  const r=Z.parse(asphericText);assert.equal(r.canImport,true,r.errors.join('\n'));const s=r.surfaces[0];assert.equal(s.type,'asphere');assert.equal(s.conic,-1);near(s.coefficients[0],1e-4,1e-15);near(s.coefficients[1],2e-7,1e-15);assert.equal(s.coefficients[7],1e-22);
  const conic=Z.parse(sample.replace('CONI 0','CONI -1'));assert.equal(conic.canImport,true);assert.equal(conic.surfaces[0].type,'asphere');
});
test('ZMX asphere coefficients scale by their own inverse length powers',()=>{
  const r=Z.parse(asphericText.replace('UNIT MM','UNIT CM'));assert.equal(r.canImport,true,r.errors.join('\n'));const s=r.surfaces[0];near(s.radius,520);near(s.coefficients[0],1e-5,1e-15);near(s.coefficients[1],2e-10,1e-20);near(s.coefficients[7],1e-37,1e-45);
});
test('higher-order or duplicate asphere parameters and unsupported surface families remain blocked',()=>{
  for(const bad of [asphericText.replace('PARM 8 1e-22','PARM 9 0'),asphericText.replace('PARM 8 1e-22','PARM 2 0'),asphericText.replace('TYPE EVENASPH','TYPE XASPHERE'),asphericText.replace('TYPE EVENASPH','TYPE COORDBRK')])assert.equal(Z.parse(bad).canImport,false);
});
test('prism and asphere settings round-trip in project JSON',()=>{
  for(const p of [wedge(),{...singlet(),surfaces:Z.parse(asphericText).surfaces}]){const q=JSON.parse(JSON.stringify(p));O.validate(q);assert.deepEqual(O.bundle(p),O.bundle(q));}
});
