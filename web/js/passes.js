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

export const observerOf = (pref) => ({
  latitude: degreesToRadians(pref.lat),
  longitude: degreesToRadians(pref.lng),
  height: 0,
});

function lookAt(observer, eci, gmst) {
  const la = ecfToLookAngles(observer, eciToEcf(eci, gmst));
  return { az: ((la.azimuth * DEG) % 360 + 360) % 360, el: la.elevation * DEG };
}

// ある時刻の、観測地から見た機体と太陽
export function skyAt(satrec, observer, date) {
  const pv = propagate(satrec, date);
  if (!pv?.position || typeof pv.position === "boolean") return null;
  const gmst = gstime(date);
  const sun = sunEci(date);
  const sat = lookAt(observer, pv.position, gmst);
  const sunEl = lookAt(observer, sun, gmst).el;
  return { ...sat, sunEl, sunlit: isSunlit(pv.position, sun) };
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
      if (!cur) cur = { start: new Date(t), startAz: s.az, maxEl: s.el, maxAz: s.az, maxAt: new Date(t), track: [] };
      if (s.el > cur.maxEl) Object.assign(cur, { maxEl: s.el, maxAz: s.az, maxAt: new Date(t) });
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
