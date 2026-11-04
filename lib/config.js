// Settings: config.json next to the tool (or GBT_CONFIG). Keeps the current repository, the recent
// list, per-repository settings and Backlog API keys. The older flat format is migrated.
const fs = require('fs');
const path = require('path');
const TOOL_DIR = path.join(__dirname, '..');

const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return {}; } };
// Lost-code check looks at the source folder by default; the whole repository if there is no src/
const defaultCheckPaths = root => fs.existsSync(path.join(root, 'src')) ? ['src'] : ['.'];
// GBT_CONFIG=path uses another settings file (the tests use this)
const CONFIG_FILE = process.env.GBT_CONFIG ? path.resolve(process.env.GBT_CONFIG) : path.join(TOOL_DIR, 'config.json');
const CONF = (() => {
  const raw = readJson(CONFIG_FILE);
  // keep every saved field (API keys, flags, …); only fill in defaults
  const conf = { ...raw, port: raw.port || 4777, current: raw.current || null, recent: raw.recent || [], repos: raw.repos || {}, backlogKeys: raw.backlogKeys || {} };
  if (raw.repo && !raw.repos) {            // migrate the old single-repository format
    const p = path.resolve(TOOL_DIR, raw.repo);
    conf.repos[p] = { remote: raw.remote || 'origin', main: raw.main || 'master', envs: raw.envs || ['dev', 'staging'], checkPaths: raw.checkPaths || defaultCheckPaths(p) };
    conf.current = p; conf.recent = [p];
    ['repo', 'remote', 'main', 'envs', 'checkPaths'].forEach(k => delete conf[k]);
  }
  return conf;
})();
const saveConf = () => fs.writeFileSync(CONFIG_FILE, JSON.stringify(CONF, null, 2));
// One-time upgrade: repositories saved with the old default "." now default to src/
if (!CONF.srcDefault) {
  for (const [p, s] of Object.entries(CONF.repos)) if (s.checkPaths && s.checkPaths.join() === '.') s.checkPaths = defaultCheckPaths(p);
  CONF.srcDefault = true; saveConf();
}

module.exports = { CONFIG_FILE, CONF, saveConf, defaultCheckPaths, readJson };
