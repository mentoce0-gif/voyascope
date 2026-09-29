// 画面の高さの縮尺（比較用。実寸ではない）
// 静止軌道（約36,000 km）を実寸で描くと地球の約5.6倍の半径になり、低軌道との違いが見えなくなる。
// そこで低軌道（〜2,000 km）を広げ、中軌道〜静止軌道を詰めて、3つの環の違いが見えるようにする。
// 値は globe.gl の高さ（地球の半径＝1）。

const LEO_TOP_KM = 2000;
const GEO_KM = 35786;

export function displayAltitude(km) {
  if (!Number.isFinite(km) || km <= 0) return 0.01;
  if (km <= LEO_TOP_KM) return 0.03 + (km / LEO_TOP_KM) * 0.12;
  return 0.15 + ((Math.min(km, GEO_KM * 1.1) - LEO_TOP_KM) / (GEO_KM - LEO_TOP_KM)) * 0.65;
}

// 環3本（docs/sky-families.md の「高度（環）」）
export const RINGS = [
  { id: "leo", label: "低軌道", en: "LEO", range: "約200〜2,000 km", km: 1000, note: "約90分で一周。流れる" },
  { id: "meo", label: "中軌道", en: "MEO", range: "約2,000〜36,000 km", km: 20200, note: "数時間〜半日で一周" },
  { id: "geo", label: "静止軌道", en: "GEO", range: "約36,000 km", km: GEO_KM, note: "地球と同じ速さで回り、止まって見える" },
].map((r) => ({ ...r, alt: displayAltitude(r.km) }));

// 高度から、どの環の仲間かを返す
export function ringOf(km) {
  if (km < LEO_TOP_KM) return "leo";
  if (km < 34000) return "meo";
  return "geo";
}
