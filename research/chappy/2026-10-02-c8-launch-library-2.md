# C8 打ち上げ予定データ（Launch Library 2）の利用条件（チャッピー調査・2026-10-02）

> 状態：**Claude Code 確認済み（2026-10-02）**。引用18件のうち16件は出典ページにそのまま載っていた（太字・リンクなどの書式の違いだけ）。Patreon の2件はページが開けず未確認（照合結果は `research/verification/2026-10-02-c8.md`）。
> 受け取ったときに見出しの記号（##）と表の区切りが消えていたので、見出しと表の形だけ直した。中身は受け取ったとおり。

=== VOYASCOPE REPORT ===
from: chappy
task: C8
checked_on: 2026-10-02

## 結論
- Launch Library 2（LL2）は無料で利用できるが、認証なしの本番APIは 15 calls/hour。The Space Devs はキャッシュを強く推奨し、利用者のブラウザからAPIへ直接アクセスさせる運用を避けるよう案内している。GitHub Actions で数時間ごとに1回取得する方式は、この方針と整合する。
- APIキーを使うと無料枠より高いレートにでき、Patreon がその入手手段として案内されている。ただし、2026-10-02時点で公開ページから各有料階層の具体的な毎時上限値までは確認できなかった。
- データは「自由に使い、作成したものを共有してよい」と明記されている一方、付加価値なしでそのまま転送することは控えるよう要請されている。したがって VOYASCOPE のように加工・表示する利用は条文上許容されるが、LL2 JSON の単純ミラー公開は避けるのが安全。
- 出典表示は必須ではなく「encouraged and appreciated」。決められた定型文は確認できなかった。LL2 は宇宙機関の公式APIそのものではなく、The Space Devs の librarian による大量の手動更新と自動化を組み合わせて維持されており、100%の正確性は保証されない。
- 問い合わせ先は公式に support@thespacedevs.com と Discord が案内されている。再配布方法に不安が残る場合、とくに GitHub Pages 上へ加工済みJSONを恒常配信する設計は事前確認すると確実。

## 根拠
| # | 項目 | 値 | 出典URL | 原文の引用 | 出典の種類 |
|---|---|---|---|---|---|
| 1 | 無料枠 | 15 calls/hour | https://github.com/TheSpaceDevs/Tutorials/blob/main/faqs/faq_TSD.md | "access to Launch Library 2, our most popular and therefore most expensive API, is limited to 15 calls per hour." | 公式 |
| 2 | 現在のAPIスロットル値 | 15 requests / 3600 sec | https://ll.thespacedevs.com/2.2.0/api-throttle/?format=api | "\"your_request_limit\": 15, \"limit_frequency_secs\": 3600" | 公式 |
| 3 | キャッシュ推奨 | クライアント直アクセスを避け、サーバ側等でキャッシュ | https://github.com/TheSpaceDevs/Tutorials/blob/main/faqs/faq_TSD.md | "we heavily encourage you to cache the output on your side and avoid having user clients query TSD APIs directly." | 公式 |
| 4 | 開発用API | rate limitなし・ただしデータは古い | https://github.com/TheSpaceDevs/Tutorials/blob/main/faqs/faq_TSD.md | "a development API is available with no rate limiting but stale data" | 公式 |
| 5 | 開発用APIの用途 | lldev は development only | https://github.com/TheSpaceDevs/Tutorials/blob/main/tutorials/getting_started_LL2/README.md | "the development API lldev will be used in this tutorial, however this should only by used for development." | 公式 |
| 6 | 有料・高レート枠 | API key により無料枠より高いrate limit | https://github.com/TheSpaceDevs/Tutorials/blob/main/faqs/faq_TSD.md | "it is possible to increase this limit by using an API key" | 公式 |
| 7 | APIキーと資金提供 | Patreon subscription で高いアクセスレートを利用可能 | https://github.com/TheSpaceDevs/Tutorials/blob/main/faqs/faq_TSD.md | "The Patreon subscriptions are also a way to access the Launch Library 2 API at higher rates than at the free tier." | 公式 |
| 8 | データ利用・共有 | 利用・加工・作成物の共有可 | https://github.com/TheSpaceDevs/Tutorials/blob/main/faqs/faq_TSD.md | "You are free to use the data in any way, shape, or form, and share what you create with it." | 公式 |
| 9 | 生データ再配布 | 付加価値なしの転送は控えるよう要請 | https://github.com/TheSpaceDevs/Tutorials/blob/main/faqs/faq_TSD.md | "Please refrain from forwarding it without adding value." | 公式 |
| 10 | 出典表示 | 必須ではない。推奨 | https://github.com/TheSpaceDevs/Tutorials/blob/main/faqs/faq_TSD.md | "Attribution is not mandatory, but is encouraged and appreciated." | 公式 |
| 11 | 精度保証 | 100%の正確性は保証されない | https://github.com/TheSpaceDevs/Tutorials/blob/main/faqs/faq_TSD.md | "we cannot however guarantee a 100% accuracy of all the information provided." | 公式 |
| 12 | データ維持主体 | librarian がデータを維持 | https://github.com/TheSpaceDevs/Tutorials/blob/main/faqs/faq_TSD.md | "developers maintain and improve the infrastructure of TSD APIs and services, while librarians maintain the data." | 公式 |
| 13 | 手動更新の割合 | 2025年のlibrarian updates 3,604件中3,255件（90.3%）がmanual | https://www.patreon.com/TheSpaceDevs/posts/2025-recap-to-147165938 | "3604 librarian updates have been created, of which 3255 (90.3%) were manual." | 公式 |
| 14 | 情報源の性質 | 自動化も利用して更新 | https://www.patreon.com/TheSpaceDevs/posts/2025-recap-to-147165938 | "increasing the amount of automation in our processes, always without compromise on data quality and reliability." | 公式 |
| 15 | 日付の確度表現 | TBD は不確実・解釈された情報源に基づく場合がある | https://lldev.thespacedevs.com/2.3.0/launches/05864985-e660-4723-b489-32a78d4b53fc/?format=api | "Current date is a placeholder or rough estimation based on unreliable or interpreted sources." | 公式 |
| 16 | 1レスポンスの最大件数 | limit 最大100 | https://ll.thespacedevs.com/2.3.0/launchers/?format=api | "Use limit to control the number of objects in the response (max 100)" | 公式 |
| 17 | 問い合わせ | Discord または support@thespacedevs.com | https://github.com/TheSpaceDevs/Tutorials/blob/main/faqs/faq_TSD.md | "On the Discord server. By email to support@thespacedevs.com." | 公式 |
| 18 | 商用・非商用 | LL2 Terms of use 本文では利用目的による区別を確認できず | https://github.com/TheSpaceDevs/Tutorials/blob/main/faqs/faq_TSD.md | "By using any service provided by The Space Devs, you agree to the following terms." | 公式 |

## カードJSON
なし

## 未確認
- 有料枠の具体的な上限値：Patreon/API key で無料枠より高いrate limitになることは公式FAQで確認できたが、2026-10-02時点で公開・閲覧できた公式ページから各プランの具体的な「requests/hour」は確認できなかった。
- 商用利用専用の追加条件：公式 Terms of use では商用／非商用を分けた制限を確認できなかった。したがって「商用利用にも無条件で同一条件」とまでは断定しない。
- 定型クレジット文：attribution は推奨されているが、「Data: Launch Library 2 / The Space Devs」のような必須の定型文は確認できなかった。
- 各launchレコードの一次情報源一覧：LL2全体が「各宇宙機関の公式発表のみ」から構成されるとの記述は確認できなかった。公式資料以外を含む具体的なソース選定規則も今回確認できなかった。
- GitHub Pages 上での加工済みJSONの恒常配信を明示的に許可する条文：「share what you create」と「refrain from forwarding it without adding value」は確認できたが、静的JSONキャッシュ／プロキシ／再配信を個別に定義した規則は確認できなかった。

## 食い違い・注意
- VOYASCOPE の想定である「GitHub Actions で数時間ごとに取得 → GitHub Pages からブラウザへ配信」は、15 calls/hour を大きく下回り、公式の「cache the output」「avoid having user clients query TSD APIs directly」という推奨にも合う。
- ただし、GitHub Pages に LL2のレスポンスをほぼそのまま置くだけだと、「Please refrain from forwarding it without adding value.」に抵触する懸念がある。VOYASCOPE用に必要項目へ変換・選別し、UI・説明・独自構造などの付加価値を持たせる方が公式方針に沿う。
- 打ち上げ日は「公式発表と常に一致する保証があるデータ」ではない。LL2自身が100% accuracyを保証しておらず、TBDステータスには「unreliable or interpreted sources」に基づくrough estimationも含まれる。表示時は status、net_precision 等と合わせ、「予定」「TBD」など確度を残すべき。
- 出典表示は義務ではないが、公式は循環参照防止などのため推奨している。VOYASCOPEでは「Launch data: Launch Library 2 — The Space Devs」程度の任意クレジットを付ける運用が公式方針と整合するが、これは必須指定文ではない。
- 本番データ取得には ll.thespacedevs.com を使い、rate limitなしの lldev.thespacedevs.com は古いデータを含む開発用途専用として扱う。

=== END ===
