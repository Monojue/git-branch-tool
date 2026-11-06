// Git Branch Tool — demo mode (only in the static demo build, see scripts/build-demo.js).
// Answers the page's API calls from JSON snapshots of the test repository instead of a server.
// Loaded after repos.js and before main.js, so it replaces api() before the page starts.
const DEMO_TXT = {
  en: { note: 'Demo with a made-up repository. Buttons that change git are disabled.', get: 'Download the tool',
        off: 'Not available in the demo: this changes the repository.', repo: 'In the demo the repository cannot be changed.',
        order: p => `Demo: results are saved in advance. "Your order" is compared in list order: ${p.list}` },
  ja: { note: '架空のリポジトリを使ったデモです。gitを変更するボタンは使えません。', get: 'ツールをダウンロード',
        off: 'デモでは使えません（リポジトリを変更する操作です）。', repo: 'デモではリポジトリを切り替えられません。',
        order: p => `デモ: 結果は事前に計算したものです。「入力した順」は一覧の順番で比較しています: ${p.list}` },
};
const dt = (k, p) => { const v = (DEMO_TXT[LANG] || DEMO_TXT.en)[k]; return typeof v === 'function' ? v(p) : v; };
const DEMO_CACHE = {};
const demoData = name => DEMO_CACHE[name] || (DEMO_CACHE[name] = fetch(`data/${name}.json`).then(r => r.json()));

async function api(path, body) {
  const [p, qs] = path.split('?'), q = new URLSearchParams(qs || '');
  switch (p) {
    case '/api/fetch': return { ok: true };
    case '/api/overview': return demoData('overview');
    case '/api/graph': return demoData('graph');
    case '/api/feature-conflicts': return demoData('feature-conflicts');
    case '/api/env-check': return (await demoData('env-check'))[q.get('env')];
    case '/api/commit': { const c = (await demoData('commits'))[q.get('h')]; if (!c) throw new Error(dt('off')); return c; }
    case '/api/issue': return { key: q.get('key'), url: '', noApiKey: true };
    case '/api/rebuild-preview': {
      const r = (await demoData('rebuild-preview'))[body.env + '|' + body.branches.join(',')];
      if (!r) throw new Error(dt('off')); return r;
    }
    case '/api/merge-order': {
      const all = await demoData('merge-order'), key = b => body.base + '|' + b.join(',');
      if (all[key(body.branches)]) return all[key(body.branches)];
      // not saved in this order: use the result for the same features in list order
      const order = S.ov.features.map(f => f.short).filter(b => body.branches.includes(b));
      const r = all[key(order)]; if (!r) throw new Error(dt('off'));
      return { ...r, demoListOrder: order };
    }
    default: throw new Error(dt('off'));      // fetch-free actions: delete, tag, settings, …
  }
}
// note above the merge order result when "your order" had to be replaced by the list order
const demoOrigMergeOrderResult = mergeOrderResult;
mergeOrderResult = p => (p.demoListOrder ? `<div class="small muted">${esc(dt('order', { list: p.demoListOrder.map(shortName).join(' ') }))}</div>` : '') + demoOrigMergeOrderResult(p);
openRepoDialog = () => toast(dt('repo'));
// start the merge order with an example where the order matters (saved exactly by the build)
if (!MO.text) MO.text = 'PRJ-8 PRJ-7 PRJ-5 PRJ-6 PRJ-3';
window.EventSource = class { close() {} };   // no server to keep alive

const demoOrigApplyStatic = applyStatic;
applyStatic = () => {
  demoOrigApplyStatic();
  const n = document.getElementById('demoNote'); if (!n) return;
  n.innerHTML = `<b>DEMO</b> ${esc(dt('note'))}${DEMO_DOWNLOAD ? ` <a href="${esc(DEMO_DOWNLOAD)}" target="_blank" rel="noopener">${esc(dt('get'))} ↗</a>` : ''}`;
};
