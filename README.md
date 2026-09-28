# VOYASCOPE

**今、宇宙を旅する者たち。**

地球のまわりを飛ぶ衛星・宇宙船・宇宙飛行士の「今」を、観測端末風のゲーム画面で覗くWebアプリです。
中高生が宇宙に興味を持つきっかけになることを目指しています。

> **非公式・ファンメイド作品です。** JAXA、NASA、その他の宇宙機関・運用者とは関係ありません。
> Unofficial fan-made project. Not affiliated with any space agency or operator.

## 公開停止について

このアプリを使った軍事行為、または誰かに被害をもたらす行為が確認された場合は、公開を停止します。
詳しくは [RULES.md](RULES.md) を参照してください。

## 状態

下書き段階です。最初の目標は Phase 0（ISS 1機のバーティカルスライス）です。

| Phase | 内容 |
|---|---|
| 0 | 地球＋ISS 1機＋キャラカード＋時間早送り（TLEはスナップショット） |
| 1 | GitHub Actions で軌道データを自動更新、打ち上げ予定の表示 |
| 2 | 20機程度に拡張、今夜ISSが見える時刻、軌道線、光の粒表示 |
| 3 | 深宇宙ビュー（JWST・月・火星など） |

## 仕組み（予定）

- 軌道データ：CelesTrak の公開データ（利用条件は確認中）
- 位置計算：ブラウザ内で SGP4（satellite.js）
- 3D表示：globe.gl
- サーバなし：GitHub Pages ＋ GitHub Actions

## ディレクトリ

| パス | 中身 |
|---|---|
| `CLAUDE.md` | Claude Code への作業指示書 |
| `docs/tasks/` | Claude Code へのタスク（番号順） |
| `research/` | 各AIの調査結果・速報（カード化前） |
| `schema/` | カードの形式（出典必須） |
| `curation/` | 手書きのカードデータ（CIで検証） |
| `examples/` | 書き方の見本（出典未確認のため検証では落ちる） |
| `config/` | 実績バッジの条件など |
| `prompts/` | 各AIへの依頼テンプレート |
| `scripts/` | 検証スクリプト |

## 検証

```
npm install
npm run validate            # curation/ を検証
npm run validate:examples   # 見本を検証（出典未確認なのでエラーが出るのが正常）
```

## ライセンス

確定待ちです（[LICENSE_DRAFT.md](LICENSE_DRAFT.md)）。
軌道データ・画像などの権利は、それぞれの提供元に帰属します。
