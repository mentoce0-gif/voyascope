// config/orbits.json の機体の軌道データを CelesTrak から取得し、web/data/orbits/<id>.json に保存する。
// GitHub Actions（.github/workflows/update-orbits.yml）が6時間ごとに実行する。手元では npm run fetch:orbits。
//
// CelesTrak の利用方針（research/chappy/2026-09-29-c1-celestrak-usage.md）に合わせて:
// - 必要な機体だけを、1機につき1回だけ取る
// - 前回の取得から2時間（GP データの更新間隔）たっていなければ取りに行かない
// - 200 以外の応答や、おかしな中身を受けたら、再試行せずにその場で失敗して終わる（人間に知らせる）

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { gpUrl, parseGpResponse, dueForFetch, isNewer, buildRecord } from "./lib/orbits.mjs";

const USER_AGENT = "VOYASCOPE/1.0 (unofficial fan-made project; scheduled GitHub Actions job)";
const OUT_DIR = "web/data/orbits";
const force = process.argv.includes("--force");

const { objects } = JSON.parse(readFileSync("config/orbits.json", "utf8"));
mkdirSync(OUT_DIR, { recursive: true });

for (const { id, norad_id: noradId } of objects) {
  const path = `${OUT_DIR}/${id}.json`;
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;

  if (!force && !dueForFetch(existing)) {
    console.log(`${id}: 前回の取得（${existing.fetched_at}）から2時間たっていないので取得しません`);
    continue;
  }

  const url = gpUrl(noradId);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  const body = await res.text();
  if (res.status !== 200) {
    console.error(`${id}: HTTP ${res.status} を受け取ったので止めます（再試行しません）。`);
    console.error(`URL: ${url}`);
    console.error(`応答の先頭: ${body.slice(0, 200)}`);
    process.exit(1);
  }

  let omm;
  try {
    omm = parseGpResponse(body, noradId);
  } catch (e) {
    console.error(`${id}: 受け取ったデータに問題があるので止めます: ${e.message}`);
    process.exit(1);
  }

  if (!isNewer(existing, omm)) {
    console.log(`${id}: エポック ${omm.EPOCH} は保存済みのもの（${existing.epoch}）より新しくないので、書き換えません`);
    continue;
  }

  const record = buildRecord({ id, noradId, omm, fetchedAt: new Date() });
  writeFileSync(path, JSON.stringify(record, null, 2) + "\n");
  console.log(`${id}: 更新しました（エポック ${record.epoch}）`);
}
