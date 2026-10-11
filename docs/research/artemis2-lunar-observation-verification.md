# アルテミス2号「乗った先で月面を観測する」— Phase A 検証メモ（2026-10-11）

- 依頼：オーナーの設計パッケージ「VOYASCOPE_ArtemisII_LunarObservation_Design_20261011.zip」（このリポジトリには入れていない）
- この段階では UI は変えていない。計算は `scripts/artemis2-observations.mjs`、結果は [`artemis2-observations.json`](artemis2-observations.json)（アプリには読み込まない）
- 区分：**確認済み**＝公式ページを開いて確かめた／**計算**＝公式データからこのリポジトリで計算した／**未確認**＝根拠がまだない

## 1. 現状の監査

### ブランチ・PR

- main：`0cb22c8`（自動更新）。PR #25（`claude/artemis2-warp`、1コミット `027a2a0`）はマージしていない。CI は成功、main との衝突なし
- PR #25 の中身：ワープ（放射状の光の筋と章の見出し）、×1・×2・×4 をやめて「次の場面 ›」、名前の文字を絵のアイコンに、スマホのボタンの重なりの修正
- この Phase A は main から切ったブランチ（`claude/artemis2-lunar-observation`）。PR #25 のコードには触れていない

### 軌道データ（エフェメリス）— 確認済み

| 項目 | 値 |
|---|---|
| ページ | https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/（「Artemis II Ephemeris May 1, 2026 ZIP (1.51 MB)」、Page Last Updated: May 01, 2026） |
| ZIP | `all-artemis-ii-oem-files.zip`。SHA-256 `93da0cbe…97f1`。2026-10-09 に取ったものと 2026-10-11 に取り直したものは同じ |
| 中身 | 10個の OEM（4/2〜4/10 に作られた版）。**「飛行後の確定版」と書かれたファイルはない**。期間全体をおおう最新の版は `Artemis_II_OEM_2026_04_10_Post-ICPS-Sep-to-EI.asc`（CREATION_DATE 2026-04-10T03:22:19、NASA/JSC/FOD/FDO。SHA-256 `9def718e…c5859`） |
| 形式 | CCSDS OEM 2.0。CENTER_NAME = EARTH、REF_FRAME = EME2000、TIME_SYSTEM = UTC。行は「時刻 x y z vx vy vz」（km・km/s） |
| 期間 | 2026-04-02T01:57:37.084 〜 2026-04-10T23:53:16.723（ICPS 分離後〜大気圏突入） |
| 間隔 | 月のそばは 4分ごと（例：22:58:51.667、23:02:51.667） |

- 4/10 版は月のそばを通ったあと（4/6〜4/7）に作られたので、月のそばの部分は「飛んだあとの推定」と考えられる。ただし NASA は確定版とは書いていない → **未確認**（どの版を正とするかは、NASA の説明がない）
- 4/9 版（CREATION_DATE 2026-04-08T22:20:54）で同じ計算をしても、下の出来事の時刻は分単位で同じだった

### いまのアプリの処理（`scripts/artemis2-trajectory.mjs`・`web/tour/artemis2/tour.js`）

- trajectory.json：4/10 版の OEM を変換。座標は地球中心で、x-y が月の公転面になる向きに回している。月と太陽は Astronomy Engine で計算。地球の向きは ERA（UT1≒UTC）で近似
- 月の向き：**「経度0°（テクスチャのまんなか）がいつも地球を向く」だけ**。秤動（±7〜8°）と、月の自転軸の傾きは入っていない。そのため、地名を月の上に置くときは向きの直しが要る（Phase B）
- テクスチャと地名の向き：CGI Moon Kit の色の地図を、USGS の経度・緯度で切り出して確かめた（§4）。左右の反転・90°や180°のずれはない。three.js の球の UV でも、東経が正の右手系になる（経度0°が +x、東経90°が −z、北が +y）
- T_MOON（最接近）：trajectory.json の点のうち、いちばん近い点を取っている（4分きざみ）。そのため **22:58:52 UTC と、計算した最接近（23:00:40）より約2分早い**。Phase B で直す候補
- T_SET・T_RISE：地球の**中心**が月のふちに隠れる／出る時刻（1分きざみ）。T_ECLIPSE：月と太陽の向きがいちばん近い時刻（太陽の向きは最接近のときの値で固定）
- 計器の「月の表面から」：月の中心からの距離 − 1737.4 km（球）。地形の高さは入っていない。「速さ」は地球中心の速さで、基準の表示がない（設計の「基準を明記できなければ出さない」に引っかかる）
- 視点：窓から（宇宙船の位置から月や地球を見る。**宇宙船の姿勢・窓の向きのデータはない**）、地球から、航路、乗り込みのときだけ外から
- アクセシビリティ：PR #25 のオリオンの目印は `span` に click を付けている → Phase B で `button` にする（設計どおり）
- 読み込み：`tour-artemis2` のグループ（`config/size-budget.json`）は、`tour/artemis2/*`・three.js r128・地球の画像2枚・月の画像2枚を、文字のファイルは gzip 後で数える。いま 888 KB／上限 950 KB（PR #25 のとき）。残りは約 62 KB

## 2. 出来事の時刻 — NASA の実況と計算（4/10 版 OEM）

月は半径 1737.4 km の球、地球は 6378.137 km の球。太陽は光行差つき。1分きざみ（最接近だけ1秒きざみ）。

| 出来事 | 計算（UTC） | NASA（確認済み） | 差 |
|---|---|---|---|
| 地球の入り | ふちが触れる 22:41・中心 22:42・すっかり隠れる 22:44 | 実況「6:41 p.m. … the crew witnessed an "Earthset"」（S03）。写真 art002e021219「6:41 p.m. EDT」。通信が切れた 6:44 p.m. | 1分以内 |
| 最接近 | 23:00:40、月面から 6,555 km（4,073 mi） | 実況「7:00 p.m. … about 4,067 miles above the lunar surface」 | 時刻は1分以内。高さは 6 mi（約10 km）ちがう。NASA の「月面」の基準は**未確認** |
| 地球の出 | ふちが出る 23:20・中心 23:22・すっかり出る 23:24 | 写真「Earthrise … at 7:22 p.m. EDT」。実況 7:24 p.m. | 2分以内 |
| 日食 | 欠けはじめ 00:33・皆既 00:35〜01:29・終わり 01:32（4/7） | 実況「8:35 p.m. Artemis II is now entering a solar eclipse」。予定の終わり 9:32 p.m.（S04） | 2分以内 |

- 実況の時刻は投稿の時刻で、分より細かくない。だからアプリでは「NASA の発表」と「軌道データからの計算」を分けて書く
- **設計パッケージの MISSION_ANCHORS との違い**：パッケージでは「地球の入りの分は実況からは確定できない」としている。しかし同じ実況ページの 6:41 p.m. の項に「the crew witnessed an "Earthset"」とある。これは地球の入りの実績として使える（確認済み）

## 3. 地名と位置 — USGS / IAU Gazetteer（確認済み）

すべて Planetographic、東経が正、−180〜180。月は球なので、緯度は planetocentric と同じ。

| id | 名前 | USGS | 中心（緯度, 経度） | 直径 | 計画（LTP） |
|---|---|---|---|---|---|
| reiner_gamma | Reiner Gamma | [4987](https://planetarynames.wr.usgs.gov/Feature/4987) | 7.39, −58.96 | 73.44 km | ○ |
| glushko | Glushko | [2195](https://planetarynames.wr.usgs.gov/Feature/2195) | 8.11, −77.67 | 40.10 km | ○ |
| pierazzo | Pierazzo | [15328](https://planetarynames.wr.usgs.gov/Feature/15328) | 3.30, −100.24 | 9.29 km | ○（話題として） |
| ohm | Ohm | [4417](https://planetarynames.wr.usgs.gov/Feature/4417) | 18.32, −113.78 | 61.75 km | ○ |
| mare_orientale | Mare Orientale | [3685](https://planetarynames.wr.usgs.gov/Feature/3685) | −19.87, −94.67 | 294.16 km | ○（Orientale Basin として） |
| hertzsprung | Hertzsprung | [2482](https://planetarynames.wr.usgs.gov/Feature/2482) | 1.37, −128.66 | 536.37 km | ○（Hertzsprung Basin） |
| vavilov | Vavilov | [6336](https://planetarynames.wr.usgs.gov/Feature/6336) | −0.87, −138.77 | 98.22 km | ○ |
| mare_imbrium | Mare Imbrium | [3678](https://planetarynames.wr.usgs.gov/Feature/3678) | 34.72, −14.91 | 1145.53 km | × |

- **ヘルツシュプルング**：設計パッケージでは「盆地の公式の位置は未確認」だった。しかし USGS には「Hertzsprung」がクレーター（直径 536 km）として載っている。NASA の写真の説明では「Hertzsprung Basin」「two concentric rings」と書かれている。→ 中心と大きさは**確認済み**。輪の形は USGS にない
- **オリエンターレ盆地**：USGS に盆地そのものの項目はない。あるのは Mare Orientale（中央の海）、Montes Rook（651 km）、Montes Cordillera（956 km）。山脈2つの輪郭（WKT）は USGS にある。しかし、これが「オリエンターレの輪」だと書いた公式の文は、まだ見つけていない（NASA の写真の説明は「rings of mountains」とだけ書いている）→ 盆地全体の位置と輪は**未確認**。Mare Orientale の点で盆地全体を指さない
- 計画（S01）の順序：1組目 Glushko・Ohm → Aristarchus → Reiner Gamma／2組目 Orientale → Hertzsprung／3組目 Ohm → Earthset → Vavilov → Earthrise → 日食。PDF に「subject to change」とあるので、実績とは書かない

## 4. 2K の月の地図で見分けられるか（目で確認）

CGI Moon Kit の色の地図（`web/assets/moon/lroc-color-2048.webp`、赤道で 1画素 ≒ 5.33 km）を、USGS の中心・直径で切り出して見た。

| id | 地図の上の大きさ | 見え方 |
|---|---|---|
| reiner_gamma | 約14画素 | **見える**：暗い海の上に、明るい渦のような模様が円のなかにある |
| glushko | 約8画素 | 明るい点と光条が見える。クレーターの形は小さい |
| pierazzo | 約2画素 | 明るい点だけ。クレーターとしては**見分けられない** |
| ohm | 約12画素 | **うすい**。光条ははっきりしない |
| mare_orientale | 約55画素 | **はっきり見える**：暗い海。まわりの輪の一部も見える |
| hertzsprung | 約100画素 | **うすい**：2重の輪がかすかに見える |
| vavilov | 約18画素 | **うすい**（色の地図には影がない。凹凸は ldem-1024 のでこぼこだけ） |
| mare_imbrium | 約215画素 | はっきり見える |

- この地図は「色と明るさ」の地図で、影はない。NASA の写真のような低い太陽の長い影は出ない。だから「写真と同じように見える」とは書かない
- 中心の位置は、どの地形でも地図の模様と合っていた（Reiner Gamma の渦、Mare Orientale の暗い部分、Glushko と Pierazzo の明るい点）。経度の向き・反転の問題はない

## 5. いつ見えたはずか（計算。4/6 00:00〜4/7 06:00 UTC、1分ごと）

条件：見える＝出射角 e < 90°、照らされている＝入射角 i < 90°、見やすい＝e < 70° かつ i < 88°。月は球（地形の高さなし）。宇宙船の姿勢・窓は考えない（位置から見て、月のその面がこちらを向いているか、だけ）。

| id | 見やすい時間（UTC、4/6） | 見えて照らされている時間 | 備考 |
|---|---|---|---|
| reiner_gamma | 〜20:46 | 〜21:39 | 18:19 に e 41°・i 9°（太陽が高い）、見かけ 0.22° |
| glushko | 〜21:37 | 〜22:17 | |
| pierazzo | 〜22:23 | 〜22:56 | |
| ohm | 〜22:42 | 〜23:17 | |
| mare_orientale | 〜22:10 | 〜22:47 | 18:19 に e 24°・i 46°、見かけ 0.90°。19:41 に e 28°、1.19° |
| hertzsprung | 〜23:12 | 〜23:49 | 21:12 にほぼ真上（e 1°）・i 74°、見かけ 3.3° |
| vavilov | 14:27〜23:31 | 10:31〜4/7 00:13 | 22:00 に e 11°・i 84°（昼と夜の境目の近く） |
| mare_imbrium | 〜13:52 | 〜18:49 | 観測の時間（18:45〜）にはもう月のふちで、斜めすぎる |

- オリオンの真下の経度は、17:00 に −89°、19:41 に −107°、21:12 に −129°、22:41 に −169°、23:10 に +174° と動く（月の西のふちから裏側へ）。太陽の真下は約 −53〜−55°。つまり、近づくあいだは「西側が半分ほど照らされた月」を見る（NASA の写真の説明にも「first quarter Moon」「waxing gibbous Moon」とある）
- オリオンから見える半分のうち、照らされている割合：地球の入り 33%、最接近 25%、地球の出 17%（NASA の解説「about 20% of the lunar far side was sunlit」と同じくらい）
- **計算の順番と計画（LTP）の順番は合っている**：Reiner Gamma（20:46 まで）→ Orientale（22:10 まで）→ Hertzsprung（23:12 まで）→ Vavilov（23:31 まで）→ 地球の入り・地球の出
- 月の見かけの大きさは、18:19 に 9.9°、21:12 に 18°、22:41 に 24°。スマホの窓（縦の画角 70°）では、地形は数ピクセルにしかならない。地形を見せるときは、地球の入りと同じように望遠にする必要がある（例：画角 8° で、Mare Orientale は約 95 ピクセル）

## 6. NASA の写真で、地形の名前が出ているもの（確認済み）

[NASA の Lunar Flyby ギャラリー](https://www.nasa.gov/gallery/lunar-flyby/)（86枚）の説明文から。撮影の時刻が書いてあるのは一部だけ。

| 写真 | 説明文に出てくる地形 | 時刻 |
|---|---|---|
| [art002e009277](https://www.nasa.gov/image-detail/amf-art002e009277/) | Orientale basin（まんなか）。「black patch of ancient lava」 | 2:19 p.m. EDT（18:19 UTC）。観測の時間の直前 |
| [art002e009279](https://www.nasa.gov/image-detail/amf-art002e009279/) | the rings of the Orientale basin | 3:41 p.m. EDT（19:41 UTC） |
| [art002e010232](https://www.nasa.gov/image-detail/amf-art002e010232/) | Orientale basin | 書いていない |
| [art002e012114](https://www.nasa.gov/image-detail/amf-art002e012114/) | Aristarchus・Marius Hills・「The sinuous Reiner Gamma swirl」 | 書いていない |
| [art002e012261](https://www.nasa.gov/image-detail/amf-art002e012261/) | Ohm・Oceanus Procellarum・Grimaldi・Pierazzo・Hertzsprung Basin | 書いていない |
| [art002e012093](https://www.nasa.gov/image-detail/amf-art002e012093/) | Hertzsprung Basin（two concentric rings）・Vavilov | 書いていない |
| [art002e021296](https://www.nasa.gov/image-detail/amf-art002e021296/) | Hertzsprung basin | 書いていない |
| [art002e009287](https://www.nasa.gov/image-detail/amf-art002e009287/) | 地球の入り。Orientale Basin・Hertzsprung Basin・Vavilov | 5:41 p.m. CDT（22:41 UTC） |
| [art002e009282](https://www.nasa.gov/image-detail/amf-art002e009282/) | Vavilov Crater on the rim of … Hertzsprung basin | 書いていない |

- 写真の時刻は、計算の「見える時間」に入っている（Orientale：18:19・19:41 → 22:10 まで見やすい。地球の入りの写真 22:41 → Hertzsprung・Vavilov は見えている）
- 「NASA の写真を見る」のリンクは、**NASA の説明文が、その地形の名前を出している写真に限る**。写真の画角や向きが、アプリの眺めと同じとは言わない。写真はアプリに入れない（リンクだけ）
- Glushko・Imbrium については、名前を出している写真はまだ見つけていない（ギャラリーのほかのページ・PDS は未確認）

## 7. Phase B・C への提案（オーナーの判断待ち）

### 観測する地形は2つ＋説明カード1つ

| 順 | 対象 | 扱い | 理由 |
|---|---|---|---|
| 1 | **東の海（Mare Orientale）＝オリエンターレ盆地のまんなか** | 照準を出す（Phase B の1地点） | 位置（USGS）・地図で見える・計算で見やすい（18:19〜19:41）・NASA の写真の時刻と合う・「月の海は水ではなく溶岩」も同じ場所で言える（NASA の説明「black patch of ancient lava」） |
| 2 | Reiner Gamma | 照準を出す候補（Phase C） | 位置・地図で見える。ただし見かけ 0.2° と小さく、強い望遠が要る |
| 3 | ヘルツシュプルング盆地（＋ヴァヴィロフ） | 位置を指さない説明カード（FALLBACK） | 中心は確認済み。しかし地図ではうすく、見えるとは言いにくい。NASA の写真へのリンクはできる |
| — | Glushko・Ohm・Pierazzo・Imbrium | 出さない | Ohm はうすい、Pierazzo は2画素、Imbrium は時間が合わない。光条の比べっこには測光（明るさの比較）が要る |

- 照準の場所は「東の海（Mare Orientale）」と書く。盆地全体は、説明文で「そのまわりの大きな輪をふくめて、オリエンターレ盆地」と言うだけにし、輪の線は描かない（輪の公式の形が未確認のため）

### 場面の時刻の案（飛行の時刻はいつも前に進む）

| 場面 | 飛行の時刻（UTC、4/6） | 演出の秒（案） | 根拠 |
|---|---|---|---|
| 出発 | 4/2 01:58〜10:00 | 12 | OEM の始まり |
| 時間圧縮（行き） | 〜4/6 17:00 | 6 | 点と日付だけが進む。光の筋はなし |
| 月が見えてくる | 17:00〜18:10 | 16 | |
| Reiner Gamma | 18:10〜18:40 | 14 | e 40〜45°、i 9° |
| 東の海・オリエンターレ | 18:40〜19:50 | 22 | 写真 18:19・19:41 |
| （時間圧縮） | 19:50〜22:30 | 4 | ヘルツシュプルングのカードはここ |
| 地球の入り | 22:38〜22:46 | 14 | 計算 22:41〜22:44／NASA 6:41 p.m. |
| 裏側 | 22:46〜23:18 | 14 | |
| 地球の出 | 23:18〜23:26 | 14 | 計算 23:20〜23:24／NASA 7:22 p.m. |
| 日食 | 4/7 00:30〜00:40 | 18 | 計算 00:33〜／NASA 8:35 p.m. |
| 時間圧縮（帰り） | 〜4/10 21:00 | 6 | |
| 帰還 | 〜23:53 | 10 | OEM の終わり（大気圏突入） |

秒数は設計パッケージの189秒案をもとにした仮の数字で、Phase C で実際に見て直す。

## 8. 未確認のまま残すこと

1. どの OEM の版を「飛行後の確定」とするか（NASA の説明がない。いまは期間全体をおおう最新の 4/10 版を使う）
2. NASA の「月面から 4,067 マイル」の基準面（計算は球で 4,073 マイル）
3. 宇宙船の姿勢・窓の向き（データなし。「航路の上に置いた仮の観測の視点」と書く）
4. オリエンターレ盆地全体の中心と輪の形（USGS の Montes Rook・Montes Cordillera が輪だという公式の文が見つかっていない）
5. 月の向きのモデル：IAU WGCCRE 2009 の式で、Astronomy Engine 本体の RotationAxis と比べた（極の赤経・赤緯は小数4桁まで一致し、W の差は 0.01° 以下）。USGS の地名の基準（ME 座標系）とのずれは、ここでは数百 m 程度と考えているが、その出典は未確認
6. 写真の撮影時刻（ほとんどの写真に書かれていない）と、写真の画角・向き
7. 2K の地図で Hertzsprung・Vavilov を「見える」と言えるか（Phase B で、望遠の画面に描いて確かめる）

## 9. 法律・権利（確認してほしいことの一覧。結論は出していない）

- NASA の写真へのリンクの出し方と、説明文の短い引用（日本語に言い換えるかどうか）
- USGS / IAU の地名の日本語の呼び方（「東の海」など）と出典の書き方
- CGI Moon Kit のクレジット（いまは NASA's Scientific Visualization Studio）
- 「NASA」「Artemis」「Orion」の名前の使い方と、公式と誤解させない書き方（「NASA 航路データ」という表示）
- 中高生にためしてもらうときの、同意と個人情報の扱い

## 10. Phase B の結果（2026-10-11）

- 月の模型の向きを IAU のモデルにした（`trajectory.json` の `moonFrame`）。Mare Orientale の照準を描くと、2K の地図の暗い部分にちょうど重なった（スクリーンショットで確認）。軸の向き・経度の符号・右手系はテスト（`tests/artemis2-lunar.test.mjs`）で、Phase A の計算と照らし合わせている
- `trajectory.json` を作り直したので、座標の向き（最接近のときの月で決める）がわずかに変わった（最接近の時刻を詰めたため。太陽の向きの差は 0.0002 ほど）
- 負の例（月の向こう側・夜・画面の外・小さすぎる・未確認の地形）では照準を出さない（テスト）
- 太陽の向きは最接近のときの値で固定している（Mare Orientale の入射角・出射角は、時刻ごとに太陽を計算した Phase A の値と 0.1° 以内で合う。18:19・19:41 UTC で確認）
- 読み込み：896 KB／950 KB（`lunar.js` と、`trajectory.json` の月の向きのぶん、約8 KB 増えた）

## 11. Phase C の結果（2026-10-11）

- 観測の場面の時間は `web/tour/artemis2/lunar.js` の `OBSERVE_WINDOWS`。Reiner Gamma 17:45〜18:25 UTC、Mare Orientale 18:25〜19:50 UTC。はじめ・まんなか・おわりで、出射角 75° 未満・入射角 88° 未満をテストで確かめる
- Hertzsprung は FALLBACK（位置を指さない情報のカード）。中心は USGS で確認済みだが、2K の地図ではうすいため
- Reiner Gamma は見かけ約 0.2°。縦の画角 5.5° まで寄せると、2K の地図の画素が見えて少しぼやける（渦の形は分かる）
- 字幕・カードの事実と出典：
  - 地球の入り 4/7 7:41 JST・地球の出 4/7 8:22 JST：NASA の写真の撮影時刻（6:41・7:22 p.m. EDT）
  - 日食 4/7 9:35 JST〜：NASA の実況（8:35 p.m. EDT）。「皆既（計算）」は軌道データからの計算
  - 最接近 4,067 mi・通信の途絶 約40分：NASA の実況
  - 各地形の事実：NASA の写真の説明文・NASA の観測計画の説明・NASA Moon Facts・USGS（`lunar.js` のコメントに原文）
- 読み込み：899 KB／950 KB

## 12. 観測のカードの「地名・由来・拡大図」（2026-10-11 オーナー FB）

- オーナー「どこからどこまでが地名か分かりづらい。名前の由来や概要を載せよう。研究も分かるとよい。Gamma は拡大するともっと渦なら、拡大図がほしい」
- カード：「地名 · IAU」の札と名前（等幅の太字）→ 由来 → 概要 → 研究（C26 の確認後）→ 拡大図。文中の地名は「」で囲む
- 由来（USGS の各ページの Origin・Approval Date。2026-10-11 確認）
  - Reiner Gamma（4987）：「Reinieri, Vincentio; Italian astronomer, mathematician (unkn-1648)」・1935。**「Gamma」の意味は USGS のページにない**（C26 で確認）
  - Mare Orientale（3685）：「"Eastern sea."」・1964。カードでは「ラテン語で『東の海』（Eastern sea）」と、意味の訳として書く（日本語の正式な呼び方は C25 で確認）
  - Hertzsprung（2482）：「Ejnar; Danish astronomer (1873-1967)」・1970
- 研究・探査：新しい調査なので C26（チャッピー）に依頼。確認できるまでカードには出さない（`research: []`）
- 拡大図（Reiner Gamma だけ）：CGI Moon Kit（https://svs.gsfc.nasa.gov/4720）の `lroc_color_16bit_srgb_16k.tif`（16384×8192、1画素 約0.67 km）から、USGS の中心のまわり 300×300 画素（幅約200 km）を切り出した。2K の地図（1画素 約5.3 km）では渦の形が粗いが、16K では「明るい渦と暗い筋」がはっきり見える。明るさの幅を少し広げ（autocontrast を 45% だけ混ぜる）、224×224 の WebP（約7 KB）にした。元の TIFF（約900 MB）はリポジトリに入れない
  - Orientale・Hertzsprung も 16K で切り出して見た。Orientale は 2K でも暗い部分が見え、Hertzsprung は 16K でも輪がうすい。拡大図は付けない

## 13. C26（名前の由来・研究）を照合して入れたもの（2026-10-11）

照合の記録：voyascope-research の `research/verification/2026-10-11-c26.md`（引用 14 件を公式ページで確認。すべて一致）

- 日本語の名前：Mare Orientale →「東の海」、Hertzsprung →「ヘルツシュプルング盆地」（どちらも JAXA「かぐや」の成果のページの表記）。Reiner Gamma は日本語の公式の表記が見つからず、英語のまま
- Reiner Gamma：由来に「近くの Reiner クレーターにちなむ（NASA）」。研究：LRO が撮影（2010）・局所的な磁場がある（できかたは研究中）・Lunar Vertex（着陸して調べる計画。**年は出さない**：NASA のページの本文で確認できなかった。実施も未確認）。「Gamma」の意味は未確認のまま
- Mare Orientale：盆地は「外側の輪 東西約950 km（NASA）」（これまでの「幅約970 km（600 mi）」から、測ったものが分かる値に替えた）・約38億年前の衝突（NASA）。研究：GRAIL（2016 公開）・かぐや（2014）・アルテミス2号の写真と LRO の地図の照合（2026年10月）
- Hertzsprung：研究：LRO（内側の輪の岩、斜長岩とみられる）・かぐや（裏側の重力、2009）。直径は USGS の 536 km だけ（NASA の約570 km は定義が違うので出さない）
- カードの形：いつも出すのは「地名 · IAU」の札と名前・要点1行・拡大図（Reiner Gamma）・リンク。「由来 · 概要 · 研究」は開くと出る（開くと一時停止）。PC ではカードを右上に置いて、照準の地形を隠さない

## 14. C25（日本語の呼び方）を照合して入れたもの、オーナーの判断（2026-10-11）

照合の記録：voyascope-research の `research/verification/2026-10-12-c25.md`

- Reiner Gamma →「ライナーガンマ」（JAXA）
- 盆地 →「オリエンターレ盆地」（JAXA。表記の揺れ：オリエンタル盆地・オリエンタレ・ベイスン）
- NASA JPL の「約930 km・輪3本」と LPI の輪の名前は、この環境からページを開けず照合できなかったので入れない
- オーナーの判断（2026-10-11）
  - 観測のカードを開くと一時停止（そのまま）
  - NASA の素材は、教育目的で出典を出せば問題ないものとして使う。クレームがあれば検討する（拡大図のクレジットに「NASA SVS」を足した）
