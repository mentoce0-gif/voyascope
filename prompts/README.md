# prompts/

各AIへの依頼文。スマホからでも使えるように、RULES.md の全文を含めた「コピーしてそのまま貼れる」形にしてある。

| ファイル | 相手 | タスク |
|---|---|---|
| `chappy-research.md` | チャッピー（ChatGPT） | C1〜C15：一次ソース調査（出典URL＋原文の引用つき） |
| `grok-news.md` | Grok | G1〜G4：速報（公式URLのあり・なしを区別）。G4 は「次の出来事」の延期・日付の変更 |
| `dots.md` | dots（ChatGPT の常駐エージェント・試行中） | 公式ページの見張り。毎日 `dots-watch.md` を読み、食い違い・新しい発表があったときだけ通知 |
| `dots-watch.md` | dots が毎日読む見張り表 | curation/ の「載せている値」と出典URLの一覧。dots は GitHub の Raw から読む |

## 使い方

1. GitHub でファイルを開き、Raw 表示にして全文をコピーする
2. 新しいチャットに貼り、最後に「今回のタスク：C2」のように**1つだけ**書いて送る（1チャット1タスク）
3. 返ってきた `=== VOYASCOPE REPORT ===` 〜 `=== END ===` を、そのまま Claude Code に貼る
4. Claude Code が `research/chappy/` か `research/grok/` に保存し、出典を確認してからカードに反映する

## dots の使い方（試行中）

1. dots を1体作り、`dots.md` の全文を指示として貼る（最初の1回だけ）
2. dots は毎日 7:00（日本時間）に `dots-watch.md` を GitHub から読んで見張る。何か見つかったときだけ通知が来る
3. 通知の `=== VOYASCOPE REPORT ===` 〜 `=== END ===` を Claude Code に貼る
4. Claude Code が `research/dots/` に保存し、公式ページを開いて確かめてから `curation/` に反映する。反映すると見張り表も新しくなる（main に入った時点で dots が読む表も変わる）

## 編集するとき

`chappy-research.md`・`grok-news.md`・`dots.md`・`dots-watch.md` は生成物。`prompts/src/` を直して `npm run build:prompts` を実行する（RULES.md や curation/ を変えたときも同じ。CI が古くないかを確かめる）。
