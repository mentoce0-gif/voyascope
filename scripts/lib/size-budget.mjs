// 読み込み量の上限（config/size-budget.json）を確かめるための部品。scripts/check-size.mjs とテストが使う
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, extname, posix } from "node:path";

// 文字のファイルは gzip 後の大きさ（GitHub Pages は gzip で配る）。画像などはそのまま
const TEXT = new Set([".html", ".css", ".js", ".mjs", ".json", ".geojson", ".svg", ".txt", ".md"]);

export function transferSize(file) {
  const buf = readFileSync(file);
  return TEXT.has(extname(file)) ? gzipSync(buf).length : buf.length;
}

// data/craft-index.json が指すファイル（カード・軌道・乗員・運用状況）
function craftIndexFiles(root) {
  const index = JSON.parse(readFileSync(join(root, "data/craft-index.json"), "utf8"));
  return index.craft.flatMap((c) => [c.card, c.orbit, c.crew, c.status]).filter(Boolean);
}

// 型（"js/*.js" のような1階層の * だけ。"@craft-index" も使える）に合うファイルを、root からの相対パスで返す
// 何にも当たらない型は missing に入れる（設定の書き間違いに気づくため）
export function expandFiles(root, patterns) {
  const files = new Set();
  const missing = [];
  for (const p of patterns) {
    if (p === "@craft-index") {
      for (const f of craftIndexFiles(root)) existsSync(join(root, f)) ? files.add(f) : missing.push(f);
      continue;
    }
    if (!p.includes("*")) {
      existsSync(join(root, p)) ? files.add(p) : missing.push(p);
      continue;
    }
    const dir = posix.dirname(p);
    const re = new RegExp(`^${posix.basename(p).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`);
    const names = existsSync(join(root, dir))
      ? readdirSync(join(root, dir)).filter((n) => re.test(n) && statSync(join(root, dir, n)).isFile())
      : [];
    if (!names.length) missing.push(p);
    for (const n of names.sort()) files.add(dir === "." ? n : `${dir}/${n}`);
  }
  return { files: [...files], missing };
}

// root の下のすべてのファイル（相対パス）
export function allFiles(root, dir = "") {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    return e.isDirectory() ? allFiles(root, rel) : [rel];
  });
}

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(1).find((v) => v !== undefined);
const hasAttr = (tag, name) => new RegExp(`\\s${name}(\\s|=|>|/)`, "i").test(tag);

// index.html に、起動を遅らせる読み込みがないか（タスク012で直したことが戻らないように）
// - <script src> は type="module"・async・defer のどれか（ないと、届くまでほかの読み込みが止まる）
// - 外のサイトのスタイルシートは、画面の表示を止めない形（media="print" を onload で all にする）
// - preload に挙げたライブラリは、<link rel="preload" as="script"> で最初に読み始める
export function bootRuleErrors(html, { preload = [] } = {}) {
  const errors = [];
  const page = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript>[\s\S]*?<\/noscript>/gi, "");
  for (const tag of page.match(/<script\b[^>]*>/gi) ?? []) {
    if (!hasAttr(tag, "src")) continue;
    if (attr(tag, "type") === "module" || hasAttr(tag, "async") || hasAttr(tag, "defer")) continue;
    errors.push(`ほかの読み込みを止める ${tag} があります（type="module"・async・defer のどれかを付けるか、js/main.js から読み込む）`);
  }
  const links = page.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of links) {
    if (attr(tag, "rel") !== "stylesheet") continue;
    const href = attr(tag, "href") ?? "";
    if (!/^https?:\/\//.test(href)) continue; // 自分のサイトの CSS は小さく、見た目に要るので止めてよい
    const media = (attr(tag, "media") ?? "all").trim().toLowerCase();
    if (media === "all" || media === "screen") {
      errors.push(`外のサイトのスタイルシート（${href}）が画面の表示を止めます（media="print" onload="this.media='all'" の形で読む）`);
    }
  }
  for (const src of preload) {
    const ok = links.some((tag) => attr(tag, "rel") === "preload" && attr(tag, "href") === src && attr(tag, "as") === "script");
    if (!ok) errors.push(`${src} を <link rel="preload" href="${src}" as="script"> で最初に読み始めていません`);
  }
  return errors;
}
