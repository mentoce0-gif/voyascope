# 依頼：VOYASCOPE「遠くを見る部屋」の探査機の模型（9つ・three.js のコードで作る）

## どんなアプリか

VOYASCOPE は、地球のまわりの衛星・宇宙船の「いま」を、観測端末風の画面で見る日本語の Web アプリです。対象は中高生で、非公式のファンメイド作品です。

「遠くを見る部屋」では、地球から探査機のところまで、光より速く飛んでいきます。天体のまわりではスイングバイをして、探査機のすぐそばを通ります。そのときに、探査機の模型を大きく見せます。

いまの試作には、模型が4つあります（ウェッブ・ベピコロンボ・ニュー・ホライズンズ・パーサヴィアランス）。どれも形が大まかです。今回は、**10機ぶんの模型を、ひと目でどの機体か分かる細かさで**作ってほしいです。

## 作る模型（9つ）

ボイジャー1号と2号は同じ形なので、模型は1つです。
「分かっていること」は公式のページに書かれていることです。比率はこれに合わせてください。書いていないところは、公式のページの写真を見て決めてください。

| キー | 画面の名前 | 形を見る公式のページ | 分かっていること（出典） |
|---|---|---|---|
| `jwst` | ジェイムズ・ウェッブ宇宙望遠鏡 | https://science.nasa.gov/mission/webb/ ・ https://science.nasa.gov/3d-resources/james-webb-space-telescope-a/ | 主鏡は 6.5m（3D のページ）。大きな、いくつもに分かれた、金色の鏡。5層の日よけ（ミッションのページ） |
| `parker-solar-probe` | パーカー・ソーラー・プローブ | https://science.nasa.gov/mission/parker-solar-probe/ ・ https://science.nasa.gov/resource/parker-solar-probe-3d-model/ | 太陽の熱から守る、厚さ11.43cm の炭素の盾（ミッションのページ） |
| `bepicolombo` | ベピコロンボ（みお） | https://www.esa.int/Science_Exploration/Space_Science/BepiColombo/Latest_updates_BepiColombo_s_arrival_at_Mercury ・ https://www.esa.int/ESA_Multimedia/Images/2018/10/BepiColombo_arrival_at_Mercury_timeline ・ https://www.esa.int/Science_Exploration/Space_Science/BepiColombo/BepiColombo_factsheet ・ https://mio.isas.jaxa.jp/mission/ | **いまの姿**：運ぶための推進部（MTM）は 2026年9月3日に切り離した。いまは ESA の周回機（MPO）と JAXA の「みお」が重なっている。12月9〜10日に MPO とみおが分かれる（最新情報のページ）。みおは日よけ（MOSIF）の中に入っている（到着の時刻表のページ）。大きさ：MPO は 2.4×2.2×1.7m、放熱板の幅 3.7m、太陽電池の翼（広げたとき）7.5m。みおは直径1.8m・高さ1.1m（factsheet） |
| `perseverance` | パーサヴィアランス | https://science.nasa.gov/mission/mars-2020-perseverance/ ・ https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/ | 火星の地面を走るローバー。マストの根元にアメリカの旗の板がある → **旗は付けない**。ヘリコプター（インジェニュイティ）は「火星までの旅のあいだ、おなかに付けていた」とある → **付けない** |
| `mmx` | 火星衛星探査機（MMX） | https://www.mmx.jaxa.jp/ ・ https://www.mmx.jaxa.jp/gallery/ | 往路・探査・復路の3つのモジュールでできている（MMX のページ） |
| `hayabusa2` | はやぶさ２ | https://www.isas.jaxa.jp/missions/spacecraft/current/hayabusa2 ・ https://www.hayabusa2.jaxa.jp/ | 2020年12月に地球へ戻ったあと、カプセルを切り離して、また旅に出た → **カプセルは付けない**（ISAS のページ） |
| `juno` | ジュノー | https://science.nasa.gov/mission/juno/ ・ https://science.nasa.gov/resource/juno-3d-model/ | 六角形の本体（高さ・幅とも約3.5m）。太陽電池の翼が3枚で、それぞれ本体から約9m。全体の幅は20m より大きい。「3枚羽の扇風機」のような形。1分に2回まわっている（ミッションのページ） |
| `new-horizons` | ニュー・ホライズンズ | https://science.nasa.gov/mission/new-horizons/ ・ https://science.nasa.gov/resource/new-horizons-3d-model/ | 円筒形の原子力電池（RTG）を1つ持っている（ミッションのページ） |
| `voyager` | ボイジャー1号・2号 | https://science.nasa.gov/mission/voyager/voyager-1/ ・ https://science.nasa.gov/resource/voyager-3d-model/ | 原子力電池（RTG）3つを、ブーム（腕）に重ねて並べている（ボイジャー1号のページ）。ゴールデンレコードを付けるときは、金色の円盤だけにする（絵や文字は描かない） |

## 作り方の決まり（必ず守る）

### 権利と表示

- **公式の3Dファイルを使わない**：GLB・glTF・USDZ・STL・BDS などを、読み込まない・変換しない・形をなぞらない
- **図面を写さない**：MMX の簡易6面図などの、寸法や線を写し取らない
- 公式の写真・説明・回して見られるページは、おおまかな形と色の手がかりとして**見るだけ**。箱・円柱・板・皿などの基本の形を組み合わせて、自分で作る
- **ロゴ・旗・記章・ミッションのマーク・文字・数字を付けない**。NASA・ESA・JAXA・メーカーなど、どの組織のものも
- 見たページの URL を、模型ごとに `userData.refs` に入れる。ページを見られなかったときは、`userData.refs` を空にして、説明にそう書く
- 想像で足したところ（写真で見えなかった裏側など）は、`userData.guessed` に短く書く
- 「公式の模型」「NASA 公認」と思わせる書き方をしない

### 形と大きさ

- **three.js r128 の本体の機能だけ**で作る。`examples/` にあるもの（GLTFLoader・BufferGeometryUtils・RoundedBoxGeometry など）は使わない
- 形を作る関数は、`THREE` を引数で受け取る。`<script>` で読む three.min.js でも、モジュール版でも動くように
- 向き：+Y が上。いちばん見栄えのする斜めの向きを、`userData.pose = [x, y, z]`（ラジアン）に入れる
- 大きさ：模型の中心を原点にして、いちばん長い辺が 2 になるようにする（アプリの側でも、もう一度そろえる）
- 比率：上の表の大きさに合わせる。表にないところは、写真の見た目に合わせる
- 動かす部分
  - ジュノー：回る軸を `userData.spinAxis`（`[x, y, z]`）に入れる。回すのはアプリの側でする
  - ベピコロンボ：`userData.parts = { mpo, mosif, mio }`（それぞれ `THREE.Group`）。いまの姿は、MOSIF の中にみおが入って、MPO と重なった形。分かれたあとの見せ方は、そのときに公式の発表を確かめてアプリの側で決めるので、3つを別々に動かせるようにしておく
  - MMX：`userData.parts = { outbound, explore, return }`（往路・探査・復路のモジュール。それぞれ `THREE.Group`）

### 見た目

- 色はアプリに合わせる：navy `#050e1f`〜`#143057`・mint `#5ef2c2`・amber `#ffb547`・text `#d9f4ea`・text-dim `#8fb3a8`
- **共通の材質**：`makeKit(THREE)` で1回だけ作り、9つの模型で使い回す（模型ごとに材質を作らない）
  - 金（断熱材。細かいしわ）・銀（金属）・白・黒・濃い紺・太陽電池（濃い青のセル）・鏡（ウェッブの主鏡。金の反射）
  - テクスチャは、ブラウザの中で canvas に描く小さなもの（128×128 まで）だけ。画像のファイルは使わない
- 光：アプリと同じ当て方で確かめる（確認用のページにも、この設定を入れる）
  - renderer：`outputEncoding = THREE.sRGBEncoding`・`toneMapping = THREE.ACESFilmicToneMapping`・`toneMappingExposure = 1.1`
  - カメラに付ける光：環境光 `0xd9f4ea` 強さ 0.24。平行光 `0xd9f4ea` 1.7（位置 -3, 5, 7）・`0xffb547` 1.5（5, 2, -4）・`0x5ef2c2` 0.25（-6, -2, 1）
  - 背景：`#050e1f`
- いまの試作の模型は、リポジトリの `docs/design/far-room-visual-merged.html` の `makeKit`・`webbModel` などにある。見られるときは参考にしてよい（見られなくても作れるように、決まりはこの依頼文に全部書いた）

### 軽さ（スマホで1秒60コマ）

- 三角形：1つの模型で 30,000 まで（目安は 10,000〜20,000）
- 部品（Mesh）の数：1つの模型で 120 まで。同じ部品がたくさんあるとき（太陽電池のセル・鏡のかけら・車輪など）は `InstancedMesh` を使う
- ファイルの大きさ：9つ合わせて 60KB まで（gzip で 18KB くらい）
- 作る時間：PC で1つ 15ms まで（確認用のページに表示する）
- 使い終わった模型を片付ける関数 `disposeModel(group)`。形（geometry）だけを消し、共通の材質は消さない

## 渡してほしいもの

1. **`far-room-models.js`**（ES モジュール。1ファイル）

   ```js
   export function makeKit(THREE) { /* 共通の材質 */ }
   export const MODELS = {
     jwst, "parker-solar-probe": parker, bepicolombo, perseverance, mmx, hayabusa2, juno, "new-horizons": newHorizons, voyager,
   }; // それぞれ (THREE, kit) => THREE.Group。group.userData に pose・refs・guessed（ジュノーは spinAxis、ベピコロンボと MMX は parts も）
   export function disposeModel(group) { /* 形だけ消す */ }
   ```

   ボイジャー1号・2号は、どちらも `MODELS.voyager` を使う

2. **`far-room-models.html`**（確認用。1つの HTML）
   - 読むのは three.js r128（`https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`）と `far-room-models.js` だけ
   - 1つずつ大きく表示して、ゆっくり回す（動きを減らす設定 prefers-reduced-motion のときは回さない）
   - 「前へ」「次へ」のボタン（44px 以上）と、← → キーで切り替える
   - 画面に出すもの：画面の名前（上の表）・三角形の数・部品の数・作る時間
   - 「形の目安です。公式の模型ではありません」と「※非公式ファンメイド作品です。宇宙機関・運用者とは関係ありません」を書く
   - スマホ（390×844）と PC（1440×900）で崩れない。横にスクロールしない
   - ローカルのサーバー（`npx serve` など）で開く前提でよい（モジュールはファイルを直接開くと読めないため）。開き方を説明に書く

3. **説明**（日本語で15行くらい）：模型ごとに、何を手がかりにしたか・想像で足したところ・三角形の数

## 比べ方（オーナーがスマホで見て決める）

- ひと目で、どの機体か分かるか
- 細かさ（いまの試作の4つより細かいか）
- 9つの見た目がそろっているか
- 軽さ（三角形・部品の数・作る時間）

## プロジェクトのルール（RULES.md 全文）

模型でも、このルールに沿ってください（とくに 1 の「公認を連想させるロゴや表現は使わない」）。

