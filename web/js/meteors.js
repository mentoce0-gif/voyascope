// 流星群：県を選ぶと、今夜の放射点の方角・高さと、月明かりを出す（ブラウザで計算）
// 極大の日時と放射点（赤経・赤緯）は curation/events の kind: "meteor"（出典つき）。天気は考えない
import { gstime, eciToEcf, ecfToLookAngles } from "../vendor/satellite.min.js";
import { sunEci, dir8, SUN_BELOW } from "./passes.js";
import { eventSpan, whenText } from "./events.js";
import { esc, obsRadar } from "./format.js";

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

// 出す期間：出現期間（active。日本時間の日付）のはじめ（なければ極大・見ごろの前の日）から、極大・見ごろの次の日の終わり（予定の一覧から消えるとき）まで。
// 出現期間がそれより早く終わるなら、そこまで（2026-10-25 オーナー：極大が過ぎた流星群は出し続けない）
const JST = 9 * HOUR;
const jstDayStart = (ymd) => Date.parse(`${ymd}T00:00:00Z`) - JST;
export function meteorWindow(ev) {
  const a = ev.active?.value;
  const span = eventSpan(ev);
  if (!span) return a ? { start: jstDayStart(a.from), end: jstDayStart(a.to) + 24 * HOUR } : null;
  if (!a) return { start: span.start - 24 * HOUR, end: span.end };
  return { start: jstDayStart(a.from), end: Math.min(jstDayStart(a.to) + 24 * HOUR, span.end) };
}
export function activeMeteors(events, now) {
  const t = now.getTime();
  return (events ?? []).filter((ev) => {
    const w = ev.kind === "meteor" && ev.radiant?.value && meteorWindow(ev);
    return w && ev.status?.value !== "cancelled" && t >= w.start && t < w.end;
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

// 出典のホストの呼び名（なければホスト名）
const HOST_LABEL = { "ta3.sk": "IAU 流星データセンター" };
const host = (url) => new URL(url).hostname.replace(/^www\./, "");
const credit = (url) => `<span class="k">出典：<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(HOST_LABEL[host(url)] ?? host(url))}</a></span>`;

export function meteorHtml(ev, observer, prefName, now) {
  const name = ev.title.ja;
  const head = `<div class="card-head"><h3 class="meteor-title">${esc(name)}</h3></div>
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
    ${obsRadar(radiantChart(night), "meteor", name)}
    <p class="k small">放射点の位置の${credit(ev.radiant.source).replace('<span class="k">', "<span>")}</p>
    <p class="small">${moonText}</p>
    ${ev.parent?.orbit?.value || ev.constellation ? `<button type="button" class="btn mono meteor-story-btn" data-meteor-story="${esc(ev.id)}">しくみの図を見る</button>` : ""}
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
const START = 3; // 粒が現れる距離（地球の半径の何倍か）
const SPEED = 1.8; // 粒が近づく速さ（地球の半径／秒。イメージ）
const TAIL = 0.45; // 光の筋の長さ（地球の半径の何倍か）
const SPREAD = 3.2; // ちりの流れの広さ（半径。地球の半径の何倍か）。地球より広く、多くはそばを通り過ぎる
const toLatLngAlt = (p) => {
  const r = Math.hypot(p.x, p.y, p.z);
  return { lat: Math.asin(p.z / r) * DEG, lng: Math.atan2(p.y, p.x) * DEG, alt: r - 1 };
};

// 粒の群れ。step(dt, u) で動かして、いまの粒（尾つき・瞬き）と、大気に飛び込んだ光（流れ星）を返す
// - 粒：一瞬「シュッ」と光って、来た向き（放射点の側）へ尾を引きながら消える光の筋。粒ごとにずらしてくり返す
// - 流れ星：大気の高さ（約100km）で光り、進む向きに短い筋をのばしながら、0.9秒ほどで消える
const FLASH_SEC = 0.9;
export function createStream(n = 140, random = Math.random) {
  let T = 0;
  const spawn = (p, s = START + random() * START) => {
    const r = SPREAD * Math.sqrt(random()); // 1.0 より内側（およそ10個に1個）は地球に当たる
    p.a = random() * 2 * Math.PI;
    p.r = r;
    p.s = s;
    p.flash = 0;
    p.born = T;
    p.phase = random() * 2 * Math.PI;
    p.rate = 0.35 + random() * 0.45; // 1秒に何回「シュッ」と光るか
    p.bright = 0.5 + random() * 0.5;
    return p;
  };
  const parts = Array.from({ length: n }, () => spawn({}));
  return {
    step(dt, u) {
      T += dt;
      // u に直交する2つの向き
      const ref = Math.abs(u.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
      const e1 = norm(cross(u, ref));
      const e2 = cross(u, e1);
      const points = [];
      const flashes = [];
      for (const p of parts) {
        const ox = p.r * Math.cos(p.a);
        const oy = p.r * Math.sin(p.a);
        if (p.flash > 0) {
          p.flash -= dt;
          if (p.flash <= 0) spawn(p);
          else {
            const s = Math.sqrt(Math.max(ENTRY * ENTRY - p.r * p.r, 0));
            const head = toLatLngAlt(at(e1, e2, u, ox, oy, s));
            // 光の筋：大気に入ったところから、進む向き（放射点と反対）へ少し
            const len = 0.012 + 0.025 * (1 - p.flash / FLASH_SEC);
            const end = toLatLngAlt(at(e1, e2, u, ox, oy, s - len));
            flashes.push({ ...head, end, life: p.flash / FLASH_SEC, bright: p.bright });
          }
          continue;
        }
        p.s -= dt * SPEED;
        const hit = p.r < ENTRY && p.s <= Math.sqrt(ENTRY * ENTRY - p.r * p.r);
        if (hit) {
          p.flash = FLASH_SEC;
          continue;
        }
        if (p.s < -START) {
          spawn(p, START);
          continue;
        }
        const fadeIn = Math.min(1, (T - p.born) / 0.4);
        // 光り方：一瞬で明るくなり、尾を引きながらすぐ消える。これを粒ごとにずらしてくり返す
        const cyc = (T * p.rate + p.phase / (2 * Math.PI)) % 1;
        const glow = fadeIn * p.bright * (cyc < 0.06 ? cyc / 0.06 : Math.exp(-(cyc - 0.06) * 9));
        // 地球の向こう側に隠れる粒も、そのまま（描くときに地球の陰を見る）
        points.push({ ...toLatLngAlt(at(e1, e2, u, ox, oy, p.s)), tail: toLatLngAlt(at(e1, e2, u, ox, oy, p.s + TAIL)), glow });
      }
      return { points, flashes };
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


// ---------- しくみの図（平面）：母天体の通り道のそばを地球が通る → 放射点のある星座の方向から降ってくる ----------
const AU_DEG = Math.PI / 180;

// 彗星の軌道の上の点（太陽中心・黄道座標、au）。ν は真近点角（度）
export function orbitPoint(o, nuDeg) {
  const nu = nuDeg * AU_DEG;
  const r = (o.q * (1 + o.e)) / (1 + o.e * Math.cos(nu));
  const u = o.w * AU_DEG + nu;
  const om = o.om * AU_DEG;
  const inc = o.i * AU_DEG;
  return {
    x: r * (Math.cos(om) * Math.cos(u) - Math.sin(om) * Math.sin(u) * Math.cos(inc)),
    y: r * (Math.sin(om) * Math.cos(u) + Math.cos(om) * Math.sin(u) * Math.cos(inc)),
    z: r * Math.sin(u) * Math.sin(inc),
  };
}
// 地球の位置（太陽中心・黄道座標、au）。太陽の見かけの位置の簡易式の反対側
export function earthPoint(date) {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const L = 280.46 + 0.9856474 * n;
  const g = (357.528 + 0.9856003 * n) * AU_DEG;
  const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g) + 180) * AU_DEG;
  const r = 1.00014 - 0.01671 * Math.cos(g);
  return { x: r * Math.cos(lam), y: r * Math.sin(lam), z: 0 };
}
// 極大・見ごろの日（日本時間の正午）。図の「地球がちりのそばを通る日」に使う
export function peakDate(ev, fallback) {
  const v = ev.when?.value;
  if (v?.at) return new Date(v.at);
  const ymd = v?.date ?? v?.from;
  return ymd ? new Date(`${ymd}T03:00:00Z`) : fallback;
}
// 極大の日の地球に、いちばん近い彗星の通り道の上の点（りゅう座流星群は黄道を横切る点のそば、オリオン座流星群は黄道の北）
export function nearestOrbitPoint(o, earth) {
  let best = null;
  for (let nu = -179.5; nu < 180; nu += 0.5) {
    const p = orbitPoint(o, nu);
    const d = Math.hypot(p.x - earth.x, p.y - earth.y, p.z - earth.z);
    if (!best || d < best.d) best = { p, d };
  }
  return best;
}
// 遠日点の距離のことば（いちばん遠いとき、どの惑星の軌道のあたりか）
const farText = (ad) => (ad < 7 ? "木星の軌道のあたり" : ad < 12 ? "土星の軌道のあたり" : ad < 24 ? "天王星の軌道のあたり" : ad < 32 ? "海王星の軌道のあたり" : "海王星の軌道より外");

const src = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label ?? HOST_LABEL[host(url)] ?? host(url))}</a>`;

// 太陽を北（黄道の北極）から見た図。地球の軌道のまわり（約1.8 au まで）を拡大する
export function orbitSvg(ev, date) {
  const o = ev.parent.orbit.value;
  const S = 40; // 1 au の長さ（px）
  const CX = 130;
  const C = 115;
  const P = (p) => [(CX + p.x * S).toFixed(1), (C - p.y * S).toFixed(1)];
  const R = 2.8;
  // 彗星の通り道：近日点のまわりだけ（遠いところは図の外）。黄道より南を通るところは点線
  const north = [];
  const south = [];
  let cur = null;
  for (let nu = -150; nu <= 150; nu += 2) {
    const p = orbitPoint(o, nu);
    if (Math.hypot(p.x, p.y) > R) {
      cur = null;
      continue;
    }
    const list = p.z >= 0 ? north : south;
    if (!cur || cur.list !== list) {
      cur = { list, pts: [] };
      list.push(cur.pts);
    }
    cur.pts.push(P(p).join(" "));
  }
  const pathOf = (segs) => segs.map((pts) => `M${pts.join("L")}`).join("");
  // 極大の日の地球にいちばん近い通り道の点（○）
  const peak = peakDate(ev, date);
  const near = nearestOrbitPoint(o, earthPoint(peak)).p;
  const earth = earthPoint(date);
  const [ex, ey] = P(earth);
  const [nx, ny] = P(near);
  const [qx, qy] = P(orbitPoint(o, 0));
  // 地球の進む向き（反時計回り）
  const ang = Math.atan2(earth.y, earth.x) + Math.PI / 2;
  const ax = (Number(ex) + 18 * Math.cos(ang)).toFixed(1);
  const ay = (Number(ey) - 18 * Math.sin(ang)).toFixed(1);
  return `<svg class="story-svg" viewBox="0 0 260 230" role="img" aria-label="太陽を北から見た図：地球の通り道と、彗星の通り道（ちりの帯）が近づくところを、地球が${peak.getMonth() + 1}月${peak.getDate()}日ごろに通る">
    <defs><marker id="st-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#5ef2c2"/></marker></defs>
    <path d="${pathOf(north)}" class="story-dust"/>
    <path d="${pathOf(south)}" class="story-dust south"/>
    <path d="${pathOf(north)}" class="story-comet"/>
    <path d="${pathOf(south)}" class="story-comet south"/>
    <circle cx="${CX}" cy="${C}" r="${S}" class="story-earth-orbit"/>
    <text x="${CX}" y="${C - S - 4}" class="story-label small">地球の通り道</text>
    <circle cx="${CX}" cy="${C}" r="5" class="story-sun"/><text x="${CX}" y="${C + 15}" class="story-label">太陽</text>
    <circle cx="${qx}" cy="${qy}" r="1.8" class="story-q"/>
    <circle cx="${nx}" cy="${ny}" r="9" class="story-cross"/>
    <path d="M${ex} ${ey}L${ax} ${ay}" class="story-earth-dir" marker-end="url(#st-arrow)"/>
    <circle cx="${ex}" cy="${ey}" r="4.5" class="story-earth"/>
    <text x="${Number(ex) - 8}" y="${Number(ey) - 12}" class="story-label earth">地球（${date.getMonth() + 1}/${date.getDate()}）</text>
    <text x="${Number(ex) + 4}" y="${Number(ey) + 40}" class="story-label comet">彗星の通り道</text>
  </svg>`;
}

// 星の名前を、重ならないように点の左上・右下などに置く（流星群ごと、星の番号）。hide は名前を出さない（点が近すぎる）
const LABELS = {
  "draconids-2026": { center: { ra: 250, dec: 60 }, left: [1], up: [2, 3, 4, 5], down: [0, 1] }, // ラスタバン・エルタニンは放射点の下に寄せる
  "orionids-2026": { left: [0, 3], up: [0, 1, 2], hide: [5] },
};
// 放射点のある星座のあたりの星の図（空を見上げた向き：上が北、左が東）
export function constellationSvg(ev) {
  const stars = ev.constellation.stars.value;
  const rad = ev.radiant.value;
  const lb = LABELS[ev.id] ?? {};
  const LABEL_LEFT = new Set(lb.left);
  const LABEL_UP = new Set(lb.up);
  const LABEL_DOWN_EXTRA = new Set(lb.down);
  const HIDE = new Set(lb.hide);
  // 図の中心：決めていなければ、星と放射点の範囲のまんなか
  const all = [...stars, rad];
  const mid = (k) => (Math.min(...all.map((s) => s[k])) + Math.max(...all.map((s) => s[k]))) / 2;
  const cc = lb.center ?? { ra: mid("ra"), dec: mid("dec") };
  const c0 = { ra: cc.ra * AU_DEG, dec: cc.dec * AU_DEG };
  // 1 ラジアンの長さ（px）。決めた中心がなければ、図（名前の分の余白を残す）に収まるように縮める
  const span = (k) => (Math.max(...all.map((s) => s[k])) - Math.min(...all.map((s) => s[k]))) * AU_DEG;
  const SCALE = lb.center ? 330 : Math.min(330, 140 / span("dec"), 200 / (span("ra") * Math.cos(c0.dec)));
  const CY = lb.center ? 110 : 95;
  const proj = ({ ra, dec }) => {
    const a = ra * AU_DEG;
    const d = dec * AU_DEG;
    const cosc = Math.sin(c0.dec) * Math.sin(d) + Math.cos(c0.dec) * Math.cos(d) * Math.cos(a - c0.ra);
    const x = (Math.cos(d) * Math.sin(a - c0.ra)) / cosc;
    const y = (Math.cos(c0.dec) * Math.sin(d) - Math.sin(c0.dec) * Math.cos(d) * Math.cos(a - c0.ra)) / cosc;
    return [(150 - x * SCALE).toFixed(1), (CY - y * SCALE).toFixed(1)]; // 東が左
  };
  const pts = stars.map(proj);
  const lines = (ev.constellation.lines ?? []).map(([i, j]) => `<path d="M${pts[i].join(" ")}L${pts[j].join(" ")}" class="story-line"/>`).join("");
  const dots = stars
    .map((s, i) => {
      const r = Math.max(1.4, 4.4 - s.mag).toFixed(1);
      const dot = `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="${r}" class="story-star"/>`;
      if (HIDE.has(i)) return dot;
      return `${dot}<text x="${(Number(pts[i][0]) + (LABEL_LEFT.has(i) ? -5 : 5)).toFixed(1)}" y="${(Number(pts[i][1]) + (LABEL_UP.has(i) ? -5 : LABEL_DOWN_EXTRA.has(i) ? 16 : 11)).toFixed(1)}" class="story-label small star${LABEL_LEFT.has(i) ? " left" : ""}">${esc(s.name)}</text>`;
    })
    .join("");
  const [rx, ry] = proj(rad);
  const rays = [0, 45, 90, 135, 180, 225, 270, 315]
    .map((d) => {
      const a = d * AU_DEG;
      return `<path d="M${(Number(rx) + 9 * Math.cos(a)).toFixed(1)} ${(Number(ry) + 9 * Math.sin(a)).toFixed(1)}L${(Number(rx) + 22 * Math.cos(a)).toFixed(1)} ${(Number(ry) + 22 * Math.sin(a)).toFixed(1)}" class="story-ray"/>`;
    })
    .join("");
  return `<svg class="story-svg" viewBox="0 0 300 185" role="img" aria-label="${esc(ev.constellation.name)}のあたりの星と放射点">
    ${rays}${lines}${dots}
    <circle cx="${rx}" cy="${ry}" r="5" class="story-radiant"/>
    <text x="${(Number(rx) + 14).toFixed(1)}" y="${(Number(ry) - 12).toFixed(1)}" class="story-label radiant left-start">放射点</text>
    <text x="${lb.center ? 150 : 270}" y="14" class="story-label small">北 ↑</text><text x="14" y="113" class="story-label small">← 東</text>
  </svg>`;
}

// 詳細の欄に足す「しくみ」：2つの図と、つなぐ説明（出典つき）
export function meteorStoryHtml(ev, date) {
  const o = ev.parent?.orbit;
  const k = ev.constellation;
  if (!o?.value && !k?.stars?.value) return "";
  const moid = ev.parent?.moid?.value;
  const peak = peakDate(ev, date);
  return `<section class="meteor-story">
    <h3 class="event-h">しくみ：どうして${esc(k?.name ?? "その星座")}から降ってくるの？</h3>
    ${
      o?.value
        ? `<figure class="story-fig">${orbitSvg(ev, date)}
      <figcaption>① 太陽を北から見た図。<span class="story-key comet">─</span> ${esc(ev.parent.name.value.replace(/（.*）/, ""))}の通り道と、そのまわりのちり（<span class="story-key dust">■</span>イメージ）。点線は黄道（地球の通り道の面）より南。<br>
      ○のところで、地球が${peak.getMonth() + 1}月${peak.getDate()}日ごろに通り道のそばを通ります。${moid ? `いちばん近いところの距離は約${(moid * 149.6).toFixed(1)}百万km（${moid} au）。` : ""}<br>
      <span class="k">軌道：${src(o.source, "NASA JPL 小天体データベース")}（${esc(o.note ?? "")}）。${((ad) => `彗星は、太陽からいちばん遠いとき約${ad.toFixed(1)} au（${farText(ad)}）まで離れます。`)((o.value.q * (1 + o.value.e)) / (1 - o.value.e))}ちりの帯の太さ・濃さはイメージ。</span></figcaption></figure>`
        : ""
    }
    ${
      k?.stars?.value
        ? `<figure class="story-fig">${constellationSvg(ev)}
      <figcaption>② 地上から見ると、ちりはほぼ平行に飛び込んでくるので、空の一点（放射点）から流れ出すように見えます。その点が${esc(k.name)}にあります。<br>
      <span class="k">星の位置：${src(k.stars.source, "IAU 星名一覧")}（J2000）。線は${esc(k.name)}の形の一部（イメージ）。放射点：${src(ev.radiant.source)}。</span></figcaption></figure>`
        : ""
    }
    <p class="small">ちりは彗星の通り道に沿って広がっていて、地球がそこを横切ると、まとめて大気に飛び込みます。${esc(k?.name ?? "星座")}は「ちりが来る向き」で、彗星がいまそこにあるわけではありません。<span class="k">（説明：${src("https://www.nao.ac.jp/astro/basic/meteor-shower.html", "国立天文台 流星群とは")}）</span></p>
  </section>`;
}
