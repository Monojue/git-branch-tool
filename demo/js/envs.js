// Git Branch Tool — Environments screen: lost-code check and rebuild preview.
// ============================================================ environments
function vEnvs() {
  const ov = S.ov;
  $('#main').innerHTML = topbar(t('e.title')) + `<div class="grid">${ov.envs.map(envSection).join('')}</div>`;
  ov.envs.forEach(e => {
    // Run check: fetch the latest data from the remote first, refresh everything, then check
    $(`#chk-${e.name}`).addEventListener('click', async ev => {
      const b = ev.currentTarget; b.disabled = true; b.innerHTML = spin(t('e.fetchingFirst'));
      let fetched = false;
      try { fetched = (await api('/api/fetch', {})).ok; } catch (err) {}
      try { S.ov = await api('/api/overview?refresh=1'); S.graph = null; updateSidebar(); } catch (err) {}
      b.innerHTML = spin(t('e.checking'));
      try {
        const r = await api('/api/env-check?env=' + encodeURIComponent(e.name));
        S.results['check-' + e.name] = { ...r, fetched, checkedAt: new Date().toTimeString().slice(0, 5) };
        S.lcOpen['res|' + e.name] = true;
      } catch (err) { toast(err.message); }
      if (S.tab === 'envs') vEnvs();
    });
    // remember which parts of the result are open
    document.querySelectorAll(`details[data-key^="res|${e.name}"], details[data-key^="file|${e.name}|"]`).forEach(d => d.addEventListener('toggle', () => { S.lcOpen[d.dataset.key] = d.open; }));
    document.querySelectorAll(`[data-lcall="${e.name}"]`).forEach(btn => btn.addEventListener('click', () => {
      const open = btn.dataset.v === '1';
      document.querySelectorAll(`details[data-key^="file|${e.name}|"]`).forEach(d => { d.open = open; S.lcOpen[d.dataset.key] = open; });
    }));
    $(`#rb-${e.name}`).addEventListener('click', async ev => {
      const picked = [...document.querySelectorAll(`input[data-rb="${e.name}"]:checked`)].map(i => i.value);
      S.results['pick-' + e.name] = picked;
      ev.currentTarget.disabled = true; ev.currentTarget.innerHTML = spin(t('e.rbRunning'));
      try { S.results['rb-' + e.name] = await api('/api/rebuild-preview', { env: e.name, branches: picked }); } catch (err) { toast(err.message); }
      if (S.tab === 'envs') vEnvs();
    });
  });
}
function envSection(e) {
  const ov = S.ov, main = ov.main, check = S.results['check-' + e.name], rb = S.results['rb-' + e.name];
  const picked = S.results['pick-' + e.name] || e.tickets.map(x => x.short);
  const health = e.mergeBases > 1 ? badge('b-warn', t('e.tangled', { n: e.mergeBases })) : e.behind ? badge('b-warn', t('e.behind', { n: e.behind, main })) : badge('b-ok', t('e.upToDate', { main }));
  const pickList = ov.features.map(f => `<label class="chk" style="padding:3px 0"><input type="checkbox" data-rb="${esc(e.name)}" value="${esc(f.short)}" ${picked.includes(f.short) ? 'checked' : ''}><span class="mono">${esc(f.short)}</span>${f.conflicts && f.conflicts.length ? badge('b-bad', t('e.conflictsMain', { main })) : ''}</label>`).join('');
  const cmds = `git checkout ${e.name}\ngit reset --hard ${ov.remote}/${main}\n` + picked.map(b => `git merge --no-ff --no-edit ${ov.remote}/${b}`).join('\n') + `\ngit push --force-with-lease ${ov.remote} ${e.name}`;
  return `<div class="section">
    <header><h2>${esc(e.name)}</h2>${health}<span class="pill">${esc(t('e.aheadBehind', { a: e.ahead, b: e.behind, main }))}</span><span class="pill">${esc(t('e.merges', { n: e.merges }))}</span>
      <div class="hint">${esc(t('e.last'))} ${esc(e.date)} ${esc(e.author)} — ${esc(e.subject)}</div></header>
    <div class="body grid" style="gap:16px">
      <div><b>${esc(t('e.features', { e: e.name }))}</b><div class="row" style="margin-top:6px">${e.tickets.length ? e.tickets.map(x => badge(x.state === 'full' ? 'b-ok' : 'b-warn', x.short + (x.state === 'old' ? t('e.oldMark') : ''))).join(' ') : `<span class="muted">${esc(t('none'))}</span>`}</div></div>

      <div><div class="row"><b style="flex:1">${esc(t('e.check'))}</b><button class="btn" id="chk-${esc(e.name)}">${esc(t('e.checkBtn'))}</button></div>
        <div class="small muted">${esc(t('e.checkD', { e: e.name, main }))}</div>
        ${check ? checkResult(check) : ''}</div>

      <div><div class="row"><b style="flex:1">${esc(t('e.rb'))}</b><button class="btn primary" id="rb-${esc(e.name)}">${esc(t('e.rbBtn'))}</button></div>
        <div class="small muted">${esc(t('e.rbD', { main }))}</div>
        <div style="columns:2 260px;margin-top:8px">${pickList}</div>
        ${rb ? rebuildResult(rb, cmds) : ''}</div>
    </div></div>`;
}
// Lost-code check result: a one-sentence answer, the breakdown, then one card per problem file
function checkResult(c) {
  const env = c.env, main = c.main, P = { e: env, main };
  const miss = c.problems.filter(p => p.missingCount), unk = c.problems.filter(p => !p.missingCount);
  const when = `<div class="small lc-when">${esc(c.fetched ? t('lc.checkedAt', { time: c.checkedAt }) : t('lc.checkedOld', { time: c.checkedAt }))}</div>`;
  // the verdict is the clickable summary line of the whole result
  const verdict = !c.problems.length
    ? `<div class="lc-sum ok"><span class="chev">▸</span><div class="lc-ic">✅</div><div style="flex:1"><b>${esc(t('lc.okT', P))}</b><div>${esc(t('lc.okD', { ...P, n: c.filesDiffering, f: c.features.length }))}</div>${when}</div></div>`
    : `<div class="lc-sum warn"><span class="chev">▸</span><div class="lc-ic">⚠️</div><div style="flex:1"><b>${esc(t('lc.badT', { ...P, n: c.problems.length }))}</b>
        <ul>${miss.length ? `<li>🔴 ${esc(t('lc.badMissing', { ...P, n: miss.length }))}</li>` : ''}${unk.length ? `<li>🟡 ${esc(t('lc.badUnknown', { ...P, n: unk.length }))}</li>` : ''}</ul>
        <div class="small">${esc(t('lc.badRest', { ...P, n: c.explainedFiles }))}</div>${when}</div></div>`;
  let h = '';
  if (c.behind && c.problems.some(p => p.releasedSince.length)) {
    const cmd = `git checkout ${env}\ngit pull\ngit merge --no-ff ${c.remote}/${main}\ngit push`;
    h += `<div class="lc-sum info"><div class="lc-ic">💡</div><div style="flex:1;min-width:0"><b>${esc(t('lc.behindT', { ...P, n: c.behind }))}</b>
      <div>${esc(t('lc.behindD', P))}</div>${copyBtn(cmd)}</div></div>`;
  }
  if (c.problems.length > 1) h += `<div class="row" style="justify-content:flex-end;margin:6px 0"><button class="btn sm" data-lcall="${esc(env)}" data-v="1">${esc(t('lc.expandAll'))}</button><button class="btn sm" data-lcall="${esc(env)}" data-v="0">${esc(t('lc.collapseAll'))}</button></div>`;
  h += c.problems.map(p => problemCard(p, c)).join('');
  h += `<details class="lc-det"><summary>${esc(t('lc.breakdownT', { n: c.explainedFiles }))}</summary>
    <table><thead><tr><th>${esc(t('lc.th.feature'))}</th><th>${esc(t('lc.th.files'))}</th></tr></thead><tbody>
    ${c.features.map(f => `<tr><td class="mono">${esc(f.short)}</td><td>${f.files}</td></tr>`).join('')}
    ${c.trivialFiles ? `<tr><td class="muted">${esc(t('lc.trivial'))}</td><td>${c.trivialFiles}</td></tr>` : ''}</tbody></table>
    <div class="small muted">${esc(t('lc.breakdownD'))}</div></details>`;
  h += `<details class="lc-det"><summary>${esc(t('lc.howT'))}</summary>${t('lc.howBody', { e: esc(env), main: esc(main), paths: esc(c.paths.join(', ')) })}</details>`;
  const key = 'res|' + env, open = S.lcOpen[key] ?? true;
  return `<details class="lc-res" data-key="${esc(key)}" ${open ? 'open' : ''}><summary title="${esc(t('lc.toggle'))}">${verdict}</summary><div class="lc-body">${h}</div></details>`;
}
function problemCard(p, c) {
  const env = c.env, main = c.main, ov = S.ov, P = { e: env, main };
  const badges = (p.missingCount ? badge('b-bad', t('lc.missingBadge', { n: p.missingCount })) + ' ' : '') + (p.extraCount ? badge('b-warn', t('lc.extraBadge', { n: p.extraCount })) : '');
  const expl = [p.missingCount ? t('lc.missingExpl', P) : '', p.extraCount ? t('lc.extraExpl', P) : ''].filter(Boolean);
  const diff = p.hunks.map(hk => `<div class="lc-hunk">${esc(hk.header)}</div>` + hk.lines.map(l => {
    const cls = l.t === '-' ? 'del' : l.t === '+' ? 'add' : 'ctx';
    return `<div class="lc-l ${cls}${l.bad ? ' bad' : ''}"><span class="lc-s">${l.t === ' ' ? '&nbsp;' : l.t === '-' ? '−' : '+'}</span><span class="lc-c">${esc(l.s) || '&nbsp;'}</span>${l.bad ? '<span class="lc-m">◀</span>' : ''}</div>`;
  }).join('')).join('');
  const restore = `git checkout ${env}\ngit pull\ngit checkout ${ov.remote}/${main} -- ${p.file}\ngit commit -m "Restore ${p.file} from ${main}"\ngit push`;
  const key = `file|${env}|${p.file}`, open = S.lcOpen[key] ?? false;
  const notMerged = p.releasedSince.length ? ' ' + badge('b-info', t('lc.notMergedYet', P)) : '';
  return `<details class="lc-card" data-key="${esc(key)}" ${open ? 'open' : ''}>
    <summary class="row"><span class="chev">▸</span><b class="mono" style="flex:1;word-break:break-all">${esc(p.file)}</b>${badges}${notMerged}</summary>
    ${expl.map(x => `<p>${esc(x)}</p>`).join('')}
    <p class="small muted">${esc(p.touching.length ? t('lc.touching', { list: p.touching.join(', ') }) : t('lc.touchingNone', P))}</p>
    <div class="small"><b>${esc(t('lc.diffT', P))}</b> <span class="lc-leg del">${esc(t('lc.legendDel', P))}</span> <span class="lc-leg add">${esc(t('lc.legendAdd', P))}</span> <span class="lc-leg bad">◀ ${esc(t('lc.legendBad'))}</span></div>
    <div class="lc-diff">${diff}</div>
    <div class="small muted">${esc(t('lc.more'))}</div>
    ${p.commits.length ? `<div class="small" style="margin-top:8px"><b>${esc(t('lc.commitsT', P))}</b><table><tbody>${p.commits.map(x => `<tr><td class="mono">${esc(x.h)}</td><td class="nw">${esc(x.d)}</td><td>${esc(x.a)}</td><td>${esc(x.s)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${p.releasedSince.length ? `<div class="small" style="margin-top:8px"><b>${esc(t('lc.sinceT', P))}</b><table><tbody>${p.releasedSince.map(x => `<tr><td class="mono">${esc(x.h)}</td><td class="nw">${esc(x.d)}</td><td>${esc(x.a)}</td><td>${esc(x.s)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div style="margin-top:8px"><b>${esc(t('lc.fixT'))}</b>
      ${p.releasedSince.length ? `<p class="small" style="margin:4px 0">${esc(t('lc.fixMerge', P))}</p>`
        : p.touching.length ? `<p class="small" style="margin:4px 0">${esc(t('lc.fixManual', { ...P, list: p.touching.join(', ') }))}</p>`
        : `<p class="small" style="margin:4px 0">${esc(t('lc.fixRestore', P))}</p>${copyBtn(restore)}`}</div>
  </details>`;
}
function rebuildResult(rb, cmds) {
  const ov = S.ov, bad = rb.steps.filter(s => !s.ok);
  const summary = rb.diffSummary === 'identical' ? t('r.identical') : rb.diffSummary;
  return `<div style="margin-top:10px">
    <div class="row">${bad.length ? badge('b-bad', t('r.conflict', { n: bad.length })) : badge('b-ok', t('r.ok'))} <span class="small muted">${esc(t('r.vs', { e: rb.env, s: summary }))}</span></div>
    <table style="margin-top:6px"><tbody>${rb.steps.map(s => `<tr><td class="mono">${esc(s.branch)}</td><td>${s.ok ? badge('b-ok', t('r.merged')) : badge('b-bad', t('r.conflictOne'))}</td><td>${s.files ? `<ul class="files" style="margin:0">${s.files.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}</td></tr>`).join('')}</tbody></table>
    ${bad.length ? `<p class="small muted">${esc(t('r.fixFirst', { main: ov.main }))}</p>` :
      `<p class="small" style="margin-bottom:0"><b>${esc(t('r.ready'))}</b> ${esc(t('r.readyD', { e: rb.env, cmd: `git reset --hard ${ov.remote}/${rb.env}` }))}</p>${copyBtn(cmds)}`}
    ${rb.diffStat.length ? `<details style="margin-top:6px"><summary class="small muted">${esc(t('r.files', { e: rb.env }))}</summary><pre class="log">${esc(rb.diffStat.join('\n'))}</pre></details>` : ''}
  </div>`;
}
