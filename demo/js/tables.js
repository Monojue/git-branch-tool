// Git Branch Tool — Sorting of feature tables, Backlog issue links and the issue preview dialog.
// ============================================================ sorting of feature tables
const SORT = (() => { try { return JSON.parse(localStorage.getItem('gbt-sort') || '{}'); } catch (e) { return {}; } })();
const ticketNum = f => { const m = (f.short || '').match(/(\d+)(?!.*\d)/); return m ? +m[1] : 0; };
const envRank = s => s === 'full' ? 2 : s === 'old' ? 1 : 0;
const relRank = f => { let r = 0; (S.ov.releases || []).forEach(x => { const i = x.included.find(y => y.short === f.short); if (i) r = Math.max(r, i.state === 'latest' ? 2 : 1); }); return r; };
const FEAT_SORT = {
  branch: f => ticketNum(f), owner: f => f.authors.join(', ').toLowerCase(), date: f => f.date, commits: f => f.ahead, base: f => f.behind,
  conflict: f => f.conflicts == null ? -1 : f.conflicts.length, release: relRank, contains: f => f.contains.length,
  envs: f => S.ov.envNames.reduce((n, e) => n + envRank(f.env[e]), 0),
};
const MATRIX_SORT_DEF = { overview: { key: 'envs', dir: 'desc' } };
const sortVal = (key, f) => key.startsWith('env:') ? envRank(f.env[key.slice(4)]) : (FEAT_SORT[key] || FEAT_SORT.branch)(f);
function sortFeatures(rows, table, def) {
  const st = SORT[table] || def;
  return rows.slice().sort((a, b) => {
    const x = sortVal(st.key, a), y = sortVal(st.key, b), c = x < y ? -1 : x > y ? 1 : 0;
    return (st.dir === 'desc' ? -c : c) || ticketNum(a) - ticketNum(b);
  });
}
// a clickable column header: ▲ ascending, ▼ descending, ↕ not sorted by this column
function sortTh(table, def, key, label) {
  const st = SORT[table] || def, on = st.key === key;
  return `<th class="sortable${on ? ' on' : ''}" data-sort="${esc(table)}|${esc(key)}" title="${esc(t('sort.hint'))}">${label}<span class="sarrow">${on ? (st.dir === 'desc' ? '▼' : '▲') : '↕'}</span></th>`;
}
function bindSort(root, defs, rerender) {
  root.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => {
    const [table, key] = th.dataset.sort.split('|'), st = SORT[table] || defs[table];
    const numeric = ['date', 'commits', 'base', 'conflict', 'release', 'contains', 'envs'].includes(key) || key.startsWith('env:');
    SORT[table] = { key, dir: st.key === key ? (st.dir === 'asc' ? 'desc' : 'asc') : (numeric ? 'desc' : 'asc') };
    try { localStorage.setItem('gbt-sort', JSON.stringify(SORT)); } catch (e) {}
    rerender();
  }));
}

// ============================================================ issue links and previews
// The issue key comes from the branch name (feature/PROJ-978 -> PROJ-978); the link template is a repository setting.
// Branch name = link to the issue (new tab); the small button next to it opens a preview dialog.
const issueKeyOf = name => (String(name).match(/[A-Z][A-Z0-9_]*-\d+/) || [])[0] || null;
const ICON_PREVIEW = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 11.5 11.5 4.5"/><path d="M5.5 4.5h6v6"/></svg>';   // arrow-up-right
function brLink(name) {
  const key = issueKeyOf(name), url = S.ov && S.ov.issueUrl;
  if (!key || !url) return `<span class="mono">${esc(name)}</span>`;
  return `<span class="br"><a class="mono br-link" href="${esc(url.replace('{key}', encodeURIComponent(key)))}" target="_blank" rel="noopener">${esc(name)}</a>` +
    `<button class="btn-ic" data-issue="${esc(key)}" title="${esc(t('iss.preview'))}" aria-label="${esc(t('iss.preview'))}">${ICON_PREVIEW}</button></span>`;
}
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('button[data-issue]');
  if (!b) return;
  ev.preventDefault(); ev.stopPropagation();
  openIssue(b.dataset.issue);
}, true);
const ISSUES = new Map();
// small text formatting for Backlog text: keep line breaks, make URLs clickable
const issueText = s => esc(s).replace(/https?:\/\/[^\s<>"']+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
async function openIssue(key) {
  const dlg = $('#dlg'), url = S.ov && S.ov.issueUrl ? S.ov.issueUrl.replace('{key}', encodeURIComponent(key)) : null;
  dlg.classList.add('wide');
  dlg.addEventListener('close', () => dlg.classList.remove('wide'), { once: true });
  $('#dlgTitle').innerHTML = `<span class="mono">${esc(key)}</span>`;
  $('#dlgBody').innerHTML = `<div class="loading">${spin(t('loading'))}</div>`;
  $('#dlgFoot').innerHTML = `${url ? `<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener">${esc(t('iss.openBtn'))} ↗</a>` : ''}<button class="btn" id="dlgClose">${esc(t('cf.close'))}</button>`;
  $('#dlgClose').onclick = () => dlg.close();
  if (!dlg.open) dlg.showModal();
  let d = ISSUES.get(key);
  if (!d) { try { d = await api('/api/issue?key=' + encodeURIComponent(key)); if (!d.noApiKey) ISSUES.set(key, d); } catch (e) { d = { key, error: e.message }; } }
  if (!dlg.open) return;
  if (d.error || d.noApiKey || d.notFound || d.noLink) {
    const msg = d.error ? `<p style="color:var(--bad)">${esc(d.error)}</p>` : d.notFound ? `<p>${esc(t('iss.notFound'))}</p>` : `<p>${esc(t('iss.noKey'))}</p>`;
    $('#dlgBody').innerHTML = msg + (d.noApiKey || d.error ? `<p><button class="btn" id="issSettings">${esc(t('iss.toSettings'))}</button></p>` : '');
    const b = $('#issSettings'); if (b) b.onclick = () => { dlg.close(); openRepoDialog(); };
    return;
  }
  const chip = (txt, color) => txt ? `<span class="iss-chip" style="background:${esc(color || 'var(--muted)')}">${esc(txt)}</span>` : '';
  $('#dlgTitle').innerHTML = `<div class="iss-head">${chip(d.type, d.typeColor)}<a class="mono" href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.key)}</a>${chip(d.status, d.statusColor || '#6b7280')}</div><div class="iss-title">${esc(d.summary)}</div>`;
  const rows = [['iss.priority', d.priority], ['iss.assignee', d.assignee], ['iss.milestone', d.milestone], ['iss.category', d.category], ['iss.versions', d.versions],
    ['iss.start', d.start], ['iss.due', d.due], ['iss.estimated', d.estimated != null ? d.estimated + ' h' : ''], ['iss.actual', d.actual != null ? d.actual + ' h' : ''],
    ['iss.createdBy', d.createdBy ? `${d.createdBy} · ${d.created}` : ''], ['iss.updated', d.updated ? `${d.updatedBy ? d.updatedBy + ' · ' : ''}${d.updated}` : '']];
  $('#dlgBody').innerHTML = `
    <div class="iss-grid">${rows.map(([k, v]) => `<div><span>${esc(t(k))}</span><b>${v ? esc(v) : '<span class="muted">—</span>'}</b></div>`).join('')}</div>
    <div class="iss-sec">${esc(t('iss.description'))}${d.attachments ? ` <span class="muted small">· ${esc(t('iss.attachments', { n: d.attachments }))}</span>` : ''}</div>
    <div class="iss-desc">${d.description ? issueText(d.description) : `<span class="muted">—</span>`}</div>
    <div class="iss-sec">${esc(t('iss.comments', { n: d.comments.length }))}</div>
    ${d.comments.length ? d.comments.map(c => `<div class="iss-cmt"><div class="iss-cmt-h"><b>${esc(c.by)}</b><span class="muted small">${esc(c.at)}</span></div><div class="iss-cmt-b">${issueText(c.text)}</div></div>`).join('') : `<div class="muted small">—</div>`}`;
}
