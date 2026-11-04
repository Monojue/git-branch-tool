// Git Branch Tool — Guide screen (English and Japanese).
// ============================================================ guide
const GUIDE = {
  en: [
    ['start', 'Getting started', `
      <ol>
        <li>Start the tool from the <code>git-tool</code> folder. It opens in your browser at <code>http://localhost:4777</code>. Keep the console / terminal window open while you use it; close it (or press Ctrl+C) to stop.
          <table><tbody>
            <tr><td>Windows</td><td>Double-click <code>start.vbs</code> (or the pinned icon): no console window, and the tool stops by itself shortly after you close its browser tab. <code>start.bat</code> does the same with a console window, for troubleshooting.</td></tr>
            <tr><td>macOS</td><td>Double-click <code>start.command</code>. The first time, right-click it → <b>Open</b> if macOS refuses to open it.</td></tr>
            <tr><td>Linux</td><td>Run <code>./start.sh</code> in a terminal (or <code>sh start.sh</code>).</td></tr>
          </tbody></table>
          Needs Node.js and git 2.38 or newer.</li>
        <li>Choose a repository: click the repository box at the top of the sidebar, then <b>Open</b> one from the recent list, type a folder path, or use <b>Browse folders…</b> (git repositories are marked 📦).</li>
        <li>Every time you open or reload the page, the tool runs <code>git fetch</code> first, so you always see the latest data from Backlog. Click <b>↻ Fetch latest git data</b> to refresh at any time.</li>
        <li>Switch the language (日本語 / English) and the theme at the bottom of the sidebar.</li>
      </ol>
      <div class="tip">The tool runs only on your PC. Nothing is uploaded anywhere.</div>`],
    ['screens', 'The screens', `
      <table><tbody>
        <tr><td><a href="#" data-go="overview">Overview</a></td><td>The state of the repository at a glance, and the recommended next steps, most important first. Click <b>Open</b> on a step to go to the screen that handles it.</td></tr>
        <tr><td><a href="#" data-go="features">Features</a></td><td>Every branch not yet in master: owner, whether it is based on the current master, whether it conflicts with master, which version dev / staging have, which release contains it, and whether it contains other tickets. Click a row for its commits, the conflicting files and the rebase command. <b>Check conflicts between features</b> lists pairs of branches that will conflict when merged together.</td></tr>
        <tr><td><a href="#" data-go="releases">Releases</a></td><td>Each open <code>release/…</code> branch: which features it contains and whether each one is up to date, commits that came from no feature branch, merges from dev / staging, features that are tested but not included, and release notes to copy.</td></tr>
        <tr><td><a href="#" data-go="envs">Environments</a></td><td>dev and staging: which features they carry, the <b>Lost-code check</b>, and the <b>Rebuild preview</b> (a trial build of master + selected features in a temporary folder).</td></tr>
        <tr><td><a href="#" data-go="cleanup">Cleanup</a></td><td>Delete merged branches on Backlog, turn old release branches into tags, delete merged branches on your PC, and review your stashes.</td></tr>
        <tr><td><a href="#" data-go="network">Network</a></td><td>The commit graph as Backlog draws it today, compared with how it will look after cleanup. <b>Search</b> a branch or ticket number (e.g. <code>1131</code>) to see only that branch: where it started, its own commits, where it was merged (latest or old version) and what was merged into it. Search a commit hash to see which branches contain it ("is this fix on staging yet?"). Click any dot for the commit's details and changed files; click a line to highlight that whole line (click an empty spot to go back). Ctrl + mouse wheel zooms, dragging moves. Press <code>/</code> to search.</td></tr>
      </tbody></table>`],
    ['tasks', 'Everyday tasks', `
      <h3>Start a new ticket</h3>
      <pre>git fetch
git checkout -b feature/PROJ-1234 origin/master
git push -u origin feature/PROJ-1234</pre>
      <p>Always start from <code>master</code>. Never merge dev, staging or another feature branch into your branch.</p>

      <h3>A feature conflicts with master</h3>
      <p>Shown as a red <b>N files</b> on the Features screen.</p>
      <ol>
        <li>Click the row and copy the rebase command.</li>
        <li>Resolve each conflict, then <code>git add &lt;file&gt;</code> and <code>git rebase --continue</code>. <code>git rebase --abort</code> goes back to where you started.</li>
        <li>Push with <code>git push --force-with-lease</code> (only on your own feature branch).</li>
        <li>Fetch in the tool: the conflict column turns to <b>none</b>.</li>
      </ol>
      <div class="tip">Squash your commits into one before rebasing, and you resolve the conflicts only once.</div>

      <h3>Put a feature on dev or staging for testing</h3>
      <pre>git checkout staging && git pull
git merge --no-ff origin/feature/PROJ-1234
git push</pre>
      <p>Always merge from the feature branch. Never merge staging into dev, dev into staging, or either of them into a feature or release.</p>

      <h3>Prepare a release</h3>
      <ol>
        <li>Create the release branch from master: <code>git checkout -b release/20261115 origin/master</code>, then push it.</li>
        <li>Merge the chosen features into it (pull requests on Backlog).</li>
        <li>Open <b>Releases</b> and check: every feature is <b>up to date</b>, there are no merges from environment branches, no conflict with master, and the commits that came from no feature branch are expected.</li>
        <li>If a feature is <b>outdated</b>, click its row and copy the command that brings the release up to date.</li>
        <li>Copy the <b>Release notes</b>.</li>
      </ol>

      <h3>After the release is merged into master</h3>
      <ol>
        <li>Fetch.</li>
        <li><b>Cleanup</b>: tag and delete the release branch, and delete the merged feature branches.</li>
        <li>Bring dev and staging up to date: merge master into them, or rebuild them (<b>Environments → Rebuild preview</b>).</li>
      </ol>

      <h3>Check dev / staging for lost code</h3>
      <p><b>Environments → Run check.</b> "✅ dev is OK" means dev = master + unreleased features, nothing else. Otherwise each problem file is shown with an explanation, the code difference with the problem lines marked ◀, and a suggested fix:</p>
      <ul>
        <li>🔴 <b>Released code is missing</b>: the server runs older code than production for that file.</li>
        <li>🟡 <b>Unknown change</b>: code from no feature branch, usually a leftover of an old conflict fix.</li>
        <li>💡 If dev / staging is behind master, most "missing" lines are just the latest release: merge master first, then check again.</li>
      </ul>`],
    ['states', 'What the labels mean', `
      <table><tbody>
        <tr><td>current</td><td>The branch starts from the latest master.</td></tr>
        <tr><td>N behind</td><td>master has N commits the branch does not have. A rebase is recommended.</td></tr>
        <tr><td>Conflict with master</td><td>These files were changed on both sides. Must be fixed before the branch can be released.</td></tr>
        <tr><td>latest</td><td>dev / staging have the newest commit of the branch.</td></tr>
        <tr><td>old version</td><td>dev / staging (or a release) have an older version; newer commits are missing there.</td></tr>
        <tr><td>outdated</td><td>On the Releases screen: the release is missing newer commits of the feature. They would not be released.</td></tr>
        <tr><td>rewritten after merge</td><td>The branch was rebased or force-pushed after it was merged into the release. Check by hand that the release has the final version.</td></tr>
        <tr><td>contains</td><td>Other tickets were merged into this branch, so it cannot be released on its own.</td></tr>
        <tr><td>merge bases</td><td>How many common starting points a branch has with master. More than 1 means a tangled (criss-cross) history, where merges are unreliable.</td></tr>
      </tbody></table>`],
    ['safety', 'What the tool changes', `
      <ul>
        <li>Everything is read-only except <b>Fetch</b> (downloads only) and the buttons on the <b>Cleanup</b> screen.</li>
        <li>Cleanup asks for confirmation, and deleting on Backlog requires typing <code>delete</code>. The server checks again that every branch is fully merged into master. master, dev and staging are never deleted.</li>
        <li><b>Rebuild preview</b> works in a temporary folder and never pushes. It only shows the commands; you run them yourself after telling the team.</li>
        <li>Your working copy, uncommitted changes and stashes are never touched.</li>
      </ul>`],
    ['rules', 'Team rules that keep the history clean', `
      <ol>
        <li>Create every feature branch from master.</li>
        <li>Never merge dev, staging or another feature branch into a feature branch.</li>
        <li>Update a feature branch by rebasing it onto master.</li>
        <li>Merge into dev, staging and release only from feature branches (one direction).</li>
        <li>Fix bugs found in testing on the feature branch, not on dev or staging.</li>
        <li>After each release: tag it, delete merged branches, update dev and staging.</li>
        <li>Change the <code>?date=</code> cache parameter of JS / CSS only on the release branch, not in feature branches. It causes conflicts otherwise.</li>
      </ol>`],
    ['settings', 'Repository settings', `
      <p>Click the repository box in the sidebar. Under <b>Settings</b> for the open repository:</p>
      <ul>
        <li><b>Main branch</b>: the released code (<code>master</code> or <code>main</code>).</li>
        <li><b>Environment branches</b>: test servers such as <code>dev</code> and <code>staging</code>. They are never offered for deletion.</li>
        <li><b>Folders for the lost-code check</b>: <code>src</code> by default. Use <code>.</code> for the whole repository.</li>
      </ul>
      <p>The tool detects these when you open a repository for the first time and remembers them for each repository.</p>`],
    ['trouble', 'Troubleshooting', `
      <table><tbody>
        <tr><td>"The tool is already running"</td><td>It is already open: the start script just opens the browser to it. To restart it, close the other console / terminal window first.</td></tr>
        <tr><td>Nothing opens on macOS / Linux</td><td>Open <code>http://localhost:4777</code> in the browser yourself. If <code>./start.sh</code> is not allowed to run, use <code>sh start.sh</code> or run <code>chmod +x start.sh start.command</code> once.</td></tr>
        <tr><td>Fetch failed</td><td>Check the network / VPN, and that git can reach Backlog: run <code>git fetch</code> in a terminal and check your Backlog password.</td></tr>
        <tr><td>Not a git repository</td><td>Choose the project folder that contains the <code>.git</code> folder.</td></tr>
        <tr><td>Data looks old</td><td>Click <b>↻ Fetch latest git data</b>.</td></tr>
        <tr><td>Something is missing after an update of the tool</td><td>Close the console / terminal window and start the tool again.</td></tr>
      </tbody></table>`],
  ],
  ja: [
    ['start', 'はじめに', `
      <ol>
        <li><code>git-tool</code> フォルダからツールを起動します。ブラウザで <code>http://localhost:4777</code> が開きます。使用中はコンソール／ターミナルのウィンドウを閉じないでください（閉じるか Ctrl+C で終了します）。
          <table><tbody>
            <tr><td>Windows</td><td><code>start.vbs</code>（またはピン留めしたアイコン）をダブルクリックします。コンソールウィンドウは表示されず、ブラウザのタブを閉じると少し後に自動で終了します。<code>start.bat</code> はコンソールウィンドウ付きで同じ動作をします（トラブル調査用）。</td></tr>
            <tr><td>macOS</td><td><code>start.command</code> をダブルクリックします。初回に開けない場合は、右クリック →<b>開く</b> を選んでください。</td></tr>
            <tr><td>Linux</td><td>ターミナルで <code>./start.sh</code>（または <code>sh start.sh</code>）を実行します。</td></tr>
          </tbody></table>
          Node.js と git 2.38 以降が必要です。</li>
        <li>リポジトリを選びます。サイドバー上部のリポジトリ欄をクリックし、最近使った一覧から<b>開く</b>、フォルダのパスを入力、または<b>フォルダを参照…</b>（gitリポジトリには 📦 が付きます）から選択します。</li>
        <li>ページを開く・再読み込みするたびに、最初に <code>git fetch</code> を実行するので、常にBacklogの最新データが表示されます。<b>↻ 最新のgitデータを取得</b> でいつでも更新できます。</li>
        <li>言語（日本語 / English）とテーマはサイドバー下部で切り替えます。</li>
      </ol>
      <div class="tip">このツールはあなたのPC上だけで動きます。どこにもアップロードされません。</div>`],
    ['screens', '画面の説明', `
      <table><tbody>
        <tr><td><a href="#" data-go="overview">概要</a></td><td>リポジトリの状態の一覧と、重要度順の推奨ステップです。各ステップの<b>開く</b>で対応する画面に移動します。</td></tr>
        <tr><td><a href="#" data-go="features">機能ブランチ</a></td><td>master に未反映のブランチの一覧です。担当者、最新の master がベースか、master とのコンフリクト、dev / staging にある版、どのリリースに含まれるか、他のチケットを含んでいるかを表示します。行をクリックするとコミット、コンフリクトファイル、リベースのコマンドを表示します。<b>機能ブランチ間のコンフリクトを確認</b>で、一緒にマージするとコンフリクトする組み合わせが分かります。</td></tr>
        <tr><td><a href="#" data-go="releases">リリース管理</a></td><td>作業中の <code>release/…</code> ブランチごとに、含まれる機能ブランチとそれぞれが最新か、機能ブランチ由来でないコミット、dev / staging からのマージ、テスト済みだが未反映の機能、コピーできるリリースノートを表示します。</td></tr>
        <tr><td><a href="#" data-go="envs">環境</a></td><td>dev と staging に含まれる機能ブランチ、<b>コード欠落チェック</b>、<b>再構築プレビュー</b>（一時フォルダで master + 選択した機能ブランチを試しに作成）です。</td></tr>
        <tr><td><a href="#" data-go="cleanup">クリーンアップ</a></td><td>Backlog上のマージ済みブランチの削除、古いリリースブランチのタグ化、PC上のマージ済みブランチの削除、スタッシュの確認ができます。</td></tr>
        <tr><td><a href="#" data-go="network">ネットワーク</a></td><td>Backlogが表示する現在のコミットグラフと、クリーンアップ後の姿を比較します。ブランチ名やチケット番号（例: <code>1131</code>）で<b>検索</b>すると、そのブランチだけを表示します: どこから作成したか、自分のコミット、どこにマージされたか（最新か古い版か）、何がマージされているか。コミットハッシュで検索すると、そのコミットを含むブランチが分かります（「この修正はもう staging に入っている？」）。点をクリックするとコミットの詳細と変更ファイルを、線をクリックするとその線全体を強調表示します（何もない所をクリックで元に戻ります）。Ctrl + マウスホイールでズーム、ドラッグで移動できます。<code>/</code> キーで検索できます。</td></tr>
      </tbody></table>`],
    ['tasks', 'よくある作業', `
      <h3>新しいチケットを始める</h3>
      <pre>git fetch
git checkout -b feature/PROJ-1234 origin/master
git push -u origin feature/PROJ-1234</pre>
      <p>必ず <code>master</code> から作成します。dev・staging・他の機能ブランチを自分のブランチにマージしないでください。</p>

      <h3>機能ブランチが master とコンフリクトしている</h3>
      <p>機能ブランチ画面に赤い<b>N ファイル</b>で表示されます。</p>
      <ol>
        <li>行をクリックしてリベースのコマンドをコピーします。</li>
        <li>コンフリクトを解消し、<code>git add &lt;ファイル&gt;</code> → <code>git rebase --continue</code>。<code>git rebase --abort</code> で元の状態に戻せます。</li>
        <li><code>git push --force-with-lease</code> でプッシュします（自分の機能ブランチのみ）。</li>
        <li>ツールで取得し直すと、コンフリクト欄が<b>なし</b>になります。</li>
      </ol>
      <div class="tip">リベースの前にコミットを1つにまとめる（スカッシュ）と、コンフリクト解消が1回で済みます。</div>

      <h3>機能ブランチを dev / staging でテストする</h3>
      <pre>git checkout staging && git pull
git merge --no-ff origin/feature/PROJ-1234
git push</pre>
      <p>必ず機能ブランチからマージします。staging を dev に、dev を staging に、またはそれらを機能ブランチやリリースにマージしないでください。</p>

      <h3>リリースを準備する</h3>
      <ol>
        <li>master からリリースブランチを作成してプッシュします: <code>git checkout -b release/20261115 origin/master</code></li>
        <li>リリース対象の機能ブランチをマージします（Backlogのプルリクエスト）。</li>
        <li><b>リリース管理</b>を開き、すべての機能ブランチが<b>最新</b>、環境ブランチからのマージがない、master とのコンフリクトがない、機能ブランチ由来でないコミットが想定どおり、であることを確認します。</li>
        <li><b>古い版</b>があれば、行をクリックしてリリースを最新にするコマンドをコピーします。</li>
        <li><b>リリースノート</b>をコピーします。</li>
      </ol>

      <h3>リリースが master にマージされた後</h3>
      <ol>
        <li>取得し直します。</li>
        <li><b>クリーンアップ</b>でリリースブランチをタグ化して削除し、マージ済みの機能ブランチを削除します。</li>
        <li>dev と staging を最新にします。master をマージするか、再構築します（<b>環境 → 再構築プレビュー</b>）。</li>
      </ol>

      <h3>dev / staging のコード欠落を確認する</h3>
      <p><b>環境 → チェック実行</b>。「✅ dev は問題ありません」なら、dev = master + 未リリースの機能ブランチ だけです。そうでない場合は、問題のファイルごとに説明、問題の行に ◀ を付けた差分、対処方法が表示されます:</p>
      <ul>
        <li>🔴 <b>リリース済みコードの欠落</b>: そのファイルについて、サーバーが本番より古いコードで動いています。</li>
        <li>🟡 <b>由来不明の変更</b>: どの機能ブランチにもないコードです。多くは過去のコンフリクト解消の残骸です。</li>
        <li>💡 dev / staging が master より遅れている場合、「欠落」の多くは最新リリースが入っていないだけです。先に master をマージしてから、もう一度チェックしてください。</li>
      </ul>`],
    ['states', 'ラベルの意味', `
      <table><tbody>
        <tr><td>最新（ベース）</td><td>最新の master からブランチが始まっています。</td></tr>
        <tr><td>N 件遅れ</td><td>master にブランチにないコミットが N 件あります。リベースを推奨します。</td></tr>
        <tr><td>master とのコンフリクト</td><td>両方で変更されたファイルです。リリース前に解消が必要です。</td></tr>
        <tr><td>最新（dev / staging）</td><td>dev / staging にブランチの最新コミットが入っています。</td></tr>
        <tr><td>古い版</td><td>dev / staging（またはリリース）にあるのは古い版で、新しいコミットが入っていません。</td></tr>
        <tr><td>古い版（リリース管理）</td><td>リリースに機能ブランチの新しいコミットが入っていません。このままではリリースされません。</td></tr>
        <tr><td>マージ後に書き換え</td><td>リリースにマージした後で、ブランチがリベースや強制プッシュされています。リリースに最終版が入っているか手動で確認してください。</td></tr>
        <tr><td>含まれるブランチ</td><td>他のチケットがこのブランチにマージされています。単独ではリリースできません。</td></tr>
        <tr><td>マージベース</td><td>master との共通の起点の数です。2つ以上は履歴が複雑（クロスマージ）で、マージ結果が信頼できません。</td></tr>
      </tbody></table>`],
    ['safety', 'ツールが変更するもの', `
      <ul>
        <li><b>取得</b>（ダウンロードのみ）と<b>クリーンアップ</b>画面のボタン以外は、すべて読み取りだけです。</li>
        <li>クリーンアップは確認画面が出ます。Backlog上で削除する場合は <code>delete</code> の入力が必要です。削除前にサーバーで、すべて master にマージ済みか再確認します。master・dev・staging は削除されません。</li>
        <li><b>再構築プレビュー</b>は一時フォルダで行い、プッシュはしません。コマンドを表示するだけなので、チームに連絡してから自分で実行してください。</li>
        <li>作業コピー、未コミットの変更、スタッシュには一切触れません。</li>
      </ul>`],
    ['rules', '履歴をきれいに保つチームルール', `
      <ol>
        <li>機能ブランチは必ず master から作成する。</li>
        <li>dev・staging・他の機能ブランチを機能ブランチにマージしない。</li>
        <li>機能ブランチの更新は master へのリベースで行う。</li>
        <li>dev・staging・リリースへのマージは、機能ブランチからの一方向のみ。</li>
        <li>テストで見つかった不具合は、dev や staging ではなく機能ブランチで修正する。</li>
        <li>リリース後は、タグ付け・マージ済みブランチの削除・dev と staging の更新を行う。</li>
        <li>JS / CSS の <code>?date=</code> キャッシュパラメータは機能ブランチでは変更せず、リリースブランチで変更する（コンフリクトの原因になるため）。</li>
      </ol>`],
    ['settings', 'リポジトリの設定', `
      <p>サイドバーのリポジトリ欄をクリックし、開いているリポジトリの<b>設定</b>で変更します。</p>
      <ul>
        <li><b>メインブランチ</b>: リリース済みのコード（<code>master</code> または <code>main</code>）。</li>
        <li><b>環境ブランチ</b>: <code>dev</code> や <code>staging</code> などのテスト環境。削除対象には表示されません。</li>
        <li><b>コード欠落チェックの対象フォルダ</b>: 初期値は <code>src</code>。リポジトリ全体は <code>.</code> と入力します。</li>
      </ul>
      <p>初めてリポジトリを開いたときに自動で設定され、リポジトリごとに保存されます。</p>`],
    ['trouble', '困ったときは', `
      <table><tbody>
        <tr><td>「The tool is already running」</td><td>すでに起動しているため、ブラウザで開くだけです。再起動する場合は、先にもう一方のコンソール／ターミナルのウィンドウを閉じてください。</td></tr>
        <tr><td>macOS / Linux で何も開かない</td><td>ブラウザで <code>http://localhost:4777</code> を開いてください。<code>./start.sh</code> が実行できない場合は <code>sh start.sh</code> を使うか、一度 <code>chmod +x start.sh start.command</code> を実行してください。</td></tr>
        <tr><td>取得に失敗しました</td><td>ネットワークやVPNを確認し、ターミナルで <code>git fetch</code> を実行してBacklogに接続できるか（パスワード等）確認してください。</td></tr>
        <tr><td>gitリポジトリではありません</td><td><code>.git</code> フォルダがあるプロジェクトのフォルダを選んでください。</td></tr>
        <tr><td>データが古い</td><td><b>↻ 最新のgitデータを取得</b> をクリックしてください。</td></tr>
        <tr><td>ツール更新後に表示がおかしい</td><td>コンソール／ターミナルのウィンドウを閉じて、ツールをもう一度起動してください。</td></tr>
      </tbody></table>`],
  ],
};
function vGuide() {
  const parts = GUIDE[LANG] || GUIDE.en;
  const title = LANG === 'ja' ? 'Git Branch Tool の使い方' : 'How to use Git Branch Tool';
  const intro = LANG === 'ja'
    ? 'Backlog上のgitリポジトリのブランチの状態を1か所にまとめ、問題（コンフリクト、コードの欠落、リリース漏れ）を知らせ、整理を手伝うツールです。'
    : 'This tool shows the state of a git repository on Backlog in one place, warns about problems (conflicts, lost code, features missing from a release), and helps you clean up.';
  $('#main').innerHTML = `<div class="guide"><div class="top"><h1>📖 ${esc(title)}</h1></div>
    <p class="muted" style="margin-top:-8px">${esc(intro)}</p>
    <nav class="toc">${parts.map(([id, h]) => `<a href="#" data-goto="g-${id}">${esc(h)}</a>`).join('')}</nav>
    ${parts.map(([id, h, body]) => `<section id="g-${id}"><h2>${esc(h)}</h2>${body}</section>`).join('')}</div>`;
  $('#main').querySelectorAll('[data-goto]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); document.getElementById(a.dataset.goto).scrollIntoView({ behavior: 'smooth' }); }));
  $('#main').querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); if (S.ov || a.dataset.go === 'guide') show(a.dataset.go); }));
}
