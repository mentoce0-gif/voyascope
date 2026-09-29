import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sunEci, isSunlit, observerOf, skyAt, findVisiblePasses, dir8, heightWord, MIN_ELEVATION, SUN_BELOW } from "../web/js/passes.js";
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
const orbit = JSON.parse(readFileSync("web/data/orbits/iss.json", "utf8"));
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
