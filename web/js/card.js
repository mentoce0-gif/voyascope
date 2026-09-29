// 機体のキャラカード（HUD 風）
import { evaluateStats } from "./rank.js";
import { esc, plainDateJa, numberJa, latStr, lngStr } from "./format.js";

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

const OPERATOR_TYPE_LABELS = {
  civil: "民生（政府・研究機関）",
  commercial: "商業（企業）",
  military: "軍事",
  mixed: "混合",
};

// 出典が確認済みか（https の URL が入っているか）
const verified = (src) => typeof src === "string" && src.startsWith("https://");

function sourceTag(src) {
  if (verified(src)) {
    return `<a class="pending" href="${esc(src)}" target="_blank" rel="noopener noreferrer">出典</a>`;
  }
  return `<span class="pending" title="出典URLがまだ確認できていない項目です">出典確認中</span>`;
}

function factHtml(fact, render = (v) => esc(v)) {
  if (!fact) return `<span class="k">—</span>`;
  if (fact.undisclosed) return `非公開`;
  const value = Array.isArray(fact.value) ? fact.value.map(render).join("・") : render(fact.value);
  const note = fact.note ? ` <span class="note">（${esc(fact.note)}）</span>` : "";
  return `${value}${note}${sourceTag(fact.source)}`;
}

function hasUnverified(card) {
  let found = false;
  const walk = (node, key) => {
    if (found || node === null) return;
    if (typeof node === "string") {
      if ((key === "source" || key === "url") && !verified(node)) found = true;
      return;
    }
    if (typeof node === "object") for (const [k, v] of Object.entries(node)) walk(v, Array.isArray(node) ? key : k);
  };
  walk(card);
  return found;
}

// CelesTrak のリンク（lv3：生データ）は norad_id から自動で作る
function rawDataLinks(noradId) {
  return [
    {
      label: "CelesTrak 軌道データ（TLE）",
      url: `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=tle`,
      desc: `NORAD番号 ${noradId}（世界中の人工衛星につけられた通し番号）で検索した結果`,
    },
  ];
}

export function renderCard(el, { card, thresholds, isSample }) {
  const { rows, overall } = evaluateStats(card.stats, thresholds);
  const showBanner = isSample || hasUnverified(card);

  const statsHtml = rows
    .map((r) => {
      const unit = r.fact?.unit ? ` ${esc(r.fact.unit)}` : "";
      const value = r.undisclosed
        ? "非公開"
        : `${numberJa(r.fact.value)}${unit}${r.fact.note ? `（${esc(r.fact.note)}）` : ""}${sourceTag(r.fact.source)}`;
      return `<li class="stat">
        <div class="stat-label">${esc(r.rule.label)}<small>${esc(r.rule.help)}</small></div>
        <div class="gauge" role="img" aria-label="${esc(r.rule.label)}のゲージ ${Math.round(r.gauge * 100)}%"><span style="width:${(r.gauge * 100).toFixed(1)}%"></span></div>
        <div class="stat-rank" aria-label="ランク">${r.rank ?? "−"}</div>
        <div class="stat-value">${value}</div>
      </li>`;
    })
    .join("");

  const move = (title, m) =>
    m
      ? `<div class="move"><span class="k">${title}</span>${esc(m.text)}${sourceTag(m.source)}</div>`
      : "";

  const official = (card.official_links ?? [])
    .map((l) => {
      const ok = verified(l.url);
      return `<li><span class="lv">lv2</span>${
        ok
          ? `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} 公式ページ</a>`
          : `<a aria-disabled="true" tabindex="-1">${esc(l.label)} 公式ページ</a><span class="pending">出典確認中のためリンク無効</span>`
      }</li>`;
    })
    .join("");

  const raw = rawDataLinks(card.norad_id)
    .map(
      (l) => `<li><span class="lv">lv3</span><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a>
        <span class="desc">${esc(l.desc)}</span></li>`,
    )
    .join("");

  el.innerHTML = `
    ${
      showBanner
        ? `<p class="sample-banner" role="note"><strong>見本・出典確認中</strong><br>このカードは見本です。出典をまだ確認していない項目があり、内容が正しいとは限りません。</p>`
        : ""
    }
    <div class="card-head">
      <div>
        <div class="card-class mono">${esc(CLASS_LABELS[card.class] ?? card.class)} / ${esc(card.class.toUpperCase())}</div>
        <h2 id="card-name" class="card-name">${esc(card.name.ja)}</h2>
        <div class="card-name-en mono">${esc(card.name.en)}</div>
      </div>
      <div class="overall" aria-label="総合ランク ${overall ?? "なし"}">
        <span class="k">総合ランク</span>
        <span class="rank-big">${overall ?? "−"}</span>
      </div>
    </div>
    ${card.catchphrase ? `<p class="catch">「${esc(card.catchphrase)}」 <span class="k">※キャッチコピーは創作です</span></p>` : ""}

    <h3 class="section-title">STATUS</h3>
    <ul class="stats">${statsHtml}</ul>
    <p class="live-note">ゲージとランクは数値から自動で計算しています（基準は仮のもの）。</p>

    <h3 class="section-title">LIVE</h3>
    <dl class="live">
      <dt>緯度</dt><dd data-live="lat">--</dd>
      <dt>経度</dt><dd data-live="lng">--</dd>
      <dt>高度</dt><dd data-live="alt">--</dd>
      <dt>速さ</dt><dd data-live="spd">--</dd>
      <dt>1周の時間</dt><dd data-live="period">--</dd>
    </dl>
    <p class="live-note">軌道データから計算した、観測時刻での値です。</p>

    <h3 class="section-title">PROFILE</h3>
    <dl class="facts">
      <dt>運用</dt><dd>${factHtml(card.operator)}</dd>
      <dt>運用の種類</dt><dd>${factHtml(card.operator_type, (v) => esc(OPERATOR_TYPE_LABELS[v] ?? v))}</dd>
      <dt>打ち上げ</dt><dd>${factHtml(card.launch_date, plainDateJa)}</dd>
      <dt>任務</dt><dd>${factHtml(card.mission)}</dd>
    </dl>

    ${
      card.special_move || card.weakness
        ? `<h3 class="section-title">SKILL</h3><div class="moves">${move("得意技", card.special_move)}${move("弱点", card.weakness)}</div>`
        : ""
    }

    <h3 class="section-title">LINKS</h3>
    <ul class="links">${official}${raw}</ul>
  `;
}

export function updateLive(el, pos, periodMin) {
  const set = (k, v) => {
    const n = el.querySelector(`[data-live="${k}"]`);
    if (n) n.textContent = v;
  };
  set("period", Number.isFinite(periodMin) ? `${periodMin.toFixed(1)} 分` : "--");
  if (!pos) {
    for (const k of ["lat", "lng", "alt", "spd"]) set(k, "計算できません");
    return;
  }
  set("lat", latStr(pos.lat));
  set("lng", lngStr(pos.lng));
  set("alt", `${pos.altKm.toFixed(1)} km`);
  set("spd", `${pos.speedKmS.toFixed(2)} km/s`);
}
