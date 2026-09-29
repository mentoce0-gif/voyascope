# prompts/

各AIへの依頼文。スマホからでも使えるように、RULES.md の全文を含めた「コピーしてそのまま貼れる」形にしてある。

| ファイル | 相手 | タスク |
|---|---|---|
| `chappy-research.md` | チャッピー（ChatGPT） | C1〜C8：一次ソース調査（出典URL＋原文の引用つき） |
| `grok-news.md` | Grok | G1〜G3：速報（公式URLのあり・なしを区別） |

## 使い方

1. GitHub でファイルを開き、Raw 表示にして全文をコピーする
2. 新しいチャットに貼り、最後に「今回のタスク：C2」のように**1つだけ**書いて送る（1チャット1タスク）
3. 返ってきた `=== VOYASCOPE REPORT ===` 〜 `=== END ===` を、そのまま Claude Code に貼る
4. Claude Code が `research/chappy/` か `research/grok/` に保存し、出典を確認してからカードに反映する

## 編集するとき

`chappy-research.md` と `grok-news.md` は生成物。`prompts/src/` を直して `npm run build:prompts` を実行する（RULES.md を変えたときも同じ）。
