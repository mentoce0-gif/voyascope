// ゲージとランクの自動計算（config/rank-thresholds.json に従う。手で盛らない）

export function rankOf(value, rule, order = ["S", "A", "B", "C"]) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  for (const r of order) {
    const t = rule.ranks[r];
    if (t === undefined) continue;
    if (rule.direction === "lower" ? value <= t : value >= t) return r;
  }
  return order[order.length - 1];
}

// ゲージの割合（0〜1）。direction が lower のときは小さい値ほど長くなる
export function gaugeOf(value, rule) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const { scale, min, max } = rule.gauge;
  const f = scale === "log" ? (x) => Math.log10(Math.max(x, min)) : (x) => x;
  let ratio = (f(value) - f(min)) / (f(max) - f(min));
  ratio = Math.min(1, Math.max(0, ratio));
  return rule.direction === "lower" ? 1 - ratio : ratio;
}

export function overallRank(ranks, config) {
  const { points } = config.overall;
  const list = ranks.filter((r) => r in points);
  if (!list.length) return null;
  const mean = list.reduce((s, r) => s + points[r], 0) / list.length;
  const rounded = Math.round(mean);
  return Object.keys(points).find((r) => points[r] === rounded) ?? null;
}

// stats（カードの stats）から、表示用の行を作る
export function evaluateStats(stats, config) {
  const rows = [];
  for (const [key, rule] of Object.entries(config.stats)) {
    const fact = stats?.[key];
    if (!fact) continue;
    if (fact.undisclosed) {
      rows.push({ key, rule, undisclosed: true, rank: null, gauge: 0 });
      continue;
    }
    rows.push({
      key,
      rule,
      fact,
      rank: rankOf(fact.value, rule, config.rank_order),
      gauge: gaugeOf(fact.value, rule),
    });
  }
  return { rows, overall: overallRank(rows.map((r) => r.rank), config) };
}
