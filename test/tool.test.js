// End-to-end tests: build a repository with a known situation (test/fixture.js), start the real
// server on it with its own settings file, and check what each screen receives.
//   Run:  npm test        (or: node --test test/*.test.js)
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeRepo } = require('./fixture');
const { startServer, writeConfig } = require('./helpers');

describe('analysis of a repository with a known situation', () => {
  let repo, srv, ov;
  const PORT = 4791;
  const feature = name => ov.features.find(f => f.short === name);

  before(async () => {
    repo = makeRepo();
    srv = await startServer(writeConfig(repo.root, PORT, repo.work), PORT);
    ov = await srv.call('/api/overview');
  });
  after(async () => { if (srv) await srv.stop(); if (repo) repo.cleanup(); });

  it('lists only unreleased branches as features', () => {
    assert.deepEqual(ov.features.map(f => f.short).sort(), ['feature/PRJ-2', 'feature/PRJ-3', 'feature/PRJ-4', 'feature/PRJ-5', 'feature/PRJ-6', 'feature/PRJ-7', 'feature/PRJ-8']);
  });

  it('marks branches already in master as merged', () => {
    const merged = ov.refs.filter(r => r.merged).map(r => r.short).sort();
    assert.deepEqual(merged, ['feature/PRJ-1', 'release/20980101']);
  });

  it('finds the conflict with master and its file', () => {
    assert.deepEqual(feature('feature/PRJ-3').conflicts, ['src/app.txt']);
    assert.deepEqual(feature('feature/PRJ-2').conflicts, []);
  });

  it('knows which branch contains another branch', () => {
    assert.deepEqual(feature('feature/PRJ-4').contains, ['feature/PRJ-2']);
  });

  it('sees that dev and staging have an old version of PRJ-2', () => {
    assert.equal(feature('feature/PRJ-2').env.dev, 'old');
    assert.equal(feature('feature/PRJ-2').env.staging, 'old');
    assert.equal(feature('feature/PRJ-3').env.dev, 'none');
  });

  it('reports the open release, with PRJ-2 outdated by one commit', () => {
    assert.deepEqual(ov.openReleases, ['release/20990101']);
    const rel = ov.releases[0], prj2 = rel.included.find(x => x.short === 'feature/PRJ-2');
    // PRJ-4 contains PRJ-2 but was never merged into the release itself
    assert.deepEqual(rel.included.map(x => x.short), ['feature/PRJ-2']);
    assert.equal(prj2.title, 'PRJ-2 add p2');
    assert.equal(prj2.state, 'outdated');
    assert.equal(prj2.missing.length, 1);
    assert.deepEqual(rel.conflicts, []);
    assert.deepEqual(rel.envMerges, []);
  });

  it('lost-code check: dev has one unexplained line, staging is clean', async () => {
    const dev = await srv.call('/api/env-check?env=dev');
    assert.equal(dev.problems.length, 1);
    assert.equal(dev.problems[0].file, 'src/app.txt');
    assert.equal(dev.problems[0].extraCount, 1);
    assert.equal(dev.problems[0].missingCount, 0);
    const staging = await srv.call('/api/env-check?env=staging');
    assert.deepEqual(staging.problems, []);
  });

  it('feature conflicts: PRJ-3 conflicts with the branches that have the new master', async () => {
    const r = await srv.call('/api/feature-conflicts');
    assert.ok(r.pairs.some(p => [p.a, p.b].includes('feature/PRJ-3')));
  });

  it('rebuild preview: PRJ-2 merges, PRJ-3 conflicts, nothing is pushed', async () => {
    const before = repo.git('rev-parse', 'origin/staging').trim();
    const r = await srv.call('/api/rebuild-preview', { env: 'staging', branches: ['feature/PRJ-2', 'feature/PRJ-3'] });
    assert.deepEqual(r.steps.map(s => [s.branch, s.ok]), [['feature/PRJ-2', true], ['feature/PRJ-3', false]]);
    assert.deepEqual(r.steps[1].files, ['src/app.txt']);
    repo.git('fetch', '-q');
    assert.equal(repo.git('rev-parse', 'origin/staging').trim(), before);
  });

  it('merge order: finds the order that avoids a conflict, and the pairs that conflict anyway', async () => {
    const refsBefore = repo.git('for-each-ref', '--format=%(refname) %(objectname)');
    // entered like pull requests, in an unlucky order
    const p = await srv.call('/api/merge-order', { base: 'master', branches: ['feature/PRJ-8', 'feature/PRJ-7', 'feature/PRJ-5', 'feature/PRJ-6', 'feature/PRJ-3'] });
    const ord = p.pairs.find(x => x.type === 'order');
    assert.deepEqual([ord.first, ord.then, ord.files], ['feature/PRJ-7', 'feature/PRJ-8', ['src/c.txt']]);
    const both = p.pairs.find(x => x.type === 'both');
    assert.deepEqual([both.a, both.b].sort(), ['feature/PRJ-5', 'feature/PRJ-6']);
    assert.deepEqual(p.withBase.map(x => x.branch), ['feature/PRJ-3']);
    // suggested: PRJ-7 before PRJ-8 (clean), the unavoidable conflict and the conflict with master last
    assert.deepEqual(p.steps.map(s => [s.branch, s.ok]), [['feature/PRJ-7', true], ['feature/PRJ-8', true], ['feature/PRJ-5', true], ['feature/PRJ-6', false], ['feature/PRJ-3', false]]);
    assert.equal(p.conflicts, 2);
    assert.equal(p.enteredSteps.find(s => s.branch === 'feature/PRJ-7').ok, false);   // PRJ-8 then PRJ-7 conflicts
    assert.equal(p.enteredConflicts, 3);
    // simulated in memory only: no branch or tag moved
    assert.equal(repo.git('for-each-ref', '--format=%(refname) %(objectname)'), refsBefore);
  });

  it('commit details of a merge list what it brought in', async () => {
    const h = repo.git('rev-parse', 'origin/staging').trim();
    const c = await srv.call('/api/commit?h=' + h);
    assert.equal(c.parents.length, 2);
    assert.deepEqual(c.files.map(f => f.path), ['src/p2.txt']);
  });

  it('refuses to delete branches that are not merged, or environment branches', async () => {
    for (const b of ['feature/PRJ-3', 'staging', 'master']) {
      const r = await srv.call('/api/delete-remote', { branches: [b] });
      assert.equal(r.status, 400, b);
      assert.match(r.error, /Refused/);
    }
  });

  it('deletes a merged branch on the remote', async () => {
    const r = await srv.call('/api/delete-remote', { branches: ['feature/PRJ-1'] });
    assert.equal(r.ok, true);
    assert.equal(repo.git('ls-remote', '--heads', 'origin', 'feature/PRJ-1').trim(), '');
  });

  it('turns a merged release into a tag and deletes the branch', async () => {
    const r = await srv.call('/api/tag-releases', { branches: ['release/20980101'], deleteBranch: true });
    assert.equal(r.ok, true);
    assert.match(repo.git('ls-remote', '--tags', 'origin'), /refs\/tags\/release-20980101/);
    assert.equal(repo.git('ls-remote', '--heads', 'origin', 'release/20980101').trim(), '');
  });

  it('serves only the page files, never the settings or the server code', async () => {
    for (const [p, code] of [['/', 200], ['/js/core.js', 200], ['/app.css', 200], ['/config.json', 404], ['/server.js', 404], ['/lib/config.js', 404]]) {
      assert.equal((await fetch(srv.base + p)).status, code, p);
    }
    assert.equal((await fetch(srv.base + '/api/overview')).status, 403, 'API without the page header');
  });
});

describe('settings', () => {
  let repo;
  before(() => { repo = makeRepo(); });
  after(() => repo.cleanup());

  it('keeps the Backlog API key after restarting (regression)', async () => {
    const PORT = 4792;
    // no srcDefault flag: the server saves the settings at start, which used to drop the key
    const cfg = writeConfig(repo.root, PORT, repo.work, { srcDefault: undefined, backlogKeys: { 'example.backlog.jp': 'KEY-1' } });
    let srv = await startServer(cfg, PORT);
    await srv.call('/api/repo/settings', { main: 'master', envs: ['dev', 'staging'], checkPaths: ['src'], issueUrl: 'https://example.backlog.jp/view/{key}', apiKey: 'KEY-2' });
    await srv.stop();
    for (let i = 0; i < 2; i++) {            // two restarts
      srv = await startServer(cfg, PORT);
      const info = await srv.call('/api/repo/info');
      await srv.stop();
      assert.equal(info.hasApiKey, true);
      assert.equal(JSON.parse(fs.readFileSync(cfg, 'utf8')).backlogKeys['example.backlog.jp'], 'KEY-2');
    }
  });

  it('issue links: no link for a non-Backlog remote, then the configured link', async () => {
    const PORT = 4793;
    const srv = await startServer(writeConfig(path.join(repo.root), PORT, repo.work), PORT);
    try {
      assert.equal((await srv.call('/api/overview')).issueUrl, '');
      const bad = await srv.call('/api/repo/settings', { main: 'master', envs: ['dev', 'staging'], checkPaths: ['src'], issueUrl: 'https://example.backlog.jp/view/' });
      assert.match(bad.error, /\{key\}/);
      await srv.call('/api/repo/settings', { main: 'master', envs: ['dev', 'staging'], checkPaths: ['src'], issueUrl: 'https://example.backlog.jp/view/{key}', removeApiKey: true });
      const issue = await srv.call('/api/issue?key=PRJ-2');
      assert.equal(issue.url, 'https://example.backlog.jp/view/PRJ-2');
      assert.equal(issue.noApiKey, true);       // without a key nothing is sent to Backlog
    } finally { await srv.stop(); }
  });
});
