// Git Branch Tool — Features screen.
// ============================================================ features
function vFeatures() {
  const ov = S.ov, envs = ov.envNames, main = ov.main;
  const DEF = { features: { key: 'conflict', dir: 'desc' } };
  const rows = sortFeatures(ov.features, 'features', DEF.features);
  const th = (key, label) => sortTh('features', DEF.features, key, label);
  const envCell = s => s === 'full' ? badge('b-ok', t('f.latest')) : s === 'old' ? badge('b-warn', t('f.oldVersion')) : badge('b-mute', '—');
  const fc = S.results.featureConflicts;
  $('#main').innerHTML = topbar(t('f.title'), `<button class="btn" id="btnPairs">${esc(t('f.pairsBtn'))}</button>`) + `
  <div class="grid">
    <div class="section"><header><h2>${esc(t('f.section', { n: rows.length }))}</h2><div class="hint">${esc(t('f.hint', { main }))}</div></header>
    <div class="tbl-wrap"><table>
      <thead><tr>${th('branch', esc(t('f.th.branch')))}${th('owner', esc(t('f.th.owner')))}${th('date', esc(t('f.th.last')))}${th('commits', esc(t('f.th.commits')))}${th('base', esc(t('f.th.base')))}${th('conflict', esc(t('f.th.conflict', { main })))}${envs.map(e => th('env:' + e, esc(e))).join('')}${th('release', esc(t('f.th.release')))}${th('contains', esc(t('f.th.contains')))}</tr></thead>
      <tbody>${rows.map(f => {
        const open = S.openRows.has(f.short);
        const base = f.behind === 0 ? badge('b-ok', t('f.current')) : badge('b-warn', t('f.behind', { n: f.behind }));
        const conf = f.conflicts == null ? badge('b-mute', '?') : f.conflicts.length ? badge('b-bad', t('f.files', { n: f.conflicts.length })) : badge('b-ok', t('none'));
        let html = `<tr data-row="${esc(f.short)}" style="cursor:pointer"><td class="mono">${open ? '▾' : '▸'} ${brLink(f.short)}</td><td>${esc(f.authors.join(', '))}</td><td class="nw">${esc(f.date)}</td><td style="font-variant-numeric:tabular-nums">${f.ahead}</td><td>${base}</td><td>${conf}</td>${envs.map(e => `<td>${envCell(f.env[e])}</td>`).join('')}<td>${relCell(f)}</td><td>${f.contains.length ? badge('b-warn', f.contains.join(', ')) : '<span class="muted">—</span>'}</td></tr>`;
        if (open) html += `<tr class="expand"><td colspan="${9 + envs.length}">${featureDetail(f)}</td></tr>`;
        return html;
      }).join('')}</tbody></table></div></div>
    ${fc ? pairsSection(fc) : ''}
  </div>`;
  $('#main').querySelectorAll('[data-row]').forEach(tr => tr.addEventListener('click', ev => {
    if (ev.target.closest('a')) return;            // the branch name opens the issue instead
    const k = tr.dataset.row; S.openRows.has(k) ? S.openRows.delete(k) : S.openRows.add(k); vFeatures();
  }));
  bindSort($('#main'), DEF, vFeatures);
  $('#main').querySelectorAll('[data-netshow]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); S.netQuery = b.dataset.netshow; show('network'); }));
  $('#btnPairs').addEventListener('click', async () => {
    const b = $('#btnPairs'); b.disabled = true; b.innerHTML = spin(t('f.pairsRunning'));
    try { S.results.featureConflicts = await api('/api/feature-conflicts'); } catch (e) { toast(e.message); }
    if (S.tab === 'features') vFeatures();
  });
}
function featureDetail(f) {
  const ov = S.ov, main = ov.main;
  const cmd = `git checkout ${f.short}\ngit fetch && git rebase ${ov.remote}/${main}\ngit push --force-with-lease`;
  return `<div class="grid" style="gap:10px;padding:4px 0">
    <div><button class="btn sm" data-netshow="${esc(f.short)}">🔎 ${esc(t('f.showNet'))}</button></div>
    ${f.conflicts && f.conflicts.length ? `<div><b>${esc(t('f.d.conflicts', { main }))}</b> ${esc(t('f.d.conflictsD'))}<ul class="files">${f.conflicts.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${f.behind > 0 ? `<div><b>${esc(t('f.d.update', { main }))}</b> ${esc(t('f.d.updateD', { n: f.ahead }))}${copyBtn(cmd)}</div>` : `<div class="muted">${esc(t('f.d.based', { main }))}</div>`}
    <div><b>${esc(t('f.d.commits'))}</b><table style="margin-top:4px"><tbody>${f.commits.map(c => `<tr><td class="mono">${esc(c.h)}</td><td class="nw">${esc(c.d)}</td><td>${esc(c.a)}</td><td>${esc(c.s)}</td></tr>`).join('')}</tbody></table></div>
  </div>`;
}
function pairsSection(fc) {
  return `<div class="section"><header><h2>${esc(t('f.p.title', { n: fc.pairs.length }))}</h2><div class="hint">${esc(t('f.p.hint'))}</div></header>
  ${fc.pairs.length ? `<div class="tbl-wrap"><table><thead><tr><th>${esc(t('f.p.a'))}</th><th>${esc(t('f.p.b'))}</th><th>${esc(t('f.p.files'))}</th></tr></thead><tbody>${fc.pairs.map(p => `<tr><td class="mono">${esc(p.a)}</td><td class="mono">${esc(p.b)}</td><td><ul class="files" style="margin:0">${p.files.map(f => `<li>${esc(f)}</li>`).join('')}</ul></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${esc(t('f.p.none'))}</div>`}</div>`;
}
