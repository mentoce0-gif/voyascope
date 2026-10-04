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
| `js/families.js` | 空の家族分け（有人・気象科学・測位・通信の帯）と色。「予定」は射場のピンの表示切り替え用 |
| `js/minimap.js` | 地上軌跡のミニ地図（SVG） |
| `js/passes.js` | 今夜の通過の計算（太陽の位置・地球の影・見上げる高さと方角） |
| `js/tonight.js` | 「今夜・頭の上」の表示（県の選択、時刻と方角のことば、空の図） |
| `js/format.js` | 日付・数値の表示 |
| `js/events.js` | 予定（次の出来事・これから行く）：日本時間の日付・残り時間・一覧と詳細の表示 |
| `js/view.js` | 表示切替（すべて／日本のみ／衛星のみ／打ち上げ予定のみ）：日本の決め方と、それぞれの表示で出すもの。選んだ表示はブラウザに覚える |
| `js/launches.js` | 世界の打ち上げ（参考）：日本時間の日時・残り時間・公式の予定との重なりの除外・射場のピンのまとめ・「参考」の印・一覧と詳細の表示 |
| `js/far/` | 遠くを見る部屋（タスク013・015）。「遠くを見る」を押したときに読む（起動では読まない）。`room.js`＝部屋（画面いっぱいのダイアログ・開け閉め・データ・3D を使えないときの切り替え）、`journey.js`＝3D の旅（合わせた試作を本体のデータで動かすもの。航路・カメラ・景色・表示・操作。停留所は `journeyStops` が作る）、`models.js`＝探査機の模型（Codex 作。公式を参考にしたイメージ）、`fly.js`＝3D を使えない端末の飛ぶ画面（v0。Canvas 2D）、`distance.js`＝地球からの距離（月・太陽・惑星はブラウザで計算）と数の書き方、`probe-card.js`＝探査機のカードと距離のはしご |
| `css/far.css` | 遠くを見る部屋の見た目（部屋を開いたときに読む） |
| `data/orbits/iss.json` | 軌道データ（CelesTrak の OMM JSON。TLE でも動く。取得日時・エポック・出典URLを含む） |
| `data/prefectures.json` | 都道府県の代表地点（`config/prefectures.json` のコピー） |
| `data/craft-index.json` | 表示する機体の一覧（`npm run sync:web` で作る） |
| `data/events.json` | 予定（`curation/events/` から `npm run sync:web` で作る） |
| `data/launches.json` | 世界の打ち上げ（参考）。Launch Library 2（The Space Devs）から GitHub Actions が6時間ごとに作る（手元では `npm run fetch:launches`）。公式の発表ではないので、画面では「参考」の印を付ける |
| `data/cards/iss.json` | `examples/spacecraft/iss.json` のコピー（見本） |
| `data/cards/iss-crew.json` | ISS に向かったチームと飛行士（`examples/teams`・`examples/astronauts` から `npm run sync:web` で作る） |
| `data/land-110m.geojson` | 陸地の形（Natural Earth）。画面では読まない（ミニ地図の陸地の元） |
| `data/land-minimap.json` | ミニ地図の陸地（計算済みの SVG の線）。`land-110m.geojson` から `npm run build:minimap-land` で作る。起動のあとに裏で読む |
| `data/places.json` | 「いま、どこの上？」の地名（Natural Earth から `scripts/build-places.mjs` で作る）。起動のあとに裏で読む |
| `data/probes.json` | 遠くを見る部屋の探査機（`curation/probes/` から `npm run sync:web` で作る）。部屋を開いたときに読む |
| `vendor/` | ライブラリ（`vendor/README.md`） |

## メモ

- 読み込みの順番（タスク012、スマホで軽くするため）：3D 表示のライブラリ（`vendor/globe.gl.min.js`）は `index.html` の preload で最初に読み始め、`js/main.js` が実行する。データと並べて読み、地名とミニ地図の陸地は「観測を開始」を押せるようになってから裏で読む。フォントは画面の表示を止めずに読む
- 読み込み量の上限は `config/size-budget.json`（CI で確かめる。手元では `npm run check:size`）。超えたら、まず小さくできないか（画像を縮める・あとから読む）を考える
- 遠くを見る部屋（`#far`）：入口は地球の上の「遠くを見る」。開いているあいだは地球の描画を止める。ブラウザの「戻る」で閉じる。`#far` つきの URL で開くと、「観測を開始」のあとすぐに部屋が開く。距離の出し方は `docs/tasks/013-far-room.md`
- 軌道データの基準時刻（エポック）から7日以上離れると、画面下に「ずれている可能性」を表示する（自動更新が止まったときの目印にもなる）
- カードは `examples/` の見本を読むので、常に「見本・出典確認中」を表示する（`main.js` の `isSample: true`）
- 「滞在」には、打ち上げ済みで帰還日が来ていないチームを出す（観測時刻で判断するので、早送りすると変わる）
- タイムラインは現在の −6時間〜+24時間。端に着いたら止まる。「LIVE」で現在・等倍に戻る
- 予定：日付は公式の発表どおり（日本時間で表示）。時刻まで決まっている予定は、その時刻から6時間で一覧から消える。延期は「延期」として残す。射場のピンは打ち上げの予定だけ
- 今夜の通過：高さ10°以上・空が暗い（太陽が−6°より下）・ISS に日が当たっている、の3つを満たすときだけ「見える」とする。選んだ県はブラウザ（localStorage）にだけ保存
- 環の半径と機体の高さは比較用の縮尺（`js/scale.js`）。画面に「実距離ではない」と必ず出す
- 生データリンク（CelesTrak）は `norad_id` から自動で作る。公式リンクは URL が `https://` で始まるまで無効
- ランク・ゲージと得意技・弱点の表示は、オーナーの判断でいったん外した（2026-09-29）。データ（`stats`・`special_move`・`weakness`）はスキーマに残している
