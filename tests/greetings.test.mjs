import { test } from "node:test";
import assert from "node:assert/strict";
import { pendingGreetings, greetingHtml } from "../web/js/greetings.js";

const src = "https://example.org/news";
const launch = (over = {}) => ({
  id: "mmx-launch",
  kind: "launch",
  title: { ja: "MMX の打ち上げ", en: "MMX launch" },
  when: { value: { at: "2026-10-19T19:41:03Z" }, source: src },
  vehicle: { value: "H3ロケット10号機", source: src },
  status: { value: "done", source: src },
  greeting: { name: "MMX", until: "2026-10-27" },
  ...over,
});
const iss = (teams) => ({ card: { name: { ja: "国際宇宙ステーション" } }, crewData: { teams } });
const team = (over = {}) => ({
  id: "crew-12",
  name: { value: "Crew-12", source: src },
  return_date: { value: "2026-10-08", source: src },
  crew: [{}, {}, {}, {}],
  greeting: { until: "2026-10-15" },
  ...over,
});
const keys = (data, now, seen) => pendingGreetings(data, new Date(now), seen).map((g) => g.key);

test("打ち上げ：終わったあとから until（日本時間）の終わりまで", () => {
  const data = { events: [launch()] };
  assert.deepEqual(keys(data, "2026-10-19T19:00:00Z"), []); // 打ち上げ前
  assert.deepEqual(keys(data, "2026-10-19T20:00:00Z"), ["launch:mmx-launch"]);
  assert.deepEqual(keys(data, "2026-10-27T14:59:00Z"), ["launch:mmx-launch"]); // 10/27 23:59 JST
  assert.deepEqual(keys(data, "2026-10-27T15:00:00Z"), []); // 10/28 0:00 JST
});

test("打ち上げ：greeting がない・終わっていない・打ち上げでないものは出さない", () => {
  const now = "2026-10-21T00:00:00Z";
  assert.deepEqual(keys({ events: [launch({ greeting: undefined })] }, now), []);
  assert.deepEqual(keys({ events: [launch({ status: { value: "postponed", source: src } })] }, now), []);
  assert.deepEqual(keys({ events: [launch({ status: undefined })] }, now), []);
  assert.deepEqual(keys({ events: [launch({ kind: "arrival" })] }, now), []);
});

test("帰還：帰還の日から until まで。月だけの帰還日・greeting なしは出さない", () => {
  assert.deepEqual(keys({ craft: [iss([team()])] }, "2026-10-07T12:00:00Z"), []);
  assert.deepEqual(keys({ craft: [iss([team()])] }, "2026-10-09T00:00:00Z"), ["return:crew-12"]);
  assert.deepEqual(keys({ craft: [iss([team()])] }, "2026-10-15T15:00:00Z"), []);
  const now = "2026-10-09T00:00:00Z";
  assert.deepEqual(keys({ craft: [iss([team({ return_date: { value: "2026-10", source: src } })])] }, now), []);
  assert.deepEqual(keys({ craft: [iss([team({ greeting: undefined })])] }, now), []);
});

test("見たものは出さない。新しい順に並ぶ", () => {
  const data = { events: [launch({ greeting: { name: "MMX", until: "2026-10-30" } })], craft: [iss([team({ return_date: { value: "2026-10-22", source: src }, greeting: { until: "2026-10-30" } })])] };
  assert.deepEqual(keys(data, "2026-10-23T00:00:00Z"), ["return:crew-12", "launch:mmx-launch"]);
  assert.deepEqual(keys(data, "2026-10-23T00:00:00Z", new Set(["return:crew-12"])), ["launch:mmx-launch"]);
});

test("文面：事実と出典だけ。名前などはエスケープする", () => {
  const [g] = pendingGreetings({ events: [launch({ greeting: { name: "<b>X</b>", until: "2026-10-27" } })] }, new Date("2026-10-20T00:00:00Z"));
  const html = greetingHtml(g);
  assert.match(html, /いってらっしゃい、&lt;b&gt;X&lt;\/b&gt;/);
  assert.match(html, /2026年10月20日 4:41（日本時間）、H3ロケット10号機で打ち上げられました。/);
  assert.match(html, /出典：<a href="https:\/\/example.org\/news"[^>]*>example.org<\/a>/);
  const [r] = pendingGreetings({ craft: [iss([team()])] }, new Date("2026-10-09T00:00:00Z"));
  assert.match(greetingHtml(r), /おかえりなさい、Crew-12.*2026年10月8日、4人が国際宇宙ステーションから地球に帰ってきました。/s);
});
