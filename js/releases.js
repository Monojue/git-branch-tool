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
  $('#main').innerHTML = topbar(t('rel.title')) + `<div class="grid">${mergeOrderSection()}${rs.length
    ? rs.map(releaseSection).join('')
    : `<div class="section"><div class="empty">${esc(t('rel.none', { main: ov.main }))}</div></div>`}</div>`;
  bindMergeOrder();
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
// ---- merge order suggestion: features entered like pull requests -> the order with the fewest conflicts
const MO = (() => { try { return JSON.parse(localStorage.getItem('gbt-mergeorder') || '{}'); } catch (e) { return {}; } })();
const saveMO = () => { try { localStorage.setItem('gbt-mergeorder', JSON.stringify({ base: MO.base, text: MO.text })); } catch (e) {} };
const shortName = b => b.replace(/^(feature|hotfix|bugfix)\//, '');
// "1098 1103, feature/PROJ-1131" -> branch names; a number matches the branch that ends with it
function moResolve(text) {
  const names = S.ov.features.map(f => f.short), found = [], unknown = [], ambiguous = [];
  for (const tok of text.split(/[\s,、]+/).filter(Boolean)) {
    let m = names.filter(n => n === tok);
    if (!m.length) m = names.filter(n => shortName(n) === tok || n.endsWith('-' + tok) || n.endsWith('/' + tok));
    if (!m.length) m = names.filter(n => n.toLowerCase().includes(tok.toLowerCase()));
    if (m.length === 1) { if (!found.includes(m[0])) found.push(m[0]); }
    else (m.length ? ambiguous : unknown).push(tok);
  }
  return { found, unknown, ambiguous };
}
function mergeOrderSection() {
  const ov = S.ov, rels = ov.releases || [];
  if (!MO.base || (MO.base !== ov.main && !rels.some(r => r.name === MO.base))) MO.base = ov.main;
  const picked = moResolve(MO.text || '').found;
  const pickList = ov.features.map(f => `<label class="chk" style="padding:3px 0"><input type="checkbox" data-mopick value="${esc(f.short)}" ${picked.includes(f.short) ? 'checked' : ''}><span class="mono">${esc(f.short)}</span></label>`).join('');
  return `<div class="section" id="mergeOrder">
    <header><h2>${esc(t('mo.title'))}</h2><div class="hint">${esc(t('mo.desc'))}</div></header>
    <div class="body grid" style="gap:12px">
      <div class="row mo-form">
        <label class="field"><span>${esc(t('mo.target'))}</span><select id="moBase">
          <option value="${esc(ov.main)}" ${MO.base === ov.main ? 'selected' : ''}>${esc(t('mo.newRelease', { main: ov.main }))}</option>
          ${rels.map(r => `<option value="${esc(r.name)}" ${MO.base === r.name ? 'selected' : ''}>${esc(r.name)}${r.local ? ' — ' + esc(t('rel.local')) : ''}</option>`).join('')}
        </select></label>
        <label class="field" style="flex:1 1 320px"><span>${esc(t('mo.input'))}</span><input type="text" id="moText" value="${esc(MO.text || '')}" placeholder="${esc(t('mo.placeholder'))}"></label>
        <button class="btn primary" id="moRun">${esc(t('mo.run'))}</button>
      </div>
      <details class="mo-pick" ${MO.pickOpen ? 'open' : ''}><summary class="small">${esc(t('mo.pick', { n: picked.length }))}</summary><div style="columns:2 260px;margin-top:6px">${pickList}</div></details>
      ${MO.result ? mergeOrderResult(MO.result) : ''}
    </div></div>`;
}
function bindMergeOrder() {
  const text = $('#moText'); if (!text) return;
  $('#moBase').addEventListener('change', ev => { MO.base = ev.target.value; MO.result = null; saveMO(); vReleases(); });
  text.addEventListener('input', () => { MO.text = text.value; saveMO(); });
  text.addEventListener('keydown', ev => { if (ev.key === 'Enter') $('#moRun').click(); });
  $('.mo-pick').addEventListener('toggle', ev => { MO.pickOpen = ev.target.open; });
  $('#main').querySelectorAll('[data-mopick]').forEach(cb => cb.addEventListener('change', () => {
    const cur = moResolve(text.value).found;
    const next = cb.checked ? [...cur, cb.value] : cur.filter(b => b !== cb.value);
    MO.text = next.map(shortName).join(' '); saveMO();
    const y = window.scrollY; vReleases(); window.scrollTo(0, y);
  }));
  $('#moRun').addEventListener('click', async ev => {
    MO.text = text.value; saveMO();
    const r = moResolve(MO.text);
    if (r.unknown.length) return toast(t('mo.unknown', { list: r.unknown.join(', ') }));
    if (r.ambiguous.length) return toast(t('mo.ambiguous', { list: r.ambiguous.join(', ') }));
    if (!r.found.length) return toast(t('mo.empty'));
    ev.currentTarget.disabled = true; ev.currentTarget.innerHTML = spin(t('mo.running'));
    try { MO.result = await api('/api/merge-order', { base: MO.base, branches: r.found }); } catch (err) { toast(err.message); }
    if (S.tab === 'releases') vReleases();
  });
}
function mergeOrderResult(p) {
  const ov = S.ov, base = p.base, isMain = base === ov.main;
  const files = fs => `<ul class="files" style="margin:0">${fs.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`;
  const pairs = p.pairs.filter(x => x.type === 'order'), both = p.pairs.filter(x => x.type === 'both');
  const confBadge = n => badge(n ? 'b-bad' : 'b-ok', t('mo.conf', { n }));
  const same = p.steps.map(s => s.branch).join() === p.enteredSteps.map(s => s.branch).join();
  // why a branch sits where it is
  const why = b => [
    ...pairs.filter(x => x.then === b).map(x => t('mo.after', { b: shortName(x.first) })),
    both.some(x => x.a === b || x.b === b) && t('mo.whyBoth'),
    p.withBase.some(x => x.branch === b) && t('mo.whyBase', { base }),
  ].filter(Boolean).join(' / ');
  const rows = p.steps.map((s, i) => `<tr><td>${i + 1}</td><td class="mono">${brLink(s.branch)}</td><td>${s.ok ? badge('b-ok', t('mo.clean')) : badge('b-bad', t('mo.conflictStep'))}${s.files ? files(s.files) : ''}</td><td class="small muted">${esc(why(s.branch))}</td></tr>`).join('');
  const start = isMain ? `git checkout -b release/YYYYMMDD ${ov.remote}/${base}` : `git checkout ${base}` + (p.local ? '' : '\ngit pull');
  const cmds = [start, ...p.steps.map(s => `git merge --no-ff --no-edit ${ov.remote}/${s.branch}` + (s.ok ? '' : `\n# ${t('mo.cmdConflict', { files: s.files.join(', ') })}`)), `git push -u ${ov.remote} HEAD`].join('\n');
  return `<div class="mo-result grid" style="gap:16px">
    <div class="row">${esc(t('mo.yours'))} ${confBadge(p.enteredConflicts)} → ${esc(t('mo.suggested'))} ${confBadge(p.conflicts)}
      ${same ? `<span class="small muted">${esc(t('mo.same'))}</span>` : ''}</div>
    ${p.steps.length ? `<div><b>${esc(t('mo.orderT'))}</b><table style="margin-top:6px"><tbody>${rows}</tbody></table>
      ${p.steps.some(s => !s.ok) ? `<div class="small muted" style="margin-top:4px">${esc(t('mo.afterConflict'))}</div>` : ''}</div>` : ''}
    ${pairs.length ? `<div><b>${esc(t('mo.pairsT'))}</b><div class="small muted">${esc(t('mo.pairsD', { main: ov.main }))}</div>
      <ul class="mo-pairs">${pairs.map(x => `<li><div>${badge('b-ok', `${shortName(x.first)} → ${shortName(x.then)}`)} ${esc(t('mo.noConflict'))}</div>
        <div>${badge('b-bad', `${shortName(x.then)} → ${shortName(x.first)}`)} ${esc(t('mo.conflictIn'))}${files(x.files)}</div></li>`).join('')}</ul></div>` : ''}
    ${both.length ? `<div><b>${esc(t('mo.bothT'))}</b><div class="small muted">${esc(t('mo.bothD'))}</div>
      <ul class="mo-pairs">${both.map(x => `<li><div>${badge('b-warn', `${shortName(x.a)} + ${shortName(x.b)}`)}</div>${files(x.files)}</li>`).join('')}</ul></div>` : ''}
    ${p.withBase.length ? `<div><b>${esc(t('mo.baseT', { base }))}</b><div class="small muted">${esc(t('mo.baseD', { base }))}</div>
      <ul class="mo-pairs">${p.withBase.map(x => `<li><div class="mono">${brLink(x.branch)}</div>${files(x.files)}</li>`).join('')}</ul></div>` : ''}
    ${!pairs.length && !both.length && !p.withBase.length && p.steps.length ? `<div>${badge('b-ok', t('mo.none'))}</div>` : ''}
    ${p.already.length ? `<div class="small"><b>${esc(t('mo.alreadyT', { base }))}</b> <span class="mono">${esc(p.already.join(', '))}</span></div>` : ''}
    ${p.steps.length ? `<div><b>${esc(t('mo.cmdT'))}</b>${copyBtn(cmds)}</div>` : ''}
  </div>`;
}
