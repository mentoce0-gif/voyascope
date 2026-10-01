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
