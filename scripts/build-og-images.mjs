// X などにリンクを貼ったときのカードの画像（og:image、1200×630）を作る（2026-10-30 オーナー）
//   web/assets/og/home.jpg      … トップ：地球の写真・ロゴ・「今、宇宙を旅する者たち。」・非公式・地球の画像の出典（NASA）
//   web/assets/og/<id>.jpg      … SpaceTips の各ページ：Q1「何？」の図（web/missions/visual.js が描くもの）に、右上のロゴ
// ブラウザで描くので CI では作らない。Claude Code が Playwright で作ってコミットする
// （カードの一言・名前・模型を変えたら、作り直す。build-summaries.mjs は画像があるページだけ og:image を書く）
//
// 使い方：node scripts/build-og-images.mjs [id ...]   （id を省くと、トップとすべてのページ）
//   Playwright は PLAYWRIGHT_DIR（なければ /opt/node-tools/node_modules/）から読む。Chromium は CHROMIUM（なければ Playwright の既定）
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { createRequire } from "node:module";

const ROOT = new URL("..", import.meta.url).pathname;
const WEB = join(ROOT, "web");
const OUT = join(WEB, "assets", "og");
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? "/opt/node-tools/node_modules/");
const { chromium } = require("playwright");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  let p = join(WEB, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!p.startsWith(WEB) || !existsSync(p)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" }).end(readFileSync(p));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const ids = process.argv.slice(2);
const pages = readdirSync(join(WEB, "missions"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(WEB, "missions", d.name, "index.html")) && readFileSync(join(WEB, "missions", d.name, "index.html"), "utf8").includes('id="vis-data"'))
  .map((d) => d.name)
  .filter((id) => !ids.length || ids.includes(id));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM,
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, reducedMotion: "reduce" });
mkdirSync(OUT, { recursive: true });

const FONT = "'Zen Kaku Gothic New', 'Noto Sans CJK JP', 'Hiragino Sans', sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
async function shoot(html, file) {
  await page.setContent(`<!doctype html><meta charset="utf-8"><base href="${BASE}/"><style>body{margin:0}</style>${html}`);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.complete || new Promise((r) => (i.onload = i.onerror = r)))));
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, file), type: "jpeg", quality: 86 });
  console.log(`作成: web/assets/og/${file}`);
}

if (!ids.length || ids.includes("home")) {
  await shoot(
    `<div style="width:1200px;height:630px;position:relative;overflow:hidden;background:#050e1f url(assets/earth/hero-1600.webp) center/cover;font-family:${FONT};color:#eef6f3">
      <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,14,31,.92) 0%,rgba(5,14,31,.6) 45%,rgba(5,14,31,0) 75%)"></div>
      <div style="position:absolute;left:72px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:22px">
        <img src="assets/brand/logo-1200.webp" style="width:560px">
        <div style="font-size:34px;font-weight:700">今、宇宙を旅する者たち。</div>
        <div style="font:600 22px ${MONO};color:#5ef2c2;letter-spacing:.12em">OBS ・ SpaceTips ・ FAR</div>
      </div>
      <div style="position:absolute;left:72px;bottom:36px;font-size:20px;color:#9fb3c8">voyascope.org ・ 非公式のファンメイド作品</div>
      <div style="position:absolute;right:28px;bottom:14px;font-size:14px;color:#9fb3c8">地球の画像：NASA Blue Marble・Black Marble</div>
    </div>`,
    "home.jpg",
  );
}

// SpaceTips：ページを開いて Q1 の図（1280×720。問い・名前・一言・出典・voyascope.org／非公式つき）を取り、高さに合わせて置く
const fig = await browser.newPage({ viewport: { width: 760, height: 900 }, reducedMotion: "reduce" });
for (const id of pages) {
  await fig.goto(`${BASE}/missions/${id}/`);
  await fig.waitForFunction(() => document.querySelector('figure.vis[data-q="1"] canvas'), null, { timeout: 15000 });
  await fig.waitForTimeout(2500); // 地球の画像の読み込み
  const png = await fig.$eval('figure.vis[data-q="1"] canvas', (c) => c.toDataURL("image/png"));
  await shoot(
    `<div style="width:1200px;height:630px;position:relative;overflow:hidden;background:#050e1f">
      <img src="${png}" style="position:absolute;left:40px;top:0;width:1120px;height:630px">
      <div style="position:absolute;inset:0 auto 0 0;width:40px;background:#050e1f"></div>
      <img src="assets/brand/logo-1200.webp" style="position:absolute;right:56px;top:40px;width:300px;opacity:.95">
    </div>`,
    `${id}.jpg`,
  );
}

await browser.close();
server.close();
