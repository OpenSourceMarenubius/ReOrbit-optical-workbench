/* ReOrbit's deliberately bounded sequential ZMX reader. No vendor runtime required. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./engine.js'):root.Optics);
  if(typeof module==='object'&&module.exports) module.exports=api;else root.Zemax=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Optics){
  'use strict';
  const scales={MM:1,CM:10,M:1000,IN:25.4,INCH:25.4};
  const numeric=(s,label)=>{
    if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eEdD][+-]?\d+)?$/.test(s||'')) throw new Error(label+': expected a finite number.');
    const n=Number(s.replace(/[dD]/,'e'));if(!Number.isFinite(n))throw new Error(label+': number is out of range.');return n;
  };
  function decode(buffer){
    const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
    if(bytes.length>1000000)throw new Error('ZMX files must be smaller than 1 MB.');
    if(!bytes.length)throw new Error('The lens file is empty.');
    let encoding='utf-8';
    if(bytes[0]===255&&bytes[1]===254)encoding='utf-16le';
    else if(bytes[0]===254&&bytes[1]===255)encoding='utf-16be';
    else if(bytes.length>4&&bytes[1]===0&&bytes[3]===0)encoding='utf-16le';
    else if(bytes.length>4&&bytes[0]===0&&bytes[2]===0)encoding='utf-16be';
    let text;
    try{text=new TextDecoder(encoding,{fatal:true}).decode(bytes);}
    catch{throw new Error('Cannot decode this file. Use a UTF-8 or UTF-16 Zemax text .zmx file.');}
    if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))throw new Error('This is not a supported text lens file. Binary ZOS, archives and encrypted models are not supported.');
    return {text,encoding};
  }
  function parse(text,filename='supplier.zmx'){
    const errors=[],warnings=new Set(),raw=[];
    let current=null,unit=null,title='',mode='SEQ';
    const error=(line,s)=>errors.push('Line '+line+': '+s);
    const metadata=new Set(('VERS NAME NOTE UNIT MODE ENPD ENVD GFAC GCAT RAIM FTYP ROPD HYPR PICB XFLN YFLN XFLD YFLD FWGN FWGT VDXN VDYN VCXN VCYN VANN WAVM WAVL WWGT PWAV WAVN POLS POCO POLA GLRS GSTD COFN FIMP RGLA EFFL RAGF LANG TRAC PUSH POPS OPDX PUPD OBNA FNUM FLOA PMAG TOTR MNCA MNEA MNCG MNEG MXCA MXCG DMFS TCMM TOLE TOL').split(' '));
    if(typeof text!=='string'||text.length>1000000)throw new Error('Invalid or oversized ZMX text.');
    if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))throw new Error('The file contains binary data, not supported ZMX text.');
    text.replace(/^\uFEFF/,'').split(/\r?\n|\r/).forEach((line,index)=>{
      const n=index+1,lineText=line.trim();if(!lineText||lineText.startsWith('!')||lineText.startsWith('#'))return;
      const match=/^(\S+)(?:\s+(.*))?$/.exec(lineText),key=match[1].toUpperCase(),value=(match[2]||'').trim();
      const tokens=Array.from(value.matchAll(/"([^"]*)"|([^\s"]+)/g),m=>m[1]!==undefined?m[1]:m[2]);
      try{
        if(key==='SURF'){
          const id=numeric(tokens[0],'Surface number');
          if(!Number.isInteger(id)||id<0||raw.length>30)throw new Error('Invalid surface number or too many surfaces.');
          if(raw.length&&id!==raw.at(-1).id+1)throw new Error('Surface numbers must be consecutive, starting with object SURF 0.');
          if(!raw.length&&id!==0)throw new Error('A complete file must start with object SURF 0.');
          current={id,line:n,type:'STANDARD',curvature:null,distance:null,semiDiameter:null,material:'AIR',comment:'',conic:0,coefficients:Array(8).fill(0),seen:new Set()};raw.push(current);return;
        }
        if(key==='UNIT'){
          if(unit!==null)throw new Error('Multiple UNIT records are not supported.');
          unit=(tokens[0]||'').toUpperCase();if(!scales[unit])throw new Error('Unsupported units '+unit+'. Use MM, CM, M or IN.');return;
        }
        if(key==='NAME'){title=value.replace(/^"|"$/g,'');return;}
        if(key==='MODE'){mode=(tokens[0]||'').toUpperCase();if(!['SEQ','SEQUENTIAL'].includes(mode))throw new Error('Only sequential lens files are supported.');return;}
        if(key==='MNUM'){
          if(numeric(tokens[0],'Configuration count')!==1)throw new Error('Multiple configurations are not supported.');return;
        }
        if(['CONF','MOFF','NSCD','NSOH','NSOO','NSOA','NSOP','NSOC','NSOD','NSOE'].includes(key))throw new Error('Unsupported configuration or non-sequential record '+key+'.');
        if(metadata.has(key))return;
        if(!current)throw new Error('Unrecognised header record '+key+'.');
        if(['TYPE','CURV','DISZ','GLAS','DIAM','CONI'].includes(key)){
          if(current.seen.has(key))throw new Error('Duplicate '+key+' record on surface '+current.id+'.');
          current.seen.add(key);
        }
        if(key==='TYPE'){
          current.type=(tokens[0]||'').toUpperCase();if(!['STANDARD','EVENASPH'].includes(current.type))throw new Error('Surface '+current.id+': '+current.type+' is unsupported; use STANDARD or EVENASPH surfaces.');
        }else if(key==='CURV')current.curvature=numeric(tokens[0],'Curvature');
        else if(key==='DISZ')current.distance=/^[+-]?INF(?:INITY)?$/i.test(tokens[0])?(tokens[0].startsWith('-')?-Infinity:Infinity):numeric(tokens[0],'Thickness');
        else if(key==='DIAM'){
          current.semiDiameter=numeric(tokens[0],'Clear semi-diameter');
          if(tokens[1]!==undefined&&![0,1].includes(numeric(tokens[1],'Aperture type')))throw new Error('Non-circular aperture on surface '+current.id+' is unsupported.');
          if(tokens.slice(2,4).some(t=>numeric(t,'Aperture offset')!==0))throw new Error('Decentred aperture on surface '+current.id+' is unsupported.');
        }else if(key==='GLAS'){
          current.material=(tokens[0]||'AIR').toUpperCase();
          if(current.material==='MIRROR'){current.mirror=true;return;}
          const glass=Optics.materials.get(current.material);
          if(!glass)throw new Error('Surface '+current.id+': glass '+current.material+' is unsupported. No glass substitution is made.');
          current.material=glass.name;
          if(tokens[1]!==undefined&&numeric(tokens[1],'Glass solve')!==0)throw new Error('Glass solves/model glasses are unsupported.');
        }else if(key==='CONI'){
          current.conic=numeric(tokens[0],'Conic constant');
        }else if(key==='PARM'){
          const parameter=numeric(tokens[0],'Parameter number'),value=numeric(tokens[1],'Surface parameter');
          if(!Number.isInteger(parameter)||parameter<1||parameter>8)throw new Error('Only even-asphere parameters 1–8 (A2–A16) are supported.');
          if(current.seen.has('PARM '+parameter))throw new Error('Duplicate PARM '+parameter+' on surface '+current.id+'.');
          current.seen.add('PARM '+parameter);current.coefficients[parameter-1]=value;
        }else if(key==='COMM')current.comment=value.replace(/^"|"$/g,'');
        else if(key==='STOP')warnings.add('STOP surfaces are traced as apertures only; Zemax stop/pupil solving is not imported.');
        else if(key==='COAT')warnings.add('Coatings are recorded as a notice only; coating transmission and phase are not modelled.');
        else if(['MEMA','SDMA','SLAB','DRAW'].includes(key))warnings.add('Mechanical/drawing data are not imported; DIAM defines the traced clear aperture.');
        else if(key==='HIDE'){
          if(tokens.some(t=>numeric(t,'Surface flags')!==0))throw new Error('Non-default HIDE/ignore-surface flags are unsupported.');
        }else if(key==='OBDC'){
          if(tokens.some(t=>numeric(t,'Aperture offset')!==0))throw new Error('Decentred apertures are unsupported.');
        }else throw new Error('Unsupported record '+key+' on/after surface '+current.id+'. Import stopped to avoid losing optical behaviour.');
      }catch(e){error(n,e.message);}
    });
    if(unit===null)errors.push('Missing UNIT record; units will not be guessed.');
    if(raw.length<3)errors.push('A supplier optic file must include object SURF 0, a physical surface, and a final image surface.');
    if(raw.length>=2){
      for(const [label,s] of [['Object',raw[0]],['Image',raw.at(-1)]]){
        if(s.type!=='STANDARD'||s.curvature!==0||s.material!=='AIR'||s.conic!==0||s.coefficients.some(v=>v!==0))errors.push(label+' surface must be a STANDARD plane in AIR; it is not inserted.');
      }
    }
    const scale=scales[unit]||1,body=raw.slice(1,-1);let parity=1,medium='AIR';
    const surfaces=body.map((s,i)=>{
      if(s.curvature===null)errors.push('Surface '+s.id+': missing CURV record.');
      if(s.distance===null)errors.push('Surface '+s.id+': missing DISZ record.');
      if(!(s.semiDiameter>0))errors.push('Surface '+s.id+': a positive DIAM clear semi-diameter is required.');
      const radiusSign=parity;
      if(s.mirror){parity*=-1;s.material=medium;}else medium=s.material;
      if(i<body.length-1&&(!Number.isFinite(s.distance)||s.distance*parity<=0))errors.push('Surface '+s.id+': thickness sign must follow the Zemax mirror parity for a real path.');
      if(s.type==='STANDARD'&&s.coefficients.some(v=>v!==0))errors.push('Surface '+s.id+': polynomial coefficients require TYPE EVENASPH.');
      const aspheric=s.type==='EVENASPH'||s.conic!==0;
      return {radius:s.curvature===0?0:radiusSign*scale/s.curvature,thickness:i===body.length-1?0:Math.abs(s.distance)*scale,material:s.material,diameter:2*s.semiDiameter*scale,...(s.mirror?{interaction:'reflect'}:{}),...(aspheric?{type:'asphere',conic:s.conic,coefficients:s.coefficients.map((v,j)=>radiusSign*v*scale**(1-(2*j+2)))}:{}),supplier:{file:filename,title,surface:s.id,comment:s.comment}};
    });
    if(body.length&&!body.some(s=>s.mirror||(s.material!=='AIR'&&Optics.materials.get(s.material))))errors.push('No supported glass or mirror optic was found between object and image.');
    if(body.length&&body.at(-1).material!=='AIR')errors.push('The imported assembly must exit into AIR.');
    // COMM is descriptive, but never inject file text into HTML.
    warnings.add('Object/image surfaces and their external distances are omitted. Existing source, wavelength and image-distance settings are retained.');
    warnings.add('Saved numerical values are imported as fixed geometry; Zemax optimisation variables and system settings are not transferred.');
    if(body.some(s=>s.mirror))warnings.add('Mirrors are ideal specular reflectors. Signed Zemax distances/radii are converted to positive path spacings and incoming local surface frames; coordinate-break files remain unsupported.');
    if(!errors.length){
      try{Optics.validate({wavelength:587.6,pupil:1,field:0,imageDistance:100,surfaces});}
      catch(e){errors.push(e.message);}
    }
    return {filename,name:title||filename.replace(/\.zmx$/i,''),units:unit,scale,surfaces,warnings:[...warnings],errors:[...new Set(errors)],canImport:errors.length===0};
  }
  function insert(project,report,position,gapBefore=10,gapAfter=10){
    if(!report?.canImport||report.errors?.length||!report.surfaces?.length)throw new Error('Resolve the lens-file errors before inserting.');
    if(!Number.isInteger(position)||position<0||position>project.surfaces.length)throw new Error('Choose a valid insertion position.');
    if(position>0&&project.surfaces[position-1].material!=='AIR')throw new Error('Insert supplier lenses in an AIR gap, not inside glass.');
    if(position>0&&(!Number.isFinite(gapBefore)||gapBefore<=0||gapBefore>10000))throw new Error('Air gap before the lens must be greater than 0 and at most 10,000 mm.');
    if(position<project.surfaces.length&&(!Number.isFinite(gapAfter)||gapAfter<=0||gapAfter>10000))throw new Error('Air gap after the lens must be greater than 0 and at most 10,000 mm.');
    const next=JSON.parse(JSON.stringify(project)),addition=JSON.parse(JSON.stringify(report.surfaces));
    addition.at(-1).thickness=position<next.surfaces.length?gapAfter:0;
    if(position>0)next.surfaces[position-1].thickness=gapBefore;
    next.surfaces.splice(position,0,...addition);
    Optics.validate(next);return next;
  }
  return {decode,parse,insert};
});
