// Git Branch Tool — local web UI for inspecting and cleaning up a repository.
//
//   Windows: start.bat   macOS: start.command   Linux: ./start.sh
//   (or: node server.js --open)   then the tool is at http://localhost:4777
//
// The repository can be switched from the page. config.json (written by the tool) keeps
// the current repository, the recent list and per-repository settings:
//   { "port": 4777, "current": "/path/to/my-app", "recent": [...],
//     "repos": { "/path/to/my-app": { "remote": "origin", "main": "master",
//                "envs": ["dev", "staging"], "checkPaths": ["src"] } } }
// The older flat format ({ "repo": "../my-app", "main": ... }) is still read.
//
// Listens on 127.0.0.1 only. No dependencies besides Node and git.

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { CONF, saveConf, defaultCheckPaths } = require('./lib/config');
const { git, out, lines, isAncestor, pool, conflictFiles, setRepoDir } = require('./lib/git');
const { parseDiff, problemHunks } = require('./lib/diff');


// Current repository; null until one is chosen
let CFG = null, MAIN = null, ENVS = [];
function useRepo(p) {
  CFG = { repo: p, ...CONF.repos[p] }; setRepoDir(p);
  MAIN = R(CFG.main); ENVS = CFG.envs.map(R); cache = null;
  defaultIssueUrlCache = null; if (typeof issueCache !== 'undefined') issueCache.clear();
}
const R = n => `${CFG.remote}/${n}`;            // local short name -> remote-tracking ref
const short = n => n.startsWith(CFG.remote + '/') ? n.slice(CFG.remote.length + 1) : n;
const ticketOf = n => (n.match(/(\d{2,})(?!.*\d)/) || [])[1] || null;
const hideCreds = url => url.replace(/\/\/[^/@]*@/, '//');
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const parseCommit = l => { const [h, d, a, s] = l.split('\t'); return { h, d, a, s }; };
const COMMIT_FMT = '--format=%h%x09%cs%x09%an%x09%s';

// ---------------------------------------------------------------- open release branches
// For a release branch not yet merged into main: which features it carries and whether
// each is the latest version of its branch, commits that came from no feature branch,
// merges from environment branches, and the state against main.
async function releaseInfo(rel, refs, features) {
  const [ahead, behind] = lines(await out(['rev-list', '--left-right', '--count', `${rel.name}...${MAIN}`]))[0].split(/\s+/).map(Number);
  const conflicts = await conflictFiles(MAIN, rel.name);
  const mergeSubjects = lines(await out(['log', '--merges', '--format=%s', `${MAIN}..${rel.name}`]));
  const mentions = name => { const re = new RegExp(escRe(name) + '(?![\\w-])'); return mergeSubjects.some(s => re.test(s)); };

  const included = [];
  const inRelease = new Set(lines(await out(['rev-list', `${MAIN}..${rel.name}`])));
  for (const f of features) {
    // the branch's own commits (its first-parent line), not those of other branches merged into it:
    // a branch that only contains an included branch is not itself in the release
    const own = lines(await out(['log', '--first-parent', '--no-merges', '--format=%H%x09%s', `${MAIN}..${f.name}`])).map(l => { const [h, s] = l.split('\t'); return { h, s }; });
    const title = own.length ? own[own.length - 1].s : (f.commits.length ? f.commits[f.commits.length - 1].s : '');
    if (await isAncestor(f.name, rel.name)) { included.push({ short: f.short, ticket: f.ticket, authors: f.authors, state: 'latest', missing: [], env: f.env, title }); continue; }
    const missing = lines(await out(['log', '--no-merges', COMMIT_FMT, f.name, `^${rel.name}`, `^${MAIN}`])).map(parseCommit);
    let state = null;
    if (own.some(c => inRelease.has(c.h))) state = 'outdated';          // some of its own commits are in the release, newer ones are not
    else if (mentions(f.short)) state = 'rewritten';                     // merged earlier, but the branch was rebased/rewritten since
    if (state) included.push({ short: f.short, ticket: f.ticket, authors: f.authors, state, missing, env: f.env, title });
  }
  // branches named in merge commits that no longer exist on the remote
  const existing = new Set(refs.map(r => r.short));
  const named = [...new Set(mergeSubjects.flatMap(s => s.match(/(?:feature|hotfix|bugfix)\/[\w.-]+/g) || []))];
  const deleted = named.filter(b => !existing.has(b)).map(b => ({ short: b, ticket: ticketOf(b), state: 'deleted', missing: [], env: {}, authors: [], title: '' }));

  // merges of environment branches into the release bring along untested features
  const envMerges = mergeSubjects.filter(s => CFG.envs.some(e => new RegExp(`Merge (remote-tracking )?branch '(${escRe(CFG.remote)}/)?${escRe(e)}'|#\\d+ ${escRe(e)} into`).test(s)));

  // non-merge commits in the release that are on no existing feature/hotfix branch
  const featureRefs = refs.filter(r => ['feature', 'hotfix', 'other'].includes(r.kind)).map(r => r.name);
  const direct = lines(await out(['log', '--no-merges', COMMIT_FMT, `${MAIN}..${rel.name}`, '--not', ...featureRefs])).map(parseCommit);

  // tested on an environment but not in this release: candidates
  const inRel = new Set(included.map(x => x.short));
  const candidates = features.filter(f => !inRel.has(f.short) && Object.values(f.env).some(s => s !== 'none'))
    .map(f => ({ short: f.short, ticket: f.ticket, authors: f.authors, env: f.env, conflicts: f.conflicts }));

  return { name: rel.short, ref: rel.name, date: rel.date, author: rel.author, subject: rel.subject,
    ahead, behind, conflicts, included: included.concat(deleted), envMerges, direct, candidates };
}

// ---------------------------------------------------------------- overview
let cache = null;
async function overview(force) {
  if (cache && !force) return cache;
  const [refsOut, mergedOut, headR, status, stash, tagsOut, localOut, localMergedOut, fetchHead] = await Promise.all([
    out(['for-each-ref', `refs/remotes/${CFG.remote}`, '--format=%(refname:short)%09%(objectname)%09%(committerdate:short)%09%(authorname)%09%(subject)']),
    out(['branch', '-r', '--merged', MAIN, '--format=%(refname:short)']),
    git(['branch', '--show-current']),
    out(['status', '--porcelain']),
    out(['stash', 'list', '--format=%gd%x09%cs%x09%gs']),
    out(['for-each-ref', 'refs/tags', '--format=%(refname:short)%09%(objectname)%09%(*objectname)%09%(creatordate:short)']),
    out(['for-each-ref', 'refs/heads', '--format=%(refname:short)%09%(upstream:short)%09%(upstream:track)%09%(committerdate:short)']),
    out(['branch', '--merged', MAIN, '--format=%(refname:short)']),
    git(['rev-parse', '--git-path', 'FETCH_HEAD']),
  ]);
  // When the last `git fetch` ran = modification time of FETCH_HEAD (git rewrites it on every fetch)
  let fetchedAt = null;
  try {
    const st = fs.statSync(path.resolve(CFG.repo, fetchHead.stdout.trim()));
    const d = st.mtime, p2 = n => String(n).padStart(2, '0');
    fetchedAt = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  } catch (e) {}
  const merged = new Set(lines(mergedOut));
  const refs = lines(refsOut).map(l => { const [name, h, date, author, subject] = l.split('\t'); return { name, h, date, author, subject }; })
    .filter(r => r.name !== CFG.remote && !r.name.endsWith('/HEAD'));
  const kindOf = n => n === MAIN ? 'main' : ENVS.includes(n) ? 'env' : /\/release\//.test(n) ? 'release' : /\/feature\//.test(n) ? 'feature' : /\/hotfix\//.test(n) ? 'hotfix' : 'other';
  refs.forEach(r => { r.kind = kindOf(r.name); r.merged = r.kind !== 'main' && merged.has(r.name); r.short = short(r.name); r.ticket = ticketOf(r.name); });

  const openReleases = refs.filter(r => r.kind === 'release' && !r.merged);
  const unreleased = refs.filter(r => (r.kind === 'feature' || r.kind === 'hotfix' || r.kind === 'other') && !r.merged);

  // per-feature details
  const features = await pool(unreleased, 6, async r => {
    const [ahead, behind] = lines(await out(['rev-list', '--left-right', '--count', `${r.name}...${MAIN}`]))[0].split(/\s+/).map(Number);
    const env = {};
    for (const e of ENVS) {
      if (await isAncestor(r.name, e)) env[short(e)] = 'full';
      else {
        const missing = +(await out(['rev-list', '--count', r.name, `^${e}`, `^${MAIN}`])).trim();
        env[short(e)] = missing < ahead ? 'old' : 'none';
      }
    }
    const inRelease = [];
    for (const rel of openReleases) if (await isAncestor(r.name, rel.name)) inRelease.push(rel.short);
    const subjects = lines(await out(['log', '--merges', '--format=%s', `${MAIN}..${r.name}`]));
    const own = r.short;
    const others = [...new Set(subjects.flatMap(s => s.match(/(feature|hotfix)\/[\w-]+|'(staging|dev|master|main)'|release\/\d+/g) || [])
      .map(s => s.replace(/'/g, '')).filter(s => s !== own && s !== CFG.main))];
    const authors = [...new Set(lines(await out(['log', '--no-merges', '--format=%an', `${MAIN}..${r.name}`])))];
    const conflicts = await conflictFiles(MAIN, r.name);
    const commits = lines(await out(['log', '--no-merges', '--format=%h%x09%cs%x09%an%x09%s', `${MAIN}..${r.name}`]))
      .map(l => { const [h, d, a, s] = l.split('\t'); return { h, d, a, s }; });
    return { name: r.name, short: r.short, ticket: r.ticket, date: r.date, ahead, behind, env, inRelease,
      contains: others, authors: authors.length ? authors : [r.author], conflicts, commits };
  });

  const envs = await pool(ENVS.filter(e => refs.find(r => r.name === e)), 2, async e => {
    const [ahead, behind] = lines(await out(['rev-list', '--left-right', '--count', `${e}...${MAIN}`]))[0].split(/\s+/).map(Number);
    const bases = lines(await out(['merge-base', '--all', MAIN, e])).length;
    const merges = +(await out(['rev-list', '--merges', '--count', `${MAIN}..${e}`])).trim();
    const r = refs.find(x => x.name === e);
    return { name: short(e), ref: e, ahead, behind, mergeBases: bases, merges, date: r.date, author: r.author, subject: r.subject,
      tickets: features.filter(f => f.env[short(e)] !== 'none').map(f => ({ short: f.short, ticket: f.ticket, state: f.env[short(e)] })) };
  });

  const releases = await pool(openReleases, 2, rel => releaseInfo(rel, refs, features));
  const tags = lines(tagsOut).map(l => { const [name, h, peeled, date] = l.split('\t'); return { name, h: peeled || h, date }; });
  const current = headR.stdout.trim();
  const local = lines(localOut).map(l => { const [name, upstream, track, date] = l.split('\t'); return { name, upstream, gone: /gone/.test(track), track, date }; });
  const localMerged = new Set(lines(localMergedOut));
  local.forEach(b => { b.merged = localMerged.has(b.name); b.protected = [current, CFG.main, ...CFG.envs, 'main'].includes(b.name); });

  const remoteUrl = hideCreds((await git(['remote', 'get-url', CFG.remote])).stdout.trim());
  defaultIssueUrlCache = await defaultIssueUrl();
  const issueUrl = effectiveIssueUrl();
  cache = {
    repo: path.basename(CFG.repo), repoPath: CFG.repo, remote: CFG.remote, remoteUrl, main: CFG.main, envNames: CFG.envs, checkPaths: CFG.checkPaths,
    issueUrl, issuePreview: !!apiKeyFor(issueUrl),
    current, dirty: lines(status).length, dirtyFiles: lines(status).slice(0, 30),
    fetchedAt, generatedAt: new Date().toISOString(),
    refs: refs.map(({ name, short, kind, merged, date, author, subject, ticket }) => ({ name, short, kind, merged, date, author, subject, ticket })),
    openReleases: openReleases.map(r => r.short), releases, features, envs, tags, local,
    stashes: lines(stash).map(l => { const [ref, date, msg] = l.split('\t'); return { ref, date, msg }; }),
  };
  return cache;
}

// ---------------------------------------------------------------- graph data
async function graph() {
  const ov = await overview();
  const commits = (await out(['log', '--remotes=' + CFG.remote, '--date-order', '--date=short', '--format=%H%x1f%P%x1f%an%x1f%cd%x1f%s%x1e']))
    .split('\x1e').map(s => s.trim()).filter(Boolean).map(r => {
      const [h, p, a, d, s] = r.split('\x1f'); return { h, p: p ? p.split(' ') : [], a, d, s };
    });
  const refs = lines(await out(['for-each-ref', `refs/remotes/${CFG.remote}`, '--format=%(refname:short)%09%(objectname)']))
    .map(l => l.split('\t')).filter(([n]) => n !== CFG.remote && !n.endsWith('/HEAD')).map(([name, h]) => ({ name, h }));
  const featureCommits = {};
  ov.features.forEach(f => { featureCommits[f.name] = f.commits.slice().reverse().map(c => ({ a: c.a, s: c.s })); });
  return {
    repo: ov.repo, generated: new Date().toISOString().slice(0, 16).replace('T', ' '),
    commits, refs, tags: ov.tags,
    plan: {
      main: MAIN, remote: CFG.remote,
      unreleased: ov.features.map(f => f.name),
      keptOther: ov.refs.filter(r => !r.merged && r.kind === 'env').map(r => r.name),
      unmergedRelease: ov.refs.filter(r => r.kind === 'release' && !r.merged).map(r => r.name),
      releaseTags: ov.refs.filter(r => r.kind === 'release' && r.merged).map(r => ({ name: tagNameFor(r.short), h: refs.find(x => x.name === r.name).h })),
      envs: ov.envs.map(e => ({ name: e.name, tickets: ov.features.filter(f => f.env[e.name] !== 'none').map(f => f.name) })),
      featureCommits,
    },
  };
}
const tagNameFor = releaseShort => releaseShort.replace(/^release\//, 'release-');

// ---------------------------------------------------------------- lost-code check
async function envCheck(env) {
  const ref = R(env); if (!ENVS.includes(ref)) throw new Error('unknown environment ' + env);
  const ov = await overview();
  const D = parseDiff(await out(['diff', '-w', MAIN, ref, '--', ...CFG.checkPaths]), true);
  const F = await pool(ov.features, 4, async f => ({ f, d: parseDiff(await out(['diff', '-w', `${MAIN}...${f.name}`, '--', ...CFG.checkPaths])) }));
  const problems = [], explainedBy = {};
  let trivial = 0;
  for (const [file, d] of D) {
    const exM = new Set(), exP = new Set(), touching = [];
    for (const { f, d: fd } of F) { const x = fd.get(file); if (!x) continue; touching.push(f.short); x.minus.forEach(s => exM.add(s)); x.plus.forEach(s => exP.add(s)); }
    const missing = [...d.minus].filter(s => !exM.has(s)), extra = [...d.plus].filter(s => !exP.has(s));
    if (!missing.length && !extra.length) {
      if (touching.length) touching.forEach(s => { explainedBy[s] = (explainedBy[s] || 0) + 1; }); else trivial++;
      continue;
    }
    const commits = lines(await out(['log', '-3', COMMIT_FMT, `${MAIN}..${ref}`, '--', file])).map(parseCommit);
    // changed in main after the environment last received main: simply not merged yet
    const releasedSince = lines(await out(['log', '-5', COMMIT_FMT, `${ref}..${MAIN}`, '--', file])).map(parseCommit);
    problems.push({
      file, touching, missingCount: missing.length, extraCount: extra.length,
      hunks: problemHunks(d.lines, new Set(missing), new Set(extra)), commits, releasedSince,
    });
  }
  const behind = +(await out(['rev-list', '--count', `${ref}..${MAIN}`])).trim();
  // most serious first: released code missing, then unknown changes
  problems.sort((a, b) => (b.missingCount > 0) - (a.missingCount > 0) || (b.missingCount + b.extraCount) - (a.missingCount + a.extraCount));
  const features = Object.entries(explainedBy).map(([short, files]) => ({ short, files })).sort((a, b) => b.files - a.files);
  return { env, main: CFG.main, remote: CFG.remote, behind, paths: CFG.checkPaths, filesDiffering: D.size, explainedFiles: D.size - problems.length, trivialFiles: trivial, features, problems };
}

// ---------------------------------------------------------------- conflicts between features
async function featureConflicts() {
  const ov = await overview();
  const fs_ = ov.features.map(f => f.name), pairs = [];
  for (let i = 0; i < fs_.length; i++) for (let j = i + 1; j < fs_.length; j++) pairs.push([fs_[i], fs_[j]]);
  const res = await pool(pairs, 6, async ([a, b]) => ({ a: short(a), b: short(b), files: await conflictFiles(a, b) }));
  return { pairs: res.filter(p => p.files && p.files.length) };
}

// ---------------------------------------------------------------- merge order (never pushes, no files touched)
// Like merging pull requests one after another into a release: find an order with as few conflicts
// as possible. Every pair is tried in both orders on the target (A then B, B then A), because with
// different merge bases one order can merge cleanly while the other conflicts. Merges are simulated
// in memory with `git merge-tree` + `git commit-tree` (temporary objects only; no branch moves).
async function mergeOrder(base, branches) {
  const ov = await overview();
  const remote = new Map(ov.refs.map(r => [r.short, r.name]));
  const rel = (ov.releases || []).find(r => r.name === base);
  const baseRef = base === CFG.main ? MAIN : rel ? rel.ref : null;
  if (!baseRef) throw new Error('unknown base ' + base);
  branches = [...new Set(branches)];
  branches.forEach(b => { if (!remote.has(b)) throw new Error('unknown branch ' + b); });
  const ref = b => remote.get(b);
  const baseCommit = (await out(['rev-parse', baseRef])).trim();

  // merge X onto commit S in memory: { ok, commit } or { ok: false, files }
  const memo = new Map();
  const tryMerge = async (S, X) => {
    const key = S + ' ' + X;
    if (memo.has(key)) return memo.get(key);
    const r = await git(['merge-tree', '--write-tree', '--name-only', S, ref(X)]);
    let res;
    if (r.code === 0) {
      const tree = r.stdout.split(/\r?\n/)[0].trim();
      const c = await out(['-c', 'user.name=Git Branch Tool', '-c', 'user.email=tool@localhost', 'commit-tree', tree, '-p', S, '-p', ref(X), '-m', 'merge order simulation']);
      res = { ok: true, commit: c.trim() };
    } else if (r.code === 1) {
      const ls = r.stdout.split(/\r?\n/), files = [];
      for (let i = 1; i < ls.length && ls[i] !== ''; i++) files.push(ls[i]);
      res = { ok: false, files };
    } else throw new Error('git merge-tree failed: ' + r.stderr.trim());
    memo.set(key, res);
    return res;
  };
  // a whole order: conflicting steps are reported (and left out of the following steps)
  const simulate = async order => {
    let S = baseCommit; const steps = [];
    for (const X of order) {
      const r = await tryMerge(S, X);
      steps.push(r.ok ? { branch: X, ok: true } : { branch: X, ok: false, files: r.files });
      if (r.ok) S = r.commit;
    }
    return steps;
  };

  const already = [], todo = [];
  for (const b of branches) (await isAncestor(ref(b), baseRef) ? already : todo).push(b);
  const single = {};
  await pool(todo, 4, async b => { single[b] = await tryMerge(baseCommit, b); });
  const withBase = todo.filter(b => !single[b].ok).map(b => ({ branch: b, files: single[b].files }));
  const ok = todo.filter(b => single[b].ok);

  // every pair in both orders
  const pairs = [], before = new Map(ok.map(b => [b, new Set()]));   // before.get(B) = branches that must come before B
  const pairList = [];
  for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) pairList.push([ok[i], ok[j]]);
  await pool(pairList, 4, async ([a, b]) => {
    const ab = await tryMerge(single[a].commit, b), ba = await tryMerge(single[b].commit, a);
    if (ab.ok && ba.ok) return;
    if (ab.ok) { pairs.push({ first: a, then: b, type: 'order', files: ba.files }); before.get(b).add(a); }
    else if (ba.ok) { pairs.push({ first: b, then: a, type: 'order', files: ab.files }); before.get(a).add(b); }
    else pairs.push({ a, b, type: 'both', files: [...new Set([...ab.files, ...ba.files])] });
  });

  // order: respect "must come before"; among the free ones keep the entered order, but put
  // branches with unavoidable conflicts after the others (so each is resolved once, at the end)
  const unavoidable = b => pairs.filter(p => p.type === 'both' && (p.a === b || p.b === b)).length;
  const rank = b => unavoidable(b) * 1000 + branches.indexOf(b);
  const order = [], placed = new Set();
  while (order.length < ok.length) {
    let free = ok.filter(b => !placed.has(b) && [...before.get(b)].every(x => placed.has(x)));
    if (!free.length) free = ok.filter(b => !placed.has(b));          // a cycle: take the best remaining
    free.sort((x, y) => rank(x) - rank(y));
    order.push(free[0]); placed.add(free[0]);
  }
  const suggested = order.concat(withBase.map(x => x.branch));        // conflicts with the target: last
  const entered = branches.filter(b => todo.includes(b));
  const [steps, enteredSteps] = [await simulate(suggested), await simulate(entered)];
  return { base, already, withBase, pairs, steps, enteredSteps,
    conflicts: steps.filter(s => !s.ok).length, enteredConflicts: enteredSteps.filter(s => !s.ok).length };
}

// ---------------------------------------------------------------- rebuild preview (never pushes)
async function rebuildPreview(env, branches) {
  const ov = await overview();
  const envRef = R(env); if (!ENVS.includes(envRef)) throw new Error('unknown environment ' + env);
  const known = new Set(ov.refs.map(r => r.short));
  branches.forEach(b => { if (!known.has(b)) throw new Error('unknown branch ' + b); });
  const wt = path.join(os.tmpdir(), `gitbranchtool-${Date.now()}`);
  await out(['worktree', 'add', '--detach', wt, MAIN]);
  const steps = [];
  try {
    for (const b of branches) {
      const r = await git(['-c', 'rerere.enabled=false', 'merge', '--no-ff', '--no-edit', '-m', `Merge ${b} into ${env} (preview)`, R(b)], { cwd: wt });
      if (r.code === 0) { steps.push({ branch: b, ok: true }); continue; }
      const files = lines((await git(['diff', '--name-only', '--diff-filter=U'], { cwd: wt })).stdout);
      await git(['merge', '--abort'], { cwd: wt });
      steps.push({ branch: b, ok: false, files });
    }
    const stat = (await git(['diff', '--stat', envRef, 'HEAD'], { cwd: wt })).stdout.trim().split(/\r?\n/);
    return { env, steps, diffSummary: stat.slice(-1)[0] || 'identical', diffStat: stat.slice(0, -1).slice(0, 80) };
  } finally {
    await git(['worktree', 'remove', '--force', wt]);
    await git(['worktree', 'prune']);
  }
}

// ---------------------------------------------------------------- actions (re-verified on the server)
async function fetchAll() { const r = await git(['fetch', '--prune', CFG.remote]); cache = null; return { ok: r.code === 0, log: (r.stdout + r.stderr).trim() || 'Up to date.' }; }

async function deleteRemote(branches) {
  const ov = await overview(true);
  const ok = new Set(ov.refs.filter(r => r.merged && r.kind !== 'env' && r.kind !== 'main' && r.kind !== 'release').map(r => r.short));
  const bad = branches.filter(b => !ok.has(b));
  if (bad.length) throw new Error('Refused, not merged into ' + CFG.main + ' (or protected): ' + bad.join(', '));
  if (!branches.length) return { ok: true, log: 'Nothing selected.' };
  const r = await git(['push', CFG.remote, '--delete', ...branches]);
  cache = null; return { ok: r.code === 0, log: (r.stdout + r.stderr).trim() };
}

async function tagReleases(branches, deleteBranch) {
  const ov = await overview(true);
  const ok = new Set(ov.refs.filter(r => r.kind === 'release' && r.merged).map(r => r.short));
  const bad = branches.filter(b => !ok.has(b));
  if (bad.length) throw new Error('Refused, not a merged release branch: ' + bad.join(', '));
  const existing = new Set(ov.tags.map(t => t.name)); const log = [];
  const names = [];
  for (const b of branches) {
    const t = tagNameFor(b); names.push(t);
    if (existing.has(t)) { log.push(`tag ${t} already exists`); continue; }
    const r = await git(['tag', '-a', t, '-m', `Release ${b}`, R(b)]);
    log.push(r.code === 0 ? `created tag ${t}` : `tag ${t} failed: ${r.stderr.trim()}`);
  }
  const p = await git(['push', CFG.remote, ...names.map(n => `refs/tags/${n}`)]);
  log.push((p.stdout + p.stderr).trim());
  if (p.code !== 0) { cache = null; return { ok: false, log: log.join('\n') }; }
  if (deleteBranch) { const d = await git(['push', CFG.remote, '--delete', ...branches]); log.push((d.stdout + d.stderr).trim()); }
  cache = null; return { ok: true, log: log.join('\n') };
}

async function deleteLocal(branches) {
  const ov = await overview(true);
  const ok = new Set(ov.local.filter(b => b.merged && !b.protected).map(b => b.name));
  const bad = branches.filter(b => !ok.has(b));
  if (bad.length) throw new Error('Refused, not merged or protected: ' + bad.join(', '));
  const log = [];
  for (const b of branches) { const r = await git(['branch', '-d', b]); log.push((r.stdout + r.stderr).trim()); }
  cache = null; return { ok: true, log: log.join('\n') };
}

// ---------------------------------------------------------------- one commit (details panel in Network)
async function commitInfo(h) {
  if (!/^[0-9a-f]{4,40}$/i.test(h || '')) throw new Error('unknown commit ' + h);
  const r = await git(['show', '-s', '--no-color', '--format=%H%x09%P%x09%an%x09%ci%x09%s%x00%b', h]);
  if (r.code !== 0) throw new Error('unknown commit ' + h);
  const [head, body] = r.stdout.split('\x00');
  const [hash, parents, author, date, subject] = head.split('\t');
  const ps = parents ? parents.trim().split(' ') : [];
  // what the commit changed; for a merge: what it brought in compared with its first parent
  const d = await git(ps.length ? ['diff-tree', '-r', '--numstat', '-M', ps[0], hash] : ['diff-tree', '-r', '--numstat', '--root', '-M', hash]);
  const files = lines(d.stdout).filter(l => /^(\d+|-)\t/.test(l)).map(l => { const [a, del, ...p] = l.split('\t'); return { add: a, del, path: p.join(' → ') }; });
  return { hash, parents: ps, author, date: date.slice(0, 16), subject, body: (body || '').trim(), files: files.slice(0, 200), fileCount: files.length };
}

// ---------------------------------------------------------------- repositories
// Detect remote, main branch and environment branches of a repository folder.
async function detect(dir) {
  if (!dir || !fs.existsSync(dir)) throw new Error('Folder not found: ' + dir);
  const top = await git(['rev-parse', '--show-toplevel'], { cwd: dir });
  if (top.code !== 0) throw new Error('Not a git repository: ' + dir);
  const root = path.resolve(top.stdout.trim());
  const remotes = lines((await git(['remote'], { cwd: root })).stdout);
  if (!remotes.length) throw new Error('This repository has no remote: ' + root);
  const remote = remotes.includes('origin') ? 'origin' : remotes[0];
  const remoteBranches = async () => lines((await git(['for-each-ref', `refs/remotes/${remote}`, '--format=%(refname:short)'], { cwd: root })).stdout)
    .map(n => n.slice(remote.length + 1)).filter(n => n && n !== 'HEAD');
  let branches = await remoteBranches();
  if (!branches.length) { await git(['fetch', '--prune', remote], { cwd: root }); branches = await remoteBranches(); }
  if (!branches.length) throw new Error('No branches found on the remote: ' + root);
  const head = await git(['symbolic-ref', '--short', `refs/remotes/${remote}/HEAD`], { cwd: root });
  let main = head.code === 0 ? head.stdout.trim().slice(remote.length + 1) : null;
  if (!main || !branches.includes(main)) main = ['master', 'main', 'develop', 'trunk'].find(b => branches.includes(b)) || branches[0];
  const envs = ['dev', 'develop', 'staging', 'stg', 'test'].filter(b => branches.includes(b) && b !== main);
  return { root, remotes, branches, settings: { remote, main, envs, checkPaths: defaultCheckPaths(root) } };
}
async function selectRepo(dir) {
  const d = await detect(path.resolve(dir));
  if (!CONF.repos[d.root]) CONF.repos[d.root] = d.settings;
  CONF.current = d.root;
  CONF.recent = [d.root, ...CONF.recent.filter(p => p !== d.root)].slice(0, 15);
  saveConf(); useRepo(d.root);
  console.log('Repository: ' + d.root);
  return repoList();
}
function repoList() {
  return {
    current: CONF.current, platform: process.platform, home: os.homedir(),
    repos: CONF.recent.map(p => ({ path: p, name: path.basename(p), current: p === CONF.current, exists: fs.existsSync(path.join(p, '.git')), settings: CONF.repos[p] || null })),
  };
}
function forgetRepo(p) {
  if (p === CONF.current) throw new Error('Cannot remove the repository that is open');
  CONF.recent = CONF.recent.filter(x => x !== p); delete CONF.repos[p]; saveConf();
  return repoList();
}
async function repoSettings(b) {
  const d = await detect(CFG.repo);
  const s = { remote: b.remote || CFG.remote, main: b.main, envs: b.envs || [], checkPaths: (b.checkPaths || []).map(x => x.trim()).filter(Boolean) };
  if (!d.remotes.includes(s.remote)) throw new Error('Remote not found: ' + s.remote);
  const missing = [s.main, ...s.envs].filter(x => !d.branches.includes(x));
  if (missing.length) throw new Error('Branch not found on the remote: ' + missing.join(', '));
  if (s.envs.includes(s.main)) throw new Error('The main branch cannot also be an environment branch');
  if (!s.checkPaths.length) s.checkPaths = defaultCheckPaths(CFG.repo);
  // issue link: a URL containing {key}, e.g. https://space.backlog.jp/view/{key}; empty = no links
  const issueUrl = (b.issueUrl || '').trim();
  if (issueUrl && (!/^https?:\/\/[^\s]+$/.test(issueUrl) || !issueUrl.includes('{key}'))) throw new Error('The issue link must be an http(s) URL containing {key}');
  s.issueUrl = issueUrl;
  // Backlog API key (for hover previews): kept per Backlog space, only in config.json on this PC
  const host = issueHost(issueUrl);
  CONF.backlogKeys = CONF.backlogKeys || {};
  if (host && b.removeApiKey) delete CONF.backlogKeys[host];
  else if (host && typeof b.apiKey === 'string' && b.apiKey.trim()) CONF.backlogKeys[host] = b.apiKey.trim();
  CONF.repos[CFG.repo] = s; saveConf(); useRepo(CFG.repo); issueCache.clear();
  return { ok: true, settings: s, branches: d.branches };
}
async function repoInfo() {
  const d = await detect(CFG.repo);
  const issueUrl = effectiveIssueUrl();
  return { path: CFG.repo, settings: { ...CONF.repos[CFG.repo], issueUrl }, remotes: d.remotes, branches: d.branches, hasApiKey: !!apiKeyFor(issueUrl) };
}

// ---------------------------------------------------------------- issue links and previews (Backlog)
// Default link from the git remote: https://space.backlog.jp/git/PROJ/repo.git -> https://space.backlog.jp/view/{key}
async function defaultIssueUrl() {
  const u = (await git(['remote', 'get-url', CFG.remote])).stdout.trim();
  // https://space.backlog.jp/git/... or ssh space@space.git.backlog.jp:/... (web host: space.backlog.jp)
  const m = u.match(/^https?:\/\/(?:[^@/]+@)?([^/]+\.backlog\.(?:jp|com|tool))\//) || u.match(/@([^:/]+\.backlog\.(?:jp|com|tool))[:/]/);
  return m ? `https://${m[1].replace('.git.backlog.', '.backlog.')}/view/{key}` : '';
}
let defaultIssueUrlCache = null;
function effectiveIssueUrl() {
  const s = CONF.repos[CFG.repo] || {};
  return typeof s.issueUrl === 'string' ? s.issueUrl : (defaultIssueUrlCache || '');
}
const issueHost = url => { try { return url ? new URL(url.replace('{key}', 'X')).host : null; } catch (e) { return null; } };
const apiKeyFor = url => { const h = issueHost(url); return h && CONF.backlogKeys ? CONF.backlogKeys[h] : null; };
const issueCache = new Map();                    // key -> { at, data }
async function issueInfo(key) {
  if (!/^[A-Z][A-Z0-9_]*-\d+$/.test(key || '')) throw new Error('unknown issue ' + key);
  const url = effectiveIssueUrl(), apiKey = apiKeyFor(url);
  if (!url) return { key, noLink: true };
  if (!apiKey) return { key, url: url.replace('{key}', key), noApiKey: true };
  const hit = issueCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.data;
  const host = issueHost(url);
  const call = async p => {
    let r;
    try { r = await fetch(`https://${host}/api/v2/${p}${p.includes('?') ? '&' : '?'}apiKey=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(8000) }); }
    catch (e) { throw new Error('Backlog could not be reached'); }
    if (r.status === 401 || r.status === 403) throw new Error('Backlog API key was rejected');
    return r;
  };
  const r = await call(`issues/${encodeURIComponent(key)}`);
  if (r.status === 404) return { key, url: url.replace('{key}', key), notFound: true };
  if (!r.ok) throw new Error('Backlog error ' + r.status);
  const j = await r.json(), name = x => (x && x.name) || '', names = a => (a || []).map(name).filter(Boolean).join(', ');
  const day = s => (s || '').slice(0, 10), time = s => (s || '').replace('T', ' ').slice(0, 16);
  // latest comments (Backlog returns newest first; shown oldest first like Backlog)
  let comments = [];
  try {
    const c = await call(`issues/${encodeURIComponent(key)}/comments?order=desc&count=20`);
    if (c.ok) comments = (await c.json()).filter(x => (x.content || '').trim()).map(x => ({ by: name(x.createdUser), at: time(x.created), text: x.content.replace(/\r/g, '') })).reverse();
  } catch (e) { /* the issue itself is enough */ }
  const data = {
    key, url: url.replace('{key}', key), summary: j.summary,
    status: name(j.status), statusColor: j.status && j.status.color, type: name(j.issueType), typeColor: j.issueType && j.issueType.color,
    priority: name(j.priority), assignee: name(j.assignee), milestone: names(j.milestone), category: names(j.category), versions: names(j.versions),
    start: day(j.startDate), due: day(j.dueDate), estimated: j.estimatedHours, actual: j.actualHours,
    createdBy: name(j.createdUser), created: time(j.created), updatedBy: name(j.updatedUser), updated: time(j.updated),
    description: (j.description || '').replace(/\r/g, ''), attachments: (j.attachments || []).length, comments,
  };
  issueCache.set(key, { at: Date.now(), data });
  return data;
}
// List sub-folders of a folder, marking git repositories (for the folder picker)
function browse(dir) {
  const d = path.resolve(dir || (CFG ? path.dirname(CFG.repo) : os.homedir()));
  if (!fs.existsSync(d)) throw new Error('Folder not found: ' + d);
  const skip = new Set(['node_modules', '$RECYCLE.BIN', 'System Volume Information']);
  const entries = fs.readdirSync(d, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && !skip.has(e.name))
    .map(e => { const full = path.join(d, e.name); let isRepo = false; try { isRepo = fs.existsSync(path.join(full, '.git')); } catch (x) {} return { name: e.name, path: full, isRepo }; })
    .sort((a, b) => (b.isRepo - a.isRepo) || a.name.localeCompare(b.name));
  const drives = process.platform === 'win32' ? 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => l + ':\\').filter(x => { try { return fs.existsSync(x); } catch (e) { return false; } }) : ['/'];
  return { dir: d, parent: path.dirname(d) !== d ? path.dirname(d) : null, isRepo: fs.existsSync(path.join(d, '.git')), entries, drives, home: os.homedir() };
}

// ---------------------------------------------------------------- http
const NO_REPO_OK = new Set(['GET /api/repos', 'POST /api/repo/select', 'POST /api/repo/forget', 'GET /api/browse']);
const ROUTES = {
  'GET /api/repos': () => repoList(),
  'POST /api/repo/select': (q, b) => selectRepo(b.path),
  'POST /api/repo/forget': (q, b) => forgetRepo(b.path),
  'GET /api/repo/info': () => repoInfo(),
  'POST /api/repo/settings': (q, b) => repoSettings(b),
  'GET /api/browse': q => browse(q.get('dir')),
  'GET /api/overview': q => overview(q.get('refresh') === '1'),
  'GET /api/graph': () => graph(),
  'GET /api/commit': q => commitInfo(q.get('h')),
  'GET /api/issue': q => issueInfo(q.get('key')),
  'GET /api/env-check': q => envCheck(q.get('env')),
  'GET /api/feature-conflicts': () => featureConflicts(),
  'POST /api/rebuild-preview': (q, b) => rebuildPreview(b.env, b.branches || []),
  'POST /api/merge-order': (q, b) => mergeOrder(b.base, b.branches || []),
  'POST /api/fetch': () => fetchAll(),
  'POST /api/delete-remote': (q, b) => deleteRemote(b.branches || []),
  'POST /api/tag-releases': (q, b) => tagReleases(b.branches || [], !!b.deleteBranch),
  'POST /api/delete-local': (q, b) => deleteLocal(b.branches || []),
};

// --auto-stop (used by start.vbs, which runs without a console window): stop when the browser is closed.
// Every open page keeps one event-stream connection; when the last one closes, stop after a short grace
// period (a page reload reconnects within it). If no page connects within 2 minutes after start, stop too.
const AUTO_STOP = process.argv.includes('--auto-stop');
let alivePages = 0, stopTimer = null;
const scheduleStop = ms => {
  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => { if (alivePages === 0) { console.log('Browser closed: stopping.'); process.exit(0); } }, ms);
};
if (AUTO_STOP) scheduleStop(120000);

const server = http.createServer(async (req, res) => {
  const host = (req.headers.host || '').split(':')[0];
  if (!['localhost', '127.0.0.1'].includes(host)) { res.writeHead(403); return res.end('forbidden'); }
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/alive') {   // the page's "still open" connection
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    alivePages++; clearTimeout(stopTimer);
    const beat = setInterval(() => res.write(': alive\n\n'), 25000);
    req.on('close', () => { clearInterval(beat); alivePages--; if (AUTO_STOP && alivePages === 0) scheduleStop(15000); });
    return;
  }
  // the page and its files; only these names are served (nothing else from the disk)
  const STATIC = /^\/(index\.html|app\.css|icon\.(?:png|svg|ico)|js\/[a-z0-9-]+\.js)$/;
  const TYPES = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', png: 'image/png', svg: 'image/svg+xml', ico: 'image/x-icon' };
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  if (req.method === 'GET' && STATIC.test(file)) {
    const f = path.join(__dirname, file.slice(1));
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[file.split('.').pop()], 'cache-control': 'no-store' });
    return res.end(fs.readFileSync(f));
  }
  const fn = ROUTES[`${req.method} ${url.pathname}`];
  if (!fn) { res.writeHead(404); return res.end('not found'); }
  // API calls must come from our page: a custom header cannot be sent cross-site without a CORS preflight
  if (req.headers['x-git-tool'] !== '1') { res.writeHead(403); return res.end('forbidden'); }
  if (!CFG && !NO_REPO_OK.has(`${req.method} ${url.pathname}`)) {
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'No repository selected', noRepo: true }));
  }
  let body = {};
  if (req.method === 'POST') {
    const chunks = []; for await (const c of req) chunks.push(c);
    try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch (e) { body = {}; }
  }
  const started = Date.now();
  try {
    const data = await fn(url.searchParams, body);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(data));
    console.log(`${req.method} ${url.pathname} ${Date.now() - started}ms`);
  } catch (e) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: e.message }));
    console.log(`${req.method} ${url.pathname} ERROR ${e.message.split('\n')[0]}`);
  }
});

// ---------------------------------------------------------------- startup
const URL_ = `http://localhost:${CONF.port}`;
const OPEN = process.argv.includes('--open');      // open the browser (used by the start scripts)
function openBrowser(url) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { const p = require('child_process').spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }); p.on('error', () => {}); p.unref(); }
  catch (e) { /* no browser launcher available: the URL is printed below */ }
}
// merge-tree --write-tree (conflict checks) needs git 2.38 or newer
execFile('git', ['--version'], { windowsHide: true }, (err, stdout) => {
  if (err) { console.error('git was not found. Install git and make sure it is on the PATH.'); process.exit(1); }
  const m = stdout.match(/(\d+)\.(\d+)/);
  if (m && (+m[1] < 2 || (+m[1] === 2 && +m[2] < 38))) console.warn(`Warning: ${stdout.trim()} is older than 2.38; conflict checks will not work. Please update git.`);
});

if (CONF.current && CONF.repos[CONF.current] && fs.existsSync(path.join(CONF.current, '.git'))) useRepo(CONF.current);
else console.log('No repository selected yet: choose one in the page.');
server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.log(`The tool is already running at ${URL_}`);
    if (OPEN) { openBrowser(URL_); return setTimeout(() => process.exit(0), 500); }
  } else console.error(e.message);
  process.exit(1);
});
server.listen(CONF.port, '127.0.0.1', () => {
  console.log(`Git Branch Tool: ${URL_}   repo: ${CFG ? CFG.repo : '(none)'}`);
  console.log(AUTO_STOP ? 'Running in the background; it stops by itself when the browser tab is closed.'
    : 'Keep this window open while you use the tool. Stop it with Ctrl+C or by closing the window.');
  if (OPEN) openBrowser(URL_);
});
