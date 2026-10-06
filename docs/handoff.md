# 引き継ぎメモ（いまの状況）

> **新しいチャットは、`CLAUDE.md` とこのファイルを読んでから始める。** チャットは目的ごとに1つ（例：「MMX 打ち上げ対応」「Cloudflare への切り替え」「チャッピーの報告の照合」）。
> 区切りごとに Claude Code がこのファイルを更新する（古くなった行は消す）。日ごとの記録は [`changelog.md`](changelog.md)、全体の計画は [`roadmap.md`](roadmap.md)。
> 最終更新：2026-10-06

## 公開先とリポジトリ

| 名前 | 場所 | メモ |
|---|---|---|
| 本番 | https://voyascope.org | Cloudflare（Workers の静的アセット）。`.github/workflows/deploy.yml`・`wrangler.jsonc`・`web/_headers`。鍵は GitHub の Secrets（`CLOUDFLARE_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`） |
| 仮の公開（並べて確かめ中） | https://mentoce0-gif.github.io/voyascope/ | GitHub Pages（`pages.yml`）。切り替えたら「新しい場所」の案内だけにする（M9 ②） |
| MMX の予告ページ | https://voyascope.org/mmx/ | `web/mmx/`。noindex、アプリからはまだリンクしない。紹介のメールに添えた |
| 公開のリポジトリ | `mentoce0-gif/voyascope` | 2026-10-04 に作り直した（PR は #1 から振り直し） |
| 非公開の記録 | `mentoce0-gif/voyascope-research` | `research/chappy/`（チャッピーの報告）・`research/verification/`（照合と JPL とのやりとり）・`research/outreach/`（紹介の送り先・文面・返事） |
| 旧リポジトリ（非公開） | `mentoce0-gif/voyascope-archive` | 作り直す前の履歴（個人のメールアドレス入り）。**ここの履歴やブランチを公開のリポジトリへ push しない** |

## いまの優先（日付順）

1. **MMX の打ち上げ対応**（2026-10-20 4:41:03 日本時間の予定。予備期間は 11/7 まで）→ [`roadmap.md`](roadmap.md) の M7 v1
   - 10/13〜17：予定の動き（延期・時刻の変更）を公式で確かめる（G4）。変わったら `curation/events/mmx-launch.json` を直す（予告ページの残り時間も同じデータを読む）
   - 10/17〜10/21 は大きな変更をしない（M9 の計画）。打ち上げの日の表示を足すなら、その前に
   - 打ち上げの日：地球の画面に MMX の印（ビーコン）を、打ち上げから分離まで（10/20 の場合 約1時間11分。JAXA 打上げ計画書）出す（オーナー確認済み。位置は描かない）。打ち上がったかは JAXA の発表を確かめてから記録。中継はリンクで案内
   - 打ち上げのあと：C19 をもう一度チャッピーに頼む（Horizons への登録・JAXA の位置の公開・MMX 版の NOW・中継の URL）。Horizons に載ったら、週1回の取得（`scripts/fetch-horizons.mjs`）に足して、遠くを見る部屋の停留所にする（模型はもうある）
2. **M9 ② Cloudflare への切り替え**（並べて確かめるのは 10/15 ごろまで）→ [`m9-plan.md`](m9-plan.md)
   - README・`CLAUDE.md`（公開先と「サーバを持たない」の方針の書き直し）・`og:url` / `og:image` を https://voyascope.org に。GitHub Pages には案内だけを置く
   - データの更新でコミットしない形にする（Actions から直接公開）
3. **出来事のあとの手直し**：11/18 ボイジャー1号が地球から1光日、11/21 ベピコロンボが水星を回る軌道へ、12/9〜10「みお」と MPO の分離。11/15〜11/22 は大きな変更をしない
4. **M9 ③ 公式ページの見張り**（10/22 から）

## 返事待ち

| 相手 | 送ったもの | 日付 | 記録 |
|---|---|---|---|
| JAXA 宇宙教育センター | 紹介のメール（予告ページを添えた） | 2026-10-05 | `research/outreach/2026-10-05-mmx-intro.md`（非公開） |
| 日本宇宙少年団（YAC） | 問い合わせのフォーム（同上） | 2026-10-05 | 同上 |
| JPL の教育の部署（Engagement/Education Office） | JPL SSD の方が、やりとりを回してくれた。先方の計画に合えば直接連絡が来るかもしれない。こちらからは先に連絡しない | 2026-10-06 | `research/verification/2026-10-03-c14.md`（非公開） |

返事が来たら、オーナーが要点を貼る → Claude Code が記録して、次の動きを一緒に考える（記録に、相手とオーナーの氏名・メールアドレスは書かない）。

## オーナーの判断待ち

- **中継の埋め込み**（ルール5）：いまはリンクだけ。判断材料は [`roadmap.md`](roadmap.md) の「オーナーの判断待ち」
- **旧リポジトリの自動更新を止める**（オーナーの操作）：`voyascope-archive` の Settings → Actions → General →「Disable actions」。止まるまで、6時間ごとに失敗の知らせが届き、データを二重に取りに行く
- **連絡の受け口**：`contact@voyascope.org` のような転送アドレス（Cloudflare の Email Routing）、GitHub の Issue テンプレート（誤りの報告・要望）、中高生向けのフォーム（個人情報の扱いはルール5）
- そのほか：サブタイトルの変更、見出しを明朝体にするか、英語版（案。JPL の教育の部署の反応しだい）

## 自動で動いているもの

| もの | いつ | メモ |
|---|---|---|
| `update-orbits` | 6時間ごと（UTC の 17分） | 軌道（CelesTrak）・みちびきの運用状況・世界の打ち上げ（LL2）。GitHub の定時は数時間遅れることがある（10/5 は約5時間遅れ） |
| `update-horizons` | 毎週月曜 0:41 UTC | 探査機6機の距離（JPL Horizons）。JPL に了承をもらった取り方（1件ずつ・週1回・連絡先入りの User-Agent）を変えない |
| `pages`・`deploy-cloudflare` | 上の2つのあと・`web/` が変わったとき | 公開し直す |
| ISS 乗員の見張り | 2日ごと 8:52（日本時間） | Claude の定期実行（別のチャットで動く）。Crew-12 は早くて 10/7 14:05（日本時間）に切り離し → 帰還を確かめたら、カードを直す PR が来る |

## はまりどころ（Claude Code 向け）

- 依頼文は `prompts/src/` を直して `npm run build:prompts`（生成された `prompts/*.md` を直接直すと CI が落ちる）
- `web/data/` は `curation/` から `npm run sync:web` で作る。CI と同じ確かめ：`npm run validate`・`npm test`・`node scripts/sync-web-data.mjs --check`・`node scripts/build-prompts.mjs --check`・`node scripts/check-size.mjs`
- 新しい調査はチャッピーに頼む（依頼文は `prompts/chappy-research.md` から、そのタスクだけを抜き出して渡す）。報告が来たら `voyascope-research` の `research/chappy/` に保存 → 公式ページで照合して `research/verification/` に記録 → 確かめられたものだけ `curation/` へ
- ブラウザでの確認：Playwright（`createRequire('/opt/node-tools/node_modules/')`、Chromium は `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`、WebGL は SwiftShader）。アプリは「観測を開始」を押してから。この環境のブラウザは外の https を開けない（証明書）ので、公開先は curl で確かめる
- ひまわり9号の軌道要素は、CelesTrak 側で 9/29 から新しくなっていない（静止衛星なので表示はほぼ同じ。足元の「軌道データ取得」は、いちばん古い日を出す）
- 予告ページの旅のしおりと打ち上げの流れは、公式（プレスキット・MMX サイト・打上げ計画書）を照合したもの。`curation/` にはまだ入れていない
- コミットは日本語。アプリの変更はブランチと PR（CI を通す）。終わりの報告は「やったこと／やらなかったこと／判断してほしいこと」

## 新しいチャットの始め方（例）

- 「CLAUDE.md と docs/handoff.md を読んで、MMX 打ち上げ対応を進めて」
- 「CLAUDE.md と docs/handoff.md を読んで、M9 ② の切り替えをして」
- 「チャッピーの報告です（C◯◯）」と貼る → 保存・照合・反映
- 「〇〇から返事が来た」と要点を貼る → 記録して次の動きを考える
