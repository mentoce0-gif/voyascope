import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mmxPhase, transferProgress, untilText } from "../web/mmx/now/state.js";

// 打ち上げ前の形で試す（本物のカードは 2026-10-20 に打ち上げ済み〈done〉になった）
const scheduled = ({ status, ...c }) => c;
const card = JSON.parse(readFileSync(new URL("../curation/events/mmx-launch.json", import.meta.url)));
const mmx = scheduled(card);
const T0 = Date.parse(mmx.when.value.at);
const at = (ms) => new Date(T0 + ms);

test("いまどこ：打ち上げ前・予定の時刻を過ぎたが未確認・延期は、種子島のまま（推測で打ち上がったと描かない）", () => {
  assert.equal(mmxPhase(mmx, at(-3600000)).phase, "before");
  assert.equal(mmxPhase(mmx, at(60000)).phase, "unconfirmed");
  assert.equal(mmxPhase(mmx, at(30 * 86400000)).phase, "unconfirmed");
  assert.equal(mmxPhase({ ...mmx, status: { value: "postponed" } }, at(60000)).phase, "postponed");
});

test("いまどこ：カードが「済み」になったら、打ち上げからの日数で計画の軌道を進む", () => {
  const done = { ...mmx, status: { value: "done", source: "https://www.jaxa.jp/" } };
  const p = mmxPhase(done, at(10 * 86400000));
  assert.equal(p.phase, "flying");
  assert.equal(Math.round(p.days), 10);
  assert.equal(transferProgress(0, 330), 0);
  assert.equal(transferProgress(165, 330), 0.5);
  assert.equal(transferProgress(400, 330), 1);
});

test("いまどこ：残り時間のことば", () => {
  assert.equal(untilText((12 * 60 + 37) * 60000 + 5000), "あと12時間37分");
  assert.equal(untilText((3 * 1440 + 4 * 60) * 60000), "あと3日4時間");
  assert.equal(untilText(5 * 60000), "あと5分");
  assert.equal(untilText(-1), "");
});

test("いまどこ：航路の表（route.json）は、カードの打ち上げ日時で計算したもの（日時が変わったら作り直す）", () => {
  const route = JSON.parse(readFileSync(new URL("../web/mmx/now/route.json", import.meta.url)));
  assert.equal(Date.parse(route.launch), T0);
});

test("いまどこ：本物のカードは打ち上げ済み（JAXA の中継で確認）→ 飛行中", () => {
  assert.equal(mmxPhase(card, at(30 * 60000)).phase, "flying");
});
