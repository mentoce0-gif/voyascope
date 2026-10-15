// X の「今夜使える」投稿の下書き用：アプリと同じ計算（web/js/passes.js）で、県ごとの ISS の見える通過を出す
// 使い方：node .claude/skills/x-post/scripts/tonight.mjs [県名…] [--days 2]
//   県名を省くと 札幌・東京・名古屋・大阪・福岡 の5つ（県の代表地点＝都道府県庁のあたり）
import { readFileSync } from "node:fs";
import { satrecFromOrbit } from "../../../../web/js/orbit.js";
import { findVisiblePasses, observerOf, dir8, heightWord } from "../../../../web/js/passes.js";
import { whenWord, clockWord } from "../../../../web/js/tonight.js";

const web = new URL("../../../../web/", import.meta.url);
const load = (p) => JSON.parse(readFileSync(new URL(p, web), "utf8"));

const args = process.argv.slice(2);
const di = args.indexOf("--days");
const days = di >= 0 ? Number(args.splice(di, 2)[1]) : 2;
const names = args.length ? args : ["北海道", "東京", "愛知", "大阪", "福岡"];

const orbit = load("data/orbits/iss.json");
const satrec = satrecFromOrbit(orbit);
const prefs = load("data/prefectures.json").prefectures;
const now = new Date();
const fetched = new Date(orbit.fetched_at);

console.log(`計算した時刻：${now.toISOString()}（軌道データ取得 ${orbit.fetched_at}、${((now - fetched) / 3600000).toFixed(0)} 時間前）`);
if (now - fetched > 3 * 86400000) console.log("⚠ 軌道データが3日より古い。時刻がずれるので、投稿の前に取り直すか、アプリの画面で確かめる");
for (const name of names) {
  const pref = prefs.find((p) => p.name === name || name.startsWith(p.name));
  if (!pref) { console.log(`- ${name}：県名が見つからない`); continue; }
  const passes = findVisiblePasses(satrec, observerOf(pref), now, { days, limit: 3 });
  if (!passes.length) { console.log(`- ${pref.name}：${days}日のうちに見える通過なし`); continue; }
  for (const p of passes) {
    console.log(`- ${pref.name}：${whenWord(p.start, now)} ${clockWord(p.start)}〜${clockWord(p.end)}  ${dir8(p.startAz)}→${dir8(p.endAz)}  いちばん高いとき ${Math.round(p.maxEl)}°（${heightWord(p.maxEl)}、${dir8(p.maxAz)}）`);
  }
}
