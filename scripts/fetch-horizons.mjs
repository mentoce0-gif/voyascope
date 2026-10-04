// 探査機の地球からの距離を JPL Horizons から取り、web/data/horizons.json に保存する。
// GitHub Actions（.github/workflows/update-horizons.yml）が週に1回実行する。手元では npm run fetch:horizons。
//
// - 対象は curation/probes で distance.method が "horizons" の探査機（horizons_id が Horizons の番号）
// - 1件ずつ、間をあけて呼ぶ。1回で先の6週間ぶん（1日ごと）をもらう（scripts/lib/horizons.mjs）
// - 200 以外の応答・読めない応答の機体は、再試行しない。前回の表がまだ使えれば残し、最後に失敗で終わって知らせる
// - 出力の version が変わったら、何も書かずに止める（出力の形を確かめてから lib を直す）
// - カードに書いた Horizons の説明の原文（distance.datasheet_quotes。軌道のもとのデータを出した機関など）が説明から消えていたら、
//   表は書いたうえで失敗で終わって知らせる（Claude Code が説明を読み直して、カードを直す）

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { queryUrl, parseHorizons, probeTable, tableStart, tableCovers, VersionError, DAYS, STEP_HOURS } from "./lib/horizons.mjs";

// Fair Use：製品名・版・連絡先を入れた、このアプリだけの User-Agent
const USER_AGENT = "VOYASCOPE/1.0 (unofficial fan-made project; +https://github.com/mentoce0-gif/voyascope)";
const OUT = "web/data/horizons.json";
const WAIT_MS = 3000; // 1件ごとの間（同時に呼ばない）

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cards = readdirSync("curation/probes")
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(join("curation/probes", f), "utf8")))
  .filter((c) => c.distance?.method === "horizons");
const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;

const now = new Date();
const start = tableStart(now);
const probes = {};
const failed = [];
const changed = [];

for (const [i, card] of cards.entries()) {
  if (i) await sleep(WAIT_MS);
  const { horizons_id: command, datasheet_quotes: quotes = [] } = card.distance;
  try {
    const res = await fetch(queryUrl(command, start), { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    const text = await res.text();
    if (res.status !== 200) throw new Error(`HTTP ${res.status} ${text.slice(0, 120)}`);
    const parsed = parseHorizons(JSON.parse(text), { command, quotes });
    probes[card.id] = probeTable(parsed, { downloaded: now, start });
    for (const q of parsed.missingQuotes) changed.push(`${card.id}：説明に「${q}」がありません`);
    console.log(`${card.id}（${command}）：${parsed.km.length} 日ぶん。きょうの距離 約 ${(parsed.km[0] / 1e8).toFixed(2)} 億 km`);
  } catch (e) {
    if (e instanceof VersionError) {
      console.error(e.message);
      process.exit(1); // 何も書かない
    }
    failed.push(`${card.id}（${command}）：${e.message}`);
    const old = existing?.probes?.[card.id];
    if (old && tableCovers(old, now)) probes[card.id] = old; // 前回の表がまだ使えるなら残す
  }
}

if (!Object.keys(probes).length) {
  console.error(`距離の表を1つも取れませんでした。前回のデータをそのまま残します。\n${failed.join("\n")}`);
  process.exit(1);
}

const record = { step_hours: STEP_HOURS, days: DAYS, probes };
// 距離の並び（km）は1行に書く（週ごとの差分が読みやすいように）
const json = JSON.stringify(record, (k, v) => (k === "km" ? `@@${JSON.stringify(v)}@@` : v), 1).replace(/"@@(\[[^\]]*\])@@"/g, "$1");
writeFileSync(OUT, json + "\n");
console.log(`保存しました：${OUT}（${Object.keys(probes).length} 機）`);

if (failed.length) console.error(`取れなかった機体があります（前回の表がまだ使えれば残しました）：\n${failed.join("\n")}`);
if (changed.length) console.error(`Horizons の説明が変わったかもしれません。curation/probes の distance（supplier・note・datasheet_quotes）を確かめてください：\n${changed.join("\n")}`);
if (failed.length || changed.length) process.exit(1);
