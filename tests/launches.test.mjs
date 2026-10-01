import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildLaunches, toLaunch, ageHours } from "../scripts/lib/launches.mjs";
import {
  launchSpan,
  launchWhenShort,
  launchWhenText,
  launchCountdownText,
  bigLaunchCountdown,
  dataState,
  officialMatch,
  worldLaunches,
  siteClusters,
  placeShort,
  launchesListHtml,
  launchPanelHtml,
  REF_NOTE,
  STALE_MS,
} from "../web/js/launches.js";

const config = JSON.parse(readFileSync(new URL("../config/launches.json", import.meta.url), "utf8"));
const api = JSON.parse(readFileSync(new URL("./fixtures/ll2-upcoming.json", import.meta.url), "utf8"));
const fetchedAt = new Date("2026-10-01T23:00:30Z");
const at = (s) => new Date(s);

// ---------- 取得したデータの作り直し（scripts/lib/launches.mjs） ----------

test("Go・TBC で日付まで決まったものを、45日先まで早い順に作り直す（2026-10-01 の実物）", () => {
  const { record, skipped } = buildLaunches(api, config, fetchedAt);
  assert.equal(skipped, 0);
  assert.equal(record.fetched_at, "2026-10-01T23:00:30.000Z");
  // 11/24 のプログレスは45日より先なので入らない
  assert.deepEqual(
    record.launches.map((l) => l.mission.name),
    [
      "NROL-97",
      "SDA Tranche 1 Transport Layer A",
      "NeonSat-2 to 6",
      "積み荷は非公表",
      "Starlink Group 15-25",
      "Dragon CRS-2 SpX-35",
      "Martian Moon eXplorer (MMX)",
    ],
  );
  const [nrol] = record.launches;
  assert.equal(nrol.status, "go");
  assert.equal(nrol.precision, "min");
  assert.equal(nrol.window_end, "2026-10-02T04:42:00.000Z");
  assert.deepEqual(nrol.provider, { name: "SpaceX", ja: "スペースX" });
  assert.equal(nrol.site.ja, "ケネディ宇宙センター");
  assert.equal(nrol.site.country_ja, "アメリカ");
  assert.deepEqual(nrol.site.position, { lat: 28.60822681, lng: -80.60428186 });
  assert.equal(nrol.mission.type_ja, "政府（内容は非公開）");
  assert.equal(nrol.mission.orbit, null); // "Unknown" は書かない
  // 受け取った JSON をそのまま置かない（必要な項目だけ）
  assert.equal("image" in nrol, false);
  assert.equal("url" in nrol, false);
});

test("TBD・月や年までしか決まっていないもの・項目が足りないものは入れない", () => {
  const base = api.results[0];
  assert.ok(toLaunch(base, config));
  assert.equal(toLaunch({ ...base, status: { id: 2 } }, config), null); // TBD
  assert.equal(toLaunch({ ...base, net_precision: { id: 7 } }, config), null); // 月
  assert.equal(toLaunch({ ...base, net: "未定" }, config), null);
  assert.equal(toLaunch({ ...base, pad: null }, config), null);
  // 空中・海上からの打ち上げ（位置なし）は入れるが、ピンは立てない
  const air = toLaunch({ ...base, pad: { ...base.pad, latitude: null, longitude: null } }, config);
  assert.equal(air.site.position, null);
});

test("応答の形が違えば止める（前回のデータを残す）", () => {
  assert.throws(() => buildLaunches({ detail: "Request was throttled." }, config, fetchedAt));
  assert.throws(() => buildLaunches({ results: [{ id: 1 }, { id: 2 }] }, config, fetchedAt));
  assert.equal(buildLaunches({ results: [] }, config, fetchedAt).record.launches.length, 0);
});

test("前回の取得からの時間", () => {
  assert.equal(ageHours({ fetched_at: "2026-10-01T00:00:00Z" }, at("2026-10-02T12:00:00Z")), 36);
  assert.equal(ageHours(null, at("2026-10-02T12:00:00Z")), Infinity);
});

// ---------- 画面（web/js/launches.js） ----------

const data = buildLaunches(api, config, fetchedAt).record;
const byName = (name) => data.launches.find((l) => l.mission.name === name);
// 公式の予定（curation/events/mmx-launch.json と同じ形）
const mmxEvent = {
  id: "mmx-launch",
  kind: "launch",
  title: { ja: "MMX 打ち上げ", en: "MMX launch" },
  when: { value: { at: "2026-10-19T19:41:03Z" } },
  site: { label: "種子島", position: { value: { lat: 30.4009, lng: 130.9750 } } },
};

test("日本時間で出す：分まで・時まで・日付だけ", () => {
  const now = at("2026-10-01T23:30:00Z"); // 日本時間 10/2 8:30
  const nrol = byName("NROL-97");
  assert.deepEqual(launchWhenShort(nrol, now), ["10/2", "12:53"]);
  assert.equal(launchWhenText(nrol), "2026年10月2日（金）12時53分（日本時間）");
  const cz = byName("積み荷は非公表"); // 時まで
  assert.equal(cz.precision, "hour");
  assert.deepEqual(launchWhenShort(cz, now), ["10/10", "4時ごろ"]);
  assert.equal(launchWhenText(cz), "2026年10月10日（土）4時ごろ（日本時間）");
  const day = { ...nrol, precision: "day" };
  assert.deepEqual(launchWhenShort(day, now), ["10/2", "ごろ"]);
  assert.equal(launchWhenText(day), "2026年10月2日（金）ごろ");
  // 年が違えば年を付ける
  assert.deepEqual(launchWhenShort({ ...nrol, net: "2027-01-05T03:00:00Z" }, now), ["2027/1/5", "12:00"]);
});

test("残り時間：分まで・時まで（約）・日付だけ・過ぎたら", () => {
  const nrol = byName("NROL-97");
  assert.equal(launchCountdownText(nrol, at("2026-10-01T23:30:00Z")), "あと4時間23分");
  assert.equal(launchCountdownText(nrol, at("2026-10-02T04:00:00Z")), "予定の時刻を過ぎました");
  assert.equal(launchCountdownText(byName("積み荷は非公表"), at("2026-10-01T23:30:00Z")), "あと約7日19時間");
  assert.equal(launchCountdownText(byName("積み荷は非公表"), at("2026-10-01T23:30:00Z"), { approx: false }), "あと7日19時間");
  assert.equal(launchCountdownText({ ...nrol, precision: "day", net: "2026-10-05T00:00:00Z" }, at("2026-10-01T23:30:00Z")), "あと3日");
  // 大きな残り時間は Go で分まで出ているものだけ
  assert.equal(bigLaunchCountdown(nrol, at("2026-10-01T23:30:00Z")), "0日 04時間 23分 00秒");
  assert.equal(bigLaunchCountdown({ ...nrol, status: "tbc" }, at("2026-10-01T23:30:00Z")), null);
  assert.equal(bigLaunchCountdown(byName("積み荷は非公表"), at("2026-10-01T23:30:00Z")), null);
  assert.equal(bigLaunchCountdown(nrol, at("2026-10-02T04:00:00Z")), null);
});

test("一覧から消す時刻：時刻つきは6時間後、日付だけは日本時間の翌日いっぱい", () => {
  const nrol = byName("NROL-97");
  assert.equal(launchSpan(nrol).end - Date.parse(nrol.net), 6 * 3600000);
  const day = launchSpan({ ...nrol, precision: "day", net: "2026-10-05T03:00:00Z" });
  assert.equal(new Date(day.start).toISOString(), "2026-10-04T15:00:00.000Z"); // 日本時間 10/5 0時
  assert.equal(new Date(day.end).toISOString(), "2026-10-06T15:00:00.000Z"); // 日本時間 10/7 0時
});

test("公式の予定と同じ打ち上げ（MMX）は出さない。延期中の公式の予定とは重ねて出す", () => {
  const now = at("2026-10-01T23:30:00Z");
  const mmx = byName("Martian Moon eXplorer (MMX)");
  assert.equal(officialMatch(mmx, [mmxEvent])?.id, "mmx-launch");
  assert.equal(officialMatch(byName("NROL-97"), [mmxEvent]), null);
  const shown = worldLaunches(data, [mmxEvent], now);
  assert.equal(shown.some((l) => l.id === mmx.id), false);
  assert.equal(shown.length, 6);
  const postponed = { ...mmxEvent, status: { value: "postponed" } };
  assert.equal(worldLaunches(data, [postponed], now).some((l) => l.id === mmx.id), true);
  // 公式の日時から2日以上ずれていれば別の打ち上げ
  assert.equal(officialMatch({ ...mmx, net: "2026-10-25T00:00:00Z" }, [mmxEvent]), null);
});

test("予定の時刻から6時間たったら一覧から消える", () => {
  const nrol = byName("NROL-97");
  const ids = (now) => worldLaunches(data, [], now, at("2026-10-02T00:00:00Z")).map((l) => l.id);
  assert.equal(ids(at("2026-10-02T09:00:00Z")).includes(nrol.id), true);
  assert.equal(ids(at("2026-10-02T09:54:00Z")).includes(nrol.id), false);
});

test("取得から48時間たったデータは出さない（古さは実際の今で判断）", () => {
  const real = new Date(fetchedAt.getTime() + STALE_MS + 1000);
  assert.equal(dataState(data, fetchedAt), "ok");
  assert.equal(dataState(data, real), "stale");
  assert.equal(dataState(null, fetchedAt), "missing");
  assert.equal(worldLaunches(data, [], fetchedAt, real).length, 0);
  assert.match(launchesListHtml([], fetchedAt, { state: "stale", fetchedAt: data.fetched_at }), /古くなっている.*10月2日 8:00/);
});

test("近い射場は1本のピンにまとめる（ケネディとケープカナベラル）", () => {
  const clusters = siteClusters(data.launches);
  const florida = clusters.find((c) => c.launches.some((l) => l.site.short === "ケネディ"));
  assert.deepEqual(
    florida.launches.map((l) => l.site.short),
    ["ケネディ", "ケープカナベラル"],
  );
  assert.deepEqual(
    clusters.map((c) => c.launches[0].site.short),
    ["ケネディ", "ヴァンデンバーグ", "羅老", "文昌", "種子島"],
  );
});

test("場所の短い名前：「ケネディ（アメリカ）」。短い名前がなければ国", () => {
  assert.equal(placeShort(byName("NROL-97")), "ケネディ（アメリカ）");
  assert.equal(placeShort(byName("NROL-97"), { country: false }), "ケネディ");
  const l = byName("NROL-97");
  assert.equal(placeShort({ ...l, site: { ...l.site, short: null } }), "アメリカ");
});

test("一覧の行には「参考」の印と、読み上げ用の説明（aria-describedby）", () => {
  const now = at("2026-10-01T23:30:00Z");
  const html = launchesListHtml(worldLaunches(data, [mmxEvent], now), now, { noteId: "ref-note" });
  assert.equal((html.match(/class="ref-mark"/g) ?? []).length, 6);
  assert.equal((html.match(/aria-describedby="ref-note"/g) ?? []).length, 6);
  assert.ok(html.includes(REF_NOTE));
  assert.ok(html.includes("NROL-97"));
  assert.ok(html.includes("ケネディ（アメリカ）"));
  assert.ok(html.includes("あと4時間23分"));
  assert.equal(launchesListHtml([], now), `<p class="k small">いま載せている世界の打ち上げはありません。</p>`);
});

test("詳細には説明の文を常に出す。出典・取得の時刻・The Space Devs の更新", () => {
  const now = at("2026-10-01T23:30:00Z");
  const html = launchPanelHtml(byName("NROL-97"), now, { fetchedAt: data.fetched_at });
  assert.ok(html.includes(`<span>${REF_NOTE}</span>`));
  assert.ok(html.includes("打ち上げ・参考"));
  assert.ok(html.includes('data-live="countdown"'));
  assert.ok(html.includes("2026年10月2日（金）12時53分（日本時間）"));
  assert.ok(html.includes("打ち上げられる時間：13時42分まで（日本時間）"));
  assert.ok(html.includes("スペースX"));
  assert.ok(html.includes("ケネディ宇宙センター（アメリカ）"));
  assert.ok(html.includes("Launch Library 2（The Space Devs）"));
  assert.ok(html.includes("取得：10月2日 8:00"));
  assert.ok(html.includes("The Space Devs の更新：10月2日 7:24"));
  // 時刻を過ぎたら、結果は公式で
  const after = launchPanelHtml(byName("NROL-97"), at("2026-10-02T05:00:00Z"));
  assert.ok(after.includes("結果は、公式の発表で確かめてください"));
  assert.equal(after.includes('data-live="countdown"'), false);
});
