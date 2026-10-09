# タスク017：「いってらっしゃい」と「おかえり」のお知らせ

きっかけ：オーナー「『いってらっしゃい』と『おかえり』があった時、更新後最初に開いた時にポップで出したい」（2026-10-07）。

## 決まり（RULES.md に合わせて）

- 出すのは、**打ち上げの成功・無事の帰還を公式の発表で確かめたものだけ**。Claude Code が確かめてから、`curation/` のカードに `greeting` を付ける（自動では出さない）
  - 打ち上げ：`curation/events/` の `kind: "launch"` で、`status` が `done`（出典つき）のもの。`greeting.name`（呼びかける機体の名前。例：MMX）が要る
  - 帰還：`curation/teams/` で、`return_date` が年月日まで公式に出ているもの
  - スキーマ（`schema/common.schema.json` の `greeting`、event・team の `dependentSchemas`）で、この条件を CI で確かめる
- **事故・失敗・亡くなった方に関わるときは付けない**（RULES.md 人物の扱い：ゲーム的な演出から外す）
- 文面は、VOYASCOPE からの呼びかけ（「いってらっしゃい、MMX」「おかえりなさい、Crew-12」）と、出典のある事実（日時・ロケット・人数・どこから）だけ。本人のセリフは作らない。人の名前は出さない（チーム名で呼ぶ）
- 出すのは、出来事の日から `greeting.until`（日本時間のその日の終わり）まで。目安は1週間

## 作ったもの

- `web/js/greetings.js`：いま出すお知らせを選ぶ（`pendingGreetings`）・文面（`greetingHtml`）・見たものの記録（`localStorage` の `voyascope.greeted`。使えない環境では、開くたびに出る）
- `web/index.html`：`<dialog id="greeting">`。「観測を開始」を押して起動画面が消えたころ（0.9秒後）に出す。いくつかあれば1枚にまとめて新しい順に。「×」「閉じる」・背景のクリック・Esc で閉じる
  - 打ち上げは「予定を見る」で、その出来事の詳細を開く
  - 動きを減らす設定（prefers-reduced-motion）では、出てくるときの動きをなくす
- 予定の詳細：終わった（`done`）出来事は「打ち上げ・済み」「終わりました（公式の発表）」と出す（これまでは「打ち上げの予定」「予定の時刻を過ぎました」と出ていた）
- テスト：`tests/greetings.test.mjs`（出す期間・出さない条件・見たもの・文面）、`tests/events.test.mjs`（終わった出来事の詳細）
- 画面：`docs/screenshots/greetings/`（日付を変えた見本のデータで撮ったもの。本番のデータはまだ変えていない）

## 使い方（Claude Code）

1. 打ち上げ：公式の発表（例：JAXA の打ち上げ結果）で成功を確かめる → `curation/events/<id>.json` に `status: { value: "done", source, as_of }` と `greeting: { name, until }`
2. 帰還：公式の発表（例：NASA の着水のブログ）で確かめる → `curation/teams/<id>.json` の `return_date` を年月日に直し、`greeting: { until }`
3. `npm run validate`・`npm test`・`npm run sync:web` → PR
