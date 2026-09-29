// みちびきの運用状況を内閣府の公式ページから取得し、web/data/status/<id>.json に保存する。
// GitHub Actions（.github/workflows/update-orbits.yml）が軌道データと一緒に6時間ごとに実行する。手元では npm run fetch:status。
//
// - ページは1回だけ取りに行く（みちびきの機体すべてが1ページに載っている）
// - 200 以外の応答や、表が読めないときは、再試行せずに失敗で終わる（人間に知らせる）。前回の記録はそのまま残る
// - 中身が変わったとき、または前回から1日たったときだけ書き換える

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { QZSS_STATUS_URL, parseQzssStatus, buildStatusRecord, shouldWrite } from "./lib/status.mjs";

const USER_AGENT = "VOYASCOPE/1.0 (unofficial fan-made project; scheduled GitHub Actions job)";
const OUT_DIR = "web/data/status";

const { qzss } = JSON.parse(readFileSync("config/status.json", "utf8"));
mkdirSync(OUT_DIR, { recursive: true });

const res = await fetch(QZSS_STATUS_URL, { headers: { "User-Agent": USER_AGENT } });
const html = await res.text();
if (res.status !== 200) {
  console.error(`みちびき運用状況: HTTP ${res.status} を受け取ったので止めます（再試行しません）。`);
  process.exit(1);
}

let parsed;
try {
  parsed = parseQzssStatus(html);
} catch (e) {
  console.error(`みちびき運用状況: ${e.message}`);
  process.exit(1);
}

const now = new Date();
for (const craft of qzss) {
  const path = `${OUT_DIR}/${craft.id}.json`;
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
  let record;
  try {
    record = buildStatusRecord(craft, parsed, now);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  if (!shouldWrite(existing, record)) {
    console.log(`${craft.id}: 変化なし`);
    continue;
  }
  writeFileSync(path, JSON.stringify(record, null, 2) + "\n");
  const down = record.services.filter((s) => !s.ok).map((s) => s.service);
  console.log(`${craft.id}: 更新しました（停止中 ${down.length ? down.join(", ") : "なし"}・お知らせ ${record.notices.length} 件）`);
}
