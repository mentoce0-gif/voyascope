// 予定（次の出来事・これから行く）：日時の扱いと、一覧・詳細の表示
// データは web/data/events.json（scripts/sync-web-data.mjs が curation/events から作る）。日付は公式の発表どおり
import { esc } from "./format.js";

const DAY = 86400000;
const JST = 9 * 3600000; // 予定は日本時間で出す（画面にも「日本時間」と書く）
// 時刻まで決まっている予定は、その時刻を過ぎてもしばらく一覧に残す（結果は公式で確かめてもらう）
export const GRACE_MS = 6 * 3600000;

export const KIND_LABELS = { launch: "打ち上げ", arrival: "到着", separation: "分離", flyby: "接近", milestone: "節目" };
const REGION_LABELS = { japan: "日本", world: "世界" };
const WEEKDAYS = "日月火水木金土";

// ---------- 日付 ----------
const pad = (n) => String(n).padStart(2, "0");
const ymdAt = (t) => new Date(t).toISOString().slice(0, 10);
// 日本時間の日付 "YYYY-MM-DD"
export const jstDay = (d) => ymdAt(d.getTime() + JST);
// 日本時間の「時:分」
export function hmJst(d) {
  const j = new Date(d.getTime() + JST);
  return `${j.getUTCHours()}:${pad(j.getUTCMinutes())}`;
}
const dayStart = (ymd) => Date.parse(`${ymd}T00:00:00Z`) - JST; // 日本時間のその日の0時
const addDays = (ymd, n) => ymdAt(Date.parse(`${ymd}T00:00:00Z`) + n * DAY);
const nextMonth = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
};
const weekday = (ymd) => WEEKDAYS[new Date(`${ymd}T00:00:00Z`).getUTCDay()];
const md = (ymd) => `${Number(ymd.slice(5, 7))}月${Number(ymd.slice(8, 10))}日`;

// 予定の始まりと、一覧から消す時刻。
// 日付だけの発表は、発表した国との時差があるので、日本時間の翌日いっぱいまで残す
export function eventSpan(ev) {
  const v = ev?.when?.value ?? {};
  if (v.at) {
    const t = Date.parse(v.at);
    return Number.isNaN(t) ? null : { precision: "at", start: t, end: t + GRACE_MS };
  }
  if (v.date) return { precision: "date", start: dayStart(v.date), end: dayStart(addDays(v.date, 2)) };
  if (v.from && v.to) return { precision: "range", start: dayStart(v.from), end: dayStart(addDays(v.to, 2)) };
  if (v.month) return { precision: "month", start: dayStart(`${v.month}-01`), end: dayStart(addDays(`${nextMonth(v.month)}-01`, 1)) };
  return null;
}

export const statusOf = (ev) => ev?.status?.value ?? "scheduled";

// これからの予定（予定の時刻を過ぎたばかりのものも少し残す）を早い順に。
// 延期は、新しい日時が公式に出るまで「延期」として残す。終わった・中止は出さない
export function upcomingEvents(events, now) {
  const t = now.getTime();
  return (events ?? [])
    .map((ev) => ({ ev, span: eventSpan(ev) }))
    .filter(({ ev, span }) => {
      const st = statusOf(ev);
      if (!span || st === "done" || st === "cancelled") return false;
      return st === "postponed" || span.end > t;
    })
    .sort((a, b) => a.span.start - b.span.start || a.ev.id.localeCompare(b.ev.id))
    .map(({ ev }) => ev);
}

// 「10月20日（火）4:41」「11月21日（土）」「12月9日〜10日」「2027年12月」。
// 今年（日本時間）でなければ年を付ける。full は詳細用（年・秒・「日本時間」まで）
export function whenText(ev, now, { full = false } = {}) {
  const span = eventSpan(ev);
  if (!span) return "";
  const v = ev.when.value;
  const thisYear = jstDay(now).slice(0, 4);
  const y = (ymd) => (full || ymd.slice(0, 4) !== thisYear ? `${Number(ymd.slice(0, 4))}年` : "");
  if (span.precision === "at") {
    const j = new Date(span.start + JST);
    const day = ymdAt(span.start + JST);
    const time = full
      ? `${j.getUTCHours()}時${pad(j.getUTCMinutes())}分${pad(j.getUTCSeconds())}秒（日本時間）`
      : `${j.getUTCHours()}:${pad(j.getUTCMinutes())}`;
    return `${y(day)}${md(day)}（${weekday(day)}）${time}`;
  }
  if (span.precision === "date") return `${y(v.date)}${md(v.date)}（${weekday(v.date)}）`;
  if (span.precision === "range") {
    const sameMonth = v.from.slice(0, 7) === v.to.slice(0, 7);
    return `${y(v.from)}${md(v.from)}〜${sameMonth ? `${Number(v.to.slice(8, 10))}日` : `${y(v.to)}${md(v.to)}`}`;
  }
  return `${Number(v.month.slice(0, 4))}年${Number(v.month.slice(5, 7))}月`;
}

// 一覧の左の小さな日付（2行）。今年でなければ1行目に年を付ける
export function whenShort(ev, now) {
  const span = eventSpan(ev);
  if (!span) return ["", ""];
  const v = ev.when.value;
  const thisYear = jstDay(now).slice(0, 4);
  const md2 = (ymd) => `${ymd.slice(0, 4) === thisYear ? "" : `${ymd.slice(0, 4)}/`}${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;
  if (span.precision === "at") return [md2(ymdAt(span.start + JST)), hmJst(new Date(span.start))];
  if (span.precision === "date") return [md2(v.date), `（${weekday(v.date)}）`];
  if (span.precision === "range") return [`${md2(v.from)}〜`, `${Number(v.to.slice(5, 7))}/${Number(v.to.slice(8, 10))}`];
  return [v.month.slice(0, 4), `${Number(v.month.slice(5, 7))}月`];
}

// 残り時間のことば：「あと18日10時間」「あと3時間12分」「明日」。延期なら「延期」
export function countdownText(ev, now) {
  if (statusOf(ev) === "postponed") return "延期";
  const span = eventSpan(ev);
  if (!span) return "";
  if (span.precision === "at") {
    const ms = span.start - now.getTime();
    if (ms <= 0) return "予定の時刻を過ぎました";
    const { d, h, m } = countdownParts(ms);
    if (d > 0) return `あと${d}日${h}時間`;
    if (h > 0) return `あと${h}時間${m}分`;
    return m > 0 ? `あと${m}分` : "まもなく";
  }
  if (span.precision === "month") return "";
  const first = span.precision === "date" ? ev.when.value.date : ev.when.value.from;
  const n = Math.round((Date.parse(`${first}T00:00:00Z`) - Date.parse(`${jstDay(now)}T00:00:00Z`)) / DAY);
  if (n > 1) return `あと${n}日`;
  if (n === 1) return "明日";
  if (n === 0) return "今日";
  return span.precision === "range" && jstDay(now) <= ev.when.value.to ? "期間中" : "";
}

export function countdownParts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

// 詳細の大きな残り時間（時刻まで決まっている予定だけ。毎秒書き換える）
export function bigCountdown(ev, now) {
  const span = eventSpan(ev);
  if (!span || span.precision !== "at" || statusOf(ev) !== "scheduled") return null;
  const ms = span.start - now.getTime();
  if (ms <= 0) return null;
  const { d, h, m, s } = countdownParts(ms);
  return `${d}日 ${pad(h)}時間 ${pad(m)}分 ${pad(s)}秒`;
}

// 出典の機関名（URL から）
const PUBLISHERS = [
  ["jaxa.jp", "JAXA"],
  ["nasa.gov", "NASA"],
  ["esa.int", "ESA"],
  ["qzss.go.jp", "内閣府"],
  ["jma.go.jp", "気象庁"],
];
export function publisherOf(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return "";
  }
  const hit = PUBLISHERS.find(([d]) => host === d || host.endsWith(`.${d}`));
  return hit ? hit[1] : host.replace(/^www\./, "");
}

const regionsText = (ev) => (ev.regions ?? []).map((r) => REGION_LABELS[r] ?? r).join("・");

// ---------- 一覧（「予定」タブ） ----------
// tonight：今夜の ISS の通過（計算）。{ day, time, title, sub }
export function eventsListHtml(events, now, { tonight = null } = {}) {
  const rows = [];
  if (tonight) {
    rows.push(`<li><button type="button" class="event-item event-tonight" data-go="tonight">
      <span class="event-when mono"><span>${esc(tonight.day)}</span><span>${esc(tonight.time)}</span></span>
      <span class="event-main"><span class="event-title">${esc(tonight.title)}</span><span class="event-sub">${esc(tonight.sub)}</span></span>
      <span class="chev" aria-hidden="true">›</span>
    </button></li>`);
  }
  for (const ev of events) {
    const [d1, d2] = whenShort(ev, now);
    const left = countdownText(ev, now);
    const postponed = statusOf(ev) === "postponed";
    rows.push(`<li><button type="button" class="event-item" data-event="${esc(ev.id)}">
      <span class="event-when mono"><span>${esc(d1)}</span><span>${esc(d2)}</span></span>
      <span class="event-main">
        <span class="event-title">${esc(ev.title.ja)}${postponed ? ` <span class="st-badge down">延期</span>` : ""}</span>
        <span class="event-sub">${esc(KIND_LABELS[ev.kind] ?? "")}・${esc(regionsText(ev))}${left && !postponed ? `<span class="event-left mono">${esc(left)}</span>` : ""}</span>
        <span class="event-src">出典：${esc(publisherOf(ev.when.source))}</span>
      </span>
      <span class="chev" aria-hidden="true">›</span>
    </button></li>`);
  }
  if (!rows.length) return `<p class="k small">いま載せている予定はありません。</p>`;
  return `<ul class="event-list">${rows.join("")}</ul>`;
}

// ---------- 上のバーの「次の出来事」 ----------
export function nextChipHtml(ev, now) {
  const [d1] = whenShort(ev, now);
  const left = countdownText(ev, now);
  return `<span class="next-k">次の出来事</span><span class="next-title">${esc(d1)} ${esc(ev.title.ja)}</span>${left ? `<span class="next-left mono">${esc(left)}</span>` : ""}`;
}

// ---------- 詳細パネル ----------
const row = (icon, label, body) =>
  body
    ? `<div class="plate-row"><span class="icon" aria-hidden="true">${icon}</span><span class="label">${label}</span><div class="body">${body}</div></div>`
    : "";

// 出典の一覧：URL ごとに、どの項目の出典かを添える。ラベルは links にあればそれを使う
function sourcesHtml(ev) {
  const items = [
    ["日時", ev.when],
    ["説明", ev.summary],
    ["予備期間", ev.window_end],
    ["ロケット", ev.vehicle],
    ["射場", ev.site?.name],
    ["位置", ev.site?.position],
    ["状態", ev.status],
  ];
  const byUrl = new Map();
  for (const [label, fact] of items) {
    if (!fact?.source) continue;
    if (!byUrl.has(fact.source)) byUrl.set(fact.source, []);
    byUrl.get(fact.source).push(label);
  }
  const labelOf = (url) => ev.links?.find((l) => l.url === url)?.label ?? publisherOf(url);
  return [...byUrl]
    .map(
      ([url, what]) =>
        `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(labelOf(url))}</a> <span class="k">（${esc(what.join("・"))}）</span></li>`,
    )
    .join("");
}

export function eventPanelHtml(ev, now) {
  const status = statusOf(ev);
  const kind = KIND_LABELS[ev.kind] ?? "予定";
  const chip = status === "postponed" ? `${kind}・延期` : `${kind}の予定`;
  const big = bigCountdown(ev, now);
  const left = countdownText(ev, now);
  const asOf = ev.when.as_of ? `${Number(ev.when.as_of.slice(5, 7))}月${Number(ev.when.as_of.slice(8, 10))}日` : "";
  const statusText =
    status === "postponed"
      ? `<strong class="amber">延期</strong><span class="k">　新しい日時は、公式の発表を待ちます</span>`
      : `公式の発表どおりの予定<span class="k">（${esc(asOf)}に確認）</span>`;
  const windowEnd = ev.window_end?.value
    ? `${Number(ev.window_end.value.slice(0, 4))}年${md(ev.window_end.value)}（${weekday(ev.window_end.value)}）まで`
    : null;
  const span = eventSpan(ev);
  const passed = status === "scheduled" && span?.precision === "at" && span.start <= now.getTime();
  const countdown = big
    ? `<div class="event-countdown"><span class="k">${ev.kind === "launch" ? "打ち上げまで" : "その時まで"}</span><span class="mono" data-live="countdown">${esc(big)}</span></div>`
    : passed
      ? `<div class="event-countdown"><span class="k">予定の時刻を過ぎました</span><span class="small">結果は、公式の発表で確かめてください</span></div>`
      : left && status !== "postponed"
        ? `<div class="event-countdown"><span class="k">その日まで</span><span class="mono">${esc(left)}</span></div>`
        : "";
  return `
    <header class="panel-head">
      <div>
        <div class="panel-title"><span class="class-chip" style="--c:#5ef2c2">${esc(chip)}</span><span class="amber">${esc(ev.title.ja)}</span></div>
        <div class="panel-ja"><span class="panel-en">${esc(ev.title.en)}</span>　<span class="k nw">${esc(regionsText(ev))}</span></div>
      </div>
      <div class="panel-actions">
        <button type="button" class="close mono" data-close aria-label="詳細を閉じる">×</button>
      </div>
    </header>
    <div class="ov">
      ${ev.summary?.value ? `<p class="ov-lead">${esc(ev.summary.value)}</p>` : ""}
      ${countdown}
      <div class="plate-rows event-rows">
        ${row("◷", "日時", `${esc(whenText(ev, now, { full: true }))}${ev.when.note ? `<div class="k small">${esc(ev.when.note)}</div>` : ""}`)}
        ${row("◇", "予備期間", windowEnd && `${esc(windowEnd)}${ev.window_end.note ? `<div class="k small">${esc(ev.window_end.note)}</div>` : ""}`)}
        ${row("▲", "ロケット", ev.vehicle?.value && esc(ev.vehicle.value))}
        ${row("⌖", "射場", ev.site?.name?.value && esc(ev.site.name.value))}
        ${row("◆", "状態", statusText)}
      </div>
      <h3 class="event-h">出典</h3>
      <ul class="link-list">${sourcesHtml(ev)}</ul>
      ${
        ev.links?.length
          ? `<h3 class="event-h">公式のページ</h3><ul class="link-list">${ev.links
              .map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a></li>`)
              .join("")}</ul>`
          : ""
      }
    </div>
    <p class="panel-foot">日付は公式の発表どおりです。遅れたら「延期」とだけ書きます。${
      ev.kind === "launch" ? "打ち上がるまで、軌道は描きません。" : ""
    }<br>※非公式ファンメイド作品です。宇宙機関・運用者とは関係ありません。</p>`;
}
