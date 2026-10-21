// アクセスの数え方（2026-10-21 オーナー：案A）。外から来て開かれた回数を、抜き取りなしで数える。
// 残すのは「日（日本時間）・ページの道・来た元の種類・投稿の目印・回数」だけ。
// IP アドレス・端末の情報・Cookie・利用者を見分ける ID は、受け取っても残さない（ルール5）。
// 送るのは各ページの js/count.js。数は D1（binding: STATS）に1日ごとに足す。見るのは /lab/stats/（パスワードつき）

// 来た元のドメイン名 → 種類。名前そのものは残さない（学校の中のページなど、たどれる名前が混ざらないように）
// AI は検索より先に見る（gemini.google.com が google の検索に入らないように）
const SOURCES = [
  ["ai", /(^|\.)(chatgpt\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com)$/],
  ["x", /(^|\.)(t\.co|x\.com|twitter\.com)$/],
  ["search", /(^|\.)(google\.[a-z.]+|bing\.com|search\.yahoo\.co\.jp|yahoo\.co\.jp|search\.yahoo\.com|duckduckgo\.com|ecosia\.org|baidu\.com|naver\.com)$/],
  ["social", /(^|\.)(facebook\.com|instagram\.com|threads\.net|line\.me|discord\.com|reddit\.com|bsky\.app|youtube\.com)$/],
];

export function sourceOf(host) {
  const h = String(host ?? "").toLowerCase();
  if (!h) return "direct";
  for (const [name, re] of SOURCES) if (re.test(h)) return name;
  return "other";
}

// ページの道：数えるのは決まった形だけ（でたらめな道で表が埋まらないように）
export function pathOf(p) {
  const s = String(p ?? "").replace(/index\.html$/, "");
  if (!/^\/[a-z0-9\-/]{0,60}$/.test(s)) return null;
  return s.replace(/\/?$/, "/");
}

// 投稿の目印（?s=x1020 など）。英小文字・数字・ハイフンで24字まで。ほかは目印なし
export function tagOf(t) {
  const s = String(t ?? "").toLowerCase();
  return /^[a-z0-9-]{1,24}$/.test(s) ? s : "";
}

// 日本時間の日付（YYYY-MM-DD）
export const dayOf = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|fetch/i;

const SCHEMA = `CREATE TABLE IF NOT EXISTS visits (
  day TEXT NOT NULL, path TEXT NOT NULL, source TEXT NOT NULL, tag TEXT NOT NULL, n INTEGER NOT NULL,
  PRIMARY KEY (day, path, source, tag))`;
let ready = null;
const table = (db) => (ready ??= db.prepare(SCHEMA).run().catch((e) => ((ready = null), Promise.reject(e))));

const noContent = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

// POST /api/hit：{ p: 道, r: 来た元のドメイン名, s: 目印 }
export async function hit(request, env, now = Date.now()) {
  if (request.method !== "POST") return new Response("POST だけ", { status: 405 });
  if (!env.STATS) return noContent(); // 数える先がまだないあいだは、何もしない
  if (BOT.test(request.headers.get("user-agent") ?? "")) return noContent();
  let body;
  try {
    const text = await request.text();
    if (text.length > 512) return noContent();
    body = JSON.parse(text);
  } catch {
    return noContent();
  }
  const path = pathOf(body?.p);
  const host = String(body?.r ?? "");
  if (!path || host.length > 100 || host === "voyascope.org") return noContent();
  await table(env.STATS);
  await env.STATS.prepare(
    "INSERT INTO visits (day, path, source, tag, n) VALUES (?1, ?2, ?3, ?4, 1) ON CONFLICT (day, path, source, tag) DO UPDATE SET n = n + 1",
  )
    .bind(dayOf(now), path, sourceOf(host), tagOf(body?.s))
    .run();
  return noContent();
}

// GET /lab/stats/data：直近の日数ぶんの行（/lab/ の下なのでパスワードつき）
export async function stats(env, days = 120, now = Date.now()) {
  const json = (o) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  if (!env.STATS) return json({ ready: false, rows: [] });
  await table(env.STATS);
  const { results } = await env.STATS.prepare("SELECT day, path, source, tag, n FROM visits WHERE day >= ?1 ORDER BY day")
    .bind(dayOf(now - days * 86400e3))
    .all();
  return json({ ready: true, today: dayOf(now), rows: results });
}
