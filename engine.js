/* ReOrbit sequential spherical/aspheric optics and tilted prism planes. Units: mm, nm. */
(function(root, factory) {
  const api = factory(typeof module==='object'&&module.exports?require('./glasses.js'):root.GlassCatalog);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Optics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(GlassCatalog) {
  'use strict';
  const EPS = 1e-8;
  const add=(a,b)=>a.map((v,i)=>v+b[i]);
  const mul=(a,s)=>a.map(v=>v*s);
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const sub=(a,b)=>add(a,mul(b,-1));
  const unit=a=>mul(a,1/Math.sqrt(dot(a,a)));
  const isMirror=s=>s.interaction==='reflect';
  const reflect=(d,n)=>{n=unit(n);return unit(sub(d,mul(n,2*dot(d,n))));};
  const worldVector=(f,v)=>add(add(mul(f.zAxis,v[0]),mul(f.xAxis,v[1])),mul(f.yAxis,v[2]));
  const worldPoint=(f,p)=>add(f.origin,worldVector(f,p));
  const localVector=(f,v)=>[dot(v,f.zAxis),dot(v,f.xAxis),dot(v,f.yAxis)];
  const localPoint=(f,p)=>localVector(f,sub(p,f.origin));
  function index(material, wavelength) {
    return GlassCatalog.index(material,wavelength);
  }
  function sag(radius, height) {
    if (radius === 0) return 0;
    return Math.sign(radius)*height*height/(Math.abs(radius)+Math.sqrt(radius*radius-height*height));
  }
  const surfaceType=s=>s.type||'standard';
  function radialSag(s,r){
    if(surfaceType(s)!=='asphere')return sag(s.radius,r);
    const c=s.radius===0?0:1/s.radius,k=s.conic||0,q=1-(1+k)*c*c*r*r;
    if(q<0)return NaN;
    let z=c*r*r/(1+Math.sqrt(q));
    for(let i=0;i<(s.coefficients||[]).length;i++)z+=s.coefficients[i]*r**(2*i+2);
    return z;
  }
  function radialSlope(s,r){
    const c=s.radius===0?0:1/s.radius,k=surfaceType(s)==='asphere'?(s.conic||0):0;
    let slope=c*r/Math.sqrt(1-(1+k)*c*c*r*r);
    if(surfaceType(s)==='asphere')for(let i=0;i<(s.coefficients||[]).length;i++)slope+=(2*i+2)*s.coefficients[i]*r**(2*i+1);
    return slope;
  }
  const surfaceSag=(s,x,y=0)=>surfaceType(s)==='prism'?Math.tan((s.tilt||0)*Math.PI/180)*x:radialSag(s,Math.hypot(x,y));
  function bounds(s){
    const a=s.diameter/2;
    if(surfaceType(s)==='prism'){const extent=Math.abs(surfaceSag(s,a));return [-extent,extent];}
    if(surfaceType(s)!=='asphere'){const z=sag(s.radius,a);return [Math.min(0,z),Math.max(0,z)];}
    const z=radialSag({...s,coefficients:[]},a);
    let low=Math.min(0,z),high=Math.max(0,z);
    for(let i=0;i<(s.coefficients||[]).length;i++){const v=s.coefficients[i]*a**(2*i+2);low+=Math.min(0,v);high+=Math.max(0,v);}
    return [low,high];
  }
  function slopeBound(s,a){
    if(surfaceType(s)==='prism')return 0;
    let bound=Math.abs(radialSlope({...s,coefficients:[]},a));
    if(surfaceType(s)==='asphere')for(let i=0;i<(s.coefficients||[]).length;i++)bound+=(2*i+2)*Math.abs(s.coefficients[i])*a**(2*i+1);
    return bound;
  }
  function validate(p) {
    if (!p || !Array.isArray(p.surfaces) || p.surfaces.length<1 || p.surfaces.length>24) throw new Error('Use 1–24 surfaces.');
    for (const key of ['wavelength','pupil','field','imageDistance']) if (!Number.isFinite(p[key])) throw new Error(key+' must be a finite number.');
    if (p.wavelength<380 || p.wavelength>1700) throw new Error('Wavelength must be 380–1700 nm.');
    if (p.pupil<=0 || p.pupil>500) throw new Error('Entrance beam diameter must be greater than 0 and at most 500 mm.');
    if (Math.abs(p.field)>15) throw new Error('Field angle must be between −15° and 15°.');
    if (p.emission !== undefined) {
      const e=p.emission;
      if (!e || !['collimated','point'].includes(e.mode)) throw new Error('Choose collimated or point-source emission.');
      if (!Number.isFinite(e.distance) || e.distance<=0 || e.distance>10000) throw new Error('Source distance must be greater than 0 and at most 10,000 mm.');
      if (!Number.isFinite(e.halfAngle) || e.halfAngle<=0 || e.halfAngle>60) throw new Error('Emission cone half-angle must be greater than 0 and at most 60°.');
    }
    if (p.imageDistance<=0 || p.imageDistance>10000) throw new Error('Image distance must be greater than 0 and at most 10,000 mm.');
    p.surfaces.forEach((s,i)=>{
      if (!s || !['radius','thickness','diameter'].every(k=>Number.isFinite(s[k]))) throw new Error('Surface '+(i+1)+': enter finite numbers.');
      if (s.diameter<=0 || s.diameter>500 || s.thickness<0 || s.thickness>10000 || (i<p.surfaces.length-1 && s.thickness<=EPS)) throw new Error('Surface '+(i+1)+': invalid diameter or spacing.');
      const type=surfaceType(s);
      if(s.interaction!==undefined&&!['refract','reflect'].includes(s.interaction))throw new Error('Surface '+(i+1)+': choose refraction or reflection.');
      if(!['standard','asphere','prism'].includes(type))throw new Error('Surface '+(i+1)+': unsupported surface type.');
      if(s.conic!==undefined&&!Number.isFinite(s.conic))throw new Error('Surface '+(i+1)+': conic must be finite.');
      if(s.coefficients!==undefined&&(!Array.isArray(s.coefficients)||s.coefficients.length>8||!s.coefficients.every(Number.isFinite)))throw new Error('Surface '+(i+1)+': use at most eight finite coefficients A2–A16.');
      if(type!=='asphere'&&((s.conic||0)!==0||(s.coefficients||[]).some(v=>v!==0)))throw new Error('Surface '+(i+1)+': choose Asphere to use conic/polynomial terms.');
      if(s.tilt!==undefined&&(!Number.isFinite(s.tilt)||Math.abs(s.tilt)>60))throw new Error('Surface '+(i+1)+': face tilt must be within ±60°.');
      if(type!=='prism'&&(s.tilt||0)!==0)throw new Error('Tilted curved surfaces are not supported. Use a prism plane.');
      if(type==='prism'&&s.radius!==0)throw new Error('Prism faces must be planes (radius 0).');
      if(type==='asphere'){
        const c=s.radius===0?0:1/s.radius,q=1-(1+(s.conic||0))*c*c*(s.diameter/2)**2;
        if(q<=1e-10)throw new Error('Surface '+(i+1)+': conic is undefined or vertical inside the clear aperture.');
        if(!bounds(s).every(Number.isFinite)||slopeBound(s,s.diameter/2)>10)throw new Error('Surface '+(i+1)+': asphere exceeds the supported finite sag/slope range.');
      }else if (s.radius!==0 && Math.abs(s.radius)<=s.diameter/2) throw new Error('Surface '+(i+1)+': radius magnitude must exceed the semi-aperture (or use 0 for a plane).');
      index(s.material,p.wavelength);
      if(isMirror(s)&&s.material!==(i===0?'AIR':p.surfaces[i-1].material))throw new Error('Surface '+(i+1)+': a mirror must retain its incoming medium.');
      if(i>0) {
        const prev=p.surfaces[i-1], h=Math.min(prev.diameter,s.diameter)/2;
        // Difference of two spherical sags is monotonic in radial height.
        if(surfaceType(prev)==='standard'&&type==='standard'&&!isMirror(prev)){
          if(prev.thickness+sag(s.radius,h)-sag(prev.radius,h)<=EPS)throw new Error('Surfaces '+i+' and '+(i+1)+' touch or cross inside their common aperture.');
        }else{
          const prevSign=isMirror(prev)?-1:1;
          const tilt=v=>surfaceType(v)==='prism'?Math.tan((v.tilt||0)*Math.PI/180):0;
          const radial=(v,r)=>surfaceType(v)==='prism'?0:radialSag(v,r),tiltDiff=Math.abs(tilt(s)-prevSign*tilt(prev));
          let minimum=Infinity;
          for(let j=0;j<=512;j++){const r=h*j/512;minimum=Math.min(minimum,prev.thickness+radial(s,r)-prevSign*radial(prev,r)-tiltDiff*r);}
          const uncertainty=(slopeBound(s,h)+slopeBound(prev,h)+tiltDiff)*h/1024;
          if(minimum<=EPS)throw new Error('Surfaces '+i+' and '+(i+1)+' touch or cross inside their common aperture.');
          if(minimum-uncertainty<=EPS)throw new Error('Cannot verify surface separation. Increase spacing or reduce the surface profile.');
        }
      }
    });
    if(p.surfaces.at(-1).material!=='AIR') throw new Error('The final surface must exit into AIR.');
    if(p.emission?.mode==='point'&&-p.emission.distance>=bounds(p.surfaces[0])[0])throw new Error('Place the source upstream of the first optical surface. Increase the source distance.');
    return p;
  }
  function geometry(p) {
    let z=0,frame={origin:[0,0,0],zAxis:[1,0,0],xAxis:[0,1,0],yAxis:[0,0,1]};
    return p.surfaces.map(s=>{
      const out={...s,z,frame};
      let outgoing={...frame};
      if(isMirror(s)){
        const n=worldVector(frame,normalAt({...s,z:0},[0,0,0]));
        outgoing={origin:frame.origin,zAxis:reflect(frame.zAxis,n),xAxis:mul(reflect(frame.xAxis,n),-1),yAxis:reflect(frame.yAxis,n)};
      }
      out.outgoing=outgoing;
      z+=s.thickness;frame={...outgoing,origin:add(frame.origin,mul(outgoing.zAxis,s.thickness))};return out;
    });
  }
  function imageFrame(p){return geometry(p).at(-1).outgoing;}
  function intersect(o,d,s) {
    if(surfaceType(s)==='prism'){
      const tilt=Math.tan((s.tilt||0)*Math.PI/180),den=d[0]-tilt*d[1];
      if(Math.abs(den)<1e-14)return null;
      const t=(s.z+tilt*o[1]-o[0])/den;
      return t>=-EPS?add(o,mul(d,Math.max(0,t))):null;
    }
    if(surfaceType(s)==='asphere')return intersectAsphere(o,d,s);
    let candidates;
    if(s.radius===0) candidates=[(s.z-o[0])/d[0]];
    else {
      const center=[s.z+s.radius,0,0], oc=sub(o,center), b=dot(oc,d), c=dot(oc,oc)-s.radius*s.radius;
      const disc=b*b-c;
      if(disc<0) return null;
      const q=-b-Math.sign(b || 1)*Math.sqrt(disc);
      candidates=Math.abs(q)>EPS ? [q,c/q] : [-b];
    }
    for(const t of candidates.filter(t=>Number.isFinite(t) && t>=-EPS).sort((a,b)=>a-b)) {
      const hit=add(o,mul(d,Math.max(0,t)));
      const h=Math.hypot(hit[1],hit[2]);
      if(s.radius!==0 && (h>Math.abs(s.radius) || Math.abs(hit[0]-s.z-sag(s.radius,h))>1e-5)) continue;
      return hit;
    }
    return null;
  }
  function intersectAsphere(o,d,s){
    // Bound the search by the surface's axial extent and projected clear disk.
    if(d[0]<=EPS)return null;
    const extent=bounds(s),a=s.diameter/2;
    let low=Math.max(0,(s.z+extent[0]-o[0])/d[0]-1e-7),high=(s.z+extent[1]-o[0])/d[0]+1e-7;
    const A=d[1]**2+d[2]**2,B=2*(o[1]*d[1]+o[2]*d[2]),C=o[1]**2+o[2]**2-a*a;
    if(A>1e-20){const disc=B*B-4*A*C;if(disc<0)return null;const root=Math.sqrt(disc);low=Math.max(low,(-B-root)/(2*A));high=Math.min(high,(-B+root)/(2*A));}
    else if(C>EPS)return null;
    if(high<low)return null;
    const evaluate=t=>{const hit=add(o,mul(d,t));return hit[0]-s.z-radialSag(s,Math.min(a,Math.hypot(hit[1],hit[2])));};
    let left=low,fl=evaluate(left);if(Math.abs(fl)<1e-10)return add(o,mul(d,left));
    // Locate the first sign-changing interval before refining it.
    const monotonic=d[0]>slopeBound(s,a)*Math.hypot(d[1],d[2]),steps=monotonic?1:256;
    for(let i=1;i<=steps;i++){
      const right=low+(high-low)*i/steps,fr=evaluate(right);
      if(Math.abs(fr)<1e-10)return add(o,mul(d,right));
      if(Number.isFinite(fl)&&Number.isFinite(fr)&&fl*fr<0){
        let lo=left,hi=right,flo=fl;
        for(let j=0;j<60;j++){const mid=(lo+hi)/2,f=evaluate(mid);if(Math.abs(f)<1e-10||hi-lo<1e-10)return add(o,mul(d,mid));if(flo*f<=0)hi=mid;else{lo=mid;flo=f;}}
        return add(o,mul(d,(lo+hi)/2));
      }
      left=right;fl=fr;
    }
    return null;
  }
  function normalAt(s,hit){
    if(surfaceType(s)==='prism')return [-1,Math.tan((s.tilt||0)*Math.PI/180),0];
    if(surfaceType(s)==='asphere'){
      const r=Math.hypot(hit[1],hit[2]),slope=radialSlope(s,r);
      return r>EPS?[-1,slope*hit[1]/r,slope*hit[2]/r]:[-1,0,0];
    }
    return s.radius===0?[-1,0,0]:sub(hit,[s.z+s.radius,0,0]);
  }
  function refract(d,normal,n1,n2) {
    let n=unit(normal);
    if(dot(d,n)>0) n=mul(n,-1);
    const cos=-dot(d,n), eta=n1/n2, k=1-eta*eta*(1-cos*cos);
    if(k<0) return null;
    return unit(add(mul(d,eta),mul(n,eta*cos-Math.sqrt(k))));
  }
  function trace(p, pupilX, pupilY, wavelength=p.wavelength, firstTarget=null) {
    const surfaces=geometry(p), angle=p.field*Math.PI/180;
    let d=[Math.cos(angle),Math.sin(angle),0];
    const start=Math.min(-10,bounds(surfaces[0])[0])-5;
    // Collimated coordinates are specified in the first vertex plane, z=0.
    let o=[start,pupilX+start*Math.tan(angle),pupilY], n1=1;
    if(p.emission?.mode==='point') {
      o=[-p.emission.distance,0,0];
      // Uniform solid-angle cap: r² is uniform, so cos(theta) is uniform.
      const fraction=Math.min(1,Math.hypot(pupilX,pupilY)/(p.pupil/2));
      const cos=1-fraction*fraction*(1-Math.cos(p.emission.halfAngle*Math.PI/180));
      const sin=Math.sqrt(Math.max(0,1-cos*cos)), azimuth=Math.atan2(pupilY,pupilX);
      d=unit(add(mul(d,cos),add(mul([-Math.sin(angle),Math.cos(angle),0],sin*Math.cos(azimuth)),[0,0,sin*Math.sin(azimuth)])));
      if(firstTarget) d=unit(sub(firstTarget,o));
    }
    const points=[o];
    for(let i=0;i<surfaces.length;i++) {
      const s=surfaces[i],localSurface={...s,z:0},incoming=localVector(s.frame,d),hitLocal=intersect(localPoint(s.frame,o),incoming,localSurface);
      if(!hitLocal) return {points,status:'missed',surface:i};
      const hit=worldPoint(s.frame,hitLocal);
      points.push(hit);
      if(Math.hypot(hitLocal[1],hitLocal[2])>s.diameter/2+EPS) return {points,status:'clipped',surface:i};
      const n2=index(s.material,wavelength);
      const normal=normalAt(localSurface,hitLocal);
      const nd=isMirror(s)?reflect(incoming,normal):refract(incoming,normal,n1,n2);
      if(!nd) return {points,status:'TIR',surface:i};
      o=hit; d=worldVector(s.frame,nd); n1=n2;
      if(dot(d,s.outgoing.zAxis)<=EPS) return {points,status:'backward',surface:i};
    }
    const f=surfaces.at(-1).outgoing,exitOrigin=localPoint(f,o),exitDirection=localVector(f,d);
    const t=(p.imageDistance-exitOrigin[0])/exitDirection[0];
    if(t<=0) return {points,status:'image-before-exit'};
    const image=add(o,mul(d,t));
    points.push(image);
    return {points,status:'ok',image,imageLocal:localPoint(f,image),origin:o,direction:d,exitOrigin,exitDirection};
  }
  function bundle(p,count=401) {
    validate(p);
    const rays=[trace(p,0,0)];
    // Uniform-area sunflower disk; chief ray included separately.
    for(let i=0;i<count-1;i++) {
      const r=p.pupil/2*Math.sqrt((i+.5)/(count-1)), a=i*Math.PI*(3-Math.sqrt(5));
      rays.push(trace(p,r*Math.cos(a),r*Math.sin(a)));
    }
    const valid=rays.filter(r=>r.status==='ok');
    const centroid=valid.length ? [1,2].map(k=>valid.reduce((s,r)=>s+r.imageLocal[k],0)/valid.length) : [0,0];
    const rms=valid.length ? Math.sqrt(valid.reduce((s,r)=>s+(r.imageLocal[1]-centroid[0])**2+(r.imageLocal[2]-centroid[1])**2,0)/valid.length) : null;
    return {rays,valid,centroid,rms};
  }
  function meridionalRays(p,count=11) {
    validate(p);
    const angular=()=>Array.from({length:count},(_,i)=>trace(p,p.pupil/2*(2*i/(count-1)-1),0));
    if(p.emission?.mode!=='point') return angular();
    const s=geometry(p)[0],source=[-p.emission.distance,0,0],a=s.diameter/2;
    const low=(p.field-p.emission.halfAngle)*Math.PI/180,high=(p.field+p.emission.halfAngle)*Math.PI/180;
    const target=h=>[s.z+surfaceSag(s,h),h,0];
    const visible=h=>{
      const t=target(h),d=unit(sub(t,source)),angle=Math.atan2(d[1],d[0]),hit=intersect(source,d,s);
      return angle>=low-1e-10 && angle<=high+1e-10 && hit && Math.hypot(...sub(hit,t))<1e-5;
    };
    // The footprint ends at either a cone boundary or the clear-aperture edge.
    const heights=[-a,a].filter(visible);
    for(const angle of [low,high,(low+high)/2]) {
      const hit=intersect(source,[Math.cos(angle),Math.sin(angle),0],s);
      if(hit && Math.abs(hit[1])<=a+EPS && visible(hit[1])) heights.push(Math.max(-a,Math.min(a,hit[1])));
    }
    if(!heights.length) return angular(); // Show missed/clipped rays when the cone misses the lens.
    const bottom=Math.min(...heights),top=Math.max(...heights);
    return Array.from({length:count},(_,i)=>trace(p,0,0,p.wavelength,target(bottom+(top-bottom)*i/(count-1))));
  }
  function fillFirstLens(p) {
    validate(p);
    const e=p.emission;
    if(e?.mode!=='point') throw new Error('Choose Point source to fill the first lens.');
    const s=p.surfaces[0],a=s.diameter/2;
    let halfAngle=0;
    for(let i=0;i<=128;i++){const h=a*(2*i/128-1);halfAngle=Math.max(halfAngle,Math.atan2(Math.abs(h),e.distance+surfaceSag(s,h))*180/Math.PI);}
    if(halfAngle>60) throw new Error('Move the source farther away to fill the lens within the 60° cone limit.');
    // Check that the source can actually see the edge of a strongly convex surface.
    const o=[-e.distance,0,0];
    for(const h of [-a,a]){const t=[surfaceSag(s,h),h,0],hit=intersect(o,unit(sub(t,o)),{...s,z:0});
      if(!hit || Math.hypot(...sub(hit,t))>1e-5) throw new Error('Move the source farther away so the full first surface is visible.');}
    return {...p,field:0,emission:{...e,halfAngle}};
  }
  function bestFocus(p) {
    const {valid}=bundle(p);
    if(valid.length<5) throw new Error('At least five surviving rays are needed to find focus.');
    const samples=valid.map(r=>{
      const b=[r.exitDirection[1]/r.exitDirection[0],r.exitDirection[2]/r.exitDirection[0]];
      return {b,a:[r.exitOrigin[1]-b[0]*r.exitOrigin[0],r.exitOrigin[2]-b[1]*r.exitOrigin[0]]};
    });
    const avg=k=>[0,1].map(j=>samples.reduce((s,v)=>s+v[k][j],0)/samples.length), a=avg('a'), b=avg('b');
    let num=0,den=0;
    for(const s of samples) for(let j=0;j<2;j++) {num+=(s.a[j]-a[j])*(s.b[j]-b[j]);den+=(s.b[j]-b[j])**2;}
    if(den<1e-15) throw new Error('The outgoing bundle is collimated; there is no finite best focus.');
    const distance=-num/den;
    if(distance<=0 || distance>10000) throw new Error('Best focus is virtual or outside the 0–10,000 mm image range.');
    return distance;
  }
  function paraxial(p) {
    validate(p);
    if(p.surfaces.some(s=>surfaceType(s)==='prism'&&!isMirror(s)))return null;
    // EFL is a property of the optics, independent of the current source conjugate.
    const ray=trace({...p,field:0,emission:{mode:'collimated'}},.00001,0);
    if(ray.status!=='ok') return null;
    const slope=ray.exitDirection[1]/ray.exitDirection[0],parity=p.surfaces.filter(isMirror).length%2?-1:1;
    return Math.abs(slope)<1e-14 ? null : -parity*.00001/slope;
  }
  // Reduced-angle matrix [height, n*angle], unfolded through plane mirror folds.
  // Distances are vertex-to-vertex; the final selected surface's gap is excluded.
  function surfaceFocal(p,i){
    if(!Number.isInteger(i)||i<0||i>=p.surfaces.length)throw new Error('Invalid surface number.');
    const s=p.surfaces[i],nIn=index(i?p.surfaces[i-1].material:'AIR',p.wavelength),nOut=index(s.material,p.wavelength);
    if(surfaceType(s)==='prism'&&!isMirror(s)&&Math.abs(s.tilt||0)>1e-12)
      return {supported:false,reason:'Tilted refracting faces need separate tangential/sagittal analysis.'};
    const c=(s.radius===0?0:1/s.radius)+(surfaceType(s)==='asphere'?2*(s.coefficients?.[0]||0):0);
    const power=isMirror(s)?-2*nIn*c:(nOut-nIn)*c;
    const afocal=Math.abs(power)<1e-14;
    return {supported:true,nIn,nOut,power,afocal,efl:afocal?null:nOut/power,frontFocalDistance:afocal?null:-nIn/power,backFocalDistance:afocal?null:nOut/power};
  }
  function focalMatrix(p,first,last,overrideIndex=-1,overridePower=0){
    let A=1,B=0,C=0,D=1;
    for(let i=first;i<=last;i++){
      const f=surfaceFocal(p,i);if(!f.supported)return f;
      const power=i===overrideIndex?overridePower:f.power;
      C-=power*A;D-=power*B;
      if(i<last){const t=p.surfaces[i].thickness/f.nOut;A+=t*C;B+=t*D;}
    }
    return {supported:true,A,B,C,D};
  }
  function groupFocal(p,first=0,last=p.surfaces.length-1){
    validate(p);
    if(!Number.isInteger(first)||!Number.isInteger(last)||first<0||last<first||last>=p.surfaces.length)throw new Error('Select a continuous surface range.');
    const m=focalMatrix(p,first,last);if(!m.supported)return m;
    const {A,B,C,D}=m,nIn=index(first?p.surfaces[first-1].material:'AIR',p.wavelength);
    const nOut=index(p.surfaces[last].material,p.wavelength),afocal=Math.abs(C)<1e-14;
    return {supported:true,first,last,nIn,nOut,matrix:{A,B,C,D},afocal,efl:afocal?null:-nOut/C,frontEfl:afocal?null:-nIn/C,backFocalDistance:afocal?null:-nOut*A/C,frontFocalDistance:afocal?null:nIn*D/C};
  }
  function focalTarget(value){
    if(value===Infinity||value===-Infinity)return Infinity;
    if(!Number.isFinite(value)||value===0)throw new Error('Enter a nonzero focal distance in mm, or infinity.');
    return value;
  }
  function radiusForPower(p,i,power){
    const s=p.surfaces[i],f=surfaceFocal(p,i);
    if(!f.supported||surfaceType(s)==='prism')throw new Error('Choose a spherical or aspheric surface to adjust its radius.');
    const factor=isMirror(s)?-2*f.nIn:f.nOut-f.nIn;
    if(Math.abs(factor)<1e-14)throw new Error('This interface has no index contrast; its radius cannot set a focal distance.');
    const baseCurvature=power/factor-(surfaceType(s)==='asphere'?2*(s.coefficients?.[0]||0):0);
    return Math.abs(baseCurvature)<1e-14?0:1/baseCurvature;
  }
  function withFocalRadius(p,i,power){
    const q=JSON.parse(JSON.stringify(p));q.surfaces[i].radius=radiusForPower(p,i,power);validate(q);return q;
  }
  function setSurfaceFocal(p,i,target){
    validate(p);target=focalTarget(target);
    const f=surfaceFocal(p,i);
    if(!f.supported)throw new Error(f.reason);
    const q=withFocalRadius(p,i,target===Infinity?0:f.nOut/target),actual=surfaceFocal(q,i).backFocalDistance;
    if(target!==Infinity&&(actual===null||Math.abs(actual-target)>1e-7*Math.max(1,Math.abs(target))))throw new Error('Requested focal distance is outside numerical resolution.');
    return q;
  }
  function setGroupFocal(p,first,last,i,target,metric='efl'){
    const g=groupFocal(p,first,last);if(!g.supported)throw new Error(g.reason);
    if(!Number.isInteger(i)||i<first||i>last)throw new Error('Choose a surface inside the selected group.');
    if(!['efl','backFocalDistance','frontFocalDistance'].includes(metric))throw new Error('Unknown focal target.');
    target=focalTarget(target);
    // Every matrix entry is affine in the power of one selected interface.
    const a=focalMatrix(p,first,last,i,0),b=focalMatrix(p,first,last,i,1);
    const equation=m=>target===Infinity?m.C:metric==='efl'?m.C+g.nOut/target:metric==='backFocalDistance'?g.nOut*m.A+target*m.C:g.nIn*m.D-target*m.C;
    const v=equation(a),delta=equation(b)-v;
    if(Math.abs(delta)<1e-14)throw new Error('This surface cannot independently set that group focal target. Choose another surface.');
    const q=withFocalRadius(p,i,-v/delta),actual=groupFocal(q,first,last)[metric];
    if(target===Infinity?actual!==null:actual===null||Math.abs(actual-target)>1e-7*Math.max(1,Math.abs(target)))throw new Error('Requested group focus is singular or outside numerical resolution.');
    return q;
  }
  function beamDiagnostics(p,count=401){
    const b=bundle(p,count),failures={};
    b.rays.filter(r=>r.status!=='ok').forEach(r=>{const key=r.status+(r.surface===undefined?'':' at surface '+(r.surface+1));failures[key]=(failures[key]||0)+1;});
    if(!b.valid.length)return {raysLaunched:b.rays.length,raysReachingImage:0,geometricSurvivalFraction:0,failures,beamRmsRadiusMm:null,outgoingAngularRmsMrad:null};
    const angles=b.valid.map(r=>[Math.atan2(r.exitDirection[1],r.exitDirection[0]),Math.atan2(r.exitDirection[2],r.exitDirection[0])]);
    const mean=[0,1].map(j=>angles.reduce((a,v)=>a+v[j],0)/angles.length);
    const rms=Math.sqrt(angles.reduce((a,v)=>a+(v[0]-mean[0])**2+(v[1]-mean[1])**2,0)/angles.length);
    return {raysLaunched:b.rays.length,raysReachingImage:b.valid.length,geometricSurvivalFraction:b.valid.length/b.rays.length,failures,beamRmsRadiusMm:b.rms,sampledEnvelopeDiameterMm:2*Math.max(...b.valid.map(r=>Math.hypot(r.imageLocal[1]-b.centroid[0],r.imageLocal[2]-b.centroid[1]))),outgoingAngularRmsMrad:rms*1000,meanDirectionMrad:mean.map(v=>v*1000),imagePlaneDistanceMm:p.imageDistance,coordinateConvention:'Transverse coordinates and angles relative to the nominal outgoing optical axis',model:'Geometric samples only; no diffraction, M², finite emitter size or optical-power transmission model'};
  }
  return {index,materials:GlassCatalog,sag,surfaceType,surfaceSag,radialSlope,bounds,normalAt,isMirror,reflect,worldVector,worldPoint,localVector,localPoint,imageFrame,validate,geometry,intersect,refract,trace,bundle,meridionalRays,fillFirstLens,bestFocus,paraxial,surfaceFocal,groupFocal,setSurfaceFocal,setGroupFocal,beamDiagnostics};
});
