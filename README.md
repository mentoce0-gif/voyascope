# VOYASCOPE

**今、宇宙を旅する者たち。**

地球のまわりを飛ぶ衛星・宇宙船・宇宙飛行士の「今」を、観測端末風のゲーム画面で覗くWebアプリです。
中高生が宇宙に興味を持つきっかけになることを目指しています。

> **非公式・ファンメイド作品です。** JAXA、NASA、その他の宇宙機関・運用者とは関係ありません。
> Unofficial fan-made project. Not affiliated with any space agency or operator.

## 公開ページ

**https://mentoce0-gif.github.io/voyascope/**

## 公開停止について

このアプリを使った軍事行為、または誰かに被害をもたらす行為が確認された場合は、公開を停止します。
詳しくは [RULES.md](RULES.md) を参照してください。

## 状態

開発中です。進み具合と次にやることは **[docs/roadmap.md](docs/roadmap.md)** にまとめています。

| | 内容 | 状態 |
|---|---|---|
| M0 | ISS 1機の試作（地球＋ISS＋カード＋軌道の自動更新） | 完了 |
| M1 | 画面の骨組みと環（低軌道・中軌道・静止軌道） | 完了 |
| M2 | 日本の第一棚（ひまわり・みちびき・だいち・いぶき・ひので） | 完了 |
| M3 | 今夜・頭の上（県を選ぶと ISS の通過が分かる） | 完了 |
| M4 | これから行く（公式の打ち上げ予定1件） | 調査待ち |
| M5 | 通信の帯・世界のネームド・公開準備 | 調査・判断待ち |

見せ方の方針は [docs/sky-families.md](docs/sky-families.md) にあります。

## 仕組み（予定）

- 軌道データ：USSPACECOM／Space-Track.org の公開の軌道要素（GP データ）。CelesTrak から GitHub Actions で6時間ごとに取得し、このサイトから配っている（再配布の条件は `research/verification/2026-10-01-c9.md`）
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
