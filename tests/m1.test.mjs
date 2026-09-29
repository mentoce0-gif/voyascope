import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { displayAltitude, RINGS, ringOf } from "../web/js/scale.js";
import { familyOf } from "../web/js/families.js";
import { SimClock, TIMELINE, groundTrack, satrecFromOrbit } from "../web/js/orbit.js";

test("高さの縮尺：高いほど外側、環の順番どおり", () => {
  const alts = [100, 420, 2000, 20200, 35786].map(displayAltitude);
  for (let i = 1; i < alts.length; i++) assert.ok(alts[i] > alts[i - 1]);
  assert.deepEqual(RINGS.map((r) => r.id), ["leo", "meo", "geo"]);
  assert.ok(RINGS[0].alt < RINGS[1].alt && RINGS[1].alt < RINGS[2].alt);
  assert.equal(ringOf(420), "leo");
  assert.equal(ringOf(20200), "meo");
  assert.equal(ringOf(35786), "geo");
});

test("家族分け", () => {
  assert.equal(familyOf("crewed_station").id, "crewed");
  assert.equal(familyOf("weather").id, "science");
  assert.equal(familyOf("navigation").id, "navigation");
  assert.equal(familyOf("communication").id, "band");
  assert.equal(familyOf("unknown").id, "other");
});

// 時計は、現実の時刻と経過時間を差し替えてテストする
function fakeClock() {
  const t = { real: Date.parse("2026-09-30T00:00:00Z"), perf: 0 };
  const clock = new SimClock(() => t.real, () => t.perf);
  const advance = (ms) => {
    t.real += ms;
    t.perf += ms;
  };
  return { clock, advance, t };
}

test("時計：LIVE・早送り・一時停止", () => {
  const { clock, advance } = fakeClock();
  assert.ok(clock.isLive());
  clock.setSpeed(600);
  advance(1000);
  assert.equal(clock.offset(), 599000); // 1秒で10分進む（現実も1秒進む）
  assert.ok(!clock.isLive());
  clock.setPlaying(false);
  const frozen = clock.now().getTime();
  advance(5000);
  assert.equal(clock.now().getTime(), frozen);
  clock.live();
  assert.ok(clock.isLive());
});

test("時計：タイムラインの外には出ない", () => {
  const { clock, advance } = fakeClock();
  clock.jumpToOffset(-10 * 3600e3);
  assert.equal(clock.offset(), TIMELINE.minMs);
  clock.jumpToOffset(23.9 * 3600e3);
  clock.setSpeed(600);
  advance(10000); // +100分
  assert.equal(clock.clampToTimeline(), true);
  assert.equal(clock.offset(), TIMELINE.maxMs);
  assert.equal(clock.playing, false);
});

test("地上軌跡：前後90分、経度180°で線が分かれる", () => {
  const orbit = JSON.parse(readFileSync("web/data/orbits/iss.json", "utf8"));
  const satrec = satrecFromOrbit(orbit);
  const segs = groundTrack(satrec, new Date(orbit.epoch));
  const points = segs.flat();
  assert.ok(points.length >= 170, `点の数 ${points.length}`);
  for (const s of segs) {
    for (let i = 1; i < s.length; i++) assert.ok(Math.abs(s[i].lng - s[i - 1].lng) < 180);
  }
  assert.ok(points.some((p) => p.past) && points.some((p) => !p.past));
});
