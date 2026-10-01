import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  eventSpan,
  upcomingEvents,
  whenText,
  whenShort,
  countdownText,
  bigCountdown,
  publisherOf,
  eventsListHtml,
  eventPanelHtml,
  nextChipHtml,
  hmJst,
  GRACE_MS,
} from "../web/js/events.js";

const ev = (id, value, extra = {}) => ({
  id,
  kind: "launch",
  regions: ["japan"],
  title: { ja: id, en: id },
  when: { value, source: "https://www.jaxa.jp/press/x.html", as_of: "2026-10-01" },
  links: [{ label: "公式", url: "https://www.jaxa.jp/" }],
  ...extra,
});
const at = (s) => new Date(s);

// 2026-10-20 4:41:03（日本時間）
const mmx = ev("mmx", { at: "2026-10-19T19:41:03Z" });
const bepi = ev("bepi", { date: "2026-11-21" }, { kind: "arrival", regions: ["world", "japan"] });
const sep = ev("sep", { from: "2026-12-09", to: "2026-12-10" }, { kind: "separation" });
const swing = ev("swing", { month: "2027-12" }, { kind: "flyby" });

test("日時の表示：日本時間・曜日・今年でなければ年", () => {
  const now = at("2026-10-01T09:20:00Z");
  assert.equal(whenText(mmx, now), "10月20日（火）4:41");
  assert.equal(whenText(mmx, now, { full: true }), "2026年10月20日（火）4時41分03秒（日本時間）");
  assert.equal(whenText(bepi, now), "11月21日（土）");
  assert.equal(whenText(sep, now), "12月9日〜10日");
  assert.equal(whenText(swing, now), "2027年12月");
  assert.deepEqual(whenShort(mmx, now), ["10/20", "4:41"]);
  assert.deepEqual(whenShort(sep, now), ["12/9〜", "12/10"]);
  assert.deepEqual(whenShort(swing, now), ["2027", "12月"]);
  // 年が変わると、今年の予定ではないので年が付く
  assert.equal(whenText(bepi, at("2027-01-05T00:00:00Z")), "2026年11月21日（土）");
  assert.equal(hmJst(at("2026-10-01T09:23:40Z")), "18:23");
});

test("日本時間で日付が変わる時刻（UTC では前の日）", () => {
  const late = ev("late", { at: "2026-11-18T16:30:00Z" }); // 日本時間 11/19 1:30
  assert.equal(whenText(late, at("2026-10-01T00:00:00Z")), "11月19日（木）1:30");
});

test("残り時間のことば", () => {
  assert.equal(countdownText(mmx, at("2026-10-01T09:20:00Z")), "あと18日10時間");
  assert.equal(countdownText(mmx, at("2026-10-19T16:29:00Z")), "あと3時間12分");
  assert.equal(countdownText(mmx, at("2026-10-19T19:30:00Z")), "あと11分");
  assert.equal(countdownText(mmx, at("2026-10-19T19:41:00Z")), "まもなく");
  assert.equal(countdownText(mmx, at("2026-10-19T19:42:00Z")), "予定の時刻を過ぎました");
  // 日付だけの予定は日本時間の暦で数える
  assert.equal(countdownText(bepi, at("2026-10-01T09:20:00Z")), "あと51日");
  assert.equal(countdownText(bepi, at("2026-11-20T03:00:00Z")), "明日");
  assert.equal(countdownText(bepi, at("2026-11-20T16:00:00Z")), "今日"); // 日本時間 11/21 1:00
  assert.equal(countdownText(sep, at("2026-12-09T05:00:00Z")), "今日");
  assert.equal(countdownText(sep, at("2026-12-10T05:00:00Z")), "期間中");
  assert.equal(countdownText(swing, at("2026-10-01T00:00:00Z")), "");
  assert.equal(bigCountdown(mmx, at("2026-10-01T09:20:00Z")), "18日 10時間 21分 03秒");
  assert.equal(bigCountdown(bepi, at("2026-10-01T09:20:00Z")), null);
});

test("延期：残り時間を出さず、日時を過ぎても「延期」として残す", () => {
  const p = { ...mmx, status: { value: "postponed", source: "https://www.jaxa.jp/press/y.html" } };
  const later = at("2026-10-25T00:00:00Z");
  assert.equal(countdownText(p, at("2026-10-01T00:00:00Z")), "延期");
  assert.equal(bigCountdown(p, at("2026-10-01T00:00:00Z")), null);
  assert.deepEqual(upcomingEvents([p], later).map((e) => e.id), ["mmx"]);
  assert.match(eventsListHtml([p], later), /延期/);
  assert.doesNotMatch(eventsListHtml([p], later), /event-left/);
});

test("これからの予定：早い順。時刻を過ぎたら少し残して消える。終わった・中止は出さない", () => {
  const done = ev("done", { at: "2026-10-30T00:00:00Z" }, { status: { value: "done", source: "https://www.nasa.gov/" } });
  const all = [swing, sep, bepi, mmx, done];
  assert.deepEqual(upcomingEvents(all, at("2026-10-01T00:00:00Z")).map((e) => e.id), ["mmx", "bepi", "sep", "swing"]);
  const justAfter = new Date(Date.parse("2026-10-19T19:41:03Z") + GRACE_MS - 1000);
  assert.ok(upcomingEvents(all, justAfter).some((e) => e.id === "mmx"));
  const wellAfter = new Date(Date.parse("2026-10-19T19:41:03Z") + GRACE_MS + 1000);
  assert.ok(!upcomingEvents(all, wellAfter).some((e) => e.id === "mmx"));
  // 日付だけの予定は、日本時間の翌日いっぱいまで残す
  assert.ok(upcomingEvents([bepi], at("2026-11-22T14:00:00Z")).length === 1); // 日本時間 11/22 23:00
  assert.ok(upcomingEvents([bepi], at("2026-11-22T15:00:00Z")).length === 0); // 日本時間 11/23 0:00
  assert.deepEqual(upcomingEvents(undefined, new Date()), []);
});

test("期間・月の終わり", () => {
  assert.equal(eventSpan(sep).end, Date.parse("2026-12-11T15:00:00Z")); // 日本時間 12/12 0:00
  assert.equal(eventSpan(swing).start, Date.parse("2027-11-30T15:00:00Z")); // 日本時間 12/1 0:00
  assert.equal(eventSpan(ev("dec", { month: "2026-12" })).end, Date.parse("2027-01-01T15:00:00Z"));
  assert.equal(eventSpan({ when: { value: {} } }), null);
});

test("出典の機関名", () => {
  assert.equal(publisherOf("https://www.jaxa.jp/press/2026/08/20260820-1_j.html"), "JAXA");
  assert.equal(publisherOf("https://www.hayabusa2.jaxa.jp/x.pdf"), "JAXA");
  assert.equal(publisherOf("https://science.nasa.gov/mission/voyager/"), "NASA");
  assert.equal(publisherOf("https://www.esa.int/Science_Exploration/"), "ESA");
  assert.equal(publisherOf("https://www.example.org/a"), "example.org");
  assert.equal(publisherOf("not a url"), "");
});

test("表示は文字をエスケープする", () => {
  const bad = ev("bad", { at: "2026-10-19T19:41:03Z" }, { title: { ja: "<img src=x onerror=1>", en: "x" } });
  const now = at("2026-10-01T00:00:00Z");
  for (const html of [eventsListHtml([bad], now), nextChipHtml(bad, now), eventPanelHtml(bad, now)]) {
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;img/);
  }
});

test("今夜の通過（計算）を先頭に出す", () => {
  const html = eventsListHtml([mmx], at("2026-10-01T09:00:00Z"), {
    tonight: { day: "今夜", time: "18:23", title: "ISS が東京の空を通る", sub: "西から南へ・計算：公開の軌道データから" },
  });
  assert.ok(html.indexOf("ISS が東京の空を通る") < html.indexOf("mmx"));
  assert.match(html, /data-go="tonight"/);
  assert.equal(eventsListHtml([], new Date()), `<p class="k small">いま載せている予定はありません。</p>`);
});

test("詳細：出典を項目ごとに、打ち上げは残り時間と射場", () => {
  const card = JSON.parse(readFileSync("curation/events/mmx-launch.json", "utf8"));
  const html = eventPanelHtml(card, at("2026-10-01T09:20:00Z"));
  assert.match(html, /打ち上げの予定/);
  assert.match(html, /data-live="countdown"/);
  assert.match(html, /種子島宇宙センター/);
  assert.match(html, /2026年11月7日（土）まで/);
  assert.match(html, /JAXA プレスリリース（MMX の打上げ）<\/a> <span class="k">（日時・予備期間）/);
  assert.match(html, /打ち上がるまで、軌道は描きません/);
  // 予定の時刻を過ぎたら、残り時間の代わりに「公式の発表で確かめて」
  const after = eventPanelHtml(card, at("2026-10-19T20:00:00Z"));
  assert.doesNotMatch(after, /data-live="countdown"/);
  assert.match(after, /予定の時刻を過ぎました/);
  assert.match(after, /公式の発表で確かめてください/);
});

test("curation/events：すべて日時が読めて、2026-10-01 にはまだ先", () => {
  const now = at("2026-10-01T00:00:00Z");
  const all = readdirSync("curation/events")
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(`curation/events/${f}`, "utf8")));
  assert.ok(all.length >= 1);
  for (const e of all) {
    assert.ok(eventSpan(e), `${e.id} の日時が読めない`);
    assert.ok(whenText(e, now).length > 0);
  }
  assert.equal(upcomingEvents(all, now).length, all.length);
  // web/data/events.json と同じ中身
  const web = JSON.parse(readFileSync("web/data/events.json", "utf8")).events;
  assert.deepEqual(web.map((e) => e.id).sort(), all.map((e) => e.id).sort());
});
