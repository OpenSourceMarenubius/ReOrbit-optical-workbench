const {test}=require('node:test');
const assert=require('node:assert/strict');
const O=require('../engine.js');
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} differs from ${b}`);
const lens=()=>({wavelength:1550,pupil:20,field:2,imageDistance:90,emission:{mode:'point',distance:120,halfAngle:4},surfaces:[{radius:52,thickness:5,material:'N-BK7',diameter:25},{radius:-52,thickness:0,material:'AIR',diameter:25}]});
test('layout rays hit a curved first lens at equal height intervals within the emission cone',()=>{
  const p=lens(),rays=O.meridionalRays(p);assert.equal(rays.length,11);
  const heights=rays.map(r=>r.points[1][1]),step=(heights.at(-1)-heights[0])/10;
  for(let i=1;i<heights.length;i++) near(heights[i]-heights[i-1],step);
  for(const r of rays){const start=r.points[0],hit=r.points[1],angle=Math.atan2(hit[1]-start[1],hit[0]-start[0])*180/Math.PI;assert.ok(Math.abs(angle-p.field)<=p.emission.halfAngle+1e-8);assert.ok(Math.abs(hit[1])<=12.5+1e-8);}
});
test('fill-first-lens targets both clear-aperture edges with symmetric ray spacing',()=>{
  for(const radius of [52,-52,0]){
    const p=lens();p.surfaces=[{radius,thickness:0,material:'AIR',diameter:25}];
    const filled=O.fillFirstLens(p),rays=O.meridionalRays(filled);near(filled.field,0);near(rays[0].points[1][1],-12.5);near(rays.at(-1).points[1][1],12.5);
    for(let i=0;i<11;i++) near(rays[i].points[1][1],-12.5+2.5*i);
    assert.equal(p.field,2); // Computing the alignment does not mutate the original project.
  }
});
test('narrow cones still show evenly spaced rays without extending beyond the cone',()=>{
  const p=lens();p.field=-3;p.emission.halfAngle=.001;
  const rays=O.meridionalRays(p),h=rays.map(r=>r.points[1][1]);assert.ok(h.at(-1)-h[0]<.01);
  for(let i=1;i<h.length;i++) near(h[i]-h[i-1],(h.at(-1)-h[0])/10);
});
test('a cone missing the first lens remains missed rather than being redirected into it',()=>{
  const p=lens();p.field=15;p.emission.halfAngle=1;const rays=O.meridionalRays(p);assert.ok(rays.every(r=>r.status!=='ok'));
});
test('changing layout sampling leaves spot calculation unchanged',()=>{
  const p=lens(),before=O.bundle(p);O.meridionalRays(p);assert.deepEqual(O.bundle(p),before);
});
