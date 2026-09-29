# web/ ── VOYASCOPE アプリ本体（Phase 0）

ビルドなしの静的サイト。地球＋ISS 1機＋キャラカード＋時間早送り。

## 動かし方

```
npm run sync:web           # カード・閾値を web/data/ にコピー（元ファイルを変えたとき）
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
| `js/card.js` | キャラカードの表示（出典のない項目に「出典確認中」を付ける） |
| `js/rank.js` | ゲージとランクの自動計算（`tests/rank.test.mjs` でテスト） |
| `js/format.js` | 日付・数値の表示 |
| `data/orbits/iss.json` | 軌道データ（CelesTrak の OMM JSON。TLE でも動く。取得日時・エポック・出典URLを含む） |
| `data/cards/iss.json` | `examples/spacecraft/iss.json` のコピー（見本） |
| `data/rank-thresholds.json` | `config/rank-thresholds.json` のコピー |
| `data/land-110m.geojson` | 陸地の形（Natural Earth） |
| `vendor/` | ライブラリ（`vendor/README.md`） |

## メモ

- 軌道データの基準時刻（エポック）から7日以上離れると、画面下に「ずれている可能性」を表示する（自動更新が止まったときの目印にもなる）
- カードは `examples/` の見本を読むので、常に「見本・出典確認中」を表示する（`main.js` の `isSample: true`）
- lv3 リンク（CelesTrak）は `norad_id` から自動で作る。lv2 公式リンクは URL が `https://` で始まるまで無効
