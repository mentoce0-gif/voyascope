// 試作の部屋（/lab/）にだけパスワードをかける（2026-10-20 オーナー）。アクセスを数える /api/hit もここで受ける（src/count.js）。
// ほかの道は Worker を通らず、web/ の静的なファイルをそのまま配る（wrangler.jsonc の assets.run_worker_first）。
// パスワードはリポジトリに書かない。Cloudflare の Worker のシークレット LAB_PASSWORD に入れる（未設定のあいだは開かない）。
// ※リポジトリは公開なので、/lab/ のファイルの中身は GitHub では見える。鍵は「公開のサイトで見つからないように」するためのもの

import { hit, stats } from "./count.js";

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

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    // アクセスを数える（src/count.js。2026-10-21 オーナー）
    if (pathname === "/api/hit") return hit(request, env);
    if (pathname === "/lab" || pathname.startsWith("/lab/")) {
      if (!env.LAB_PASSWORD) return deny(503, "試作の部屋は準備中です。");
      const pw = passwordOf(request.headers.get("authorization"));
      if (pw === null || !sameText(pw, env.LAB_PASSWORD)) {
        return deny(401, "パスワードが要ります。", { "www-authenticate": `Basic realm="${REALM}", charset="UTF-8"` });
      }
      if (pathname === "/lab/stats/data") return stats(env);
      const res = await env.ASSETS.fetch(request);
      const out = new Response(res.body, res);
      out.headers.set("cache-control", "no-store");
      out.headers.set("x-robots-tag", "noindex");
      return out;
    }
    return env.ASSETS.fetch(request);
  },
};
