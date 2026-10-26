import { test } from "node:test";
import assert from "node:assert/strict";
import { rxState, rxHtml } from "../web/js/rx.js";

const now = new Date("2026-10-26T04:00:00Z");

test("受信：直近の取得（7時間以内）は光ってちらつく、2日以内は点灯、それより前は消える", () => {
  assert.equal(rxState("2026-10-25T22:00:00Z", now).state, "new");
  assert.equal(rxState("2026-10-24T15:57:40Z", now).state, "on");
  assert.equal(rxState("2026-10-18T04:34:34Z", now).state, "off");
  assert.equal(rxState(undefined, now).state, "off");
});

test("受信：読み上げと文字", () => {
  assert.match(rxHtml("2026-10-25T22:00:00Z", now), /rx-new[\s\S]*受信：6時間前に新しい軌道データ/);
  assert.match(rxHtml("2026-10-24T15:57:40Z", now), /rx-on[\s\S]*36時間前/);
  const off = rxHtml("2026-10-18T04:34:34Z", now);
  assert.match(off, /rx-off/);
  assert.match(off, /受信なし：新しい軌道データが7日前から来ていません/);
});
