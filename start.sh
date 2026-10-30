#!/bin/sh
# Git Branch Tool (macOS / Linux): run ./start.sh  (or: sh start.sh)
# Opens the tool in your browser. Keep this terminal open; stop with Ctrl+C.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required: https://nodejs.org  (Node.js が必要です)"; exit 1
fi
if ! command -v git >/dev/null 2>&1; then
  echo "git is required: https://git-scm.com  (git が必要です)"; exit 1
fi
exec node server.js --open
