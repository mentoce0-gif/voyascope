# C14 探査機の位置データ（JPL Horizons）の利用条件（チャッピー調査・2026-10-03）

> 状態：**Claude Code 確認済み（2026-10-03）**。引用9件はすべて出典ページにそのまま載っていた（照合結果は `research/verification/2026-10-03-c14.md`）。
> 受け取ったときの形のまま保存した。リンクに付いている `oai_citation` の印と `?utm_source=chatgpt.com` は ChatGPT の出力に付いてきたもの（出典ページは、それを外した URL で開ける）。

=== VOYASCOPE REPORT ===
from: chappy
task: C14
checked_on: 2026-10-03

## 結論
- Horizons API は自動取得用として公式に提供されている。ただし SSD API の Fair Use Policy は「APIをWebサイトへ埋め込んではならない」と明記しているため、ブラウザからHorizons APIを直接呼ぶ実装は不可。[oai_citation:0‡SSD/CNEOS API Server](https://ssd-api.jpl.nasa.gov/doc/index.php)
- 「1日1回」の取得を禁止する数値的なレート上限は確認できなかった。自動取得では、必要最小限の要求、キャッシュ、同時リクエスト禁止、失敗時のバックオフ、製品名・バージョン・連絡先入りUser-Agentが要求される。[oai_citation:1‡SSD/CNEOS API Server](https://ssd-api.jpl.nasa.gov/doc/index.php)
- Horizonsから取得した距離をVOYASCOPE側で保存・再配布することについて、自由な再配布を明示的に許可するHorizons固有の条項は確認できなかった。むしろSSD公式FAQは、自サイトへの情報掲載には「yes」として許可が必要との立場を示しているため、公開前にJPL/SSDへ用途を提示して確認するのが必要。[oai_citation:2‡JPL Solar System Dynamics](https://ssd.jpl.nasa.gov/faq.html)
- Horizonsには公式の推奨引用形式があり、「Giorgini, JD and JPL Solar System Dynamics Group, NASA/JPL Horizons On-Line Ephemeris System, …, data retrieved YYYY-MON-DD.」の形が示されている。[oai_citation:3‡JPL Solar System Dynamics](https://ssd.jpl.nasa.gov/horizons/manual.html)
- 探査機軌道にはJPL以外の機関由来データが含まれる。ESA提供軌道の実例は確認できたが、JAXA・ESA等の元データ条件がHorizons出力の再配布にどの範囲で承継されるかは公式資料から確定できず、未確認とする。[oai_citation:4‡JPL Solar System Dynamics](https://ssd.jpl.nasa.gov/horizons/news.html?utm_source=chatgpt.com)

## 根拠
| # | 項目 | 値 | 出典URL | 原文の引用 | 出典の種類 |
|---|---|---|---|---|---|
| 1 | APIによる自動取得 | 自動取得可。ただしWebサイトへのAPI直接埋め込み不可 | [oai_citation:5‡ssd-api.jpl.nasa.gov](https://ssd-api.jpl.nasa.gov/doc/index.php?utm_source=chatgpt.com) | "You may not embed these APIs in your website (per NASA CORS policy)." [oai_citation:6‡SSD/CNEOS API Server](https://ssd-api.jpl.nasa.gov/doc/index.php) | 公式 |
| 2 | 自動取得の頻度・方法 | 必要最小限、キャッシュ、同時要求禁止、バックオフ、専用User-Agentが必要。固定の「1日N回」上限は記載なし | [oai_citation:7‡ssd-api.jpl.nasa.gov](https://ssd-api.jpl.nasa.gov/doc/index.php?utm_source=chatgpt.com) | "You agree to submit only one API request at a time (no simultaneous requests)." [oai_citation:8‡SSD/CNEOS API Server](https://ssd-api.jpl.nasa.gov/doc/index.php) | 公式 |
| 3 | 自サイトへの再掲載 | SSD公式FAQでは許可が必要との回答 | [oai_citation:9‡ssd.jpl.nasa.gov](https://ssd.jpl.nasa.gov/faq.html?utm_source=chatgpt.com) | "The short answer is yes." [oai_citation:10‡JPL Solar System Dynamics](https://ssd.jpl.nasa.gov/faq.html) | 公式 |
| 4 | JPLコンテンツの著作権 | JPL文書は著作権保護対象となる場合があり、複製に許可が必要な場合がある | [oai_citation:11‡jpl.nasa.gov](https://www.jpl.nasa.gov/caltechjpl-privacy-policies-and-important-notices/?utm_source=chatgpt.com) | "Permission to reproduce may be required." [oai_citation:12‡NASA Jet Propulsion Laboratory](https://www.jpl.nasa.gov/caltechjpl-privacy-policies-and-important-notices/) | 公式 |
| 5 | Horizons推奨引用 | Giorgini, JD and JPL Solar System Dynamics Group, NASA/JPL Horizons On-Line Ephemeris System, data retrieved YYYY-MON-DD | [oai_citation:13‡ssd.jpl.nasa.gov](https://ssd.jpl.nasa.gov/horizons/manual.html?utm_source=chatgpt.com) | "References for the Horizons system:" [oai_citation:14‡JPL Solar System Dynamics](https://ssd.jpl.nasa.gov/horizons/manual.html) | 公式 |
| 6 | 他機関由来の探査機軌道 | ESA等の外部機関が軌道データ源になる | [oai_citation:15‡ssd.jpl.nasa.gov](https://ssd.jpl.nasa.gov/horizons/news.html?utm_source=chatgpt.com) | "The JUICE trajectory in Horizons has been updated with the first post-launch solution from ESA." [oai_citation:16‡JPL Solar System Dynamics](https://ssd.jpl.nasa.gov/horizons/news.html?utm_source=chatgpt.com) | 公式 |
| 7 | NASA以外が原データ提供者の場合 | 元データの出典・利用権を別途確認するようNASAが案内 | [oai_citation:17‡science.data.nasa.gov](https://science.data.nasa.gov/about/license?utm_source=chatgpt.com) | "NASA may not be the original source of data" [oai_citation:18‡Science Data Portal](https://science.data.nasa.gov/about/license) | 公式 |
| 8 | JAXAサイト資料の一般利用条件 | JAXAサイト掲載物は原則JAXA著作物。出典表示等の条件あり | [oai_citation:19‡global.jaxa.jp](https://global.jaxa.jp/policy.html?utm_source=chatgpt.com) | "When you use the Materials on the Site, you are requested to indicate their source" [oai_citation:20‡JAXA Global](https://global.jaxa.jp/policy.html?utm_source=chatgpt.com) | 公式 |
| 9 | ESAサイト資料の一般利用条件 | ESAサイト資料の再配布・派生利用は一般条件では自由利用ではない | [oai_citation:21‡esa.int](https://www.esa.int/Services/Terms_and_conditions?utm_source=chatgpt.com) | "ESA does not grant the right to resell or redistribute any information" [oai_citation:22‡欧州宇宙機関](https://www.esa.int/Services/Terms_and_conditions?utm_source=chatgpt.com) | 公式 |

## カードJSON
```json
なし
```

## 未確認
- Horizons出力の再配布許可：Horizons APIまたはHorizons Manual内に「取得した数値を第三者サイトから再配布してよい」と明示したライセンス条項は確認できなかった。SSD公式FAQは自サイト掲載について許可が必要との回答をしている。
- 1日1回の具体的レート上限：API Fair Use Policyには固定のrequests/day・requests/minute値は掲載されていない。1日1回そのものを禁止する記述も確認できなかった。
- はやぶさ2の現在のHorizons軌道データについて、JAXAからJPLへ提供された具体的ファイルの利用許諾条件：今回確認したHorizons公式資料では特定できなかった。
- BepiColombo等ESA由来軌道について、ESA→JPL間の提供契約・ライセンスがHorizons利用者へどのように適用されるか：公開されたHorizons資料からは確認できなかった。
- JAXA・ESAの一般Webサイト利用規約が、各機関からJPLへ直接提供されHorizonsで処理された航法データそのものにも適用されるか：確認できなかった。
- Voyager 1・2、JWST、Hayabusa2、BepiColomboそれぞれについて、現在Horizonsが使用している個別軌道ファイルの権利表示・再配布条件：一括して確認できる公開ページは見つからなかった。

## 食い違い・注意
- NASA Science Data Portalでは、一定のNASA主導ミッションデータについてCC0・利用制限なしとする一般方針がある一方、JPL/SSD公式FAQは「自サイトへ情報を掲載するには許可が必要」としている。Horizonsについては後者がより直接的なSSD固有情報であるため、「NASAだから自由再配布可能」と判断しない方がよい。[oai_citation:23‡Science Data Portal](https://science.data.nasa.gov/about/license)
- VOYASCOPEの想定構成なら、ブラウザからHorizons APIを直接呼ぶ方式はFair Use Policyに抵触する。定期処理側で取得・キャッシュする構成はAPI埋め込み禁止を回避できるが、そのキャッシュ値を一般公開する再配布許可は別問題であり、SSD/JPLへの確認が必要。
- Horizonsの探査機軌道はリアルタイムテレメトリではなく、過去区間と予測区間を持つ軌道ファイルであり、外部提供軌道は更新が週次・月次になる場合もある。したがってVOYASCOPEでは「現在位置」ではなく「Horizonsによる推定位置／取得日」を明示する方が資料の性質に合う。[oai_citation:24‡JPL Solar System Dynamics](https://ssd.jpl.nasa.gov/horizons/manual.html)
- 出典表示は、Horizons Manual掲載の推奨形式を基礎に「NASA/JPL Horizons」「data retrieved YYYY-MON-DD」を表示することができる。ただし、出典表示を行うこと自体が再配布許可の代わりになるとは確認できない。[oai_citation:25‡JPL Solar System Dynamics](https://ssd.jpl.nasa.gov/horizons/manual.html)

=== END ===
