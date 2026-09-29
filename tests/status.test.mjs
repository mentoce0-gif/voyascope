import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseQzssStatus, buildStatusRecord, shouldWrite, naquKind } from "../scripts/lib/status.mjs";
import { summarizeStatus } from "../web/js/status.js";

const html = readFileSync(new URL("./fixtures/qzss-constellation.html", import.meta.url), "utf8");

test("みちびきの運用状況ページを読める（2026-09-29 の実物）", () => {
  const p = parseQzssStatus(html);
  assert.equal(p.pageUpdated, "2026-09-29");
  assert.deepEqual(
    p.satellites.map((s) => `${s.name}:${s.svn}`),
    ["QZS02:002", "QZS03:003", "QZS04:004", "QZS1R:005", "QZS06:007", "QZS07:008"],
  );
  const qzs3 = p.satellites.find((s) => s.name === "QZS03");
  const pnt = qzs3.services.find((s) => s.service === "PNT");
  assert.equal(pnt.ok, false);
  assert.equal(pnt.state, "outage");
  assert.equal(pnt.naqu, "2026251");
  // 有効なお知らせ（EFFECTIVE）だけ。全体向けの INFORMATION は入れない
  assert.deepEqual(
    p.notices.map((n) => [n.number, n.svn, n.kind, n.start, n.stop]),
    [
      ["2026252", "007", "forecast", "2026-10-08T09:59:00.000Z", "2026-10-12T09:59:00.000Z"],
      ["2026251", "003", "forecast", "2026-09-29T06:59:00.000Z", "2026-10-03T06:59:00.000Z"],
    ],
  );
});

test("表が読めないページは例外にする", () => {
  assert.throws(() => parseQzssStatus("<html>メンテナンス中</html>"));
});

test("NAQU の種類", () => {
  assert.equal(naquKind("PNT_FCSTDV"), "forecast");
  assert.equal(naquKind("PNT_UNUSUFN"), "unplanned");
  assert.equal(naquKind("PNT_USABINIT"), "resumed");
  assert.equal(naquKind("ALL_GENERAL"), "other");
});

test("1機分の記録には、その衛星のお知らせだけが入る", () => {
  const p = parseQzssStatus(html);
  const r = buildStatusRecord({ id: "qzs-6", name: "QZS06" }, p, new Date("2026-09-29T23:00:00Z"));
  assert.equal(r.svn, "007");
  assert.deepEqual(r.notices.map((n) => n.number), ["2026252"]);
  assert.throws(() => buildStatusRecord({ id: "x", name: "QZS99" }, p, new Date()));
});

test("中身が同じなら1日たつまで書き換えない", () => {
  const p = parseQzssStatus(html);
  const a = buildStatusRecord({ id: "qzs-2", name: "QZS02" }, p, new Date("2026-09-29T00:00:00Z"));
  const b = buildStatusRecord({ id: "qzs-2", name: "QZS02" }, p, new Date("2026-09-29T12:00:00Z"));
  const c = buildStatusRecord({ id: "qzs-2", name: "QZS02" }, p, new Date("2026-09-30T00:00:00Z"));
  assert.equal(shouldWrite(null, a), true);
  assert.equal(shouldWrite(a, b), false);
  assert.equal(shouldWrite(a, c), true);
  assert.equal(shouldWrite(a, { ...b, page_updated: "2026-09-30" }), true);
});

test("状態のまとめ：予定・停止中・終わったお知らせ・古い取得", () => {
  const p = parseQzssStatus(html);
  const card = { status: { value: "operating", source: "https://example.org" } };
  const live = buildStatusRecord({ id: "qzs-6", name: "QZS06" }, p, new Date("2026-09-29T23:00:00Z"));

  const before = summarizeStatus(card, live, new Date("2026-09-30T00:00:00Z"));
  assert.equal(before.base.label, "運用中");
  assert.equal(before.badge, "停止予定");
  assert.equal(before.live.notices[0].active, false);
  assert.equal(before.live.notices[0].service, "衛星測位サービス");
  assert.equal(before.live.stale, false);

  const during = summarizeStatus(card, live, new Date("2026-10-09T00:00:00Z"));
  assert.equal(during.badge, "停止中");
  assert.equal(during.live.notices[0].active, true);
  assert.equal(during.live.stale, true);

  const after = summarizeStatus(card, live, new Date("2026-10-13T00:00:00Z"));
  assert.equal(after.badge, null);
  assert.equal(after.live.notices.length, 0);

  // 自動取得がない機体はカードの status だけ
  assert.deepEqual(summarizeStatus(card, null), { base: { value: "operating", label: "運用中" }, live: null, badge: null });
  assert.equal(summarizeStatus({}, null).base, null);
});

test("表で停止（X）のサービスがあれば停止中", () => {
  const p = parseQzssStatus(html);
  const live = buildStatusRecord({ id: "qzs-3", name: "QZS03" }, p, new Date("2026-09-29T23:00:00Z"));
  const s = summarizeStatus({}, live, new Date("2026-09-30T00:00:00Z"));
  assert.equal(s.badge, "停止中");
  assert.deepEqual(s.live.down.map((d) => d.code), ["PNT"]);
});

test("取得後に停止期間に入ったら、サービスの行も停止中にする", () => {
  const p = parseQzssStatus(html);
  const live = buildStatusRecord({ id: "qzs-6", name: "QZS06" }, p, new Date("2026-09-29T23:00:00Z"));
  const s = summarizeStatus({}, live, new Date("2026-10-09T00:00:00Z"));
  assert.equal(s.live.services.find((x) => x.code === "PNT").ok, false);
  assert.equal(summarizeStatus({}, live, new Date("2026-09-30T00:00:00Z")).live.services.find((x) => x.code === "PNT").ok, true);
});
