# 公開前の点検リスト

> 2026-09-30 オーナー決定：**リポジトリは public にする。メールアドレスだけは出さない。**
> 2026-09-30 オーナーがこのリポジトリを public にし、GitHub Pages での公開を指示した（新しいリポジトリに移す手順は取らなかった）。

## メールアドレスを出さないために

いまのコミット履歴には、オーナーの個人のメールアドレスが入ったコミットが 11 件ある（author 10 件・committer 1 件）。ファイルの中身には入っていない。

**注意**：いまのリポジトリの履歴を書き換えて強制プッシュしても、過去の PR（#1〜#10）が古いコミットを参照し続ける。public にすると、PR の画面から古いコミットのメールアドレスが見えてしまう。GitHub サポートが消してくれるのは「機密データ（パスワードなど）」だけ（[GitHub Docs「リポジトリからの機密データの削除」](https://docs.github.com/ja/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)、2026-09-30 確認）。

そのため、次の手順にする。

1. ☐ **（オーナー・いますぐ・スマホで可）** GitHub の Settings → Emails で次の2つにチェックを入れる。これ以降、Web でのマージなどは `296239037+mentoce0-gif@users.noreply.github.com` で記録される
   - 「Keep my email addresses private」
   - 「Block command line pushes that expose my email」
2. ☐ **（公開する日）** いまのリポジトリの名前を変えて（例：`voyascope-dev`）、private のまま残す。PR のやりとりはこちらに残る
3. ☐ **（公開する日）** 新しい public リポジトリ `voyascope` を作る。履歴のメールアドレスを上の noreply に置き換えたものを入れる
   - 履歴の書き換えは取り消しが難しいので、**その日にオーナーの許可を得てから** Claude Code が行う
   - 書き換え後に、履歴にメールアドレスが1件も残っていないことを確かめる
4. ☐ 新しいリポジトリで GitHub Pages と自動取得（Actions）を有効にし、Claude の GitHub App に新しいリポジトリへのアクセスを許可する

## そのほかの点検

- ☑ ライセンス（C5）：コードは MIT（`LICENSE`）、文章は CC BY 4.0（`CONTENT_LICENSE.md`）。2026-10-01 オーナー決定
- ☑ CelesTrak のデータを自分のサイトで配ってよいか（C9）：公開の GP データは、出典表示を条件に再配布が認められている（Space-Track の包括承認）。出典を「USSPACECOM／Space-Track.org（CelesTrak から取得）」に直した
- ☐ 名前の確認（C6）
- ☑ ISS の数値・公式リンク（C3・C4）
- ☐ ISS の乗員（C10）。届かなければ、公開版では「滞在」を「調べています」のままにする
- ☐ `docs/design/` の画像の扱い：完成図・ロゴはオーナー提供。公開してよいか確認
- ☐ `research/` の AI の報告：公開してよいか確認（出典の確認記録として残すのがおすすめ）
- ☐ 画面の「このアプリについて」に、出典（CelesTrak・内閣府みちびき・NASA など）と非公式の注記がそろっているか
- ☐ スマホでの重さ・表示
