import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rankOf, gaugeOf, overallRank, evaluateStats } from "../web/js/rank.js";

const config = JSON.parse(readFileSync("config/rank-thresholds.json", "utf8"));

test("閾値ちょうどはそのランクになる", () => {
  assert.equal(rankOf(7.5, config.stats.speed_km_s), "S");
  assert.equal(rankOf(7.49, config.stats.speed_km_s), "A");
  assert.equal(rankOf(0, config.stats.speed_km_s), "C");
});

test("direction: lower は小さいほど高ランク", () => {
  assert.equal(rankOf(90, config.stats.period_min), "S");
  assert.equal(rankOf(1436, config.stats.period_min), "C");
  assert.ok(gaugeOf(90, config.stats.period_min) > gaugeOf(1436, config.stats.period_min));
});

test("ゲージは 0〜1 に収まる", () => {
  for (const [key, rule] of Object.entries(config.stats)) {
    for (const v of [-1, 0, rule.gauge.min, rule.gauge.max, rule.gauge.max * 10]) {
      const g = gaugeOf(v, rule);
      assert.ok(g >= 0 && g <= 1, `${key}=${v} → ${g}`);
    }
  }
});

test("数値でない値はランクなし", () => {
  assert.equal(rankOf("400", config.stats.altitude_km), null);
});

test("総合ランクは平均の四捨五入", () => {
  assert.equal(overallRank(["S", "S", "C"], config), "A"); // 3.0
  assert.equal(overallRank(["S", "C"], config), "A"); // 2.5 → 3（四捨五入）
  assert.equal(overallRank(["B", "C", "C"], config), "C"); // 1.33 → 1
});

test("非公開のステータスはランクに含めない", () => {
  const { rows, overall } = evaluateStats(
    { speed_km_s: { value: 7.7, source: "https://example.org" }, mass_kg: { undisclosed: true } },
    config,
  );
  assert.equal(rows.length, 2);
  assert.equal(overall, "S");
});
