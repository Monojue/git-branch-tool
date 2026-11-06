// Serves the built demo (demo/) the way a static host would, to try it before publishing.
//   Run:  npm run demo        then open http://localhost:4790  (Ctrl+C to stop)
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'demo'), PORT = +process.env.PORT || 4790;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.ico': 'image/x-icon' };
if (!fs.existsSync(path.join(DIR, 'index.html'))) { console.error('demo/ is missing: run  npm run build-demo  first'); process.exit(1); }

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(DIR, path.normalize(p));
  if (!f.startsWith(DIR + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Demo: ${url}   (Ctrl+C to stop)`);
  if (process.argv.includes('--open')) {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]];
    require('child_process').spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref();
  }
});
