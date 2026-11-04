// Builds a small git repository with a known situation, in a temporary folder:
//
//   master            initial → merge release/20980101 (contains feature/PRJ-1) → "change line one"
//   feature/PRJ-1     released (merged into master through release/20980101)
//   release/20980101  merged into master            -> can become a tag
//   feature/PRJ-3     changes "line one" before master did -> conflicts with master
//   feature/PRJ-2     clean; merged into dev, staging and release/20990101,
//                     then gets a newer commit       -> those three have an old version
//   feature/PRJ-4     contains feature/PRJ-2 (merged into it) plus its own commit
//   feature/PRJ-5/6   each clean against master, but they conflict with each other (src/b.txt)
//   dev               master + PRJ-2 + a direct, unexplained change in src/app.txt
//   staging           master + PRJ-2
//   release/20990101  open release: master + PRJ-2 (old version)
//
// The working copy ("work") has everything pushed to the bare "origin" and fetched back,
// like a developer's clone of a Backlog repository.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gbt-test-'));
  const origin = path.join(root, 'origin.git'), work = path.join(root, 'work');
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Tester', GIT_AUTHOR_EMAIL: 'tester@example.com', GIT_COMMITTER_NAME: 'Tester', GIT_COMMITTER_EMAIL: 'tester@example.com' };
  const run = (cwd, args) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const g = (...args) => run(work, args);

  run(root, ['init', '--bare', '-q', origin]);
  run(root, ['clone', '-q', origin, work]);
  g('config', 'core.autocrlf', 'false');
  const write = (file, text) => { const f = path.join(work, file); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  const commit = msg => { g('add', '-A'); g('commit', '-q', '-m', msg); };
  const branch = (name, from) => g('checkout', '-q', '-b', name, from);
  const checkout = name => g('checkout', '-q', name);
  const merge = (b, msg) => g('merge', '-q', '--no-ff', '-m', msg, b);
  const app = first => `${first}\nline two is shared\nline three is shared\n`;

  g('checkout', '-q', '-b', 'master');
  write('src/app.txt', app('line one is shared')); write('src/b.txt', 'b file content here\n'); commit('initial');

  branch('feature/PRJ-1', 'master'); write('src/a1.txt', 'feature one content\n'); commit('PRJ-1 add a1');
  branch('release/20980101', 'master'); merge('feature/PRJ-1', "Merge branch 'feature/PRJ-1' into release/20980101");
  checkout('master'); merge('release/20980101', "Merge branch 'release/20980101'");

  branch('feature/PRJ-3', 'master'); write('src/app.txt', app('line one changed by PRJ-3')); commit('PRJ-3 change line one');
  checkout('master'); write('src/app.txt', app('line one changed on master')); commit('master: change line one');

  branch('feature/PRJ-2', 'master'); write('src/p2.txt', 'feature two first version\n'); commit('PRJ-2 add p2');
  branch('feature/PRJ-4', 'master'); merge('feature/PRJ-2', "Merge branch 'feature/PRJ-2' into feature/PRJ-4");
  write('src/p4.txt', 'feature four content\n'); commit('PRJ-4 add p4');

  // PRJ-5 and PRJ-6 change the same line: each merges cleanly into master, but not both
  branch('feature/PRJ-5', 'master'); write('src/b.txt', 'b changed by PRJ-5\n'); commit('PRJ-5 change b');
  branch('feature/PRJ-6', 'master'); write('src/b.txt', 'b changed by PRJ-6\n'); commit('PRJ-6 change b');

  branch('dev', 'master'); merge('feature/PRJ-2', "Merge branch 'feature/PRJ-2' into dev");
  write('src/app.txt', app('line one changed on master') + 'unexplained line added on dev\n'); commit('direct change on dev');
  branch('staging', 'master'); merge('feature/PRJ-2', "Merge branch 'feature/PRJ-2' into staging");
  branch('release/20990101', 'master'); merge('feature/PRJ-2', "Merge branch 'feature/PRJ-2' into release/20990101");

  checkout('feature/PRJ-2'); write('src/p2b.txt', 'feature two second part\n'); commit('PRJ-2 add p2b');

  g('push', '-q', 'origin', '--all');
  g('fetch', '-q', '--prune');
  checkout('master');
  return { root, origin, work, git: g, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

module.exports = { makeRepo };
