// 世界の打ち上げ予定（参考）を Launch Library 2（The Space Devs）から取得し、web/data/launches.json に保存する。
// GitHub Actions（.github/workflows/update-orbits.yml）が軌道データと一緒に6時間ごとに実行する。手元では npm run fetch:launches。
//
// - 呼ぶのは1回だけ（無料の上限は1時間に15回。利用者のブラウザからは呼ばない）。本番の ll を使う（lldev は開発用でデータが古い）
// - 200 以外の応答や、形が読めないときは、再試行せずに失敗で終わる。前回のデータはそのまま残る
// - node scripts/fetch-launches.mjs --check-age：前回の取得から STALE_HOURS 以上たっていたら失敗で終わる（取得の失敗が続いたことを知らせる）

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { buildLaunches, ageHours } from "./lib/launches.mjs";

const USER_AGENT = "VOYASCOPE/1.0 (unofficial fan-made project; scheduled GitHub Actions job)";
const OUT = "web/data/launches.json";
// 6時間ごとの取得が続けて失敗したときだけ知らせる（1〜2回の失敗は、次の取得で直ることが多い）
const STALE_HOURS = 36;

const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;

if (process.argv.includes("--check-age")) {
  const h = ageHours(existing, new Date());
  if (h >= STALE_HOURS) {
    console.error(`打ち上げ予定：前回の取得から ${Number.isFinite(h) ? Math.round(h) : "∞"} 時間たっています。取得の失敗が続いています（ログを見てください）。`);
    process.exit(1);
  }
  console.log(`::warning::打ち上げ予定を取得できませんでした。前回のデータ（${Math.round(h)} 時間前）をそのまま使います。`);
  process.exit(0);
}

const config = JSON.parse(readFileSync("config/launches.json", "utf8"));
const res = await fetch(config.url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
const text = await res.text();
if (res.status !== 200) {
  console.error(`打ち上げ予定: HTTP ${res.status} を受け取ったので止めます（再試行しません）。${text.slice(0, 200)}`);
  process.exit(1);
}

let record;
try {
  const result = buildLaunches(JSON.parse(text), config, new Date());
  record = result.record;
  if (result.skipped) console.log(`読めなかった ${result.skipped} 件は入れませんでした（状態・日時の精度が対象外、または項目が足りない）`);
} catch (e) {
  console.error(`打ち上げ予定: ${e.message}`);
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify(record, null, 2) + "\n");
console.log(`打ち上げ予定: ${record.launches.length} 件を保存しました（${config.days_ahead} 日先まで）`);
