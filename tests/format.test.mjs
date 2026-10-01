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
