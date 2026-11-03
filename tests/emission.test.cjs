const {test}=require('node:test');
const assert=require('node:assert/strict');
const O=require('../engine.js');
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} differs from ${b}`);
const plate=()=>({wavelength:587.6,pupil:20,field:0,imageDistance:100,emission:{mode:'point',distance:100,halfAngle:5},surfaces:[{radius:0,thickness:0,diameter:100,material:'AIR'}]});
test('finite emission rays originate at the specified source and preserve free-space geometry',()=>{
  const p=plate(),r=O.trace(p,p.pupil/2,0);assert.equal(r.status,'ok');assert.deepEqual(r.points[0],[-100,0,0]);near(r.points[1][1],100*Math.tan(5*Math.PI/180));near(r.image[1],200*Math.tan(5*Math.PI/180));
});
test('direction tilts the cone axis while half-angle controls divergence',()=>{
  const p=plate();p.field=10;const chief=O.trace(p,0,0),marginal=O.trace(p,p.pupil/2,0);
  near(Math.atan2(chief.direction[1],chief.direction[0])*180/Math.PI,10);
  near(Math.atan2(marginal.direction[1],marginal.direction[0])*180/Math.PI,15);
});
test('pupil radius maps to uniform solid-angle sampling',()=>{
  const p=plate(),r=O.trace(p,p.pupil/2/Math.sqrt(2),0);near(r.direction[0],(1+Math.cos(5*Math.PI/180))/2);
});
test('source distance and cone width independently change footprint and clipping',()=>{
  const p=plate();p.surfaces[0].diameter=20;assert.equal(O.bundle(p).valid.length,401);
  p.emission.distance=200;assert.ok(O.bundle(p).valid.length<401);
  p.emission.distance=100;p.emission.halfAngle=10;assert.ok(O.bundle(p).valid.length<401);
});
test('finite-conjugate best focus follows paraxial imaging and EFL stays source independent',()=>{
  const p=plate();p.pupil=1;p.emission.halfAngle=.05;p.imageDistance=100;p.surfaces=[{radius:52,thickness:5,diameter:25,material:'N-BK7'},{radius:-52,thickness:0,diameter:25,material:'AIR'}];
  const collimated={...p,emission:{...p.emission,mode:'collimated'}};
  near(O.paraxial(p),O.paraxial(collimated));
  const n=O.index('N-BK7',p.wavelength),power=(n-1)/52;
  // Independent first-order [height, reduced-angle] matrix: refraction/translation/refraction.
  const A=1-5*power/n,B=5/n,C=-2*power+5*power*power/n,D=A;
  const expected=-(A*100+B)/(C*100+D);
  near(O.bestFocus(p),expected,.001);
  p.imageDistance=O.bestFocus(p);assert.ok(O.bundle(p).rms<.00001);
});
test('legacy collimated projects retain exactly the same trace',()=>{
  const p=plate();delete p.emission;const a=O.bundle(p),b=O.bundle({...p,emission:{mode:'collimated',distance:100,halfAngle:5}});assert.deepEqual(a,b);
});
test('invalid source distances, cone angles, modes and intersecting source positions are rejected',()=>{
  for(const e of [{distance:0},{distance:NaN},{halfAngle:0},{halfAngle:61},{mode:'laser'},{distance:10001}]) assert.throws(()=>O.bundle({...plate(),emission:{...plate().emission,...e}}));
  const p=plate();p.emission.distance=.1;p.surfaces[0].radius=-100;assert.throws(()=>O.validate(p),/upstream/);
});
test('emission settings survive JSON serialisation',()=>{
  const p=plate();p.field=-3;p.wavelength=1550;const roundtrip=JSON.parse(JSON.stringify(p));O.validate(roundtrip);assert.deepEqual(O.bundle(p),O.bundle(roundtrip));
});
