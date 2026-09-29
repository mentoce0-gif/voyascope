// みちびきの「衛星運用状況」ページ（内閣府）を読み取る関数。取得スクリプトとテストで使う。
//
// ページ：https://sys.qzss.go.jp/dod/constellation.html
// 利用条件：みちびきウェブサイト利用規約（政府標準利用規約 第2.0版に準拠、CC BY 4.0 互換）。
//   出典を書けば自由に使える。https://qzss.go.jp/policy/rule.html
//
// 読み取るもの
// - 衛星ごと・サービスごとの運用状態（表の行の class と O / X）
// - いま有効な NAQU（サービスを止める予定・止まっているお知らせ）。衛星番号（SVN）で衛星に結びつける

export const QZSS_STATUS_URL = "https://sys.qzss.go.jp/dod/constellation.html";

const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

const decode = (s) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const cells = (rowHtml) => [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => decode(m[1]).trim());

// "08 OCT 2026" と "0959" → ISO（UTC）
function zuluDate(date, time) {
  const m = /^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/.exec(date?.trim() ?? "");
  const t = /^(\d{2})(\d{2})$/.exec(time?.trim() ?? "");
  if (!m || !t || !(m[2] in MONTHS)) return null;
  return new Date(Date.UTC(+m[3], MONTHS[m[2]], +m[1], +t[1], +t[2])).toISOString();
}

// NAQU の種類。末尾が FCST… なら予定された停止、UNUS… なら予期せぬ停止（NAQU情報ページの区分）
export function naquKind(type) {
  const t = String(type ?? "").split("_")[1] ?? "";
  if (t.startsWith("FCST")) return "forecast";
  if (t.startsWith("UNUS")) return "unplanned";
  if (t.startsWith("USAB")) return "resumed";
  return "other";
}

function parseNaqu(text) {
  const field = (name) => new RegExp(`${name}:\\s*([^\\n]+)`).exec(text)?.[1].trim() ?? null;
  const number = /\(NAQU\)\s*(\d+)/.exec(text)?.[1] ?? field("NAQU NUMBER");
  const type = field("NAQU TYPE");
  const svn = field("SVN");
  return {
    number,
    type,
    kind: naquKind(type),
    svn: svn && /^\d+$/.test(svn) ? svn.padStart(3, "0") : null,
    subject: field("SUBJ"),
    start: zuluDate(field("START CALENDAR DATE"), field("START TIME ZULU")),
    stop: zuluDate(field("STOP CALENDAR DATE"), field("STOP TIME ZULU")),
  };
}

// ページ全体を読み取る。読めなければ例外（取得スクリプトはそこで止まる）
export function parseQzssStatus(html) {
  const updated = /Update：\s*<\/font>\s*<\/strong>\s*(\d{4})\/(\d{2})\/(\d{2})/.exec(html);
  const satellites = [];
  let current = null;
  for (const m of html.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/gi)) {
    const cls = /class="([^"]+)"/.exec(m[1])?.[1] ?? null;
    const td = cells(m[2]);
    const head = td.length === 1 && /^(QZS\w+)\s*\(SVN=(\d+)/.exec(td[0]);
    if (head) {
      current = { name: head[1], svn: head[2].padStart(3, "0"), services: [] };
      satellites.push(current);
      continue;
    }
    if (current && cls && td.length === 5 && /^[OX]$/.test(td[3])) {
      current.services.push({
        service: td[0],
        signals: td[1],
        state: cls,
        ok: td[3] === "O",
        naqu: td[4] || null,
      });
    }
  }
  if (!updated) throw new Error("更新日（Update）が見つかりません。ページの形が変わった可能性があります");
  if (satellites.length === 0 || satellites.some((s) => s.services.length === 0)) {
    throw new Error("衛星ごとの運用状況の表が読めません。ページの形が変わった可能性があります");
  }

  // 「EFFECTIVE … NAQUs」の表だけを読む（INFORMATION は全体へのお知らせ）
  const notices = [];
  for (const sec of html.split(/<H4><A name="Naqu">/i).slice(1)) {
    if (!/^EFFECTIVE/i.test(sec)) continue;
    for (const m of sec.matchAll(/<tr>\s*<td>(\d+)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
      notices.push(parseNaqu(decode(m[2])));
    }
  }

  return { pageUpdated: `${updated[1]}-${updated[2]}-${updated[3]}`, satellites, notices };
}

// 1機分の記録。craft は { id, name }（name はページ上の名前。例 "QZS06"）
export function buildStatusRecord({ id, name }, parsed, fetchedAt) {
  const sat = parsed.satellites.find((s) => s.name === name);
  if (!sat) throw new Error(`${id}: ページに ${name} が見つかりません`);
  return {
    $comment: "みちびき 衛星運用状況（内閣府）から scripts/fetch-status.mjs が作る。手で編集しない。",
    id,
    source: QZSS_STATUS_URL,
    source_label: "みちびきウェブサイト「衛星運用状況」",
    page_updated: parsed.pageUpdated,
    fetched_at: fetchedAt.toISOString(),
    name: sat.name,
    svn: sat.svn,
    services: sat.services,
    notices: parsed.notices.filter((n) => n.svn === sat.svn),
  };
}

// 書き換えるべきか。中身が変わったとき、または前回の取得から1日たったとき（古くなっていないことを示すため）
export const REFRESH_MS = 24 * 60 * 60 * 1000;
export function shouldWrite(existing, record) {
  if (!existing) return true;
  const strip = ({ fetched_at, ...rest }) => JSON.stringify(rest);
  if (strip(existing) !== strip(record)) return true;
  return new Date(record.fetched_at) - new Date(existing.fetched_at) >= REFRESH_MS;
}
