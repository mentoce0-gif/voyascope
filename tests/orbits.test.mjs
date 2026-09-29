import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGpResponse, dueForFetch, isNewer, buildRecord, gpUrl, epochIso } from "../scripts/lib/orbits.mjs";
import { satrecFromOrbit, positionAt, periodMinutes } from "../web/js/orbit.js";

// 2026-09-28 にオーナーが取得した ISS の TLE と、同じ要素を OMM（JSON）で書いたもの
const TLE = {
  line1: "1 25544U 98067A   26271.46476993  .00006013  00000+0  11848-3 0  9990",
  line2: "2 25544  51.6312 148.9632 0007159 198.2260 161.8473 15.48680135587767",
};
const OMM = {
  OBJECT_NAME: "ISS (ZARYA)",
  OBJECT_ID: "1998-067A",
  EPOCH: "2026-09-28T11:09:16.121952",
  MEAN_MOTION: 15.48680135,
  ECCENTRICITY: 0.0007159,
  INCLINATION: 51.6312,
  RA_OF_ASC_NODE: 148.9632,
  ARG_OF_PERICENTER: 198.226,
  MEAN_ANOMALY: 161.8473,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: "U",
  NORAD_CAT_ID: 25544,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 58776,
  BSTAR: 0.00011848,
  MEAN_MOTION_DOT: 0.00006013,
  MEAN_MOTION_DDOT: 0,
};
const body = JSON.stringify([OMM]);

test("OMM と TLE で同じ位置になる（1 km 以内）", () => {
  const a = satrecFromOrbit({ format: "omm", omm: OMM });
  const b = satrecFromOrbit({ format: "tle", tle: TLE });
  for (const hours of [0, 6, 24, 72]) {
    const t = new Date(Date.parse("2026-09-28T11:09:16Z") + hours * 3600e3);
    const p = positionAt(a, t);
    const q = positionAt(b, t);
    const dKm = Math.hypot((p.lat - q.lat) * 111, (p.lng - q.lng) * 111 * Math.cos((p.lat * Math.PI) / 180), p.altKm - q.altKm);
    assert.ok(dKm < 1, `${hours}時間後の差 ${dKm.toFixed(3)} km`);
  }
  assert.ok(Math.abs(periodMinutes(a) - 92.98) < 0.1);
});

test("正しい応答は読める", () => {
  assert.equal(parseGpResponse(body, 25544).OBJECT_NAME, "ISS (ZARYA)");
});

test("おかしな応答は例外になる", () => {
  assert.throws(() => parseGpResponse("No GP data found", 25544), /JSON/);
  assert.throws(() => parseGpResponse("[]", 25544), /0 件/);
  assert.throws(() => parseGpResponse(JSON.stringify([OMM, OMM]), 25544), /2 件/);
  assert.throws(() => parseGpResponse(body, 20580), /NORAD/);
  assert.throws(() => parseGpResponse(JSON.stringify([{ ...OMM, MEAN_MOTION: "abc" }]), 25544), /MEAN_MOTION/);
  assert.throws(() => parseGpResponse(JSON.stringify([{ ...OMM, EPOCH: "yesterday" }]), 25544), /EPOCH/);
});

test("前回から2時間たっていなければ取りに行かない", () => {
  const now = new Date("2026-09-29T12:00:00Z");
  assert.equal(dueForFetch(null, now), true);
  assert.equal(dueForFetch({ fetched_at: "2026-09-29T10:30:00Z" }, now), false);
  assert.equal(dueForFetch({ fetched_at: "2026-09-29T10:00:00Z" }, now), true);
});

test("エポックが新しいときだけ書き換える", () => {
  assert.equal(isNewer(null, OMM), true);
  assert.equal(isNewer({ epoch: "2026-09-28T11:09:16.121Z" }, OMM), false);
  assert.equal(isNewer({ epoch: "2026-09-27T00:00:00Z" }, OMM), true);
  assert.equal(isNewer({ epoch: "2026-09-30T00:00:00Z" }, OMM), false);
});

test("保存する形", () => {
  const r = buildRecord({ id: "iss", noradId: 25544, omm: OMM, fetchedAt: new Date("2026-09-29T00:00:00Z") });
  assert.equal(r.format, "omm");
  assert.equal(r.epoch, epochIso(OMM));
  assert.equal(r.source, gpUrl(25544));
  assert.equal(r.source, "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=JSON");
  assert.doesNotThrow(() => satrecFromOrbit(r));
});

test("web/data/orbits/ のファイルはどれも読める", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  for (const f of readdirSync("web/data/orbits")) {
    const orbit = JSON.parse(readFileSync(`web/data/orbits/${f}`, "utf8"));
    assert.ok(orbit.source?.startsWith("https://"), `${f}: source`);
    assert.ok(!Number.isNaN(Date.parse(orbit.fetched_at)), `${f}: fetched_at`);
    assert.ok(positionAt(satrecFromOrbit(orbit), new Date(orbit.epoch)), `${f}: 位置を計算できない`);
  }
});
