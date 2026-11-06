// Git Branch Tool — Cleanup screen.
// ============================================================ cleanup
function vCleanup() {
  const ov = S.ov, d = derive(), main = ov.main;
  const group = (id, title, hint, items, labelFn, btn) => `<div class="section"><header><h2>${esc(title)} (${items.length})</h2>
      ${items.length && btn ? `<label class="chk small"><input type="checkbox" data-all="${id}" checked> ${esc(t('all'))}</label>${btn}` : ''}<div class="hint">${esc(hint)}</div></header>
      ${items.length ? `<div class="list-check">${items.map(labelFn).join('')}</div>` : `<div class="empty">${esc(t('nothingHere'))}</div>`}</div>`;
  const remoteRow = r => `<label><input type="checkbox" data-g="remote" value="${esc(r.short)}" checked><span class="mono">${esc(r.short)}</span><span class="small muted">${esc(r.author)}</span><span class="small muted">${esc(r.date)}</span></label>`;
  $('#main').innerHTML = topbar(t('cl.title')) + `<div class="grid">
    ${group('remote', t('cl.remote'), t('cl.remoteH', { main }), d.remoteDel, remoteRow, `<button class="btn danger" id="doRemote">${esc(t('cl.delete'))}</button>`)}
    ${group('release', t('cl.release'), t('cl.releaseH'), d.relTag,
      r => `<label><input type="checkbox" data-g="release" value="${esc(r.short)}" checked><span class="mono">${esc(r.short)}</span><span class="small mono muted">→ ${esc(r.short.replace(/^release\//, 'release-'))}</span><span class="small muted">${esc(r.date)}</span></label>`,
      `<button class="btn primary" id="doRelease">${esc(t('cl.tagDelete'))}</button>`)}
    ${group('after', t('cl.after'), t('cl.afterH', { rel: ov.openReleases.join(', ') || t('cl.anOpenRelease'), main }), d.afterRelease,
      f => `<label><span></span><span class="mono">${esc(f.short)}</span><span class="small muted">${esc(f.inRelease.join(', '))}</span><span></span></label>`, '')}
    ${group('local', t('cl.local'), t('cl.localH'), d.localDel,
      b => `<label><input type="checkbox" data-g="local" value="${esc(b.name)}" checked><span class="mono">${esc(b.name)}</span><span class="small muted">${b.gone ? esc(t('cl.remoteDeleted')) : esc(b.upstream || t('cl.noUpstream'))}</span><span class="small muted">${esc(b.date)}</span></label>`,
      `<button class="btn" id="doLocal">${esc(t('cl.delete'))}</button>`)}
    ${ov.stashes.length ? `<div class="section"><header><h2>${esc(t('cl.stash', { n: ov.stashes.length }))}</h2><div class="hint">${esc(t('cl.stashH', { a: 'git stash show -p stash@{n}', b: 'git stash drop stash@{n}' }))}</div></header>
      <div class="tbl-wrap"><table><tbody>${ov.stashes.map(s => `<tr><td class="mono">${esc(s.ref)}</td><td class="nw">${esc(s.date)}</td><td>${esc(s.msg)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
  </div>`;
  document.querySelectorAll('[data-all]').forEach(a => a.addEventListener('change', () => document.querySelectorAll(`[data-g="${a.dataset.all}"]`).forEach(i => { i.checked = a.checked; })));
  const picked = g => [...document.querySelectorAll(`[data-g="${g}"]:checked`)].map(i => i.value);
  $('#doRemote')?.addEventListener('click', () => confirmRun({
    title: t('cf.remote', { n: picked('remote').length }), items: picked('remote'), typed: 'delete', danger: true,
    note: t('cf.remoteN', { main }), run: () => api('/api/delete-remote', { branches: picked('remote') }) }));
  $('#doRelease')?.addEventListener('click', () => confirmRun({
    title: t('cf.release', { n: picked('release').length }), items: picked('release').map(b => `${b}  →  ${b.replace(/^release\//, 'release-')}`), typed: 'delete',
    note: t('cf.releaseN'), run: () => api('/api/tag-releases', { branches: picked('release'), deleteBranch: true }) }));
  $('#doLocal')?.addEventListener('click', () => confirmRun({
    title: t('cf.local', { n: picked('local').length }), items: picked('local'),
    note: t('cf.localN'), run: () => api('/api/delete-local', { branches: picked('local') }) }));
}
function confirmRun({ title, items, note, typed, danger, run }) {
  if (!items.length) return toast(t('nothingSelected'));
  const dlg = $('#dlg');
  $('#dlgTitle').textContent = title;
  $('#dlgBody').innerHTML = `<p class="small muted" style="margin-top:0">${esc(note)}</p><pre class="log">${esc(items.join('\n'))}</pre>
    ${typed ? `<p class="small">${t('cf.type', { w: `<b>${typed}</b>` })}</p><input type="text" id="dlgTyped" autocomplete="off">` : ''}<div id="dlgOut"></div>`;
  $('#dlgFoot').innerHTML = `<button class="btn" id="dlgCancel">${esc(t('cf.cancel'))}</button><button class="btn ${danger ? 'danger' : 'primary'}" id="dlgOk" ${typed ? 'disabled' : ''}>${esc(t('cf.ok'))}</button>`;
  dlg.showModal();
  if (typed) $('#dlgTyped').addEventListener('input', e => { $('#dlgOk').disabled = e.target.value.trim() !== typed; });
  $('#dlgCancel').onclick = () => dlg.close();
  $('#dlgOk').onclick = async () => {
    const ok = $('#dlgOk'); ok.disabled = true; ok.innerHTML = spin(t('cf.working'));
    try {
      const r = await run();
      $('#dlgOut').innerHTML = `<p>${r.ok ? badge('b-ok', t('cf.done')) : badge('b-bad', t('cf.errors'))}</p><pre class="log">${esc(srv(r.log))}</pre>`;
    } catch (e) { $('#dlgOut').innerHTML = `<p>${badge('b-bad', t('cf.refused'))}</p><pre class="log">${esc(e.message)}</pre>`; }
    $('#dlgFoot').innerHTML = `<button class="btn primary" id="dlgClose">${esc(t('cf.close'))}</button>`;
    $('#dlgClose').onclick = () => { dlg.close(); load(true); };
  };
}
