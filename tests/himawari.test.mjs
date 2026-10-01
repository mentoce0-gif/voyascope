import { test } from "node:test";
import assert from "node:assert/strict";
import { himawariImage, hmJstOf } from "../web/js/himawari.js";

test("ひまわりの最新画像：40分前の10分枠（前日の上書き前の画像を出さない）", () => {
  // 17:00 UTC → 16:20 の枠（気象衛星センターの表示は 16:30 UTC）
  const a = himawariImage(new Date("2026-10-01T17:00:38Z"));
  assert.equal(a.url, "https://www.data.jma.go.jp/mscweb/data/himawari/img/jpn/jpn_b13_1620.jpg");
  assert.equal(a.observed.toISOString(), "2026-10-01T16:30:00.000Z");
  assert.equal(hmJstOf(a.observed), "1:30");
  // 日付をまたぐ
  assert.match(himawariImage(new Date("2026-10-02T00:15:00Z")).url, /jpn_b13_2330\.jpg$/);
});
