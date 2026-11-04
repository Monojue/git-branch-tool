// Git Branch Tool — Basics: helpers, API calls, loading the data, the sidebar and switching screens.
// ============================================================ basics
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = { ov: null, tab: 'overview', graph: null, results: {}, openRows: new Set(), lcOpen: {} };
try { S.tab = localStorage.getItem('gbt-tab') || 'overview'; } catch (e) {}
if (['overview', 'features', 'releases', 'envs', 'cleanup', 'network', 'guide'].includes(location.hash.slice(1))) S.tab = location.hash.slice(1);
try { const th = localStorage.getItem('gbt-theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) {}

async function api(path, body) {
  const opt = body === undefined ? { headers: { 'x-git-tool': '1' } } : { method: 'POST', headers: { 'content-type': 'application/json', 'x-git-tool': '1' }, body: JSON.stringify(body) };
  const r = await fetch(path, opt); const j = await r.json();
  if (!r.ok) { const e = new Error(srv(j.error || r.statusText)); e.noRepo = !!j.noRepo; throw e; }
  return j;
}
function toast(msg) { const d = document.createElement('div'); d.textContent = msg; $('#toast').append(d); setTimeout(() => d.remove(), 4200); }
function copyBtn(text) { return `<div class="copy"><code>${esc(text)}</code><button class="btn sm" data-copy="${esc(text)}">${esc(t('copy'))}</button></div>`; }
document.addEventListener('click', e => {
  const c = e.target.closest('[data-copy]'); if (!c) return;
  navigator.clipboard.writeText(c.dataset.copy).then(() => toast(t('copied')));
});
const badge = (cls, txt) => `<span class="badge ${cls}">${esc(txt)}</span>`;
const spin = txt => `<span class="spinner"></span> ${esc(txt)}`;

// ============================================================ load
async function load(refresh) {
  try {
    S.ov = await api('/api/overview' + (refresh ? '?refresh=1' : ''));
    S.graph = null;
    updateSidebar();
    show(S.tab);
  } catch (e) {
    if (e.noRepo) return noRepoScreen();
    $('#main').innerHTML = `<div class="section"><div class="empty">${esc(t('readFail'))}<pre class="log">${esc(e.message)}</pre></div></div>`;
  }
}
function updateSidebar() {
  $('#repoName').textContent = S.ov.repo;
  $('#repoPath').textContent = S.ov.repoPath;
  $('#btnRepo').title = S.ov.remoteUrl || '';
  $('#c-features').textContent = S.ov.features.length;
  $('#c-cleanup').textContent = derive().cleanupCount || '';
  $('#c-releases').textContent = (S.ov.releases || []).length || '';
  applyStatic();
}
function derive() {
  const ov = S.ov;
  const remoteDel = ov.refs.filter(r => r.merged && !['env', 'main', 'release'].includes(r.kind));
  const relTag = ov.refs.filter(r => r.kind === 'release' && r.merged);
  const afterRelease = ov.features.filter(f => f.inRelease.length);
  const localDel = ov.local.filter(b => b.merged && !b.protected);
  return { remoteDel, relTag, afterRelease, localDel, cleanupCount: remoteDel.length + relTag.length + localDel.length };
}

// ============================================================ shell
document.getElementById('nav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(b.dataset.tab); });
$('#btnFetch').addEventListener('click', async () => {
  const b = $('#btnFetch'); b.disabled = true; b.innerHTML = spin(t('fetching'));
  try { const r = await api('/api/fetch', {}); toast(r.ok ? t('fetched') : t('fetchFailed')); S.results = {}; await load(true); }
  catch (e) { toast(e.message); }
  b.disabled = false; b.textContent = t('fetch');
});
$('#btnTheme').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next;
  try { localStorage.setItem('gbt-theme', next); } catch (e) {}
  if (S.tab === 'network') show('network');
});
$('#btnLang').addEventListener('click', () => {
  LANG = LANG === 'ja' ? 'en' : 'ja';
  try { localStorage.setItem('gbt-lang', LANG); } catch (e) {}
  applyStatic();
  if (S.ov || S.tab === 'guide') show(S.tab);
});
function show(tab) {
  S.tab = tab; try { localStorage.setItem('gbt-tab', tab); } catch (e) {}
  history.replaceState(null, '', '#' + tab);
  document.querySelectorAll('#nav button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  if (tab === 'guide') { vGuide(); window.scrollTo(0, 0); return; }   // the guide needs no repository data
  if (!S.ov) return;
  ({ overview: vOverview, features: vFeatures, releases: vReleases, envs: vEnvs, cleanup: vCleanup, network: vNetwork })[tab]();
  window.scrollTo(0, 0);
}
function topbar(title, extra = '') {
  const ov = S.ov;
  return `<div class="top"><h1>${esc(title)}</h1>
    <span class="pill">${esc(t('checkedOut'))} <b>${esc(ov.current || t('detached'))}</b></span>
    <span class="pill">${ov.dirty ? `<b style="color:var(--warn)">${esc(t('dirty', { n: ov.dirty }))}</b>` : esc(t('clean'))}</span>${extra}</div>`;
}
