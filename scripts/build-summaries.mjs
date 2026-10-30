// 「一言でわかる」ページ（web/missions/）を curation/ のカードから作る（2026-10-12 オーナー）
//   人にも、検索・AI にも読めるように、JavaScript を使わない文字だけのページにする
//   一言 ＝ カードの mission（出典つき）。要点もカードの値だけ（新しい事実は書かない）
//   人物（astronauts・teams）は作らない（RULES.md の人物の細則）
//   ニュースを見た次に開く形（M13 N1、2026-10-29 オーナー）：5つの問い（何？・いま何が起きた？・どこ？・
//   これまで→これから・どれくらい？）の順に並べる。答えの材料がない問いは出さない
//   距離は web/data/horizons.json の表のはじめの日の値（表が週1回変わると、このページも作り直す）
//
// 使い方：node scripts/build-summaries.mjs          … web/missions/ と web/sitemap.xml を書く
//         node scripts/build-summaries.mjs --check  … 書かずに、いまのファイルと同じか確かめる（CI）
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MISSION, RESULTS } from "../web/tour/artemis2/mission.js";
import { probeDistance, bodyDistanceKm, lightSeconds, lightTimeJa, kmJa } from "../web/js/far/distance.js";

const ROOT = new URL("..", import.meta.url).pathname;
const SITE = "https://voyascope.org";
const CHECK = process.argv.includes("--check");

const read = (dir) =>
  readdirSync(join(ROOT, "curation", dir))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(ROOT, "curation", dir, f), "utf8")));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const host = (u) => new URL(u).hostname.replace(/^www\./, "");
const BUILDER_TYPE = { university: "大学・高専", company: "企業", agency: "JAXA・研究機関" };
const JST = 9 * 3600000;
const ymd = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}年${m}月${d}日`;
};
const jstDay = (t) => new Date(Date.parse(t) + JST).toISOString().slice(0, 10);
const EVENTS = new Map(read("events").map((e) => [e.id, e]));
const HORIZONS = JSON.parse(readFileSync(join(ROOT, "web", "data", "horizons.json"), "utf8"));
// 距離を出す日：Horizons の表のはじめの日（日本時間 0時）。表がなければ距離は出さない
const REF = Object.values(HORIZONS.probes ?? {})[0]?.start ? new Date(Object.values(HORIZONS.probes)[0].start) : null;
const REF_LABEL = REF ? `${ymd(jstDay(REF.toISOString()))}の値` : "";
const STATUS = { operating: "運用中", standby: "待機中", ended: "運用終了", not_launched: "打ち上げ前" };

// 出典のついた値：配列は「・」でつなぐ。非公開は「非公開（運用者が公表していない）」
const val = (f) => (f.undisclosed ? "非公開（運用者が公表していない）" : Array.isArray(f.value) ? f.value.join("・") : String(f.value));
// 出典のついた値を「値（出典・確認日）」の形に
const cite = (f) => !f.source ? "" : `<span class="src">出典：<a href="${esc(f.source)}" rel="noopener">${esc(host(f.source))}</a> · ${esc(f.as_of)} 確認</span>`;

const CSS = `
:root { color-scheme: dark; --navy: #07142b; --navy2: #0c1f3f; --amber: #ffb547; --mint: #5ef2c2; --text: #eef6f3; --dim: #9fb3c8; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--navy); color: var(--text); font: 16px/1.8 "Zen Kaku Gothic New", system-ui, sans-serif; }
main { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
a { color: var(--mint); }
.brand { font: 700 13px/1 "JetBrains Mono", ui-monospace, monospace; letter-spacing: 0.3em; color: var(--text); text-decoration: none; }
.kicker { color: var(--amber); font: 12px "JetBrains Mono", ui-monospace, monospace; letter-spacing: 0.2em; margin: 40px 0 4px; }
h1 { font-size: clamp(1.8rem, 6vw, 2.6rem); line-height: 1.3; margin: 0; }
.en { color: var(--dim); margin: 4px 0 0; }
.one { font-size: clamp(1.2rem, 4.4vw, 1.5rem); font-weight: 700; line-height: 1.6; margin: 24px 0 6px; padding: 16px 18px; border-left: 3px solid var(--amber); background: var(--navy2); border-radius: 0 12px 12px 0; }
.src { display: block; color: var(--dim); font-size: 12px; }
h2 { font-size: 1.05rem; margin: 36px 0 8px; color: var(--mint); }
dl { margin: 0; display: grid; grid-template-columns: 7.5em 1fr; gap: 10px 14px; }
dt { color: var(--dim); }
dd { margin: 0; }
ul { margin: 0; padding-left: 1.2em; }
.go { display: inline-block; margin-top: 28px; padding: 12px 22px; border-radius: 999px; background: var(--amber); color: #000; font-weight: 700; text-decoration: none; }
.list li { margin: 10px 0; }
.list a { font-weight: 700; }
.list span { display: block; color: var(--dim); font-size: 14px; }
.q { margin-top: 8px; }
.q h2 { display: flex; align-items: baseline; gap: 10px; }
.qn { font: 700 12px "JetBrains Mono", ui-monospace, monospace; letter-spacing: 0.1em; color: var(--navy); background: var(--mint); border-radius: 4px; padding: 2px 6px; }
.sub { color: var(--dim); font-size: 14px; margin: 8px 0 0; }
.happen { margin: 0; padding: 14px 16px; background: var(--navy2); border-radius: 12px; }
.tag { display: inline-block; margin-right: 8px; padding: 0 8px; border: 1px solid var(--mint); border-radius: 999px; color: var(--mint); font-size: 13px; }
.big { font-size: 1.15rem; margin: 12px 0 0; }
.big b, .scale b { color: var(--amber); }
.tl { list-style: none; margin: 0; padding: 0 0 0 18px; border-left: 2px solid rgba(255,255,255,.18); }
.tl li { position: relative; margin: 0 0 14px; }
.tl li::before { content: ""; position: absolute; left: -25px; top: 0.55em; width: 10px; height: 10px; border-radius: 50%; background: var(--dim); }
.tl li.now::before { background: var(--mint); box-shadow: 0 0 0 4px rgba(94,242,194,.25); }
.tl li.next::before { background: var(--navy); border: 2px solid var(--amber); width: 6px; height: 6px; }
.tl li.now { color: var(--mint); font-weight: 700; }
.tl li.none { color: var(--dim); font-size: 14px; }
.tl .d { display: block; color: var(--dim); font: 12px "JetBrains Mono", ui-monospace, monospace; }
.tl li.now .d { color: var(--mint); }
.tl .st { margin-left: 6px; font-size: 12px; color: var(--dim); border: 1px solid rgba(255,255,255,.25); border-radius: 999px; padding: 0 6px; }
.scale { padding-left: 1.2em; }
.vis { margin: 4px 0 14px; }
.vis canvas { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; border-radius: 12px; background: #050e1f; }
.vis .act { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
.vis button { font: 12px "Zen Kaku Gothic New", system-ui, sans-serif; color: var(--dim); background: transparent; border: 1px solid rgba(255,255,255,.2); border-radius: 999px; padding: 4px 12px; cursor: pointer; }
.vis button:hover { color: var(--text); border-color: var(--mint); }
.vis button[disabled] { opacity: .5; cursor: default; }
.scale li { margin: 6px 0; }
footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.12); color: var(--dim); font-size: 13px; }
@media (max-width: 480px) { dl { grid-template-columns: 1fr; gap: 2px; } dd { margin-bottom: 10px; } }
`;

function page({ path, title, description, body, jsonld }) {
  // リンクは相対で（GitHub Pages では /voyascope/ の下に置かれるため）
  const up = "../".repeat(path.split("/").filter(Boolean).length);
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${SITE}/${path}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${SITE}/${path}">
  <link rel="icon" href="${up}favicon.svg" type="image/svg+xml">
  <style>${CSS}</style>
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<main>
  <a class="brand" href="${up}">VOYASCOPE</a>
${body}
  <footer>
    <p>VOYASCOPE は非公式のファンメイド作品です。宇宙機関・運用者とは関係ありません。</p>
    <p>ここに書いた事実は、それぞれの出典（一次情報）で確かめてください。VOYASCOPE は、公式の発表への入口です。</p>
    <p><a href="${up}missions/">SpaceTips（一言でわかる一覧）</a> · <a href="${up}">VOYASCOPE を開く</a></p>
  </footer>
</main>
</body>
</html>
`;
}

const ldPage = (name, description, url, dateModified, sameAs = []) => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name,
  description,
  url,
  inLanguage: "ja",
  dateModified,
  isPartOf: { "@type": "WebSite", name: "VOYASCOPE", url: `${SITE}/` },
  about: { "@type": "Thing", name, ...(sameAs.length ? { sameAs } : {}) },
});

// 出来事の日時（events.json の when）を「2026年11月21日」の形に。並べるための鍵も返す
function whenJa(w) {
  if (w.at) return { key: w.at, text: ymd(jstDay(w.at)) };
  if (w.date) return { key: w.date, text: ymd(w.date) };
  if (w.from) {
    const [a, b] = [w.from, w.to ?? w.from];
    const same = a.slice(0, 7) === b.slice(0, 7);
    return { key: a, text: same && a !== b ? `${ymd(a)}〜${Number(b.slice(8))}日` : a === b ? ymd(a) : `${ymd(a)}〜${ymd(b)}` };
  }
  if (w.month) {
    const [y, m] = w.month.split("-").map(Number);
    return { key: `${w.month}-01`, text: `${y}年${m}月` };
  }
  return { key: "", text: "" };
}
const EVENT_STATE = { done: "済み", postponed: "延期", cancelled: "中止" };

// 問いごとの節。見出しの下の figure に、visual.js が three.js の図（6秒でくり返す）を描く。
// JavaScript がないときは figure は隠れたまま（文字だけで読める）
const sec = (n, q, body) => `
  <section class="q" aria-labelledby="q${n}">
    <h2 id="q${n}"><span class="qn">Q${n}</span>${q}</h2>
    <figure class="vis" data-q="${n}" hidden></figure>
${body}
  </section>`;
// 図のデータ（visual.js が読む）。ページに書いた値だけを渡す
const MODEL_KEY = { "voyager-1": "voyager", "voyager-2": "voyager" };
const MODEL_IDS = new Set(["jwst", "parker-solar-probe", "bepicolombo", "perseverance", "mmx", "hayabusa2", "juno", "new-horizons", "voyager-1", "voyager-2"]);

// 探査機・地球のまわりの機体
function cardPage(c, group) {
  const path = `missions/${c.id}/`;
  const parts = [];
  const V = {
    id: c.id,
    group,
    model: MODEL_IDS.has(c.id) ? MODEL_KEY[c.id] ?? c.id : null,
    name: c.name.ja,
    q1: { text: c.mission.value, src: host(c.mission.source) },
  };

  // Q1 何？
  parts.push(sec(1, "何？", `    <p class="one">${esc(c.mission.value)}${cite(c.mission)}</p>
    <p class="sub">運用：${esc(val(c.operator))}${c.operator.note ? `（${esc(c.operator.note)}）` : ""}${cite(c.operator)}</p>`));

  // Q2 いま何が起きた？（カードの「いまの状態」。日付は出典を確かめた日）
  if (c.status) {
    const st = STATUS[c.status.value] ?? c.status.value;
    V.q2 = { label: st, note: c.status.note ?? "", asOf: c.status.as_of, src: host(c.status.source) };
    parts.push(sec(2, "いま何が起きた？", `    <p class="happen"><span class="tag">${esc(st)}</span>${c.status.note ? esc(c.status.note) : ""}${cite(c.status)}</p>`));
  }

  // Q3 どこ？
  const where = [];
  const dist = group === "probe" && REF ? probeDistance(c, REF, HORIZONS) : null;
  if (c.location) where.push(`    <p>${esc(val(c.location))}${cite(c.location)}</p>`);
  else if (group === "craft") {
    const alt = c.stats?.altitude_km;
    where.push(`    <p>地球のまわりを回っている${alt ? `（高さ 約${esc(alt.value.toLocaleString("ja-JP"))} km）${cite(alt)}` : ""}</p>`);
  }
  if (group === "craft") V.q3 = { altKm: c.stats?.altitude_km?.value ?? null, src: c.stats?.altitude_km ? host(c.stats.altitude_km.source) : "" };
  if (dist && dist.km > 0) {
    V.q3 = {
      km: dist.km,
      text: `約${kmJa(dist.km)}`,
      when: dist.method === "dated" ? `${ymd(dist.at)}の公式の値` : REF_LABEL,
      src: dist.method === "horizons" ? "JPL Horizons" : dist.method === "planet" ? "計算（Astronomy Engine）" : host(c.distance.source),
      moonKm: Math.round(bodyDistanceKm("Moon", REF)),
      sunKm: Math.round(bodyDistanceKm("Sun", REF)),
    };
    const how =
      dist.method === "horizons" ? `${esc(REF_LABEL)}・<a href="https://ssd.jpl.nasa.gov/horizons/" rel="noopener">JPL Horizons</a> の計算値${dist.supplier ? `（軌道は ${esc(dist.supplier)} から）` : ""}`
      : dist.method === "planet" ? `${esc(REF_LABEL)}・いる惑星までの距離を計算`
      : dist.method === "dated" ? `${esc(ymd(dist.at))}の公式の値${cite(c.distance)}`
      : "公式の目安の値";
    where.push(`    <p class="big">地球から <b>約${esc(kmJa(dist.km))}</b></p>
    <span class="src">${how}</span>`);
  }
  const goHref = c.id === "mmx" ? "../../mmx/now/" : "../../";
  const goText = c.id === "mmx" ? "MMX は、いまどこ？（VOYASCOPE）" : group === "probe" ? "VOYASCOPE で見る（遠くを見る部屋）" : "VOYASCOPE で見る（地球のまわり）";
  where.push(`    <a class="go" href="${goHref}">${goText}</a>`);
  parts.push(sec(3, "どこ？", where.join("\n")));

  // Q4 これまで→これから（打ち上げ・出来事・いま）
  const items = [];
  const launchEvent = (c.events ?? []).some((id) => EVENTS.get(id)?.kind === "launch");
  if (c.launch_date?.value && !launchEvent) items.push({ key: c.launch_date.value, text: ymd(c.launch_date.value), label: "打ち上げ", past: true, f: c.launch_date });
  for (const id of c.events ?? []) {
    const e = EVENTS.get(id);
    if (!e) continue;
    const w = whenJa(e.when.value);
    const state = e.status?.value;
    items.push({ key: w.key, text: w.text, label: e.title.ja, past: state === "done", state: EVENT_STATE[state], f: e.when });
  }
  items.sort((a, b) => (a.past === b.past ? a.key.localeCompare(b.key) : a.past ? -1 : 1));
  const nowAt = items.findIndex((i) => !i.past);
  const li = (i) => `      <li class="${i.past ? "past" : "next"}"><span class="d">${esc(i.text)}</span>${esc(i.label)}${i.state ? `<span class="st">${esc(i.state)}</span>` : ""}${cite(i.f)}</li>`;
  const nowLi = `      <li class="now"><span class="d">いま</span>${esc(c.status ? STATUS[c.status.value] ?? "" : "")}</li>`;
  const tl = [...items.slice(0, nowAt < 0 ? items.length : nowAt).map(li), nowLi, ...(nowAt < 0 ? [] : items.slice(nowAt).map(li))];
  V.q4 = [
    ...items.slice(0, nowAt < 0 ? items.length : nowAt).map((i) => ({ d: i.text, label: i.label, kind: "past" })),
    { d: "いま", label: c.status ? STATUS[c.status.value] ?? "" : "", kind: "now" },
    ...(nowAt < 0 ? [] : items.slice(nowAt).map((i) => ({ d: i.text, label: i.label + (i.state ? `（${i.state}）` : ""), kind: "next" }))),
  ];
  if (nowAt < 0) tl.push(`      <li class="next none"><span class="d">これから</span>公式に日付の出ている予定は、まだ載せていません</li>`);
  parts.push(sec(4, "これまで→これから", `    <ol class="tl">
${tl.join("\n")}
    </ol>`));

  // Q5 どれくらい？（ものさし）
  const scale = [];
  if (dist && dist.km > 0) {
    // Horizons・計算の値は細かく、公式の目安・日付つきの値は丸めて「約」
    const approx = dist.method === "dated" || dist.method === "typical";
    const lt = lightTimeJa(lightSeconds(dist.km), { approx }).replace(/ /g, "");
    scale.push(`      <li>光で <b>${esc(approx ? lt : `約${lt}`)}</b>（地球から送った電波が届くまで）</li>`);
    V.q5 = { light: approx ? lt : `約${lt}`, lightSec: lightSeconds(dist.km), src: "光の速さ（定義の値）から計算" };
    // くらべる相手：月の1,000倍までは月、その先は太陽（どちらも REF の日の計算）
    const moon = bodyDistanceKm("Moon", REF);
    const sun = bodyDistanceKm("Sun", REF);
    const [name, ref] = dist.km / moon <= 1000 ? ["月", moon] : ["太陽", sun];
    const r = dist.km / ref;
    if (r >= 1.5) V.q5.ratio = `${name}までの約${r >= 100 ? Math.round(r).toLocaleString("ja-JP") : r.toFixed(r >= 10 ? 0 : 1)}倍`;
    if (r >= 1.5) scale.push(`      <li>${name}までの <b>約${esc(r >= 100 ? Math.round(r).toLocaleString("ja-JP") : r.toFixed(r >= 10 ? 0 : 1))}倍</b>（${name}まで 約${esc(kmJa(ref))}）</li>`);
  }
  if (group === "craft") {
    const st = c.stats ?? {};
    V.q5 = {
      periodMin: st.period_min?.value ?? null,
      speed: st.speed_km_s?.value ?? null,
      lengthM: st.length_m?.value ?? null,
      massT: st.mass_kg ? Math.round(st.mass_kg.value / 1000) : null,
      altKm: st.altitude_km?.value ?? null,
      src: host((st.period_min ?? st.speed_km_s ?? st.length_m ?? st.mass_kg ?? { source: c.mission.source }).source),
    };
    if (st.speed_km_s) scale.push(`      <li>速さ：秒速 <b>約${esc(st.speed_km_s.value)} km</b>${cite(st.speed_km_s)}</li>`);
    if (st.period_min) scale.push(`      <li>地球を1周：<b>約${esc(st.period_min.value)}分</b>${cite(st.period_min)}</li>`);
    if (st.length_m) scale.push(`      <li>大きさ：<b>約${esc(st.length_m.value.toLocaleString("ja-JP"))} m</b>${st.length_m.note ? `（${esc(st.length_m.note)}）` : ""}${cite(st.length_m)}</li>`);
    if (st.mass_kg) scale.push(`      <li>重さ：<b>約${esc(Math.round(st.mass_kg.value / 1000).toLocaleString("ja-JP"))} トン</b>${cite(st.mass_kg)}</li>`);
  }
  if (scale.length) parts.push(sec(5, "どれくらい？", `    <ul class="scale">
${scale.join("\n")}
    </ul>${dist && dist.km > 0 ? `\n    <span class="src">光の速さ（秒速 299,792.458 km、定義の値）と、月・太陽の位置の計算から。${esc(REF_LABEL)}</span>` : ""}`));

  const body = `
  <p class="kicker">SpaceTips｜一言でわかる</p>
  <h1>${esc(c.name.ja)}</h1>
  <p class="en">${esc(c.name.en)}</p>
${parts.join("\n")}
  <h2>公式のページ</h2>
  <ul>
${c.official_links.map((l) => `    <li><a href="${esc(l.url)}" rel="noopener">${esc(l.label)}</a></li>`).join("\n")}
  </ul>
  <p class="src">VOYASCOPE のカードの最終確認：${esc(c.updated_at)}</p>
  <script type="application/json" id="vis-data">${JSON.stringify(V).replace(/</g, "\\u003c")}</script>
  <script type="module" src="../visual.js"></script>`;
  return {
    path,
    one: c.mission.value,
    name: c.name.ja,
    html: page({
      path,
      title: `${c.name.ja}を一言で — VOYASCOPE`,
      description: `${c.name.ja}（${c.name.en}）：${c.mission.value}`,
      body,
      jsonld: ldPage(c.name.ja, c.mission.value, `${SITE}/${path}`, c.updated_at, c.official_links.map((l) => l.url)),
    }),
  };
}

// アルテミス2号（カードではなく、ツアーの mission.js から。出典は mission.js のコメント）
function artemisPage() {
  const path = "missions/artemis2/";
  const one = "4人を乗せて月のまわりを飛び、地球へ帰ってきた試験飛行（2026年4月・NASA）";
  const body = `
  <p class="kicker">一言で言うと</p>
  <h1>アルテミス2号</h1>
  <p class="en">Artemis II</p>
  <p class="one">${esc(one)}<span class="src">出典：<a href="${esc(MISSION.links[0].href)}" rel="noopener">NASA の目標の文書</a> · <a href="${esc(RESULTS.source)}" rel="noopener">NASA の飛行後の発表</a></span></p>
  <h2>要点</h2>
  <dl>
    <dt>目的</dt><dd>${esc(MISSION.lead.replace(/^目的：/, ""))}</dd>
    <dt>いつ</dt><dd>${esc(MISSION.log)}</dd>
${MISSION.rows.map((r) => `    <dt>${esc(r.k)}</dt><dd><ul>${r.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></dd>`).join("\n")}
    <dt>結果</dt><dd>${esc(RESULTS.head)}<ul>${RESULTS.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></dd>
  </dl>
  <h2>公式のページ</h2>
  <ul>
${MISSION.links.map((l) => `    <li><a href="${esc(l.href)}" rel="noopener">${esc(l.aria)}</a></li>`).join("\n")}
    <li><a href="${esc(RESULTS.source)}" rel="noopener">NASA の飛行後の発表</a></li>
  </ul>
  <a class="go" href="../../tour/artemis2/">VOYASCOPE で見る（月の旅と月の地図）</a>`;
  return {
    path,
    one,
    name: "アルテミス2号",
    html: page({
      path,
      title: "アルテミス2号を一言で — VOYASCOPE",
      description: `アルテミス2号（Artemis II）：${one}`,
      body,
      jsonld: ldPage("アルテミス2号", one, `${SITE}/${path}`, "2026-10-12", MISSION.links.map((l) => l.href)),
    }),
  };
}

const probes = read("probes").map((c) => cardPage(c, "probe"));
// 地球の画面に出している機体（config/orbits.json の、lab でないもの）だけ。カードがあっても画面にまだ出していないもの（キューブサットの VERTECS など）は作らない
const shownCraft = new Set(JSON.parse(readFileSync("config/orbits.json", "utf8")).objects.filter((o) => !o.lab).map((o) => o.id));
const craft = read("spacecraft").filter((c) => shownCraft.has(c.id)).map((c) => cardPage(c, "craft"));
const artemis = artemisPage();

const listItems = (items) => items.map((p) => `    <li><a href="${p.path.replace(/^missions\//, "")}">${esc(p.name)}</a><span>${esc(p.one)}</span></li>`).join("\n");
const indexBody = `
  <p class="kicker">SpaceTips｜一言でわかる</p>
  <h1>宇宙を旅する者たちを、一言で</h1>
  <p>ニュースで見た名前を、5つの問い（何？・いま何が起きた？・どこ？・これまで→これから・どれくらい？）で。書いてあることには、すべて出典があります。</p>
  <h2>ミッション</h2>
  <ul class="list">
${listItems([artemis])}
  </ul>
  <h2>太陽系を旅する探査機</h2>
  <ul class="list">
${listItems(probes)}
  </ul>
  <h2>地球のまわりの人工衛星・宇宙ステーション</h2>
  <ul class="list">
${listItems(craft)}
  </ul>`;
const index = {
  path: "missions/",
  html: page({
    path: "missions/",
    title: "SpaceTips（一言でわかる） — VOYASCOPE",
    description: "VOYASCOPE が載せている探査機・人工衛星・ミッションを、一言と要点で。すべて出典つき。",
    body: indexBody,
    jsonld: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "SpaceTips（一言でわかる） — VOYASCOPE",
      url: `${SITE}/missions/`,
      inLanguage: "ja",
      isPartOf: { "@type": "WebSite", name: "VOYASCOPE", url: `${SITE}/` },
    },
  }),
};

const pages = [index, artemis, ...probes, ...craft];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${["", "tour/artemis2/", ...pages.map((p) => p.path)].map((p) => `  <url><loc>${SITE}/${p}</loc></url>`).join("\n")}
</urlset>
`;

// SpaceTips の帯（地球の画面の下。web/js/tips.js が日付から「〇〇から N日」「あと N日」にする）の材料：
// ページのある機体の出来事（カードの events）だけ
const tips = [...read("probes"), ...read("spacecraft").filter((c) => shownCraft.has(c.id))].flatMap((c) =>
  (c.events ?? [])
    .map((id) => EVENTS.get(id))
    .filter(Boolean)
    .map((e) => ({ id: e.id, card: c.id, name: c.name.ja, title: e.title.ja, when: e.when.value, status: e.status?.value ?? "scheduled", href: `missions/${c.id}/` })),
);
const tipsJson = JSON.stringify({ items: tips }, null, 1) + "\n";

const outputs = [...pages.map((p) => [join(ROOT, "web", p.path, "index.html"), p.html]), [join(ROOT, "web", "sitemap.xml"), sitemap], [join(ROOT, "web", "data", "tips.json"), tipsJson]];
let stale = 0;
for (const [file, text] of outputs) {
  const now = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (now === text) continue;
  if (CHECK) {
    console.error(`古い：${file.replace(ROOT, "")}（node scripts/build-summaries.mjs で作り直す）`);
    stale++;
  } else {
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, text);
    console.log(`作成: ${file.replace(ROOT, "")}`);
  }
}
if (CHECK && stale) process.exit(1);
if (CHECK) console.log(`web/missions/ は最新です（${pages.length} ページ）`);
