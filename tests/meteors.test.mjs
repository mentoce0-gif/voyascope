import { test } from "node:test";
import assert from "node:assert/strict";
import { radiantSky, meteorNight, moonLit, activeMeteors, meteorHtml } from "../web/js/meteors.js";

const D = Math.PI / 180;
const tokyo = { latitude: 35.69 * D, longitude: 139.69 * D, height: 0 };
const src = "https://example.org/meteor";

test("放射点の計算：北極星はいつも北の空、高さは緯度に近い", () => {
  for (const at of ["2026-10-08T12:00:00Z", "2026-12-14T15:00:00Z"]) {
    const s = radiantSky({ ra: 37.95, dec: 89.26 }, tokyo, new Date(at));
    assert.ok(s.az < 2 || s.az > 358, `az ${s.az}`);
    assert.ok(Math.abs(s.el - 35.7) < 1.2, `el ${s.el}`);
  }
});

test("月の明るい部分：新月のころは小さく、満月のころは大きい", () => {
  assert.ok(moonLit(new Date("2026-10-10T16:00:00Z")) < 0.05); // 新月のころ
  assert.ok(moonLit(new Date("2026-10-26T04:00:00Z")) > 0.95); // 満月のころ
});

test("今夜：空が暗いあいだだけを見る。昼に開くと、その日の夜", () => {
  const n = meteorNight({ ra: 262, dec: 54 }, tokyo, new Date("2026-10-08T03:00:00Z")); // 日本時間 12時
  const h = (d) => (d.getUTCHours() + 9) % 24;
  assert.ok(h(n.dark.start) >= 17 && h(n.dark.start) <= 19, `start ${n.dark.start.toISOString()}`);
  assert.ok(h(n.dark.end) >= 4 && h(n.dark.end) <= 6, `end ${n.dark.end.toISOString()}`);
  assert.ok(n.best.rad.el > 50);
});

const ev = (over = {}) => ({
  id: "test-meteor",
  kind: "meteor",
  title: { ja: "テスト流星群", en: "Test" },
  when: { value: { date: "2026-10-08" }, source: src },
  radiant: { value: { ra: 262, dec: 54 }, source: src },
  ...over,
});

test("出す期間：極大の前の日から、一覧から消えるまで。放射点がないもの・中止は出さない", () => {
  const at = (s) => activeMeteors([ev()], new Date(s)).length;
  assert.equal(at("2026-10-06T00:00:00Z"), 0);
  assert.equal(at("2026-10-07T00:00:00Z"), 1);
  assert.equal(at("2026-10-09T14:00:00Z"), 1);
  assert.equal(at("2026-10-10T16:00:00Z"), 0);
  assert.equal(activeMeteors([ev({ radiant: undefined })], new Date("2026-10-08T00:00:00Z")).length, 0);
  assert.equal(activeMeteors([ev({ status: { value: "cancelled", source: src } })], new Date("2026-10-08T00:00:00Z")).length, 0);
  assert.equal(activeMeteors([ev({ kind: "milestone" })], new Date("2026-10-08T00:00:00Z")).length, 0);
});

test("文面：県がなければ案内だけ。県があれば方角・空の図・月・注意", () => {
  const now = new Date("2026-10-08T03:00:00Z");
  assert.match(meteorHtml(ev(), null, "", now), /県を選ぶと、放射点/);
  const html = meteorHtml(ev(), tokyo, "東京都", now);
  assert.match(html, /東京都から：/);
  assert.match(html, /暗くなる <strong>17:50<\/strong> ごろ、放射点は<strong>北西<\/strong>の空/);
  assert.match(html, /そのあと低くなり、\d+:\d+ ごろには高さ10°より下/);
  assert.match(html, /class="sky-chart"/);
  assert.match(html, /月は|月は空にありません/);
  assert.match(html, /空のどこにでも流れます/);
  assert.match(html, /出典：<a href="https:\/\/example.org\/meteor"/);
});

import { radiantDirection, createStream } from "../web/js/meteors.js";

test("ちりが来る方向：放射点が真上になる地点は、今夜の東京から見て放射点が高いとき近くにある", () => {
  const d = radiantDirection({ ra: 262, dec: 54 }, new Date("2026-10-08T09:00:00Z")); // 日本時間 18時
  assert.equal(d.lat, 54);
  assert.ok(d.lng > 95 && d.lng < 125, `lng ${d.lng}`); // 東京（東経140°）の西・北
  assert.ok(Math.abs(Math.hypot(d.u.x, d.u.y, d.u.z) - 1) < 1e-9);
});

test("ちりの群れ：流れ星（光）は、放射点の側の半球の大気の高さにだけできる", () => {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const d = radiantDirection({ ra: 262, dec: 54 }, new Date("2026-10-08T09:00:00Z"));
  const stream = createStream(200, rand);
  const flashes = [];
  for (let i = 0; i < 600; i++) flashes.push(...stream.step(1 / 30, d.u).flashes);
  assert.ok(flashes.length > 100);
  const D = Math.PI / 180;
  for (const f of flashes) {
    assert.ok(Math.abs(f.alt - 0.016) < 1e-6);
    const v = { x: Math.cos(f.lat * D) * Math.cos(f.lng * D), y: Math.cos(f.lat * D) * Math.sin(f.lng * D), z: Math.sin(f.lat * D) };
    assert.ok(v.x * d.u.x + v.y * d.u.y + v.z * d.u.z > -1e-9, "放射点と反対の半球に光がある");
  }
  // 止めた（dt=0）ときは動かない
  const a = stream.step(0, d.u).points[0];
  const b = stream.step(0, d.u).points[0];
  assert.deepEqual(a, b);
});

import { meteorWindow, orbitPoint, earthPoint, meteorStoryHtml } from "../web/js/meteors.js";
import { readFileSync } from "node:fs";

test("出現期間（active）があれば、そのあいだ（日本時間）だけ。ちりも今夜の欄もこれに合わせる", () => {
  const w = meteorWindow({ ...ev(), active: { value: { from: "2026-10-06", to: "2026-10-10" }, source: src } });
  assert.equal(new Date(w.start).toISOString(), "2026-10-05T15:00:00.000Z");
  assert.equal(new Date(w.end).toISOString(), "2026-10-10T15:00:00.000Z");
  const withActive = [{ ...ev(), active: { value: { from: "2026-10-06", to: "2026-10-10" }, source: src } }];
  assert.equal(activeMeteors(withActive, new Date("2026-10-05T14:59:00Z")).length, 0);
  assert.equal(activeMeteors(withActive, new Date("2026-10-06T00:00:00Z")).length, 1);
  assert.equal(activeMeteors(withActive, new Date("2026-10-10T14:59:00Z")).length, 1);
  assert.equal(activeMeteors(withActive, new Date("2026-10-10T15:00:00Z")).length, 0);
});

test("しくみの図：21P の通り道が黄道を横切る点のそばを、地球が10月8日ごろに通る（JPL の軌道要素）", () => {
  const card = JSON.parse(readFileSync("curation/events/draconids-2026.json", "utf8"));
  const o = card.parent.orbit.value;
  const near = orbitPoint(o, 180 - o.w); // 太陽に近いほうの交点
  const lon = (p) => (Math.atan2(p.y, p.x) * 180) / Math.PI;
  assert.ok(Math.abs(near.z) < 1e-9);
  assert.ok(Math.abs(Math.hypot(near.x, near.y) - 1) < 0.05, "交点は地球の軌道のそば");
  const e = earthPoint(new Date("2026-10-08T12:00:00Z"));
  assert.ok(Math.abs(lon(e) - lon(near)) < 2, `地球 ${lon(e)}° 交点 ${lon(near)}°`);
  const html = meteorStoryHtml(card, new Date("2026-10-08T12:00:00Z"));
  assert.match(html, /NASA JPL 小天体データベース/);
  assert.match(html, /IAU 星名一覧/);
  assert.match(html, /国立天文台 流星群とは/);
  assert.match(html, /イメージ/);
  assert.match(html, /彗星がいまそこにあるわけではありません/);
});
