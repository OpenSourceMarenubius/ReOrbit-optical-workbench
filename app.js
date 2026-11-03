'use strict';
const $=id=>document.getElementById(id);
const presets={
  singlet:{name:'The everyday singlet',wavelength:587.6,pupil:20,field:0,imageDistance:48,surfaces:[{radius:52,thickness:5,material:'N-BK7',diameter:25},{radius:-52,thickness:0,material:'AIR',diameter:25}]},
  plano:{name:'One curve, many possibilities',wavelength:587.6,pupil:15,field:0,imageDistance:46,surfaces:[{radius:25.8,thickness:5,material:'N-BK7',diameter:25},{radius:0,thickness:0,material:'AIR',diameter:25}]},
  expander:{name:'Mars-bound beam · concept',wavelength:1550,pupil:2.5,field:0,imageDistance:100,surfaces:[{radius:-16,thickness:3,material:'N-BK7',diameter:10},{radius:16,thickness:132,material:'AIR',diameter:10},{radius:155,thickness:6,material:'N-BK7',diameter:40},{radius:-155,thickness:0,material:'AIR',diameter:40}]}
};
const clone=p=>JSON.parse(JSON.stringify(p));
function emission(p){return p.emission || {mode:'collimated',distance:100,halfAngle:5};}
let project=clone(presets.singlet), lastResult=null, storageOK=true;
let supplierReport=null, supplierUndo=null;
let editingSurface=null;
let glassTarget=null,glassLimit=12,opticMaterial='N-BK7';
const focalSelection=new Set();
const shapeName=s=>(Optics.isMirror(s)?'Mirror · ':'')+(Optics.surfaceType(s)==='asphere'?'Asphere':Optics.surfaceType(s)==='prism'?'Tilted plane':s.radius===0?'Plane':'Sphere');
try{const saved=localStorage.getItem('reorbit.project.v1');if(saved){const p=JSON.parse(saved);Optics.validate(p);project=p;}}catch{storageOK=false;}
const fmt=(n,d=3)=>Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
function message(s,error=false){$('message').textContent=s;$('message').classList.toggle('error',error);$('emission-error').textContent=error?s:'';}
function mount(){
  for(const k of ['name','wavelength','pupil','field','imageDistance']) $(k).value=project[k];
  syncEmission();renderTable();update();
}
function syncEmission(){
  const e=emission(project);
  $('source-mode').value=e.mode;$('source-distance').value=e.distance;$('source-cone').value=e.halfAngle;
  $('source-wavelength').value=project.wavelength;$('source-angle').value=project.field;
  const point=e.mode==='point';
  $('source-distance').disabled=!point;$('source-cone').disabled=!point;$('pupil').disabled=point;
  $('fill-lens').disabled=!point;
  $('source-note').textContent=point?'Point source on the optical axis. Distance is measured back from the first surface vertex. Cone angle is measured from the emission direction.':'Parallel rays. Beam diameter is defined at the first vertex plane; source distance and cone angle apply to point sources.';
  $('input-note').textContent=point?'Point source · '+fmt(e.distance)+' mm before the first vertex · '+fmt(e.halfAngle)+'° cone half-angle.':'Collimated input. Beam diameter is defined at the first vertex plane.';
  $('sample-caption').textContent=point?'401 cone samples · one wavelength':'401 pupil samples · one wavelength';
  $('emission-summary').textContent=(point?'Point source · '+fmt(e.distance)+' mm · '+fmt(e.halfAngle)+'° half-angle':'Collimated source')+' · '+fmt(project.wavelength,1)+' nm · '+fmt(project.field,2)+'° direction';
}
function renderTable(){
  for(const s of focalSelection)if(!project.surfaces.includes(s))focalSelection.delete(s);
  $('surfaces').replaceChildren();
  project.surfaces.forEach((s,i)=>{
    const tr=document.createElement('tr'), label=document.createElement('td');
    const selectCell=document.createElement('td'),check=document.createElement('input');
    check.type='checkbox';check.className='focal-select';check.checked=focalSelection.has(s);check.setAttribute('aria-label','Select surface '+(i+1)+' for focal group');
    check.addEventListener('change',()=>{check.checked?focalSelection.add(s):focalSelection.delete(s);updateFocalReadouts();});selectCell.append(check);tr.append(selectCell);
    const shapeButton=document.createElement('button');shapeButton.className='shape-button';shapeButton.textContent=String(i+1).padStart(2,'0')+' / '+shapeName(s)+' ⚙';shapeButton.setAttribute('aria-label','Edit surface '+(i+1)+' shape');shapeButton.addEventListener('click',()=>openSurfaceShape(i));label.append(shapeButton);tr.append(label);
    if(s.supplier){label.title='Imported from '+s.supplier.file+' · source surface '+s.supplier.surface+' · '+(s.supplier.comment||'editable geometry');label.classList.add('supplier-cell');}
    for(const key of ['radius','thickness','material','diameter']){
      const td=document.createElement('td');
      if(key==='material'){
        const picker=document.createElement('button');picker.className='material-button';picker.textContent=Optics.isMirror(s)?'Mirror ↶':s.material+' ⌕';picker.setAttribute('aria-label',Optics.isMirror(s)?'Edit mirror surface '+(i+1):'Choose material after surface '+(i+1));
        picker.title=Optics.isMirror(s)?'Ideal specular reflection':'Search optical glasses';picker.addEventListener('click',()=>Optics.isMirror(s)?openSurfaceShape(i):openGlassPicker({kind:'surface',index:i}));td.append(picker);tr.append(td);continue;
      }
      const input=document.createElement('input');
      input.setAttribute('aria-label',`Surface ${i+1} ${key}`);
      input.type='number';input.step='any';if(key!=='radius') input.min=key==='thickness'?'0':'0.001';
      input.value=s[key];
      if(key==='radius'&&Optics.surfaceType(s)==='prism'){input.disabled=true;input.title='Tilted faces are planes; edit their tilt using the surface shape button.';}
      if(key==='thickness' && i===project.surfaces.length-1){input.disabled=true;input.title='Set the image distance in Set the scene.';}
      input.addEventListener('input',()=>{s[key]=input.value===''?NaN:Number(input.value);$('focal-solve-status').textContent='';shapeButton.textContent=String(i+1).padStart(2,'0')+' / '+shapeName(s)+' ⚙';update();});
      td.append(input);tr.append(td);
    }
    const focalCell=document.createElement('td'),focal=document.createElement('input');focal.type='text';focal.inputMode='decimal';focal.className='focal-input';focal.dataset.focalSurface=i;focal.setAttribute('aria-label','Surface '+(i+1)+' back focal distance');
    focal.addEventListener('change',()=>applyFocalTarget(i,focal.value));focal.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyFocalTarget(i,focal.value);}});focalCell.append(focal);tr.append(focalCell);
    const td=document.createElement('td'),remove=document.createElement('button');remove.textContent='×';remove.title='Remove surface '+(i+1);remove.setAttribute('aria-label',remove.title);remove.disabled=project.surfaces.length===1;
    remove.addEventListener('click',()=>{project.surfaces.splice(i,1);project.surfaces.at(-1).thickness=0;renderTable();update();});td.append(remove);tr.append(td);$('surfaces').append(tr);
  });
  $('add').disabled=project.surfaces.length>=24;
  $('add-optic').disabled=project.surfaces.length>22;
}
function focalText(value){return value===null?'∞ (afocal)':fmt(value,3)+' mm';}
const focalValue=value=>value===null?'∞':String(Number(value.toPrecision(9)));
function parseFocalTarget(text){
  const value=text.trim();if(/^[+−-]?(?:∞|inf(?:inity)?)(?:\s*\(afocal\))?$/i.test(value))return Infinity;
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))throw new Error('Enter a nonzero number in mm, or infinity (∞).');
  const number=Number(value);if(!Number.isFinite(number)||number===0)throw new Error('Focal distance must be finite and nonzero, or infinity (∞).');return number;
}
function selectedFocalIds(){return project.surfaces.map((s,i)=>focalSelection.has(s)?i:-1).filter(i=>i>=0);}
function applyFocalTarget(i,text,metric=null){
  try{
    const target=parseFocalTarget(text),ids=selectedFocalIds();
    const next=metric?Optics.setGroupFocal(project,ids[0],ids.at(-1),i,target,metric):Optics.setSurfaceFocal(project,i,target);
    project.surfaces[i].radius=next.surfaces[i].radius;renderTable();update();
    $('focal-solve-status').textContent='Set surface '+(i+1)+' radius to '+fmt(project.surfaces[i].radius,6)+' mm. Focal target applied at '+fmt(project.wavelength,1)+' nm.';
    $('focal-solve-status').classList.remove('error');
  }catch(e){updateFocalReadouts();$('focal-solve-status').textContent='Focal edit not applied: '+e.message;$('focal-solve-status').classList.add('error');}
}
function updateFocalReadouts(){
  let valid=true;try{Optics.validate(project);}catch{valid=false;}
  document.querySelectorAll('[data-focal-surface]').forEach(el=>{
    el.value='';el.placeholder='—';el.disabled=true;el.title='Correct the invalid prescription to calculate focal distance.';
    if(!valid)return;
    const f=Optics.surfaceFocal(project,Number(el.dataset.focalSurface));
    el.value=f.supported?focalValue(f.backFocalDistance):'';
    const adjustable=f.supported&&Optics.surfaceType(project.surfaces[Number(el.dataset.focalSurface)])!=='prism'&&(Optics.isMirror(project.surfaces[Number(el.dataset.focalSurface)])||Math.abs(f.nOut-f.nIn)>1e-14);
    el.disabled=!adjustable;
    el.title=f.supported?'Surface back focal distance in mm at '+fmt(project.wavelength,1)+' nm. Enter a nonzero value or infinity; Enter or leave the field to adjust this radius. Negative: virtual focus. Tilted planes and equal-index interfaces cannot be adjusted.':f.reason;
  });
  const ids=selectedFocalIds();
  document.querySelectorAll('#surfaces tr').forEach((row,i)=>row.classList.toggle('focal-selected',focalSelection.has(project.surfaces[i])));
  $('focal-range').textContent=ids.length?'Surfaces '+ids.map(i=>i+1).join(', ')+' · '+fmt(project.wavelength,1)+' nm':'Select surfaces using the checkboxes';
  for(const id of ['group-efl','group-bfl','group-ffl']){$(id).value='';$(id).placeholder='—';$(id).disabled=true;}
  const adjust=$('focal-adjust-surface'),old=adjust.value;adjust.replaceChildren();
  ids.forEach(i=>{const s=project.surfaces[i];if(Optics.surfaceType(s)==='prism')return;const option=document.createElement('option');option.value=i;option.textContent='Surface '+(i+1)+' · '+shapeName(s);adjust.append(option);});
  if([...adjust.options].some(o=>o.value===old))adjust.value=old;adjust.disabled=!adjust.options.length;
  $('fill-focal-range').hidden=ids.length<2||ids.at(-1)-ids[0]+1===ids.length;
  if(!ids.length){$('focal-note').textContent='Choose adjacent surfaces to analyse a lens or assembly. Thicknesses and internal air gaps are included.';return;}
  if(!$('fill-focal-range').hidden){$('focal-note').textContent='A physical group must be continuous. Include the intervening surfaces, or adjust the selection.';return;}
  if(!valid){$('focal-note').textContent='Correct the invalid prescription to calculate focal lengths.';return;}
  const f=Optics.groupFocal(project,ids[0],ids.at(-1));
  if(!f.supported){$('focal-note').textContent=f.reason;return;}
  for(const [id,key] of [['group-efl','efl'],['group-bfl','backFocalDistance'],['group-ffl','frontFocalDistance']]){$(id).value=focalValue(f[key]);$(id).disabled=adjust.disabled;}
  $('focal-note').textContent='Paraxial, on-axis · input n='+fmt(f.nIn,5)+' → output n='+fmt(f.nOut,5)+'. BFL: from last vertex along outgoing axis; front focus: signed from first vertex along incoming axis (usually negative). EFL is measured from the principal plane. These are not finite-source best focus.';
}
for(const [id,metric] of [['group-efl','efl'],['group-bfl','backFocalDistance'],['group-ffl','frontFocalDistance']]){
  $(id).addEventListener('change',()=>applyFocalTarget(Number($('focal-adjust-surface').value),$(id).value,metric));
  $(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyFocalTarget(Number($('focal-adjust-surface').value),$(id).value,metric);}});
}
$('select-all-focal').addEventListener('click',()=>{project.surfaces.forEach(s=>focalSelection.add(s));renderTable();updateFocalReadouts();});
$('clear-focal').addEventListener('click',()=>{focalSelection.clear();renderTable();updateFocalReadouts();});
$('fill-focal-range').addEventListener('click',()=>{const ids=project.surfaces.map((s,i)=>focalSelection.has(s)?i:-1).filter(i=>i>=0);if(ids.length)for(let i=ids[0];i<=ids.at(-1);i++)focalSelection.add(project.surfaces[i]);renderTable();updateFocalReadouts();});
function update(){
  updateFocalReadouts();
  if(supplierUndo&&JSON.stringify(project)!==supplierUndo.after)supplierUndo=null;
  $('undo-supplier').hidden=!supplierUndo;
  syncEmission();
  $('side-title').textContent=project.name||'Untitled project';
  document.querySelectorAll('[data-wave]').forEach(b=>b.classList.toggle('selected',Math.abs(Number(b.dataset.wave)-project.wavelength)<.2));
  try{
    lastResult=Optics.bundle(project);
    const efl=Optics.paraxial(project);
    $('rms').textContent=lastResult.rms===null?'No rays':fmt(lastResult.rms*1000,2)+' µm';
    $('efl').textContent=efl===null?(project.surfaces.some(s=>Optics.surfaceType(s)==='prism')?'—':'Afocal'):fmt(efl,2)+' mm';
    $('throughput').textContent=lastResult.valid.length+' / '+lastResult.rays.length;
    $('focus').disabled=false;$('export').disabled=false;
    const blocked=lastResult.rays.filter(r=>r.status!=='ok'), counts={};blocked.forEach(r=>counts[r.status]=(counts[r.status]||0)+1);
    let text=blocked.length ? 'Trace complete · '+Object.entries(counts).map(([k,v])=>v+' '+k).join(' · ')+'.' : 'Trace complete · all 401 sampled rays reach the image plane.';
    try{localStorage.setItem('reorbit.project.v1',JSON.stringify(project));storageOK=true;}catch{storageOK=false;}
    if(!storageOK) text+=' Browser storage unavailable; export JSON to keep your work.';
    message(text,blocked.length===lastResult.rays.length);
    draw();
  }catch(e){
    lastResult=null;message(e.message,true);$('rms').textContent='—';$('efl').textContent='—';$('throughput').textContent='—';$('focus').disabled=true;$('export').disabled=true;clearPlots();
  }
}
function context(id){
  const canvas=$(id), rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
  canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);return {ctx,w:rect.width,h:rect.height};
}
function clearPlots(){for(const id of ['layout','spot']){const {ctx,w,h}=context(id);ctx.fillStyle='#8b9580';ctx.font='11px Segoe UI';ctx.textAlign='center';ctx.fillText('Adjust the prescription to resume the trace.',w/2,h/2);} $('spot-scale').textContent='';}
function draw(){if(!lastResult){clearPlots();return;}drawLayout();drawSpot();}
function drawLayout(){
  const {ctx,w,h}=context('layout'),surfaces=Optics.geometry(project),imageFrame=surfaces.at(-1).outgoing;
  const aperture=Math.max(project.pupil,...surfaces.map(s=>s.diameter));
  const rays=Optics.meridionalRays(project);
  const surfaceCurves=surfaces.map(s=>Array.from({length:81},(_,i)=>{const v=(2*i/80-1)*s.diameter/2;return Optics.worldPoint(s.frame,[Optics.surfaceSag(s,v),v,0]);}));
  const imageHalf=Math.max(aperture/2,...rays.filter(r=>r.status==='ok').map(r=>Math.abs(r.imageLocal[1])),1)*1.1;
  const imageLine=[-imageHalf,imageHalf].map(v=>Optics.worldPoint(imageFrame,[project.imageDistance,v,0]));
  const points=[...rays.flatMap(r=>r.points),...surfaceCurves.flat(),...imageLine];
  const minZ=Math.min(...points.map(p=>p[0]))-4,maxZ=Math.max(...points.map(p=>p[0]))+4,minX=Math.min(...points.map(p=>p[1]))-3,maxX=Math.max(...points.map(p=>p[1]))+3;
  const span=maxZ-minZ,spanX=maxX-minX,scale=Math.min((w-50)/span,(h-70)/spanX);
  const x=z=>25+(w-50-span*scale)/2+(z-minZ)*scale,y=v=>20+(h-70-spanX*scale)/2+(maxX-v)*scale;
  // Grid spacing adapts to the actual scale. Both axes use the same mm scale.
  const desired=40/scale, base=10**Math.floor(Math.log10(desired)), grid=[1,2,5,10].map(v=>v*base).find(v=>v>=desired);
  ctx.lineWidth=.6;ctx.strokeStyle='#eaf0e0';
  for(let z=Math.ceil(minZ/grid)*grid;z<=maxZ;z+=grid){ctx.beginPath();ctx.moveTo(x(z),20);ctx.lineTo(x(z),h-35);ctx.stroke();}
  for(let v=Math.ceil(minX/grid)*grid;v<=maxX;v+=grid){ctx.beginPath();ctx.moveTo(20,y(v));ctx.lineTo(w-20,y(v));ctx.stroke();}
  ctx.strokeStyle='#bac5ac';ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(20,y(0));ctx.lineTo(w-20,y(0));ctx.stroke();ctx.setLineDash([]);
  function curve(index,reverse=false){const p=surfaceCurves[index].map(p=>[x(p[0]),y(p[1])]);return reverse?p.reverse():p;}
  surfaces.forEach((s,i)=>{
    if(s.material!=='AIR' && surfaces[i+1]){
      const points=[...curve(i),...curve(i+1,true)];ctx.beginPath();points.forEach((p,j)=>j?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle='#c6dccb70';ctx.fill();
    }
  });
  rays.forEach((r,i)=>{ctx.strokeStyle=i===5?'#c98649':r.status==='ok'?'#8da64c99':'#bd805b77';ctx.lineWidth=i===5?1.4:1;ctx.beginPath();r.points.forEach((p,j)=>j?ctx.lineTo(x(p[0]),y(p[1])):ctx.moveTo(x(p[0]),y(p[1])));ctx.stroke();});
  if(emission(project).mode==='point') {
    const sx=x(-emission(project).distance),sy=y(0);ctx.fillStyle='#c57949';ctx.beginPath();ctx.arc(sx,sy,4,0,2*Math.PI);ctx.fill();ctx.font='8px Segoe UI';ctx.textAlign='left';ctx.fillText('SOURCE',sx-10,sy-13);
  }
  surfaces.forEach((s,i)=>{ctx.strokeStyle=Optics.isMirror(s)?'#bc804b':'#52846c';ctx.lineWidth=Optics.isMirror(s)?2.8:1.6;ctx.beginPath();curve(i).forEach((p,j)=>j?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();ctx.fillStyle='#83947c';ctx.font='8px Consolas';ctx.textAlign='center';const end=surfaceCurves[i].at(-1);ctx.fillText((Optics.isMirror(s)?'M':'S')+(i+1),x(end[0]),Math.max(16,y(end[1])-10));});
  ctx.strokeStyle='#7a9db0';ctx.lineWidth=1.1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(x(imageLine[0][0]),y(imageLine[0][1]));ctx.lineTo(x(imageLine[1][0]),y(imageLine[1][1]));ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#8296a0';ctx.font='8px Segoe UI';ctx.textAlign='center';ctx.fillText('IMAGE',Math.min(w-25,x(imageLine[1][0])),Math.max(16,y(imageLine[1][1])-8));
  const bar=grid*scale;ctx.strokeStyle='#87967a';ctx.beginPath();ctx.moveTo(25,h-42);ctx.lineTo(25+bar,h-42);ctx.stroke();ctx.textAlign='left';ctx.fillStyle='#86947b';ctx.fillText(fmt(grid)+' mm',25,h-48);
  $('layout-caption').textContent=$('emission-summary').textContent;
}
function drawSpot(){
  const {ctx,w,h}=context('spot'),r=lastResult;
  if(!r.valid.length){ctx.fillStyle='#8b9580';ctx.textAlign='center';ctx.font='11px Segoe UI';ctx.fillText('No rays reach the image plane.',w/2,h/2);$('spot-scale').textContent='';return;}
  const limit=Math.max(.001,...r.valid.map(ray=>Math.hypot(ray.imageLocal[1]-r.centroid[0],ray.imageLocal[2]-r.centroid[1])))*1.2;
  const size=Math.min(w-60,h-35),scale=size/(2*limit),cx=w/2,cy=h/2;
  ctx.strokeStyle='#e3e9da';ctx.lineWidth=.8;
  for(const radius of [.5,1]){ctx.beginPath();ctx.arc(cx,cy,size/2*radius,0,Math.PI*2);ctx.stroke();}
  ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(cx-size/2-8,cy);ctx.lineTo(cx+size/2+8,cy);ctx.moveTo(cx,cy-size/2-8);ctx.lineTo(cx,cy+size/2+8);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#668a42a0';for(const ray of r.valid){ctx.beginPath();ctx.arc(cx+(ray.imageLocal[1]-r.centroid[0])*scale,cy-(ray.imageLocal[2]-r.centroid[1])*scale,1.5,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#bc814d';ctx.fillRect(cx-2,cy-2,4,4);ctx.font='8px Segoe UI';ctx.fillStyle='#89947e';ctx.fillText('x',cx+size/2+10,cy+3);ctx.fillText('y',cx+4,cy-size/2-10);
  $('spot-scale').textContent='Outer radius '+fmt(limit*1000,1)+' µm';
}
for(const key of ['name','wavelength','pupil','field','imageDistance']) $(key).addEventListener('input',()=>{project[key]=key==='name'?$(key).value:($(key).value===''?NaN:Number($(key).value));update();});
document.querySelectorAll('[data-wave]').forEach(b=>b.addEventListener('click',()=>{project.wavelength=Number(b.dataset.wave);$('wavelength').value=project.wavelength;update();}));
$('focus').addEventListener('click',()=>{try{project.imageDistance=Optics.bestFocus(project);$('imageDistance').value=Number(project.imageDistance.toFixed(6));update();message('Best geometric focus found · image distance '+fmt(project.imageDistance,6)+' mm.');}catch(e){message(e.message,true);}});
$('preset').addEventListener('change',()=>{project=clone(presets[$('preset').value]);mount();message('Loaded an illustrative example. Save JSON to keep a prescription before switching examples.');});
$('add').addEventListener('click',()=>{if(project.surfaces.length>=24)return;const prev=project.surfaces.at(-1);prev.thickness=10;project.surfaces.push({radius:0,thickness:0,material:'AIR',diameter:prev.diameter});renderTable();update();});
$('export').addEventListener('click',()=>{try{Optics.validate(project);const blob=new Blob([JSON.stringify({format:'reorbit-optics',version:1,...project},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(project.name||'reorbit-project').replace(/[^a-z0-9_-]/gi,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Project exported as JSON.');}catch(e){message(e.message,true);}});
$('import').addEventListener('click',()=>$('file').click());
$('file').addEventListener('change',async()=>{
  const file=$('file').files[0];if(!file)return;
  try{if(file.size>1000000)throw new Error('Project files must be smaller than 1 MB.');const raw=JSON.parse(await file.text());if(raw.format!=='reorbit-optics'||raw.version!==1)throw new Error('Choose a ReOrbit v1 project JSON.');const p={name:typeof raw.name==='string'?raw.name.slice(0,80):'Imported project',wavelength:raw.wavelength,pupil:raw.pupil,field:raw.field,imageDistance:raw.imageDistance,surfaces:raw.surfaces,...(raw.emission!==undefined?{emission:raw.emission}:{})};Optics.validate(p);project=p;mount();message('Project opened · '+project.name);}catch(e){message('Could not open project: '+e.message,true);}finally{$('file').value='';}
});
$('emission').addEventListener('click',()=>{syncEmission();$('emission-dialog').showModal();});
$('close-emission').addEventListener('click',()=>$('emission-dialog').close());
$('fill-lens').addEventListener('click',()=>{
  try{project=Optics.fillFirstLens(project);$('field').value=project.field;update();message('Emitter centred · cone set to cover the first lens.');}
  catch(e){message(e.message,true);}
});
for(const [id,key] of [['source-mode','mode'],['source-distance','distance'],['source-cone','halfAngle']]){
  $(id).addEventListener(key==='mode'?'change':'input',()=>{
    project.emission={...emission(project),[key]:key==='mode'?$(id).value:($(id).value===''?NaN:Number($(id).value))};update();
  });
}
for(const [id,key] of [['source-wavelength','wavelength'],['source-angle','field']]){
  $(id).addEventListener('input',()=>{project[key]=$(id).value===''?NaN:Number($(id).value);$(key).value=project[key];update();});
}
$('about').addEventListener('click',()=>$('model').showModal());$('close-model').addEventListener('click',()=>$('model').close());
function supplierPositions(){
  const select=$('supplier-position');select.replaceChildren();
  for(let i=0;i<=project.surfaces.length;i++){
    if(i>0&&project.surfaces[i-1].material!=='AIR')continue;
    const option=document.createElement('option');option.value=i;
    option.textContent=i===0?'Before surface 1':i===project.surfaces.length?'After final surface '+i:'Between surfaces '+i+' and '+(i+1);
    select.append(option);
  }
  select.value=project.surfaces.length;
}
function supplierCandidate(){
  return Zemax.insert(project,supplierReport,Number($('supplier-position').value),$('supplier-before').value===''?NaN:Number($('supplier-before').value),$('supplier-after').value===''?NaN:Number($('supplier-after').value));
}
function checkSupplierInsertion(){
  const position=Number($('supplier-position').value);
  $('supplier-before').disabled=position===0;$('supplier-after').disabled=position===project.surfaces.length;
  $('insert-supplier-confirm').disabled=true;
  if(!supplierReport?.canImport){$('supplier-insert-error').textContent='';return;}
  try{supplierCandidate();$('supplier-insert-error').textContent='';$('insert-supplier-confirm').disabled=false;}
  catch(e){$('supplier-insert-error').textContent=e.message;}
}
function renderSupplierReport(){
  const report=supplierReport;
  $('supplier-rows').replaceChildren();$('supplier-errors').replaceChildren();$('supplier-warnings').replaceChildren();
  $('supplier-preview').hidden=!report;
  if(!report){$('supplier-file-name').textContent='No file selected';checkSupplierInsertion();return;}
  $('supplier-file-name').textContent=report.filename;
  $('supplier-title').textContent=report.name;
  $('supplier-summary').textContent=report.surfaces.length+' physical surfaces · source units '+(report.units||'unknown')+' → mm · '+(report.encoding||'text');
  for(const s of report.surfaces){
    const row=document.createElement('tr');
    for(const value of [s.supplier.surface+(Optics.surfaceType(s)==='asphere'?' · asphere':''),s.radius===0?'Plane':fmt(s.radius,6),fmt(s.thickness,6),Optics.isMirror(s)?'MIRROR':s.material,fmt(s.diameter,6)]){
      const cell=document.createElement('td');cell.textContent=value;row.append(cell);
    }
    $('supplier-rows').append(row);
    if(Optics.surfaceType(s)==='asphere'){
      const details=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=5;cell.className='asphere-preview';
      cell.textContent='k = '+s.conic+' · '+s.coefficients.map((v,j)=>'A'+(2*j+2)+' = '+v.toExponential(6)).join(' · ');details.append(cell);$('supplier-rows').append(details);
    }
  }
  for(const [id,items] of [['supplier-errors',report.errors],['supplier-warnings',report.warnings]]){
    for(const text of items.slice(0,40)){const li=document.createElement('li');li.textContent=text;$(id).append(li);}
    if(items.length>40){const li=document.createElement('li');li.textContent=(items.length-40)+' additional diagnostics omitted.';$(id).append(li);}
  }
  checkSupplierInsertion();
}
$('supplier').addEventListener('click',()=>{supplierPositions();renderSupplierReport();$('supplier-dialog').showModal();});
$('close-supplier').addEventListener('click',()=>$('supplier-dialog').close());
$('choose-supplier').addEventListener('click',()=>$('supplier-file').click());
for(const id of ['supplier-position','supplier-before','supplier-after'])$(id).addEventListener(id==='supplier-position'?'change':'input',checkSupplierInsertion);
$('supplier-file').addEventListener('change',async()=>{
  const file=$('supplier-file').files[0];if(!file)return;
  try{
    if(!/\.zmx$/i.test(file.name))throw new Error('Choose a Zemax text .zmx file. Binary .zos and .zar archives cannot be imported.');
    if(file.size>1000000)throw new Error('ZMX files must be smaller than 1 MB.');
    const decoded=Zemax.decode(await file.arrayBuffer());supplierReport={...Zemax.parse(decoded.text,file.name),encoding:decoded.encoding};
  }catch(e){supplierReport={filename:file.name,name:'Could not read this file',units:null,surfaces:[],warnings:[],errors:[e.message],canImport:false};}
  finally{$('supplier-file').value='';renderSupplierReport();}
});
$('insert-supplier-confirm').addEventListener('click',()=>{
  try{
    const before=clone(project),next=supplierCandidate();project=next;supplierUndo={before,after:JSON.stringify(next)};
    mount();$('supplier-dialog').close();message('Inserted '+supplierReport.name+' · '+supplierReport.surfaces.length+' surfaces. Undo insertion is available until the next edit.');
  }catch(e){$('supplier-insert-error').textContent=e.message;}
});
$('undo-supplier').addEventListener('click',()=>{
  if(!supplierUndo)return;
  if(JSON.stringify(project)!==supplierUndo.after){supplierUndo=null;$('undo-supplier').hidden=true;return;}
  project=supplierUndo.before;supplierUndo=null;mount();message('Optic insertion undone.');
});
function configureShapeControls(){
  const type=$('shape-type').value;
  $('shape-asphere').hidden=type!=='asphere';$('shape-prism').hidden=type!=='prism';
}
function openSurfaceShape(index){
  editingSurface=index;const s=project.surfaces[index];
  $('shape-title').textContent='Surface '+(index+1)+' · shape';$('shape-type').value=Optics.surfaceType(s);
  $('shape-interaction').value=Optics.isMirror(s)?'reflect':'refract';
  $('shape-conic').value=s.conic||0;$('shape-tilt').value=s.tilt||0;
  for(let j=0;j<8;j++)$('shape-a'+(2*j+2)).value=s.coefficients?.[j]||0;
  $('shape-error').textContent='';configureShapeControls();$('shape-dialog').showModal();
}
$('shape-type').addEventListener('change',configureShapeControls);
$('close-shape').addEventListener('click',()=>$('shape-dialog').close());
$('apply-shape').addEventListener('click',()=>{
  try{
    if(editingSurface===null||!project.surfaces[editingSurface])throw new Error('Choose a surface first.');
    const next=clone(project),s=next.surfaces[editingSurface],type=$('shape-type').value;
    const read=id=>$(id).value===''?NaN:Number($(id).value);
    s.type=type;s.conic=0;s.coefficients=[];s.tilt=0;
    s.interaction=$('shape-interaction').value;
    if(s.interaction==='reflect')s.material=editingSurface===0?'AIR':next.surfaces[editingSurface-1].material;
    if(type==='asphere'){s.conic=read('shape-conic');s.coefficients=Array.from({length:8},(_,j)=>read('shape-a'+(2*j+2)));}
    if(type==='prism'){s.radius=0;s.tilt=read('shape-tilt');}
    Optics.validate(next);project=next;mount();$('shape-dialog').close();message('Updated surface '+(editingSurface+1)+' · '+shapeName(s)+'.');
  }catch(e){$('shape-error').textContent=e.message;}
});
function configureOptic(){const kind=$('optic-kind').value,mirror=kind==='mirror';$('optic-asphere').hidden=kind!=='asphere';$('optic-prism').hidden=kind!=='prism';$('optic-mirror').hidden=!mirror;$('optic-glass-label').hidden=mirror;$('optic-thickness-label').hidden=mirror;$('optic-glass').textContent=opticMaterial+' · Search glass ⌕';$('optic-error').textContent='';configureMirror();}
function configureMirror(){const kind=$('mirror-profile').value;$('mirror-tilt-label').hidden=kind!=='plane';$('mirror-radius-label').hidden=kind==='plane';$('mirror-conic-label').hidden=kind!=='asphere';}
$('add-optic').addEventListener('click',()=>{configureOptic();$('optic-dialog').showModal();});
$('optic-kind').addEventListener('change',()=>{if($('optic-kind').value==='mirror')$('optic-gap').value=50;configureOptic();});
$('mirror-profile').addEventListener('change',configureMirror);
$('close-optic').addEventListener('click',()=>$('optic-dialog').close());
$('insert-optic').addEventListener('click',()=>{
  try{
    const read=id=>$(id).value===''?NaN:Number($(id).value),diameter=read('optic-diameter'),thickness=read('optic-thickness'),kind=$('optic-kind').value,prism=kind==='prism';
    let surfaces;
    if(kind==='mirror'){
      const profile=$('mirror-profile').value;
      surfaces=[{interaction:'reflect',type:profile==='plane'?'prism':profile==='asphere'?'asphere':'standard',radius:profile==='plane'?0:read('mirror-radius'),tilt:profile==='plane'?read('mirror-tilt'):0,conic:profile==='asphere'?read('mirror-conic'):0,coefficients:[],thickness:0,diameter,material:'AIR'}];
    }else if(prism){const apex=read('optic-apex');if(!Number.isFinite(apex)||apex<=0||apex>60)throw new Error('Use a prism apex angle greater than 0 and at most 60°.');
      surfaces=[{type:'prism',radius:0,tilt:-apex/2,thickness,diameter,material:opticMaterial},{type:'prism',radius:0,tilt:apex/2,thickness:0,diameter,material:'AIR'}];
    }else surfaces=[{type:'asphere',radius:read('optic-radius'),conic:read('optic-conic'),coefficients:[0,read('optic-a4'),0,0,0,0,0,0],thickness,diameter,material:opticMaterial},{radius:0,thickness:0,diameter,material:'AIR'}];
    const before=clone(project),next=Zemax.insert(project,{canImport:true,errors:[],surfaces},project.surfaces.length,read('optic-gap'));
    project=next;supplierUndo={before,after:JSON.stringify(next)};mount();$('optic-dialog').close();message('Added '+(kind==='mirror'?'ideal mirror':prism?'refracting wedge prism':'plano-aspheric lens')+' · edit each face using its shape button.');
  }catch(e){$('optic-error').textContent=e.message;}
});
function openGlassPicker(target){
  glassTarget=target;glassLimit=12;$('glass-search').value='';$('glass-error').textContent='';
  $('glass-title').textContent=target.kind==='surface'?'Material after surface '+(target.index+1):'Glass for the new optic';
  $('glass-target-note').textContent=target.kind==='surface'&&target.index===project.surfaces.length-1?'The final surface must exit into AIR.':'Choose the medium immediately after this surface. Indices update at the current wavelength.';
  renderGlassResults();$('glass-dialog').showModal();$('glass-search').focus();
}
function renderGlassResults(){
  const matches=GlassCatalog.search($('glass-search').value),current=glassTarget?.kind==='surface'?project.surfaces[glassTarget.index]?.material:opticMaterial;
  $('glass-results').replaceChildren();$('glass-more').hidden=matches.length<=glassLimit;
  $('glass-count').textContent=matches.length+' matches · '+GlassCatalog.edition+' · '+(GlassCatalog.list.length-1)+' glasses + AIR';
  $('glass-wave').textContent=fmt(project.wavelength,2)+' nm';
  for(const g of matches.slice(0,glassLimit)){
    const row=document.createElement('tr');row.classList.toggle('selected-glass',g.name===current);
    const name=document.createElement('td'),strong=document.createElement('strong'),description=document.createElement('small');strong.textContent=g.name;description.textContent=g.manufacturer+(g.description?' · '+g.description:'');name.append(strong,description);row.append(name);
    const ncell=document.createElement('td');let issue='';try{ncell.textContent=fmt(GlassCatalog.index(g.name,project.wavelength),6);}catch(e){ncell.textContent='Outside range';issue=e.message;}row.append(ncell);
    const properties=document.createElement('td');properties.textContent=fmt(g.nd,5)+' / '+(g.vd===null?'—':fmt(g.vd,2));row.append(properties);
    const range=document.createElement('td');range.textContent=fmt(g.rangeNm[0],1)+'–'+fmt(g.rangeNm[1],1)+' nm';row.append(range);
    const action=document.createElement('td'),use=document.createElement('button');use.textContent=g.name===current?'Selected':'Use';use.setAttribute('aria-label','Use '+g.name);
    if(glassTarget?.kind==='optic'&&g.name==='AIR')issue='Choose a glass for this optical element.';
    if(glassTarget?.kind==='surface'&&glassTarget.index===project.surfaces.length-1&&g.name!=='AIR')issue='The final surface must exit into AIR.';
    use.disabled=!!issue;use.title=issue||'Use '+g.name;use.addEventListener('click',()=>chooseGlass(g.name));action.append(use);row.append(action);$('glass-results').append(row);
  }
  $('glass-empty').hidden=matches.length>0;
}
function chooseGlass(name){
  try{
    GlassCatalog.index(name,project.wavelength);
    if(glassTarget.kind==='optic'){opticMaterial=name;configureOptic();}
    else{
      const next=clone(project);next.surfaces[glassTarget.index].material=name;Optics.validate(next);project=next;mount();message('Surface '+(glassTarget.index+1)+' now exits into '+name+'.');
    }
    $('glass-dialog').close();
  }catch(e){$('glass-error').textContent=e.message;}
}
$('glass-search').addEventListener('input',()=>{glassLimit=12;renderGlassResults();});
$('glass-more').addEventListener('click',()=>{glassLimit+=24;renderGlassResults();});
$('close-glass').addEventListener('click',()=>$('glass-dialog').close());
$('optic-glass').addEventListener('click',()=>openGlassPicker({kind:'optic'}));
$('beam-report').addEventListener('click',()=>{
  $('beam-report-rows').replaceChildren();$('beam-report-error').textContent='';
  try{
    const d=Optics.beamDiagnostics(project),f=Optics.imageFrame(project);
    const rows=[['Wavelength',fmt(project.wavelength,2)+' nm'],['Rays reaching image',d.raysReachingImage+' / '+d.raysLaunched+' geometric samples'],['Outgoing angular RMS spread',fmt(d.outgoingAngularRmsMrad,6)+' mrad'],['Sampled ray-envelope diameter',fmt(d.sampledEnvelopeDiameterMm,6)+' mm'],['RMS radius at image plane',fmt(d.beamRmsRadiusMm,6)+' mm'],['Image distance along outgoing axis',fmt(project.imageDistance,4)+' mm'],['Nominal outgoing axis (world z, x, y)',f.zAxis.map(v=>fmt(v,4)).join(', ')]];
    for(const [label,value] of rows){const row=document.createElement('tr');for(const text of [label,value]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}$('beam-report-rows').append(row);}
    if(!d.raysReachingImage)$('beam-report-error').textContent='No rays reach the image plane; adjust the prescription before interpreting beam metrics.';
  }catch(e){$('beam-report-error').textContent=e.message;}
  $('beam-report-dialog').showModal();
});
$('close-beam-report').addEventListener('click',()=>$('beam-report-dialog').close());
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(draw,100);});
mount();
