// 機体の詳細パネル（タブ：概要／滞在／軌道／リンク）
import { esc, numberJa, latJa, lngJa } from "./format.js";
import { RINGS, ringOf } from "./scale.js";

const CLASS_LABELS = {
  crewed_station: "有人宇宙基地",
  crewed_vehicle: "有人宇宙船",
  science: "科学衛星",
  earth_observation: "地球観測衛星",
  weather: "気象衛星",
  navigation: "測位衛星",
  communication: "通信衛星",
  technology: "技術試験衛星",
  other: "その他",
};

const CLASS_EN = {
  crewed_station: "CREWED STATION",
  crewed_vehicle: "CREWED VEHICLE",
  science: "SCIENCE",
  earth_observation: "EARTH OBSERVATION",
  weather: "WEATHER",
  navigation: "NAVIGATION",
  communication: "COMMUNICATION",
  technology: "TECHNOLOGY",
  other: "OTHER",
};

const OPERATOR_TYPE_LABELS = {
  civil: "民生（政府・研究機関）",
  commercial: "商業（企業）",
  military: "軍事",
  mixed: "混合",
};

// 機体の線画（web/assets/craft/<id>.svg）。ないときは出さない
const CRAFT_ART = { iss: "assets/craft/iss.svg" };

export const TABS = [
  { id: "overview", label: "概要" },
  { id: "crew", label: "滞在", crewedOnly: true },
  { id: "orbit", label: "軌道" },
  { id: "links", label: "リンク" },
];

// 出典が確認済みか（https の URL が入っているか）
const verified = (src) => typeof src === "string" && src.startsWith("https://");

function hasUnverified(node, key) {
  if (node === null || node === undefined) return false;
  if (typeof node === "string") return (key === "source" || key === "url") && !verified(node);
  if (typeof node === "object") {
    return Object.entries(node).some(([k, v]) => hasUnverified(v, Array.isArray(node) ? key : k));
  }
  return false;
}

// 事実の値を文字列に（非公開・未記入も扱う）
function factText(fact, render = (v) => esc(v)) {
  if (!fact) return null;
  if (fact.undisclosed) return "非公開";
  return Array.isArray(fact.value) ? fact.value.map(render).join("・") : render(fact.value);
}

// 「おおよその値」と書かれた数値には「約」を付ける
function approxNumber(fact) {
  if (!fact || fact.undisclosed) return null;
  const approx = /おおよそ|約/.test(fact.note ?? "") ? "約 " : "";
  return `${approx}${numberJa(fact.value)}${fact.unit ? ` ${esc(fact.unit)}` : ""}`;
}

const launchYear = (fact) => /^(\d{4})/.exec(fact?.value ?? "")?.[1];
const nw = (t) => `<span class="nw">${t}</span>`;

// いま乗っているチーム（打ち上げ済みで、帰還日がないか、まだ来ていない）
export function teamsAboard(crewData, now) {
  const day = now.toISOString().slice(0, 10);
  return (crewData?.teams ?? []).filter((t) => {
    const launched = t.launch_date?.value && t.launch_date.value <= day;
    const returned = t.return_date?.value && t.return_date.value <= day;
    return launched && !returned;
  });
}

export const isCrewed = (card) => card.class?.startsWith("crewed");

function crewSummary(teams) {
  if (!teams.length) return null;
  const people = teams.flatMap((t) => t.crew);
  const nations = [...new Set(people.map((m) => factText(m.astronaut.nationality)).filter(Boolean))];
  return `${people.length}名${nations.length ? `<span class="k">（${nations.join("・")}）</span>` : ""}`;
}

function crewHtml(teams) {
  if (!teams.length) return `<p class="k">いま滞在しているチームを調べています。</p>`;
  const list = teams
    .map((t) => {
      const members = t.crew
        .map((m) => {
          const a = m.astronaut;
          const name = a.name?.ja ?? a.id;
          const detail = [factText(a.nationality), factText(a.agency)].filter(Boolean).join("・");
          const role = factText(m.role);
          return `<li><span class="who">${esc(name)}</span>${detail ? `<span class="k">（${detail}）</span>` : ""}${role ? ` <span class="role">${role}</span>` : ""}</li>`;
        })
        .join("");
      return `<div class="team"><div class="team-name">${factText(t.name) ?? esc(t.id)}<span class="k">　乗機：${factText(t.vehicle) ?? "—"}</span></div><ul class="members">${members}</ul></div>`;
    })
    .join("");
  return `<div class="crew-summary">${crewSummary(teams)}</div>${list}
    <p class="k small">顔写真は載せていません。くわしくは各機関の公式プロフィールへ。</p>`;
}

// CelesTrak のリンク（生データ）は norad_id から自動で作る
const rawDataUrl = (noradId) => `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=JSON-PRETTY`;

const row = (icon, label, body) =>
  body
    ? `<div class="plate-row"><span class="icon" aria-hidden="true">${icon}</span><span class="label">${label}</span><div class="body">${body}</div></div>`
    : "";

function overviewHtml(card, aboard, family) {
  const s = card.stats ?? {};
  const headline = [
    launchYear(card.launch_date) && `${launchYear(card.launch_date)}年〜`,
    approxNumber(s.altitude_km) && `高度 ${approxNumber(s.altitude_km)}`,
    approxNumber(s.period_min) && `1周 ${approxNumber(s.period_min).replace(" min", "分")}`,
  ]
    .filter(Boolean)
    .map(nw);
  const scale = [
    approxNumber(s.mass_kg) && `質量 ${approxNumber(s.mass_kg)}`,
    approxNumber(s.length_m) && `全長 ${approxNumber(s.length_m)}`,
  ]
    .filter(Boolean)
    .map(nw);
  const operator = [factText(card.operator), factText(card.operator_type, (v) => esc(OPERATOR_TYPE_LABELS[v] ?? v))]
    .filter(Boolean)
    .join("　");
  return `
    <div class="plate">
      ${CRAFT_ART[card.id] ? `<img class="plate-art" src="${CRAFT_ART[card.id]}" alt="">` : ""}
      <div class="plate-class"><span class="mono">${esc(CLASS_EN[card.class] ?? card.class)}</span><span class="k">${esc(CLASS_LABELS[card.class] ?? "")}</span></div>
      <h3 class="plate-name">${esc(card.name.ja)}</h3>
      <div class="plate-name-en">${esc(card.name.en)}</div>
      ${headline.length ? `<p class="plate-headline">${headline.join('<span class="dot">・</span>')}</p>` : ""}
      ${
        card.catchphrase
          ? `<p class="plate-catch">「${esc(card.catchphrase)}」</p><p class="k plate-catch-note">キャッチコピーは創作です</p>`
          : ""
      }
      <div class="plate-rows">
        ${row("◉", "運用", operator)}
        ${row("◎", "任務", factText(card.mission))}
        ${row("▣", "規模", scale.join("　"))}
        ${row("◈", "いま", `<span data-live="now" class="mono">--</span><span class="k">（計算値）</span>`)}
        ${isCrewed(card) ? row("◍", "滞在", crewSummary(aboard) ?? `<span class="k">調べています</span>`) : ""}
        ${row("●", "家族", `<span class="fam-dot" style="--c:${family.color}"></span>${esc(family.label)}`)}
      </div>
    </div>`;
}

function orbitHtml() {
  return `
    <dl class="orbit-stats">
      <dt>高度</dt><dd data-live="alt">--</dd>
      <dt>速さ</dt><dd data-live="spd">--</dd>
      <dt>1周</dt><dd data-live="period">--</dd>
      <dt>環</dt><dd data-live="ring">--</dd>
      <dt>緯度</dt><dd data-live="lat">--</dd>
      <dt>経度</dt><dd data-live="lng">--</dd>
    </dl>
    <figure class="minimap">
      <svg viewBox="0 0 360 180" role="img" aria-label="前後90分の地上軌跡" data-live="map"></svg>
      <figcaption class="k small"><span class="mm-key past"></span>90分前まで　<span class="mm-key future"></span>90分後まで　<span class="mm-key now"></span>観測時刻</figcaption>
    </figure>
    <p class="k small">すべて公開の軌道データからの計算による推定です。</p>`;
}

function linksHtml(card, orbitMeta) {
  const links = [
    ...(card.official_links ?? []).map((l) =>
      verified(l.url)
        ? `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} 公式ページ</a></li>`
        : `<li><span class="link-off">${esc(l.label)} 公式ページ</span> <span class="k small">（出典確認中のためリンクは無効）</span></li>`,
    ),
    `<li><a href="${rawDataUrl(card.norad_id)}" target="_blank" rel="noopener noreferrer">軌道の生データ（CelesTrak）</a> <span class="k small">NORAD番号 ${card.norad_id}</span></li>`,
  ];
  return `
    <ul class="link-list">${links.join("")}</ul>
    ${orbitMeta ? `<p class="k small">軌道データ：${esc(orbitMeta)}</p>` : ""}`;
}

export function renderPanel(el, { card, crewData, now, isSample, family, tab = "overview", orbitMeta }) {
  const aboard = teamsAboard(crewData, now);
  const showBanner = isSample || hasUnverified(card) || hasUnverified(aboard);
  const tabs = TABS.filter((t) => !t.crewedOnly || isCrewed(card));
  const current = tabs.some((t) => t.id === tab) ? tab : "overview";
  const bodies = {
    overview: () => overviewHtml(card, aboard, family),
    crew: () => crewHtml(aboard),
    orbit: () => orbitHtml(),
    links: () => linksHtml(card, orbitMeta),
  };
  el.innerHTML = `
    <header class="panel-head">
      <div>
        <div class="panel-title"><span class="amber">${esc(card.name.ja)}</span></div>
        <div class="panel-ja"><span class="panel-en">${esc(card.name.en)}</span>　<span class="k">NORAD ${card.norad_id}</span></div>
      </div>
      <button type="button" class="close mono" data-close aria-label="詳細を閉じる">×</button>
    </header>
    ${
      showBanner
        ? `<p class="sample-banner" role="note"><strong>見本・出典確認中</strong>　出典をまだ確認していない項目があり、内容が正しいとは限りません。</p>`
        : ""
    }
    <nav class="tabs" role="tablist">
      ${tabs
        .map(
          (t) =>
            `<button type="button" role="tab" class="tab" data-tab="${t.id}" aria-selected="${t.id === current}">${t.label}</button>`,
        )
        .join("")}
    </nav>
    <div class="tab-body" role="tabpanel">${bodies[current]()}</div>
    <p class="panel-foot">軌道は公開データからの計算による推定です。<br>※非公式ファンメイド作品です。宇宙機関・運用者とは関係ありません。</p>
  `;
  return current;
}

export function updatePanelLive(el, { pos, periodMin }) {
  const set = (k, html) => {
    const n = el.querySelector(`[data-live="${k}"]`);
    if (n) n.innerHTML = html;
  };
  if (!pos) {
    for (const k of ["now", "alt", "spd", "lat", "lng", "ring"]) set(k, "計算できません");
    return;
  }
  set("now", [latJa(pos.lat), lngJa(pos.lng), `高度 ${pos.altKm.toFixed(0)} km`].map(nw).join("　"));
  set("alt", `${pos.altKm.toFixed(1)} km`);
  set("spd", `${pos.speedKmS.toFixed(2)} km/s`);
  set("period", Number.isFinite(periodMin) ? `約 ${periodMin.toFixed(1)} 分` : "--");
  const ring = RINGS.find((r) => r.id === ringOf(pos.altKm));
  set("ring", ring ? `${ring.label}（${ring.en}）` : "--");
  set("lat", latJa(pos.lat));
  set("lng", lngJa(pos.lng));
}
