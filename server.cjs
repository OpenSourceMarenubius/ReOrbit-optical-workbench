const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const allowed = new Set(['/index.html','/styles.css','/glass-data.js','/glasses.js','/engine.js','/zemax.js','/app.js']);
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript'};
http.createServer((req,res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = pathname === '/' ? '/index.html' : pathname;
  if (!allowed.has(file)) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(root,file), (err,data) => {
    if (err) {res.writeHead(500);res.end('Unable to read file');return;}
    res.writeHead(200, {'Content-Type':types[path.extname(file)] + '; charset=utf-8','Cache-Control':'no-store'});
    res.end(data);
  });
}).listen(4173, '127.0.0.1', () => console.log('ReOrbit Optics: http://127.0.0.1:4173'));
