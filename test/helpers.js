// Starts the real server (node server.js) on a test port with its own settings file.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TOOL_DIR = path.join(__dirname, '..');
const wait = ms => new Promise(r => setTimeout(r, ms));

async function startServer(configPath, port) {
  const proc = spawn(process.execPath, ['server.js'], { cwd: TOOL_DIR, env: { ...process.env, GBT_CONFIG: configPath }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; proc.stdout.on('data', d => { log += d; }); proc.stderr.on('data', d => { log += d; });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 50; i++) {
    try { await fetch(base + '/'); break; } catch (e) { await wait(200); }
    if (i === 49) throw new Error('server did not start:\n' + log);
  }
  const call = async (p, body) => {
    const r = await fetch(base + p, body === undefined ? { headers: { 'x-git-tool': '1' } }
      : { method: 'POST', headers: { 'x-git-tool': '1', 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, ...(await r.json()) };
  };
  const stop = async () => { proc.kill(); await new Promise(r => proc.once('exit', r)); };
  return { base, call, stop, log: () => log };
}

function writeConfig(dir, port, repo, extra = {}) {
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify({
    port, current: repo, recent: [repo],
    repos: { [repo]: { remote: 'origin', main: 'master', envs: ['dev', 'staging'], checkPaths: ['src'] } },
    srcDefault: true, ...extra,
  }, null, 2));
  return file;
}

module.exports = { startServer, writeConfig, wait };
