# web/ ── VOYASCOPE アプリ本体（Phase 0）

ビルドなしの静的サイト。地球＋ISS 1機＋キャラカード＋時間早送り。

## 動かし方

```
npm run sync:web           # カード・乗員データを web/data/ に書き出す（元ファイルを変えたとき）
npx serve web              # または python3 -m http.server -d web
```

軌道データ（`web/data/orbits/iss.json`）は GitHub Actions（`update-orbits`）が6時間ごとに自動で取り直す。
手元で取り直すときは `npm run fetch:orbits`（前回から2時間以内なら取りに行かない。`-- --force` で強制）。

## ファイル

| パス | 中身 |
|---|---|
| `index.html` | 起動画面・観測画面・カード |
| `css/style.css` | 見た目（navy / mint / amber、走査線） |
| `js/main.js` | 起動・地球の表示・時間の早送り・毎フレームの更新 |
| `js/orbit.js` | SGP4 による位置計算、早送りできる時計 |
| `js/card.js` | 詳細パネル（タブ：概要／滞在／軌道／リンク）。出典未確認なら「見本・出典確認中」を出す |
| `js/scale.js` | 高さの縮尺（比較用）と環3本（低軌道・中軌道・静止軌道） |
| `js/families.js` | 空の家族分け（有人・気象科学・測位・通信の帯）と色 |
| `js/minimap.js` | 地上軌跡のミニ地図（SVG） |
| `js/format.js` | 日付・数値の表示 |
| `data/orbits/iss.json` | 軌道データ（CelesTrak の OMM JSON。TLE でも動く。取得日時・エポック・出典URLを含む） |
| `data/craft-index.json` | 表示する機体の一覧（`npm run sync:web` で作る） |
| `data/cards/iss.json` | `examples/spacecraft/iss.json` のコピー（見本） |
| `data/cards/iss-crew.json` | ISS に向かったチームと飛行士（`examples/teams`・`examples/astronauts` から `npm run sync:web` で作る） |
| `data/land-110m.geojson` | 陸地の形（Natural Earth） |
| `vendor/` | ライブラリ（`vendor/README.md`） |

## メモ

- 軌道データの基準時刻（エポック）から7日以上離れると、画面下に「ずれている可能性」を表示する（自動更新が止まったときの目印にもなる）
- カードは `examples/` の見本を読むので、常に「見本・出典確認中」を表示する（`main.js` の `isSample: true`）
- 「滞在」には、打ち上げ済みで帰還日が来ていないチームを出す（観測時刻で判断するので、早送りすると変わる）
- タイムラインは現在の −6時間〜+24時間。端に着いたら止まる。「LIVE」で現在・等倍に戻る
- 環の半径と機体の高さは比較用の縮尺（`js/scale.js`）。画面に「実距離ではない」と必ず出す
- 生データリンク（CelesTrak）は `norad_id` から自動で作る。公式リンクは URL が `https://` で始まるまで無効
- ランク・ゲージと得意技・弱点の表示は、オーナーの判断でいったん外した（2026-09-29）。データ（`stats`・`special_move`・`weakness`）はスキーマに残している
