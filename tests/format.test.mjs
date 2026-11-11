import { test } from "node:test";
import assert from "node:assert/strict";
import { dateTimeJa, dateTimeCompactJa } from "../web/js/format.js";

test("時刻の表示：スマホ用は年を省き、時差の表記はPC用と同じ", () => {
  const d = new Date(2026, 9, 1, 9, 5, 7); // 閲覧者の時刻で 2026/10/01 09:05:07
  const full = dateTimeJa(d);
  const compact = dateTimeCompactJa(d);
  assert.match(full, /^2026\/10\/01 09:05:07 \((JST|UTC[+-]\d+(:\d\d)?)\)$/);
  assert.equal(compact, `10/01 09:05:07 ${full.match(/\((.+)\)$/)[1]}`);
});

test("軌道データの取得日：いちばん新しい日を主に、3日より古い機体は別に", async () => {
  const { orbitFreshness } = await import("../web/js/format.js");
  const c = (id, at) => ({ id, card: { name: { ja: id } }, orbit: { fetched_at: at } });
  const f = orbitFreshness([c("a", "2026-11-10T19:44:00.000Z"), c("b", "2026-10-18T04:34:34.028Z"), c("c", "2026-11-09T22:21:45.829Z")]);
  assert.equal(f.newest, "2026-11-10T19:44:00.000Z");
  assert.deepEqual(f.stale.map((s) => s.name), ["b"]);
  assert.equal(f.oldest.at, "2026-10-18T04:34:34.028Z");
  const g = orbitFreshness([c("a", "2026-11-10T19:44:00.000Z"), c("c", "2026-11-09T22:21:45.829Z")]);
  assert.equal(g.oldest, null);
  assert.equal(orbitFreshness([]), null);
});
