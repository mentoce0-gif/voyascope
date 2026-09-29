# C1 CelesTrak の利用条件（チャッピー調査・2026-09-29）

> 状態：**Claude Code 確認済み（2026-09-30）**。引用と出典ページの照合結果は `research/verification/2026-09-30.md`。
> 反映前に、オーナーがブラウザで下の3つのURLを開き、引用が載っているかを目で確かめる（または接続できる環境で Claude Code が確かめる）。
> 元の出力に含まれていた ChatGPT の参照タグ（`:chatgpt-content-reference{…}`）は取り除いた。それ以外は受け取ったとおり。

=== VOYASCOPE REPORT ===
from: chappy
task: C1
checked_on: 2026-09-29

## 結論

- CelesTrak は機械取得（M2M）を想定している。GP データは **2時間ごとに更新**され、「1更新につき1回だけ取得」するよう公式に求めているため、GitHub Actions で1日数回の取得はこの範囲に収められる。
- GP の正式な取得形式は `https://celestrak.org/NORAD/elements/gp.php?{QUERY}=VALUE[&FORMAT=VALUE]`。CATNR・INTDES・GROUP・NAME・SPECIAL が利用でき、FORMAT は TLE / 2LE / XML / KVN / JSON / CSV 等。2026-05-09以降の既定形式は CSV。
- 必要なデータだけを、使用するときに取得することが求められる。Active や Starlink など大きなデータセットでは「1更新につき1回」の制限が実際に適用されている。非200応答時は自動取得を停止し、人間に報告することが求められる。
- User-Agent の指定、VOYASCOPE 側で取得データを再配信する場合の現行条件、クレジット表記、非商用ファンサイト固有の条件は、今回確認した現行公式ページでは確認できなかった。
- なお TLE は6桁以上の新しいカタログ番号を扱えないため、CelesTrak は現在 CSV 等の新形式への移行を求めている。

## 根拠

| # | 項目 | 値 | 出典URL | 原文の引用 | 出典の種類 |
|---|---|---|---|---|---|
| 1 | GP取得頻度 | 1更新につき1回。GP更新は2時間ごと | https://celestrak.org/usage-policy.php | "Only download the data you need, when you are going to use it, and only download data once per update. For GP data, updates are once every 2 hours." | 公式 |
| 2 | GP取得頻度の上限運用 | 2時間より頻繁に確認する必要なし | https://celestrak.org/NORAD/documentation/gp-data-formats.php | "CelesTrak only checks for new GP data once every 2 hours, so there is no need for you to check more often." | 公式 |
| 3 | GP取得URL形式 | `https://celestrak.org/NORAD/elements/gp.php?{QUERY}=VALUE[&FORMAT=VALUE]` | https://celestrak.org/NORAD/documentation/gp-data-formats.php | "All GP queries on CelesTrak will take the form: https://celestrak.org/NORAD/elements/gp.php?{QUERY}=VALUE[&FORMAT=VALUE]" | 公式 |
| 4 | クエリ指定 | CATNR / INTDES / GROUP / NAME / SPECIAL | https://celestrak.org/NORAD/documentation/gp-data-formats.php | "where {QUERY} is: CATNR: Catalog Number (1 to 9 digits). Allows return of data for a single catalog number." | 公式 |
| 5 | FORMAT | TLE / 3LE / 2LE / XML / KVN / JSON / JSON-PRETTY / CSV。既定はCSV | https://celestrak.org/NORAD/documentation/gp-data-formats.php | "The FORMAT specification is optional, but defaults to CSV (as of 2026 May 09)." | 公式 |
| 6 | 必要データのみ取得 | 必要なデータだけ取得 | https://celestrak.org/usage-policy.php | "Only download the data you need, when you are going to use it, and only download data once per update." | 公式 |
| 7 | 大規模データセット | Active・Starlink等では取得制限を実施 | https://celestrak.org/usage-policy.php | "Note that we are starting to enforce some of those limits for larger data sets, like the Active list for GP data and the Starlink list for GP & SupGP data." | 公式 |
| 8 | 自動取得時のエラー処理 | 非HTTP 200なら取得停止 | https://celestrak.org/usage-policy.php | "M2M (machine-to-machine) software should immediately stop querying when it receives any non-HTTP 200 responses and report the results to a human for investigation." | 公式 |
| 9 | 403/404時の再試行 | 繰り返し再試行しない | https://celestrak.org/NORAD/documentation/gp-data-formats.php | "If some other response is received, your process should stop and report the problem to a human. In particular, if you receive an HTTP 403 or 404 error, the response is not going to change by repeating the request and can result in your IP address being put in the firewall." | 公式 |
| 10 | キャッシュ | 同一IPを多数ユーザーで使う場合は自前キャッシュを求めている | https://celestrak.org/usage-policy.php | "It is up to those organizations to figure out a way to set up a proxy to cache these queries in a way that doesn't get all of their employees or devices blocked, by caching requests on their end." | 公式 |
| 11 | TLEの現状 | 新規6桁以上の番号ではTLE利用不可 | https://celestrak.org/NORAD/documentation/gp-data-formats.php | "All newly cataloged objects have 6-digit catalog numbers of 100000+ and GP data will not be available for them using the TLE format." | 公式 |
| 12 | 推奨形式変更 | CSV利用への更新を要求 | https://celestrak.org/usage-policy.php | "Users need to update their software to use the CSV formats, which have been available for 6 years now." | 公式 |
| 13 | CelesTrak自身の再配布権限 | Space TrackデータについてCelesTrakには継続的な再配布権限があるとの記載 | https://celestrak.org/NORAD/elements/notice.php | "In addition, CelesTrak has received continuing authority to redistribute Space Track data \"until superseded by formal updated documentation signed out by either the AFSPC/A3 or 14 AF/CC.\"" | 公式 |

## カードJSON

なし

## 未確認

- User-Agent：今回確認した CelesTrak の現行 Usage Policy および GP Data Formats ページに、必須または推奨 User-Agent の指定を確認できなかった
- VOYASCOPEからのGP/TLE再配布：CelesTrak自身が Space Track データを再配布する権限については公式記録を確認できたが、CelesTrakから取得したデータを第三者が自サイト/APIでさらに再配布するときの現行条件は確認できなかった
- 出典表示・クレジット表記：GP/TLEデータ利用時に「CelesTrak」と明記することを義務付ける現行公式条文は、今回開いたページでは確認できなかった
- 非商用ファンサイト固有の条件：非商用利用だけに適用される追加条件・免除条件は確認できなかった
- GitHub Actions 固有の許可：GitHub Actions というサービス名を挙げた許可記述は確認できなかった。M2M取得そのものは公式ポリシー内で明示的に扱われている
- 「まとめて取得すべき」という義務：GROUP クエリと「必要なデータだけ取得」の指示は確認できたが、複数衛星を必ず1リクエストにまとめるという義務までは確認できなかった

## 食い違い・注意

- 「1日数回なら可」という固定回数の規定ではなく、基準は **GPデータの更新1回につき取得1回、更新間隔は2時間**。したがって12回/日を機械的な保証上限と解釈するのではなく、実際に必要なときだけ取得する設計が公式方針に合う。
- CelesTrak は大規模な Active / Starlink データセットで同一更新中の再取得を HTTP 403 により制限している。自動処理で403等を受けた際にリトライを繰り返す設計は避ける必要がある。
- 2007年の System Notices にある再配布権限は **CelesTrak自身がSpace Track由来データを再配布する権限**についての記録であり、VOYASCOPEのような第三者への再々配布許可を意味するとは確認できない。
- 2026-07-11に5桁カタログ番号を使い切ったため、新規6桁以上の物体ではTLEが利用できない。VOYASCOPEを長期運用するなら、TLEのみを前提にせず CSV / JSON / OMM 系を扱える設計が必要になる。

=== END ===

---

## Claude Code のメモ（2026-09-29）

### Phase 1（自動取得）への影響

| 論点 | 判断 | 理由 |
|---|---|---|
| Actions で定期取得してよいか | **進めてよい見込み** | M2M 取得は想定内。基準は「2時間ごとの更新1回につき取得1回まで」 |
| 取得頻度 | 案：**6時間ごと**（1日4回） | SGP4 の精度は数日単位で落ちるので、ISS なら1日数回で十分。上限（2時間ごと）より余裕を持たせる |
| 取得対象 | `CATNR=25544` の1機だけ（Phase 2 で機体を増やすときも、必要な CATNR だけ） | 「必要なデータだけ」。Active 全体などの大きなセットは取らない |
| エラー時 | 200 以外なら**再試行せずにジョブを失敗させる**（＝GitHub からオーナーにメール通知） | 「止めて人間に報告」。403/404 の再試行は IP ブロックの原因になる |
| 変化がないとき | エポックが同じならコミットしない | 無駄なコミットを避ける |
| 形式 | **TLE から JSON（OMM）へ移行** | 新しい6桁の番号は TLE で扱えない。satellite.js は `json2satrec` で OMM JSON を読める（同梱済み） |
| User-Agent | `VOYASCOPE (unofficial fan-made; GitHub Actions)` のような名乗りを付ける | 必須ではないが、問い合わせ先が分かる形が礼儀的に無難（これは Claude Code の判断で、公式の要求ではない） |

### まだ決められないこと

- **再配布**：GitHub Pages で公開すると、取得したデータを自分のサイトから配ることになる。第三者が再配布してよいかは C1 では確認できなかった
  - private のあいだ（Pages なし）は問題にならない。**public 化・Pages 公開の前に**はっきりさせる必要がある
  - 次の一手：チャッピーに追加調査（C9）を頼む。それでも分からなければ、CelesTrak に直接問い合わせる（オーナーが判断）
- **クレジット表記**：義務は確認できなかったが、アプリには「軌道データ：CelesTrak」と表示済み。続ける

### 引用の確認（オーナー向け）

ブラウザで開き、ページ内検索で引用の一部を探す。

1. https://celestrak.org/usage-policy.php で「once per update」「non-HTTP 200」を検索
2. https://celestrak.org/NORAD/documentation/gp-data-formats.php で「defaults to CSV」「6-digit catalog numbers」を検索
3. https://celestrak.org/NORAD/elements/notice.php で「continuing authority」を検索
