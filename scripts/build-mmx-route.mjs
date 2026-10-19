// MMX の「いまどこ」の航路の表（web/mmx/now/route.json）を作る。
// 打ち上げ日の地球と、打ち上げ TOF 日後（仮。公式は「往路1年弱」「火星圏到着 2027年度」まで）の火星の位置（astronomy-engine）を、
// ランベルトの解（2点と飛行時間から軌道を出す）で結ぶ。打ち上げ日時（curation/events/mmx-launch.json）が変わったら作り直す：
//   node scripts/build-mmx-route.mjs
// 地球・火星の位置は計算、到着日は仮なので、画面には「模式図」と書く
import { readFileSync, writeFileSync } from "node:fs";
import { GeoVector, Body, MakeTime } from "../web/vendor/astronomy.min.js";
const MU = 2.959122082855911e-4; // 太陽の重力定数 AU^3/day^2
const EPS = 23.4392911 * Math.PI / 180;
const ecl = (v) => [v.x, v.y * Math.cos(EPS) + v.z * Math.sin(EPS), -v.y * Math.sin(EPS) + v.z * Math.cos(EPS)];
const helio = (body, date) => { const t = MakeTime(date); const s = GeoVector(Body.Sun, t, false); if (body === "Earth") return ecl({ x: -s.x, y: -s.y, z: -s.z }); const b = GeoVector(body, t, false); return ecl({ x: b.x - s.x, y: b.y - s.y, z: b.z - s.z }); };
const add = (a, b) => a.map((x, i) => x + b[i]), sub = (a, b) => a.map((x, i) => x - b[i]), mul = (a, k) => a.map((x) => x * k);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), norm = (a) => Math.sqrt(dot(a, a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const C = (z) => z > 0 ? (1 - Math.cos(Math.sqrt(z))) / z : z < 0 ? (Math.cosh(Math.sqrt(-z)) - 1) / -z : 0.5;
const Sf = (z) => z > 0 ? (Math.sqrt(z) - Math.sin(Math.sqrt(z))) / Math.pow(z, 1.5) : z < 0 ? (Math.sinh(Math.sqrt(-z)) - Math.sqrt(-z)) / Math.pow(-z, 1.5) : 1 / 6;
function lambert(r1v, r2v, tof) { // Curtis 5.2（順行）
  const r1 = norm(r1v), r2 = norm(r2v);
  let dth = Math.acos(dot(r1v, r2v) / (r1 * r2));
  if (cross(r1v, r2v)[2] < 0) dth = 2 * Math.PI - dth;
  const A = Math.sin(dth) * Math.sqrt(r1 * r2 / (1 - Math.cos(dth)));
  const y = (z) => r1 + r2 + A * (z * Sf(z) - 1) / Math.sqrt(C(z));
  const F = (z) => Math.pow(y(z) / C(z), 1.5) * Sf(z) + A * Math.sqrt(y(z)) - Math.sqrt(MU) * tof;
  let lo = -4 * Math.PI * Math.PI, hi = 4 * Math.PI * Math.PI * 0.999;
  while (y(lo) < 0) lo += 0.1;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (F(m) > 0) hi = m; else lo = m; }
  const z = (lo + hi) / 2, yy = y(z);
  const f = 1 - yy / r1, g = A * Math.sqrt(yy / MU), gd = 1 - yy / r2;
  const v1 = mul(sub(r2v, mul(r1v, f)), 1 / g);
  return { v1, dth: dth * 180 / Math.PI };
}
function propagate(r, v, dt) { // 2体の数値積分（RK4、1日を細かく）
  let R = r.slice(), Vv = v.slice(); const h = 0.25; const acc = (p) => mul(p, -MU / Math.pow(norm(p), 3));
  for (let t = 0; t < dt; t += h) {
    const k1v = acc(R), k1r = Vv;
    const k2v = acc(add(R, mul(k1r, h / 2))), k2r = add(Vv, mul(k1v, h / 2));
    const k3v = acc(add(R, mul(k2r, h / 2))), k3r = add(Vv, mul(k2v, h / 2));
    const k4v = acc(add(R, mul(k3r, h))), k4r = add(Vv, mul(k3v, h));
    R = add(R, mul(add(add(k1r, mul(k2r, 2)), add(mul(k3r, 2), k4r)), h / 6));
    Vv = add(Vv, mul(add(add(k1v, mul(k2v, 2)), add(mul(k3v, 2), k4v)), h / 6));
  }
  return [R, Vv];
}
const ev = JSON.parse(readFileSync(new URL("../curation/events/mmx-launch.json", import.meta.url)));
const launch = new Date(ev.when.value.at);
const check = process.argv.includes("--check");
const tofs = check ? [] : [300, 320, 330, 340, 350];
for (const tof of tofs) {
  const arr = new Date(launch.getTime() + tof * 864e5);
  const r1 = helio("Earth", launch), r2 = helio(Body.Mars, arr), L = lambert(r1, r2, tof);
  const vE = sub(helio("Earth", new Date(launch.getTime() + 864e5)), helio("Earth", new Date(launch.getTime() - 864e5))).map((x) => x / 2);
  console.log(tof, arr.toISOString().slice(0, 10), "angle", L.dth.toFixed(1), "vinf km/s", (norm(sub(L.v1, vE)) * 1731.456).toFixed(2));
}
const TOF = 330; // 仮（1年弱）
const arr = new Date(launch.getTime() + TOF * 864e5);
const r1 = helio("Earth", launch), r2 = helio(Body.Mars, arr), L = lambert(r1, r2, TOF);
const pts = []; let st = [r1, L.v1];
for (let d = 0; d <= TOF; d += 2) { pts.push(st[0]); st = propagate(st[0], st[1], 2); }
const orbit = (body, days) => Array.from({ length: 181 }, (_, i) => helio(body, new Date(launch.getTime() + i / 180 * days * 864e5)));
const out = { launch: launch.toISOString(), arrival: arr.toISOString(), tof: TOF, earth: r1, mars: r2, transfer: pts, earthOrbit: orbit("Earth", 365.25), marsOrbit: orbit(Body.Mars, 687) };
if (!check) console.log("end miss AU", norm(sub(pts[pts.length - 1], r2)).toFixed(4));
const file = new URL("../web/mmx/now/route.json", import.meta.url);
if (check) {
  const old = JSON.parse(readFileSync(file, "utf8"));
  if (old.launch !== out.launch) { console.log("web/mmx/now/route.json の打ち上げ日時がカードと違います。node scripts/build-mmx-route.mjs で作り直してください"); process.exit(1); }
  console.log("web/mmx/now/route.json は打ち上げ日時と合っています");
} else {
  writeFileSync(file, JSON.stringify(out));
  console.log("作成: web/mmx/now/route.json");
}
