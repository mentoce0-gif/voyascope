# タスク020：MMX の打ち上げのあと（段取り）

> 2026-10-15 に書いた。打ち上げは 2026-10-20 4:41:03（日本時間）の予定。予備期間は 11/7 まで。
> どれも **JAXA の公式の発表を確かめてから**。推測で「打ち上がった」「分離した」と書かない（RULES.md）。

## 打ち上げの日（10/20）

- 地球の画面のビーコンは自動で動く（`web/js/launch-plan.js`、PR #37）。打ち上げから分離の予定の30分後まで、種子島のピンが光り、予定の詳細に計画の流れを出す
- **延期になったら**：`curation/events/mmx-launch.json` の `when`（と `status`）を公式の発表で直す → `npm run sync:web` → `node scripts/build-summaries.mjs`。
  ビーコンは `LAUNCH_PLANS["mmx-launch"].forAt` と予定の日時がずれると出ない。新しい日の計画（打上げ計画書やお知らせ）が出たら、`forAt` と `steps` の時刻を公式の値で直す（推測で時刻をずらさない）。テストの `forAt` の確認（`tests/launch-plan.test.mjs`）も合わせて通す
- 打ち上げの前後も作業は止めない（2026-10-15 オーナー）。当日は出来事の記録（日時・状態）を公式の発表どおりに直すのを先に

## 打ち上げのあと（成功の発表を確かめてから）

1. **出来事**：`curation/events/mmx-launch.json` を `status: done`（出典つき）に。`greeting`（「いってらっしゃい、MMX」。タスク017）を付ける。期間（`greeting.until`）は目安1週間
2. **カード**：`curation/probes/mmx.json` の `status`・`location`（「いまどこ」の文）・`updated_at` を公式の発表で直す → `npm run validate` → `npm run sync:web` → `node scripts/build-summaries.mjs`（「一言でわかる」ページも直る）
3. **「いまどこ」**（オーナー：表示が毎日進む形）
   - Horizons に MMX が登録されている（"MMX (spacecraft)"、spkid −239。2026-10-13 に確認）。**打ち上げ前のデータは計画の軌道かもしれない**ので、打ち上げのあと、Horizons の説明（datasheet）で「実際の追跡にもとづく軌道か」「データの期間」を読んでから使う
   - `curation/probes/mmx.json` の `distance` を `method: "horizons"`・`horizons_id: "-239"`・`datasheet_quotes`（説明の原文）に。取得は `scripts/fetch-horizons.mjs` が週1回・1件ずつ（**JPL に了承をもらった取り方を変えない**）。1回で先の6週間ぶんを1日ごとにもらうので、表示は毎日進む
   - 遠くを見る部屋の停留所にする（模型はもうある）
4. **① 概要のヒーロー**（10/22〜。アルテミス2号のページと同じ形）：目的・旅程（2027年度 火星圏到着・約3年滞在・2030年度 離脱・2031年度 帰還。C19・C30 で照合済み）・打ち上げの結果 →「旅を見る」。絵は自前の3Dだけ（JAXA の画像は事前の許可が要るので使わない）
5. **X の投稿**：下書きは `voyascope-research` の `research/outreach/2026-10-12-x-mmx-drafts.md`。本番はオーナーが「私口調」を入れて投稿する
6. **C19 をもう一度**（チャッピー）：打ち上げ後の公式発信（MMX 版の「いまの状態」のページ・位置の公開・中継の記録）

## もっと先

- **③ フォボスの地図**（2027年度の火星圏到着に向けて）：形は NASA PDS の Gaskell モデル（ICQ から変換。引用：Gaskell, R.W. (2020). Gaskell Phobos Shape Model V1.0 … https://doi.org/10.26033/xzv5-bw95）。表面は NASA の Viking テクスチャ（NASA/JPL/Solar System Simulator。投影法は未確認）が候補。地名は USGS の 20件（+West の座標なので変換。Kepler Dorsum は保留）。日本語の地名は公式の表記が見つかっていない。着陸地点は到着後に JAXA が決めるので、予想して描かない。照合の記録：`research/verification/2026-10-13-c30.md`
- **④ まとめ**（2031年度の帰還のあと）
