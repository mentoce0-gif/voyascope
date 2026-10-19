import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { launchProgress, beaconTag, launchFlowHtml, hms, AFTER_MS, LAUNCH_PLANS, launchSoon, soonTag, SOON_MS } from "../web/js/launch-plan.js";
import { eventPanelHtml } from "../web/js/events.js";

// 打ち上げ前の形で試す（本物のカードは 2026-10-20 に打ち上げ済み〈done〉になった）
const scheduled = ({ status, ...c }) => c;
const card = JSON.parse(readFileSync(new URL("../curation/events/mmx-launch.json", import.meta.url)));
const mmx = scheduled(card);
const T0 = Date.parse("2026-10-19T19:41:03Z"); // 2026-10-20 4:41:03（日本時間）
const at = (ms) => new Date(T0 + ms);
const S = (h, m, s) => ((h * 60 + m) * 60 + s) * 1000;

test("計画書の日時は、カードの予定の日時と同じ（日がずれたら計画の流れは出さない）", () => {
  assert.equal(mmx.when.value.at, LAUNCH_PLANS["mmx-launch"].forAt);
});

test("打ち上げ前・分離の予定の30分後より後は出さない", () => {
  assert.equal(launchProgress(mmx, at(-1000)), null);
  assert.equal(launchProgress(mmx, at(S(1, 11, 12) + AFTER_MS)), null);
});

test("段階：打ち上げ → SRB-3 分離（2組）→ フェアリング分離 → 第1段 → 1回目の燃焼 → 慣性飛行 → 2回目の燃焼 → 分離（改訂版の表2）", () => {
  assert.equal(launchProgress(mmx, at(0)).current, 0);
  assert.equal(launchProgress(mmx, at(S(0, 1, 57))).current, 1);
  assert.equal(launchProgress(mmx, at(S(0, 2, 0))).current, 2);
  assert.equal(launchProgress(mmx, at(S(0, 3, 17))).current, 3);
  assert.equal(launchProgress(mmx, at(S(0, 4, 59))).current, 5);
  assert.equal(launchProgress(mmx, at(S(0, 6, 0))).current, 6);
  assert.equal(launchProgress(mmx, at(S(0, 30, 0))).current, 7);
  assert.equal(launchProgress(mmx, at(S(1, 5, 0))).current, 8);
  const sep = launchProgress(mmx, at(S(1, 11, 12)));
  assert.equal(sep.current, 9);
  assert.equal(sep.separated, true);
  assert.equal(launchProgress(mmx, at(S(1, 11, 11))).separated, false);
});

test("ピンの名前と経過の表示", () => {
  assert.equal(hms(S(1, 3, 57)), "1:03:57");
  assert.equal(beaconTag(launchProgress(mmx, at(S(0, 12, 34)))), "MMX 打ち上げから 0:12:34（計画）");
  assert.equal(beaconTag(launchProgress(mmx, at(S(1, 20, 0)))), "MMX 分離の予定の時刻を過ぎました");
});

test("延期・日時の変更・ほかの予定では出さない", () => {
  assert.equal(launchProgress({ ...mmx, status: { value: "postponed" } }, at(S(0, 10, 0))), null);
  assert.equal(launchProgress({ ...mmx, when: { ...mmx.when, value: { at: "2026-10-21T19:30:00Z" } } }, at(S(0, 10, 0))), null);
  assert.equal(launchProgress({ ...mmx, id: "other" }, at(S(0, 10, 0))), null);
});

test("予定の詳細：計画の流れがあれば残り時間の代わりに出し、出典と「JAXA の発表で確かめて」を書く", () => {
  const lp = launchProgress(mmx, at(S(0, 30, 0)));
  const html = eventPanelHtml(mmx, at(S(0, 30, 0)), { flowHtml: launchFlowHtml(lp) });
  assert.match(html, /data-live="elapsed"/);
  assert.match(html, /JAXA の発表で確かめてください/);
  assert.match(html, /jaxa20260820-1_01\.pdf/);
  assert.match(html, /class="now"><span class="mono">0:10:40<\/span>慣性飛行/);
  assert.doesNotMatch(html, /予定の時刻を過ぎました<\/span><span class="small">結果は/);
});

test("打ち上げの前の1週間は光らせる（延期・日付だけ・時刻を過ぎたら光らせない）", () => {
  assert.equal(launchSoon(mmx, at(-SOON_MS - 1000)), false);
  assert.equal(launchSoon(mmx, at(-SOON_MS)), true);
  assert.equal(launchSoon(mmx, at(-1000)), true);
  assert.equal(launchSoon(mmx, at(0)), false);
  assert.equal(launchSoon({ ...mmx, status: { value: "postponed" } }, at(-3600000)), false);
  assert.equal(launchSoon({ ...mmx, when: { ...mmx.when, value: { date: "2026-10-20" } } }, at(-3600000)), false);
  assert.equal(soonTag(mmx, at(-(4 * 86400000 + 12 * 3600000 + 60000))), "MMX 打ち上げまで あと4日12時間");
  assert.equal(soonTag(mmx, at(-(3 * 3600000 + 12 * 60000 + 30000))), "MMX 打ち上げまで あと3時間12分");
});

test("打ち上げを確かめたあと（done）も、分離の予定の30分後までは計画の流れを出す", () => {
  assert.equal(card.status.value, "done");
  assert.equal(launchProgress(card, at(S(0, 30, 0))).plan.steps[launchProgress(card, at(S(0, 30, 0))).current].label, "慣性飛行");
  assert.equal(launchProgress(card, at(S(1, 11, 12) + AFTER_MS)), null);
  assert.equal(launchProgress({ ...card, status: { value: "postponed" } }, at(S(0, 30, 0))), null);
});
