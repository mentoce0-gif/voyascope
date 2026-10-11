// 月の向き（自転）：IAU WGCCRE 2009 の月のモデル（北極の赤経・赤緯と、経度0°の回り具合 W。周期項 E1〜E13 つき）
//   Archinal et al. (2011) "Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2009"
//   Astronomy Engine 本体の RotationAxis(Body.Moon) と同じ式（照合：docs/research/artemis2-lunar-observation-verification.md）
// 座標は J2000 の赤道座標（EME2000・EQJ。ICRF との差は無視できる）。
// アルテミス2号のツアー（scripts/artemis2-trajectory.mjs）と、観測の検証（scripts/artemis2-observations.mjs）で使う。

const DEG = Math.PI / 180;
const TT_MINUS_UTC_MS = 69184; // 2026年：うるう秒 37 秒 ＋ 32.184 秒

// ms（UTC）での月の軸：x＝経度0°・緯度0°、y＝東経90°、z＝北極（すべて単位ベクトル）
export function moonAxes(ms) {
  const d = (ms + TT_MINUS_UTC_MS) / 86400000 + 2440587.5 - 2451545.0, T = d / 36525;
  const E = [
    125.045 - 0.0529921 * d, 250.089 - 0.1059842 * d, 260.008 + 13.0120009 * d, 176.625 + 13.3407154 * d,
    357.529 + 0.9856003 * d, 311.589 + 26.4057084 * d, 134.963 + 13.064993 * d, 276.617 + 0.3287146 * d,
    34.226 + 1.7484877 * d, 15.134 - 0.1589763 * d, 119.743 + 0.0036096 * d, 239.961 + 0.1643573 * d, 25.053 + 12.9590088 * d,
  ].map((x) => x * DEG);
  const s = (k) => Math.sin(E[k - 1]), c = (k) => Math.cos(E[k - 1]);
  const ra = 269.9949 + 0.0031 * T - 3.8787 * s(1) - 0.1204 * s(2) + 0.07 * s(3) - 0.0172 * s(4) + 0.0072 * s(6) - 0.0052 * s(10) + 0.0043 * s(13);
  const dec = 66.5392 + 0.013 * T + 1.5419 * c(1) + 0.0239 * c(2) - 0.0278 * c(3) + 0.0068 * c(4) - 0.0029 * c(6) + 0.0009 * c(7) + 0.0008 * c(10) - 0.0009 * c(13);
  const W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.561 * s(1) + 0.1208 * s(2) - 0.0642 * s(3) + 0.0158 * s(4) + 0.0252 * s(5) - 0.0066 * s(6) - 0.0047 * s(7) - 0.0046 * s(8) + 0.0028 * s(9) + 0.0052 * s(10) + 0.004 * s(11) + 0.0019 * s(12) - 0.0044 * s(13);
  const a = ra * DEG, de = dec * DEG, w = (W % 360) * DEG;
  const z = [Math.cos(de) * Math.cos(a), Math.cos(de) * Math.sin(a), Math.sin(de)];
  const node = [-Math.sin(a), Math.cos(a), 0]; // W を測りはじめる点（ICRF の赤道と月の赤道の交点）
  const q = cross(z, node); // 月の赤道の上で、node から 90° 先
  const x = node.map((v, i) => v * Math.cos(w) + q[i] * Math.sin(w));
  return { x, y: cross(z, x), z, ra, dec, W: ((W % 360) + 360) % 360 };
}

export function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
