// Git Branch Tool — Overview screen.
// ============================================================ overview
function vOverview() {
  const ov = S.ov, d = derive(), F = ov.features, main = ov.main;
  const conflicting = F.filter(f => f.conflicts && f.conflicts.length);
  const behind = F.filter(f => f.behind > 0 && !(f.conflicts && f.conflicts.length));
  const contains = F.filter(f => f.contains.length);
  const steps = [];
  if (d.remoteDel.length) steps.push(['bad', t('s.delRemote', { n: d.remoteDel.length }), t('s.delRemoteD', { main }), 'cleanup']);
  if (d.relTag.length) steps.push(['warn', t('s.tag', { n: d.relTag.length }), t('s.tagD'), 'cleanup']);
  conflicting.forEach(f => steps.push(['bad', t('s.rebase', { b: f.short, main }), t('s.rebaseD', { main, n: f.conflicts.length, o: f.authors.join(', ') }), 'features']));
  if (behind.length) steps.push(['warn', t('s.behind', { n: behind.length, main }), t('s.behindD', { list: behind.map(f => f.short.replace(/^feature\//, '')).join(', ') }), 'features']);
  contains.forEach(f => steps.push(['warn', t('s.contains', { b: f.short }), t('s.containsD', { list: f.contains.join(', ') }), 'features']));
  ov.envs.forEach(e => {
    if (e.mergeBases > 1) steps.push(['warn', t('s.tangled', { e: e.name, n: e.mergeBases, main }), t('s.tangledD', { main }), 'envs']);
    const old = e.tickets.filter(x => x.state === 'old');
    if (old.length) steps.push(['info', t('s.old', { e: e.name, n: old.length }), t('s.oldD', { list: old.map(x => x.short).join(', '), e: e.name }), 'envs']);
  });
  (ov.releases || []).forEach(r => {
    const old = r.included.filter(x => x.state === 'outdated'), rw = r.included.filter(x => x.state === 'rewritten');
    if (old.length) steps.unshift(['bad', t('s.relOutdated', { r: r.name, n: old.length }), t('s.relOutdatedD', { list: old.map(x => x.short).join(', ') }), 'releases']);
    if (rw.length) steps.push(['warn', t('s.relRewritten', { r: r.name, n: rw.length }), t('s.relRewrittenD', { list: rw.map(x => x.short).join(', ') }), 'releases']);
    if (r.conflicts && r.conflicts.length) steps.unshift(['bad', t('s.relConflict', { r: r.name, main }), t('s.relConflictD', { n: r.conflicts.length }), 'releases']);
    if (r.behind) steps.push(['warn', t('s.relBehind', { r: r.name, n: r.behind, main }), t('s.relBehindD', { main }), 'releases']);
    if (r.envMerges.length) steps.unshift(['bad', t('s.relEnv', { r: r.name }), t('s.relEnvD'), 'releases']);
    if (r.direct.length) steps.push(['info', t('s.relDirect', { r: r.name, n: r.direct.length }), t('s.relDirectD'), 'releases']);
  });
  if (d.localDel.length) steps.push(['info', t('s.local', { n: d.localDel.length }), t('s.localD', { main }), 'cleanup']);
  if (ov.stashes.length) steps.push(['info', t('s.stash', { n: ov.stashes.length }), t('s.stashD'), null]);

  const byKind = k => ov.refs.filter(r => r.kind === k).length;
  $('#main').innerHTML = topbar(t('ov.title')) + `
  <div class="grid">
    <div class="cards">
      ${card(t('ov.cardBranches'), ov.refs.length, t('ov.cardBranchesSub', { f: byKind('feature'), r: byKind('release'), m: byKind('env') + 1 }), 'cleanup')}
      ${card(t('ov.cardDelete'), d.remoteDel.length + d.relTag.length, t('ov.cardDeleteSub', { m: d.remoteDel.length, r: d.relTag.length }), 'cleanup', d.remoteDel.length ? 'bad' : 'ok')}
      ${card(t('ov.cardUnreleased'), F.length, d.afterRelease.length ? t('ov.cardUnreleasedRel', { n: d.afterRelease.length }) : t('ov.cardUnreleasedNot', { main }), 'features')}
      ${card(t('ov.cardConflict', { main }), conflicting.length, conflicting.length ? t('ov.needRebase') : t('ov.allClean'), 'features', conflicting.length ? 'bad' : 'ok')}
      ${(() => { const rs = ov.releases || [], bad = rs.reduce((n, r) => n + r.included.filter(x => x.state === 'outdated').length, 0);
        return card(t('ov.cardReleases'), rs.length, rs.length ? (bad ? t('ov.cardReleasesBad', { n: bad }) : t('ov.cardReleasesOk')) : t('ov.cardReleasesNone'), 'releases', bad ? 'bad' : undefined); })()}
      ${ov.envs.map(e => card(e.name, e.behind ? t('ov.envBehind', { n: e.behind }) : t('ov.envUpToDate'), t('ov.envSub', { a: e.ahead, main, m: e.merges, b: e.mergeBases }), 'envs', e.behind || e.mergeBases > 1 ? 'warn' : 'ok')).join('')}
    </div>
    ${envMatrix()}
    <div class="section"><header><h2>${esc(t('ov.steps'))}</h2></header>
      ${steps.length ? `<ul class="steps">${steps.map(([lvl, ti, s, tab]) => `<li><span class="dot" style="background:var(--${lvl})"></span><div class="t">${esc(ti)}<small>${esc(s)}</small></div>${tab ? `<button class="btn sm" data-go="${tab}">${esc(t('open'))}</button>` : ''}</li>`).join('')}</ul>` : `<div class="empty">${esc(t('ov.noSteps'))}</div>`}
    </div>
  </div>`;
  $('#main').querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));
  $('#main').querySelectorAll('[data-feat]').forEach(tr => tr.addEventListener('click', ev => { if (ev.target.closest('a')) return; S.openRows.add(tr.dataset.feat); show('features'); }));
  bindSort($('#main'), MATRIX_SORT_DEF, vOverview);
}
// Where is each unreleased feature: one column per environment branch, plus open releases
function envMatrix() {
  const ov = S.ov, envs = ov.envNames;
  if (!ov.features.length) return '';
  const DEF = MATRIX_SORT_DEF;
  const rows = sortFeatures(ov.features, 'overview', DEF.overview);
  const th = (key, label) => sortTh('overview', DEF.overview, key, label);
  const cell = s => s === 'full' ? badge('b-ok', t('f.latest')) : s === 'old' ? badge('b-warn', t('f.oldVersion')) : '<span class="muted">—</span>';
  const head = e => {
    const n = ov.features.filter(f => f.env[e] !== 'none').length, old = ov.features.filter(f => f.env[e] === 'old').length;
    return th('env:' + e, `${esc(e)} <span class="muted" style="font-weight:400">(${n}${old ? ` · ${esc(t('ov.envOld', { n: old }))}` : ''})</span>`);
  };
  return `<div class="section"><header><h2>${esc(t('ov.envT'))}</h2><div class="hint">${esc(t('ov.envHint'))}</div></header>
    <div class="tbl-wrap"><table><thead><tr>${th('branch', esc(t('f.th.branch')))}${th('owner', esc(t('f.th.owner')))}${envs.map(head).join('')}${th('release', esc(t('f.th.release')))}</tr></thead>
    <tbody>${rows.map(f => `<tr data-feat="${esc(f.short)}" style="cursor:pointer"><td>${brLink(f.short)}</td><td>${esc(f.authors.join(', '))}</td>${envs.map(e => `<td>${cell(f.env[e])}</td>`).join('')}<td>${relCell(f)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function card(title, big, sub, go, tone) {
  const color = tone ? `style="color:var(--${tone})"` : '';
  return `<div class="card click" data-go="${go}"><h3>${esc(title)}</h3><div class="big" ${color}>${esc(big)}</div><div class="sub">${esc(sub)}</div></div>`;
}
