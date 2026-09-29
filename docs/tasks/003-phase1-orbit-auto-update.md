# タスク003：Phase 1（前半）── 軌道データの自動更新

## 目的

ISS の軌道データを GitHub Actions で定期的に取り直し、画面の位置が古くならないようにする。
Phase 0 では手動で1回だけ取得したスナップショットを使っていた。

## 前提（調査結果）

`research/chappy/2026-09-29-c1-celestrak-usage.md`（C1）による。引用は未検証なので、オーナーがブラウザで確認する。

- CelesTrak の GP データは2時間ごとに更新される。取得は「更新1回につき1回まで」
- 200 以外の応答を受けたら、再試行せずに止めて人間に知らせる（403/404 の再試行は IP ブロックの原因になる）
- 新しい6桁のカタログ番号は TLE で扱えない。JSON（OMM）形式に移る

## 作るもの

1. **取得スクリプト** `scripts/fetch-orbits.mjs`（`npm run fetch:orbits`）
   - 対象は `config/orbits.json` に書いた機体だけ（今は ISS の1機）
   - `https://celestrak.org/NORAD/elements/gp.php?CATNR=<番号>&FORMAT=JSON` を1機につき1回だけ取る
   - 200 以外・中身がおかしいときは、**再試行せずに失敗で終わる**
   - 前回の取得から2時間たっていなければ取りに行かない
   - エポック（軌道データの基準時刻）が前回と同じか古ければ、ファイルを書き換えない
   - 保存先：`web/data/orbits/<id>.json`（出典URL・取得日時・エポックつき）
2. **定期実行** `.github/workflows/update-orbits.yml`
   - 6時間ごと（毎時17分、UTC 0/6/12/18時台）と、手動実行（Actions 画面の「Run workflow」）
   - 変化があったときだけ、`main` に直接コミットする
   - 失敗したら GitHub からメールで知らせる（GitHub の標準の通知）
3. **アプリ**
   - `web/data/orbits/iss.json` を読む。OMM（JSON）と TLE のどちらの形でも動くようにする
   - 画面下の表示を「軌道データ取得：◯月◯日 ◯:◯◯」にする
   - 「このアプリについて」の説明を、自動更新に合わせて直す
4. **テスト**：OMM と TLE で同じ位置になること、取得データの検査、書き換えの判断

## やらないこと

- 打ち上げ予定の表示（Phase 1 後半。Launch Library 2 の利用条件〔C8〕を確認してから）
- ISS 以外の機体の追加（Phase 2）
- GitHub Pages での公開（取得データの再配布の条件〔C9〕が分かるまで）

## 完了条件

- `npm test` と `npm run validate` が通る
- PR をマージしたあと、Actions の「update-orbits」を手動実行して成功し、`web/data/orbits/iss.json` が更新される
- アプリがその新しいデータで ISS を表示する
