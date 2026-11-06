// Git Branch Tool — Network screen: commit graph, branch / commit search, zoom and selection.
// ============================================================ network
const NET = { range: 3, after: 'full', labels: true };
try { Object.assign(NET, JSON.parse(localStorage.getItem('gbt-net') || '{}')); } catch (e) {}
async function vNetwork() {
  const q = S.netQuery || '';
  $('#main').innerHTML = topbar(t('n.title')) + `
    <div class="net-search">
      <div class="ac"><input type="search" id="nSearch" value="${esc(q)}" placeholder="${esc(t('n.s.ph'))}" autocomplete="off" role="combobox" aria-expanded="false"><div class="ac-list" id="nAc" role="listbox" hidden></div></div>
      <button class="btn primary" id="nGo">${esc(t('n.s.btn'))}</button>
      ${q ? `<button class="btn" id="nClear">${esc(t('n.s.clear'))}</button>` : ''}
      ${q ? `<label class="chk small"><input type="checkbox" id="nCtx" ${NET.ctx !== false ? 'checked' : ''}> ${esc(t('n.s.ctx'))}</label>` : ''}
      <span class="small muted">${esc(t('n.s.hint'))}</span>
    </div>
    ${!q ? '' : `<div class="net-controls">
      <div><span class="small muted">${esc(t('n.period'))} </span><div class="seg" id="nFRange">${[['auto', 'n.mAuto'], [1, 'n.m1'], [3, 'n.m3'], [6, 'n.m6'], [0, 'n.all']].map(([v, k]) => `<button data-v="${v}" aria-pressed="${String(NET.frange ?? 'auto') === String(v)}">${esc(t(k))}</button>`).join('')}</div></div>
      <span class="small muted">${esc(t('n.mAutoD'))}</span></div>`}
    ${q ? '' : `<div class="net-controls">
      <div><span class="small muted">${esc(t('n.period'))} </span><div class="seg" id="nRange">${[[1, 'n.m1'], [3, 'n.m3'], [6, 'n.m6'], [0, 'n.all']].map(([v, k]) => `<button data-v="${v}" aria-pressed="${NET.range === v}">${esc(t(k))}</button>`).join('')}</div></div>
      <div><span class="small muted">${esc(t('n.compare'))} </span><div class="seg" id="nAfter">${[['branches', 'n.branches'], ['full', 'n.full']].map(([v, k]) => `<button data-v="${v}" aria-pressed="${NET.after === v}">${esc(t(k))}</button>`).join('')}</div></div>
      <label class="chk small"><input type="checkbox" id="nLabels" ${NET.labels ? 'checked' : ''}> ${esc(t('n.labels'))}</label></div>`}
    <div class="grid" id="netPanels"><div class="loading">${spin(t('n.building'))}</div></div>
    <div id="netDetail"></div>`;
  const save = () => { try { localStorage.setItem('gbt-net', JSON.stringify(NET)); } catch (e) {} };
  const search = v => { S.netQuery = (v || '').trim(); vNetwork(); };
  $('#nGo').onclick = () => search($('#nSearch').value);
  setupAutocomplete($('#nSearch'), $('#nAc'), search);
  if ($('#nClear')) $('#nClear').onclick = () => search('');
  if ($('#nCtx')) $('#nCtx').onchange = e => { NET.ctx = e.target.checked; save(); if (S.graph) drawNetwork(S.graph, S.netQuery); };
  if (q) $('#nFRange').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    NET.frange = b.dataset.v === 'auto' ? 'auto' : +b.dataset.v; save();
    document.querySelectorAll('#nFRange button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    if (S.graph) drawNetwork(S.graph, S.netQuery);
  };
  if (!q) {
    $('#nRange').onclick = e => { const b = e.target.closest('button'); if (b) { NET.range = +b.dataset.v; save(); vNetwork(); } };
    $('#nAfter').onclick = e => { const b = e.target.closest('button'); if (b) { NET.after = b.dataset.v; save(); vNetwork(); } };
    $('#nLabels').onchange = e => { NET.labels = e.target.checked; save(); vNetwork(); };
  }
  if (!S.graph) { try { S.graph = await api('/api/graph'); } catch (e) { $('#netPanels').innerHTML = `<pre class="log">${esc(e.message)}</pre>`; return; } }
  if (S.tab !== 'network') return;
  drawNetwork(S.graph, q);
}
// "/" jumps to the search box on the Network screen
document.addEventListener('keydown', e => {
  if (e.key === '/' && S.tab === 'network' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); const i = $('#nSearch'); if (i) { i.focus(); i.select(); } }
});
// Search suggestions: same width as the search box; ↑/↓ to move, Enter to choose, Esc to close
function setupAutocomplete(input, list, onPick) {
  let items = [], active = -1;
  const names = () => {
    if (!S.graph) return [];
    const P = S.graph.plan, sh = n => n.replace(new RegExp('^' + P.remote + '/'), '');
    return S.graph.refs.map(r => ({ name: sh(r.name), kind: 'branch' })).concat(S.graph.tags.map(x => ({ name: x.name, kind: 'tag' })));
  };
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
  const render = () => {
    list.innerHTML = items.map((x, i) => {
      const k = x.name.toLowerCase().indexOf(input.value.trim().toLowerCase()), q = input.value.trim().length;
      const label = k < 0 || !q ? esc(x.name) : esc(x.name.slice(0, k)) + '<mark>' + esc(x.name.slice(k, k + q)) + '</mark>' + esc(x.name.slice(k + q));
      return `<div class="ac-item${i === active ? ' on' : ''}" role="option" data-i="${i}"><span class="mono">${label}</span>${x.kind === 'tag' ? '<span class="badge b-warn">tag</span>' : ''}</div>`;
    }).join('');
    list.hidden = !items.length; input.setAttribute('aria-expanded', String(!list.hidden));
    const on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  };
  const update = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { items = []; close(); return; }
    const num = /^\d+$/.test(q) ? new RegExp('(^|[^0-9])' + q + '($|[^0-9])') : null;
    const score = n => { const l = n.toLowerCase(); return (l === q ? 0 : num && num.test(l) ? 1 : l.startsWith(q) ? 2 : 3) * 1000 + l.length; };
    items = names().filter(x => x.name.toLowerCase().includes(q)).sort((a, b) => score(a.name) - score(b.name)).slice(0, 12);
    active = items.length ? 0 : -1; render();
  };
  input.addEventListener('input', update);
  input.addEventListener('focus', () => { if (input.value.trim() && !S.netQuery) update(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); if (list.hidden) { update(); return; } active = (active + 1) % items.length; render(); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); active = (active - 1 + items.length) % items.length; render(); }
    else if (e.key === 'Enter') { e.preventDefault(); const pick = !list.hidden && items[active] ? items[active].name : input.value; close(); onPick(pick); }
    else if (e.key === 'Escape') { if (!list.hidden) { e.preventDefault(); close(); } else onPick(''); }
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  list.addEventListener('mousedown', e => {
    const it = e.target.closest('.ac-item'); if (!it) return;
    e.preventDefault(); const x = items[+it.dataset.i]; close(); onPick(x.name);
  });
}

function drawNetwork(G, query) {
  const zoomGroup = [];                        // panels that zoom together (same zoom setting)
  const byHash = new Map(G.commits.map(c => [c.h, c]));
  const P = G.plan, short = n => n.replace(new RegExp('^' + P.remote + '/'), '');
  const main = short(P.main);
  const today = G.generated.slice(0, 10);
  const refHash = n => (G.refs.find(r => r.name === n) || {}).h;
  const ancestors = (heads, extra) => { const seen = new Set(), st = [...heads]; while (st.length) { const h = st.pop(); if (seen.has(h)) continue; const c = extra.get(h) || byHash.get(h); if (!c) continue; seen.add(h); c.p.forEach(p => st.push(p)); } return seen; };

  function buildView(kind) {
    let labels, synthetic = [];
    if (kind === 'now') labels = G.refs.map(r => ({ name: short(r.name), h: r.h, type: 'branch' })).concat(G.tags.map(x => ({ name: x.name, h: x.h, type: 'tag' })));
    else {
      const keep = [P.main, ...P.unreleased, ...P.unmergedRelease];
      if (kind === 'branches') keep.push(...P.keptOther);
      labels = keep.filter(refHash).map(n => ({ name: short(n), h: refHash(n), type: 'branch' }))
        .concat(G.tags.map(x => ({ name: x.name, h: x.h, type: 'tag' }))).concat(P.releaseTags.map(x => ({ name: x.name, h: x.h, type: 'tag' })));
      if (kind === 'full') {
        const mt = refHash(P.main), tip = {}, feats = [], envs = [];
        P.unreleased.forEach(f => { let prev = mt; (P.featureCommits[f] || []).forEach((c, i) => { const h = `sim-${short(f)}-${i}`; feats.push({ h, p: [prev], a: c.a, d: today, s: c.s + '  (rebased)', syn: true }); prev = h; }); tip[f] = prev; });
        labels = labels.filter(l => !P.unreleased.map(short).includes(l.name)).concat(P.unreleased.map(f => ({ name: short(f), h: tip[f], type: 'branch' })));
        P.envs.forEach(e => { let prev = mt; const chain = []; e.tickets.forEach((f, i) => { const h = `sim-${e.name}-${i}`; chain.push({ h, p: [prev, tip[f]], a: '(simulated rebuild)', d: today, s: `Merge ${short(f)} into ${e.name}  (simulated)`, syn: true }); prev = h; }); labels.push({ name: e.name, h: prev, type: 'branch' }); envs.push(chain); });
        synthetic = [...feats, ...envs.flat()];
      }
    }
    const extra = new Map(synthetic.map(c => [c.h, c]));
    const reach = ancestors(labels.map(l => l.h), extra);
    return { list: [...synthetic].reverse().concat(G.commits.filter(c => reach.has(c.h))), labels };
  }
  function layout(view, since) {
    const list = view.list.filter(c => !since || c.d >= since), idx = new Map(list.map((c, i) => [c.h, i]));
    const lanes = [], laneOf = new Map(), edges = [];
    const seed = ['master', 'main', ...P.envs.map(e => e.name)].map(n => (view.labels.find(l => l.name === n) || {}).h).filter(h => h && idx.has(h));
    [...new Set(seed)].forEach((h, k) => { lanes[k] = h; });
    const free = avoid => { for (let k = 0; ; k++) if (k !== avoid && lanes[k] == null) return k; };
    for (const c of list) {
      const ks = []; lanes.forEach((h, k) => { if (h === c.h) ks.push(k); });
      let lane; if (ks.length) { lane = Math.min(...ks); ks.forEach(k => { if (k !== lane) lanes[k] = null; }); } else lane = free(-1);
      lanes[lane] = null; laneOf.set(c.h, lane);
      c.p.forEach((p, i) => {
        if (!idx.has(p)) { edges.push({ from: c.h, lane, dangling: true }); return; }
        if (i === 0) { const ex = lanes.indexOf(p); if (ex !== -1 && ex < lane) edges.push({ from: c.h, to: p, lane: ex }); else { lanes[lane] = p; edges.push({ from: c.h, to: p, lane }); } }
        else { let k = lanes.indexOf(p); if (k === -1) { k = free(lane); lanes[k] = p; } edges.push({ from: c.h, to: p, lane: k }); }
      });
    }
    return { list, idx, laneOf, edges, nLanes: Math.max(1, ...[...laneOf.values()].map(v => v + 1)) };
  }
  const since = NET.range ? (() => { const d = new Date(today); d.setMonth(d.getMonth() - NET.range); return d.toISOString().slice(0, 10); })() : null;
  const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ca8a04', '#0891b2', '#db2777', '#64748b', '#ea580c', '#059669', '#7c3aed', '#b45309'];
  const DX = 13, DY = 17, PADL = 30, PADT = 58, R = 3.6;

  // opt.hl: Set of commit hashes to highlight (everything else is faded and blurred)
  // opt.zoom: scale factor; opt.zoomKey: which NET setting the +/- buttons change
  function panel(title, desc, view, L, base, opt = {}) {
    const hl = opt.hl || null, z = opt.zoom || 1;
    const n = L.list.length, X = h => PADL + (n - 1 - L.idx.get(h)) * DX, Y = k => PADT + k * DY, col = k => COLORS[k % COLORS.length];
    const byH = new Map(); view.labels.forEach(l => { if (L.idx.has(l.h)) (byH.get(l.h) || byH.set(l.h, []).get(l.h)).push(l); });
    const st = { branches: view.labels.filter(l => l.type === 'branch').length, tags: view.labels.filter(l => l.type === 'tag').length, commits: n, merges: L.list.filter(c => c.p.length > 1).length, lanes: L.nLanes };
    const dl = (k, lower = true) => { if (!base) return ''; const d = st[k] - base[k]; if (!d) return ''; return `<span class="d ${(lower ? d < 0 : d > 0) ? 'good' : 'bad'}">${d > 0 ? '+' : ''}${d}</span>`; };
    const W = PADL + n * DX + 220, H = PADT + L.nLanes * DY + 20;
    let s = `<svg class="netsvg" width="${Math.round(W * z)}" height="${Math.round(H * z)}" viewBox="0 0 ${W} ${H}"><g class="axis">`;
    let maxM = '', lastX = -1e9;
    for (let i = n - 1; i >= 0; i--) { const m = L.list[i].d.slice(0, 7); if (m > maxM) { const x = PADL + (n - 1 - i) * DX; s += `<line x1="${x}" y1="14" x2="${x}" y2="${H - 6}" stroke-dasharray="2 4"/>`; if (x - lastX > 52) { s += `<text x="${x + 3}" y="12">${m}</text>`; lastX = x; } maxM = m; } }
    s += '</g>';
    const isHl = h => !hl || hl.has(h);
    let dimEdges = '', hlEdges = '', dimDots = '', hlDots = '', hits = '';
    L.edges.forEach((e, i) => {
      const c = L.list[L.idx.get(e.from)], xc = X(e.from), yc = Y(L.laneOf.get(e.from)), yk = Y(e.lane), cl = col(e.lane);
      const on = isHl(e.from) && (e.dangling || isHl(e.to));
      let d, extra = c.syn ? ' stroke-dasharray="4 3"' : '';
      if (e.dangling) { d = `M${xc},${yc} L${xc - DX},${yk} L${PADL - 20},${yk}`; extra = ' stroke-opacity=".35" stroke-dasharray="3 3"'; }
      else {
        const xp = X(e.to), yp = Y(L.laneOf.get(e.to));
        if (xc - xp <= DX) { const mx = (xc + xp) / 2; d = `M${xc},${yc} C${mx},${yc} ${mx},${yp} ${xp},${yp}`; }
        else { d = `M${xc},${yc}` + (yk !== yc ? ` C${xc - DX / 2},${yc} ${xc - DX / 2},${yk} ${xc - DX},${yk}` : ` L${xc - DX},${yk}`) + ` L${xp + DX},${yk}` + (yk !== yp ? ` C${xp + DX / 2},${yk} ${xp + DX / 2},${yp} ${xp},${yp}` : ` L${xp},${yp}`); }
      }
      const p = `<path data-e="${i}" d="${d}" stroke="${cl}"${extra}/>`;
      on ? hlEdges += p : dimEdges += p;
      hits += `<path class="hit" data-e="${i}" d="${d}"/>`;   // wide invisible click area for the line
    });
    for (const c of L.list) {
      const k = L.laneOf.get(c.h), m = c.p.length > 1, on = isHl(c.h), r = (m ? R - .8 : R) * (hl && on ? 1.35 : 1);
      const dot = `<circle class="c" data-h="${c.h}" cx="${X(c.h)}" cy="${Y(k)}" r="${r}" fill="${m ? 'var(--panel)' : col(k)}" stroke="${col(k)}" stroke-width="${hl && on ? 2.2 : 1.6}"${c.syn ? ' stroke-dasharray="2 2"' : ''}/>`;
      on ? hlDots += dot : dimDots += dot;
    }
    // faded layer first, the highlighted branch on top
    if (dimEdges || dimDots) s += `<g class="${hl ? 'dimmed' : ''}"><g fill="none" stroke-width="1.6" stroke-linecap="round">${dimEdges}</g><g>${dimDots}</g></g>`;
    s += `<g fill="none" stroke-width="${hl ? 2.8 : 1.6}" stroke-linecap="round">${hlEdges}</g><g class="hits">${hits}</g><g>${hlDots}</g>`;
    if (NET.labels || hl) {
      s += '<g>'; const placed = [];
      const hit = (x, y, w) => placed.some(p => x < p.x + p.w && p.x < x + w && Math.abs(p.y - y) < 12);
      for (const [h, ls] of [...byH].sort((a, b) => X(a[0]) - X(b[0]))) {
        const x = X(h), cl = col(L.laneOf.get(h));
        ls.forEach(l => { const w = l.name.length * 6.2 + 8; let ly = Y(L.laneOf.get(h)) - 7; while (hit(x + 6, ly, w) && ly > 26) ly -= 13; placed.push({ x: x + 6, y: ly, w });
          const plain = l.type === 'branch', cls = { tag: 'tagl', into: 'intol', intoOld: 'intoold', base: 'basel', sel: 'sell', ctx: 'ctxl' }[l.type] || '';
          s += `<g class="lbl ${cls}"><rect x="${x + 6}" y="${ly - 9}" width="${w}" height="12" rx="3" ${plain ? `stroke="${cl}"` : ''}/><text x="${x + 10}" y="${ly}" ${plain ? `fill="${cl}"` : ''}>${esc(l.name)}</text></g>`; });
      }
      s += '</g>';
    }
    s += '</svg>';
    const el = document.createElement('div'); el.className = 'section';
    const zoomUi = `<div class="zoom" title="${esc(t('n.z.hint'))}"><button class="btn sm" data-zoom="-1">−</button><button class="btn sm" data-zoom="0">${Math.round(z * 100)}%</button><button class="btn sm" data-zoom="1">＋</button></div>`;
    el.innerHTML = `<header><h2>${esc(title)}</h2>${zoomUi}<div class="stats" ${view.focus ? 'hidden' : ''}><span class="stat">${esc(t('n.st.branches'))} <b>${st.branches}</b>${dl('branches')}</span><span class="stat">${esc(t('n.st.tags'))} <b>${st.tags}</b>${dl('tags', false)}</span><span class="stat">${esc(t('n.st.commits'))} <b>${st.commits}</b>${dl('commits')}</span><span class="stat">${esc(t('n.st.merges'))} <b>${st.merges}</b>${dl('merges')}</span><span class="stat">${esc(t('n.st.lanes'))} <b>${st.lanes}</b>${dl('lanes')}</span></div><div class="hint">${esc(desc)}</div></header><div class="scroll">${s}</div>`;
    const sc = el.querySelector('.scroll'), tip = $('#tip');
    sc.addEventListener('mousemove', ev => {
      const tg = dotAt(ev); if (!tg) { tip.style.display = 'none'; return; }
      const c = L.list[L.idx.get(tg.dataset.h)], ls = (byH.get(c.h) || []).map(l => l.name).join(', ');
      tip.innerHTML = `<div class="h">${c.syn ? esc(t('n.simulated')) : c.h.slice(0, 8)} · ${esc(c.d)} · ${esc(c.a)}</div><div>${esc(c.s)}</div>${ls ? `<div class="mono small" style="margin-top:4px">${esc(ls)}</div>` : ''}`;
      tip.style.display = 'block';
      tip.style.left = Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px';
      tip.style.top = (ev.clientY + 16 + tip.offsetHeight > innerHeight ? ev.clientY - tip.offsetHeight - 10 : ev.clientY + 16) + 'px';
    });
    sc.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
    // ---- mouse control: drag to move, wheel to zoom (at the pointer), Shift + wheel to scroll sideways
    let drag = null, dragged = false;
    // ---- line selection: click a line to highlight the whole line and bring it to the front; click empty space to reset
    const byFrom = new Map(), byTo = new Map();
    L.edges.forEach((e, i) => { (byFrom.get(e.from) || byFrom.set(e.from, []).get(e.from)).push(i); if (!e.dangling) (byTo.get(e.to) || byTo.set(e.to, []).get(e.to)).push(i); });
    const svgEl = () => sc.querySelector('svg');
    const clearLine = () => { const s = svgEl(); s.classList.remove('line-active'); s.querySelectorAll('.linesel').forEach(x => x.remove()); };
    const selectLine = i0 => {
      clearLine();
      const lane = L.edges[i0].lane, chain = new Set([i0]);
      // follow the same line (same lane, connected commits) towards older and newer commits
      for (let e = L.edges[i0]; e && !e.dangling;) { const nx = (byFrom.get(e.to) || []).find(j => L.edges[j].lane === lane && !chain.has(j)); if (nx == null) break; chain.add(nx); e = L.edges[nx]; }
      for (let e = L.edges[i0]; e;) { const pv = (byTo.get(e.from) || []).find(j => L.edges[j].lane === lane && !chain.has(j)); if (pv == null) break; chain.add(pv); e = L.edges[pv]; }
      const s = svgEl(), NS = 'http://www.w3.org/2000/svg', g = document.createElementNS(NS, 'g'), dots = new Set();
      g.setAttribute('class', 'linesel');
      chain.forEach(j => {
        const src = s.querySelector(`path[data-e="${j}"]:not(.hit)`);
        if (src) { const cp = src.cloneNode(); cp.removeAttribute('stroke-opacity'); g.appendChild(cp); }
        const e = L.edges[j]; dots.add(e.from); if (!e.dangling) dots.add(e.to);
      });
      dots.forEach(h => { const d = s.querySelector(`circle.c[data-h="${h}"]`); if (d) g.appendChild(d.cloneNode()); });
      s.insertBefore(g, s.querySelector('.selmark'));   // the selected-commit ring stays on top
      s.classList.add('line-active');
    };
    // a dot under the pointer wins over a line (dots can sit below the wide line click areas)
    const dotAt = ev => ev.target.closest('circle.c') || (ev.target.classList && ev.target.classList.contains('hit') ? document.elementsFromPoint(ev.clientX, ev.clientY).find(x => x.matches && x.matches('circle.c')) : null);
    sc.addEventListener('click', ev => {
      if (dragged) { dragged = false; return; }       // the end of a drag is not a click
      const dot = dotAt(ev);
      if (dot) { if (!dot.dataset.h.startsWith('sim-')) showCommit(dot.dataset.h); return; }
      const line = ev.target.closest('path[data-e]');
      if (line) selectLine(+line.dataset.e); else clearLine();
    });
    sc.addEventListener('pointerdown', ev => {
      if (ev.button !== 0) return;
      drag = { x: ev.clientX, y: ev.clientY, l: sc.scrollLeft, t: sc.scrollTop, id: ev.pointerId }; dragged = false;
    });
    sc.addEventListener('pointermove', ev => {
      if (!drag) return;
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!dragged && Math.abs(dx) + Math.abs(dy) > 4) { dragged = true; try { sc.setPointerCapture(drag.id); } catch (e) {} sc.classList.add('grabbing'); tip.style.display = 'none'; }
      if (dragged) { sc.scrollLeft = drag.l - dx; sc.scrollTop = drag.t - dy; }
    });
    const endDrag = () => { drag = null; sc.classList.remove('grabbing'); };
    sc.addEventListener('pointerup', endDrag); sc.addEventListener('pointercancel', endDrag);

    // zoom without redrawing: only the SVG's size changes (its viewBox stays), the point under the pointer stays put
    const svg = sc.querySelector('svg'), key = opt.zoomKey || 'zoom', zLabel = el.querySelector('[data-zoom="0"]');
    let cur = z, saveTimer = null;
    const apply = (next, ax, ay) => {
      next = Math.min(5, Math.max(0.3, next));
      if (Math.abs(next - cur) < 0.001) return;
      const vx = (sc.scrollLeft + ax) / cur, vy = (sc.scrollTop + ay) / cur;
      svg.setAttribute('width', Math.round(W * next)); svg.setAttribute('height', Math.round(H * next));
      sc.scrollLeft = vx * next - ax; sc.scrollTop = vy * next - ay;
      cur = next; zLabel.textContent = Math.round(next * 100) + '%';
      NET[key] = Math.round(next * 100) / 100;
      clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem('gbt-net', JSON.stringify(NET)); } catch (e) {} }, 300);
    };
    const zoomTo = (next, ax, ay, fromGroup) => {
      apply(next, ax ?? sc.clientWidth / 2, ay ?? sc.clientHeight / 2);
      if (!fromGroup) zoomGroup.filter(g => g.key === key && g.apply !== zoomTo).forEach(g => g.apply(next, undefined, undefined, true));
    };
    zoomGroup.push({ key, apply: zoomTo });
    el.querySelectorAll('[data-zoom]').forEach(b => b.onclick = () => { const d = +b.dataset.zoom; zoomTo(d === 0 ? 1 : cur * (d > 0 ? 1.25 : 0.8)); });
    sc.addEventListener('wheel', ev => {
      if (ev.ctrlKey) {                          // Ctrl + wheel: zoom at the pointer
        ev.preventDefault(); tip.style.display = 'none';
        const r = sc.getBoundingClientRect();
        zoomTo(cur * Math.exp(-ev.deltaY * 0.0015), ev.clientX - r.left, ev.clientY - r.top);
      } else if (ev.shiftKey) {                  // Shift + wheel: scroll sideways
        ev.preventDefault(); sc.scrollLeft += ev.deltaY || ev.deltaX;
      }                                          // plain wheel: normal scrolling
    }, { passive: false });
    const keep = () => {                         // after a zoom: restore the spot that was in the middle
      if (!S.netKeep) return false;
      sc.scrollLeft = S.netKeep.x * sc.scrollWidth - sc.clientWidth / 2; sc.scrollTop = S.netKeep.y * sc.scrollHeight - sc.clientHeight / 2;
      return true;
    };
    // where the highlighted commits are (for scrolling to them)
    let hlBox = null;
    if (hl) { const xs = [], ys = []; L.list.forEach(c => { if (hl.has(c.h)) { xs.push(X(c.h)); ys.push(Y(L.laneOf.get(c.h))); } }); if (xs.length) hlBox = { x1: Math.min(...xs) * z, x2: Math.max(...xs) * z, y1: Math.min(...ys) * z, y2: Math.max(...ys) * z }; }
    return { el, st, sc, keep, hlBox };
  }
  if (!query) return drawCompare(G, since, buildView, layout, panel, main);

  // ---------- search: one branch, or one commit
  function resolve(q) {
    const lq = q.toLowerCase();
    const refs = G.refs.map(r => ({ name: short(r.name), h: r.h })).concat(G.tags.map(x => ({ name: x.name, h: x.h, tag: true })));
    const exact = refs.find(r => r.name.toLowerCase() === lq);
    if (exact) return { branch: exact };
    const some = refs.filter(r => r.name.toLowerCase().includes(lq));
    // a ticket number like 1131 should not also match 11310
    const strict = some.filter(r => new RegExp('(^|[^0-9])' + lq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^0-9])').test(r.name.toLowerCase()));
    const m = strict.length ? strict : some;
    if (m.length === 1) return { branch: m[0] };
    if (/^[0-9a-f]{4,40}$/.test(lq)) { const c = G.commits.find(x => x.h.startsWith(lq)); if (c) return { commit: c }; }
    if (m.length > 1) return { many: m };
    return { none: true };
  }
  function focusView(q) {
    const box = $('#netPanels'), r = resolve(q);
    if (r.none) { box.innerHTML = `<div class="section"><div class="empty">${esc(t('n.s.none', { q }))}</div></div>`; return; }
    if (r.many) {
      box.innerHTML = `<div class="section"><div class="body">${esc(t('n.s.many', { n: r.many.length, q }))}<div class="row" style="margin-top:8px">${r.many.slice(0, 60).map(x => `<button class="btn sm mono" data-pick="${esc(x.name)}">${esc(x.name)}</button>`).join('')}</div></div></div>`;
      box.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { S.netQuery = b.dataset.pick; vNetwork(); });
      return;
    }
    if (r.commit) return commitFocus(r.commit);
    return branchFocus(r.branch);
  }

  // first-parent line of main: commits that are "on master" itself
  const mainTip = refHash(P.main), mainFP = new Set();
  for (let x = mainTip; x && byHash.get(x); x = byHash.get(x).p[0]) mainFP.add(x);
  const inMain = ancestors([mainTip], new Map());
  // which branch received a merge: from the message ("… into staging"), or else the branch whose own
  // (first-parent) line contains the merge commit (git omits "into …" for some branches)
  let fpOwner = null;
  const ownerOf = h => {
    if (!fpOwner) {
      fpOwner = new Map();
      const rank = n => n === P.main ? 0 : P.envs.some(e => e.name === short(n)) ? 1 : /\/release\//.test(n) ? 2 : 3;
      G.refs.slice().sort((a, b) => rank(a.name) - rank(b.name)).forEach(r => {
        for (let x = r.h; x && byHash.get(x) && !fpOwner.has(x); x = byHash.get(x).p[0]) fpOwner.set(x, short(r.name));
      });
    }
    return fpOwner.get(h);
  };
  const mergeTarget = (c, fallback) => { const m = c.s.match(/ into ([\w./-]+)/); return m ? m[1].replace(new RegExp('^' + P.remote + '/'), '') : (ownerOf(c.h) || fallback); };

  function branchFocus(b) {
    const B = b.h, fp = [];
    let stop = null;
    for (let x = B; x && byHash.get(x); x = byHash.get(x).p[0]) { if (x !== B && mainFP.has(x)) { stop = x; break; } fp.push(x); if (fp.length > 400) break; }
    let own, line = fp, partOfMain = false;
    if (mainFP.has(B)) {                       // part of main's own line (main itself, or fast-forwarded): show its recent history
      partOfMain = true;
      // stop at the previous release / tag on the line (so a release shows only its own work), at most 25 commits
      const otherTips = new Set(G.refs.filter(r => r.h !== B && short(r.name) !== main).map(r => r.h).concat(G.tags.map(x => x.h)));
      const chain = [];
      for (let x = B; x && byHash.get(x) && chain.length < 26; x = byHash.get(x).p[0]) { if (x !== B && b.name !== main && otherTips.has(x)) { chain.push(x); break; } chain.push(x); }
      stop = chain.length > 1 && (chain.length > 25 || otherTips.has(chain[chain.length - 1])) ? chain[chain.length - 1] : null;
      line = stop ? chain.slice(0, -1) : chain;
      const before = stop ? ancestors([stop], new Map()) : new Set();
      own = new Set([...ancestors([B], new Map())].filter(h => !before.has(h)));
    } else {
      const base = stop ? ancestors([stop], new Map()) : new Set();
      own = new Set([...ancestors([B], new Map())].filter(h => !base.has(h)));   // the branch incl. what was merged into it
    }
    // the branch's own line (first-parent chain): its own commits, without branches merged into it
    const lineSet = new Set(line), lineList = line.map(h => byHash.get(h)).filter(Boolean);
    // where was it merged: commits outside the branch with a parent on its own line
    const events = [], offshoots = [];
    for (const c of G.commits) {
      if (own.has(c.h)) continue;
      if (c.p.length === 1 && lineSet.has(c.p[0]) && !partOfMain) {      // a normal commit on top of this branch: other work started from it
        const tk = (c.s.match(/[A-Z][A-Z0-9_]*-\d+/) || [])[0];
        offshoots.push({ c, p: c.p[0], name: ownerOf(c.h) || tk || c.h.slice(0, 8) });
        continue;
      }
      c.p.forEach((p, i) => { if (lineSet.has(p) && !(i === 0 && partOfMain)) events.push({ c, p, target: mergeTarget(c, '?'), latest: p === B }); });
    }
    const missingAfter = p => { const got = ancestors([p], new Map()); return lineList.filter(c => c.p.length < 2 && !got.has(c.h)).length; };
    events.forEach(e => { e.missing = e.latest ? 0 : missingAfter(e.p); if (!e.missing) e.latest = true; });
    // other branches merged into this one (second parents of merges on its own line)
    const incoming = [];
    lineList.forEach(c => c.p.slice(1).forEach(p => { if (!lineSet.has(p)) { const m = c.s.match(/Merge (?:remote-tracking )?branch '([^']+)'|#\d+ (\S+) into/); incoming.push({ c, p, from: m ? (m[1] || m[2]).replace(new RegExp('^' + P.remote + '/'), '') : '?' }); } }));
    const ownList = lineList;

    const nodes = new Set([...own, ...events.map(e => e.c.h), ...incoming.map(x => x.p), ...offshoots.map(x => x.c.h)]); if (stop) nodes.add(stop);
    const labels = [{ name: b.name, h: B, type: 'sel' }];
    if (stop) labels.push({ name: partOfMain ? (G.refs.concat(G.tags).filter(r => r.h === stop).map(r => short(r.name))[0] || t('n.f.baseLbl', { main })) : t('n.f.baseLbl', { main }), h: stop, type: 'base' });
    const lastPer = {}; events.forEach(e => { if (!lastPer[e.target] || e.c.d >= lastPer[e.target].c.d) lastPer[e.target] = e; });   // label only the latest merge per target
    Object.values(lastPer).forEach(e => labels.push({ name: '→ ' + e.target + (e.latest ? '' : ' ' + t('n.f.oldLbl')), h: e.c.h, type: e.latest ? 'into' : 'intoOld' }));
    [...new Map(incoming.map(x => [x.from, x])).values()].forEach(x => labels.push({ name: '← ' + x.from, h: x.p, type: 'base' }));
    offshoots.forEach(x => labels.push({ name: '↳ ' + x.name, h: x.c.h, type: 'base' }));
    const ctx = NET.ctx !== false, zoomOpt = { zoom: NET.zoomF || 1.6, zoomKey: 'zoomF' };
    let view, L, pnlOpt;
    if (ctx) {
      // the whole network around this branch (from a week before it started), the branch highlighted
      const dates = [...nodes].map(h => (byHash.get(h) || {}).d).filter(Boolean).sort();
      // period: the branch's own period (from a week before it started), or a chosen period;
      // a chosen period never cuts off the branch itself
      const from = new Date(dates[0] || today); from.setDate(from.getDate() - 7);
      const fr = NET.frange ?? 'auto';
      let since = from.toISOString().slice(0, 10);
      if (fr === 0) since = null;
      else if (fr !== 'auto') { const d = new Date(today); d.setMonth(d.getMonth() - fr); const chosen = d.toISOString().slice(0, 10); if (chosen < since) since = chosen; }
      const ctxLabels = [P.main, ...P.envs.map(e => P.remote + '/' + e.name)].filter(refHash).map(n => ({ name: short(n), h: refHash(n), type: 'ctx' }));
      view = { list: buildView('now').list, labels: labels.concat(ctxLabels.filter(l => !labels.some(x => x.h === l.h))), focus: true };
      L = layout(view, since);
      pnlOpt = { ...zoomOpt, hl: nodes };
    } else {
      view = { list: G.commits.filter(c => nodes.has(c.h)), labels, focus: true };
      L = layout(view, null);
      pnlOpt = zoomOpt;
    }
    const pnl = panel(t('n.f.graphT', { b: b.name }), (partOfMain ? t('n.f.fp', { main }) : t('n.f.graphD', { main })) + (ctx ? ' ' + t('n.f.ctxD') : ''), view, L, null, pnlOpt);
    pnl.sc.classList.add('tall');

    // summary card
    const f = (S.ov && S.ov.features || []).find(x => x.short === b.name);
    const released = inMain.has(B);
    const nonMerge = ownList.filter(c => c.p.length < 2), authors = [...new Set(nonMerge.map(c => c.a))];
    const stopC = stop && byHash.get(stop);
    const firstEvents = {};                     // earliest merge per target
    events.slice().sort((a, b) => a.c.d.localeCompare(b.c.d)).forEach(e => { (firstEvents[e.target] = firstEvents[e.target] || []).push(e); });
    const rows = Object.entries(firstEvents).map(([target, es]) => { const last = es[es.length - 1];
      return `<tr><td class="mono">${esc(target)}</td><td class="nw">${esc(es[0].c.d)}${es.length > 1 ? ` <span class="muted small">(${esc(t('n.f.times', { n: es.length }))})</span>` : ''}</td><td class="mono"><a href="#" data-commit="${last.c.h}">${last.c.h.slice(0, 8)}</a></td><td>${last.latest ? badge('b-ok', t('n.f.latest')) : badge('b-warn', t('n.f.old', { n: last.missing }))}</td></tr>`; }).join('');
    const status = [released ? badge('b-ok', t('n.f.released', { main })) : badge('b-info', t('n.f.notReleased', { main }))];
    if (f) { if (f.behind) status.push(badge('b-warn', t('f.behind', { n: f.behind }))); if (f.conflicts && f.conflicts.length) status.push(badge('b-bad', t('n.f.conflicts', { main, n: f.conflicts.length }))); }
    const card = document.createElement('div'); card.className = 'section';
    card.innerHTML = `<header><h2 class="mono">${esc(b.name)}</h2>${status.join(' ')}</header><div class="body grid" style="gap:12px">
      <div class="kv">
        <div><span>${esc(t('n.f.base', { main }))}</span><b>${stopC ? `<a href="#" class="mono" data-commit="${stopC.h}">${stopC.h.slice(0, 8)}</a> · ${esc(stopC.d)} · ${esc(stopC.s.slice(0, 70))}` : '—'}</b></div>
        <div><span>${esc(t('n.f.commits'))}</span><b>${esc(t('n.f.commitsV', { n: nonMerge.length, m: ownList.length - nonMerge.length }))}</b></div>
        <div><span>${esc(t('n.f.authors'))}</span><b>${esc(authors.join(', ') || '—')}</b></div>
        <div><span>${esc(t('n.f.last'))}</span><b>${byHash.get(B) ? `<a href="#" class="mono" data-commit="${B}">${B.slice(0, 8)}</a> · ${esc(byHash.get(B).d)} · ${esc(byHash.get(B).s.slice(0, 70))}` : '—'}</b></div>
      </div>
      <div><b>${esc(t('n.f.into'))}</b>${rows ? `<table style="margin-top:4px"><thead><tr><th>${esc(t('n.f.th.target'))}</th><th>${esc(t('n.f.th.when'))}</th><th>${esc(t('n.f.th.commit'))}</th><th>${esc(t('n.f.th.version'))}</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="small muted">${esc(t('n.f.intoNone'))}</div>`}</div>
      ${offshoots.length ? `<div><b>${esc(t('n.f.offshoots'))}</b><div class="small muted">${esc(t('n.f.offshootsD'))}</div><table style="margin-top:4px"><tbody>${offshoots.map(x => `<tr><td class="mono">${esc(x.name)}</td><td class="nw">${esc(x.c.d)}</td><td class="mono"><a href="#" data-commit="${x.c.h}">${x.c.h.slice(0, 8)}</a></td><td>${esc(x.c.s.slice(0, 80))}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${incoming.length ? `<div><b>${esc(t('n.f.incoming'))}</b><div class="small muted">${esc(t('n.f.incomingD'))}</div><div class="row" style="margin-top:4px">${[...new Set(incoming.map(x => x.from))].map(x => badge('b-warn', x)).join(' ')}</div></div>` : ''}
      <div><b>${esc(t('n.f.checkout'))}</b>${copyBtn(`git fetch\ngit checkout ${b.name}`)}</div>
    </div>`;
    const box = $('#netPanels'); box.innerHTML = ''; box.append(card, pnl.el);
    const sc = pnl.sc, hb = pnl.hlBox;
    if (!pnl.keep()) {
      if (hb) {                                // bring the highlighted branch into view (its newest part if it is wide)
        sc.scrollLeft = hb.x2 - hb.x1 < sc.clientWidth - 160 ? (hb.x1 + hb.x2) / 2 - sc.clientWidth / 2 : hb.x2 - sc.clientWidth + 160;
        sc.scrollTop = (hb.y1 + hb.y2) / 2 - sc.clientHeight / 2;
      } else sc.scrollLeft = sc.scrollWidth;
    }
    S.netKeep = null;
    markSelected(S.netSel);
    card.querySelectorAll('[data-commit]').forEach(a => a.onclick = e => { e.preventDefault(); showCommit(a.dataset.commit, false, true); });
  }

  function commitFocus(c) {
    $('#netPanels').innerHTML = '';
    showCommit(c.h, true);
  }
  focusView(query);
}
// the normal view: whole repository now, compared with after cleanup
function drawCompare(G, since, buildView, layout, panel, main) {
  const now = buildView('now'), aft = buildView(NET.after);
  const Ln = layout(now, since), La = layout(aft, since);
  const zo = { zoom: NET.zoom || 1, zoomKey: 'zoom' };
  const a = panel(t('n.now'), t('n.nowD', { n: G.refs.length }), now, Ln, null, zo);
  const b = panel(NET.after === 'full' ? t('n.fullT') : t('n.branchesT'), NET.after === 'full' ? t('n.fullD', { main }) : t('n.branchesD'), aft, La, a.st, zo);
  const box = $('#netPanels'); box.innerHTML = ''; box.append(a.el, b.el);
  [a, b].forEach(p => { if (!p.keep()) p.sc.scrollLeft = p.sc.scrollWidth; });
  S.netKeep = null;
  markSelected(S.netSel);
  let lock = false;
  const sync = (s, d) => s.addEventListener('scroll', () => { if (lock) return; lock = true; d.scrollLeft = d.scrollWidth - d.clientWidth - (s.scrollWidth - s.clientWidth - s.scrollLeft); lock = false; });
  sync(a.sc, b.sc); sync(b.sc, a.sc);
}

// ---------- commit details (click a dot, or search a commit hash)
function containingRefs(G, h) {
  if (!G._children) { G._children = new Map(); G.commits.forEach(c => c.p.forEach(p => { (G._children.get(p) || G._children.set(p, []).get(p)).push(c.h); })); }
  const desc = new Set([h]), st = [h];
  while (st.length) { const x = st.pop(); (G._children.get(x) || []).forEach(k => { if (!desc.has(k)) { desc.add(k); st.push(k); } }); }
  const P = G.plan, sh = n => n.replace(new RegExp('^' + P.remote + '/'), '');
  const refs = G.refs.map(r => ({ name: sh(r.name), h: r.h })).concat(G.tags.map(x => ({ name: x.name, h: x.h, tag: true })));
  return { in: refs.filter(r => desc.has(r.h)), out: refs.filter(r => !desc.has(r.h)) };
}
// Mark the selected commit in every graph on the page (a ring around its dot)
function markSelected(h, reveal) {
  document.querySelectorAll('#netPanels .selmark').forEach(x => x.remove());
  if (!h) return;
  [...document.querySelectorAll(`#netPanels circle.c[data-h^="${h.slice(0, 12)}"]`)].filter(d => !d.closest('.linesel')).forEach(dot => {
    const svg = dot.ownerSVGElement, NS = 'http://www.w3.org/2000/svg', cx = dot.getAttribute('cx'), cy = dot.getAttribute('cy'), r = +dot.getAttribute('r');
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'selmark');
    [['selpulse', r * 3.2], ['selring', r * 2.2]].forEach(([cls, rr]) => {
      const c = document.createElementNS(NS, 'circle'); c.setAttribute('class', cls); c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', rr); g.appendChild(c);
    });
    svg.appendChild(g);
    if (reveal) {                                // bring it into view inside its scroll area
      const sc = svg.closest('.scroll'), d = dot.getBoundingClientRect(), s = sc.getBoundingClientRect();
      if (d.left < s.left + 40 || d.right > s.right - 40) sc.scrollLeft += d.left - s.left - sc.clientWidth / 2;
      if (d.top < s.top + 20 || d.bottom > s.bottom - 20) sc.scrollTop += d.top - s.top - sc.clientHeight / 2;
    }
  });
}
async function showCommit(h, scroll, reveal) {
  const box = $('#netDetail'); if (!box) return;
  S.netSel = h; markSelected(h, reveal);
  box.innerHTML = `<div class="section"><div class="loading">${spin(t('loading'))}</div></div>`;
  if (!scroll) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  let c; try { c = await api('/api/commit?h=' + encodeURIComponent(h)); } catch (e) { box.innerHTML = `<div class="section"><pre class="log">${esc(e.message)}</pre></div>`; return; }
  const G = S.graph, P = G.plan, sh = n => n.replace(new RegExp('^' + P.remote + '/'), '');
  const where = containingRefs(G, c.hash);
  const main = sh(P.main), keyNames = [main, ...P.envs.map(e => e.name), ...P.unmergedRelease.map(sh)];
  const group = rs => {
    const g = { key: rs.filter(r => keyNames.includes(r.name)), rel: rs.filter(r => !r.tag && /^release\//.test(r.name)), tag: rs.filter(r => r.tag), other: rs.filter(r => !r.tag && !keyNames.includes(r.name) && !/^release\//.test(r.name)) };
    g.rel = g.rel.filter(r => !g.key.includes(r));
    return g;
  };
  const gi = group(where.in), keyOut = where.out.filter(r => keyNames.includes(r.name));
  const chips = (rs, cls) => rs.map(r => `<span class="badge ${cls} mono">${esc(r.name)}</span>`).join(' ');
  box.innerHTML = `<div class="section"><header><h2>${esc(t('n.c.title'))} <span class="mono">${c.hash.slice(0, 10)}</span></h2><button class="btn sm" data-copy="${esc(c.hash)}">${esc(t('n.c.copy'))}</button><button class="btn sm" id="ncClose">✕</button>
      <div class="hint">${esc(c.date)} · ${esc(c.author)}</div></header>
    <div class="body grid" style="gap:12px">
      <div><b>${esc(c.subject)}</b>${c.body ? `<pre class="log" style="margin-top:6px">${esc(c.body)}</pre>` : ''}</div>
      <div class="kv">
        <div><span>${esc(t('n.c.in'))}</span><b>${gi.key.length ? chips(gi.key, 'b-ok') : ''} ${chips(gi.rel, 'b-info')} ${chips(gi.tag, 'b-warn')} ${gi.other.length > 8 ? chips(gi.other.slice(0, 8), 'b-mute') + ` <span class="muted small">+${gi.other.length - 8}</span>` : chips(gi.other, 'b-mute')}${where.in.length ? '' : `<span class="muted">${esc(t('n.c.inNone'))}</span>`}</b></div>
        ${keyOut.length ? `<div><span>${esc(t('n.c.notIn'))}</span><b>${chips(keyOut, 'b-bad')}</b></div>` : ''}
        <div><span>${esc(t('n.c.parents'))}</span><b>${c.parents.map(p => `<a href="#" class="mono" data-commit="${p}">${p.slice(0, 8)}</a>`).join(' ') || '—'}</b></div>
      </div>
      <div><b>${esc(t('n.c.files', { n: c.fileCount }))}</b>${c.parents.length > 1 ? `<div class="small muted">${esc(t('n.c.mergeFiles'))}</div>` : ''}
        ${c.files.length ? `<table style="margin-top:4px"><tbody>${c.files.map(f => `<tr><td class="mono">${esc(f.path)}</td><td class="nw" style="color:var(--ok)">+${esc(f.add)}</td><td class="nw" style="color:var(--bad)">−${esc(f.del)}</td></tr>`).join('')}</tbody></table>` : `<div class="small muted">—</div>`}</div>
    </div></div>`;
  $('#ncClose').onclick = () => { box.innerHTML = ''; S.netSel = null; markSelected(null); };
  box.querySelectorAll('[data-commit]').forEach(a => a.onclick = e => { e.preventDefault(); showCommit(a.dataset.commit, false, true); });
}
