// 試作の部屋 03：小さな衛星（docs/cubesat-study.md の 3.・9.〜12.）
// - 地球の上：キューブサットは名前を出さず、小さな立方体の印だけ（「すべて」）。「小さな衛星」にすると名前が出て、
//   同じ仕事の大きい仲間（XRISM）と一緒に光り、ほかの機体は薄くなる
// - 詳細：ものさし（同じ縮尺で大きな衛星と並べる）と、同じ仕事の大きい仲間
// 事実はカード（curation/）と、九州工業大学の発表の原文だけ。VERTECS は config/orbits.json の "lab": true（アプリには出ない）
import { satrecFromOrbit, positionAt } from "../../js/orbit.js";
import { setupEarth } from "../../js/earth.js";
import { displayAltitude, RINGS } from "../../js/scale.js";
import { familyOf } from "../../js/families.js";
import { starfieldDataUrl } from "../../js/stars.js";
import { esc } from "../../js/format.js";

const $ = (s) => document.querySelector(s);
const getJson = (p) => fetch(p).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${p}: ${r.status}`))));

// 小さな衛星（いまは VERTECS だけ）と、同じ仕事の大きい仲間。組み合わせは VOYASCOPE の編集（カードの事実とは分ける。cubesat-study.md 3. C）
const SMALL = [{ id: "vertecs", pair: "xrism" }];
const VERTECS_NEWS = "https://www.kyutech.ac.jp/whats-new/press/entry-12360.html"; // 2026-09-04 定常運用の開始
const VERTECS_LAUNCH = "https://www.kyutech.ac.jp/whats-new/press/entry-12173.html"; // 2026-06-17 軌道投入
// ものさしで並べる大きな衛星（カードの length_m だけを使う）
const RULER = ["xrism", "hinode", "iss"];

const index = await getJson("data/craft-index.json");
const load = async (id, card, orbit) => {
  const [c, o] = await Promise.all([getJson(card), getJson(orbit).catch(() => null)]);
  return { id, card: c, orbit: o };
};
const craft = (
  await Promise.all([
    ...index.craft.map((c) => load(c.id, c.card, c.orbit)),
    ...SMALL.map((s) => load(s.id, `data/cards/${s.id}.json`, `data/orbits/${s.id}.json`)),
  ])
).filter((c) => c.orbit);
const byId = new Map(craft.map((c) => [c.id, c]));
const smallIds = new Set(SMALL.map((s) => s.id));
const pairOf = new Map(SMALL.map((s) => [s.id, s.pair]));

let mode = "all";

// ---------- 印 ----------
const CUBE_SVG = `<svg class="cube" viewBox="-12 -12 24 24" aria-hidden="true">
  <path class="top" d="M0 -9L8 -4.5L0 0L-8 -4.5Z"/><path class="left" d="M-8 -4.5L0 0L0 9L-8 4.5Z"/><path class="right" d="M8 -4.5L0 0L0 9L8 4.5Z"/></svg>`;

for (const c of craft) {
  c.satrec = satrecFromOrbit(c.orbit);
  c.family = familyOf(c.card.class);
  const small = smallIds.has(c.id);
  const el = document.createElement("button");
  el.type = "button";
  el.className = small ? "craft-marker cube-marker" : "craft-marker";
  el.style.setProperty("--c", c.family.color);
  const label = small ? `${c.card.name.en}<span class="u">${esc(c.card.form_factor?.value ?? "")}</span>` : esc(c.card.name.ja.replace(/（.*）/, ""));
  el.innerHTML = small
    ? `<span class="ring"></span>${CUBE_SVG}<span class="tag">${label}</span>`
    : `<span class="ring"></span><span class="core"></span><span class="tag">${label}</span>`;
  el.setAttribute("aria-label", small ? `${c.card.name.ja}（手のひらサイズの衛星・${c.card.form_factor?.value}）の詳細を開く` : `${c.card.name.ja}`);
  if (small) el.addEventListener("click", (e) => (e.stopPropagation(), openSheet(c)));
  c.pin = { el, lat: 0, lng: 0, alt: 0 };
}

function applyMode() {
  document.body.dataset.mode = mode;
  for (const c of craft) {
    const small = smallIds.has(c.id);
    const paired = [...pairOf.values()].includes(c.id);
    c.pin.el.classList.toggle("dim", mode === "small" && !small && !paired);
    c.pin.el.classList.toggle("paired", mode === "small" && paired);
    // 「すべて」では小さな衛星の名前を出さない（混み具合の確認から。cubesat-study.md 10.）
    c.pin.el.classList.toggle("no-tag", mode === "all" && small);
  }
  for (const b of document.querySelectorAll(".cs-switch button")) b.setAttribute("aria-checked", String(b.dataset.mode === mode));
  $("#hint").textContent =
    mode === "small"
      ? "VERTECS（6U）と XRISM：どちらも地球のすぐまわりを回る、宇宙を見る望遠鏡。VERTECS は可視光、XRISM は X線で見る。"
      : "立方体の印が、手のひらサイズの衛星。押すと詳しく見られます。";
}

// ---------- 地球 ----------
const ringPaths = RINGS.map((r) => ({
  points: Array.from({ length: 181 }, (_, i) => [0, -180 + i * 2, r.alt]),
}));
const globeEl = $("#cs-globe");
const globe = Globe()(globeEl)
  .backgroundColor("#050e1f")
  .backgroundImageUrl(starfieldDataUrl())
  .showAtmosphere(true)
  .atmosphereColor("#5ef2c2")
  .atmosphereAltitude(0.16)
  .pathsData(ringPaths)
  .pathPoints("points")
  .pathPointLat((p) => p[0])
  .pathPointLng((p) => p[1])
  .pathPointAlt((p) => p[2])
  .pathColor(() => "rgba(94, 242, 194, 0.3)")
  .pathDashLength(0.012)
  .pathDashGap(0.008)
  .pathTransitionDuration(0)
  .htmlElementsData(craft.map((c) => c.pin))
  .htmlLat("lat")
  .htmlLng("lng")
  .htmlAltitude("alt")
  .htmlElement((d) => d.el)
  .htmlTransitionDuration(0);
const updateSun = setupEarth(globe);
const fit = () => globe.width(globeEl.clientWidth).height(globeEl.clientHeight);
new ResizeObserver(fit).observe(globeEl);
fit();

function tick() {
  const now = new Date();
  for (const c of craft) {
    const p = positionAt(c.satrec, now);
    if (!p) continue;
    Object.assign(c.pin, { lat: p.lat, lng: p.lng, alt: displayAltitude(p.altKm) });
    c.altKm = p.altKm;
  }
  updateSun(now);
  globe.htmlElementsData(craft.map((c) => c.pin));
}
tick();
setInterval(tick, 1000);
const v = byId.get("vertecs");
globe.pointOfView({ lat: v?.pin.lat ?? 30, lng: v?.pin.lng ?? 135, altitude: 2.6 }, 0);

for (const b of document.querySelectorAll(".cs-switch button")) {
  b.addEventListener("click", () => {
    mode = b.dataset.mode;
    applyMode();
    if (mode === "small" && v) globe.pointOfView({ lat: v.pin.lat, lng: v.pin.lng }, 900);
  });
}
applyMode();

// ---------- 詳細：ものさし と 仲間 ----------
const len = (c) => c?.card.stats?.length_m?.value;
const fmtM = (m) => (m < 1 ? `${Math.round(m * 100)} cm` : `${m} m`);

// 同じ縮尺の横棒。step 0 は VERTECS だけ（cm の目盛り）、step 1〜は大きな衛星を1つずつ足す
function rulerSvg(c, step) {
  const me = len(c);
  const others = RULER.slice(0, step).map((id) => byId.get(id)).filter((o) => len(o));
  if (step === 0) {
    // 6U の面（226 mm × 340 mm）を 1U ずつ（2×3）に区切って、10 cm の目盛りと並べる
    const s = 0.55; // 1 mm あたりの px
    const w = 226 * s, h = 340 * s;
    const cells = [];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) cells.push(`<rect x="${20 + (i * w) / 2}" y="${10 + (j * h) / 3}" width="${w / 2}" height="${h / 3}" class="u1"/>`);
    return `<svg viewBox="0 0 320 210" class="ruler" role="img" aria-label="VERTECS の大きさ。100 mm × 226 mm × 340 mm。1U（約10 cm 角）の6つ分">
      ${cells.join("")}<rect x="20" y="10" width="${w}" height="${h}" class="body"/>
      <line x1="170" y1="${10 + h}" x2="${170 + 100 * s}" y2="${10 + h}" class="bar"/><line x1="170" y1="${4 + h}" x2="170" y2="${16 + h}" class="bar"/><line x1="${170 + 100 * s}" y1="${4 + h}" x2="${170 + 100 * s}" y2="${16 + h}" class="bar"/>
      <text x="170" y="${h - 4}" class="t">10 cm</text>
      <text x="170" y="40" class="t big">${esc(c.card.form_factor.value)}</text>
      <text x="170" y="62" class="t">1U（約10 cm 角）の6つ分</text>
      <text x="170" y="84" class="t k">100 × 226 × 340 mm</text>
    </svg>`;
  }
  const all = [{ name: c.card.name.en, m: me, me: true }, ...others.map((o) => ({ name: o.card.name.ja.replace(/（.*）/, ""), m: len(o) }))];
  const max = Math.max(...all.map((a) => a.m));
  const W = 270;
  const rows = all
    .map((a, i) => {
      const w = Math.max(2, (a.m / max) * W);
      return `<g transform="translate(20 ${18 + i * 40})"><rect width="${w}" height="12" class="${a.me ? "me" : "big"}"/>
        <text y="-4" class="t">${esc(a.name)}　<tspan class="k">${fmtM(a.m)}</tspan></text></g>`;
    })
    .join("");
  return `<svg viewBox="0 0 320 ${30 + all.length * 40}" class="ruler" role="img" aria-label="同じ縮尺の長さ：${all.map((a) => `${a.name} ${fmtM(a.m)}`).join("、")}">${rows}</svg>`;
}

function rulerNote(c, step) {
  if (step === 0) return "いちばん長い辺は 34 cm。";
  const o = byId.get(RULER[step - 1]);
  const ratio = Math.round(len(o) / len(c));
  return `${esc(o.card.name.ja.replace(/（.*）/, ""))}（${fmtM(len(o))}）は、VERTECS のいちばん長い辺の約${ratio}倍。<span class="k">長さは各カードの公式の値から計算</span>`;
}

let step = 0;
function renderRuler(c) {
  $("#ruler").innerHTML = rulerSvg(c, step);
  $("#ruler-note").innerHTML = rulerNote(c, step);
  $("#ruler-next").textContent = step < RULER.length ? "もっと大きな衛星と並べる ›" : "はじめに戻る";
}

const src = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;

function openSheet(c) {
  const k = c.card;
  const pair = byId.get(pairOf.get(c.id));
  step = 0;
  $("#sheet-body").innerHTML = `
    <p class="lab-eyebrow mono">SMALL SAT · ${esc(k.form_factor.value)}</p>
    <h2 id="cs-name">${esc(k.name.ja)}</h2>
    <p class="cs-lead">${esc(k.mission.value)}</p>
    <dl class="cs-facts">
      <dt>つくり手</dt><dd>${k.builder.value.map(esc).join("・")}<span class="k">（大学・高専）</span></dd>
      <dt>打ち上げ</dt><dd>${esc(k.launch_date.value)}　${esc(k.launch_date.note)}</dd>
      <dt>いま</dt><dd>運用中（${esc(k.status.note)}）。高さ 約<span id="alt">${Math.round(c.altKm ?? 0)}</span> km<span class="k">（計算値）</span></dd>
    </dl>

    <h3>ものさし</h3>
    <div id="ruler"></div>
    <p class="small" id="ruler-note"></p>
    <button type="button" class="btn" id="ruler-next"></button>

    <h3>同じ仕事の大きい仲間</h3>
    <ul class="cs-pairs">
      ${
        pair
          ? `<li><button type="button" class="btn" id="show-pair"><strong>${esc(pair.card.name.ja)}</strong><span class="k small">地球のまわり・同じ低軌道。宇宙を見る望遠鏡（VERTECS は可視光、XRISM は X線）。押すと地球の上で一緒に光る</span></button></li>`
          : ""
      }
      <li class="cs-quote"><strong>ジェイムズ・ウェッブ宇宙望遠鏡</strong><span class="k small">（遠くを見る部屋）</span>
        <blockquote>「1回の観測で満月の約40倍もの広さの領域を観測することができます。」「ジェイムズウェッブ宇宙望遠鏡やユークリッド衛星などこれまでの宇宙望遠鏡では、このような広域の画像を得るのに多数回の観測を行う必要があります。」</blockquote>
        <span class="k small">出典：${src(VERTECS_NEWS, "九州工業大学（2026-09-04）")}。得意なことがちがう：VERTECS は広く一度に、大きな望遠鏡は深く細かく</span></li>
    </ul>

    <p class="k small">出典：${src(VERTECS_LAUNCH, "九州工業大学（2026-06-17）")}・${src(VERTECS_NEWS, "同（2026-09-04）")}　公式：${k.official_links.map((l) => src(l.url, l.label)).join("・")}</p>`;
  renderRuler(c);
  $("#ruler-next").addEventListener("click", () => {
    step = step < RULER.length ? step + 1 : 0;
    renderRuler(c);
  });
  $("#show-pair")?.addEventListener("click", () => {
    mode = "small";
    applyMode();
    closeSheet();
    globe.pointOfView({ lat: (c.pin.lat + pair.pin.lat) / 2, lng: c.pin.lng, altitude: 3.2 }, 900);
  });
  $("#sheet").hidden = false;
  c.pin.el.classList.add("selected");
}
function closeSheet() {
  $("#sheet").hidden = true;
  for (const c of craft) c.pin.el.classList.remove("selected");
}
$("#close").addEventListener("click", closeSheet);
document.addEventListener("keydown", (e) => e.key === "Escape" && closeSheet());
