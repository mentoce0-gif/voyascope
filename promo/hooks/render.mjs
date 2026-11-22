// three.js の冒頭を1コマずつ描いて mp4 にする。
// 使い方：リポジトリの根で python3 -m http.server 8000 を動かしてから
//   node promo/hooks/render.mjs voyager [出力先.mp4] [--sheet]
// ffmpeg と Playwright（Chromium）が要る。30fps・1080×1920・H.264。
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const name = process.argv[2] ?? "voyager";
const out = process.argv[3] ?? `${name}-hook.mp4`;
const FPS = 30;
const dir = mkdtempSync(join(tmpdir(), "hook-"));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
p.on("pageerror", (e) => console.error("pageerror:", e.message));
await p.goto(`http://localhost:8000/promo/hooks/${name}.html?capture`);
await p.waitForFunction(() => window.setT && window.ready);
await p.evaluate(() => window.ready);
const dur = await p.evaluate(() => window.DUR);
const n = Math.round(dur * FPS);
const stage = p.locator("#stage");
for (let i = 0; i < n; i++) {
  await p.evaluate((t) => window.setT(t), i / FPS);
  await stage.screenshot({ path: join(dir, `f${String(i).padStart(4, "0")}.png`) });
}
await b.close();
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", join(dir, "f%04d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", out]);
rmSync(dir, { recursive: true, force: true });
console.log(`${out}（${n} コマ）`);
