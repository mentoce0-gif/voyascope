// ISS の軌道データ（TLE）を CelesTrak から1回だけ取得して web/data/iss-tle.json に保存する。
// Phase 0 では手動で1回だけ実行する（自動取得は、CelesTrak の利用条件を確認してから Phase 1 で行う）。
// 使い方: npm run fetch:tle

import { writeFileSync } from "node:fs";

const NORAD_ID = 25544;
const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${NORAD_ID}&FORMAT=tle`;
const out = "web/data/iss-tle.json";

// TLE の各行の末尾はチェックサム（数字の合計＋「-」を1として数え、10で割った余り）
function checksumOk(line) {
  let sum = 0;
  for (const ch of line.slice(0, 68)) {
    if (ch >= "0" && ch <= "9") sum += Number(ch);
    else if (ch === "-") sum += 1;
  }
  return sum % 10 === Number(line[68]);
}

// TLE のエポック（YYDDD.DDDDDDDD）を ISO 形式に変換する
function epochToIso(line1) {
  const yy = Number(line1.slice(18, 20));
  const day = Number(line1.slice(20, 32));
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  return new Date(Date.UTC(year, 0, 1) + (day - 1) * 86400000).toISOString();
}

const res = await fetch(url, { headers: { "User-Agent": "VOYASCOPE (unofficial fan-made, manual one-time fetch)" } });
if (!res.ok) throw new Error(`取得に失敗しました: HTTP ${res.status}`);
const lines = (await res.text()).split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
if (lines.length !== 3 || !lines[1].startsWith("1 ") || !lines[2].startsWith("2 ")) {
  throw new Error(`TLE の形式ではありません:\n${lines.join("\n")}`);
}
const [name, line1, line2] = lines;
if (!checksumOk(line1) || !checksumOk(line2)) throw new Error("TLE のチェックサムが合いません");
if (Number(line1.slice(2, 7)) !== NORAD_ID) throw new Error("NORAD 番号が ISS ではありません");

const data = {
  $comment: "CelesTrak から手動で1回だけ取得した ISS の軌道データ（TLE）。Phase 0 用のスナップショット。",
  name: name.trim(),
  norad_id: NORAD_ID,
  line1,
  line2,
  epoch: epochToIso(line1),
  source: url,
  fetched_at: new Date().toISOString(),
};
writeFileSync(out, JSON.stringify(data, null, 2) + "\n");
console.log(`保存しました: ${out}`);
console.log(`  取得日時: ${data.fetched_at}`);
console.log(`  エポック（軌道データの基準時刻）: ${data.epoch}`);
