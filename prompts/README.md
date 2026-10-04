# prompts/

各AIへの依頼文。スマホからでも使えるように、RULES.md の全文を含めた「コピーしてそのまま貼れる」形にしてある。

| ファイル | 相手 | タスク |
|---|---|---|
| `chappy-research.md` | チャッピー（ChatGPT） | C1〜C18：一次ソース調査（出典URL＋原文の引用つき） |
| `grok-news.md` | Grok | G1〜G4：速報（公式URLのあり・なしを区別）。G4 は「次の出来事」の延期・日付の変更 |
| `codex-far-room-visual.md` | Codex（ほかの AI でも可） | 遠くを見る部屋の見た目の試作（1回だけ。Claude Code の試作と同じ条件で比べる。事実は依頼文の固定データだけを使わせる） |
| `codex-far-room-models.md` | Codex | 遠くを見る部屋の探査機の模型（10機ぶん・9つ）。three.js のコードで形を作る。公式の3Dファイルは使わない（C18 の結果、2026-10-04） |

## 使い方

1. GitHub でファイルを開き、Raw 表示にして全文をコピーする
2. 新しいチャットに貼り、最後に「今回のタスク：C2」のように**1つだけ**書いて送る（1チャット1タスク）
3. 返ってきた `=== VOYASCOPE REPORT ===` 〜 `=== END ===` を、そのまま Claude Code に貼る
4. Claude Code が `research/chappy/` か `research/grok/` に保存し、出典を確認してからカードに反映する

## 編集するとき

`chappy-research.md`・`grok-news.md`・`codex-far-room-visual.md`・`codex-far-room-models.md` は生成物。`prompts/src/` を直して `npm run build:prompts` を実行する（RULES.md を変えたときも同じ）。
