// 今夜・頭の上：県を選ぶと、ISS が見える通過の時刻・方角・空の図を出す
import { esc } from "./format.js";
import { dir8, heightWord } from "./passes.js";

const TZ = "Asia/Tokyo"; // 県単位の予報なので日本時間で出す
const STORAGE_KEY = "voyascope.prefecture";

const jst = (d, opts) => new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, ...opts }).format(d);
const jstParts = (d) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};

// 「今夜」「明日の明け方」「10月3日（土）の夕方」のような言い方
export function whenWord(date, now) {
  const a = jstParts(date);
  const today = jstParts(now).day;
  const tomorrow = jstParts(new Date(now.getTime() + 86400000)).day;
  const part =
    a.hour < 3 ? "の夜中" : a.hour < 7 ? "の明け方" : a.hour >= 17 && a.hour < 19 ? "の夕方" : a.hour >= 19 ? "の夜" : "";
  if (a.day === today) return a.hour >= 17 ? "今夜" : `今日${part}`;
  if (a.day === tomorrow) return `明日${part}`;
  return `${jst(date, { month: "long", day: "numeric", weekday: "short" })}${part}`;
}

export const clockWord = (d) => `${jst(d, { hour: "numeric", minute: "2-digit" }).replace(":", "時")}分ごろ`;

export function loadPrefecture() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}
export function savePrefecture(code) {
  try {
    if (code) localStorage.setItem(STORAGE_KEY, code);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 保存できなくても、この画面の間は使える
  }
}

// 空の図（上が北・右が東。地面に置いた方位磁石と同じ向き）。中心が頭の真上、外の円が地平線
function skyChart(pass) {
  const R = 70;
  const pt = ({ az, el }) => {
    const r = (R * (90 - el)) / 90;
    const a = (az * Math.PI) / 180;
    return [(100 + r * Math.sin(a)).toFixed(1), (100 - r * Math.cos(a)).toFixed(1)];
  };
  const path = pass.track.map((t, i) => `${i ? "L" : "M"}${pt(t).join(" ")}`).join("");
  const [sx, sy] = pt(pass.track[0]);
  const [ex, ey] = pt(pass.track.at(-1));
  return `<svg class="sky-chart" viewBox="0 0 200 200" role="img" aria-label="空の図：${dir8(pass.startAz)}から${dir8(pass.endAz)}へ">
    <defs><marker id="sky-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="sky-arrowhead"/></marker></defs>
    <circle cx="100" cy="100" r="${R}" class="sky-horizon"/>
    <circle cx="100" cy="100" r="${(R * 60) / 90}" class="sky-ring"/>
    <circle cx="100" cy="100" r="${(R * 30) / 90}" class="sky-ring"/>
    <path d="M100 ${100 - R}V${100 + R}M${100 - R} 100H${100 + R}" class="sky-ring"/>
    <text x="100" y="${100 - R - 8}" class="sky-dir">北</text>
    <text x="${100 + R + 12}" y="104" class="sky-dir">東</text>
    <text x="100" y="${100 + R + 16}" class="sky-dir">南</text>
    <text x="${100 - R - 12}" y="104" class="sky-dir">西</text>
    <text x="104" y="97" class="sky-zenith">頭の上</text>
    <path d="${path}" class="sky-path" marker-end="url(#sky-arrow)"/>
    <circle cx="${sx}" cy="${sy}" r="4" class="sky-start"/>
    <text x="${sx}" y="${Number(sy) - 8}" class="sky-label">ここから</text>
    <circle cx="${ex}" cy="${ey}" r="2" class="sky-end"/>
  </svg>`;
}

export function renderPrefSelect(select, prefectures, current) {
  select.innerHTML =
    `<option value="">県を選ぶ</option>` +
    prefectures.map((p) => `<option value="${p.code}"${p.code === current ? " selected" : ""}>${esc(p.name)}</option>`).join("");
}

export function renderTonight(el, { pref, passes, now, jumpable }) {
  if (!pref) {
    el.innerHTML = `<p class="k small">県を選ぶと、ISS が見える時刻と方角が出ます。位置情報は使いません（選んだ県はこのブラウザにだけ保存します）。</p>`;
    return;
  }
  if (!passes.length) {
    el.innerHTML = `<p class="small">この先5日間、${esc(pref.name)}から見やすい ISS の通過はありません。</p>${notes()}`;
    return;
  }
  const [p, ...rest] = passes;
  const minutes = Math.max(1, Math.round((p.end - p.start) / 60000));
  el.innerHTML = `
    <div class="pass-main">
      <div class="pass-when">${esc(whenWord(p.start, now))}　<span class="pass-time mono">${esc(clockWord(p.start))}</span></div>
      <div class="pass-dir"><strong>${dir8(p.startAz)}</strong>から<strong>${dir8(p.endAz)}</strong>へ　<span class="k">約${minutes}分</span></div>
      <div class="pass-height k">いちばん高いとき：${heightWord(p.maxEl)}（${dir8(p.maxAz)}の空、約${Math.round(p.maxEl)}°）</div>
      ${skyChart(p)}
      ${jumpable(p) ? `<button type="button" class="btn mono pass-jump" data-jump="0">この時刻の地球を見る</button>` : ""}
    </div>
    ${
      rest.length
        ? `<ul class="pass-more">${rest
            .map(
              (q, i) =>
                `<li><span>${esc(whenWord(q.start, now))} ${esc(clockWord(q.start))}</span><span class="k">${dir8(q.startAz)}→${dir8(q.endAz)}・${heightWord(q.maxEl).replace(/（.*）/, "")}</span>${
                  jumpable(q) ? `<button type="button" class="linklike small" data-jump="${i + 1}">見る</button>` : ""
                }</li>`,
            )
            .join("")}</ul>`
        : ""
    }
    ${notes()}`;
}

const notes = () => `<p class="tonight-note k small">
  ISS はとても明るく、街の中でも見えることがあります。ほかの人工衛星は、街の明かりの下ではほとんど見えません。<br>
  時刻と方角は、公開の軌道データから計算した県庁あたりでの目安です。数分ずれることがあり、天気（雲）は考えていません。</p>`;
