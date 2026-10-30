import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, norm, loadPages, matchPage, isFresh, coverage } from "../scripts/news-coverage.mjs";

const pages = loadPages();

test("台帳の CSV：引用符の中のカンマと \"\" を読む", () => {
  const rows = parseCsv('date,topic,kind\n2026-10-25,"ISS 船外活動, ""延期""",unscheduled\n');
  assert.deepEqual(rows, [{ date: "2026-10-25", topic: 'ISS 船外活動, "延期"', kind: "unscheduled" }]);
});

test("名前のくらべ方：空白・中黒・括弧・全角を無視", () => {
  assert.equal(norm("ボイジャー １号"), norm("ボイジャー1号"));
});

test("ページを名前・略称・別名で探す。page の列が優先、「-」はなし", () => {
  assert.equal(matchPage({ topic: "H3ロケット10号機でMMX打ち上げ" }, pages)?.id, "mmx");
  assert.equal(matchPage({ topic: "探査機", aliases: "Voyager 1" }, pages)?.id, "voyager-1");
  assert.equal(matchPage({ topic: "ISS 船外活動" }, pages)?.id, "iss");
  assert.equal(matchPage({ topic: "なにか", page: "jwst" }, pages)?.id, "jwst");
  assert.equal(matchPage({ topic: "MMX", page: "-" }, pages), null);
});

test("英字の短い名前は、単語の中に含まれても合わない（mission の iss）", () => {
  assert.equal(matchPage({ topic: "Artemis mission update" }, pages), null);
});

test("新しさ：予定は30日前〜当日、予定外はその日〜翌日のコミット", () => {
  const t = (s) => Date.parse(s);
  const sch = { date: "2026-11-18", kind: "scheduled" };
  assert.equal(isFresh(sch, [t("2026-11-01T00:00:00+09:00")]), true);
  assert.equal(isFresh(sch, [t("2026-11-19T00:00:00+09:00")]), false);
  const un = { date: "2026-10-25", kind: "unscheduled" };
  assert.equal(isFresh(un, [t("2026-10-24T23:00:00+09:00")]), false);
  assert.equal(isFresh(un, [t("2026-10-26T20:00:00+09:00")]), true);
  assert.equal(isFresh(un, [t("2026-10-27T00:00:00+09:00")]), false);
});

test("カバー率・新しさ・ページのない主題（多い順）", () => {
  const rows = [
    { date: "2026-10-20", topic: "MMX 打ち上げ", kind: "scheduled" },
    { date: "2026-10-22", topic: "流星群", kind: "scheduled" },
    { date: "2026-10-23", topic: "流星群", kind: "scheduled" },
    { date: "2026-10-24", topic: "スターシップ", kind: "unscheduled" },
  ];
  const r = coverage(rows, pages, () => [Date.parse("2026-10-19T12:00:00+09:00")]);
  assert.equal(r.total, 4);
  assert.equal(r.covered, 1);
  assert.equal(r.fresh, 1);
  assert.deepEqual(r.missing, [["流星群", 2], ["スターシップ", 1]]);
});
