// 探査機の距離（NASA JPL の Horizons）：問い合わせの形・応答の読み方・表から距離を出す・カードの書き方
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { queryUrl, parseHorizons, tableStart, tableCovers, roundSig, VersionError, DAYS } from "../scripts/lib/horizons.mjs";
import { horizonsKm, probeDistance } from "../web/js/far/distance.js";
import { distanceParts, fullCardHtml, ladderHtml, horizonsCredit } from "../web/js/far/probe-card.js";
import { roomItems } from "../web/js/far/room.js";

// 2026-10-04 に取った応答（表は最初の3日だけに縮めたもの）
const FIX = JSON.parse(readFileSync("tests/fixtures/horizons-2026-10-04.json", "utf8")).probes;
const curation = readdirSync("curation/probes")
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join("curation/probes", f), "utf8")));
const horizonsCards = curation.filter((c) => c.distance.method === "horizons");
const strip = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("表のはじまり：いちばん近い日本時間 0時（世界時 15時）より前にさかのぼる", () => {
  assert.equal(tableStart(new Date("2026-10-05T00:41:00Z")).toISOString(), "2026-10-04T15:00:00.000Z"); // 月曜の取得
  assert.equal(tableStart(new Date("2026-10-04T15:00:00Z")).toISOString(), "2026-10-04T15:00:00.000Z");
  assert.equal(tableStart(new Date("2026-10-04T14:59:00Z")).toISOString(), "2026-10-03T15:00:00.000Z");
});

test("問い合わせ：地球の中心からの距離（光の時間の補正なし）を、1日ごとに6週間ぶん", () => {
  const url = new URL(queryUrl("-31", new Date("2026-10-04T15:00:00Z")));
  assert.equal(url.origin + url.pathname, "https://ssd.jpl.nasa.gov/api/horizons.api");
  const q = Object.fromEntries(url.searchParams);
  assert.equal(q.format, "json");
  assert.equal(q.COMMAND, "'-31'");
  assert.equal(q.CENTER, "'500@399'");
  assert.equal(q.EPHEM_TYPE, "'VECTORS'");
  assert.equal(q.VEC_CORR, "'NONE'");
  assert.equal(q.START_TIME, "'2026-10-04 15:00'");
  assert.equal(q.STOP_TIME, "'2026-11-15 15:00'"); // 42日後
  assert.equal(q.STEP_SIZE, "'1 d'");
  assert.equal(q.OBJ_DATA, "'YES'"); // 説明（datasheet）も一緒にもらう
  assert.equal(DAYS, 42);
});

test("応答を読む：対象・距離（有効数字5桁）・説明の原文", () => {
  const p = parseHorizons(FIX.bepicolombo.response, { command: "-121", quotes: ["Trajectory from ESA."], days: 2 });
  assert.equal(p.target, "BepiColombo (Spacecraft) (-121)");
  assert.equal(p.km.length, 3);
  assert.equal(p.km[0], 168500000); // 168,498,391.06 km
  assert.deepEqual(p.missingQuotes, []);
  // 説明に原文がなければ知らせる
  assert.deepEqual(parseHorizons(FIX.bepicolombo.response, { command: "-121", quotes: ["Trajectory from JAXA."], days: 2 }).missingQuotes, ["Trajectory from JAXA."]);
  // 改行をまたぐ原文も見つける（「from Goddard」と「Flight Dynamics Facility」のあいだで改行）
  const jw = parseHorizons(FIX.jwst.response, { command: "-170", quotes: ["from Goddard Flight Dynamics Facility (FDF)"], days: 2 });
  assert.deepEqual(jw.missingQuotes, []);
  assert.ok(jw.km[0] > 1.2e6 && jw.km[0] < 1.6e6, `ウェッブ ${jw.km[0]}`);
});

test("応答を読む：形が違えば止める（version・ちがう対象・行の数）", () => {
  const r = FIX["voyager-1"].response;
  assert.throws(() => parseHorizons({ ...r, signature: { ...r.signature, version: "1.3" } }, { command: "-31", days: 2 }), VersionError);
  assert.throws(() => parseHorizons(r, { command: "-32", days: 2 }), /ちがう対象/);
  assert.throws(() => parseHorizons(r, { command: "-31", days: 42 }), /行の数/);
  assert.throws(() => parseHorizons({ signature: r.signature }, { command: "-31", days: 2 }), /result/);
});

test("いまのカード：Horizons の探査機は、説明の原文がいまの応答にある（2026-10-04）", () => {
  assert.equal(horizonsCards.length, 6);
  for (const c of horizonsCards) {
    const fx = FIX[c.id];
    assert.ok(fx, `${c.id} の応答の見本がない`);
    assert.equal(fx.command, c.distance.horizons_id, c.id);
    const p = parseHorizons(fx.response, { command: c.distance.horizons_id, quotes: c.distance.datasheet_quotes ?? [], days: 2 });
    assert.deepEqual(p.missingQuotes, [], c.id);
    if (c.distance.supplier) assert.ok(c.distance.datasheet_quotes?.length, `${c.id}：supplier には原文が要る`);
  }
});

const TABLE = {
  step_hours: 24,
  days: 2,
  probes: { "voyager-1": { target: "Voyager 1 (spacecraft) (-31)", downloaded: "2026-10-04T05:32:14.942Z", start: "2026-10-04T15:00:00.000Z", km: [25771000000, 25772000000, 25774000000] } },
};

test("表から距離を出す：となりの2日を線でつなぐ。表の外は出さない（準備中に戻す）", () => {
  const at = (iso) => horizonsKm(TABLE, "voyager-1", new Date(iso));
  assert.equal(at("2026-10-04T15:00:00Z"), 25771000000);
  assert.equal(at("2026-10-05T03:00:00Z"), 25771500000); // 半日
  assert.equal(at("2026-10-06T03:00:00Z"), 25773000000);
  assert.equal(at("2026-10-06T15:00:00Z"), 25774000000); // 表の終わり
  assert.equal(at("2026-10-06T15:00:01Z"), null); // 取得が止まって古くなった
  assert.equal(at("2026-10-04T14:59:59Z"), null);
  assert.equal(horizonsKm(TABLE, "voyager-2", new Date("2026-10-05T00:00:00Z")), null);
  assert.equal(horizonsKm(null, "voyager-1", new Date("2026-10-05T00:00:00Z")), null);
  assert.equal(tableCovers(TABLE.probes["voyager-1"], new Date("2026-10-05T00:00:00Z")), true);
  assert.equal(tableCovers(TABLE.probes["voyager-1"], new Date("2026-10-07T00:00:00Z")), false);
});

test("カード：Horizons の計算値は3桁に丸めて「約」。取得日・出典（SSD の形）・軌道のもとのデータの機関", () => {
  const card = horizonsCards.find((c) => c.id === "voyager-1");
  const now = new Date("2026-10-05T03:00:00Z");
  const d = probeDistance(card, now, TABLE);
  assert.equal(d.method, "horizons");
  assert.equal(d.km, roundSig(25771500000, 5));
  assert.equal(d.approx, true);
  const item = { id: card.id, kind: "probe", name: card.name.ja, card, dist: d };
  const dp = distanceParts(item);
  assert.equal(dp.km, "約 258億 km");
  assert.equal(dp.short, "約258億 km");
  assert.equal(dp.how, "Horizons の計算値（10月4日に取得）");
  assert.equal(dp.lt, "約 23 時間 50 分");
  const full = strip(fullCardHtml(item, { now, upcoming: [] }));
  assert.match(full, /Solar System Dynamics\. \(Downloaded 2026, October 4\)\. Horizons System ?\. https:\/\/ssd\.jpl\.nasa\.gov/); // strip はタグを空白にする
  assert.match(full, /通信で測った値ではありません/);
  assert.match(full, /1981〜1992年の追跡データ/); // ボイジャー1号の note
  assert.doesNotMatch(full, /軌道のもとのデータ/); // 説明に機関の名前がないものは書かない
  // 機関が書かれているもの（ベピコロンボ＝ESA）
  const bepi = horizonsCards.find((c) => c.id === "bepicolombo");
  const t2 = { step_hours: 24, probes: { bepicolombo: { downloaded: "2026-10-04T05:32:14.942Z", start: "2026-10-04T15:00:00.000Z", km: [168500000, 166300000] } } };
  const bi = { id: bepi.id, kind: "probe", name: bepi.name.ja, card: bepi, dist: probeDistance(bepi, now, t2) };
  assert.match(strip(fullCardHtml(bi, { now, upcoming: [] })), /軌道のもとのデータ：ESA（Horizons の説明による）/);
  const credit = horizonsCredit("2026-10-04T05:32:14.942Z");
  assert.match(credit, /^Solar System Dynamics\. \(Downloaded 2026, October 4\)\. <a href="https:\/\/ssd\.jpl\.nasa\.gov\/horizons\/"[^>]*>Horizons System<\/a>\. <a href="https:\/\/ssd\.jpl\.nasa\.gov"/);
  assert.match(horizonsCredit("bad"), /\(Downloaded \)/);
  // カードの距離の行には「出典」の文字が1つだけ（SSD の形の出典の行）
  const bfull = strip(fullCardHtml(bi, { now, upcoming: [] }));
  const distRow = bfull.slice(bfull.indexOf(" 距離 "), bfull.indexOf(" 任務 "));
  assert.equal((distRow.match(/出典/g) ?? []).length, 1, distRow);
});

test("はしご：Horizons の表があれば段に並び、なければ「準備中」に並ぶ", () => {
  const now = new Date("2026-10-05T03:00:00Z");
  const table = JSON.parse(readFileSync("web/data/horizons.json", "utf8"));
  // 置いてある表（取得した日の値）の中の時刻で描く
  const t = new Date(Date.parse(Object.values(table.probes)[0].start) + 6 * 3600000);
  const withTable = ladderHtml(roomItems(curation, t, table), { now: t, upcoming: [], v1Event: null });
  const pend = (html) => (html.split("いまの距離は準備中")[1] ?? "");
  for (const c of horizonsCards) assert.doesNotMatch(pend(withTable), new RegExp(`data-card="${c.id}"`), `${c.id} は段に並ぶはず`);
  assert.match(withTable, /1000万 km〜[\s\S]*はやぶさ２/);
  const without = ladderHtml(roomItems(curation, now, null), { now, upcoming: [], v1Event: null });
  for (const c of horizonsCards) assert.match(pend(without), new RegExp(`data-card="${c.id}"`), `${c.id} は準備中のはず`);
});

test("web/data/horizons.json：Horizons のカードの表だけ。値は丸めてある（有効数字5桁）", () => {
  const table = JSON.parse(readFileSync("web/data/horizons.json", "utf8"));
  assert.equal(table.step_hours, 24);
  const ids = new Set(horizonsCards.map((c) => c.id));
  for (const [id, t] of Object.entries(table.probes)) {
    assert.ok(ids.has(id), `${id} は Horizons のカードではない`);
    assert.ok(!Number.isNaN(Date.parse(t.start)) && !Number.isNaN(Date.parse(t.downloaded)), id);
    assert.ok(t.km.length >= 2, id);
    for (const km of t.km) {
      assert.ok(km > 0, id);
      assert.equal(km, roundSig(km, 5), `${id}: ${km} は丸めていない`);
    }
  }
});
