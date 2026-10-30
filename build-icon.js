// Render icon.svg to icon.png (256 px) and icon.ico (16–256 px) with headless Edge.
//   node build-icon.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
if (!edge) { console.error('Microsoft Edge not found'); process.exit(1); }
const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gbt-icon-'));

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = sizes.map(size => {
  const html = path.join(tmp, `i${size}.html`), png = path.join(tmp, `i${size}.png`);
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  try {
    execFileSync(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
      `--window-size=${size},${size}`, `--screenshot=${png}`, 'file:///' + html.replace(/\\/g, '/')], { stdio: 'ignore', timeout: 60000 });
  } catch (e) { /* Edge may exit non-zero after writing the file */ }
  if (!fs.existsSync(png)) throw new Error('Rendering failed for ' + size);
  return { size, data: fs.readFileSync(png) };
});

// ICO container with PNG-compressed images (supported since Windows Vista)
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
let offset = 6 + 16 * pngs.length;
const entries = pngs.map(({ size, data }) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
  e.writeUInt8(0, 2); e.writeUInt8(0, 3); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12); offset += data.length;
  return e;
});
fs.writeFileSync(path.join(__dirname, 'icon.ico'), Buffer.concat([header, ...entries, ...pngs.map(p => p.data)]));
fs.copyFileSync(path.join(tmp, 'i256.png'), path.join(__dirname, 'icon.png'));
fs.rmSync(tmp, { recursive: true, force: true });
console.log('wrote icon.ico (' + sizes.join(', ') + ' px) and icon.png');
