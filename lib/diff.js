// Diff analysis for the lost-code check (no git calls, no state).
// Idea: an environment branch should be exactly main + the unreleased feature branches.
// Every line that differs from main must therefore be a line that some unreleased feature
// changes. A line that differs but that no feature changes is a problem:
//   "-" line (in main, not in env)  -> released code is missing on the environment
//   "+" line (in env, not in main)  -> unknown change: from no feature (old conflict fix, direct commit…)
const normLine = l => l.slice(1).trim();
const significant = t => t.length > 3;            // ignore blank lines and lone braces
function parseDiff(text, keepLines) {
  const files = new Map(); let cur = null;
  for (const l of text.split(/\r?\n/)) {
    if (l.startsWith('diff --git ')) {
      const m = l.match(/ b\/(.*)$/); cur = { minus: new Set(), plus: new Set(), lines: keepLines ? [] : null };
      files.set(m ? m[1] : l, cur); continue;
    }
    if (!cur || l.startsWith('---') || l.startsWith('+++') || l.startsWith('index ') || l.startsWith('new file') || l.startsWith('deleted file') || l.startsWith('similarity') || l.startsWith('rename ') || l.startsWith('Binary')) continue;
    if (l[0] === '-' || l[0] === '+') { const t = normLine(l); if (significant(t)) cur[l[0] === '-' ? 'minus' : 'plus'].add(t); }
    if (keepLines && (l[0] === '-' || l[0] === '+' || l[0] === ' ' || l.startsWith('@@'))) cur.lines.push(l);
  }
  return files;
}
// Cut a file's diff into hunks and keep only the hunks that contain a problem line
function problemHunks(lines, missing, extra) {
  const hunks = []; let h = null;
  for (const l of lines) {
    if (l.startsWith('@@')) { h = { header: l.replace(/^(@@[^@]*@@).*/, '$1'), lines: [], bad: 0 }; hunks.push(h); continue; }
    if (!h) continue;
    const t = l[0], s = l.slice(1), n = s.trim();
    const bad = (t === '-' && missing.has(n)) || (t === '+' && extra.has(n));
    if (bad) h.bad++;
    h.lines.push({ t, s, bad });
  }
  const keep = hunks.filter(x => x.bad);
  let budget = 260;                                  // keep the page readable for huge files
  return keep.filter(x => (budget -= x.lines.length) > 0 || x === keep[0]).map(({ header, lines }) => ({ header, lines }));
}

module.exports = { parseDiff, problemHunks, normLine, significant };
