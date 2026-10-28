import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sunEci, isSunlit, observerOf, skyAt, findVisiblePasses, dir8, heightWord, brightIndex, brightWord, sunGap, sunGapWord, MIN_ELEVATION, SUN_BELOW } from "../web/js/passes.js";
import { satrecFromOrbit } from "../web/js/orbit.js";

const decl = (d) => {
  const s = sunEci(new Date(d));
  return (Math.asin(s.z / Math.hypot(s.x, s.y, s.z)) * 180) / Math.PI;
};

test("太陽の赤緯：夏至は約+23.4°、冬至は約−23.4°、秋分は約0°", () => {
  assert.ok(Math.abs(decl("2026-06-21T08:00:00Z") - 23.44) < 0.1);
  assert.ok(Math.abs(decl("2026-12-21T20:00:00Z") + 23.44) < 0.1);
  assert.ok(Math.abs(decl("2026-09-23T00:05:00Z")) < 0.5);
});

const pref = (name) => JSON.parse(readFileSync("config/prefectures.json", "utf8")).prefectures.find((p) => p.name === name);
// 見える通過は、季節によって10日以上ない時期がある。自動で更新される web/data/orbits/iss.json ではなく、固定した軌道（2026-09-30）で確かめる
const orbit = JSON.parse(readFileSync("tests/fixtures/iss-orbit-2026-09-30.json", "utf8"));
const satrec = satrecFromOrbit(orbit);

test("太陽の高さ：東京の正午は高く、夜は地平線の下", () => {
  const obs = observerOf(pref("東京"));
  const noon = skyAt(satrec, obs, new Date("2026-09-30T02:45:00Z")); // 11:45 JST
  const night = skyAt(satrec, obs, new Date("2026-09-30T13:00:00Z")); // 22:00 JST
  assert.ok(noon.sunEl > 45 && noon.sunEl < 60, `正午 ${noon.sunEl}`);
  assert.ok(night.sunEl < -30, `夜 ${night.sunEl}`);
});

test("地球の影：太陽と反対側の真後ろは影、横は日なた", () => {
  const sun = { x: 1.5e8, y: 0, z: 0 };
  assert.equal(isSunlit({ x: -6800, y: 0, z: 0 }, sun), false);
  assert.equal(isSunlit({ x: -6800, y: 6800, z: 0 }, sun), true);
  assert.equal(isSunlit({ x: 6800, y: 0, z: 0 }, sun), true);
});

test("方角と高さのことば", () => {
  assert.equal(dir8(0), "北");
  assert.equal(dir8(44), "北東");
  assert.equal(dir8(225), "南西");
  assert.equal(dir8(359), "北");
  assert.match(heightWord(75), /頭の上/);
  assert.match(heightWord(15), /低い/);
});

test("見える通過：条件を満たし、時間順で、1回は十数分以内", () => {
  const obs = observerOf(pref("滋賀"));
  const start = new Date(orbit.epoch);
  const passes = findVisiblePasses(satrec, obs, start, { days: 10, limit: 10 });
  assert.ok(passes.length > 0, "10日間に1回も見えないのは不自然");
  for (let i = 0; i < passes.length; i++) {
    const p = passes[i];
    const minutes = (p.end - p.start) / 60000;
    assert.ok(minutes > 0 && minutes <= 12, `長さ ${minutes} 分`);
    assert.ok(p.maxEl >= MIN_ELEVATION && p.maxEl <= 90);
    for (const t of p.track) assert.ok(t.el >= MIN_ELEVATION);
    const mid = skyAt(satrec, obs, p.maxAt);
    assert.ok(mid.sunEl <= SUN_BELOW && mid.sunlit);
    if (i) assert.ok(p.start > passes[i - 1].end);
  }
});

import { whenWord, clockWord } from "../web/js/tonight.js";

test("いつ・何時ごろのことば（日本時間）", () => {
  const now = new Date("2026-09-30T08:00:00Z"); // 17:00 JST
  assert.equal(whenWord(new Date("2026-09-30T10:10:00Z"), now), "今夜"); // 19:10
  assert.equal(whenWord(new Date("2026-09-30T20:30:00Z"), now), "明日の明け方"); // 5:30
  assert.equal(whenWord(new Date("2026-10-01T09:20:00Z"), now), "明日の夕方"); // 18:20
  assert.equal(whenWord(new Date("2026-10-03T10:00:00Z"), now), "10月3日(土)の夜");
  assert.equal(clockWord(new Date("2026-09-30T10:10:19Z")), "19時10分ごろ");
});

test("太陽が真上にある地点：秋分のころの正午（UTC）は赤道・経度0°の近く", async () => {
  const { subsolarPoint } = await import("../web/js/passes.js");
  const p = subsolarPoint(new Date("2026-09-23T12:00:00Z"));
  assert.ok(Math.abs(p.lat) < 1.5, `緯度 ${p.lat}`);
  assert.ok(Math.abs(p.lng) < 5, `経度 ${p.lng}`);
  // 6時間後は西へ約90°
  const q = subsolarPoint(new Date("2026-09-23T18:00:00Z"));
  assert.ok(Math.abs(q.lng + 90) < 5, `経度 ${q.lng}`);
});

test("明るさの目安：近くて正面から日が当たるほど明るい", () => {
  const deg = Math.PI / 180;
  assert.ok(brightIndex(420, 60 * deg) < brightIndex(1500, 60 * deg), "遠いほど暗い");
  assert.ok(brightIndex(600, 40 * deg) < brightIndex(600, 140 * deg), "横・後ろから当たるほど暗い");
  assert.equal(brightWord(brightIndex(420, 60 * deg)), "明るい"); // ほぼ真上
  assert.equal(brightWord(brightIndex(1500, 120 * deg)), "暗め"); // 地平線の近く
  assert.equal(brightWord(1), "ふつう");
});

test("通過には、いちばん明るいときの明るさが付く", () => {
  const obs = observerOf(pref("滋賀"));
  const passes = findVisiblePasses(satrec, obs, new Date(orbit.epoch), { days: 10, limit: 10 });
  for (const p of passes) assert.ok(Number.isFinite(p.bright));
});

test("日の入り・日の出からの時間：東京 2026-09-30 の 18:27 は、日の入り（計算で 17:27 ごろ）から約1時間", () => {
  const obs = observerOf(pref("東京"));
  const gap = sunGap(obs, new Date("2026-09-30T09:27:00Z")); // 18:27 JST
  assert.equal(gap.kind, "set");
  assert.ok(Math.abs(gap.minutes - 60) <= 3, `${gap.minutes} 分`);
  const morning = sunGap(obs, new Date("2026-09-30T20:00:00Z")); // 10/1 5:00 JST
  assert.equal(morning.kind, "rise");
  assert.match(sunGapWord(morning), /^日の出の約\d+分前$/);
  assert.equal(sunGapWord({ kind: "set", minutes: 43 }), "日の入りから約45分");
});
