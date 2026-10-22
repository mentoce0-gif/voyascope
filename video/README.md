# VOYASCOPE イメージ動画（Remotion）

1920×1080・30fps・86秒（本編80秒＋出典6秒）。音なし。すべてコードで描いている（写真・ロゴ・動画生成 AI は使わない）。
サイト（`web/`）とは別のプロジェクト。公開先（Cloudflare）には入らない（`wrangler.jsonc` の公開は `web/` だけ）。

## なぜ Remotion か

| 候補 | この環境での評価 |
|---|---|
| **Remotion**（採用） | Node 22・ffmpeg・Chromium がそろっている。React の部品で書けて、文字・秒数・数字を1つのファイル（`src/script.ts`）にまとめられる。フレーム番号から絵を決めるので、毎回同じ結果になる |
| HTML/Canvas＋Playwright＋ffmpeg | 同じことはできるが、フレームの送り・音・GIF・プレビュー（Studio）を自前で作ることになる |
| Three.js | 3D の質は高いが、この動画は線画・計器が中心で、ヘッドレスの WebGL は描画が安定しにくい |
| Manim | 入っていない。日本語の組版と配色の調整に手間がかかる |

## 段階ごとの成果物

1. リファレンス分析 → [`docs/01-reference.md`](docs/01-reference.md)
2. データ（すべての数字と出典） → [`docs/02-data.md`](docs/02-data.md)。数字は `src/facts.ts` が `curation/` のカードを直接読む
3. 構成・ストーリーボード → [`docs/03-storyboard.md`](docs/03-storyboard.md)
4. 実装 → `src/`（下の表）
5. レビュー → `npm run stills` で要所の静止画を `out/stills/` に
6. レンダリング → 下の「つくりかた」

| ファイル | 中身 |
|---|---|
| `src/script.ts` | **台本**：ビートごとの秒数・字幕（＝ナレーション案）・表示の時刻・注記・URL |
| `src/facts.ts` | 事実：`curation/` のカードから値と出典 URL を読む。最後の出典画面の一覧もここ |
| `src/theme.ts` | 色（navy / amber / mint）とフォント（Zen Kaku Gothic New・JetBrains Mono） |
| `src/components/ui.tsx` | 背景の星・観測端末の枠・字幕・計器のカウンタ・動きのカーブ |
| `src/components/Globe.tsx` | 線画の地球（正射図法）と軌道の点の計算 |
| `src/scenes/*.tsx` | 各ビート（Now → Near → Depart → Far → Cta → Sources） |
| `src/Root.tsx` | ビートを順につなぐ・区切りの暗転 |

## つくりかた

```
cd video
npm install
npm run studio        # ブラウザでプレビュー（タイムラインで見ながら直せる）
npm run stills        # 要所の静止画 → out/stills/（node scripts/stills.mjs 300 615 で指定のフレームだけ）
npm run render        # 最終の MP4 → out/voyascope-teaser.mp4（H.264）
npm run gif           # プレビューの GIF（Remotion で直接。1/3 のフレーム・40% の大きさ）
```

GIF は、できた MP4 から ffmpeg で作るほうが速くて軽い（約7.7MB）：

```
ffmpeg -i out/voyascope-teaser.mp4 -vf "fps=10,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" out/voyascope-preview.gif
```

X 向けの軽い MP4（目安 8〜10MB）：`ffmpeg -i out/voyascope-teaser.mp4 -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p out/voyascope-x.mp4`

**フォント**：描画のときに Google Fonts から読む（`@remotion/google-fonts`）。ネットにつながっている必要がある。
**ブラウザ**：ふつうは Remotion が自分で用意する。入っている Chrome/Chromium を使うときは：

```
REMOTION_BROWSER=/path/to/chrome REMOTION_CHROME_MODE=chrome-for-testing npm run render
```

（Claude Code のクラウドでは `/opt/pw-browsers/chromium` と `chrome-for-testing`。headless_shell はプロキシの証明書を信頼せず、フォントが読めない）

## 「ここをこうして」の直し方

| 言い方の例 | 直すところ |
|---|---|
| 「◯◯の字幕を△△に」 | `src/script.ts` の該当ビートの `lines[].text` |
| 「ビート3を2秒長く」 | `src/script.ts` の `depart.seconds`（中の `from`/`to` もずらす） |
| 「字幕をもっと早く出して」 | `lines[].from` |
| 「ズームアウトをゆっくりに」 | `near.zoomOut`・`depart.toSolar` の秒 |
| 「色をもっと琥珀に」 | `src/theme.ts` の `C` |
| 「字幕を大きく」 | `src/components/ui.tsx` の `Captions` の `size` |
| 「数字を最新に」 | `curation/` のカードを直す（動画は次のレンダリングで自動で変わる） |
| 「縦長版がほしい」 | `src/Root.tsx` に 1080×1920 の Composition を足して、各場面の座標を作り直す |

## 決まり（RULES.md から）

- 数字は `curation/` のカード（出典つき）からだけ出す。出典は最後の画面に一覧で出す
- 軌道・距離の図は「模式図」と画面に書く（ISS と静止軌道の半径の比だけは本物どおり）
- 人物は出さない。機関のロゴ・写真は使わない。「非公式のファンメイド作品」を締めの画面と出典の画面に書く

## ライセンスについて（オーナーの確認待ち）

- **Remotion**：Remotion License。個人・社員3人までの営利団体・非営利団体は無料（商用も可）、それ以外は Company License が要る（https://github.com/remotion-dev/remotion/blob/main/LICENSE.md）
- **フォント**：Zen Kaku Gothic New・JetBrains Mono とも SIL Open Font License（Google Fonts から描画時に読むだけで、リポジトリには入れていない）
