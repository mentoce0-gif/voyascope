import { test } from "node:test";
import assert from "node:assert/strict";
import { arcAngles, pickIndex } from "../web/js/launcher.js";
import { tipLines, whenDay, FALLBACK } from "../web/js/tips.js";

test("ランチャー：項目を左（180°）から上（90°）へ等間隔に", () => {
  assert.deepEqual(arcAngles(4), [180, 150, 120, 90]);
  assert.deepEqual(arcAngles(1), [180]);
});

test("ランチャー：指の向きから近い項目。近すぎる・離れた向きは選ばない", () => {
  const a = arcAngles(4);
  assert.equal(pickIndex(-100, 0, a), 0); // 左 → OBS
  assert.equal(pickIndex(0, -100, a), 3); // 上 → MMX
  assert.equal(pickIndex(-70, -70, a), 1); // 左上（135°）→ 150° の項目が近い
  assert.equal(pickIndex(-10, -10, a), -1); // ボタンの上
  assert.equal(pickIndex(100, 60, a), -1); // 右下
  assert.equal(pickIndex(-100, 30, a), 0); // 少し左下でも OBS
});

const items = [
  { id: "a", name: "MMX", title: "MMX の打ち上げ", when: { at: "2026-10-19T19:41:03Z" }, status: "done", href: "missions/mmx/" },
  { id: "b", name: "ボイジャー1号", title: "ボイジャー1号が地球から1光日に", when: { at: "2026-11-18T10:16:07Z" }, status: "scheduled", href: "missions/voyager-1/" },
  { id: "c", name: "はやぶさ２", title: "地球スイングバイ", when: { month: "2027-12" }, status: "scheduled", href: "missions/hayabusa2/" },
  { id: "d", name: "ベピコロンボ", title: "分離", when: { from: "2026-12-09", to: "2026-12-10" }, status: "scheduled", href: "missions/bepicolombo/" },
  { id: "e", name: "X", title: "中止の予定", when: { date: "2026-11-01" }, status: "cancelled", href: "missions/x/" },
];

test("帯：済んだものは「〇〇から N日」、予定は「あと N日」。日本時間の日付で数え、近い順", () => {
  const now = Date.parse("2026-10-30T10:00:00+09:00");
  const l = tipLines(items, now);
  assert.deepEqual(l.map((x) => x.text), ["MMX の打ち上げから10日", "あと19日：ボイジャー1号が地球から1光日に", "あと40日：分離"]);
});

test("帯：月だけの予定・中止・期間の外は出さない。当日は「きょう」", () => {
  assert.equal(whenDay({ month: "2027-12" }), null);
  const l = tipLines(items, Date.parse("2026-11-18T23:00:00+09:00"));
  assert.equal(l[0].text, "きょう：ボイジャー1号が地球から1光日に");
  assert.equal(tipLines(items, Date.parse("2027-06-01T00:00:00+09:00")).length, 0);
  assert.equal(FALLBACK.href, "missions/");
});
