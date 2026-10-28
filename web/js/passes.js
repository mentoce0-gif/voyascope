// 今夜・頭の上：県の代表地点から、ISS が見える通過を探す
// 見える条件（sky-families.md「今夜の通過」）：
//   1. 機体が地平線から 10° 以上の高さにある
//   2. 観測地の空が暗い（太陽が地平線の 6° 以上下。市民薄明の終わり）
//   3. 機体に太陽の光が当たっている（地球の影に入っていない）
import { propagate, gstime, eciToEcf, ecfToLookAngles, degreesToRadians } from "../vendor/satellite.min.js";

const EARTH_RADIUS_KM = 6378.137;
const AU_KM = 149597870.7;
const DEG = 180 / Math.PI;
export const MIN_ELEVATION = 10;
export const SUN_BELOW = -6;

// 太陽の位置（地球中心の慣性座標、km）。天文年鑑の簡易式。誤差は 0.01° 程度で、通過予報には十分
export function sunEci(date) {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const L = (280.46 + 0.9856474 * n) / DEG;
  const g = (357.528 + 0.9856003 * n) / DEG;
  const lambda = L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) / DEG;
  const eps = (23.439 - 0.0000004 * n) / DEG;
  const r = (1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g)) * AU_KM;
  return {
    x: r * Math.cos(lambda),
    y: r * Math.cos(eps) * Math.sin(lambda),
    z: r * Math.sin(eps) * Math.sin(lambda),
  };
}

// 機体に日が当たっているか（円柱の影で近似）
export function isSunlit(satEci, sun) {
  const sl = Math.hypot(sun.x, sun.y, sun.z);
  const s = { x: sun.x / sl, y: sun.y / sl, z: sun.z / sl };
  const dot = satEci.x * s.x + satEci.y * s.y + satEci.z * s.z;
  if (dot > 0) return true; // 昼側
  const px = satEci.x - dot * s.x;
  const py = satEci.y - dot * s.y;
  const pz = satEci.z - dot * s.z;
  return Math.hypot(px, py, pz) > EARTH_RADIUS_KM;
}

// 観測地の位置（地球に固定した座標、km。WGS84・高さ0）
function observerEcf({ latitude, longitude }) {
  const f = 1 / 298.257223563;
  const e2 = f * (2 - f);
  const n = EARTH_RADIUS_KM / Math.sqrt(1 - e2 * Math.sin(latitude) ** 2);
  return {
    x: n * Math.cos(latitude) * Math.cos(longitude),
    y: n * Math.cos(latitude) * Math.sin(longitude),
    z: n * (1 - e2) * Math.sin(latitude),
  };
}

// 位相角（機体から見た、太陽と観測地のあいだの角度、ラジアン）。0 は「真後ろから日が当たって満月のよう」
function phaseAngle(satEcf, sunEcf, obsEcf) {
  const a = { x: sunEcf.x - satEcf.x, y: sunEcf.y - satEcf.y, z: sunEcf.z - satEcf.z };
  const b = { x: obsEcf.x - satEcf.x, y: obsEcf.y - satEcf.y, z: obsEcf.z - satEcf.z };
  const c = (a.x * b.x + a.y * b.y + a.z * b.z) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z));
  return Math.acos(Math.max(-1, Math.min(1, c)));
}

// 明るさの指数（等級と同じ向き：小さいほど明るい）。距離 1000 km・位相角 0° を 0 とする相対値で、ISS の等級そのものではない
//   距離の2乗で暗くなる分と、一様に光を散らす球（ランバート球）の欠け方の分だけを見る
export function brightIndex(rangeKm, phase) {
  const f = (Math.sin(phase) + (Math.PI - phase) * Math.cos(phase)) / Math.PI;
  return 5 * Math.log10(rangeKm / 1000) - 2.5 * Math.log10(Math.max(f, 1e-4));
}

// 明るさの目安（3段階）。真上近くを日が正面から当たって通ると「明るい」、低く遠く・横から当たると「暗め」
export function brightWord(index) {
  if (index <= 0.5) return "明るい";
  if (index <= 2) return "ふつう";
  return "暗め";
}

export const observerOf = (pref) => ({
  latitude: degreesToRadians(pref.lat),
  longitude: degreesToRadians(pref.lng),
  height: 0,
});

// ある時刻の、観測地から見た機体と太陽
export function skyAt(satrec, observer, date) {
  const pv = propagate(satrec, date);
  if (!pv?.position || typeof pv.position === "boolean") return null;
  const gmst = gstime(date);
  const sun = sunEci(date);
  const satEcf = eciToEcf(pv.position, gmst);
  const sunEcf = eciToEcf(sun, gmst);
  const la = ecfToLookAngles(observer, satEcf);
  const sunEl = ecfToLookAngles(observer, sunEcf).elevation * DEG;
  return {
    az: ((la.azimuth * DEG) % 360 + 360) % 360,
    el: la.elevation * DEG,
    rangeKm: la.rangeSat,
    phase: phaseAngle(satEcf, sunEcf, observerEcf(observer)),
    sunEl,
    sunlit: isSunlit(pv.position, sun),
  };
}

// 観測地の太陽の高さ（度）
export function sunElevation(observer, date) {
  return ecfToLookAngles(observer, eciToEcf(sunEci(date), gstime(date))).elevation * DEG;
}

// 日の入り・日の出：太陽の上の縁が地平線に重なる高さ（大気で浮き上がって見える分を含む、−0.833°）
const SUN_SET_EL = -0.833;

// 通過が、日の入りから何分後か（夕方〜夜中）、日の出の何分前か（明け方）。1分きざみで探す
export function sunGap(observer, date) {
  const t0 = date.getTime();
  const evening = (date.getUTCHours() + 9) % 24 >= 12; // 日本時間の午後
  for (let m = 1; m <= 16 * 60; m++) {
    const t = new Date(t0 + (evening ? -m : m) * 60000);
    if (sunElevation(observer, t) > SUN_SET_EL) return { kind: evening ? "set" : "rise", minutes: m };
  }
  return null;
}

export function sunGapWord(gap) {
  if (!gap) return "";
  const m = gap.minutes < 120 ? `約${Math.max(5, Math.round(gap.minutes / 5) * 5)}分` : `約${Math.round(gap.minutes / 30) / 2}時間`;
  return gap.kind === "set" ? `日の入りから${m}` : `日の出の${m}前`;
}

export const isVisible = (s) => !!s && s.el >= MIN_ELEVATION && s.sunEl <= SUN_BELOW && s.sunlit;

// start から days 日のあいだの、見える通過を探す（見えている部分だけをまとめる）
export function findVisiblePasses(satrec, observer, start, { days = 5, stepSec = 20, limit = 5 } = {}) {
  const passes = [];
  let cur = null;
  const end = start.getTime() + days * 86400000;
  for (let t = start.getTime(); t <= end && passes.length < limit; t += stepSec * 1000) {
    const s = skyAt(satrec, observer, new Date(t));
    if (isVisible(s)) {
      if (!cur) cur = { start: new Date(t), startAz: s.az, maxEl: s.el, maxAz: s.az, maxAt: new Date(t), bright: Infinity, track: [] };
      if (s.el > cur.maxEl) Object.assign(cur, { maxEl: s.el, maxAz: s.az, maxAt: new Date(t) });
      cur.bright = Math.min(cur.bright, brightIndex(s.rangeKm, s.phase)); // 通過のうち、いちばん明るいとき
      cur.end = new Date(t);
      cur.endAz = s.az;
      cur.track.push({ az: s.az, el: s.el });
    } else if (cur) {
      // 20秒1点だけの「かすった」ものは出さない
      if (cur.track.length >= 3) passes.push(cur);
      cur = null;
    }
  }
  if (cur && cur.track.length >= 3 && passes.length < limit) passes.push(cur);
  return passes;
}

const DIR8 = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
export const dir8 = (az) => DIR8[Math.round((((az % 360) + 360) % 360) / 45) % 8];

export function heightWord(el) {
  if (el >= 60) return "とても高い（ほぼ頭の上）";
  if (el >= 30) return "中くらいの高さ";
  return "低い（地平線の近く）";
}

// 太陽が真上にある地点（緯度・経度、度）。地球の昼と夜の境目を描くのに使う
export function subsolarPoint(date) {
  const ecf = eciToEcf(sunEci(date), gstime(date));
  return { lat: Math.atan2(ecf.z, Math.hypot(ecf.x, ecf.y)) * DEG, lng: Math.atan2(ecf.y, ecf.x) * DEG };
}
