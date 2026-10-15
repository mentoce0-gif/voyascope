// X の素材：打ち上げの日の射場のビーコンが光り出す瞬間を録画する（アプリの時計だけを打ち上げの前に進める）
// 使い方：npx serve -l 5179 web を立ててから
//   node .claude/skills/x-post/scripts/record-launch.mjs http://localhost:5179/ <出力先> 390 844 6 [打ち上げの日時 UTC]
//   → <出力先>/*.webm と、切り出す秒（cut）が出る。ffmpeg -ss <cut> -t 15 で mp4 に
// 撮った画面の日付は「当日」になる。投稿では「当日の画面（時計を進めて撮影）」と書く
// Playwright は環境に入っているもの（/opt/node-tools）。リポジトリの依存には足さない
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
const [,, url, outDir, w, h, lead = "6", at = "2026-10-19T19:41:03Z"] = process.argv;
const LAUNCH = Date.parse(at);
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const vw = Number(w), vh = Number(h);
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, recordVideo: { dir: outDir, size: { width: vw, height: vh } }, locale: "ja-JP", timezoneId: "Asia/Tokyo" });
const t0 = Date.now();
// アプリの時計を「打ち上げの40秒前」に合わせる（Date だけずらす。描画のタイマーは本物）
const off = LAUNCH - 40000 - t0;
await ctx.addInitScript((off) => {
  const RD = Date;
  class FD extends RD { constructor(...a) { super(...(a.length ? a : [RD.now() + off])); } static now() { return RD.now() + off; } }
  globalThis.Date = FD;
}, off);
const page = await ctx.newPage();
await page.goto(url);
await page.locator("#start:not([disabled])").waitFor({ timeout: 60000 });
await page.click("#start");
await page.waitForTimeout(1500);
// 種子島のピンを押して、予定の詳細を開く
const pin = page.locator(".site-marker:not(.is-ref)").filter({ hasText: "種子島" }).first();
await page.getByRole("button", { name: "打ち上げ予定のみ" }).click().catch((e) => console.error("filter", e.message));
await page.waitForTimeout(800);
if (process.env.OPEN !== "0") await pin.evaluate((el) => el.click()).catch((e) => console.error("pin", e.message));
// アプリの時計で打ち上げの lead 秒前になるまで待つ
const appNow = () => Date.now() + off;
const startAt = LAUNCH - Number(lead) * 1000;
if (appNow() > startAt) console.error("遅れた", (appNow() - startAt) / 1000);
await page.waitForTimeout(Math.max(0, startAt - appNow()));
const cut = (Date.now() - t0) / 1000;
await page.waitForTimeout(16000);
await page.screenshot({ path: `${outDir}/end.png` });
await ctx.close(); await browser.close();
console.log(JSON.stringify({ cut }));
