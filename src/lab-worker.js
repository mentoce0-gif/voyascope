// 試作の部屋（/lab/）にだけパスワードをかける（2026-10-20 オーナー）。出来事の回数の受け口（/e）もここ（2026-10-28）。
// ほかの道は Worker を通らず、web/ の静的なファイルをそのまま配る（wrangler.jsonc の assets.run_worker_first）。
// パスワードはリポジトリに書かない。Cloudflare の Worker のシークレット LAB_PASSWORD に入れる（未設定のあいだは開かない）。
// ※リポジトリは公開なので、/lab/ のファイルの中身は GitHub では見える。鍵は「公開のサイトで見つからないように」するためのもの

import { EVENT_NAMES } from "../web/js/count.js";

const REALM = "VOYASCOPE lab";

const deny = (status, text, headers = {}) =>
  new Response(text, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", ...headers },
  });

// 長さと中身の比べ方で、どこまで合っているかが時間で漏れないように
function sameText(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function passwordOf(header) {
  const m = /^Basic\s+(.+)$/i.exec(header ?? "");
  if (!m) return null;
  try {
    const raw = new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)));
    const i = raw.indexOf(":");
    return i < 0 ? null : raw.slice(i + 1); // 名前は何でもよい
  } catch {
    return null;
  }
}

// 出来事の回数（web/js/count.js から。2026-10-28 オーナー）：決まった名前だけを、Workers Analytics Engine に名前と時刻だけで記録する。
// IP アドレス・国・端末の情報は記録しない。データセットを用意していない（EVENTS がない）ときは何もしない
export async function countEvent(request, env) {
  if (request.method !== "POST") return deny(405, "POST だけです。", { allow: "POST" });
  if (Number(request.headers.get("content-length") ?? 0) > 64) return deny(413, "長すぎます。");
  const body = await request.text();
  if (body.length > 64) return deny(413, "長すぎます。");
  const name = body.trim();
  if (EVENT_NAMES.has(name)) env.EVENTS?.writeDataPoint({ blobs: [name], indexes: [name] });
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/e") return countEvent(request, env);
    if (pathname === "/lab" || pathname.startsWith("/lab/")) {
      if (!env.LAB_PASSWORD) return deny(503, "試作の部屋は準備中です。");
      const pw = passwordOf(request.headers.get("authorization"));
      if (pw === null || !sameText(pw, env.LAB_PASSWORD)) {
        return deny(401, "パスワードが要ります。", { "www-authenticate": `Basic realm="${REALM}", charset="UTF-8"` });
      }
      const res = await env.ASSETS.fetch(request);
      const out = new Response(res.body, res);
      out.headers.set("cache-control", "no-store");
      out.headers.set("x-robots-tag", "noindex");
      return out;
    }
    return env.ASSETS.fetch(request);
  },
};
