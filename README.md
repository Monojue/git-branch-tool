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
| Windows | Double-click `start.vbs`: no console window; stops by itself when you close the browser tab (`start.bat`: same, with a console window) |
| macOS | Double-click `start.command` (first time: right-click → **Open**) |
| Linux | `./start.sh` (or `sh start.sh`) |

The tool opens at http://localhost:4777. With `start.vbs` there is no window and nothing to stop.
With `start.bat`, `start.command` or `start.sh`, keep the console / terminal window open while you use it;
close it or press Ctrl+C to stop. Starting it again while it runs just opens the browser.

Windows desktop shortcut: double-click `create-shortcut.bat` once. It puts a **Git Branch Tool** shortcut
(with the tool's icon, starting `start.vbs`) on the desktop; right-click it to pin it to the taskbar or Start.
Run it again after moving the folder.

If `./start.sh` or `start.command` is not allowed to run (for example after copying the folder from
Windows), run `chmod +x start.sh start.command` once.

## Files
- `server.js`: local server (talks to git): the analysis behind each screen, the actions, HTTP
- `lib/`: `config.js` (settings), `git.js` (running git), `diff.js` (lost-code diff analysis)
- `index.html`, `app.css`, `js/*.js`: the page (one script per screen; `i18n.js` holds all texts in English and Japanese)
- `test/`: automated tests
- `scripts/build-demo.js`, `scripts/demo/`: builds the static demo; `demo/`: the built demo (generated, do not edit)
- `config.json`: your repository list and settings (created by the tool; personal, not shared)

## For developers
Run the tests before sharing a change:

```
npm test
```

They build a small git repository with a known situation (released and unreleased features, a conflict
with master, an outdated release, an unexplained change on dev; see `test/fixture.js`), start the real
server on it with its own settings file (`GBT_CONFIG`) and check what every screen receives, including the
safety rules of the cleanup actions. Nothing outside a temporary folder is touched. Needs only Node.js and git.

### Demo (static, for free hosting)
`demo/` is the real page answered from saved JSON instead of the server, using the made-up test
repository: no git, no logins, no real data; buttons that change git are disabled. Any static host can
serve it. On Vercel: import the repository, set **Root Directory** to `demo`, framework **Other**, no build command.

After changing the page, rebuild it (runs the tool on the test repository for every choice of features; takes several minutes):

```
npm run build-demo                      # optional: -- --download <url> for the "Download the tool" link
```

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
| Windows | `start.vbs` をダブルクリック（コンソールなし。ブラウザのタブを閉じると自動で終了。`start.bat` はコンソール付き） |
| macOS | `start.command` をダブルクリック（初回は右クリック →**開く**） |
| Linux | `./start.sh`（または `sh start.sh`） |

http://localhost:4777 で開きます。`start.vbs` の場合はウィンドウがなく、終了操作も不要です。
`start.bat`・`start.command`・`start.sh` の場合は、使用中はコンソール／ターミナルのウィンドウを閉じないでください
（閉じるか Ctrl+C で終了）。起動中にもう一度起動すると、ブラウザで開くだけです。

Windowsのデスクトップショートカット: `create-shortcut.bat` を一度ダブルクリックすると、デスクトップに
**Git Branch Tool** のショートカット（ツールのアイコン付き、`start.vbs` で起動）が作成されます。
右クリックでタスクバーやスタートにピン留めできます。フォルダを移動した場合はもう一度実行してください。

`./start.sh` や `start.command` が実行できない場合（Windowsからフォルダをコピーした場合など）は、
一度 `chmod +x start.sh start.command` を実行してください。

## デモ
`demo/` は、架空のテスト用リポジトリのデータを保存して表示する静的なデモです（git・ログイン・実データなし。gitを変更するボタンは無効）。
Vercel などの無料の静的ホスティングで公開できます（Vercel: リポジトリをインポートし、**Root Directory** を `demo`、フレームワークを **Other**、ビルドコマンドなし）。
画面を変更したら `npm run build-demo` で作り直してください（数分かかります）。
