const {test}=require('node:test');
const assert=require('node:assert/strict');
const O=require('../engine.js');
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const lens=()=>({wavelength:587.6,pupil:10,field:0,imageDistance:48,surfaces:[{radius:52,thickness:5,material:'N-BK7',diameter:20},{radius:-52,thickness:0,material:'AIR',diameter:20}]});
test('individual interface uses both media and the exit index',()=>{
 const p=lens(),n=O.index('N-BK7',p.wavelength);
 near(O.surfaceFocal(p,0).backFocalDistance,n*52/(n-1));
 near(O.surfaceFocal(p,1).backFocalDistance,52/(n-1));
 near(O.groupFocal(p,1,1).efl,O.surfaceFocal(p,1).efl);
});
test('thick group EFL and vertex BFL agree with analytic lensmaker and traced paraxial ray',()=>{
 const p=lens(),n=O.index('N-BK7',p.wavelength),power=(n-1)*(2/52-(n-1)*5/(n*52**2));
 const g=O.groupFocal(p);near(g.efl,1/power);near(g.efl,O.paraxial(p));
 const r=O.trace(p,.0001,0),slope=r.exitDirection[1]/r.exitDirection[0];
 near(g.backFocalDistance,r.exitOrigin[0]-r.exitOrigin[1]/slope,1e-5);
 near(g.matrix.A*g.matrix.D-g.matrix.B*g.matrix.C,1);
 assert.ok(g.frontFocalDistance<0);assert.ok(g.backFocalDistance<g.efl);
});
test('group excludes surrounding surfaces and terminal gap, includes internal spacing',()=>{
 const p=lens(),base=O.groupFocal(p);p.surfaces[1].thickness=30;
 p.surfaces.push(...structuredClone(lens().surfaces));
 near(O.groupFocal(p,0,1).efl,base.efl);near(O.groupFocal(p,2,3).efl,base.efl);
 const g=O.groupFocal(p);p.surfaces[1].thickness=40;assert.ok(Math.abs(g.efl-O.groupFocal(p).efl)>1);
});
test('plane plate is afocal; source settings do not change focal lengths',()=>{
 const p=lens(),f=O.groupFocal(p).efl;p.field=10;p.emission={mode:'point',distance:100,halfAngle:5};near(O.groupFocal(p).efl,f);
 p.surfaces.forEach(s=>s.radius=0);assert.equal(O.groupFocal(p).afocal,true);assert.equal(O.surfaceFocal(p,0).efl,null);
});
test('dispersion updates power, negative lens gives virtual BFL',()=>{
 const p=lens(),f=O.groupFocal(p).efl;p.wavelength=1550;assert.ok(O.groupFocal(p).efl>f);
 p.surfaces.forEach(s=>s.radius=-s.radius);assert.ok(O.groupFocal(p).backFocalDistance<0);
});
test('asphere A2 changes vertex power; conic and A4 do not',()=>{
 const p=lens();Object.assign(p.surfaces[0],{type:'asphere',conic:-1,coefficients:[.001,1e-8]});
 const n=O.index('N-BK7',p.wavelength);near(O.surfaceFocal(p,0).power,(n-1)*(1/52+.002));
 p.surfaces[0].coefficients[1]=2e-8;near(O.surfaceFocal(p,0).power,(n-1)*(1/52+.002));
});
test('concave mirror and plane fold use unfolded path distances',()=>{
 const p=lens();p.surfaces=[{radius:-100,thickness:0,material:'AIR',diameter:10,interaction:'reflect'}];near(O.groupFocal(p).efl,50);near(O.groupFocal(p).backFocalDistance,50);
 const q=lens(),f=O.groupFocal(q);q.surfaces[1].thickness=20;q.surfaces.push({radius:0,type:'prism',tilt:45,thickness:0,material:'AIR',diameter:10,interaction:'reflect'});
 near(O.groupFocal(q).efl,f.efl);near(O.groupFocal(q).backFocalDistance,f.backFocalDistance-20);
});
test('tilted refracting faces explicitly reject scalar group focal length',()=>{
 const p=lens();p.surfaces[0]={...p.surfaces[0],radius:0,type:'prism',tilt:5};
 assert.equal(O.surfaceFocal(p,0).supported,false);assert.equal(O.groupFocal(p).supported,false);
});
test('invalid selections and invalid prescriptions fail without a numeric result',()=>{
 const p=lens();assert.throws(()=>O.groupFocal(p,1,0));assert.throws(()=>O.groupFocal(p,-1,1));assert.throws(()=>O.groupFocal(p,0,2));p.surfaces[0].thickness=NaN;assert.throws(()=>O.groupFocal(p));
});
test('surface target solves entrance and exit radii using their actual media',()=>{
 const p=lens(),original=JSON.stringify(p);
 for(const i of [0,1])for(const target of [120,-120]){
   const q=O.setSurfaceFocal(p,i,target);near(O.surfaceFocal(q,i).backFocalDistance,target);assert.equal(q.surfaces[1-i].radius,p.surfaces[1-i].radius);
 }
 assert.equal(JSON.stringify(p),original);
});
test('mirror and A2 asphere focal targets solve base curvature, retaining other terms',()=>{
 const p=lens();p.surfaces=[{radius:-100,material:'AIR',diameter:10,thickness:0,interaction:'reflect'}];
 const mirror=O.setSurfaceFocal(p,0,75);near(mirror.surfaces[0].radius,-150);
 const q=lens();Object.assign(q.surfaces[0],{type:'asphere',conic:-1,coefficients:[.001,1e-8]});
 const r=O.setSurfaceFocal(q,0,120);near(O.surfaceFocal(r,0).backFocalDistance,120);assert.deepEqual(r.surfaces[0].coefficients,q.surfaces[0].coefficients);
 const flat=O.setSurfaceFocal(q,0,Infinity);assert.equal(O.surfaceFocal(flat,0).afocal,true);assert.notEqual(flat.surfaces[0].radius,0);
});
test('group EFL, BFL and front-focus targets adjust only the nominated radius',()=>{
 const p=lens(),original=JSON.stringify(p);
 for(const [metric,target] of [['efl',60],['backFocalDistance',60],['frontFocalDistance',-60]])for(const i of [0,1]){
   const q=O.setGroupFocal(p,0,1,i,target,metric);near(O.groupFocal(q)[metric],target);
   near(q.surfaces[1-i].radius,p.surfaces[1-i].radius);assert.equal(q.surfaces[0].thickness,5);
 }
 assert.equal(JSON.stringify(p),original);
});
test('infinite target creates an afocal interface or group',()=>{
 const p=lens();assert.equal(O.setSurfaceFocal(p,0,Infinity).surfaces[0].radius,0);
 const q=O.setGroupFocal(p,0,1,1,Infinity);assert.equal(O.groupFocal(q).afocal,true);
});
test('invalid or physically impossible targets reject atomically',()=>{
 const p=lens(),original=JSON.stringify(p);
 for(const target of [0,NaN,1e-3])assert.throws(()=>O.setSurfaceFocal(p,0,target));
 assert.throws(()=>O.setGroupFocal(p,0,1,2,50));assert.throws(()=>O.setGroupFocal(p,0,1,0,50,'invalid'));
 const q=lens();q.surfaces[0].material='AIR';assert.throws(()=>O.setSurfaceFocal(q,0,100),/index contrast/);
 assert.equal(JSON.stringify(p),original);
});
