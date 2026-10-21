// スマホの向き（DeviceOrientation）から「背面カメラがどの方角・高さを向いているか」と、
// 空の方向（方位・高度）が画面のどこに来るかを出す。座標は東・北・上（ENU）
const RAD = Math.PI / 180;

// 方位・高度（度）→ 単位ベクトル（東・北・上）
export function enu(az, el) {
  const c = Math.cos(el * RAD);
  return [c * Math.sin(az * RAD), c * Math.cos(az * RAD), Math.sin(el * RAD)];
}
export function azEl([e, n, u]) {
  const az = ((Math.atan2(e, n) / RAD) % 360 + 360) % 360;
  return { az, el: Math.asin(Math.max(-1, Math.min(1, u))) / RAD };
}

// W3C の alpha・beta・gamma（度。alpha は北から反時計回り）→ 端末の座標から ENU への回転（行ごと）
// R = Rz(alpha)·Rx(beta)·Ry(gamma)
export function rotation(alpha, beta, gamma) {
  const [a, b, g] = [alpha * RAD, beta * RAD, gamma * RAD];
  const [ca, sa, cb, sb, cg, sg] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b), Math.cos(g), Math.sin(g)];
  // W3C の地上の座標は x＝東・y＝北・z＝上
  return [
    [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg],
    [sa * cg + ca * sb * sg, ca * cb, sa * sg - ca * sb * cg],
    [-cb * sg, sb, cb * cg],
  ];
}
const mul = (R, v) => R.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const mulT = (R, v) => [0, 1, 2].map((i) => R[0][i] * v[0] + R[1][i] * v[1] + R[2][i] * v[2]);

// 背面カメラの向き（端末の −z）
export const cameraDir = (R) => azEl(mul(R, [0, 0, -1]));

// 空の方向を画面へ。vfov は画面の縦の視野（度）。後ろ側なら behind
export function project(R, az, el, { width, height, vfov = 60 }) {
  const d = mulT(R, enu(az, el)); // 端末の座標：x＝右、y＝上、−z＝カメラの向き
  const f = height / 2 / Math.tan((vfov / 2) * RAD);
  const behind = d[2] >= -1e-6;
  const z = behind ? 1e-6 : -d[2];
  return { x: width / 2 + (d[0] / z) * f, y: height / 2 - (d[1] / z) * f, behind, dx: d[0], dy: d[1] };
}

// 2つの方向のあいだの角度（度）
export function sep(a, b) {
  const [x, y] = [enu(a.az, a.el), enu(b.az, b.el)];
  return Math.acos(Math.max(-1, Math.min(1, x[0] * y[0] + x[1] * y[1] + x[2] * y[2]))) / RAD;
}

// いまの向きから目標へ「右・左／上・下」と角度（ことばの案内に使う）
export function steer(from, to) {
  let daz = ((to.az - from.az + 540) % 360) - 180;
  const del = to.el - from.el;
  return { daz, del, sep: sep(from, to) };
}

// 握りこぶし（腕をのばして約10°）で高さを言う
export function fists(el) {
  const n = Math.round(Math.max(0, el) / 10);
  return n <= 0 ? "地平線すれすれ" : n >= 8 ? "ほぼ頭の真上" : `握りこぶし${n}個ぶん`;
}

// 端末の向きのイベントを、北を基準にした alpha にそろえる
// Android：deviceorientationabsolute の alpha がそのまま使える
// iPhone：webkitCompassHeading（北から時計回り）を使い、alpha との差を覚えておく
export function absoluteAlpha(ev, state) {
  if (typeof ev.webkitCompassHeading === "number" && !Number.isNaN(ev.webkitCompassHeading)) {
    const off = (((360 - ev.webkitCompassHeading - ev.alpha) % 360) + 360) % 360;
    // 揺れをならす（角度の平均は単位円の上で）
    const k = state.off == null ? 1 : 0.15;
    const px = (state.ox ?? Math.cos(off * RAD)) * (1 - k) + Math.cos(off * RAD) * k;
    const py = (state.oy ?? Math.sin(off * RAD)) * (1 - k) + Math.sin(off * RAD) * k;
    state.ox = px;
    state.oy = py;
    state.off = Math.atan2(py, px) / RAD;
    return ev.alpha + state.off;
  }
  if (ev.absolute || ev.type === "deviceorientationabsolute") return ev.alpha;
  return null; // 北が分からない
}
