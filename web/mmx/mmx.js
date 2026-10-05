// MMX を追う（予告）のページ（2026-10-05）。
// - 打ち上げまでの残り時間：web/data/events.json の mmx-launch（curation と同じ。延期や日時の変更は、公式の発表を確かめて curation を直すと、ここにも出る）
// - 地球と火星の位置：Astronomy Engine で、このブラウザで計算する（遠くを見る部屋と同じ）
// - MMX の位置は描かない。打ち上げのあと、公開されるデータを確かめてから。点線の道のりはイメージ（実際の軌道ではない）
import { GeoVector, Body, MakeTime } from "../vendor/astronomy.min.js";
import { bodyDistanceKm, kmJa, kmShortJa, lightTimeJa, C_KM_S } from "../js/far/distance.js";
import { whenText, statusOf, bigCountdown, eventSpan, publisherOf } from "../js/events.js";

const $ = (s) => document.querySelector(s);
const DAY = 86400000;
const FALLBACK_AT = "2026-10-19T19:41:03Z"; // events.json を読めなかったときだけ使う（curation/events/mmx-launch.json と同じ値）

// ---------- 打ち上げまでの残り時間 ----------

let launchEvent = null;
let launchAt = new Date(FALLBACK_AT);

async function loadLaunch() {
  try {
    const res = await fetch("../data/events.json", { cache: "no-cache" });
    const data = await res.json();
    launchEvent = (data.events ?? []).find((e) => e.id === "mmx-launch") ?? null;
  } catch {
    launchEvent = null;
  }
  const span = launchEvent && eventSpan(launchEvent);
  if (span) launchAt = new Date(span.start);
  if (!launchEvent) return;
  const now = new Date();
  const postponed = statusOf(launchEvent) === "postponed";
  $("#cd-when").textContent = postponed
    ? "延期（新しい日時は、公式の発表を待ちます）"
    : `${whenText(launchEvent, now, { full: true })}の予定`;
  const vehicle = launchEvent.vehicle?.value;
  const site = launchEvent.site?.name?.value;
  $("#cd-meta").textContent = [vehicle, site].filter(Boolean).join("・");
  const src = launchEvent.when?.source;
  if (src) {
    const a = $("#cd-src");
    a.href = src;
    a.textContent = `${publisherOf(src) || "公式"}の発表`;
  }
}

function renderCountdown() {
  const now = new Date();
  const el = $("#cd-time");
  if (launchEvent && statusOf(launchEvent) === "postponed") {
    el.textContent = "延期";
    return;
  }
  const text = launchEvent ? bigCountdown(launchEvent, now) : null;
  if (text) {
    // 「14日 17時間 12分 03秒」の単位を小さく
    el.innerHTML = text.replace(/(\d+)(日|時間|分|秒)/g, '$1<small>$2</small>');
    return;
  }
  if (now >= launchAt) {
    el.textContent = "予定の時刻を過ぎました";
    $("#cd-when").textContent = "結果は JAXA の発表でご確認ください（VOYASCOPE は、発表を確かめてから記録します）";
  }
}

// ---------- 地球と火星（真上から見た図） ----------

const EPS = (23.4392911 * Math.PI) / 180; // 黄道傾斜角（J2000）：赤道の向きの座標を、惑星の通り道の面（黄道面）へ回す
const AU = 100; // 図の上の1天文単位
const NS = "http://www.w3.org/2000/svg";

// 太陽から見た位置（黄道面に投影。単位は天文単位）。GeoVector（地球から見た位置）の差から出す
function helio(name, date) {
  const t = MakeTime(date);
  const sun = GeoVector(Body.Sun, t, false);
  let v;
  if (name === "Earth") v = { x: -sun.x, y: -sun.y, z: -sun.z };
  else {
    const p = GeoVector(Body[name], t, false);
    v = { x: p.x - sun.x, y: p.y - sun.y, z: p.z - sun.z };
  }
  return { x: v.x, y: v.y * Math.cos(EPS) + v.z * Math.sin(EPS) };
}
const svgXY = (p) => [p.x * AU, -p.y * AU];
const angleOf = (p) => Math.atan2(p.y, p.x);
const radiusOf = (p) => Math.hypot(p.x, p.y);

function el(parent, tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, typeof v === "number" ? v.toFixed(1) : v);
  if (text != null) e.textContent = text;
  parent.appendChild(e);
  return e;
}
const label = (parent, x, y, s, cls = "", anchor = "start") =>
  el(parent, "text", { x, y, class: `o-label o-halo ${cls}`, "text-anchor": anchor }, s);

function orbitPath(name, from, days, step) {
  let d = "";
  for (let i = 0; i <= days; i += step) {
    const [x, y] = svgXY(helio(name, new Date(from.getTime() + i * DAY)));
    d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d}Z`;
}

function drawOrbitMap() {
  const svg = $("#orbit-svg");
  if (!svg) return;
  const now = new Date();
  const defs = el(svg, "defs");
  const glow = el(defs, "radialGradient", { id: "sun-glow" });
  el(glow, "stop", { offset: "0", "stop-color": "#ffb547", "stop-opacity": "0.5" });
  el(glow, "stop", { offset: "1", "stop-color": "#ffb547", "stop-opacity": "0" });
  const mk = el(defs, "marker", { id: "o-arrow", viewBox: "0 0 10 10", refX: "5", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto" });
  el(mk, "path", { d: "M0 0L10 5L0 10z", class: "o-arrow" });

  // 通り道（地球は1年、火星は687日ぶんの位置をつないだ線）
  el(svg, "path", { d: orbitPath("Earth", now, 366, 3), class: "o-orbit" });
  el(svg, "path", { d: orbitPath("Mars", now, 687, 4), class: "o-orbit mars" });
  el(svg, "circle", { cx: 0, cy: 0, r: 24, class: "o-sun-glow" });
  el(svg, "circle", { cx: 0, cy: 0, r: 5.5, class: "o-sun" });
  label(svg, 0, 17, "太陽", "dim", "middle");

  // MMX の道のり（イメージ）：打ち上げの日の地球から、1年後の火星へ。太陽のまわりを地球と同じ向きに、半径をなめらかに広げる
  const start = helio("Earth", launchAt);
  const later = new Date(launchAt.getTime() + 365 * DAY);
  const goal = helio("Mars", later);
  const a0 = angleOf(start), r0 = radiusOf(start), r1 = radiusOf(goal);
  let a1 = angleOf(goal);
  while (a1 <= a0) a1 += Math.PI * 2;
  let d = "";
  const N = 90;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = a0 + (a1 - a0) * t;
    const r = r0 + (r1 - r0) * (1 - Math.cos(Math.PI * t)) / 2;
    d += `${i ? "L" : "M"}${(Math.cos(a) * r * AU).toFixed(1)} ${(-Math.sin(a) * r * AU).toFixed(1)}`;
  }
  el(svg, "path", { d, class: "o-path", "marker-end": "url(#o-arrow)" });
  {
    const am = a0 + (a1 - a0) * 0.55, rm = r0 + (r1 - r0) * (1 - Math.cos(Math.PI * 0.55)) / 2 - 0.2;
    label(svg, Math.cos(am) * rm * AU, -Math.sin(am) * rm * AU, "MMX の道のり", "ref", "middle");
    label(svg, Math.cos(am) * rm * AU, -Math.sin(am) * rm * AU + 12, "（イメージ）", "ref dim", "middle");
  }

  // 1年後の火星（計算）
  {
    const [x, y] = svgXY(goal);
    el(svg, "circle", { cx: x, cy: y, r: 5, class: "o-mars-later" });
    const ym = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long" }).format(later);
    label(svg, x, y + 17, `${ym}の火星`, "mars", "middle");
    label(svg, x, y + 29, "（計算した位置）", "dim", "middle");
  }

  // きょうの地球と火星
  const E = helio("Earth", now), M = helio("Mars", now);
  const [ex, ey] = svgXY(E), [mx, my] = svgXY(M);
  el(svg, "line", { x1: ex, y1: ey, x2: mx, y2: my, class: "o-link" });
  const km = bodyDistanceKm("Mars", now);
  label(svg, (ex + mx) / 2 + 6, (ey + my) / 2, kmShortJa(km), "mint");
  el(svg, "circle", { cx: mx, cy: my, r: 6, class: "o-mars" });
  label(svg, mx + 10, my - 6, "火星", "mars");
  label(svg, mx + 10, my + 6, "（きょう）", "dim");
  el(svg, "circle", { cx: ex, cy: ey, r: 5.5, class: "o-earth" });
  label(svg, ex + 10, ey + 4, "地球（きょう）", "");

  // MMX：打ち上げ前は地球にいる。打ち上げのあとは、データを確かめるまで描かない
  const postponed = launchEvent && statusOf(launchEvent) === "postponed";
  if (now < launchAt || postponed) {
    const s = 5;
    el(svg, "path", { d: `M${ex - 14} ${ey - 14 - s}l${s} ${s}l-${s} ${s}l-${s} -${s}z`, class: "o-mmx" });
    label(svg, ex - 22, ey - 22, "MMX（打ち上げ前）", "amber", "end");
  } else {
    label(svg, ex - 10, ey - 16, "MMX の位置は準備中", "amber", "end");
  }
}

function renderToday() {
  const now = new Date();
  const km = bodyDistanceKm("Mars", now);
  $("#today-km").textContent = `約 ${kmJa(km)}`;
  $("#today-light").textContent = `光（電波）で片道 ${lightTimeJa(km / C_KM_S, { approx: true })}`;
}

// ---------- 起動 ----------

async function main() {
  await loadLaunch();
  renderCountdown();
  setInterval(renderCountdown, 1000);
  try {
    drawOrbitMap();
    renderToday();
    setInterval(renderToday, 60000);
  } catch (e) {
    console.error(e);
  }
}

main();
