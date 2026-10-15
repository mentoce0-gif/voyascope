// 「一言でわかる」ページ（web/missions/）を curation/ のカードから作る（2026-10-12 オーナー）
//   人にも、検索・AI にも読めるように、JavaScript を使わない文字だけのページにする
//   一言 ＝ カードの mission（出典つき）。要点もカードの値だけ（新しい事実は書かない）
//   人物（astronauts・teams）は作らない（RULES.md の人物の細則）
//
// 使い方：node scripts/build-summaries.mjs          … web/missions/ と web/sitemap.xml を書く
//         node scripts/build-summaries.mjs --check  … 書かずに、いまのファイルと同じか確かめる（CI）
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MISSION, RESULTS } from "../web/tour/artemis2/mission.js";

const ROOT = new URL("..", import.meta.url).pathname;
const SITE = "https://voyascope.org";
const CHECK = process.argv.includes("--check");

const read = (dir) =>
  readdirSync(join(ROOT, "curation", dir))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(ROOT, "curation", dir, f), "utf8")));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const host = (u) => new URL(u).hostname.replace(/^www\./, "");
const STATUS = { operating: "運用中", standby: "待機中", ended: "運用終了", not_launched: "打ち上げ前" };

// 出典のついた値：配列は「・」でつなぐ。非公開は「非公開（運用者が公表していない）」
const val = (f) => (f.undisclosed ? "非公開（運用者が公表していない）" : Array.isArray(f.value) ? f.value.join("・") : String(f.value));
// 出典のついた値を「値（出典・確認日）」の形に
const cite = (f) => !f.source ? "" : `<span class="src">出典：<a href="${esc(f.source)}" rel="noopener">${esc(host(f.source))}</a> · ${esc(f.as_of)} 確認</span>`;

const CSS = `
:root { color-scheme: dark; --navy: #07142b; --navy2: #0c1f3f; --amber: #ffb547; --mint: #5ef2c2; --text: #eef6f3; --dim: #9fb3c8; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--navy); color: var(--text); font: 16px/1.8 "Zen Kaku Gothic New", system-ui, sans-serif; }
main { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
a { color: var(--mint); }
.brand { font: 700 13px/1 "JetBrains Mono", ui-monospace, monospace; letter-spacing: 0.3em; color: var(--text); text-decoration: none; }
.kicker { color: var(--amber); font: 12px "JetBrains Mono", ui-monospace, monospace; letter-spacing: 0.2em; margin: 40px 0 4px; }
h1 { font-size: clamp(1.8rem, 6vw, 2.6rem); line-height: 1.3; margin: 0; }
.en { color: var(--dim); margin: 4px 0 0; }
.one { font-size: clamp(1.2rem, 4.4vw, 1.5rem); font-weight: 700; line-height: 1.6; margin: 24px 0 6px; padding: 16px 18px; border-left: 3px solid var(--amber); background: var(--navy2); border-radius: 0 12px 12px 0; }
.src { display: block; color: var(--dim); font-size: 12px; }
h2 { font-size: 1.05rem; margin: 36px 0 8px; color: var(--mint); }
dl { margin: 0; display: grid; grid-template-columns: 7.5em 1fr; gap: 10px 14px; }
dt { color: var(--dim); }
dd { margin: 0; }
ul { margin: 0; padding-left: 1.2em; }
.go { display: inline-block; margin-top: 28px; padding: 12px 22px; border-radius: 999px; background: var(--amber); color: #000; font-weight: 700; text-decoration: none; }
.list li { margin: 10px 0; }
.list a { font-weight: 700; }
.list span { display: block; color: var(--dim); font-size: 14px; }
footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.12); color: var(--dim); font-size: 13px; }
@media (max-width: 480px) { dl { grid-template-columns: 1fr; gap: 2px; } dd { margin-bottom: 10px; } }
`;

function page({ path, title, description, body, jsonld }) {
  // リンクは相対で（GitHub Pages では /voyascope/ の下に置かれるため）
  const up = "../".repeat(path.split("/").filter(Boolean).length);
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${SITE}/${path}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${SITE}/${path}">
  <link rel="icon" href="${up}favicon.svg" type="image/svg+xml">
  <style>${CSS}</style>
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<main>
  <a class="brand" href="${up}">VOYASCOPE</a>
${body}
  <footer>
    <p>VOYASCOPE は非公式のファンメイド作品です。宇宙機関・運用者とは関係ありません。</p>
    <p>ここに書いた事実は、それぞれの出典（一次情報）で確かめてください。VOYASCOPE は、公式の発表への入口です。</p>
    <p><a href="${up}missions/">一言でわかる一覧</a> · <a href="${up}">VOYASCOPE を開く</a></p>
  </footer>
</main>
</body>
</html>
`;
}

const ldPage = (name, description, url, dateModified, sameAs = []) => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name,
  description,
  url,
  inLanguage: "ja",
  dateModified,
  isPartOf: { "@type": "WebSite", name: "VOYASCOPE", url: `${SITE}/` },
  about: { "@type": "Thing", name, ...(sameAs.length ? { sameAs } : {}) },
});

// 探査機・地球のまわりの機体
function cardPage(c, group) {
  const path = `missions/${c.id}/`;
  const rows = [];
  rows.push(["運用", `${esc(val(c.operator))}${cite(c.operator)}`]);
  rows.push(["打ち上げ", `${esc(val(c.launch_date))}${c.launch_date.note ? `（${esc(c.launch_date.note)}）` : ""}${cite(c.launch_date)}`]);
  if (c.status) rows.push(["いまの状態", `${esc(STATUS[c.status.value] ?? c.status.value)}${c.status.note ? `。${esc(c.status.note)}` : ""}${cite(c.status)}`]);
  if (c.location) rows.push(["いまどこ", `${esc(val(c.location))}${cite(c.location)}`]);
  const go = group === "probe" ? "VOYASCOPE で見る（遠くを見る部屋）" : "VOYASCOPE で見る（地球のまわり）";
  const body = `
  <p class="kicker">一言で言うと</p>
  <h1>${esc(c.name.ja)}</h1>
  <p class="en">${esc(c.name.en)}</p>
  <p class="one">${esc(c.mission.value)}${cite(c.mission)}</p>
  <h2>要点</h2>
  <dl>
${rows.map(([k, v]) => `    <dt>${k}</dt><dd>${v}</dd>`).join("\n")}
  </dl>
  <h2>公式のページ</h2>
  <ul>
${c.official_links.map((l) => `    <li><a href="${esc(l.url)}" rel="noopener">${esc(l.label)}</a></li>`).join("\n")}
  </ul>
  <a class="go" href="../../">${go}</a>
  <p class="src">VOYASCOPE のカードの最終確認：${esc(c.updated_at)}</p>`;
  return {
    path,
    one: c.mission.value,
    name: c.name.ja,
    html: page({
      path,
      title: `${c.name.ja}を一言で — VOYASCOPE`,
      description: `${c.name.ja}（${c.name.en}）：${c.mission.value}`,
      body,
      jsonld: ldPage(c.name.ja, c.mission.value, `${SITE}/${path}`, c.updated_at, c.official_links.map((l) => l.url)),
    }),
  };
}

// アルテミス2号（カードではなく、ツアーの mission.js から。出典は mission.js のコメント）
function artemisPage() {
  const path = "missions/artemis2/";
  const one = "4人を乗せて月のまわりを飛び、地球へ帰ってきた試験飛行（2026年4月・NASA）";
  const body = `
  <p class="kicker">一言で言うと</p>
  <h1>アルテミス2号</h1>
  <p class="en">Artemis II</p>
  <p class="one">${esc(one)}<span class="src">出典：<a href="${esc(MISSION.links[0].href)}" rel="noopener">NASA の目標の文書</a> · <a href="${esc(RESULTS.source)}" rel="noopener">NASA の飛行後の発表</a></span></p>
  <h2>要点</h2>
  <dl>
    <dt>目的</dt><dd>${esc(MISSION.lead.replace(/^目的：/, ""))}</dd>
    <dt>いつ</dt><dd>${esc(MISSION.log)}</dd>
${MISSION.rows.map((r) => `    <dt>${esc(r.k)}</dt><dd><ul>${r.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></dd>`).join("\n")}
    <dt>結果</dt><dd>${esc(RESULTS.head)}<ul>${RESULTS.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></dd>
  </dl>
  <h2>公式のページ</h2>
  <ul>
${MISSION.links.map((l) => `    <li><a href="${esc(l.href)}" rel="noopener">${esc(l.aria)}</a></li>`).join("\n")}
    <li><a href="${esc(RESULTS.source)}" rel="noopener">NASA の飛行後の発表</a></li>
  </ul>
  <a class="go" href="../../tour/artemis2/">VOYASCOPE で見る（月の旅と月の地図）</a>`;
  return {
    path,
    one,
    name: "アルテミス2号",
    html: page({
      path,
      title: "アルテミス2号を一言で — VOYASCOPE",
      description: `アルテミス2号（Artemis II）：${one}`,
      body,
      jsonld: ldPage("アルテミス2号", one, `${SITE}/${path}`, "2026-10-12", MISSION.links.map((l) => l.href)),
    }),
  };
}

const probes = read("probes").map((c) => cardPage(c, "probe"));
const craft = read("spacecraft").map((c) => cardPage(c, "craft"));
const artemis = artemisPage();

const listItems = (items) => items.map((p) => `    <li><a href="${p.path.replace(/^missions\//, "")}">${esc(p.name)}</a><span>${esc(p.one)}</span></li>`).join("\n");
const indexBody = `
  <p class="kicker">一言でわかる</p>
  <h1>宇宙を旅する者たちを、一言で</h1>
  <p>VOYASCOPE が載せている探査機・人工衛星・ミッションを、一言と要点で。書いてあることには、すべて出典があります。</p>
  <h2>ミッション</h2>
  <ul class="list">
${listItems([artemis])}
  </ul>
  <h2>太陽系を旅する探査機</h2>
  <ul class="list">
${listItems(probes)}
  </ul>
  <h2>地球のまわりの人工衛星・宇宙ステーション</h2>
  <ul class="list">
${listItems(craft)}
  </ul>`;
const index = {
  path: "missions/",
  html: page({
    path: "missions/",
    title: "一言でわかる — VOYASCOPE",
    description: "VOYASCOPE が載せている探査機・人工衛星・ミッションを、一言と要点で。すべて出典つき。",
    body: indexBody,
    jsonld: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "一言でわかる — VOYASCOPE",
      url: `${SITE}/missions/`,
      inLanguage: "ja",
      isPartOf: { "@type": "WebSite", name: "VOYASCOPE", url: `${SITE}/` },
    },
  }),
};

const pages = [index, artemis, ...probes, ...craft];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${["", "tour/artemis2/", ...pages.map((p) => p.path)].map((p) => `  <url><loc>${SITE}/${p}</loc></url>`).join("\n")}
</urlset>
`;

const outputs = [...pages.map((p) => [join(ROOT, "web", p.path, "index.html"), p.html]), [join(ROOT, "web", "sitemap.xml"), sitemap]];
let stale = 0;
for (const [file, text] of outputs) {
  const now = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (now === text) continue;
  if (CHECK) {
    console.error(`古い：${file.replace(ROOT, "")}（node scripts/build-summaries.mjs で作り直す）`);
    stale++;
  } else {
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, text);
    console.log(`作成: ${file.replace(ROOT, "")}`);
  }
}
if (CHECK && stale) process.exit(1);
if (CHECK) console.log(`web/missions/ は最新です（${pages.length} ページ）`);
