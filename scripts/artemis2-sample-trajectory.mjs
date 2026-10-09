// アルテミス2号ツアーの「見本の道のり」を作る（本物の軌道データが届くまでの仮）
// 地球と月の重力だけで、地球のそばから月の裏側をまわって自然に地球へ戻る通り道（自由帰還軌道）を探す。
// 月は円軌道（半径 384,400 km・周期 27.32 日）、平面は月の公転面。ミッションの値は、月にいちばん近づいた高さだけを使う。
// 使い方：node scripts/artemis2-sample-trajectory.mjs > web/tour/artemis2/sample-trajectory.json
const MU_E = 398600.4418; // km^3/s^2
const MU_M = 4902.8;
const R_E = 6371;
const R_M = 1737.4;
const A_M = 384400;
const T_M = 27.321661 * 86400;
const W_M = (2 * Math.PI) / T_M;

const moonAt = (t, th0) => [A_M * Math.cos(th0 + W_M * t), A_M * Math.sin(th0 + W_M * t)];

function accel(t, x, y, th0) {
  const [mx, my] = moonAt(t, th0);
  const r3 = Math.hypot(x, y) ** 3;
  const dx = x - mx, dy = y - my;
  const d3 = Math.hypot(dx, dy) ** 3;
  const m3 = A_M ** 3;
  return [-MU_E * x / r3 - MU_M * (dx / d3 + mx / m3), -MU_E * y / r3 - MU_M * (dy / d3 + my / m3)];
}

// 4次のルンゲ＝クッタ（刻みは地球や月のそばで細かく）
function fly(v0, th0, { record = false, tMax = 12 * 86400 } = {}) {
  let t = 0, x = R_E + 185, y = 0, vx = 0, vy = v0;
  let minMoon = Infinity, tMoon = 0, leftEarth = false, retPeri = Infinity, tRet = 0;
  const pts = [];
  let lastRec = -1e9;
  while (t < tMax) {
    const [mx, my] = moonAt(t, th0);
    const rE = Math.hypot(x, y), rM = Math.hypot(x - mx, y - my);
    const h = Math.max(2, Math.min(600, 0.002 * Math.min(rE, rM * 4)));
    if (record && t - lastRec >= 600) {
      pts.push([t, x, y, mx, my]);
      lastRec = t;
    }
    if (rM < minMoon) { minMoon = rM; tMoon = t; }
    if (rE > 100000) leftEarth = true;
    if (leftEarth && rE < retPeri) { retPeri = rE; tRet = t; }
    if (leftEarth && rE < R_E + 120) { if (record) pts.push([t, x, y, mx, my]); break; }
    if (rM < R_M) return { crash: true };
    const f = (tt, X, Y, VX, VY) => { const [ax, ay] = accel(tt, X, Y, th0); return [VX, VY, ax, ay]; };
    const k1 = f(t, x, y, vx, vy);
    const k2 = f(t + h / 2, x + h / 2 * k1[0], y + h / 2 * k1[1], vx + h / 2 * k1[2], vy + h / 2 * k1[3]);
    const k3 = f(t + h / 2, x + h / 2 * k2[0], y + h / 2 * k2[1], vx + h / 2 * k2[2], vy + h / 2 * k2[3]);
    const k4 = f(t + h, x + h * k3[0], y + h * k3[1], vx + h * k3[2], vy + h * k3[3]);
    x += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    y += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    vx += h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    vy += h / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
    t += h;
  }
  return { minMoonAlt: minMoon - R_M, tMoon, retAlt: retPeri - R_E, tRet, t, pts };
}

// 月の裏側を、本物と同じくらいの高さ（月面から 4,067 マイル＝約 6,545 km。NASA 2026-04-11）で通り、地球の大気（高さ 120 km 以下）へ戻る組み合わせを探す
// https://www.nasa.gov/blogs/missions/2026/04/11/artemis-ii-astronauts-back-in-houston-reunite-with-families/
const TARGET_ALT = 6545;
let best = null;
for (let th0 = 1.6; th0 <= 2.4; th0 += 0.01) {
  for (let v0 = 10.84; v0 <= 10.96; v0 += 0.002) {
    const r = fly(v0, th0);
    if (r.crash || !Number.isFinite(r.retAlt)) continue;
    const score = ((r.minMoonAlt - TARGET_ALT) / 2000) ** 2 + (Math.max(0, r.retAlt - 60) / 200) ** 2;
    if (!best || score < best.score) best = { score, v0, th0, ...r };
  }
}
// 細かく
for (let i = 0; i < 400; i++) {
  const v0 = best.v0 + (Math.random() - 0.5) * 0.004, th0 = best.th0 + (Math.random() - 0.5) * 0.02;
  const r = fly(v0, th0);
  if (r.crash || !Number.isFinite(r.retAlt)) continue;
  const score = ((r.minMoonAlt - TARGET_ALT) / 2000) ** 2 + (Math.max(0, r.retAlt - 60) / 200) ** 2;
  if (score < best.score) best = { score, v0, th0, ...r };
}
const rec = fly(best.v0, best.th0, { record: true });
console.error(`v0=${best.v0.toFixed(4)} km/s th0=${best.th0.toFixed(4)} 月の表面から最接近 ${Math.round(rec.minMoonAlt)} km（${(rec.tMoon / 86400).toFixed(2)} 日） 帰りの近地点の高さ ${Math.round(rec.retAlt)} km 全体 ${(rec.t / 86400).toFixed(2)} 日 点 ${rec.pts.length}`);
const r1 = (v) => Math.round(v);
process.stdout.write(
  JSON.stringify({
    $comment: "見本の道のり（本物の軌道データではない）。scripts/artemis2-sample-trajectory.mjs が地球と月の重力だけで計算した自由帰還軌道。単位：秒・km。地球中心、月の公転面（x-y）。月にいちばん近づく高さだけ本物（NASA：4,067 マイル）に合わせた。本物の軌道データを使うかはオーナーが決める",
    sample: true,
    moonClosestAltKm: r1(rec.minMoonAlt),
    durationSec: r1(rec.t),
    points: rec.pts.map(([t, x, y, mx, my]) => [r1(t), r1(x), r1(y), r1(mx), r1(my)]),
  }) + "\n",
);
