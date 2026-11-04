// Git Branch Tool — Releases screen.
// ============================================================ releases
// Release column in the Features table: latest / outdated / rewritten, per open release
function relCell(f) {
  const out = [];
  (S.ov.releases || []).forEach(r => {
    const x = r.included.find(i => i.short === f.short); if (!x) return;
    out.push(x.state === 'latest' ? badge('b-info', r.name) : badge(x.state === 'outdated' ? 'b-bad' : 'b-warn', `${r.name} ${t('rel.oldShort')}`));
  });
  return out.length ? out.join(' ') : '<span class="muted">—</span>';
}
const REL_STATE = {
  latest: x => badge('b-ok', t('rel.latest')),
  outdated: x => badge('b-bad', t('rel.outdated', { n: x.missing.length })),
  rewritten: x => badge('b-warn', t('rel.rewritten')),
  deleted: x => badge('b-mute', t('rel.deleted')),
};
// ---- pre-release checklist: automatic checks from the git data + manual ticks (kept in this browser per release)
const REL_TICKS = (() => { try { return JSON.parse(localStorage.getItem('gbt-relchecks') || '{}'); } catch (e) { return {}; } })();
function releaseChecks(r, sec) {
  const ov = S.ov, main = ov.main, envs = ov.envNames;
  const stg = envs.includes('staging') ? 'staging' : envs[envs.length - 1];     // where the customer tests
  const inc = r.included.filter(x => x.state !== 'deleted');
  const list = xs => xs.map(x => x.short.replace(/^(feature|hotfix|bugfix)\//, '')).join(', ');
  const notLatest = inc.filter(x => x.state !== 'latest'), notOnStg = stg ? inc.filter(x => (x.env || {})[stg] !== 'full') : [];
  const ticks = REL_TICKS[r.name] || {};
  const items = [
    { id: 'latest', ok: !notLatest.length, label: t('chk.latest'), bad: t('chk.latestBad', { list: list(notLatest) }), go: 'features' },
    stg && { id: 'staging', ok: !notOnStg.length, label: t('chk.staging', { e: stg }), bad: t('chk.stagingBad', { list: list(notOnStg), e: stg }), go: 'features' },
    { id: 'envMerges', ok: !r.envMerges.length, label: t('chk.envMerges'), bad: t('chk.envMergesBad', { n: r.envMerges.length }), go: 'envmerges' },
    { id: 'conflict', ok: !(r.conflicts && r.conflicts.length), label: t('chk.conflict', { main }), bad: t('chk.conflictBad', { main, list: (r.conflicts || []).join(', ') }) },
    { id: 'behind', ok: !r.behind, label: t('chk.behind', { main }), bad: t('chk.behindBad', { n: r.behind, main }),
      cmd: `git checkout ${r.name}\ngit pull\ngit merge --no-ff ${ov.remote}/${main}\ngit push` },
    r.direct.length && { id: 'direct', manual: true, label: t('chk.direct', { n: r.direct.length }), go: 'direct' },
    { id: 'uat', manual: true, label: t('chk.uat') },
    { id: 'notes', manual: true, label: t('chk.notes'), go: 'notes' },
  ].filter(Boolean);
  items.forEach(x => { if (x.manual) x.ok = !!ticks[x.id]; });
  const open = items.filter(x => !x.ok).length;
  const badgeHtml = open ? badge('b-warn', t('chk.pending', { n: open })) : badge('b-ok', t('chk.ready'));
  const li = x => {
    const jump = x.go ? ` <a href="#" class="small" data-jump="${esc(sec(x.go))}">${esc(t('chk.jump'))}</a>` : '';
    if (x.manual) return `<li class="${x.ok ? 'ok' : 'todo'}"><label class="chk"><input type="checkbox" data-relchk="${esc(r.name)}|${x.id}" ${x.ok ? 'checked' : ''}> <span>${esc(x.label)}</span></label>${jump}</li>`;
    return `<li class="${x.ok ? 'ok' : 'bad'}"><span class="ic">${x.ok ? '✓' : '✗'}</span><div><span>${esc(x.label)}</span>${x.ok ? '' : `<div class="small">${esc(x.bad)}${jump}</div>${x.cmd ? copyBtn(x.cmd) : ''}`}</div></li>`;
  };
  const html = `<div class="relchk ${open ? 'open' : 'done'}">
    <div class="row"><b style="flex:1">${esc(t('chk.title'))}</b>${badgeHtml}</div>
    <ul>${items.filter(x => !x.manual).map(li).join('')}</ul>
    <div class="small muted" style="margin:8px 0 2px">${esc(t('chk.manualHint'))}</div>
    <ul>${items.filter(x => x.manual).map(li).join('')}</ul></div>`;
  return { html, badge: badgeHtml, open };
}
function vReleases() {
  const ov = S.ov, rs = ov.releases || [];
  $('#main').innerHTML = topbar(t('rel.title')) + (rs.length
    ? `<div class="grid">${rs.map(releaseSection).join('')}</div>`
    : `<div class="section"><div class="empty">${esc(t('rel.none', { main: ov.main }))}</div></div>`);
  $('#main').querySelectorAll('[data-relrow]').forEach(tr => tr.addEventListener('click', ev => {
    if (ev.target.closest('a')) return;
    const k = tr.dataset.relrow; S.openRows.has(k) ? S.openRows.delete(k) : S.openRows.add(k); vReleases();
  }));
  $('#main').querySelectorAll('[data-relchk]').forEach(cb => cb.addEventListener('change', () => {
    const [rel, id] = cb.dataset.relchk.split('|');
    (REL_TICKS[rel] = REL_TICKS[rel] || {})[id] = cb.checked;
    try { localStorage.setItem('gbt-relchecks', JSON.stringify(REL_TICKS)); } catch (e) {}
    const y = window.scrollY; vReleases(); window.scrollTo(0, y);
  }));
  $('#main').querySelectorAll('[data-jump]').forEach(a => a.addEventListener('click', ev => {
    ev.preventDefault(); const el = document.getElementById(a.dataset.jump); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}
function releaseSection(r) {
  const ov = S.ov, main = ov.main, envs = ov.envNames;
  const inc = r.included.slice().sort((a, b) => ['outdated', 'rewritten', 'deleted', 'latest'].indexOf(a.state) - ['outdated', 'rewritten', 'deleted', 'latest'].indexOf(b.state) || a.short.localeCompare(b.short));
  const nBad = inc.filter(x => x.state === 'outdated').length;
  const base = r.behind ? badge('b-warn', t('rel.behind', { n: r.behind, main })) : badge('b-ok', t('rel.basedOn', { main }));
  const conf = r.conflicts == null ? '' : r.conflicts.length ? badge('b-bad', t('rel.conflicts', { main, n: r.conflicts.length })) : badge('b-ok', t('rel.noConflict', { main }));
  const envCell = s => s === 'full' ? badge('b-ok', t('f.latest')) : s === 'old' ? badge('b-warn', t('f.oldVersion')) : '<span class="muted">—</span>';
  const rows = inc.map(x => {
    const key = r.name + '|' + x.short, open = S.openRows.has(key), canOpen = x.state === 'outdated' || x.state === 'rewritten';
    let h = `<tr ${canOpen ? `data-relrow="${esc(key)}" style="cursor:pointer"` : ''}><td class="mono">${canOpen ? (open ? '▾ ' : '▸ ') : ''}${brLink(x.short)}</td><td>${esc((x.authors || []).join(', '))}</td><td>${REL_STATE[x.state](x)}</td>${envs.map(e => `<td>${envCell((x.env || {})[e])}</td>`).join('')}<td>${esc(x.title || '')}</td></tr>`;
    if (open && canOpen) {
      const cmd = `git checkout ${r.name}\ngit pull\ngit merge --no-ff ${ov.remote}/${x.short}\ngit push`;
      h += `<tr class="expand"><td colspan="${4 + envs.length}"><div class="grid" style="gap:8px;padding:4px 0">
        ${x.state === 'outdated' ? `<div><b>${esc(t('rel.missingT'))}</b><table style="margin-top:4px"><tbody>${x.missing.map(c => `<tr><td class="mono">${esc(c.h)}</td><td class="nw">${esc(c.d)}</td><td>${esc(c.a)}</td><td>${esc(c.s)}</td></tr>`).join('')}</tbody></table></div>`
          : `<div class="small">${esc(t('rel.rewrittenD'))}</div>`}
        <div><b>${esc(t('rel.fix'))}</b>${copyBtn(cmd)}</div></div></td></tr>`;
    }
    return h;
  }).join('');
  const notes = [r.name, ...inc.map(x => {
    const label = x.short.replace(/^(feature|hotfix|bugfix)\//, '');
    return !x.title ? `- ${label}` : x.title.includes(label) ? `- ${x.title}` : `- ${label}: ${x.title}`;
  })].join('\n');
  const sec = name => `rel-${r.name.replace(/[^A-Za-z0-9]/g, '-')}-${name}`, chk = releaseChecks(r, sec);
  return `<div class="section">
    <header><h2>${esc(r.name)}</h2>${r.local ? badge('b-info', t('rel.local')) : ''}${chk.badge}${base}${conf}<span class="pill">${esc(t('rel.ahead', { n: r.ahead, main }))}</span>
      <div class="hint">${esc(t('e.last'))} ${esc(r.date)} ${esc(r.author)} — ${esc(r.subject)}</div></header>
    <div class="body grid" style="gap:18px">
      ${chk.html}
      ${r.envMerges.length ? `<div id="${sec('envmerges')}"><b style="color:var(--bad)">${esc(t('rel.envMergesT'))}</b><div class="small muted">${esc(t('rel.envMergesD'))}</div><ul class="files">${r.envMerges.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
      <div id="${sec('features')}"><div class="row"><b style="flex:1">${esc(t('rel.featuresT', { n: inc.length }))}</b>${nBad ? badge('b-bad', t('rel.nOutdated', { n: nBad })) : inc.length ? badge('b-ok', t('rel.allLatest')) : ''}</div>
        <div class="small muted">${esc(t('rel.featuresD'))}</div>
        ${inc.length ? `<div class="tbl-wrap" style="margin-top:6px"><table><thead><tr><th>${esc(t('f.th.branch'))}</th><th>${esc(t('f.th.owner'))}</th><th>${esc(t('rel.th.state'))}</th>${envs.map(e => `<th>${esc(e)}</th>`).join('')}<th>${esc(t('rel.th.title'))}</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">${esc(t('rel.noFeatures'))}</div>`}</div>
      <div id="${sec('direct')}"><b>${esc(t('rel.directT', { n: r.direct.length }))}</b><div class="small muted">${esc(t('rel.directD'))}</div>
        ${r.direct.length ? `<table style="margin-top:6px"><tbody>${r.direct.map(c => `<tr><td class="mono">${esc(c.h)}</td><td class="nw">${esc(c.d)}</td><td>${esc(c.a)}</td><td>${esc(c.s)}</td></tr>`).join('')}</tbody></table>` : `<div class="small" style="margin-top:4px">${badge('b-ok', t('rel.noDirect'))}</div>`}</div>
      <div><b>${esc(t('rel.candT', { n: r.candidates.length }))}</b><div class="small muted">${esc(t('rel.candD'))}</div>
        ${r.candidates.length ? `<div class="tbl-wrap" style="margin-top:6px"><table><thead><tr><th>${esc(t('f.th.branch'))}</th><th>${esc(t('f.th.owner'))}</th>${envs.map(e => `<th>${esc(e)}</th>`).join('')}<th>${esc(t('f.th.conflict', { main }))}</th></tr></thead><tbody>${r.candidates.map(c => `<tr><td>${brLink(c.short)}</td><td>${esc(c.authors.join(', '))}</td>${envs.map(e => `<td>${envCell(c.env[e])}</td>`).join('')}<td>${c.conflicts == null ? '?' : c.conflicts.length ? badge('b-bad', t('f.files', { n: c.conflicts.length })) : badge('b-ok', t('none'))}</td></tr>`).join('')}</tbody></table></div>` : ''}</div>
      <div id="${sec('notes')}"><b>${esc(t('rel.notesT'))}</b><div class="small muted">${esc(t('rel.notesD'))}</div>${copyBtn(notes)}</div>
    </div></div>`;
}
