// MMX の国際協力のページ（英語の試作。docs/mmx-partners-study.md）
// 国を選ぶ → 地図のピン（案A）・模型のモジュール（案D）・カードがその国だけ光る。いつ（03）は国によらず全部出す
import { compareAll, monthIndex } from "./timeline.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const data = await fetch("data.json").then((r) => r.json());
const land = fetch("../../data/land-minimap.json").then((r) => r.json()).then((j) => splitWrapped(j.d)).catch(() => "");
// 日付変更線をまたぐ陸地は、地図の端から端へ横線（塗りの帯）になる。端へ飛ぶところで切って、切れた形ごとに閉じる（小さな島は外す）
function splitWrapped(d) {
  return d.match(/M[^M]*/g).map((sp) => {
    const pts = [...sp.matchAll(/([\d.]+) ([\d.]+)/g)].map((m) => [+m[1], +m[2]]);
    const xs = pts.map((p) => p[0]);
    if (Math.max(...xs) - Math.min(...xs) <= 300) return sp;
    if (pts.length < 10) return "";
    const pieces = [[]];
    pts.forEach((p, i) => { if (i && Math.abs(p[0] - pts[i - 1][0]) > 100) pieces.push([]); pieces.at(-1).push(p); });
    return pieces.filter((q) => q.length > 2).map((q) => q.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join("") + "Z").join("");
  }).join("");
}
const C = Object.fromEntries(data.countries.map((c) => [c.id, c]));
const CONTRIB = Object.fromEntries(data.contributions.map((c) => [c.id, c]));
const flag = (id) => C[id]?.flag ?? (id === "AR" ? "🇦🇷" : "");
const srcLinks = (ids) => ids.map((id) => {
  const s = data.sources[id];
  return `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)}<span class="mono"> ↗</span></a>`;
}).join(" · ");

// ---------- 国を選ぶ（はじめはブラウザの言語から。?c=FR でも） ----------
function guessCountry() {
  const q = new URLSearchParams(location.search).get("c");
  if (q && C[q.toUpperCase()]) return q.toUpperCase();
  for (const l of navigator.languages ?? [navigator.language]) {
    for (const c of data.countries) if (c.lang.some((x) => x.includes("-") ? l === x : l.split("-")[0] === x)) return c.id;
  }
  return null;
}
let country = guessCountry();
let view = "world";
let placeId = null;

const chips = $("#chips");
chips.innerHTML = [`<button type="button" data-c="">All</button>`,
  ...data.countries.map((c) => `<button type="button" data-c="${c.id}"><span aria-hidden="true">${c.flag}</span> ${esc(c.name)}</button>`)].join("");
chips.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  country = b.dataset.c || null; placeId = null;
  const u = new URL(location.href); country ? u.searchParams.set("c", country) : u.searchParams.delete("c");
  history.replaceState(null, "", u);
  render();
});

const contribOn = (c) => !country || c.countries.includes(country);
// ピン：その国の担当がある・その国にある（例：マドリードの NASA の局はスペインにある）
const placeOn = (p) => !country || p.host === country || p.contributions.some((id) => CONTRIB[id].countries.includes(country));

// ---------- 01 地図（正距円筒。横360×縦180。js/minimap.js と同じ式） ----------
const VIEWS = { world: [0, 12, 360, 138], europe: [168, 33, 34, 23], japan: [305, 49, 20, 13.5] };
const mx = (lng) => lng + 180, my = (lat) => 90 - lat;
const svg = $("#map");
document.querySelector(".zoom").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  view = b.dataset.view; renderMap();
});
svg.addEventListener("click", (e) => { const g = e.target.closest("[data-place]"); if (g) pick(g.dataset.place); });
svg.addEventListener("keydown", (e) => { const g = e.target.closest("[data-place]"); if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pick(g.dataset.place); } });
$("#place-list").addEventListener("click", (e) => { const b = e.target.closest("[data-place]"); if (b) pick(b.dataset.place); });

function pick(id) {
  placeId = id;
  const p = data.places.find((x) => x.id === id);
  // ヨーロッパ・日本のピンは、世界の地図では重なるので寄る
  if (view === "world") {
    const [x, y] = [mx(p.lng), my(p.lat)];
    for (const v of ["europe", "japan"]) { const [a, b, w, h] = VIEWS[v]; if (x >= a && x <= a + w && y >= b && y <= b + h) view = v; }
  }
  renderMap(); renderPlaceCard();
}

async function renderMap() {
  const vb = VIEWS[view];
  svg.setAttribute("viewBox", vb.join(" "));
  svg.style.aspectRatio = `${vb[2]} / ${vb[3]}`;
  for (const b of document.querySelectorAll(".zoom button")) b.setAttribute("aria-pressed", String(b.dataset.view === view));
  const r = vb[2] * 0.008, fs = vb[2] * 0.026;
  const pins = [...data.places].sort((a, b) => placeOn(a) - placeOn(b)).map((p) => {
    const on = placeOn(p), x = mx(p.lng), y = my(p.lat);
    const left = p.labelSide === "left"; // 近すぎるピン（マドリードとセブレロス）は名前を左右に分ける
    const label = view !== "world" && on ? `<text x="${left ? x - r * 1.8 : x + r * 1.8}" y="${y + fs * 0.35}" font-size="${fs}" text-anchor="${left ? "end" : "start"}">${esc(p.name)}</text>` : "";
    return `<g class="pin${on ? " on" : " off"}${p.network ? " net" : ""}${p.id === placeId ? " sel" : ""}" data-place="${p.id}" tabindex="${on ? 0 : -1}" role="button" aria-label="${esc(p.name)}: ${esc(p.what)}">
      <circle cx="${x}" cy="${y}" r="${r * 2.6}" class="hit"/><circle cx="${x}" cy="${y}" r="${r}" class="dot"/>${label}</g>`;
  }).join("");
  const d = await land;
  svg.innerHTML = `<rect x="0" y="0" width="360" height="180" class="sea"/><path d="${d}" class="land"/>${pins}`;
}

function renderPlaceCard() {
  const box = $("#place-card");
  const p = data.places.find((x) => x.id === placeId);
  if (!p) { box.innerHTML = `<p class="hint">Tap a dot on the map, or pick a place from the list.</p>`; return; }
  const parts = p.contributions.map((id) => CONTRIB[id]).map((c) => `<li><span aria-hidden="true">${c.countries.map(flag).join("")}</span> ${esc(c.part)}</li>`).join("");
  box.innerHTML = `<p class="pc-where mono">${flag(p.host)} ${esc(p.name)}${p.local ? ` <span lang="${p.host === "JP" ? "ja" : "de"}">${esc(p.local)}</span>` : ""}</p>
    <p class="pc-what">${esc(p.what)}</p><ul class="pc-parts">${parts}</ul><p class="src">Source: ${srcLinks(p.sources)}</p>`;
}

function renderPlaceList() {
  $("#place-list").innerHTML = data.places.filter(placeOn).map((p) =>
    `<li><button type="button" data-place="${p.id}"${p.id === placeId ? ' aria-current="true"' : ""}><span aria-hidden="true">${flag(p.host)}</span> ${esc(p.name)}<small>${esc(p.what)}</small></button></li>`).join("");
}

// ---------- 02 探査機（案D：モジュールの単位で） ----------
const ORDER = ["outbound", "explore", "return", "rover", "unplaced", "ground"];
const ON_CRAFT = new Set(["outbound", "explore", "return", "rover"]);
function renderModules() {
  const html = ORDER.map((m) => {
    const items = data.contributions.filter((c) => c.modules.includes(m) && contribOn(c));
    if (!items.length) return "";
    return `<section class="mod${ON_CRAFT.has(m) ? " craft-part" : ""}"><h3>${esc(data.modules[m])}</h3><ul>${items.map((c) =>
      `<li><p class="m-part"><span aria-hidden="true">${c.countries.map(flag).join("")}</span> ${esc(c.part)}</p><p class="m-who">${esc(c.who)}</p><p>${esc(c.role)}</p>${c.note ? `<p class="m-note">Note: ${esc(c.note)}</p>` : ""}<p class="src">${srcLinks(c.sources)}</p></li>`).join("")}</ul></section>`;
  }).join("");
  const none = country && !data.contributions.some((c) => contribOn(c) && c.modules.some((m) => ON_CRAFT.has(m)));
  $("#modules").innerHTML = (none ? `<p class="hint">${esc(C[country].name)} has no hardware listed on the spacecraft itself — its part is on the ground (see the map).</p>` : "") + html;
}
function litModules() {
  if (!country) return null;
  return new Set(data.contributions.filter(contribOn).flatMap((c) => c.modules).filter((m) => ON_CRAFT.has(m)));
}
let model = null;
const canvas = $("#craft");
new IntersectionObserver((es, io) => {
  if (!es.some((e) => e.isIntersecting)) return;
  io.disconnect();
  import("./model.js").then(({ initModel }) => { model = initModel(canvas); model.setLit(litModules()); })
    .catch(() => { canvas.replaceWith(Object.assign(document.createElement("p"), { className: "hint", textContent: "The 3D model could not start on this device." })); });
}, { rootMargin: "300px" }).observe(canvas);

// ---------- 03 いつ（国によらず全部） ----------
function renderWhen() {
  const rows = compareAll(data.timeline);
  const Y0 = 2026, Y1 = 2033, L = 170, R = 12, W = 760, LINE = 14, PAD = 10, TOP = 26;
  const x = (mi) => L + (mi - Y0 * 12) / ((Y1 - Y0) * 12) * (W - L - R);
  const heights = rows.map((m) => Math.max(1, m.dated.length) * LINE + PAD);
  const H = TOP + heights.reduce((a, b) => a + b, 0) + 4;
  const when = $("#when");
  when.setAttribute("viewBox", `0 0 ${W} ${H}`);
  let s = "";
  for (let y = Y0; y <= Y1; y++) s += `<line x1="${x(y * 12)}" x2="${x(y * 12)}" y1="${TOP - 6}" y2="${H - 2}" class="yr"/><text x="${x(y * 12) + 3}" y="${TOP - 10}" class="yt">${y}</text>`;
  let top = TOP;
  rows.forEach((m, i) => {
    const h = heights[i], mid = top + h / 2;
    s += `<line x1="0" x2="${W}" y1="${top}" y2="${top}" class="row"/>`;
    s += `<text x="0" y="${mid + 4}" class="ml${m.status === "agree" ? "" : " warn"}">${m.status === "agree" ? "" : "⚠ "}${esc(m.label)}</text>`;
    if (m.overlap) s += `<rect x="${x(m.overlap[0])}" y="${top + 3}" width="${Math.max(3, x(m.overlap[1] + 1) - x(m.overlap[0]))}" height="${h - 6}" class="ov"/>`;
    m.dated.forEach((c, k) => {
      const yy = top + PAD / 2 + k * LINE + LINE / 2;
      const a = x(monthIndex(c.from)), b = x(monthIndex(c.to) + 1);
      const right = b + 4 + c.publisher.length * 5.6 < W;
      s += `<g><title>${esc(c.publisher)}: ${esc(c.text)}</title><rect x="${a}" y="${yy - 2.5}" width="${Math.max(3, b - a)}" height="5" rx="2.5" class="bar${c.reading ? " read" : ""}"/><text x="${right ? b + 4 : a - 4}" y="${yy + 3.5}" class="pub" text-anchor="${right ? "start" : "end"}">${esc(c.publisher)}</text></g>`;
    });
    if (!m.dated.length) s += `<text x="${L + 4}" y="${mid + 4}" class="pub">no date published</text>`;
    top += h;
  });
  when.innerHTML = s;

  const issues = rows.filter((m) => m.issues.length).map((m) =>
    `<li class="${m.status}"><p class="i-head">${esc(m.label)}</p><ul>${m.issues.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>${m.undated.length ? `<p class="i-also">Also says (no date): ${m.undated.map((c) => `${esc(c.publisher)} — ${esc(c.text)}`).join("; ")}</p>` : ""}</li>`);
  for (const n of data.timeline.numbers) issues.push(`<li class="disagree"><p class="i-head">${esc(n.label)}</p><ul><li>${esc(n.issue)}</li></ul></li>`);
  $("#issues").innerHTML = issues.join("");

  $("#claims").innerHTML = rows.map((m) => `<h4>${esc(m.label)}</h4><ul>${[...m.dated, ...m.undated].map((c) =>
    `<li><strong>${esc(c.publisher)}</strong> — ${esc(c.text)}${c.reading ? ` <em>(${esc(c.reading)})</em>` : ""} ${srcLinks([c.source])}</li>`).join("")}</ul>`).join("")
    + data.timeline.numbers.map((n) => `<h4>${esc(n.label)}</h4><ul>${n.claims.map((c) => `<li><strong>${esc(c.publisher)}</strong> — ${esc(c.text)} ${srcLinks([c.source])}</li>`).join("")}</ul>`).join("");
}

function renderSources() {
  $("#checked").textContent = data.checked;
  $("#sources").innerHTML = Object.values(data.sources).map((s) =>
    `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)} — ${esc(s.title)}</a> <span class="mono">${esc(s.lang)}</span></li>`).join("");
}

function render() {
  for (const b of chips.querySelectorAll("button")) b.setAttribute("aria-pressed", String((b.dataset.c || null) === country));
  renderMap(); renderPlaceCard(); renderPlaceList(); renderModules();
  model?.setLit(litModules());
}

render();
renderWhen();
renderSources();
