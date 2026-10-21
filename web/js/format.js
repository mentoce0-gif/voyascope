// 表示用の整形

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function dateJa(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// "1998-11-20" のような日付だけの文字列は、時差でずれないようにそのまま読む
export function plainDateJa(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日` : esc(s);
}

const pad = (n) => String(n).padStart(2, "0");

// 日本時間なら「JST」、それ以外は「UTC+x」
function tzLabel(d) {
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  return tz === 540 ? "JST" : `UTC${sign}${Math.floor(Math.abs(tz) / 60)}${tz % 60 ? ":" + pad(Math.abs(tz) % 60) : ""}`;
}

export function dateTimeJa(d) {
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} (${tzLabel(d)})`;
}

// スマホの上のバー用：「10/01 12:07:36 JST」（年を省く）
export function dateTimeCompactJa(d) {
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${tzLabel(d)}`;
}

// 「9月29日 15:17」のような短い表示（閲覧者の時刻で）
export function dateTimeShortJa(d) {
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${pad(d.getMinutes())}`;
}

export function durationJa(ms) {
  const sign = ms < 0 ? "−" : "+";
  let s = Math.floor(Math.abs(ms) / 1000);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return `${sign}${d ? d + "日 " : ""}${pad(h)}:${pad(m)}:${pad(s)}`;
}

export const latStr = (v) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? "N" : "S"}`;
export const lngStr = (v) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? "E" : "W"}`;
export const latJa = (v) => `${v >= 0 ? "北緯" : "南緯"} ${Math.abs(v).toFixed(1)}°`;
export const lngJa = (v) => `${v >= 0 ? "東経" : "西経"} ${Math.abs(v).toFixed(1)}°`;

export function numberJa(v) {
  return typeof v === "number" ? v.toLocaleString("ja-JP") : esc(v);
}

// 空を見る（/sky/・試験版）への入口。今夜の ISS の通過・流星群のカードの右上に置く（2026-10-21 オーナー）
export const obsButton = (subject, label) =>
  `<a class="obs-btn" href="sky/?s=${subject}" aria-label="${label}を空で探す（SKY OBSERVER・試験版）" title="スマホをかざして探す（試験版）"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg><span class="mono">OBS</span><small>試験版</small></a>`;
// レーダー（空の図）の右下に置く丸いボタン
export const obsRadar = (chart, subject, label) =>
  `<div class="radar-wrap">${chart}<a class="obs-round" href="sky/?s=${subject}" aria-label="${label}を空で探す（SKY OBSERVER・試験版）" title="スマホをかざして探す（試験版）"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg><span class="mono">OBS</span></a></div>`;
