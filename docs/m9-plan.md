# M9 の段取り（案）：リポジトリの作り直し・Cloudflare での公開・公式ページの見張り

> 2026-10-04 Claude Code 案。2026-10-04 オーナー「OK」。
> **2026-10-04：① 済み**（公開のリポジトリを作り直した。前のリポジトリは `voyascope-archive`、調査の記録は `voyascope-research`。どちらも非公開）。
> **2026-10-04：② の公開を始めた → https://voyascope.org**（GitHub Pages と並べて確かめ中）。
> **2026-10-15：② の切り替え**（住所を voyascope.org にそろえ、GitHub Pages は「移りました」の案内だけに）。残りは「データの更新でコミットしない形」（10/22 以降）。
> **独自ドメインは `voyascope.org`**（2026-10-04 オーナー。Cloudflare で買った）。② は Workers の静的アセットで準備した（`wrangler.jsonc`・`web/_headers`・`.github/workflows/deploy.yml`）。
> きっかけ：M7 v0 が終わった（2026-10-04）。ロードマップの M9 に「ページの構成が固まった目安を M7 v0 の完了とし、そのときに Claude Code が移行の段取りを提案する」とある。
> あわせて、公開前の画像と調査の記録を「完全に削除できるなら GitHub から消そう」→ リポジトリの作り直しを M9 と一緒にやる（2026-10-04 オーナー「M9かな」）。
> 名前は VOYASCOPE で続ける（2026-10-04 オーナー：商標の有無にかかわらず続ける）。

## まとめ

- M9 でやることは3つ：**① リポジトリの作り直し**（履歴をきれいに）、**② Cloudflare で公開**（データの更新でコミットしない）、**③ 公式ページの見張り**（AI を使わず、変化があったときだけ知らせる）
- 順番と日程：① 10/5〜10/8 → ② 10/8〜10/15 → ③ 10/22 から。（「大きな変更をしない期間」は 2026-10-15 にやめた。オーナー：活動は続ける）
- オーナーの作業は、合わせて1時間ほど：リポジトリの名前の変更と非公開、新しいリポジトリ、Cloudflare のアカウントと鍵
- 費用：無料の範囲。独自ドメインを取るなら年に数千円

## 1. いまの仕組みと、変えたいこと（2026-10-04 の事実）

- **公開**：GitHub Pages。自作のワークフロー（`pages.yml`）で公開している
- **データの更新**：GitHub Actions で、軌道・みちびきの運用状況・世界の打ち上げは6時間ごと、探査機の距離（Horizons）は週1回。変化があると main にコミットし、公開し直す
  - 10/1〜10/4 の自動更新のコミットは1日2〜4回。人の変更とあわせて、main へのコミットは1日7〜10回
- **履歴**：9/29〜10/1 の20件のコミットの作者の欄に、オーナーの個人のメールアドレスが残っている（10/1 からは noreply）。公開前の画像（完成図・ロゴの原本）と `research/`（AI の調査報告と照合の記録）も履歴に入っている
- **いまのリポジトリの中では、完全には消せない**（GitHub Docs「Removing sensitive data from a repository」、2026-10-04 確認）
  - 履歴を書き換えても、過去の PR（#1〜#35）と、コミットの番号を直接開いたときのキャッシュから見える
  - GitHub Support が消すのは、パスワードなどの機密データだけ（"GitHub Support won't remove non-sensitive data"）
  - フォークは0件（2026-10-04）。外部の保存サービス Software Heritage にも入っていない（2026-10-04）
  - → 完全に消すには、新しいリポジトリを作り、いまのリポジトリを非公開にする

## 2. GitHub のままでできること／Cloudflare で得られること

| 変えたいこと | GitHub のまま | Cloudflare |
|---|---|---|
| 履歴から、メールアドレスと公開前のファイルを消す | ✅ 作り直しでできる（Cloudflare は関係ない） | — |
| データの更新のたびにコミットしない | ✅ できる（データをコミットせず、Actions から直接公開する） | ✅ できる（同じやり方） |
| 見る人が増えたとき | 月100GB が目安（ゆるい上限）。1回の訪問で約1MB（起動 772KB＋遠くを見る部屋 208KB）なので、月10万回ほどで目安に届く | 静的なファイルの配信は無料・無制限 |
| 2回目からの速さ | キャッシュの時間は10分で固定。ライブラリ（約510KB）も10分ごとに確かめ直す | ファイルごとに決められる（`_headers`）。ライブラリ・画像は長く、データは短く |
| 使われているかを知る | Cloudflare の Web Analytics は、JavaScript を足せば GitHub Pages でも使える | 同じ。Cloudflare で公開すると、設定だけで入る |
| ブラウザから直接読めない外部データ（これからの部屋で出てきたら） | できない | 小さな中継（Workers）で、キャッシュして配れる |
| 独自ドメイン | できる | できる |

- 急ぎの2つ（履歴・コミット）は、GitHub だけでも解ける
- Cloudflare に移すと、見る人が増えたときの余裕と、2回目からの速さが加わる。これからの部屋で中継が要るときにも困らない
- → オーナーの方針（2026-09-30「微修正を重ねたあと Cloudflare Pages に移す」）どおり、移すのがよいと考える

## 3. 段取り

### ① リポジトリの作り直し（10/5〜10/8）

| | 中身 |
|---|---|
| 公開のリポジトリから外すもの | 完成図（`docs/design/target-2026-09-30.webp`）、ロゴの原本（`docs/design/logo-original.webp`）、`research/`（AI の調査報告・照合の記録・JPL とのやりとり） |
| 置き換えるもの | コミットの作者のメールアドレス → noreply のアドレス |
| 残すもの | コミットの記録（いつ、何を、なぜ決めたか）と、ほかのファイルすべて。公開中のロゴ（`web/assets/brand/`）はそのまま |

手順：

1. **私**：いまのリポジトリの複製から、上のものを外した履歴を作る（git filter-repo）。メールアドレスと外したファイルが1件も残っていないことを確かめる
2. **オーナー**：いまのリポジトリの名前を変えて（例：`voyascope-archive`）、非公開にする（Settings）。公開ページは、ここから4. までのあいだ止まる
3. **オーナー**：新しい public の `voyascope` を空のまま作る。Claude の GitHub App に新しいリポジトリを許可する。Settings → Pages → Source を「GitHub Actions」にする
4. **私**：push し、CI と公開を確かめる。公開ページの URL は同じ（`https://mentoce0-gif.github.io/voyascope/`）

そのほか：

- `research/` はこれからも使う（チャッピーの報告を保存して、カードにする）。非公開の小さなリポジトリ `voyascope-research` に移すのがよいと考える（オーナーが作る。2分）。私はそのつど、作業につないで読み書きする。`voyascope-archive` に置いたままでもよい
- 外したもの・過去の PR（#1〜#35）のやりとりは、非公開になった `voyascope-archive` に残る。ドキュメントの中の「PR #21」などのリンクは開けなくなるので、「（旧リポジトリ）」と書き添える
- `CLAUDE.md` のディレクトリの表の `research/` の行を、置き場所に合わせて直す
- 自動の取得は、新しいリポジトリでもそのまま動く。秘密の鍵（Secrets）は、いまは使っていない

### ② Cloudflare で公開（10/8〜10/15）

- **形**：**Workers の静的アセット**で `https://voyascope.org` に公開する（独自ドメインを取るので。Cloudflare がこれから勧めている形）
  - 設定は `wrangler.jsonc`（`web/` をそのまま配る。独自ドメインは `custom_domain`。DNS と証明書は Cloudflare が自動で用意する）
  - 公開は `.github/workflows/deploy.yml`（GitHub Actions から `cloudflare/wrangler-action`。動くときは `pages.yml` と同じ）。2026-10-04 に `wrangler deploy --dry-run` で、`web/` の86ファイルを読めることを確かめた
  - （独自ドメインを取らない場合は Cloudflare Pages で `voyascope.pages.dev` の案だった）
- **データはコミットしない**
  - 取得のスクリプトと時刻は、いまのまま（GitHub Actions で6時間ごと・週1回）
  - 取ったデータは、コミットせずにそのまま公開に使う。前回のデータ（週1回の Horizons の表など）は公開中のサイトから読み、取れたものだけ新しくする
  - 公開の前に、いまと同じ検証（`validate`・読み込み量）を通す。通らなければ前の版のまま
  - 公開し直すのは、データの更新で1日4回と、人の変更のたび（月に150〜250回ほど）。Pages の上限（月500ビルド）と同じ数え方でも、その中
  - リポジトリの履歴は、人が直したものだけになる（自動更新のコミット、1日2〜4回がなくなる）
- **キャッシュ**：`web/_headers` で決める。ライブラリは1日・画像は7日・データは5分。HTML・JS・CSS は既定（毎回、変わっていないかだけ確かめる）
- **2026-10-04 に確かめたこと**：公開は約21秒（73ファイル）。`https://voyascope.org` で、ページ・データ・ライブラリ・画像が 200 で返る。キャッシュの時間は上のとおり。`_headers` そのものは配られない。JS・CSS・画像・JSON の種類（Content-Type）も正しい
- ✅ **Always Use HTTPS**（2026-10-04 オーナーがオン）：`http://voyascope.org/…` は 301 で `https://` の同じ場所へ移る（確かめた）。`www.voyascope.org` は、要るなら後で（`voyascope.org` へ転送する）
- **切り替え**：Cloudflare と GitHub Pages を1週間ほど並べて確かめる。そのあと GitHub Pages には「新しい場所」へ移る案内だけを置き、README・`CLAUDE.md`・`og:url` を新しい URL にする
- **オーナーの作業**（15〜30分。Cloudflare のアカウントはもともとある）
  1. `voyascope.org` を買う：Cloudflare の Register domains で検索 → Purchase（自動更新は最初からオン）。連絡先は正しく入れる（WHOIS では伏せられる）。届いた確認のメールのリンクを押す（押さないと ICANN の決まりでドメインが止まる）
  2. API の鍵を作る：My Profile → API Tokens → Create Token → テンプレート「Edit Cloudflare Workers」。対象は自分のアカウントと `voyascope.org` だけ
  3. 新しい `voyascope` の Settings → Secrets and variables → Actions に、`CLOUDFLARE_API_TOKEN`（2. の鍵）と `CLOUDFLARE_ACCOUNT_ID`（ダッシュボードの URL の `dash.cloudflare.com/` のあとの英数字）を入れる。鍵はチャットにもリポジトリにも書かない
- **方針の書き直し**：`CLAUDE.md` の「サーバを持たない。GitHub Pages ＋ GitHub Actions ＋ ブラウザ内計算で完結させる」を、「管理するサーバは持たない。GitHub（コードと定期の取得）＋ Cloudflare（公開）＋ ブラウザ内計算」にする（ロードマップの M9 のとおり）

### ③ 公式ページの見張り（10/22 から）

- `curation/` の出典 URL（10/4 時点で36ファイル・82件。NASA 36・JAXA 18・気象庁 8・みちびき 7・ESA 5・ほか 8）を、週に1回 GitHub Actions で開く。AI は使わない
- 見ること
  - 開けるか（リンク切れ・転送）
  - ページが前回から変わったか。まずは、更新日の表記と本文の変化の有無だけ。うるさくならないか様子を見てから、細かくする
- 変化があったときだけ、GitHub の Issue を1件作る（どのカードの、どの出典か）→ オーナーに通知が届く → Claude Code が公式ページで確かめて直す（いまのルールどおり）
- 前回の試作（PR #24（旧リポジトリ）、マージせずに閉じた）の「見張り表」の考え方を使う。品質の土台（Q）のリンク切れの確認も兼ねる
- 前回の値を覚えておく場所は、Actions のキャッシュ（コミットしない）

### ④ 独自ドメイン → `voyascope.org` に決定（2026-10-04 オーナー）

- 比べたもの：`voyascope.org`（Cloudflare で買える。ドメイン・DNS・公開が1か所にまとまる。年に2,000円前後が目安）と `voyascope.jp`（日本のサイトだと一目で分かる。Cloudflare では買えない可能性が高い。年に3,000〜4,000円ほど）。いまのブログなどのドメインの下に置く案は、個人のサイトと結びつくので外した
- `voyascope.org` は 2026-10-04 に .org の登録所（PIR）の RDAP で未登録を確かめた
- 例：`voyascope.jp`（10/3 の C6 で空き。10/4 も使われていない）。年に数千円（買う場所で違う）
- よいところ：覚えやすく、授業で黒板にも書ける。あとで公開先を変えても URL が変わらない
- 取るなら ② の前に（URL の切り替えが1回で済む）。買う前に J-PlatPat を一度見ておくと安心（5分）

## 4. 日程

| いつ | すること | だれ |
|---|---|---|
| 10/5〜10/8 | ① 作り直し | 私が準備 → オーナー（名前の変更・非公開・新しいリポジトリ）→ 私 |
| 10/8〜10/15 | ② Cloudflare で公開し、並べて確かめてから切り替え | オーナー（アカウント・鍵）→ 私 |
| 10/17〜10/21 | 大きな変更をしない（MMX の打ち上げ 10/20） | — |
| 10/22 から | ③ 公式ページの見張り | 私 |
| 11/15〜11/22 | 大きな変更をしない（ボイジャー1号 11/18・ベピコロンボ 11/21） | — |

## 5. 決めてほしいこと（オーナー）

1. この順番（①→②→③）と日程でよいか
2. 公開のリポジトリから外すもの：完成図・ロゴの原本・`research/` の3つでよいか。`research/` の置き場所は、非公開の新しいリポジトリ（`voyascope-research`）でよいか
3. 独自ドメインを取るか（取るなら ② の前に）
4. 使われているかを知る仕組み（Cloudflare Web Analytics）を入れるか：個人情報に関わるので、入れるなら何を集めるかを調べてから決め、「このアプリについて」に書く（急がない）

## 6. 確かめた資料（2026-10-04）

- GitHub Docs「Removing sensitive data from a repository」：書き換えても PR・コミットの番号・フォークから見える。"GitHub Support won't remove non-sensitive data"
- GitHub Docs「GitHub Pages limits」：公開できる大きさは 1GB まで。帯域は月100GB が目安。1時間10回の目安は、自作のワークフローで公開するときはかからない
- Cloudflare Docs
  - Workers の上限（Free）：1日10万リクエスト（Worker のコードが動く分）、Cron Triggers は5つ、静的アセットは1版2万ファイル・1ファイル25MiB
  - Workers の料金："Requests to static assets are free and unlimited."
  - Pages の上限（Free）：月500ビルド、2万ファイル、1ファイル25MiB
  - 「Migrate from Pages to Workers」：Workers は Pages より機能が広い（Cron Triggers など）
  - Web Analytics：無料。DNS を移さず、JavaScript を足すだけでも使える
- このリポジトリ：フォーク0件・スター0件。Software Heritage に保存なし（いずれも 2026-10-04）

## 7. アクセス計測（Cloudflare Web Analytics）の整理（2026-10-28）

オーナー（2026-10-28）：「もう使っているが、VOYASCOPE の仕様上、正確な訪問数の判定が難しいと FB をもらった覚えがある。正確な手段があるなら、冒頭のページに文言を足して記録へ」→ 新しい手がないか、チャッピー C39・Grok G5 で探した。下は Claude Code が公式ページで照合した結果（2026-10-28）。照合の記録の下書きは voyascope-research の `research/verification/2026-10-28-c39-g5.md` に置く（オーナーが置く）。

### 結論

- **正確な人数を出す手段はない**（どの方法でも、数え漏れか数えすぎが残る）。Web Analytics の「訪問」は人数ではない
- いちばん足りないのは「人数の精度」ではなく、**「観測を開始」を押したか・どの部屋を開いたか**が分からないこと。これは **Workers Analytics Engine** で、人を見分けない「出来事の数」として数えられる（無料の範囲・作る量は小さい）。作るかはオーナーが決める（ルール5）
- 海外向けに気をつけること：**無料のドメインで自動で有効になった Web Analytics は、EU からの訪問を数えない設定が初期値**（下の表の5）。英語版で海外の反応を見るなら、EU を数えるかを決める（GDPR に関わるのでルール5）

### 照合できた事実

| # | 事実 | 出典（公式） |
|---|---|---|
| 1 | 「訪問」は、リファラー（どこから来たか）がこのサイトと違うページビュー。1回の訪問に複数のページビューが入る。ページビューは HTML の成功した応答 | https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/ |
| 2 | 自分で決めた出来事（カスタムイベント）は "Not yet"。見られるのは過去6か月。クエリ文字列（`?craft=` など）は記録しない。ビーコンは広告ブロッカーで止まる・通信の状況で欠ける | https://developers.cloudflare.com/web-analytics/faq/ |
| 3 | 1ページのアプリは、Soft Navigations API・Navigation API・History API（pushState・popstate）で、道が変わるたびに数える（2026-08-20 更新）。hashchange の記述はない | https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/ |
| 4 | 2026-08-21 に数え方を改善。「ページビューと訪問の数が変わることがある」 | https://developers.cloudflare.com/changelog/post/2026-08-21-improved-soft-navigation-measurement-for-single-page-applications/ |
| 5 | 無料のドメインは 2025-10-15 から自動で有効。**EU の訪問は除く（ダッシュボードで変えられる）**。Cookie・localStorage は使わない、IP アドレスなどの個人の情報はエッジで取り除く、IP・User Agent・フィンガープリントで人を追わない | https://blog.cloudflare.com/the-rum-diaries-enabling-web-analytics-by-default/ （2025-09-17） |
| 6 | Workers Analytics Engine：保存は3か月、1回の呼び出しで250点まで。無料プランは書き込み1日10万・読み出し1日1万。いまは課金していない | https://developers.cloudflare.com/analytics/analytics-engine/limits/ ・ https://developers.cloudflare.com/analytics/analytics-engine/pricing/ |
| 7 | 配信の記録（ゾーンの Analytics）は、全プランで30日以上見られるように（2026-10-02） | https://developers.cloudflare.com/changelog/post/2026-10-02-30-days-analytics-on-every-plan/ |
| 8 | Counterscale：自分で置く・MIT・Cookie とフィンガープリントなし・無料の Workers で1日5万ページビューまで。出来事を数える機能はページに書かれていない | https://counterscale.dev/ |
| 9 | 個人情報保護委員会：特定の個人との対応関係が排斥されている統計情報は「個人関連情報」に当たらない | https://www.ppc.go.jp/all_faq_index/faq2-q2-8/ |

### VOYASCOPE に当てはめると

- 遠くを見る部屋を開くと `#far` を pushState している。表の3から、部屋を開くたびにページビューとして数えられている**かもしれない**（確かめていない）。だとすると、ページビューは人の動きより多めに出る
- 10/1〜21 の「米国 110」を巡回プログラムと決めつけない（国の割合だけでは見分けられない。チャッピーの注意）
- 「一言でわかる」からの `?craft=` は数えない（表の2）。どのリンクから来たかを知りたければ、別の手（Analytics Engine）が要る

### 照合できなかったもの（使わない）

- X の iOS アプリがリンクを先に読み込み、サイトの数がふくらむ話（Grok：The Verge 2025-11-07）：記事が開けず、X の公式の説明もない
- AI の巡回プログラムの3つの分け方（Grok：Cloudflare ブログ 2026-07-01）・「Disallow AI Training」（2026-09-15）：今回は開いていない。robots.txt の方針（学習は断る）に関わるので、次に見るときに照合する
- GoatCounter・Matomo・Plausible などの細かい条件、EU の GDPR・ePrivacy、米国の COPPA の原文（チャッピーも未確認）

### 「このアプリについて」の文（2026-10-28 オーナー OK・足した）

> このサイトがどのくらい見られているかを知るために、Cloudflare Web Analytics を使っています。Cloudflare の説明では、Cookie は使わず、IP アドレスなどの個人の情報は取り除かれます。数はおおよその目安です。

### 出来事の回数（2026-10-28 オーナー「やってみよう」・作った）

- しくみ：画面（`web/js/count.js` の `count(名前)`）→ `navigator.sendBeacon("/e", 名前)` → Worker（`src/lab-worker.js` の `/e`）→ Workers Analytics Engine のデータセット `voyascope_events`（`wrangler.jsonc` の `EVENTS`）。記録するのは**出来事の名前と時刻だけ**（`blobs: [名前]`）。IP アドレス・国・端末・県は記録しない。決まった名前のほかは捨てる。本番（voyascope.org）のときだけ送る
- 数えるもの：`start`（観測を開始）・`far`（遠くを見る部屋）・`tonight`（今夜を開いた）・`from-missions`（一言でわかるから来た）・`mmx-now`・`sky`・`artemis2`（それぞれのページを開いた）。足すときは `count.js` の `EVENT_NAMES` に足す（Worker も同じ一覧を使う）
- 無料の範囲：書き込み1日10万。超えた分は記録されないだけ（画面には何も起きない）。データは3か月残る
- 見方（オーナー）：Cloudflare で「Account Analytics: Read」の API トークンを作り、次を実行する（`ACCOUNT_ID` は GitHub の Secrets の `CLOUDFLARE_ACCOUNT_ID` と同じ）

```bash
curl -s "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/analytics_engine/sql" -H "Authorization: Bearer $TOKEN" --data "SELECT blob1 AS name, SUM(_sample_interval) AS times FROM voyascope_events WHERE timestamp > NOW() - INTERVAL '7' DAY GROUP BY name ORDER BY times DESC"
```

- 気をつけること：Analytics Engine を使うのは、このアカウントで初めて。**マージのあとの最初の公開（deploy-cloudflare）が通るか見る**。通らなければ、Cloudflare のダッシュボードで Analytics Engine を有効にするか、`wrangler.jsonc` の `analytics_engine_datasets` を外して公開し直す（ほかの公開を止めないため）

### 次の手

1. 2週間ほど数を見て、「観測を開始」まで進む割合（`start` ÷ Web Analytics のトップのページビュー）を出す
2. 英語版を出すときに、EU の訪問を数えるかを決める
