// 遠くを見る部屋の 3D の旅（タスク015）：停留所の作り方・文・番号・見せ方の決まり。
// 3D の描画そのもの（WebGL）はブラウザで確かめる（docs/tasks/015-far-room-journey.md）
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { journeyStops, titleHtml, speedInfo, lightYears, angleText, LOOK, TRAVEL, GATE_COMPANION, P0, PMAX } from "../web/js/far/journey.js";
import { MODELS } from "../web/js/far/models.js";
import { roomItems, stopNumbers } from "../web/js/far/room.js";
import { eventTitleWithout } from "../web/js/far/probe-card.js";
import { LIGHT_DAY_KM, lightTimeJa, lightSeconds, C_KM_S } from "../web/js/far/distance.js";
import { upcomingEvents } from "../web/js/events.js";

const NOW = new Date("2026-10-03T12:00:00Z"); // 日本時間 21:00
const { probes, events } = JSON.parse(readFileSync("tests/fixtures/far-room.json", "utf8"));
const curation = readdirSync("curation/probes")
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join("curation/probes", f), "utf8")));
const strip = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const ctxAt = (now) => {
  const upcoming = upcomingEvents(events, now);
  return { now, upcoming, v1Event: upcoming.find((ev) => ev.id === "voyager-1-one-light-day") ?? null };
};

test("停留所：距離のある場所を近い順に。準備中・地上のものは入れない。ボイジャー1号は1光日のそばに置き、停留所を作らない", () => {
  const items = roomItems(probes, NOW); // 2026-10-03 のカード（Horizons の表なし：4機は準備中）
  const stops = journeyStops(items, ctxAt(NOW));
  assert.deepEqual(
    stops.map((st) => st.id),
    ["moon", "jwst", "sun", "bepicolombo", "perseverance", "new-horizons", "light-day"],
  );
  for (let i = 1; i < stops.length; i++) assert.ok(stops[i].km >= stops[i - 1].km, `${stops[i].id} の順`);
  // ボイジャー1号の距離がまだない（準備中）ときも、予告があれば輪のそばに置く。距離は書かない
  const gate = stops.at(-1);
  assert.deepEqual(gate.companion, { name: "ボイジャー1号", dist: null, how: null, beyond: false });
  assert.equal(gate.how, "光が24時間で進む距離");
  assert.equal(gate.card, GATE_COMPANION); // 「探査機をもっと知る」はボイジャー1号のカード
});

test("停留所の文：月・太陽は光の時間から、探査機はカードの「いま」、予定は名前を省いて短く", () => {
  const items = roomItems(probes, NOW);
  const byId = Object.fromEntries(journeyStops(items, ctxAt(NOW)).map((st) => [st.id, st]));
  const moonLt = lightTimeJa(lightSeconds(byId.moon.km));
  assert.equal(byId.moon.text, `光なら ${moonLt}で着く。ここまでは、ほとんど一瞬`);
  assert.equal(byId.sun.text, "いま見ている太陽の光は、8 分 19 秒前に太陽を出た光");
  assert.equal(byId.moon.en, "THE MOON");
  assert.equal(byId.moon.dist, "370,080 km"); // 計算した値はぜんぶの桁
  assert.equal(byId.moon.tag, "");
  const jwst = probes.find((p) => p.id === "jwst");
  assert.equal(byId.jwst.text, jwst.location.value);
  assert.equal(byId.jwst.en, "JAMES WEBB SPACE TELESCOPE");
  assert.equal(byId.jwst.dist, "約150万 km"); // 目安は丸めて「約」
  assert.equal(byId.jwst.tag, "目安");
  assert.equal(byId.jwst.card, "jwst");
  // ベピコロンボの予定：名前のすぐ下なので「ベピコロンボが」を省く。読み上げは元の名前のまま
  assert.equal(strip(byId.bepicolombo.event), "11月21日（土） 水星を回る軌道に入る （あと49日）");
  assert.match(byId.bepicolombo.sayEvent, /ベピコロンボが水星を回る軌道に入る/);
  // 1光日：ボイジャー1号の予告（NASA）
  assert.equal(byId["light-day"].text, "ボイジャー1号は 11月18日（水）19:16、ここに届く予定（NASA）。人がつくったもので、はじめて");
  assert.equal(byId["light-day"].dist, "25,902,068,371 km");
  // 予告の日が過ぎたら、ボイジャー1号のカードの「いま」
  const after = new Date("2026-11-20T00:00:00Z");
  const gate = journeyStops(roomItems(probes, after), ctxAt(after)).at(-1);
  assert.equal(gate.text, `ボイジャー1号は、${probes.find((p) => p.id === "voyager-1").location.value}`);
  assert.equal(gate.companion, null); // 距離も予告もないときは、輪のそばに置かない
});

test("停留所：Horizons の表があれば、はやぶさ２・パーカー・ボイジャー2号も停留所に。1光日には、ボイジャー1号のいまの距離", () => {
  const table = JSON.parse(readFileSync("web/data/horizons.json", "utf8"));
  // 置いてある表（取得した日の値）の中の時刻で
  const t = new Date(Date.parse(Object.values(table.probes)[0].start) + 6 * 3600000);
  const items = roomItems(curation, t, table);
  const stops = journeyStops(items, { now: t, upcoming: [], v1Event: null });
  const ids = stops.map((st) => st.id);
  assert.equal(ids[0], "moon");
  assert.equal(ids.at(-1), "light-day");
  for (const id of ["jwst", "hayabusa2", "parker-solar-probe", "bepicolombo", "perseverance", "juno", "new-horizons", "voyager-2"]) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes(GATE_COMPANION) && !ids.includes("mmx"));
  for (let i = 1; i < stops.length; i++) assert.ok(stops[i].km >= stops[i - 1].km, `${stops[i].id} の順`);
  const hz = stops.find((st) => st.id === "hayabusa2");
  assert.equal(hz.tag, "計算値");
  assert.match(hz.dist, /^約[\d.,]+(万|億) km$/);
  assert.match(hz.how, /^Horizons の計算値（\d+月\d+日に取得）$/);
  const gate = stops.at(-1);
  assert.ok(gate.companion?.dist, "ボイジャー1号の距離");
  assert.equal(gate.companion.beyond, items.find((it) => it.id === GATE_COMPANION).dist.km >= LIGHT_DAY_KM);
  assert.match(gate.how, /^ボイジャー1号は いま約\d+億 km・Horizons の計算値（\d+月\d+日に取得）$/);
  // はしごの番号：ボイジャー1号は、模型を置いている1光日と同じ番号
  const n = stopNumbers(stops);
  assert.equal(n.moon, 1);
  assert.equal(n["light-day"], stops.length);
  assert.equal(n[GATE_COMPANION], stops.length);
});

test("見せ方：いまのカードで距離を出せる探査機には、見せ方（LOOK）と向かうときの言葉がある。模型は models.js にある", () => {
  for (const c of curation) {
    if (["on_earth", "pending"].includes(c.distance.method) || c.id === GATE_COMPANION) continue;
    assert.ok(LOOK[c.id], `${c.id} の見せ方（web/js/far/journey.js の LOOK）がない。足すまで 3D の旅に出てこない`);
  }
  for (const [id, lk] of Object.entries(LOOK)) {
    assert.ok(TRAVEL[id], `${id} の向かうときの言葉（TRAVEL）`);
    if (lk.model) assert.equal(typeof MODELS[lk.model], "function", `${id} の模型 ${lk.model}`);
    assert.ok(["body", "model", "duo", "gate"].includes(lk.kind), id);
    if (lk.swing === "gravity") assert.ok(lk.body && lk.by, `${id}：スイングバイは天体のそばだけ`);
  }
  // 天体は1つの停留所に1つ（同じ天体を2か所に置かない）
  const bodies = Object.values(LOOK).map((lk) => lk.body).filter(Boolean);
  assert.equal(new Set(bodies).size, bodies.length);
});

test("名前と予定：長い名前は「・」で折り返せる。予定の名前から機体の名前を省く（ほかは変えない）", () => {
  assert.equal(titleHtml({ id: "jwst", name: "ジェイムズ・ウェッブ宇宙望遠鏡" }), 'ジェイムズ・ウェッブ<br class="br-wide">宇宙望遠鏡');
  assert.equal(titleHtml({ id: "parker-solar-probe", name: "パーカー・ソーラー・プローブ" }), "パーカー・<wbr>ソーラー・<wbr>プローブ");
  assert.equal(titleHtml({ id: "x", name: "<b>月</b>" }), "&lt;b&gt;月&lt;/b&gt;");
  assert.equal(eventTitleWithout("ベピコロンボが水星を回る軌道に入る", "ベピコロンボ（みお）"), "水星を回る軌道に入る");
  assert.equal(eventTitleWithout("はやぶさ2 の地球スイングバイ", "はやぶさ２"), "地球スイングバイ");
  assert.equal(eventTitleWithout("ボイジャー1号が地球から1光日に", "ボイジャー1号"), "地球から1光日に");
  assert.equal(eventTitleWithout("MMX の打ち上げ", "火星衛星探査機（MMX）"), "MMX の打ち上げ");
  assert.equal(eventTitleWithout("「みお」と MPO が分かれる", "ベピコロンボ（みお）"), "「みお」と MPO が分かれる");
  assert.equal(eventTitleWithout("ジュノー", "ジュノー"), "ジュノー");
});

test("計器：速さ（光より速いとワープ・作り話）・光年・地球の見かけの大きさ", () => {
  assert.deepEqual(speedInfo(1e6, 0.02, 0.1), { text: "いまの速さ 0 km/秒", warp: 0 });
  const slow = speedInfo(1000, 0.02, 1);
  assert.equal(slow.text, "いまの速さ 秒速 46 km"); // 1000 km × ln10 × 0.02 桁/単位 × 1 単位/秒
  const warp = speedInfo(1.5e8, 0.02, 50);
  assert.equal(warp.fiction, true);
  assert.match(warp.text, /^ワープ中：光の [\d,]+ 倍$/);
  assert.ok(warp.warp > 0 && warp.warp <= 1);
  assert.equal(Math.round((1.5e8 * Math.LN10 * 0.02 * 50) / C_KM_S), Number(warp.text.match(/[\d,]+/)[0].replace(/,/g, "")));
  assert.equal(lightYears(LIGHT_DAY_KM), "0.002738");
  assert.equal(angleText(20.5), "21 度");
  assert.equal(angleText(1.234), "1.2 度");
  assert.equal(angleText(0.0055), "0.0055 度");
  assert.ok(P0 === 2 && PMAX > Math.log10(LIGHT_DAY_KM));
});
