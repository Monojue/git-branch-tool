// Builds the static demo (demo/): the real page, answered from JSON snapshots of the test repository
// (test/fixture.js) instead of a server. The folder can be served by any static host (Vercel, Netlify…).
//   Run:  npm run build-demo            (optional: --download <url> for the "Download the tool" link)
// The tool runs on the made-up repository once; every screen's answer is saved, including the merge
// order and rebuild preview for every choice of features. Nothing in the result needs git or a server.
const fs = require('fs');
const path = require('path');
const { makeRepo } = require('../test/fixture');
const { startServer, writeConfig } = require('../test/helpers');

const TOOL = path.join(__dirname, '..'), OUT = path.join(TOOL, 'demo'), PORT = 4795;
const arg = process.argv.indexOf('--download');
const DOWNLOAD = arg > 0 ? process.argv[arg + 1] : 'https://github.com/Monojue/git-branch-tool/releases';

// all non-empty subsets of a list, each in list order
const DEMO_EXAMPLE = ['feature/PRJ-8', 'feature/PRJ-7', 'feature/PRJ-5', 'feature/PRJ-6', 'feature/PRJ-3'];
const subsets = xs => xs.reduce((acc, x) => acc.concat(acc.map(s => [...s, x])), [[]]).filter(s => s.length);
const orders = xs => xs.length <= 1 ? [xs] : xs.flatMap((x, i) => orders(xs.filter((_, j) => j !== i)).map(o => [x, ...o]));

(async () => {
  const t0 = Date.now(), repo = makeRepo();
  const srv = await startServer(writeConfig(repo.root, PORT, repo.work), PORT);
  // the temporary folder name must not appear in the demo: show neutral paths instead
  const roots = [repo.root, repo.root.replace(/\\/g, '/')];
  const clean = v => typeof v === 'string'
    ? roots.reduce((s, r) => s.split(r + path.sep + 'work').join('/home/demo/demo-repo').split(r + '/work').join('/home/demo/demo-repo').split(r).join('/home/demo'), v)
    : Array.isArray(v) ? v.map(clean) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)])) : v;
  const get = async (p, body) => {
    const { status, ...r } = await srv.call(p, body);
    if (status !== 200) throw new Error(`${p} ${JSON.stringify(body || '')}: ${r.error}`);
    return clean(r);
  };
  const data = {};
  try {
    await get('/api/fetch', {});
    const ov = data.overview = await get('/api/overview?refresh=1');
    ov.repo = 'demo-repo';
    data.graph = await get('/api/graph');
    data['feature-conflicts'] = await get('/api/feature-conflicts');
    data['env-check'] = {};
    for (const e of ov.envNames) data['env-check'][e] = await get('/api/env-check?env=' + e);

    // commit details for every commit in the graph
    const hashes = new Set();
    (function walk(v) { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (typeof v.h === 'string' && Array.isArray(v.p)) hashes.add(v.h); Object.values(v).forEach(walk); } })(data.graph);
    data.commits = {};
    for (const h of hashes) data.commits[h] = await get('/api/commit?h=' + h);

    const features = ov.features.map(f => f.short);
    // rebuild preview: the page sends the ticked features in list order
    data['rebuild-preview'] = {};
    for (const e of ov.envNames) for (const s of subsets(features)) data['rebuild-preview'][e + '|' + s.join(',')] = await get('/api/rebuild-preview', { env: e, branches: s });
    // merge order: every set of features in list order, every order of up to three features, and the
    // example the demo starts with (PRJ-8 before PRJ-7 conflicts, see test/fixture.js)
    data['merge-order'] = {};
    const jobs = [];
    for (const base of [ov.main, ...ov.releases.map(r => r.name)]) {
      const inputs = [...subsets(features), ...subsets(features).filter(s => s.length > 1 && s.length <= 3).flatMap(orders), DEMO_EXAMPLE];
      for (const s of inputs) { const key = base + '|' + s.join(','); if (!jobs.some(j => j.key === key)) jobs.push({ key, base, s }); }
    }
    let next = 0;                                      // 4 at a time: merge order only reads the repository
    await Promise.all([1, 2, 3, 4].map(async () => { while (next < jobs.length) { const j = jobs[next++]; data['merge-order'][j.key] = await get('/api/merge-order', { base: j.base, branches: j.s }); } }));
  } finally { await srv.stop(); repo.cleanup(); }

  // write the page: same files as the tool, plus demo.js and the snapshots
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'js'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'data'));
  for (const f of ['app.css', 'icon.ico']) fs.copyFileSync(path.join(TOOL, f), path.join(OUT, f));
  for (const f of fs.readdirSync(path.join(TOOL, 'js'))) fs.copyFileSync(path.join(TOOL, 'js', f), path.join(OUT, 'js', f));
  fs.copyFileSync(path.join(__dirname, 'demo', 'demo.js'), path.join(OUT, 'js', 'demo.js'));
  let html = fs.readFileSync(path.join(TOOL, 'index.html'), 'utf8');
  html = html
    .replace('<title>Git Branch Tool</title>', '<title>Git Branch Tool demo</title>\n<link rel="icon" href="icon.ico">')
    .replace(/(<div class="brand">[\s\S]*?<\/div>)/, '$1\n    <div class="demo-note" id="demoNote"></div>')
    .replace('<script src="js/main.js">', `<script>const DEMO_DOWNLOAD = ${JSON.stringify(DOWNLOAD)};</script>\n<script src="js/demo.js"></script>\n<script src="js/main.js">`)
    .replace('</head>', '<style>.demo-note{margin:4px 6px 8px;padding:8px 10px;border:1px solid var(--warn);border-radius:8px;font-size:12px;line-height:1.5}.demo-note b{color:var(--warn);margin-right:4px}</style>\n</head>');
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  for (const [name, v] of Object.entries(data)) fs.writeFileSync(path.join(OUT, 'data', name + '.json'), JSON.stringify(v));

  // nothing from this PC may end up in the demo
  const all = fs.readdirSync(path.join(OUT, 'data')).map(f => fs.readFileSync(path.join(OUT, 'data', f), 'utf8')).join('\n');
  const leaks = [require('os').userInfo().username, require('os').tmpdir(), require('os').tmpdir().replace(/\\/g, '/'), 'gbt-test-'].filter(s => s && all.includes(s));
  if (leaks.length) throw new Error('local paths in the demo data: ' + leaks.join(', '));
  const size = fs.readdirSync(path.join(OUT, 'data')).reduce((n, f) => n + fs.statSync(path.join(OUT, 'data', f)).size, 0);
  console.log(`demo/ written: ${Object.keys(data['merge-order']).length} merge orders, ${Object.keys(data['rebuild-preview']).length} rebuild previews, ${Object.keys(data.commits).length} commits, ${(size / 1024).toFixed(0)} KB data, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
})().catch(e => { console.error(e); process.exit(1); });
