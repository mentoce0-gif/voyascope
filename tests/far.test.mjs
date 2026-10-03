// 遠くを見る部屋（M7 v0）：距離の計算・数の書き方・カードとはしご・探査機のデータ
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  bodyDistanceKm,
  landmarks,
  probeDistance,
  lightSeconds,
  kmJa,
  kmShortJa,
  kmFullJa,
  lightTimeJa,
  lightYearsJa,
  decadeLabel,
  roundSig,
  LIGHT_DAY_KM,
  BODY_JA,
} from "../web/js/far/distance.js";
import { niceStep, speedText, passedStop, P0, PMAX } from "../web/js/far/fly.js";
import { roomItems, flyStops } from "../web/js/far/room.js";
import { compactCardHtml, fullCardHtml, ladderHtml, distanceParts } from "../web/js/far/probe-card.js";
import { upcomingEvents } from "../web/js/events.js";

const NOW = new Date("2026-10-03T12:00:00Z"); // 日本時間 21:00
// 画面のテストは、2026-10-03 のカードを写したもの（tests/fixtures/far-room.json）で行う。
// カード（curation/）を直してもテストが変わらないように。いまのカードは最後の2つのテストで確かめる
const { probes, events } = JSON.parse(readFileSync("tests/fixtures/far-room.json", "utf8"));
const curationProbes = readdirSync("curation/probes")
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(join("curation/probes", f), "utf8")));
const strip = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("距離の計算：月・太陽・火星（2026-10-03）は、ありうる範囲に入る", () => {
  const moon = bodyDistanceKm("Moon", NOW);
  const sun = bodyDistanceKm("Sun", NOW);
  const mars = bodyDistanceKm("Mars", NOW);
  assert.ok(moon > 356000 && moon < 407000, `月 ${moon}`);
  // 10月初めの地球と太陽の距離は約1億4970万km（光で約8分19秒）
  assert.ok(Math.abs(sun - 1.4969e8) < 0.002e8, `太陽 ${sun}`);
  assert.equal(lightTimeJa(lightSeconds(sun)), "8 分 19 秒");
  // 火星は約2億4700万km（この日の値。水星・木星もここから計算できる）
  assert.ok(Math.abs(mars - 2.466e8) < 0.01e8, `火星 ${mars}`);
  for (const b of ["Mercury", "Venus", "Jupiter", "Saturn"]) assert.ok(bodyDistanceKm(b, NOW) > 4e7, b);
  assert.throws(() => bodyDistanceKm("Pluto", NOW), /計算できない天体/);
});

test("1光日：光が24時間で進む距離（NASA の 25.902 billion km と同じ）", () => {
  assert.equal(Math.round(LIGHT_DAY_KM), 25902068371);
  assert.equal((LIGHT_DAY_KM / 1e9).toFixed(3), "25.902");
  assert.equal(lightTimeJa(lightSeconds(LIGHT_DAY_KM)), "24 時間");
  const marks = landmarks(NOW);
  assert.deepEqual(marks.map((m) => m.id), ["moon", "sun", "light-day"]);
});

test("探査機の距離：カードの書き方どおり（推測の値を作らない）", () => {
  const card = (distance) => ({ distance });
  assert.equal(probeDistance(card({ method: "planet", body: "Mars" }), NOW).km, bodyDistanceKm("Mars", NOW));
  assert.deepEqual(probeDistance(card({ method: "typical", value: 1500000, unit: "km" }), NOW), { km: 1500000, method: "typical", approx: true });
  assert.deepEqual(probeDistance(card({ method: "dated", value: 9.5e9, unit: "km", at: "2026-06-23" }), NOW), {
    km: 9.5e9,
    method: "dated",
    at: "2026-06-23",
    approx: true,
  });
  assert.equal(probeDistance(card({ method: "on_earth" }), NOW).km, 0);
  assert.equal(probeDistance(card({ method: "pending" }), NOW), null);
  assert.equal(probeDistance({}, NOW), null);
});

test("数の書き方：万・億で区切る／短い書き方／ぜんぶの桁", () => {
  assert.equal(kmJa(246566337), "2億4,700万 km");
  assert.equal(kmJa(149692153), "1億5,000万 km");
  assert.equal(kmJa(370080), "37万 km");
  assert.equal(kmJa(384400), "38万4,000 km");
  assert.equal(kmJa(1500000, 2), "150万 km");
  assert.equal(kmJa(9.5e9, 2), "95億 km");
  assert.equal(kmJa(2.5e12), "2兆5,000億 km");
  assert.equal(kmJa(100), "100 km");
  assert.equal(kmShortJa(246566337), "2.47億 km");
  assert.equal(kmShortJa(LIGHT_DAY_KM), "259億 km");
  assert.equal(kmShortJa(1500000, 2), "150万 km");
  assert.equal(kmFullJa(LIGHT_DAY_KM), "25,902,068,371 km");
  assert.equal(roundSig(0, 3), 0);
});

test("光の時間：細かい値と、目安の値（丸めて「約」）", () => {
  assert.equal(lightTimeJa(0.000333), "0.0003 秒");
  assert.equal(lightTimeJa(1.234), "1.2 秒");
  assert.equal(lightTimeJa(822.4), "13 分 42 秒");
  assert.equal(lightTimeJa(3 * 3600 + 5 * 60), "3 時間 5 分");
  assert.equal(lightTimeJa(5.003, { approx: true }), "約 5 秒");
  assert.equal(lightTimeJa(820, { approx: true }), "約 14 分");
  // ニュー・ホライズンズ：約95億km → 約8時間50分（NASA の記事の「約8時間52分」とも合う丸め）
  assert.equal(lightTimeJa(lightSeconds(9.5e9), { approx: true }), "約 8 時間 50 分");
  assert.equal(lightTimeJa(8 * 3600 + 52 * 60, { approx: true }), "約 8 時間 50 分");
  assert.equal(lightTimeJa(-1), "0.0000 秒");
});

test("光年と、はしごの段の名前", () => {
  assert.equal(lightYearsJa(LIGHT_DAY_KM), "0.00274 光年");
  assert.equal(lightYearsJa(100), "1.1×10⁻¹¹ 光年");
  assert.deepEqual([5, 6, 7, 8, 9, 10].map(decadeLabel), ["10万 km〜", "100万 km〜", "1000万 km〜", "1億 km〜", "10億 km〜", "100億 km〜"]);
  assert.equal(decadeLabel(3), "1000 km〜");
  assert.equal(decadeLabel(12), "1兆 km〜");
});

test("飛ぶ画面：目盛りの間隔・速さの表示・通り過ぎた場所", () => {
  assert.equal(niceStep(100), 20);
  assert.equal(niceStep(LIGHT_DAY_KM), 5e9);
  assert.equal(niceStep(3.7e5), 1e5);
  assert.deepEqual(speedText(1e6, 0), { text: "停止中", warp: false });
  assert.deepEqual(speedText(1000, 0.1), { text: "秒速 230 km", warp: false });
  const warp = speedText(1.5e8, 1);
  assert.equal(warp.warp, true);
  assert.equal(warp.text, "ワープ中：光の 1,152 倍"); // 1.5億km × ln10 × 1桁/秒 ÷ 光の速さ
  const stops = [
    { id: "earth", km: 100 },
    { id: "moon", km: 3.8e5 },
    { id: "sun", km: 1.5e8 },
  ];
  assert.equal(passedStop(stops, P0).id, "earth");
  assert.equal(passedStop(stops, Math.log10(3.8e5) - 0.01).id, "moon"); // 少し手前でカードを出す
  assert.equal(passedStop(stops, 7).id, "moon");
  assert.equal(passedStop(stops, PMAX).id, "sun");
  assert.ok(PMAX > Math.log10(LIGHT_DAY_KM));
});

test("部屋に並べるもの：くらべる目安と9機。距離のあるものだけが飛ぶ画面に出る", () => {
  const items = roomItems(probes, NOW);
  assert.equal(items.filter((it) => it.kind === "probe").length, 9);
  const byId = Object.fromEntries(items.map((it) => [it.id, it]));
  assert.equal(byId.perseverance.dist.method, "planet");
  assert.equal(byId.jwst.dist.km, 1500000);
  assert.equal(byId["new-horizons"].dist.at, "2026-06-23");
  assert.equal(byId.mmx.dist.method, "on_earth");
  for (const id of ["parker-solar-probe", "hayabusa2", "voyager-1", "voyager-2"]) assert.equal(byId[id].dist, null, id);
  const stops = flyStops(items);
  assert.equal(stops[0].id, "earth");
  assert.deepEqual(
    stops.map((s) => s.id).sort(),
    ["bepicolombo", "earth", "jwst", "light-day", "moon", "new-horizons", "perseverance", "sun"].sort(),
  );
});

test("はしご：段に入る場所・地上（打ち上げ前）・準備中の一覧・ボイジャー1号の予告", () => {
  const items = roomItems(probes, NOW);
  const upcoming = upcomingEvents(events, NOW);
  const v1Event = upcoming.find((ev) => ev.id === "voyager-1-one-light-day");
  const html = ladderHtml(items, { now: NOW, upcoming, v1Event });
  const text = strip(html);
  // 段の順（下へ行くほど10倍遠い）。1000万km〜 の段は空
  const order = ["地上", "10万 km〜", "100万 km〜", "1000万 km〜", "1億 km〜", "10億 km〜", "100億 km〜", "いまの距離は準備中"];
  const at = order.map((w) => text.indexOf(w));
  assert.ok(at.every((i, n) => i >= 0 && (n === 0 || i > at[n - 1])), JSON.stringify(at));
  // 段ごとに切り分ける（段の名前から次の段の名前まで）
  const rung = (label) => html.split('class="rung-scale').find((seg) => seg.includes(`>${label}</span>`)) ?? "";
  assert.match(rung("10万 km〜"), /data-go="moon"/);
  assert.match(rung("100万 km〜"), /data-go="jwst"/);
  assert.match(rung("1000万 km〜"), /rung-empty/);
  assert.match(rung("1億 km〜"), /data-go="sun"[\s\S]*data-go="bepicolombo"[\s\S]*data-go="perseverance"/);
  assert.match(rung("10億 km〜"), /data-go="new-horizons"/);
  assert.match(rung("100億 km〜"), /data-go="light-day"/);
  assert.match(text, /ボイジャー1号が 11月18日（水）19:16 にここへ（NASA の予告）/);
  assert.match(rung("地上"), /data-card="mmx"/);
  assert.match(text, /10月20日（火）4:41 MMX の打ち上げ/);
  const pending = html.slice(html.indexOf("いまの距離は準備中"));
  for (const id of ["parker-solar-probe", "hayabusa2", "voyager-1", "voyager-2"]) assert.match(pending, new RegExp(`data-card="${id}"`));
  // 目安・日付つきの値は「約」と、どうやって出した値かを書く
  assert.match(text, /ジェイムズ・ウェッブ宇宙望遠鏡 約150万 km 目安（その日の距離ではない）/);
  assert.match(text, /ニュー・ホライズンズ 約95億 km 2026年6月23日の値/);
  assert.match(text, /パーサヴィアランス 2\.47億 km 火星までの距離（計算）/);
  // 予告の日が過ぎたら、1光日の段にボイジャー1号の予告を出さない
  const after = new Date("2026-11-20T00:00:00Z");
  const up2 = upcomingEvents(events, after);
  assert.doesNotMatch(strip(ladderHtml(roomItems(probes, after), { now: after, upcoming: up2, v1Event: up2.find((ev) => ev.id === "voyager-1-one-light-day") ?? null })), /ボイジャー1号が/);
});

test("飛んでいるときのカード：通り過ぎた場所ごと", () => {
  const items = roomItems(probes, NOW);
  const upcoming = upcomingEvents(events, NOW);
  const v1Event = upcoming.find((ev) => ev.id === "voyager-1-one-light-day");
  const ctx = { now: NOW, upcoming, v1Event };
  const byId = Object.fromEntries(items.map((it) => [it.id, it]));
  assert.equal(compactCardHtml(null, ctx), "");
  assert.equal(compactCardHtml({ kind: "earth" }, ctx), "");
  assert.match(strip(compactCardHtml(byId.sun, ctx)), /いま見ている太陽の光は、8 分 19 秒前に太陽を出た光/);
  assert.match(strip(compactCardHtml(byId.moon, ctx)), /光なら 1\.2 秒で着く/);
  const ld = compactCardHtml(byId["light-day"], ctx);
  assert.match(strip(ld), /ボイジャー1号は 11月18日（水）19:16、ここに届く予定（NASA）/);
  assert.match(ld, /data-card="voyager-1"/);
  assert.doesNotMatch(compactCardHtml(byId["light-day"], { ...ctx, v1Event: null }), /ボイジャー1号/);
  const bepi = strip(compactCardHtml(byId.bepicolombo, ctx));
  assert.match(bepi, /水星までの距離（計算）/);
  assert.match(bepi, /11月21日（土） ベピコロンボが水星を回る軌道に入る （あと49日）/);
  assert.match(compactCardHtml(byId.bepicolombo, ctx), /data-card="bepicolombo"/);
});

test("くわしいカード：事実ごとに出典。距離が出せないものは「準備中」", () => {
  const items = roomItems(probes, NOW);
  const upcoming = upcomingEvents(events, NOW);
  const ctx = { now: NOW, upcoming };
  for (const it of items.filter((x) => x.kind === "probe")) {
    const html = fullCardHtml(it, ctx);
    const c = it.card;
    for (const f of [c.location, c.status, c.mission, c.operator, c.launch_date]) assert.ok(html.includes(`href="${f.source}"`), `${it.id} ${f.source}`);
    for (const l of c.official_links) assert.ok(html.includes(`href="${l.url}"`), `${it.id} ${l.url}`);
    assert.match(html, /非公式ファンメイド作品です/);
  }
  const byId = Object.fromEntries(items.map((it) => [it.id, it]));
  assert.match(strip(fullCardHtml(byId["voyager-2"], ctx)), /いまの距離は、探査機の位置のデータを使えるようになってから出します（準備中）/);
  assert.match(strip(fullCardHtml(byId.mmx, ctx)), /打ち上げ前 （10月3日に確認）/);
  assert.match(strip(fullCardHtml(byId.mmx, ctx)), /2026年10月20日（火）4時41分03秒（日本時間） MMX の打ち上げ/);
  assert.match(fullCardHtml(byId.jwst, ctx), /L2 までの目安/);
  // 名前などは HTML として読まない
  const evil = { ...byId.jwst, card: { ...byId.jwst.card, name: { ja: "<img src=x>", en: "x" } } };
  assert.doesNotMatch(fullCardHtml(evil, ctx), /<img src=x>/);
  assert.deepEqual(distanceParts({ kind: "probe", dist: null }), { km: null, how: "準備中", lt: null });
});

test("いまの探査機のカード：惑星の計算に使う天体は計算できるもの。日付つきの値は確かめた日より前", () => {
  assert.ok(curationProbes.length > 0);
  for (const p of curationProbes) {
    const d = p.distance;
    if (d.method === "planet") assert.ok(BODY_JA[d.body], `${p.id}: ${d.body}`);
    if (d.method === "dated") assert.ok(d.at <= d.as_of, `${p.id}: ${d.at} > ${d.as_of}`);
    if (p.status.value === "not_launched") assert.equal(d.method, "on_earth", p.id);
  }
  // web/data/probes.json は curation/probes と同じ（npm run sync:web）
  const web = JSON.parse(readFileSync("web/data/probes.json", "utf8")).probes;
  assert.deepEqual(web, curationProbes);
  // 画面の部品で、いまのカードがそのまま描ける
  const items = roomItems(curationProbes, NOW);
  const html = ladderHtml(items, { now: NOW, upcoming: [], v1Event: null });
  for (const p of curationProbes) assert.ok(html.includes(`"${p.id}"`), p.id);
  for (const it of items.filter((x) => x.kind === "probe")) assert.match(fullCardHtml(it, { now: NOW, upcoming: [] }), /出典/);
});

test("検証（validate.mjs）：探査機カードの出典なし・ない予定・打ち上げ前の距離を落とす", () => {
  const root = mkdtempSync(join(tmpdir(), "voyascope-probes-"));
  try {
    mkdirSync(join(root, "probes"), { recursive: true });
    mkdirSync(join(root, "events"), { recursive: true });
    for (const ev of events) writeFileSync(join(root, "events", `${ev.id}.json`), JSON.stringify(ev));
    const base = probes.find((p) => p.id === "mmx"); // 打ち上げ前のカード（2026-10-03）
    const bad1 = { ...base, id: "bad-source", location: { value: "どこか" } };
    const bad2 = { ...base, id: "bad-event", events: ["no-such-event"] };
    const bad3 = { ...base, id: "bad-distance", distance: { method: "planet", body: "Mars", source: "https://example.org/", as_of: "2026-10-03" } };
    const bad4 = { ...base, id: "bad-method", distance: { method: "guess", value: 1 } };
    const bad5 = { ...base, id: "bad-dated", status: { ...base.status, value: "operating" }, distance: { method: "dated", value: 9.5e9, unit: "km", source: "https://example.org/", as_of: "2026-10-03" } };
    for (const c of [bad1, bad2, bad3, bad4, bad5]) writeFileSync(join(root, "probes", `${c.id}.json`), JSON.stringify(c));
    const r = spawnSync(process.execPath, ["scripts/validate.mjs", root], { encoding: "utf8" });
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /bad-source\.json \/location: 必須項目 "source" がありません/);
    assert.match(r.stdout, /bad-event\.json: events "no-such-event" が events\/ にありません/);
    assert.match(r.stdout, /bad-distance\.json: 打ち上げ前（not_launched）の距離は on_earth にします/);
    assert.match(r.stdout, /bad-method\.json \/distance\/method: 使えない値です/);
    assert.match(r.stdout, /bad-dated\.json \/distance: 必須項目 "at" がありません/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
