// Running git: every command goes through execFile (no shell). Commands run in the current
// repository unless a cwd is given.
const { execFile } = require('child_process');
let repoDir = null;
const setRepoDir = d => { repoDir = d; };

function git(args, { cwd = repoDir } = {}) {
  return new Promise(resolve => {
    execFile('git', args, { cwd, maxBuffer: 1 << 28, windowsHide: true, encoding: 'utf8' }, (err, stdout, stderr) => {
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout, stderr });
    });
  });
}
async function out(args, opts) {
  const r = await git(args, opts);
  if (r.code !== 0) throw new Error(`git ${args.join(' ')}\n${r.stderr.trim()}`);
  return r.stdout;
}
const lines = s => s.split(/\r?\n/).filter(Boolean);
const isAncestor = async (a, b) => (await git(['merge-base', '--is-ancestor', a, b])).code === 0;
async function pool(items, n, fn) {
  const res = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); }
  }));
  return res;
}
// merge-tree --write-tree --name-only: exit 1 = conflicts; stdout = tree, conflicted files, blank, messages
async function conflictFiles(a, b) {
  const r = await git(['merge-tree', '--write-tree', '--name-only', a, b]);
  if (r.code === 0) return [];
  if (r.code !== 1) return null;
  const ls = r.stdout.split(/\r?\n/); const files = [];
  for (let i = 1; i < ls.length && ls[i] !== ''; i++) files.push(ls[i]);
  return files;
}

module.exports = { git, out, lines, isAncestor, pool, conflictFiles, setRepoDir };
