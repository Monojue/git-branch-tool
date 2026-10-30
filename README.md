# Git Branch Tool

A local web tool that shows the state of a git repository's branches (features, releases,
dev / staging, lost code) and helps clean them up. It runs only on your PC and opens in your browser.
The full guide is inside the tool: **📖 Guide / 使い方**.

## Requirements
- [Node.js](https://nodejs.org) (any current LTS version)
- [git](https://git-scm.com) 2.38 or newer

## Start
| OS | How |
|---|---|
| Windows | Double-click `start.bat` |
| macOS | Double-click `start.command` (first time: right-click → **Open**) |
| Linux | `./start.sh` (or `sh start.sh`) |

The tool opens at http://localhost:4777. Keep the console / terminal window open while you use it;
close it or press Ctrl+C to stop. Starting it again while it runs just opens the browser.

If `./start.sh` or `start.command` is not allowed to run (for example after copying the folder from
Windows), run `chmod +x start.sh start.command` once.

## Files
- `server.js`: local server (talks to git)
- `index.html`: the page
- `config.json`: your repository list and settings (created by the tool; personal, not shared)

---

# Git Branch Tool（日本語）

gitリポジトリのブランチの状態（機能ブランチ、リリース、dev / staging、コードの欠落）を表示し、
整理を手伝うローカルのWebツールです。PC上だけで動き、ブラウザで開きます。
詳しい使い方はツール内の **📖 使い方** を参照してください。

## 必要なもの
- [Node.js](https://nodejs.org)（現行のLTS版）
- [git](https://git-scm.com) 2.38 以降

## 起動方法
| OS | 方法 |
|---|---|
| Windows | `start.bat` をダブルクリック |
| macOS | `start.command` をダブルクリック（初回は右クリック →**開く**） |
| Linux | `./start.sh`（または `sh start.sh`） |

http://localhost:4777 で開きます。使用中はコンソール／ターミナルのウィンドウを閉じないでください
（閉じるか Ctrl+C で終了）。起動中にもう一度起動すると、ブラウザで開くだけです。

`./start.sh` や `start.command` が実行できない場合（Windowsからフォルダをコピーした場合など）は、
一度 `chmod +x start.sh start.command` を実行してください。
