// 流星群：県を選ぶと、今夜の放射点の方角・高さと、月明かりを出す（ブラウザで計算）
// 極大の日時と放射点（赤経・赤緯）は curation/events の kind: "meteor"（出典つき）。天気は考えない
import { gstime, eciToEcf, ecfToLookAngles } from "../vendor/satellite.min.js";
import { sunEci, dir8, SUN_BELOW } from "./passes.js";
import { eventSpan, whenText } from "./events.js";
import { esc } from "./format.js";

const DEG = 180 / Math.PI;
const FAR_KM = 1e12; // 星のように遠い方向として扱う
const HOUR = 3600e3;

const lookAt = (observer, eci, date) => {
  const la = ecfToLookAngles(observer, eciToEcf(eci, gstime(date)));
  return { az: ((la.azimuth * DEG) % 360 + 360) % 360, el: la.elevation * DEG };
};
const fromRaDec = (ra, dec, r = FAR_KM) => ({
  x: r * Math.cos(dec / DEG) * Math.cos(ra / DEG),
  y: r * Math.cos(dec / DEG) * Math.sin(ra / DEG),
  z: r * Math.sin(dec / DEG),
});

// 放射点（赤経・赤緯、度）の、観測地から見た方角と高さ
export const radiantSky = (radiant, observer, date) => lookAt(observer, fromRaDec(radiant.ra, radiant.dec), date);

// 月の位置（地球中心、km）。簡易式（誤差 0.5° 程度。月明かりの目安には十分）
export function moonEci(date) {
  const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const L = 218.316 + 13.176396 * d;
  const M = 134.963 + 13.064993 * d;
  const F = 93.272 + 13.22935 * d;
  const lon = (L + 6.289 * Math.sin(M / DEG)) / DEG;
  const lat = (5.128 * Math.sin(F / DEG)) / DEG;
  const r = 385001 - 20905 * Math.cos(M / DEG);
  const eps = 23.439 / DEG;
  const x = r * Math.cos(lat) * Math.cos(lon);
  const y = r * Math.cos(lat) * Math.sin(lon);
  const z = r * Math.sin(lat);
  return { x, y: y * Math.cos(eps) - z * Math.sin(eps), z: y * Math.sin(eps) + z * Math.cos(eps) };
}
// 月の明るい部分の割合（0〜1）
export function moonLit(date) {
  const m = moonEci(date);
  const s = sunEci(date);
  const cos = (m.x * s.x + m.y * s.y + m.z * s.z) / Math.hypot(m.x, m.y, m.z) / Math.hypot(s.x, s.y, s.z);
  return (1 - cos) / 2;
}

// 選んだ時刻からの「今夜」（空が暗いあいだ）を10分ごとに見る。昼なら次の夜
export function meteorNight(radiant, observer, now) {
  const samples = [];
  let started = false;
  for (let t = now.getTime() - 2 * HOUR; t < now.getTime() + 30 * HOUR; t += 600e3) {
    const date = new Date(t);
    const dark = lookAt(observer, sunEci(date), date).el <= SUN_BELOW;
    if (!dark) {
      if (started) break;
      continue;
    }
    started = true;
    samples.push({ date, rad: radiantSky(radiant, observer, date), moon: lookAt(observer, moonEci(date), date) });
  }
  if (!samples.length) return null;
  const best = samples.reduce((a, b) => (b.rad.el > a.rad.el ? b : a));
  const mid = samples[Math.floor(samples.length / 2)].date;
  const moonUp = samples.filter((s) => s.moon.el > 0);
  return { samples, best, dark: { start: samples[0].date, end: samples.at(-1).date }, moonLit: moonLit(mid), moonUp };
}

// 今夜の表示に出す流星群：極大の前の日から、極大のあと（一覧から消えるまで）
export function activeMeteors(events, now) {
  const t = now.getTime();
  return (events ?? []).filter((ev) => {
    const span = ev.kind === "meteor" && ev.radiant?.value && eventSpan(ev);
    return span && ev.status?.value !== "cancelled" && t >= span.start - 24 * HOUR && t <= span.end;
  });
}

const TZ = "Asia/Tokyo";
const hourJa = (d) => `${new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(d).replace("時", "")}時`;
const hm = (d) => new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, hour: "numeric", minute: "2-digit", hourCycle: "h23" }).format(d);

// 空の図：放射点が1時間ごとにどこにあるか（上が北・右が東。中心が頭の真上、外の円が地平線）
function radiantChart(night) {
  const R = 70;
  const pt = ({ az, el }) => {
    const r = (R * (90 - Math.max(el, 0))) / 90;
    const a = (az * Math.PI) / 180;
    return [(100 + r * Math.sin(a)).toFixed(1), (100 - r * Math.cos(a)).toFixed(1)];
  };
  const up = night.samples.filter((s) => s.rad.el > 0);
  const hourly = up.filter((s) => new Date(s.date).getUTCMinutes() < 10);
  const path = up.map((s, i) => `${i ? "L" : "M"}${pt(s.rad).join(" ")}`).join("");
  const dots = hourly
    .map((s) => {
      const [x, y] = pt(s.rad);
      const h = Number(hourJa(s.date).replace("時", ""));
      const label = s.rad.el >= 10 && h % 3 === 0 ? `<text x="${(Number(x) + 6).toFixed(1)}" y="${(Number(y) + 3).toFixed(1)}" class="sky-label meteor-label">${hourJa(s.date)}</text>` : "";
      return `<circle cx="${x}" cy="${y}" r="2.6" class="meteor-dot"/>${label}`;
    })
    .join("");
  return `<svg class="sky-chart" viewBox="0 0 200 200" role="img" aria-label="空の図：放射点の動き">
    <circle cx="100" cy="100" r="${R}" class="sky-horizon"/>
    <circle cx="100" cy="100" r="${(R * 60) / 90}" class="sky-ring"/>
    <circle cx="100" cy="100" r="${(R * 30) / 90}" class="sky-ring"/>
    <path d="M100 ${100 - R}V${100 + R}M${100 - R} 100H${100 + R}" class="sky-ring"/>
    <text x="100" y="${100 - R - 8}" class="sky-dir">北</text>
    <text x="${100 + R + 12}" y="104" class="sky-dir">東</text>
    <text x="100" y="${100 + R + 16}" class="sky-dir">南</text>
    <text x="${100 - R - 12}" y="104" class="sky-dir">西</text>
    <text x="104" y="97" class="sky-zenith">頭の上</text>
    <path d="${path}" class="meteor-path"/>
    ${dots}
  </svg>`;
}

const moonWord = (lit) => (lit < 0.25 ? "細い（ほとんど邪魔にならない）" : lit < 0.6 ? "半分くらい" : "明るい（暗い流れ星は見えにくい）");

// 放射点が今夜どう動くかを、ことばで
function radiantWords({ samples, best }) {
  const first = samples[0];
  const parts = [];
  if (first.rad.el > 0) {
    parts.push(`暗くなる <strong>${hm(first.date)}</strong> ごろ、放射点は<strong>${dir8(first.rad.az)}</strong>の空（高さ約${Math.round(first.rad.el)}°）。`);
  } else {
    const rise = samples.find((s) => s.rad.el > 0);
    if (!rise) return "今夜の暗いあいだ、放射点は地平線の下にあります。";
    parts.push(`放射点は <strong>${hm(rise.date)}</strong> ごろ<strong>${dir8(rise.rad.az)}</strong>の空からのぼります。`);
  }
  if (best.date - first.date > 1800e3) {
    parts.push(`いちばん高いのは <strong>${hm(best.date)}</strong> ごろ（${dir8(best.rad.az)}の空、約${Math.round(best.rad.el)}°）。`);
  } else {
    const low = samples.find((s) => s.date > best.date && s.rad.el < 10);
    parts.push(low ? `そのあと低くなり、${hm(low.date)} ごろには高さ10°より下になります。` : "そのあと少しずつ低くなります。");
  }
  return parts.join("");
}

const credit = (url) => `<span class="k">出典：<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(new URL(url).hostname.replace(/^www\./, ""))}</a></span>`;

export function meteorHtml(ev, observer, prefName, now) {
  const name = ev.title.ja;
  const head = `<h3 class="meteor-title">${esc(name)}</h3>
    <p class="small">${esc(ev.when_label ?? "極大")}：${esc(whenText(ev, now, { full: true }))}${ev.when.note ? `<span class="k">（${esc(ev.when.note)}）</span>` : ""}　${credit(ev.when.source)}</p>
    ${ev.rate?.value ? `<p class="small">流れ星の数：${esc(ev.rate.value)}　${credit(ev.rate.source)}</p>` : ""}`;
  if (!observer) return `<section class="meteor">${head}<p class="k small">県を選ぶと、放射点がどの方角・高さにあるかが出ます。</p></section>`;
  const night = meteorNight(ev.radiant.value, observer, now);
  if (!night) return `<section class="meteor">${head}</section>`;
  const moonPct = Math.round(night.moonLit * 100);
  const moonText = night.moonUp.length
    ? `月は ${hm(night.moonUp[0].date)}〜${hm(night.moonUp.at(-1).date)} ごろ空にあります（明るい部分 約${moonPct}%：${moonWord(night.moonLit)}）`
    : `今夜の暗いあいだ、月は空にありません`;
  return `<section class="meteor">
    ${head}
    <p class="small">${esc(prefName)}から：${radiantWords(night)}</p>
    ${radiantChart(night)}
    <p class="k small">放射点の位置の${credit(ev.radiant.source).replace('<span class="k">', "<span>")}</p>
    <p class="small">${moonText}</p>
    <p class="tonight-note k small">流れ星は放射点のまわりだけでなく、空のどこにでも流れます。放射点が高いほど、たくさん見えます。<br>
    放射点と月の位置は、県庁あたりでの計算の目安です。天気（雲）と街の明かりは考えていません。</p>
  </section>`;
}

// ---------- 地球のまわり：流星群のちりが、放射点の方向から近づいてくる様子（イメージ） ----------
// ちりの粒は、放射点の方向から平行に地球へ向かってくる。放射点の側の半球の大気に飛び込んで、流れ星になる。
// 位置は地球に固定した座標（地球の半径＝1）。数と速さはイメージ（実際はずっと少なく、ずっと速い）

// 放射点の方向（地球に固定した座標の単位ベクトル）と、その方向が真上になる地点
export function radiantDirection(radiant, date) {
  const gmst = gstime(date) * DEG;
  const lat = radiant.dec;
  const lng = ((((radiant.ra - gmst) % 360) + 540) % 360) - 180;
  const u = {
    x: Math.cos(lat / DEG) * Math.cos(lng / DEG),
    y: Math.cos(lat / DEG) * Math.sin(lng / DEG),
    z: Math.sin(lat / DEG),
  };
  return { u, lat, lng };
}

const ENTRY = 1.016; // 大気に飛び込む高さ（約100km）
const START = 2.4; // 粒が現れる距離（地球の半径の何倍か）
const toLatLngAlt = (p) => {
  const r = Math.hypot(p.x, p.y, p.z);
  return { lat: Math.asin(p.z / r) * DEG, lng: Math.atan2(p.y, p.x) * DEG, alt: r - 1 };
};

// 粒の群れ。step(dt, u) で動かして、いまの粒と、大気に飛び込んだ光（流れ星）を返す
export function createStream(n = 140, random = Math.random) {
  const spawn = (p, s = START + random() * START) => {
    const r = 1.3 * Math.sqrt(random()); // 1.0 より内側は地球に当たる
    p.a = random() * 2 * Math.PI;
    p.r = r;
    p.s = s;
    p.flash = 0;
    return p;
  };
  const parts = Array.from({ length: n }, () => spawn({}));
  return {
    step(dt, u) {
      // u に直交する2つの向き
      const ref = Math.abs(u.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
      const e1 = norm(cross(u, ref));
      const e2 = cross(u, e1);
      const points = [];
      const trails = [];
      const flashes = [];
      for (const p of parts) {
        const ox = p.r * Math.cos(p.a);
        const oy = p.r * Math.sin(p.a);
        if (p.flash > 0) {
          p.flash -= dt;
          if (p.flash <= 0) spawn(p);
          else {
            const s = Math.sqrt(Math.max(ENTRY * ENTRY - p.r * p.r, 0));
            flashes.push(toLatLngAlt(at(e1, e2, u, ox, oy, s)));
          }
          continue;
        }
        p.s -= dt * 0.9;
        const hit = p.r < ENTRY && p.s <= Math.sqrt(ENTRY * ENTRY - p.r * p.r);
        if (hit) {
          p.flash = 0.6;
          continue;
        }
        if (p.s < -START) {
          spawn(p, START);
          continue;
        }
        // 地球の向こう側に隠れる粒も、そのまま（地球の陰になって見えない）。うしろに短い尾を付けて、進む向きを見せる
        points.push(toLatLngAlt(at(e1, e2, u, ox, oy, p.s)));
        for (const k of [0.05, 0.1]) trails.push(toLatLngAlt(at(e1, e2, u, ox, oy, p.s + k)));
      }
      return { points, trails, flashes };
    },
  };
}
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a) => {
  const l = Math.hypot(a.x, a.y, a.z);
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const at = (e1, e2, u, ox, oy, s) => ({
  x: ox * e1.x + oy * e2.x + s * u.x,
  y: ox * e1.y + oy * e2.y + s * u.y,
  z: ox * e1.z + oy * e2.z + s * u.z,
});
