# YouTube ショート：最初の3本（下書き）

> 2026-11-22 Claude Code 下書き。**まだ出さない**。出す前にオーナーが決めること（ルール5）は末尾の「出す前の判断」。
> 方針（2026-11-22 の相談）：主役は VOYASCOPE の**画面の録画**。Runway は冒頭1〜2秒の「つかみ」とつなぎだけ。実在の機体・ロゴ・人物・場所は生成しない。

## 3本に共通の形

| 時間 | 中身 | 作り方 |
|---|---|---|
| 0〜2秒 | つかみ（抽象的な映像＋大きな一言） | Runway（縦 9:16。出せる設定かは Runway の画面で確認） |
| 2〜22秒 | VOYASCOPE の画面の録画（スマホの縦画面） | 画面収録。指の動きが見えるとよい |
| 22〜25秒 | 締め：`voyascope.org` と「非公式ファンメイド作品」 | 文字だけ（Runway は使わない） |

- 長さは25秒前後。ナレーションなし、文字（テロップ）で読ませる
- 音は X と同じく**合成した音だけ**（実在の音声・中継の音・市販の曲は使わない）
- Runway の部分には小さく「イメージ」と入れる（実際の宇宙の映像と取りちがえられないように）
- テロップの数字は、下の「出典」にあるものだけ。足すときは `curation/` に出典があるかを先に見る
- 説明欄の定型（X のリプ欄の定型に合わせた案）：
  ```
  いま開くと、[画面で見えること]。
  https://voyascope.org
  ※非公式のファンメイド作品です。最新の情報は[公式]で確かめてください
  映像の一部（冒頭）は AI で生成したイメージです
  ```

### Runway のプロンプトの共通のきまり

- 英語で書く（下の案はそのまま貼れる形）
- どの案にも、次の「入れないもの」を足す：
  `no spacecraft, no satellites, no rockets, no logos, no text, no people, no planets with recognizable surface features`
- 色は VOYASCOPE に合わせる：navy（背景）・amber（光の筋）・mint（計器の線）
- 動きは短く、最後のコマが**黒に近い紺**で終わるようにする（画面の録画へつなぎやすい）

---

## 1本目：ボイジャー1号、光で1日かかる場所へ

**ねらい**：「遠さ」は一目で伝わる。M13「ニュースの次に開く」にもつながる（11/18 のニュースのあと）。

| 時間 | 映像 | テロップ |
|---|---|---|
| 0〜2秒 | Runway：光の筋が奥へ奥へ伸びていき、闇に消える | 「光でも まる1日」 |
| 2〜8秒 | ボイジャー1号の一言ページ（`/missions/voyager-1/`）を開く | 「ボイジャー1号　地球から約259億 km」 |
| 8〜16秒 | 遠くを見る部屋（地球の画面 →「遠くを見る」）。ボイジャー1号の模型と「届いた」 | 「2026年11月18日、1光日に届いた」 |
| 16〜22秒 | 部屋の中で地球の側へ引いていく（遠さが分かる動き） | 「1977年に打ち上げ。49年かけてここまで」 |
| 22〜25秒 | 締め | 「いまどこ？ → voyascope.org」 |

**Runway のプロンプト（案）**
```
Vertical 9:16. A single thin beam of warm amber light travels away from the camera into deep navy-black space, stretching longer and fainter until it disappears into darkness. Sparse faint stars, very slow camera push forward. Minimal, calm, cinematic. Ends on near-black navy. no spacecraft, no satellites, no rockets, no logos, no text, no people, no planets with recognizable surface features
```

**参照画像（画像から動画に。2026-11-22 追加）**
- 始まりのコマ：`docs/promo/runway/voyager-start.jpg`（1080×1920。紺の空・まばらな星・手前から奥へ細くなる琥珀の筋）
- 終わりのコマ（終わりを指定できるなら）：`docs/promo/runway/voyager-end.jpg`（筋のない暗い紺）
- どちらも Claude Code がコードで描いたもの（星は乱数で、実在の星ではない。写真・他人の画像は使っていない）
- 画像を渡すときのプロンプト（動きだけを書く）：
```
The amber beam of light slowly extends away from the camera toward the center and fades into the distance, as the camera gently pushes forward. Stars drift very slightly. Calm and minimal. The beam disappears completely by the end, leaving dark navy space.
```

**出典（テロップの数字）**
- 約259億 km・1光日・人がつくったもので初めて：`curation/events/voyager-1-one-light-day.json`（NASA「Where Are Voyager 1 and Voyager 2 Now?」）
- 2026年11月18日に届いた（10:16:07 UTC）：同じカード（NASA「Voyager One Light-Day Downloads」で `done`）
- 1977年9月5日打ち上げ：`curation/probes/voyager-1.json`（NASA「Voyager 1」）。「49年」はこの日付からの計算（1977年9月 → 2026年11月）

**気をつけること**
- 日本時間では11月18日19時16分。テロップは日付だけにする
- 「いまの距離」を画面に出すなら、録画した日の表示のまま使う（Horizons の予測。テロップで別の数字を言わない）

---

## 2本目：MMX、いま火星へ向かう途中

**ねらい**：打ち上げのあとの「いまどこ」。日本のミッションで、中高生がニュースで聞いた名前。

| 時間 | 映像 | テロップ |
|---|---|---|
| 0〜2秒 | Runway：暗い空間に、弧を描く光の道が1本引かれていく | 「打ち上げから○日」（録画した日で数える） |
| 2〜10秒 | MMX の「いまどこ」（`/mmx/now/`）のオープニング（種子島のピン → 地球を回って MMX へ） | 「2026年10月20日　種子島から」 |
| 10〜18秒 | 全体の図（太陽から見た道。実績＝緑、計画＝琥珀の光が流れる） | 「火星の衛星フォボスへ。火星圏に着くのは 2027年度の予定」 |
| 18〜22秒 | 「MMX を追う」へスワイプ | 「サンプルを持って帰るのは 2031年度の予定」 |
| 22〜25秒 | 締め | 「いまどこ？ → voyascope.org」 |

**Runway のプロンプト（案）**
```
Vertical 9:16. In deep navy space, a thin glowing amber line draws itself along a long gentle curved arc from the lower left toward the upper right, leaving a soft trail. Faint mint-green grid lines fade in and out like an instrument display. Slow, precise, minimal motion graphics feel. Ends on near-black navy. no spacecraft, no satellites, no rockets, no logos, no text, no people, no planets with recognizable surface features
```

**出典（テロップの数字）**
- 2026年10月20日 打ち上げ（種子島）：JAXA の打上げライブ中継で確認（`docs/handoff.md`。出典 https://www.youtube.com/watch?v=sZGyK9jfoy4）。カードは `curation/events/mmx-launch.json`
- 火星圏到着 2027年度・帰還 2031年度：C19 で照合済みのプレスキット（`docs/roadmap.md` の C19）
- フォボスの砂や岩石を地球に持ち帰る：`curation/probes/mmx.json`・`curation/events/mmx-launch.json`

**気をつけること**
- 画面の道と MMX の位置は**計画からの推定**（到着日は仮の 2027-08-15）。テロップに「いま○○ km」のような数字は**入れない**。入れるなら「計画の軌道からの推定」と書く
- 到着日の「8月」はテロップに出さない（公式は「2027年度」まで）
- H3 ロケットや MMX の機体を Runway で作らない（画面の模型は、公式の写真を見て独自に組み立てたもの。それを録画するのはよい）

---

## 3本目：しし座流星群の夜を、9つの街から見上げる

**ねらい**：「見上げる」は中高生が自分ごとにしやすい。街を切り替えると、同じ夜でも空がちがうのが分かる。

| 時間 | 映像 | テロップ |
|---|---|---|
| 0〜2秒 | Runway：夜空に細い光の筋が数本、ななめに走る（抽象的に。星座の形にしない） | 「11月18日の夜、本当に流れた流星」 |
| 2〜9秒 | 流星を眺める（`/meteors/`）。東京で再生、速さを600倍に | 「東京の空　カメラが記録した流星を描き直し」 |
| 9〜16秒 | 街のボタンで ニューヨーク → ロンドン に切り替え | 「同じ夜を、ニューヨークから。ロンドンから」 |
| 16〜22秒 | 明るい流星に指を置いて MAG を見せる | 「この流星は ○等」（画面に出た値） |
| 22〜25秒 | 締め | 「あなたの街の空 → voyascope.org/meteors」 |

**Runway のプロンプト（案）**
```
Vertical 9:16. Looking straight up at a dark navy night sky with faint stars. Three or four thin bright streaks of light flash briefly at a diagonal and fade, like shooting stars, one slightly orange. No horizon, no landscape, no constellations shapes. Calm, quiet, slightly dreamy. Ends on near-black navy. no spacecraft, no satellites, no rockets, no logos, no text, no people, no planets with recognizable surface features
```

**出典（テロップと画面）**
- 流星のデータ：Global Meteor Network（CC BY 4.0・加工）。画面の出典の帯（`web/meteors/index.html`）
- 11月18日・しし座流星群：`curation/events/leonids-2026.json`（国立天文台）
- 個数は録画したときの画面の数字をそのまま使う（GMN がデータを作り直すと変わる）

**気をつけること**
- **動画の説明欄にも** GMN（CC BY 4.0）・ヒッパルコス星表（ESA）・ESO/S. Brunier（CC BY 4.0）のクレジットを書く。画面の帯が小さくて読めない場合があるため（CC BY の表示を動画の側でも満たすか → 出す前の判断）
- 「肉眼でほぼ見えない流星も描いている」ことを、テロップか説明欄に1行入れる（画面の注記と同じ）
- 流星の色（オレンジ・水色）は流星群の区別で、本当の色ではない。Runway の「オレンジの筋」も演出

---

## 出す前の判断（オーナー。ルール5）

1. **Runway の利用規約**：いまのプランで、作った映像を YouTube に出してよいか。権利がだれにあるか
2. **YouTube の「改変・合成コンテンツ」の申告**：抽象的な映像だけでも申告するか（安全側は「する」）
3. **子ども向けの設定**（対象が中高生）
4. **チャンネル名**と、非公式ファンメイドの書き方（X と同じでよいか）
5. **CC BY 4.0 の表示**：3本目で、GMN・ESO のクレジットを説明欄に書けば足りるか
6. **画面に映る出典つきの画像**：録画に NASA の夜の地球などが映る場合、その条件で動画に出してよいか（画面での表示とは別の使い方になる）

## このあと

- オーナー：判断 1〜6 → Runway で冒頭を生成 → 画面を録画してつなぐ
- Claude Code：出す直前に、テロップの数字を出典のページで照合し直す（日付・値が変わっていないか）
- 効果を見る：Cloudflare Web Analytics で、YouTube からの流入を1か月数える。少なくても、ショートの再生数とサイトの流入を分けて見る
