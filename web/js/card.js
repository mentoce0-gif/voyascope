// 機体カード（博物館の銘板風）
import { esc, numberJa, latJa, lngJa } from "./format.js";

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

// いま乗っているチーム（打ち上げ済みで、帰還日がないか、まだ来ていない）
export function teamsAboard(crewData, now) {
  const day = now.toISOString().slice(0, 10);
  return (crewData?.teams ?? []).filter((t) => {
    const launched = t.launch_date?.value && t.launch_date.value <= day;
    const returned = t.return_date?.value && t.return_date.value <= day;
    return launched && !returned;
  });
}

function crewHtml(teams) {
  if (!teams.length) return `<span class="k">調べています</span>`;
  const people = teams.flatMap((t) => t.crew);
  const nations = [...new Set(people.map((m) => factText(m.astronaut.nationality)).filter(Boolean))];
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
  const summary = `${people.length}名${nations.length ? `<span class="k">（${nations.join("・")}）</span>` : ""}`;
  return `<div class="crew-summary">${summary}</div>${list}`;
}

// CelesTrak のリンク（lv3：生データ）は norad_id から自動で作る
const rawDataUrl = (noradId) => `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=JSON-PRETTY`;

export function renderCard(el, { card, crewData, now, isSample }) {
  const aboard = teamsAboard(crewData, now);
  const showBanner = isSample || hasUnverified(card) || hasUnverified(aboard);
  const s = card.stats ?? {};

  const headline = [
    launchYear(card.launch_date) && `${launchYear(card.launch_date)}年〜`,
    approxNumber(s.altitude_km) && `高度 ${approxNumber(s.altitude_km)}`,
    approxNumber(s.period_min) && `1周 ${approxNumber(s.period_min).replace(" min", "分")}`,
  ]
    .filter(Boolean)
    .map((t) => `<span class="nw">${t}</span>`);

  const scale = [
    approxNumber(s.mass_kg) && `質量 ${approxNumber(s.mass_kg)}`,
    approxNumber(s.length_m) && `全長 ${approxNumber(s.length_m)}`,
  ]
    .filter(Boolean)
    .map((t) => `<span class="nw">${t}</span>`);

  const operator = [factText(card.operator), factText(card.operator_type, (v) => esc(OPERATOR_TYPE_LABELS[v] ?? v))]
    .filter(Boolean)
    .join("　");

  const row = (icon, label, body) =>
    body ? `<div class="plate-row"><span class="icon" aria-hidden="true">${icon}</span><span class="label">${label}</span><div class="body">${body}</div></div>` : "";

  const links = [
    ...(card.official_links ?? []).map((l) =>
      verified(l.url)
        ? `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} 公式ページ</a>`
        : `<span class="link-off" title="出典確認中のためリンクは無効">${esc(l.label)} 公式ページ（確認中）</span>`,
    ),
    `<a href="${rawDataUrl(card.norad_id)}" target="_blank" rel="noopener noreferrer">軌道の生データ（CelesTrak）</a>`,
  ];

  el.innerHTML = `
    ${
      showBanner
        ? `<p class="sample-banner" role="note"><strong>見本・出典確認中</strong>　出典をまだ確認していない項目があり、内容が正しいとは限りません。</p>`
        : ""
    }
    <div class="plate">
      <div class="plate-brand mono">VOYASCOPE<small>MUSEUM</small></div>
      ${CRAFT_ART[card.id] ? `<img class="plate-art" src="${CRAFT_ART[card.id]}" alt="">` : ""}
      <div class="plate-class"><span class="mono">${esc(CLASS_EN[card.class] ?? card.class)}</span><span class="k">${esc(CLASS_LABELS[card.class] ?? "")}</span></div>
      <h2 id="card-name" class="plate-name">${esc(card.name.ja)}</h2>
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
        ${card.class?.startsWith("crewed") ? row("◍", "滞在", crewHtml(aboard)) : ""}
      </div>
      <p class="plate-links">${links.join('<span class="dot">・</span>')}</p>
      <p class="plate-foot">軌道は公開データからの計算による推定です<br>※非公式ファンメイド作品です。宇宙機関・運用者とは関係ありません。</p>
    </div>
  `;
}

export function updateLive(el, pos) {
  const n = el.querySelector('[data-live="now"]');
  if (!n) return;
  n.innerHTML = pos
    ? [latJa(pos.lat), lngJa(pos.lng), `高度 ${pos.altKm.toFixed(0)} km`].map((t) => `<span class="nw">${t}</span>`).join("　")
    : "計算できません";
}
