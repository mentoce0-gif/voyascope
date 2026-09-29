// 軌道データ（CelesTrak の GP データ）を扱うための関数。取得スクリプトとテストで使う。

import { json2satrec, propagate } from "../../web/vendor/satellite.min.js";

export const CELESTRAK_GP = "https://celestrak.org/NORAD/elements/gp.php";
// CelesTrak の GP データは2時間ごとに更新される。これより短い間隔では取りに行かない
export const MIN_INTERVAL_MS = 2 * 60 * 60 * 1000;

export const gpUrl = (noradId) => `${CELESTRAK_GP}?CATNR=${noradId}&FORMAT=JSON`;

const NUMERIC_FIELDS = [
  "MEAN_MOTION",
  "ECCENTRICITY",
  "INCLINATION",
  "RA_OF_ASC_NODE",
  "ARG_OF_PERICENTER",
  "MEAN_ANOMALY",
  "BSTAR",
  "MEAN_MOTION_DOT",
  "MEAN_MOTION_DDOT",
];

export const epochIso = (omm) => new Date(omm.EPOCH.endsWith("Z") ? omm.EPOCH : `${omm.EPOCH}Z`).toISOString();

// CelesTrak の応答（JSON 配列）を検査して、1機分の OMM を返す。おかしければ例外
export function parseGpResponse(body, noradId) {
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`JSON として読めません（先頭: ${String(body).slice(0, 80)}）`);
  }
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error(`1件だけのはずが ${Array.isArray(data) ? data.length : "配列でない"} 件でした`);
  }
  const omm = data[0];
  if (Number(omm.NORAD_CAT_ID) !== noradId) {
    throw new Error(`NORAD 番号が違います（期待 ${noradId}、受信 ${omm.NORAD_CAT_ID}）`);
  }
  if (typeof omm.EPOCH !== "string" || Number.isNaN(Date.parse(omm.EPOCH.endsWith("Z") ? omm.EPOCH : `${omm.EPOCH}Z`))) {
    throw new Error(`EPOCH が読めません（${omm.EPOCH}）`);
  }
  for (const f of NUMERIC_FIELDS) {
    if (!Number.isFinite(Number(omm[f]))) throw new Error(`${f} が数値ではありません（${omm[f]}）`);
  }
  // 実際に SGP4 で計算できるか
  const satrec = json2satrec(omm);
  const pv = propagate(satrec, new Date(epochIso(omm)));
  if (satrec.error || !pv?.position || typeof pv.position === "boolean") {
    throw new Error("SGP4 で位置を計算できません");
  }
  return omm;
}

// 取りに行ってよいか（前回から2時間たったか）
export function dueForFetch(existing, now = new Date()) {
  if (!existing?.fetched_at) return true;
  return now - new Date(existing.fetched_at) >= MIN_INTERVAL_MS;
}

// 書き換えるべきか（エポックが新しくなったか）
export function isNewer(existing, omm) {
  if (!existing?.epoch) return true;
  return new Date(epochIso(omm)) > new Date(existing.epoch);
}

export function buildRecord({ id, noradId, omm, fetchedAt }) {
  return {
    $comment: "CelesTrak の GP データ（OMM JSON）。scripts/fetch-orbits.mjs が自動で更新する。手で編集しない。",
    id,
    norad_id: noradId,
    name: omm.OBJECT_NAME,
    format: "omm",
    epoch: epochIso(omm),
    source: gpUrl(noradId),
    fetched_at: fetchedAt.toISOString(),
    omm,
  };
}
