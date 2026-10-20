import { test } from "node:test";
import assert from "node:assert/strict";
import { stamp, dir8En, obsLogText, postUrl } from "../web/js/obslog.js";

const pass = { start: new Date("2026-10-22T09:24:30Z"), startAz: 315, endAz: 95, maxEl: 61.6 };

test("時刻は日本時間で、「:」を使わない", () => {
  assert.equal(stamp(pass.start), "20261022_1824");
  assert.equal(stamp(new Date("2026-12-31T15:05:00Z")), "20270101_0005");
});

test("方角は8方位の英字", () => {
  assert.deepEqual([0, 44, 46, 180, 315, 359, -10].map(dir8En), ["N", "NE", "NE", "S", "NW", "N", "N"]);
});

test("観測ログの形（場所は入れない）", () => {
  assert.equal(obsLogText(pass), "#VOYASCOPE OBS-LOG\n20261022_1824 / #ISS / NW→E / EL62° / ☀\nhttps://voyascope.org/");
  assert.match(obsLogText(pass, "cloudy"), /\/ ☁\n/);
  assert.match(obsLogText(pass, "unknown"), /\/ ☀\n/);
});

test("X の投稿画面のリンクは文をそのまま渡す", () => {
  const url = new URL(postUrl(obsLogText(pass)));
  assert.equal(url.origin + url.pathname, "https://twitter.com/intent/tweet");
  assert.equal(url.searchParams.get("text"), obsLogText(pass));
});
