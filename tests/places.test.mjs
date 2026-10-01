import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { placeAt } from "../web/js/places.js";

const places = JSON.parse(readFileSync("web/data/places.json", "utf8"));
const at = (lat, lng) => placeAt(places, lat, lng)?.name ?? null;

test("どこの上：陸は国の名前", () => {
  assert.equal(at(35.7, 139.7), "日本"); // 東京
  assert.equal(at(43.06, 141.35), "日本"); // 札幌
  assert.equal(at(26.3, 127.8), "日本"); // 沖縄本島
  assert.equal(at(39.9, -100), "アメリカ合衆国");
  assert.equal(at(-25, 134), "オーストラリア");
  assert.equal(at(-80, 0), "南極大陸");
});

test("どこの上：日本の立場の境界（北方領土・クリミア）", () => {
  assert.equal(at(45.0, 147.6), "日本"); // 択捉島
  assert.equal(at(45.0, 34.1), "ウクライナ"); // クリミア
  assert.equal(at(23.7, 121), "台湾");
});

test("どこの上：海は海の名前", () => {
  assert.equal(at(20, -150), "太平洋");
  assert.equal(at(-30, 80), "インド洋");
  assert.equal(at(30, -40), "大西洋");
  assert.equal(at(40, 135), "日本海");
});

test("どこの上：経度は±180をこえても同じ", () => {
  assert.equal(at(35.7, 139.7 + 360), "日本");
  assert.equal(at(20, 210), "太平洋");
});

test("どこの上：分からなければ null", () => {
  assert.equal(placeAt(places, NaN, 0), null);
  assert.equal(placeAt(null, 0, 0), null);
});
