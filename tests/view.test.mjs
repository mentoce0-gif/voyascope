import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VIEW_MODES, isViewMode, isJapanCraft, isJapanEvent, isJapanLaunch, showsCraft, showsEvent, showsLaunch } from "../web/js/view.js";

const card = (id) => JSON.parse(readFileSync(new URL(`../web/data/cards/${id}.json`, import.meta.url), "utf8"));

test("表示は4つ：すべて・日本のみ・衛星のみ・打ち上げ予定のみ", () => {
  assert.deepEqual(
    VIEW_MODES.map((m) => m.label),
    ["すべて", "日本のみ", "衛星のみ", "打ち上げ予定のみ"],
  );
  assert.equal(isViewMode("japan"), true);
  assert.equal(isViewMode("world"), false);
  assert.equal(isViewMode(null), false);
});

test("日本の機体：カードの「運用」に日本の機関が入っている（ISS は JAXA が入る）", () => {
  for (const id of ["iss", "himawari-9", "qzs-2", "qzs-6", "daichi-4", "ibuki-gw", "hinode"]) {
    assert.equal(isJapanCraft(card(id)), true, id);
  }
  assert.equal(isJapanCraft({ operator: { value: ["NASA", "ESA"] } }), false);
  assert.equal(isJapanCraft({ operator: { value: "China Manned Space Agency" } }), false);
  assert.equal(isJapanCraft({ operator: { undisclosed: true } }), false);
  assert.equal(isJapanCraft({}), false);
});

test("日本の予定と、日本の射場からの打ち上げ", () => {
  assert.equal(isJapanEvent({ regions: ["japan"] }), true);
  assert.equal(isJapanEvent({ regions: ["world", "japan"] }), true);
  assert.equal(isJapanEvent({ regions: ["world"] }), false);
  assert.equal(isJapanLaunch({ site: { country: "JPN" } }), true);
  assert.equal(isJapanLaunch({ site: { country: "USA" } }), false);
});

test("それぞれの表示で出すもの", () => {
  const jp = { operator: { value: "JAXA" } };
  const us = { operator: { value: "NASA" } };
  const evJp = { regions: ["japan"] };
  const evWorld = { regions: ["world"] };
  const lJp = { site: { country: "JPN" } };
  const lUs = { site: { country: "USA" } };
  // すべて
  assert.deepEqual([showsCraft("all", us), showsEvent("all", evWorld), showsLaunch("all", lUs)], [true, true, true]);
  // 日本のみ
  assert.deepEqual([showsCraft("japan", jp), showsCraft("japan", us)], [true, false]);
  assert.deepEqual([showsEvent("japan", evJp), showsEvent("japan", evWorld)], [true, false]);
  assert.deepEqual([showsLaunch("japan", lJp), showsLaunch("japan", lUs)], [true, false]);
  // 衛星のみ：予定・打ち上げは出さない
  assert.deepEqual([showsCraft("craft", us), showsEvent("craft", evJp), showsLaunch("craft", lJp)], [true, false, false]);
  // 打ち上げ予定のみ：機体は出さない
  assert.deepEqual([showsCraft("launches", jp), showsEvent("launches", evWorld), showsLaunch("launches", lUs)], [false, true, true]);
});
