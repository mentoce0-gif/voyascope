# C9 CelesTrak のデータを自分のサイトで配ってよいか（チャッピー調査・2026-10-01）

> 状態：**Claude Code 確認済み（2026-10-01）**。引用12件はすべて出典ページにそのまま載っていた（照合結果は `research/verification/2026-10-01-c9.md`）。
> ChatGPT の参照タグ（`:chatgpt-content-reference{…}`）と URL の `?utm_source=chatgpt.com` は取り除いた。それ以外は受け取ったとおり。

=== VOYASCOPE REPORT ===
from: chappy
task: C9
checked_on: 2026-10-01

## 結論
- **TLE / OMM そのものは、条件付きで再配布可と判断できる。** Space-Track.org の現行Documentationは、Basic SSA Information の transfer / redistribution について、**適切な出典表示を条件にUSSPACECOMが包括承認済み**と明記している。TLE / OMM は同ページで Basic SSA data に含まれる。
- Space-Track User Agreement の「事前の明示承認なしに第三者へtransferしない」という条文とは矛盾しない。**Basic SSAについては、その「明示承認」をDocumentation上で包括的に与えている**構造と読める。
- CelesTrak自身の現行 Usage Policy / GP documentation では、第三者による再配布を禁止する条項も、独自の再配布ライセンスも確認できなかった。CelesTrakはGPデータをSpace Trackから取得していることを明記している。
- よってVOYASCOPEでは、**CelesTrakから2時間に1回以下で取得 → GitHub Pages側にキャッシュ → ブラウザへ配布**し、「Orbital data: USSPACECOM / Space-Track.org, obtained via CelesTrak」等の出典を明示する構成が、確認した規定に最も沿う。
- ただし、**CelesTrak独自の分類・加工・付加情報まで丸ごとミラーする権利**は現行ページから明示確認できないため、GPのTLE/OMM以外までコピーする場合はCelesTrakへ確認するのが安全。

## 根拠

| # | 項目 | 値 | 出典URL | 原文の引用 | 出典の種類 |
|---|---|---|---|---|---|
| 1 | Space-Track：Basic SSAの再配布 | **包括承認あり。適切なcitationが条件** | [Space-Track Documentation](https://www.space-track.org/documentation) | “USSPACECOM has provided express blanket approval for transfer/redistribution of basic SSA data and services accessed via [www.Space-Track.org](https://www.Space-Track.org) conditioned on appropriate citation.” | 公式 |
| 2 | Space-Track：対象データ | Basic SSAには **TLE / OMM / SATCAT / Decay・Reentry** が含まれる | [Space-Track Documentation](https://www.space-track.org/documentation) | “Basic SSA data are Two-Line Elements (TLEs) and Orbital Mean-element Messages (OMMs)” | 公式 |
| 3 | Space-Track User Agreement | 原則は**事前の明示承認なしのtransfer禁止** | [Space-Track Account / User Agreement](https://www.space-track.org/auth/createAccount) | “The User agrees not to transfer any data or technical information received from this website ... without prior express approval.” | 公式 |
| 4 | User Agreementとの関係 | #3の「prior express approval」に対し、Basic SSAは#1の**blanket approval**が現在公開されている | [Space-Track Documentation](https://www.space-track.org/documentation) | “express blanket approval for transfer/redistribution of basic SSA data” | 公式 |
| 5 | CelesTrak GPの由来 | CelesTrakのGPはSpace Track / 18 SDSから取得 | [CelesTrak GP Data Documentation](https://celestrak.org/NORAD/documentation/gp-data-formats.php) | “CelesTrak—working closely with Space Track—has begun making the GP data available via standard queries” | 公式 |
| 6 | CelesTrakの取得頻度 | GP更新は**2時間に1回**。更新1回につき1度だけ取得するよう要求 | [CelesTrak Usage Policy](https://celestrak.org/usage-policy.php) | “For GP data, updates are once every 2 hours.” | 公式 |
| 7 | CelesTrakの公開方針 | データ等をspace communityへfreeに提供することをミッションとしている | [CelesTrak Home](https://celestrak.org/) | “Our mission remains focused on making data and other resources freely available to the space community” | 公式 |
| 8 | CelesTrak自身の再配布権の履歴 | 2007年時点ではSpace Trackデータを再配布する継続権限を得たとの記録あり。ただし**古い情報なので現行根拠にはしない** | [CelesTrak System Notices](https://celestrak.org/NORAD/elements/notice.php) | “CelesTrak has received continuing authority to redistribute Space Track data” | 公式・旧情報 |
| 9 | 公開利用例：Look4Sat | OSS Androidアプリ。README上でCelesTrak / SatNOGSをデータ提供元として表示 | [Look4Sat GitHub](https://github.com/rt-bishop/Look4Sat) | “Thanks to Celestrak and SatNOGS you have access to over 9000 active satellites.” | OSS公開事例 |
| 10 | 公開利用例：NASA SVS | 使用データセットとしてCelesTrakを明示 | [NASA Scientific Visualization Studio](https://svs.gsfc.nasa.gov/4662) | “CelesTrak Spacecraft Orbit Ephemeris” | 公式・公開事例 |
| 11 | CelesTrak問い合わせ先 | **TS.Kelso@celestrak.org** が公式トップページに掲載 | [CelesTrak Home](https://celestrak.org/) | “Dr. T.S. Kelso [TS.Kelso@celestrak.org]” | 公式 |
| 12 | Space-Track問い合わせ先 | データ・再配布等はSpace Force窓口あり | [Space-Track Documentation / Contact Us](https://www.space-track.org/documentation) | “For permission to redistribute space-track data ... please submit an Orbital Data Request.” | 公式 |

## カードJSON
```json
なし
```

## 未確認
- **CelesTrak独自の「再配布ライセンス」**：現行の About / Usage Policy / GP documentation / GP data pages を確認した範囲では、「第三者はCelesTrakから取得したデータを自由に再配布できる」「CelesTrakを必ず表記せよ」といった包括的ライセンス文言は確認できなかった。
- **「CelesTrak → VOYASCOPE → 不特定多数」という二次再配布を名指ししたSpace-Track文言**：確認できなかった。ただし現行Space-Track DocumentationはBasic SSAについて “blanket approval for transfer/redistribution” としており、CelesTrak経由だけを除外する記述も確認できなかった。
- **“appropriate citation” の指定フォーマット**：今回確認したSpace-Track Documentationでは、「appropriate citation」が必要とは書かれているが、TLE/OMM再配布時の固定文言までは確認できなかった。

## 食い違い・注意
- Space-TrackのUser Agreementだけ読むと「第三者へのtransfer禁止」に見えるが、現行Documentationには**Basic SSA限定の包括的なexpress approval**が別途掲載されている。したがって、TLE/OMMについては「禁止」ではなく**citation付き再配布承認済み**と読むのが整合的。
- この包括承認は **Basic SSA** の話であり、CDM、個別に提供された高度なSSAサービス、非公開情報等まで同じ扱いとは確認できない。VOYASCOPEでは**公開GPのTLE/OMMに限定**するのが安全。
- CelesTrakの旧System Noticeには個別の再配布承認履歴があるが、2005～2007年の制度なので、現在の可否判断は**2026年現在のSpace-Track Documentationのblanket approvalを優先**した。
- GitHub Pagesにキャッシュを置く方式は、各閲覧者が直接CelesTrakへアクセスするよりも、CelesTrakの「更新ごとに1回だけ取得」というUsage Policyに適合させやすい。**更新間隔は2時間以上**にするのが妥当。
- VOYASCOPE用の出典表示は、最低限 **「Orbital data: USSPACECOM / Space-Track.org — obtained via CelesTrak」** のように、元データと取得元の両方を表示する構成が無難。これはSpace-Trackのcitation条件と、公開利用例でCelesTrakを明示している慣行の両方を満たす方向の実装案であり、指定された公式定型文ではない。

=== END ===
