// ニュース台帳（M13 N0、2026-10-29 オーナー）から、カバー率と新しさを数える
//   台帳は非公開の voyascope-research の research/news-ledger/YYYY-MM.csv（Grok の G5 の報告を Claude Code が照合して書く）
//   カバー率＝日本語で報じられた宇宙のニュースの主題のうち、「一言でわかる」ページ（web/missions/）がある割合
//   新しさ＝ページのあるもののうち、出来事に間に合ったもの（予定の出来事は当日まで、予定にない出来事は翌日まで）に
//          関係するカード（curation/ のカードと、その events）のコミットがある割合
//
// 使い方：node scripts/news-coverage.mjs <台帳.csv> [...]
//
// 台帳の列（1行目は見出し）：
//   date      … ニュースになった日（日本時間 YYYY-MM-DD）
//   topic     … 主題（機体・出来事の名前。報道の書き方のまま）
//   aliases   … 別名（略称・英名など。「|」で区切る。なくてよい）
//   kind      … scheduled（前から予定されていた）/ unscheduled（予定にない：事故・発見・急な延期など）
//   media_url … 報じた日本語の記事（1つ）
//   official_url … 公式の発表（なければ空）
//   page      … VOYASCOPE のページの ID（web/missions/<ID>/）。空なら名前で探す。ないと分かっているものは「-」
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const DAY = 86400000;

// かんたんな CSV（ダブルクオートで囲んだ値の中のカンマ・改行・"" に対応）
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

// 名前のくらべ方：空白・中黒・括弧・全角半角の違いを無視する
export const norm = (s) => s.normalize("NFKC").toLowerCase().replace(/[\s・･()（）「」『』\-ー－]/g, "");

// curation/ のカードから、ページの ID と呼び名の一覧を作る
export function loadPages(root = ROOT) {
  const pages = [];
  for (const dir of ["probes", "spacecraft"]) {
    const d = join(root, "curation", dir);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((f) => f.endsWith(".json"))) {
      const c = JSON.parse(readFileSync(join(d, f), "utf8"));
      const names = [c.id, c.name?.ja, c.name?.en, ...(c.name?.ja?.match(/（(.+?)）/)?.slice(1) ?? []), ...(c.name?.en?.match(/^(\S+)\s*\(/)?.slice(1) ?? [])].filter(Boolean);
      pages.push({ id: c.id, names: names.map(norm), files: [join("curation", dir, f), ...(c.events ?? []).map((e) => join("curation", "events", `${e}.json`))] });
    }
  }
  // カードではなく作るページ（build-summaries.mjs の artemisPage）
  pages.push({ id: "artemis2", names: ["artemis2", "アルテミス2号", "アルテミスii", "artemisii"].map(norm), files: ["web/tour/artemis2/mission.js"] });
  return pages;
}

// 台帳の1行に合うページ。page の列が優先（「-」はないと分かっているもの）、空なら名前・別名で探す
export function matchPage(row, pages) {
  if (row.page === "-") return null;
  if (row.page) return pages.find((p) => p.id === row.page) ?? null;
  const raw = [row.topic, ...(row.aliases ? row.aliases.split("|") : [])].filter(Boolean);
  const keys = raw.map(norm);
  const words = raw.map((k) => k.normalize("NFKC").toLowerCase());
  // 英字だけの名前（ISS・MMX など）は単語として合うときだけ（「mission」の中の「iss」に合わないように）
  const hit = (n) =>
    /^[a-z0-9]+$/.test(n)
      ? words.some((w) => new RegExp(`(^|[^a-z0-9])${n}([^a-z0-9]|$)`).test(w.replace(/[\s\-]/g, "")) || keys.includes(n))
      : keys.some((k) => k === n || (n.length >= 3 && k.includes(n)));
  return pages.find((p) => p.names.some((n) => n && hit(n))) ?? null;
}

// 関係するファイルのコミットの日時（ミリ秒）の一覧
function commitTimes(files, root) {
  try {
    const out = execFileSync("git", ["log", "--format=%cI", "--", ...files], { cwd: root, encoding: "utf8" });
    return out.split("\n").filter(Boolean).map((t) => Date.parse(t));
  } catch {
    return [];
  }
}

// 出来事に間に合ったか。予定の出来事は、その日の30日前〜当日の終わりにコミットがあれば○。
// 予定にない出来事は、その日〜翌日の終わり（24〜48時間）にコミットがあれば○
export function isFresh(row, times) {
  const day = Date.parse(`${row.date}T00:00:00+09:00`);
  if (Number.isNaN(day)) return false;
  const [from, to] = row.kind === "scheduled" ? [day - 30 * DAY, day + DAY] : [day, day + 2 * DAY];
  return times.some((t) => t >= from && t < to);
}

export function coverage(rows, pages, times = (files) => commitTimes(files, ROOT)) {
  const out = rows.map((r) => {
    const page = matchPage(r, pages);
    return { ...r, pageId: page?.id ?? null, fresh: page ? isFresh(r, times(page.files)) : false };
  });
  const covered = out.filter((r) => r.pageId);
  // ページのない主題を、出てきた回数の多い順に（N3 でカードにする候補）
  const missing = new Map();
  for (const r of out.filter((r) => !r.pageId)) missing.set(r.topic, (missing.get(r.topic) ?? 0) + 1);
  return {
    total: out.length,
    covered: covered.length,
    fresh: covered.filter((r) => r.fresh).length,
    rows: out,
    missing: [...missing].sort((a, b) => b[1] - a[1]),
  };
}

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("使い方：node scripts/news-coverage.mjs <台帳.csv> [...]");
    process.exit(2);
  }
  const rows = files.flatMap((f) => parseCsv(readFileSync(f, "utf8")));
  const r = coverage(rows, loadPages());
  console.log(`主題 ${r.total} 件`);
  console.log(`カバー率：${pct(r.covered, r.total)}（ページあり ${r.covered} 件）`);
  console.log(`新しさ：${pct(r.fresh, r.covered)}（間に合った ${r.fresh} 件／ページあり ${r.covered} 件）`);
  console.log("\n| 日付 | 主題 | 予定 | ページ | 間に合った |\n|---|---|---|---|---|");
  for (const x of r.rows) console.log(`| ${x.date} | ${x.topic} | ${x.kind === "scheduled" ? "予定" : "予定外"} | ${x.pageId ?? "なし"} | ${x.pageId ? (x.fresh ? "○" : "×") : "—"} |`);
  if (r.missing.length) {
    console.log("\nページのない主題（多い順。N3 の候補）：");
    for (const [t, n] of r.missing) console.log(`- ${t}（${n}件）`);
  }
}
