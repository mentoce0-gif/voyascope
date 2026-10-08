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
