// Git Branch Tool — Repository dialog: recent repositories, folder browser, settings.
// ============================================================ repositories
function resetRepoState() { S.ov = null; S.graph = null; S.results = {}; S.openRows = new Set(); S.lcOpen = {}; S.netQuery = ''; S.netSel = null; }
// Always start from the latest git data: fetch from the remote first, then read the repository.
async function fetchAndLoad() {
  $('#main').innerHTML = `<div class="loading">${spin(t('loadingFetch'))}</div>`;
  const b = $('#btnFetch'); b.disabled = true;
  let ok = false, noRepo = false;
  try { ok = (await api('/api/fetch', {})).ok; } catch (e) { noRepo = e.noRepo; }
  b.disabled = false;
  if (noRepo) return noRepoScreen();
  if (!ok) toast(t('fetchFailed'));
  $('#main').innerHTML = `<div class="loading">${spin(t('loading'))}</div>`;
  await load(true);
}
function noRepoScreen() {
  $('#repoName').textContent = '—'; $('#repoPath').textContent = '';
  $('#main').innerHTML = `<div class="section"><div class="empty">${esc(t('repo.none'))}<p><button class="btn primary" id="btnChoose">${esc(t('repo.choose'))}</button></p></div></div>`;
  $('#btnChoose').onclick = () => openRepoDialog();
  openRepoDialog();
}

const RD = { info: null, showBrowser: false };
async function openRepoDialog() {
  const dlg = $('#dlg');
  $('#dlgTitle').textContent = t('repo.title');
  $('#dlgFoot').innerHTML = `<button class="btn" id="dlgClose">${esc(t('cf.close'))}</button>`;
  $('#dlgClose').onclick = () => dlg.close();
  $('#dlgBody').innerHTML = `<div class="loading">${spin(t('loading'))}</div>`;
  if (!dlg.open) dlg.showModal();
  let list;
  try { list = await api('/api/repos'); } catch (e) { $('#dlgBody').innerHTML = `<pre class="log">${esc(e.message)}</pre>`; return; }
  RD.info = null;
  if (list.current) { try { RD.info = await api('/api/repo/info'); } catch (e) {} }
  renderRepoDialog(list);
}
function renderRepoDialog(list) {
  const info = RD.info;
  let h = `<div id="repoStatus"></div>`;
  if (list.repos.length) h += `<div class="dsec">${esc(t('repo.recent'))}</div><div class="rlist">${list.repos.map(r => `
    <div class="ritem ${r.current ? 'cur' : ''}"><div class="grow"><b>${esc(r.name)}</b> ${r.current ? badge('b-info', t('repo.current')) : ''} ${r.exists ? '' : badge('b-bad', t('repo.missing'))}<div class="p">${esc(r.path)}</div></div>
    ${r.current ? '' : `<button class="btn sm primary" data-open="${esc(r.path)}" ${r.exists ? '' : 'disabled'}>${esc(t('repo.open'))}</button><button class="btn sm" data-forget="${esc(r.path)}" title="${esc(t('repo.remove'))}">✕</button>`}</div>`).join('')}</div>`;
  h += `<div class="dsec">${esc(t('repo.add'))}</div>
    <div class="row"><input type="text" id="repoPathIn" placeholder="${esc(t('repo.pathPh', { ex: list.platform === 'win32' ? 'C:\\Users\\you\\git\\project' : (list.home || '/home/you') + '/git/project' }))}" style="flex:1;min-width:220px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit">
      <button class="btn primary" id="repoOpenPath">${esc(t('repo.open'))}</button><button class="btn" id="repoBrowse">${esc(t('repo.browse'))}</button></div>
    <div id="browser"></div>`;
  if (info) {
    const s = info.settings, notTopic = b => !/^(feature|hotfix|bugfix|release)\//.test(b);
    const envCands = info.branches.filter(b => notTopic(b) && b !== s.main);
    h += `<div class="dsec">${esc(t('repo.settings', { name: info.path.split(/[\\/]/).pop() }))}</div>
      ${info.remotes.length > 1 ? `<label class="field"><span>${esc(t('repo.remote'))}</span><select id="setRemote">${info.remotes.map(r => `<option ${r === s.remote ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>` : ''}
      <label class="field"><span>${esc(t('repo.main'))}</span><select id="setMain">${info.branches.filter(notTopic).map(b => `<option ${b === s.main ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select><small>${esc(t('repo.mainHint'))}</small></label>
      <div class="field"><span>${esc(t('repo.envs'))}</span><div class="row">${envCands.length ? envCands.map(b => `<label class="chk"><input type="checkbox" data-env value="${esc(b)}" ${s.envs.includes(b) ? 'checked' : ''}> <span class="mono">${esc(b)}</span></label>`).join('') : `<small>${esc(t('repo.noEnvCandidates'))}</small>`}</div><small>${esc(t('repo.envsHint'))}</small></div>
      <label class="field"><span>${esc(t('repo.checkPaths'))}</span><input type="text" id="setPaths" value="${esc(s.checkPaths.join(', '))}"><small>${esc(t('repo.checkPathsHint'))}</small></label>
      <label class="field"><span>${esc(t('repo.issueUrl'))}</span><input type="text" id="setIssueUrl" value="${esc(s.issueUrl || '')}" placeholder="https://space.backlog.jp/view/{key}"><small>${esc(t('repo.issueUrlHint'))}</small></label>
      <label class="field"><span>${esc(t('repo.apiKey'))}</span><input type="password" id="setApiKey" autocomplete="new-password" placeholder="${esc(info.hasApiKey ? t('repo.apiKeySaved') : '')}"><small>${esc(t('repo.apiKeyHint'))}</small></label>
      ${info.hasApiKey ? `<label class="chk small" style="margin:-4px 0 10px"><input type="checkbox" id="setRemoveKey"> ${esc(t('repo.apiKeyRemove'))}</label>` : ''}
      <button class="btn primary" id="repoSave">${esc(t('repo.save'))}</button>`;
  }
  $('#dlgBody').innerHTML = h;
  const body = $('#dlgBody');
  body.querySelectorAll('.rlist [data-open]').forEach(b => b.onclick = () => switchRepo(b.dataset.open));
  body.querySelectorAll('[data-forget]').forEach(b => b.onclick = async () => {
    try { renderRepoDialog(await api('/api/repo/forget', { path: b.dataset.forget })); } catch (e) { repoStatus(e.message, true); }
  });
  $('#repoOpenPath').onclick = () => switchRepo($('#repoPathIn').value.trim());
  $('#repoPathIn').onkeydown = e => { if (e.key === 'Enter') switchRepo(e.target.value.trim()); };
  $('#repoBrowse').onclick = () => { RD.showBrowser = true; renderBrowser($('#repoPathIn').value.trim() || null); };
  if (RD.showBrowser) renderBrowser(null);
  if (info) $('#repoSave').onclick = async () => {
    const payload = {
      remote: $('#setRemote') ? $('#setRemote').value : info.settings.remote, main: $('#setMain').value,
      envs: [...body.querySelectorAll('[data-env]:checked')].map(i => i.value), checkPaths: $('#setPaths').value.split(','),
      issueUrl: $('#setIssueUrl').value, apiKey: $('#setApiKey').value, removeApiKey: !!($('#setRemoveKey') && $('#setRemoveKey').checked),
    };
    try {
      await api('/api/repo/settings', payload);
      ISSUES.clear();
      $('#dlg').close(); toast(t('repo.saved')); resetRepoState();
      $('#main').innerHTML = `<div class="loading">${spin(t('loading'))}</div>`;
      await load(true);
    } catch (e) { repoStatus(e.message, true); }
  };
}
function repoStatus(msg, isError) {
  const el = $('#repoStatus'); if (!el) return;
  el.innerHTML = isError ? `<pre class="log" style="color:var(--bad)">${esc(msg)}</pre>` : `<div class="loading" style="padding:8px 0">${spin(msg)}</div>`;
}
async function switchRepo(p) {
  if (!p) return;
  repoStatus(t('repo.opening'));
  try {
    const list = await api('/api/repo/select', { path: p });
    const cur = list.repos.find(r => r.current);
    $('#dlg').close(); RD.showBrowser = false; resetRepoState();
    toast(t('repo.switched', { name: cur ? cur.name : p }));
    await fetchAndLoad();
  } catch (e) { repoStatus(e.message, true); }
}
async function renderBrowser(dir) {
  const box = $('#browser'); if (!box) return;
  box.innerHTML = `<div class="loading">${spin(t('loading'))}</div>`;
  let b;
  try { b = await api('/api/browse' + (dir ? '?dir=' + encodeURIComponent(dir) : '')); } catch (e) { box.innerHTML = `<pre class="log">${esc(e.message)}</pre>`; return; }
  box.innerHTML = `<div class="browser"><div class="bar"><div class="cur">📂 ${esc(b.dir)}</div>
      ${b.parent ? `<button class="btn sm" data-dir="${esc(b.parent)}">${esc(t('repo.up'))}</button>` : ''}
      <button class="btn sm" data-dir="${esc(b.home)}">${esc(t('repo.home'))}</button>
      ${b.drives.map(d => `<button class="btn sm" data-dir="${esc(d)}">${esc(d)}</button>`).join('')}
      ${b.isRepo ? `<span style="flex:1"></span><span class="small muted">${esc(t('repo.isRepo'))}</span><button class="btn sm primary" data-open="${esc(b.dir)}">${esc(t('repo.openThis'))}</button>` : ''}</div>
    <div class="ents">${b.entries.length ? b.entries.map(e => `<div class="ent" data-dir="${esc(e.path)}"><span>${e.isRepo ? '📦' : '📁'}</span><span class="grow">${esc(e.name)}</span>${e.isRepo ? `${badge('b-ok', 'git')} <button class="btn sm primary" data-open="${esc(e.path)}">${esc(t('repo.open'))}</button>` : ''}</div>`).join('') : `<div class="empty">${esc(t('repo.noFolders'))}</div>`}</div></div>`;
  box.querySelectorAll('[data-dir]').forEach(el => el.addEventListener('click', ev => { if (ev.target.closest('[data-open]')) return; renderBrowser(el.dataset.dir); }));
  box.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', ev => { ev.stopPropagation(); switchRepo(el.dataset.open); }));
  const inp = $('#repoPathIn'); if (inp) inp.value = b.dir;
}
