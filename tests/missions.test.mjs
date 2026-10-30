import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

// 「一言でわかる」ページ（build-summaries.mjs が作る）の5つの問いと、図のデータ（visual.js が読む）
const dir = new URL("../web/missions/", import.meta.url);
const ids = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== "artemis2").map((d) => d.name);
const html = (id) => readFileSync(new URL(`${id}/index.html`, dir), "utf8");
const data = (id) => JSON.parse(html(id).match(/<script type="application\/json" id="vis-data">(.*?)<\/script>/)[1]);

test("カードから作るページは、どれも Q1〜Q4 と図の置き場所・図のデータ・visual.js を持つ", () => {
  assert.ok(ids.length >= 18);
  for (const id of ids) {
    const h = html(id);
    for (const n of [1, 2, 3, 4]) {
      assert.match(h, new RegExp(`id="q${n}"`), `${id} Q${n}`);
      assert.match(h, new RegExp(`<figure class="vis" data-q="${n}" hidden></figure>`), `${id} 図 Q${n}`);
    }
    assert.match(h, /<script type="module" src="\.\.\/visual\.js"><\/script>/);
    const v = data(id);
    assert.equal(v.id, id);
    assert.ok(v.q1.text && v.q1.src, `${id} q1`);
    assert.ok(Array.isArray(v.q4) && v.q4.filter((i) => i.kind === "now").length === 1, `${id} q4 のいまは1つ`);
  }
});

test("図のデータはページの本文と同じ値（距離・光の時間）", () => {
  const v = data("voyager-1");
  const h = html("voyager-1");
  assert.equal(v.model, "voyager");
  assert.ok(h.includes(`地球から <b>${v.q3.text}</b>`));
  assert.ok(h.includes(`光で <b>${v.q5.light}</b>`));
  assert.ok(Number.isInteger(v.q3.moonKm) && Number.isInteger(v.q3.sunKm));
});

test("地球のまわりの機体は模型なし（図は地球と高さの輪）", () => {
  const v = data("iss");
  assert.equal(v.group, "craft");
  assert.equal(v.model, null);
  assert.equal(v.q3.altKm, 400);
  assert.equal(v.q5.periodMin, 90);
});

test("visual.js は three.js の絞った版にない部品を使わない", () => {
  const src = readFileSync(new URL("visual.js", dir), "utf8");
  const vendor = readFileSync(new URL("../vendor/three-r128.min.js", dir), "utf8");
  const exported = new Set([...vendor.matchAll(/ as (\w+)/g)].map((m) => m[1]));
  for (const [, name] of src.matchAll(/THREE\.(\w+)/g)) assert.ok(exported.has(name), `THREE.${name} は web/vendor/three-r128.min.js にない`);
  assert.ok(existsSync(new URL("../js/far/models.js", dir)));
});
