// アルテミス2号ツアー：月面の地形の位置と、照準を出す条件（web/tour/artemis2/lunar.js）
// 基準は scripts/artemis2-observations.mjs の計算（docs/research/artemis2-observations.json。NASA の OEM と IAU の月の向きから）
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { moonAxesAt, surfaceDir, latLonOf, observe, gate, TARGETS, R_MOON_KM } from "../web/tour/artemis2/lunar.js";

const traj = JSON.parse(readFileSync(new URL("../web/tour/artemis2/trajectory.json", import.meta.url)));
const obs = JSON.parse(readFileSync(new URL("../docs/research/artemis2-observations.json", import.meta.url)));
const EPOCH = Date.parse(traj.epoch);
const P = traj.points;
const sun = traj.sun;
// 時刻 t の宇宙船と月（点を線でつなぐ。テストには十分）
function stateAt(t) {
  const j = P.findIndex((p) => p[0] >= t), a = P[Math.max(0, j - 1)], b = P[j];
  const u = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
  const lerp = (k) => a[k] + (b[k] - a[k]) * u;
  return { craft: [lerp(1), lerp(2), lerp(3)], moon: [lerp(4), lerp(5), lerp(6)] };
}
const tOf = (iso) => (Date.parse(iso) - EPOCH) / 1000;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} と ${b}`);
const lonDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const orientale = TARGETS.find((x) => x.id === "mare_orientale");

test("月の軸は直交する単位ベクトル（右手系）", () => {
  const ax = moonAxesAt(traj.moonFrame, tOf(traj.closestApproach));
  const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (const v of [ax.x, ax.y, ax.z]) near(Math.hypot(...v), 1, 1e-9, "長さ");
  near(d(ax.x, ax.y), 0, 1e-9, "x・y");
  near(d(ax.x, ax.z), 0, 1e-9, "x・z");
  // x × y = z
  const c = [ax.x[1] * ax.y[2] - ax.x[2] * ax.y[1], ax.x[2] * ax.y[0] - ax.x[0] * ax.y[2], ax.x[0] * ax.y[1] - ax.x[1] * ax.y[0]];
  for (let k = 0; k < 3; k++) near(c[k], ax.z[k], 1e-9, "右手系");
});

test("最接近のとき：オリオン・地球・太陽の真下の緯度経度が、検証の計算と合う（軸の向き・経度の符号）", () => {
  const t = tOf(traj.closestApproach);
  const ax = moonAxesAt(traj.moonFrame, t), s = stateAt(t);
  const sub = (a, b) => a.map((v, k) => v - b[k]);
  const [laO, loO] = latLonOf(ax, sub(s.craft, s.moon));
  const [laE, loE] = latLonOf(ax, s.moon.map((v) => -v));
  const [laS, loS] = latLonOf(ax, sun);
  const ref = obs.subPoints;
  near(laO, ref.subOrion[0], 0.5, "オリオンの真下の緯度");
  assert.ok(lonDiff(loO, ref.subOrion[1]) < 0.5, `オリオンの真下の経度 ${loO}`);
  near(laE, ref.subEarth[0], 0.3, "地球の真下の緯度（秤動）");
  assert.ok(lonDiff(loE, ref.subEarth[1]) < 0.3, `地球の真下の経度（秤動）${loE}`);
  near(laS, ref.subSolar[0], 0.3, "太陽の真下の緯度");
  assert.ok(lonDiff(loS, ref.subSolar[1]) < 0.3, `太陽の真下の経度 ${loS}`);
});

test("経度0°・緯度0° は x、東経90° は y、北緯90° は z", () => {
  const ax = moonAxesAt(traj.moonFrame, 0);
  const close = (a, b) => a.forEach((v, k) => near(v, b[k], 1e-12, "向き"));
  close(surfaceDir(ax, 0, 0), ax.x);
  close(surfaceDir(ax, 0, 90), ax.y);
  close(surfaceDir(ax, 90, 0), ax.z);
  const [la, lo] = latLonOf(ax, surfaceDir(ax, orientale.latDeg, orientale.lonEastDeg));
  near(la, orientale.latDeg, 1e-9, "緯度の往復");
  near(lo, orientale.lonEastDeg, 1e-9, "経度の往復");
});

test("Mare Orientale：19:41 UTC（NASA の写真の時刻）に、見えて、照らされている（検証の計算と同じ）", () => {
  const t = tOf("2026-04-06T19:41:00Z"), s = stateAt(t), ax = moonAxesAt(traj.moonFrame, t);
  const o = observe(orientale, ax, s.craft, s.moon, sun);
  const ref = obs.atTimes.find((x) => x.utc === "2026-04-06T19:41:00Z").features.mare_orientale;
  near(o.e, ref.e, 1, "出射角");
  near(o.i, ref.i, 1.5, "入射角（太陽の向きは最接近のときの値）");
  near(Math.hypot(...o.p.map((v, k) => v - s.moon[k])), R_MOON_KM, 1e-6, "月の表面の上");
  assert.equal(gate(orientale, o, { inView: true, diamPx: 100 }).ok, true);
});

test("負の例：月の向こう側・夜・画面の外・小さすぎる・未確認の地形には照準を出さない", () => {
  const t = tOf(traj.closestApproach), s = stateAt(t), ax = moonAxesAt(traj.moonFrame, t);
  // 最接近のとき、Mare Orientale は月の向こう側（検証：22:47 UTC まで）
  const back = observe(orientale, ax, s.craft, s.moon, sun);
  assert.ok(back.e > 90, `出射角 ${back.e}`);
  assert.equal(gate(orientale, back, { inView: true, diamPx: 100 }).why, "far-side");
  // 夜の地点：太陽の真下の反対側（経度 +125° あたり）
  const night = { ...orientale, latDeg: 0, lonEastDeg: 125 };
  const n = observe(night, ax, s.craft, s.moon, sun);
  assert.ok(n.i > 90, `入射角 ${n.i}`);
  assert.equal(gate(night, { ...n, e: 10 }, { inView: true, diamPx: 100 }).why, "night");
  const ok = { e: 20, i: 40 };
  assert.equal(gate(orientale, ok, { inView: false, diamPx: 100 }).why, "off-screen");
  assert.equal(gate(orientale, ok, { inView: true, diamPx: 6 }).why, "too-small");
  assert.equal(gate({ ...orientale, status: "FALLBACK" }, ok, { inView: true, diamPx: 100 }).why, "unverified");
});

test("照準を出す地形は USGS で確認した点だけ。盆地全体（Orientale Basin）を Mare Orientale の点で指さない", () => {
  for (const x of TARGETS.filter((y) => y.status === "VERIFIED")) {
    assert.match(x.usgs, /^https:\/\/planetarynames\.wr\.usgs\.gov\/Feature\/\d+$/);
    assert.ok(Number.isFinite(x.latDeg) && Number.isFinite(x.lonEastDeg));
    assert.doesNotMatch(x.en, /basin/i);
    const ref = obs.observations.find((y) => y.id === x.id);
    assert.equal(ref.latDeg, x.latDeg);
    assert.equal(ref.lonEastDeg, x.lonEastDeg);
    assert.equal(ref.proposal, "VERIFIED");
  }
});

test("観測の場面の時間には、その地形が見えて照らされている（はじめ・まんなか・おわり）", async () => {
  const { OBSERVE_WINDOWS } = await import("../web/tour/artemis2/lunar.js");
  for (const [id, [a, b]] of Object.entries(OBSERVE_WINDOWS)) {
    const tg = TARGETS.find((x) => x.id === id);
    assert.equal(tg.status, "VERIFIED", id);
    const t0 = tOf(a), t1 = tOf(b);
    for (const t of [t0, (t0 + t1) / 2, t1]) {
      const s = stateAt(t), o = observe(tg, moonAxesAt(traj.moonFrame, t), s.craft, s.moon, sun);
      assert.ok(o.e < 75 && o.i < 88, `${id} ${new Date(EPOCH + t * 1000).toISOString()} e ${o.e} i ${o.i}`);
    }
  }
  // 時刻は前にしか進まない（Reiner Gamma → Mare Orientale）
  assert.ok(Date.parse(OBSERVE_WINDOWS.reiner_gamma[1]) <= Date.parse(OBSERVE_WINDOWS.mare_orientale[0]));
});

test("位置を指さない地形（FALLBACK）は、出典つきの情報だけ", () => {
  for (const x of TARGETS) {
    assert.ok(x.facts.length >= 1 && x.facts.every((f) => /（(USGS|NASA)|NASA）|USGS）/.test(f)) && /（USGS）$/.test(x.origin), `${x.id} の事実に出典`);
    assert.match(x.link, /^https:\/\/www\.nasa\.gov\/image-detail\//);
  }
});
