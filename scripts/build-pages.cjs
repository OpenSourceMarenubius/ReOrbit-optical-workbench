// Publish only the browser runtime; no reports, sources or local project files.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),out=path.join(root,'_site');
fs.mkdirSync(out,{recursive:true});
const files=['index.html','styles.css','app.js','engine.js','zemax.js','glasses.js','glass-data.js'];
for(const name of files)fs.copyFileSync(path.join(root,name),path.join(out,name));
fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log(`Prepared ${files.length} runtime files for GitHub Pages.`);
