# Horizons の説明（datasheet）の確認：遠くを見る部屋の6機（2026-10-04）

JPL SSD の返事（2026-10-04、[`2026-10-03-c14.md`](2026-10-03-c14.md) の「JPL SSD とのやりとり」）で、「Horizons は機体ごとの説明（datasheet）に、もとのデータをだれが出したかを書いていることが多い。それを引き継いで示すのがよい」と言われた。そこで、距離を Horizons の値にする6機の説明を読んだ。

やり方：Horizons API（`https://ssd.jpl.nasa.gov/api/horizons.api`）に、1機ずつ、間を3秒あけて問い合わせた（2026-10-04 日本時間 7時30分ごろ。User-Agent は製品名・版・連絡先の URL 入り）。説明（`OBJ_DATA='YES'`）と、地球の中心からの距離の表（1日ごと・6週間）を一緒にもらった。応答の version は 1.2。
応答（表は最初の3日に縮めたもの）は、テストの見本として [`tests/fixtures/horizons-2026-10-04.json`](../../tests/fixtures/horizons-2026-10-04.json) に置いた。

## 機体ごとの説明

| 機体 | Horizons の番号 | 対象の名前（Target body name） | 軌道のもとのデータについての説明（原文） | カードに書くこと |
|---|---|---|---|---|
| ボイジャー1号 | -31 | Voyager 1 (spacecraft) (-31) `{source: Voyager_1_ST+refit2022_m}` | "Refit of tracking data spanning 1981-1992 (end of two-way coherent transponder data). Done in 2022 by R. Jacobson (former Voyager navigation) using DE440 to generate a new solution and prediction." / "Note there has been no new tracking data possible since 1992." | 機関の名前は書かれていない → 機関は書かない。note：「Horizons の軌道は、1981〜1992年の追跡データから求めたもの。それより後は予測」 |
| ボイジャー2号 | -32 | Voyager 2 (spacecraft) (-32) `{source: Voyager_2_ST+refit2022_m}` | "Refit of tracking data spanning 1989-1992 (from Neptune encounter to the end of two-way coherent transponder data)." / "Note there has been no new tracking data possible since 1992." | 同上（1989〜1992年） |
| パーカー・ソーラー・プローブ | -96 | Parker Solar Probe (spacecraft) (-96) `{source: psp_merged}` | "Fit to post-launch tracking data through 2026-Sep-01. Reference planning trajectory for subsequent times." | 機関の名前は書かれていない → 書かない |
| はやぶさ２ | -37 | Hayabusa 2 (spacecraft) (-37) `{source: hayabusa-2_merged}` | "Tag-up predict fit to tracking data through 2026-Sep-29, prediction thereafter. Trajectory data from JAXA navigation." | 軌道のもとのデータ：**JAXA** |
| ジェイムズ・ウェッブ宇宙望遠鏡 | -170 | James Webb Space Telescope (spacecraft) (-170) `{source: JWST_merged}` | "Concatenation of reconstructed trajectory solutions (as-flown) from Goddard Flight Dynamics Facility (FDF), based on tracking data through September 27, with prediction thereafter." | 軌道のもとのデータ：**NASA ゴダード飛行力学施設（FDF）** |
| ベピコロンボ | -121 | BepiColombo (Spacecraft) (-121) `{source: BepiColombo_ESA}` | "Trajectory from ESA. Data fit through 2026-Sep-28, prediction thereafter." | 軌道のもとのデータ：**ESA** |

- 人の名前（ボイジャーの説明にある）は、カードに書かない
- 「いつまでの追跡データで合わせたか」（パーカーの 2026-09-01 など）は、更新のたびに変わるので、カードには書かない
- カードには、もとにした原文を `distance.datasheet_quotes` として残した。週1回の取得のたびに、その原文がまだ説明にあるかを `scripts/fetch-horizons.mjs` が確かめる。なければ失敗で終わって知らせる（Claude Code が説明を読み直して、カードを直す）

## 距離（2026-10-04 日本時間 0時。有効数字3桁）

| 機体 | 地球からの距離 | 光で |
|---|---|---|
| ジェイムズ・ウェッブ宇宙望遠鏡 | 約132万 km | 約4秒 |
| はやぶさ２ | 約7,030万 km | 約4分 |
| パーカー・ソーラー・プローブ | 約1億2,100万 km | 約7分 |
| ベピコロンボ | 約1億7,100万 km | 約9分 |
| ボイジャー2号 | 約215億 km | 約20時間 |
| ボイジャー1号 | 約258億 km | 約23時間50分 |

- 地球の中心からの幾何学的な距離（光の時間の補正なし。`VEC_CORR='NONE'`）
- これまでの目安とのちがい：ウェッブは NASA の説明の目安「約150万 km」より近い（L2 のまわりを大きく回っているため）。ベピコロンボは、これまで出していた水星までの距離（約1億7,100万 km）とほぼ同じ
