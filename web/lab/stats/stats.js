// アクセスの数の表（/lab/stats/data の行を、日ごと・来た元・ページ・投稿の目印に集める）
const SOURCES = [
  ["x", "X"],
  ["search", "検索"],
  ["ai", "AI"],
  ["social", "SNS ほか"],
  ["direct", "直接"],
  ["other", "その他のサイト"],
];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const addDays = (day, n) => new Date(Date.parse(day + "T00:00:00Z") + n * 86400e3).toISOString().slice(0, 10);

export function summarize(rows, today) {
  const sum = (f) => rows.filter(f).reduce((a, r) => a + r.n, 0);
  const since = (n) => (r) => r.day > addDays(today, -n) && r.day <= today;
  const last7 = sum(since(7));
  const prev7 = sum((r) => r.day > addDays(today, -14) && r.day <= addDays(today, -7));
  const days = [];
  for (let i = 0; i < 28; i++) {
    const day = addDays(today, -i);
    const of = rows.filter((r) => r.day === day);
    days.push({ day, total: of.reduce((a, r) => a + r.n, 0), by: Object.fromEntries(SOURCES.map(([k]) => [k, of.filter((r) => r.source === k).reduce((a, r) => a + r.n, 0)])) });
  }
  const group = (key, f) => {
    const m = new Map();
    for (const r of rows.filter(f)) m.set(r[key], (m.get(r[key]) ?? 0) + r.n);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  return { last7, prev7, last28: sum(since(28)), days, pages: group("path", since(28)), tags: group("tag", (r) => r.tag), sources28: group("source", since(28)) };
}

function render({ ready, today, rows }) {
  const out = document.getElementById("out");
  if (!ready) {
    out.innerHTML = `<p class="k">まだ数える先（D1 の voyascope-stats）がつながっていません。</p>`;
    return;
  }
  const s = summarize(rows, today);
  const diff = s.prev7 ? `${s.last7 >= s.prev7 ? "+" : ""}${s.last7 - s.prev7}（前の7日 ${s.prev7}）` : "前の7日のデータなし";
  out.innerHTML = `
    <div class="kpi">
      <div><span class="k small">直近7日</span><b class="mono">${s.last7}</b><span class="k small">${diff}</span></div>
      <div><span class="k small">直近28日</span><b class="mono">${s.last28}</b></div>
      <div><span class="k small">28日の X から</span><b class="mono">${s.sources28.find(([k]) => k === "x")?.[1] ?? 0}</b></div>
    </div>
    <h2>日ごと（28日）</h2>
    <div class="wrap"><table><tr><th>日</th><th>合計</th>${SOURCES.map(([, l]) => `<th>${l}</th>`).join("")}</tr>
      ${s.days.map((d) => `<tr><td class="mono">${d.day.slice(5)}</td><td class="mono">${d.total}</td>${SOURCES.map(([k]) => `<td class="mono">${d.by[k] || ""}</td>`).join("")}</tr>`).join("")}
    </table></div>
    <h2>入口のページ（28日）</h2>
    <div class="wrap"><table><tr><th>ページ</th><th>回数</th></tr>${s.pages.map(([p, n]) => `<tr><td class="mono">${esc(p)}</td><td class="mono">${n}</td></tr>`).join("") || `<tr><td class="k">まだなし</td><td></td></tr>`}</table></div>
    <h2>投稿の目印（?s=、ぜんぶの期間）</h2>
    <div class="wrap"><table><tr><th>目印</th><th>回数</th></tr>${s.tags.map(([t, n]) => `<tr><td class="mono">${esc(t)}</td><td class="mono">${n}</td></tr>`).join("") || `<tr><td class="k">まだなし</td><td></td></tr>`}</table></div>
    <p class="k small">来た元：X＝t.co・x.com、検索＝Google・Bing・Yahoo! など、AI＝ChatGPT・Perplexity など、直接＝参照元なし（X などのアプリの中のブラウザもここに入りやすい）。</p>`;
}

if (typeof document !== "undefined") {
  fetch("data", { cache: "no-store" })
    .then((r) => r.json())
    .then(render)
    .catch((e) => (document.getElementById("out").innerHTML = `<p class="k">読み込めませんでした：${esc(e.message)}</p>`));
}
