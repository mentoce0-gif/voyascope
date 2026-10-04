import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LAND_SOURCE, LAND_OUTPUT, landMinimapJson } from "../scripts/lib/minimap-land.mjs";
import { renderMinimap } from "../web/js/minimap.js";

test("ミニ地図の陸地（計算済み）は、陸地の GeoJSON から作った最新のもの", () => {
  const expected = landMinimapJson(JSON.parse(readFileSync(LAND_SOURCE, "utf8")));
  assert.equal(readFileSync(LAND_OUTPUT, "utf8"), expected, "node scripts/build-minimap-land.mjs で作り直してください");
  const { d } = JSON.parse(expected);
  assert.match(d, /^M[\d.]+ [\d.]+L/);
  assert.ok(d.length > 10000);
});

test("ミニ地図：陸地が届く前（空文字）でも、海と軌跡と現在地は描く", () => {
  const svg = { innerHTML: "" };
  const segments = [
    [
      { lat: 10, lng: 100, past: true },
      { lat: 12, lng: 110, past: true },
      { lat: 14, lng: 120, past: false },
      { lat: 16, lng: 130, past: false },
    ],
  ];
  renderMinimap(svg, { land: "", segments, pos: { lat: 12, lng: 110 } });
  assert.match(svg.innerHTML, /class="mm-sea"/);
  assert.match(svg.innerHTML, /<path d="" class="mm-land"\/>/);
  assert.match(svg.innerHTML, /class="mm-past"/);
  assert.match(svg.innerHTML, /class="mm-future"/);
  assert.match(svg.innerHTML, /class="mm-now"/);
  renderMinimap(svg, { land: "M0 0L10 0L10 10Z", segments, pos: null });
  assert.match(svg.innerHTML, /<path d="M0 0L10 0L10 10Z" class="mm-land"\/>/);
});
