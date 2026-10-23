import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compareAll, compareMilestone, monthIndex } from "../web/mmx/partners/timeline.js";

const data = JSON.parse(readFileSync(new URL("../web/mmx/partners/data.json", import.meta.url)));
const countryIds = new Set(data.countries.map((c) => c.id));
const contribIds = new Set(data.contributions.map((c) => c.id));

test("MMX の国際協力：どの項目にも、ある出典が付いている（推測で書かない）", () => {
  const all = [...data.contributions, ...data.places, ...data.timeline.claims.map((c) => ({ ...c, sources: [c.source] })), ...data.timeline.numbers.flatMap((n) => n.claims.map((c) => ({ ...c, sources: [c.source] })))];
  for (const item of all) {
    assert.ok(item.sources?.length, `出典がない：${item.id ?? item.text}`);
    for (const s of item.sources) assert.ok(data.sources[s], `知らない出典：${s}`);
  }
  for (const s of Object.values(data.sources)) assert.match(s.url, /^https:\/\//);
});

test("MMX の国際協力：国・モジュール・ピンのつながりが切れていない", () => {
  for (const c of data.contributions) {
    for (const k of c.countries) assert.ok(countryIds.has(k), `${c.id}：国 ${k}`);
    for (const m of c.modules) assert.ok(data.modules[m], `${c.id}：モジュール ${m}`);
  }
  for (const p of data.places) {
    for (const c of p.contributions) assert.ok(contribIds.has(c), `${p.id}：${c}`);
    assert.ok(Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180, p.id);
  }
  const milestones = new Set(data.timeline.milestones.map((m) => m.id));
  for (const c of data.timeline.claims) {
    assert.ok(milestones.has(c.milestone), c.milestone);
    if (c.from) assert.ok(monthIndex(c.from) <= monthIndex(c.to), `${c.milestone} ${c.source}`);
  }
});

test("いつ：重なれば一致、重ならなければ食い違い、JAXA の日付がなければ課題に出す", () => {
  const a = { publisher: "A", from: "2029-01", to: "2029-12", text: "2029" };
  const b = { publisher: "JAXA", from: "2030-01", to: "2030-12", text: "2030" };
  assert.equal(compareMilestone([a, b]).status, "disagree");
  assert.equal(compareMilestone([{ ...a, publisher: "JAXA" }, { publisher: "B", from: "2029-08", to: "2029-08" }]).status, "agree");
  const noLead = compareMilestone([a, { publisher: "B", from: "2029-06", to: "2029-06" }]);
  assert.equal(noLead.status, "no-lead-date");
  assert.ok(noLead.issues.some((s) => s.includes("JAXA")));
  assert.equal(compareMilestone([{ publisher: "JAXA", text: "順番だけ" }]).status, "no-date");
});

test("いつ：2026-10-23 に確かめた資料での見え方（資料が変わったらここも直す）", () => {
  const byId = Object.fromEntries(compareAll(data.timeline).map((m) => [m.id, m.status]));
  assert.deepEqual(byId, {
    launch: "agree",
    mars: "agree",
    qso: "single",
    rover: "no-lead-date",
    sampling: "disagree",
    leave: "agree",
    earth: "agree"
  });
});
