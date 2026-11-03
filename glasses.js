/* Searchable, offline optical-material catalogue and dispersion evaluator. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./glass-data.js'):root.GlassData);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.GlassCatalog=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(data){
  'use strict';
  const freeze=g=>Object.freeze({...g,B:g.B?Object.freeze([...g.B]):null,C:g.C?Object.freeze([...g.C]):null,rangeNm:Object.freeze([...g.rangeNm])});
  const air=freeze({name:'AIR',manufacturer:'Ideal medium',description:'Fixed refractive index n = 1',nd:1,vd:null,rangeNm:[380,1700]});
  const list=Object.freeze([air,...data.glasses.map(freeze)]),byName=new Map(list.map(g=>[g.name.toUpperCase(),g]));
  const normalise=value=>String(value??'').trim().toUpperCase();
  const get=name=>byName.get(normalise(name));
  function index(name,wavelength){
    const g=get(name);if(!g)throw new Error('Unsupported material: '+name+'. No catalogue match; no substitution was made.');
    if(g.name==='AIR')return 1;
    if(!Number.isFinite(wavelength)||wavelength<380||wavelength>1700)throw new Error('Wavelength must be 380–1700 nm.');
    if(wavelength<g.rangeNm[0]||wavelength>g.rangeNm[1])throw new Error(g.name+' dispersion is only valid from '+g.rangeNm[0]+' to '+g.rangeNm[1]+' nm. Choose a wavelength inside that range.');
    const l2=(wavelength/1000)**2;
    const n2=1+g.B.reduce((sum,b,i)=>sum+b*l2/(l2-g.C[i]),0);
    if(!Number.isFinite(n2)||n2<=0)throw new Error('Invalid refractive index for '+g.name+' at '+wavelength+' nm.');
    return Math.sqrt(n2);
  }
  function search(query=''){
    const compact=value=>String(value).toLowerCase().replace(/[^a-z0-9.]/g,'');
    const tokens=String(query).toLowerCase().trim().split(/\s+/).filter(Boolean).map(compact),exact=compact(query);
    const favourites=['AIR','N-BK7','N-SF11','N-BAF10','N-F2','F2','SF2','N-SF6','N-BAK4','N-SK16'];
    const rank=g=>exact&&compact(g.name)===exact?-2:exact&&compact(g.name).startsWith(exact)?-1:favourites.includes(g.name)?favourites.indexOf(g.name):100;
    return list.filter(g=>tokens.every(t=>compact(g.name+' '+g.manufacturer+' '+g.description).includes(t))).sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name));
  }
  return {list,get,index,search,edition:data.edition,source:data.source,excluded:data.excluded};
});
