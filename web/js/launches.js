// 世界の打ち上げ（参考）：The Space Devs の Launch Library 2 から作った予定（web/data/launches.json）を日本語で出す。
// データは scripts/fetch-launches.mjs が6時間ごとに作る。宇宙機関の公式の発表ではないので、
// 一覧・詳細・地球のピンに「参考」の印を付け、公式の予定とは分けて出す。上のバーの「次の出来事」には出さない
import { esc } from "./format.js";
import { eventSpan, statusOf, countdownParts, jstDay, md, weekday, GRACE_MS } from "./events.js";

// 「参考」の印の説明（ホバー・フォーカスで出す。詳細には常に出す。読み上げにも入れる）
export const REF_NOTE = "The Space Devs 参照（正確な情報は公式サイトを確認ください）";
export const SOURCE_LABEL = "Launch Library 2（The Space Devs）";
export const SOURCE_URL = "https://thespacedevs.com/llapi";
// 取得から48時間たったデータは出さない（取得が止まっている）
export const STALE_MS = 48 * 3600000;

const DAY = 86400000;
const JST = 9 * 3600000;
// 公式の予定と同じ打ち上げとみなす：射場が60km以内で、日時の差が2日以内
const SAME_SITE_KM = 60;
const SAME_TIME_MS = 2 * DAY;
// 時刻まで出ているもの（秒・分・時）。それ以外（午前・午後・その日）は日付だけ
const TIMED = new Set(["sec", "min", "hour"]);

const pad = (n) => String(n).padStart(2, "0");
const jstClock = (t) => {
  const j = new Date(t + JST);
  return { h: j.getUTCHours(), m: pad(j.getUTCMinutes()), s: pad(j.getUTCSeconds()) };
};

// ---------- 名前 ----------
export const missionName = (l) => l.mission?.name ?? l.rocket.name;
export const placeName = (l) => l.site.ja ?? l.site.name;
export const providerName = (l) => l.provider?.ja ?? l.provider?.name ?? null;
const countryName = (l) => l.site.country_ja ?? l.site.country ?? "";
// 一覧・ピン用の短い場所：「ケネディ（アメリカ）」。短い名前がなければ国だけ
export function placeShort(l, { country = true } = {}) {
  const c = countryName(l);
  if (!l.site.short) return c || l.site.name;
  return country && c ? `${l.site.short}（${c}）` : l.site.short;
}

// ---------- 日時 ----------
// 予定の始まりと、一覧から消す時刻。時刻まで出ているものは予定の時刻から6時間、日付だけのものは日本時間の翌日いっぱい
export function launchSpan(l) {
  const t = Date.parse(l?.net ?? "");
  if (Number.isNaN(t)) return null;
  if (TIMED.has(l.precision)) return { timed: true, start: t, end: t + GRACE_MS };
  const start = Date.parse(`${jstDay(new Date(t))}T00:00:00Z`) - JST;
  return { timed: false, start, end: start + 2 * DAY };
}

// 一覧の左の小さな日付（2行）：「10/2」「12:53」。時だけなら「4時ごろ」、日付だけなら「ごろ」
export function launchWhenShort(l, now) {
  const t = Date.parse(l.net);
  const day = jstDay(new Date(t));
  const d1 = `${day.slice(0, 4) === jstDay(now).slice(0, 4) ? "" : `${day.slice(0, 4)}/`}${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
  const c = jstClock(t);
  if (l.precision === "sec" || l.precision === "min") return [d1, `${c.h}:${c.m}`];
  if (l.precision === "hour") return [d1, `${c.h}時ごろ`];
  return [d1, "ごろ"];
}

// 詳細の日時：「2026年10月2日（金）12時53分（日本時間）」
export function launchWhenText(l) {
  const t = Date.parse(l.net);
  const day = jstDay(new Date(t));
  const date = `${Number(day.slice(0, 4))}年${md(day)}（${weekday(day)}）`;
  const c = jstClock(t);
  if (l.precision === "sec") return `${date}${c.h}時${c.m}分${c.s}秒（日本時間）`;
  if (l.precision === "min") return `${date}${c.h}時${c.m}分（日本時間）`;
  if (l.precision === "hour") return `${date}${c.h}時ごろ（日本時間）`;
  return `${date}ごろ`;
}

const PRECISION_NOTES = {
  hour: "時刻はおおよそです（1時間の幅）",
  am: "時刻は決まっていません（現地の午前の予定）",
  pm: "時刻は決まっていません（現地の午後の予定）",
  day: "時刻は決まっていません（その日のうちの予定）",
};

// 打ち上げられる時間の終わり：「13時42分まで」（日付が変わるなら日付も）
function windowEndText(l) {
  if (!l.window_end || !(l.precision === "sec" || l.precision === "min")) return "";
  const t = Date.parse(l.window_end);
  if (Number.isNaN(t)) return "";
  const c = jstClock(t);
  const day = jstDay(new Date(t));
  const sameDay = day === jstDay(new Date(Date.parse(l.net)));
  return `${sameDay ? "" : `${md(day)}の`}${c.h}時${c.m}分まで（日本時間）`;
}

// 残り時間のことば：「あと13時間9分」「あと8日」。時刻を過ぎたら「予定の時刻を過ぎました」。
// 時までしか出ていないものは「あと約…」（一覧では幅がないので approx: false で「約」を省く。日時の欄に「ごろ」と出ている）
export function launchCountdownText(l, now, { approx = true } = {}) {
  const span = launchSpan(l);
  if (!span) return "";
  if (span.timed) {
    const ms = span.start - now.getTime();
    if (ms <= 0) return "予定の時刻を過ぎました";
    const { d, h, m } = countdownParts(ms);
    const ca = approx ? "約" : "";
    if (l.precision === "hour") return d > 0 ? `あと${ca}${d}日${h}時間` : h > 0 ? `あと${ca}${h}時間` : "まもなく";
    if (d > 0) return `あと${d}日${h}時間`;
    if (h > 0) return `あと${h}時間${m}分`;
    return m > 0 ? `あと${m}分` : "まもなく";
  }
  const n = Math.round((Date.parse(`${jstDay(new Date(Date.parse(l.net)))}T00:00:00Z`) - Date.parse(`${jstDay(now)}T00:00:00Z`)) / DAY);
  if (n > 1) return `あと${n}日`;
  if (n === 1) return "明日";
  return n === 0 ? "今日" : "";
}

// 詳細の大きな残り時間（Go で、分まで出ているものだけ。毎秒書き換える）
export function bigLaunchCountdown(l, now) {
  if (l.status !== "go" || !(l.precision === "sec" || l.precision === "min")) return null;
  const ms = Date.parse(l.net) - now.getTime();
  if (!(ms > 0)) return null;
  const { d, h, m, s } = countdownParts(ms);
  return `${d}日 ${pad(h)}時間 ${pad(m)}分 ${pad(s)}秒`;
}

// 「10月2日 8:00」（日本時間）
export function jstShort(iso) {
  const t = Date.parse(iso ?? "");
  if (Number.isNaN(t)) return "";
  const c = jstClock(t);
  return `${md(jstDay(new Date(t)))} ${c.h}:${c.m}`;
}

// ---------- どれを出すか ----------
// データの状態："ok"／"stale"（取得から48時間以上）／"missing"（読めない）。古さは実際の今で判断する
export function dataState(data, realNow) {
  if (!data || !Array.isArray(data.launches)) return "missing";
  const t = Date.parse(data.fetched_at ?? "");
  return Number.isNaN(t) || realNow.getTime() - t > STALE_MS ? "stale" : "ok";
}

export function distanceKm(a, b) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// 公式の予定（events.json）と同じ打ち上げか。同じなら公式の方だけを出す。
// 延期中の公式の予定とは突き合わせない（公式の新しい日時はまだないので、こちらの日時は参考として別に出る）
export function officialMatch(l, events) {
  const p = l.site?.position;
  const t = Date.parse(l.net);
  if (!p || Number.isNaN(t)) return null;
  return (
    (events ?? []).find((ev) => {
      if (ev.kind !== "launch" || statusOf(ev) !== "scheduled") return false;
      const q = ev.site?.position?.value;
      const span = eventSpan(ev);
      return q && span && distanceKm(p, q) < SAME_SITE_KM && t >= span.start - SAME_TIME_MS && t <= span.end + SAME_TIME_MS;
    }) ?? null
  );
}

// これからの世界の打ち上げ（予定の時刻を過ぎたばかりのものも少し残す）を早い順に。公式の予定と同じものは除く
export function worldLaunches(data, events, now, realNow = now) {
  if (dataState(data, realNow) !== "ok") return [];
  const t = now.getTime();
  return data.launches
    .map((l) => ({ l, span: launchSpan(l) }))
    .filter(({ l, span }) => span && span.end > t && !officialMatch(l, events))
    .sort((a, b) => a.span.start - b.span.start || a.l.id.localeCompare(b.l.id))
    .map(({ l }) => l);
}

// 地球のピン：近い射場（60km以内。ケネディとケープカナベラルなど）は1本にまとめる
export function siteClusters(launches) {
  const clusters = [];
  for (const l of launches) {
    const p = l.site?.position;
    if (!p) continue;
    const c = clusters.find((c) => distanceKm(c.position, p) < SAME_SITE_KM);
    if (c) c.launches.push(l);
    else clusters.push({ position: p, launches: [l] });
  }
  return clusters;
}

// ---------- 「参考」の印 ----------
// tip：ホバー・フォーカスで出す説明（読み上げは aria-describedby で別に入れるので、ここは読ませない）
export const refMarkHtml = ({ tip = true } = {}) =>
  `<span class="ref-mark">参考${tip ? `<span class="ref-tip" aria-hidden="true">${esc(REF_NOTE)}</span>` : ""}</span>`;

// ---------- 一覧（「予定」タブの下の段） ----------
// noteId：説明の文を持つ要素の id（各行の aria-describedby に使う）
export function launchesListHtml(list, now, { state = "ok", fetchedAt = null, noteId = "ref-note" } = {}) {
  if (state === "missing") return `<p class="k small">世界の打ち上げ予定を読み込めませんでした。</p>`;
  if (state === "stale")
    return `<p class="k small">世界の打ち上げ予定のデータが古くなっているので、いまは出していません${fetchedAt ? `（最後の取得：${esc(jstShort(fetchedAt))}）` : ""}。</p>`;
  if (!list.length) return `<p class="k small">いま載せている世界の打ち上げはありません。</p>`;
  const rows = list.map((l) => {
    const [d1, d2] = launchWhenShort(l, now);
    const left = launchCountdownText(l, now, { approx: false });
    return `<li><button type="button" class="event-item is-ref" data-launch="${esc(l.id)}" aria-describedby="${esc(noteId)}">
      <span class="event-when mono"><span>${esc(d1)}</span><span>${esc(d2)}</span>${refMarkHtml()}</span>
      <span class="event-main">
        <span class="event-title ref-line"><span class="t">${esc(missionName(l))}</span></span>
        <span class="event-sub ref-line"><span class="t">${esc(placeShort(l))}</span></span>
        <span class="event-sub ref-line"><span class="t">${esc(l.rocket.name)}</span>${left ? `<span class="event-left mono">${esc(left)}</span>` : ""}</span>
      </span>
      <span class="chev" aria-hidden="true">›</span>
    </button></li>`;
  });
  return `<ul class="event-list">${rows.join("")}</ul>`;
}

// ---------- 詳細パネル ----------
const row = (icon, label, body) =>
  body
    ? `<div class="plate-row"><span class="icon" aria-hidden="true">${icon}</span><span class="label">${label}</span><div class="body">${body}</div></div>`
    : "";

export function launchPanelHtml(l, now, { fetchedAt = null } = {}) {
  const big = bigLaunchCountdown(l, now);
  const span = launchSpan(l);
  const passed = span?.timed && span.start <= now.getTime();
  const left = launchCountdownText(l, now);
  const countdown = big
    ? `<div class="event-countdown ref-box"><span class="k">打ち上げまで（参考）</span><span class="mono" data-live="countdown">${esc(big)}</span></div>`
    : passed
      ? `<div class="event-countdown ref-box"><span class="k">予定の時刻を過ぎました</span><span class="small">結果は、公式の発表で確かめてください</span></div>`
      : left
        ? `<div class="event-countdown ref-box"><span class="k">その日まで（参考）</span><span class="mono">${esc(left)}</span></div>`
        : "";
  const what = [l.mission?.type_ja ?? l.mission?.type, l.mission?.orbit_ja ? `行き先：${l.mission.orbit_ja}` : l.mission?.orbit ? `行き先：${l.mission.orbit}` : null]
    .filter(Boolean)
    .join("・");
  const updated = l.updated ? `The Space Devs の更新：${jstShort(l.updated)}` : "";
  return `
    <header class="panel-head">
      <div>
        <div class="panel-title"><span class="class-chip ref-chip">打ち上げ・参考</span><span class="amber">${esc(missionName(l))}</span></div>
        <div class="panel-ja"><span class="panel-en">${esc(l.rocket.full_name ?? l.rocket.name)}</span>　<span class="k nw">${esc(countryName(l))}</span></div>
      </div>
      <div class="panel-actions">
        <button type="button" class="close mono" data-close aria-label="詳細を閉じる">×</button>
      </div>
    </header>
    <div class="ov">
      <p class="ref-note">${refMarkHtml({ tip: false })}<span>${esc(REF_NOTE)}</span></p>
      ${countdown}
      <div class="plate-rows event-rows">
        ${row("◷", "日時", `${esc(launchWhenText(l))}${PRECISION_NOTES[l.precision] ? `<div class="k small">${esc(PRECISION_NOTES[l.precision])}</div>` : ""}${windowEndText(l) ? `<div class="k small">打ち上げられる時間：${esc(windowEndText(l))}</div>` : ""}`)}
        ${row("▲", "ロケット", esc(l.rocket.full_name ?? l.rocket.name))}
        ${row("◆", "担当", providerName(l) && `${esc(providerName(l))}${l.provider?.ja ? `<div class="k small">${esc(l.provider.name)}</div>` : ""}`)}
        ${row("✦", "任務", what && esc(what))}
        ${row("⌖", "射場", `${esc(placeName(l))}${countryName(l) ? `（${esc(countryName(l))}）` : ""}${l.site.pad ? `<div class="k small">${esc(l.site.pad)}</div>` : ""}`)}
        ${row("◇", "状態", `${esc(l.status_label)}<span class="k">（The Space Devs の区分：${esc(l.status_ja)}）</span>`)}
      </div>
      <h3 class="event-h">出典</h3>
      <ul class="link-list"><li><a href="${esc(SOURCE_URL)}" target="_blank" rel="noopener noreferrer">${esc(SOURCE_LABEL)}</a> <span class="k">（${[fetchedAt ? `取得：${esc(jstShort(fetchedAt))}` : "", esc(updated)].filter(Boolean).join("・")}）</span></li></ul>
    </div>
    <p class="panel-foot">The Space Devs は、世界の打ち上げ予定をまとめている有志の団体で、宇宙機関・ロケット会社とは関係ありません。日時が変わっていることがあるので、正確な情報は${providerName(l) ? `${esc(providerName(l))}などの` : ""}公式サイトで確かめてください。<br>※非公式ファンメイド作品です。宇宙機関・運用者とは関係ありません。</p>`;
}
