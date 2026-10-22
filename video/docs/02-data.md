# 2. データ（すべて `curation/` のカードから。出典つき）

動画に出す数字・日付は、`src/facts.ts` が `curation/` の JSON を**直接読み込んで**使う。カードを直せば動画も変わる（手で写さない）。

| 画面での言い方 | 値 | カード | 出典 |
|---|---|---|---|
| ISS の高さ 約400 km | 400 km（NASA は平均約250マイル＝約402 km） | `curation/spacecraft/iss.json` stats.altitude_km | https://www.nasa.gov/learning-resources/for-kids-and-students/what-is-the-international-space-station-grades-5-8/ |
| ISS の速さ 秒速 約7.8 km | 7.8 km/s（時速約28,000 km を秒速に） | 同 stats.speed_km_s | https://www.nasa.gov/missions/station/spot-the-station-frequently-asked-questions/ |
| 約90分で1周 | 90 min（高さで90〜93分） | 同 stats.period_min | https://eol.jsc.nasa.gov/Tools/orbitTutorial.htm |
| ひまわり9号 約35,800 km | 35,800 km（静止位置の高さ。おおよそ） | `curation/spacecraft/himawari-9.json` stats.altitude_km | https://www.data.jma.go.jp/sat_info/himawari/satellite.html |
| ひまわり9号の仕事 | 日本と東アジア・西太平洋の気象を観測 | 同 mission | https://www.data.jma.go.jp/mscweb/ja/general/control.html |
| MMX 打ち上げ 2026-10-20 4:41:03（日本時間） | 2026-10-19T19:41:03Z | `curation/events/mmx-launch.json` when・status | https://www.jaxa.jp/press/2026/10/20261018-1_j.html ／ 打ち上げの確認は JAXA の中継 https://www.youtube.com/watch?v=sZGyK9jfoy4 |
| MMX の分離 5:52ごろ（打ち上げから約1時間11分） | 5:52 ごろ（分の精度。T+ は `≈ 01:11` と出す） | `curation/probes/mmx.json` status.note | https://www.youtube.com/watch?v=sZGyK9jfoy4（JAXA の打上げライブ中継） |
| H3ロケット10号機 | H3ロケット10号機（H3-24L） | 同 vehicle | https://www.jaxa.jp/press/2026/08/files/jaxa20260820-1_01.pdf |
| フォボスの砂を持ち帰る | 火星の衛星フォボスを観測し、表面の砂や岩石を地球に持ち帰る | `curation/probes/mmx.json` mission | https://www.mmx.jaxa.jp/ |
| 2031年度、火星圏からのサンプルリターン | 2031年度に人類初の火星圏からのサンプルリターンをめざす | `curation/events/mmx-launch.json` summary | 打上げ計画書（上の PDF）2.5 |
| ボイジャー1号 打ち上げ 1977-09-05 | 1977-09-05 | `curation/probes/voyager-1.json` launch_date | https://science.nasa.gov/mission/voyager/voyager-1/ |
| 2026-11-18、1光日（約259億 km） | 2026-11-18T10:16:07Z。光で24時間、約259億 km、人工物で初 | `curation/events/voyager-1-one-light-day.json` | https://science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/ |
| 恒星間空間を飛ぶ | 太陽圏の外の「恒星間空間」 | `curation/probes/voyager-1.json` location | https://science.nasa.gov/mission/voyager/voyager-1/ |
| 地球の半径 6,371 km（軌道の比の計算だけ） | 6371.000 km（volumetric mean radius） | `video/src/facts.ts` に定数 | https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html |
| 陸地の形 | Natural Earth 1:110m（パブリックドメイン） | `web/data/land-110m.geojson`（サイトと同じ） | https://www.naturalearthdata.com/ |

検算：光の速さ 299,792.458 km/s × 86,400 s ＝ 25,902,068,371 km ≒ 259億 km（NASA の表記と合う）。

## 使わないと決めたもの

- **MMX の今の距離・速さ**：Horizons の値は「Post-launch trajectory from JAXA」だが、実際の追跡かどうかは確かめていない（handoff.md の「次」）。動画には出さない
- **火星到着の日付**：「2027年度」は公表されているが、日付は仮（route.mjs の330日は仮の値）。航路の図には日付を書かず「模式図」と書く
- **ボイジャー1号の今日の距離**：Horizons は1992年以降は予測の値（カードの note）。NASA の公表している 11/18 の節目だけを使う
- **画像・ロゴ**：機体の写真（NASA など）、JAXA・NASA のロゴ、ESA の画像は使わない（すべて図形で描く。ロゴは VOYASCOPE のものだけ）
