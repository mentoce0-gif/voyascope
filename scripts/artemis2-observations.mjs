// アルテミス2号：月のそばで「何が・いつ・見えたはずか」を、NASA の軌道データから計算する（Phase A の検証用。アプリには読み込まない）
//   入力：NASA「Artemis II Ephemeris」ZIP（May 1, 2026 版。中身は all-artemis-ii-oem-files.zip）の中の OEM（.asc）
//   https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/
//   地名の位置：USGS / IAU Gazetteer of Planetary Nomenclature（各 Feature ページで確認した値。docs/research/artemis2-lunar-observation-verification.md）
//
// 使い方：node scripts/artemis2-observations.mjs <OEM の .asc> > docs/research/artemis2-observations.json
//
// 計算のしかた（すべて地球中心・EME2000（J2000 の赤道座標）・km）
//   - オリオン：OEM の位置と速度で、3次エルミート補間
//   - 月・太陽：Astronomy Engine（web/vendor/astronomy.min.js）の GeoVector。太陽は光行差つき
//   - 月の向き：IAU WGCCRE 2009 の月の自転モデル（北極の赤経・赤緯と W。周期項 E1〜E13 つき）を、このファイルで計算
//     （Astronomy Engine 本体の RotationAxis と同じ式。照合は検証メモに記録）
//   - 月は半径 1737.4 km の球（地形の高さは入れない）
//   - 見える：地形の中心の法線と、オリオンへの向きの角度（出射角 e）が 90° 未満
//   - 照らされている：法線と太陽への向きの角度（入射角 i）が 90° 未満
//   - 大きさ：地形の直径（USGS）を、オリオンからの距離で割った見かけの角度（出射角による縮みも別に出す）
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const A = createRequire(import.meta.url)("../web/vendor/astronomy.min.js");
const AU = A.KM_PER_AU;
const R_M = 1737.4, R_E = 6378.137, R_S = 695700;
const DEG = Math.PI / 180;

const file = process.argv[2];
if (!file) {
  console.error("使い方：node scripts/artemis2-observations.mjs <OEM の .asc>");
  process.exit(1);
}
const text = readFileSync(file, "utf8");
const meta = Object.fromEntries([...text.matchAll(/^(\w+)\s*=\s*(.+)$/gm)].map((m) => [m[1], m[2].trim()]));
if (meta.REF_FRAME !== "EME2000" || meta.CENTER_NAME !== "EARTH" || meta.TIME_SYSTEM !== "UTC") throw new Error("想定と違う OEM です");
const rows = [...text.matchAll(/^(\d{4}-\d\d-\d\dT[\d:.]+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*$/gm)].map((m) => ({
  ms: Date.parse(`${m[1]}Z`),
  r: [Number(m[2]), Number(m[3]), Number(m[4])],
  v: [Number(m[5]), Number(m[6]), Number(m[7])],
}));
for (let i = 1; i < rows.length; i++) if (!(rows[i].ms > rows[i - 1].ms)) throw new Error("時刻が単調に増えていません");

// ---------- ベクトル ----------
const sub = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const mul = (a, k) => a.map((v) => v * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a);
const unit = (a) => mul(a, 1 / len(a));
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) / DEG;

// ---------- オリオン（エルミート補間） ----------
function orion(ms) {
  let i = 0, j = rows.length - 1;
  if (ms < rows[0].ms || ms > rows[j].ms) return null;
  while (j - i > 1) {
    const m = (i + j) >> 1;
    if (rows[m].ms <= ms) i = m;
    else j = m;
  }
  const a = rows[i], b = rows[j], h = (b.ms - a.ms) / 1000, u = (ms - a.ms) / (b.ms - a.ms || 1);
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
  return a.r.map((_, c) => h00 * a.r[c] + h10 * h * a.v[c] + h01 * b.r[c] + h11 * h * b.v[c]);
}
const geo = (body, ms) => {
  const v = A.GeoVector(body, A.MakeTime(new Date(ms)), body === A.Body.Sun);
  return [v.x * AU, v.y * AU, v.z * AU];
};

// ---------- 月の向き（IAU WGCCRE 2009） ----------
// d：J2000（TDB）からの日数。UTC→TT は 69.184 秒（2026年。うるう秒 37 + 32.184）
function moonAxes(ms) {
  const d = (ms + 69184) / 86400000 + 2440587.5 - 2451545.0, T = d / 36525;
  const E = [
    125.045 - 0.0529921 * d, 250.089 - 0.1059842 * d, 260.008 + 13.0120009 * d, 176.625 + 13.3407154 * d,
    357.529 + 0.9856003 * d, 311.589 + 26.4057084 * d, 134.963 + 13.064993 * d, 276.617 + 0.3287146 * d,
    34.226 + 1.7484877 * d, 15.134 - 0.1589763 * d, 119.743 + 0.0036096 * d, 239.961 + 0.1643573 * d, 25.053 + 12.9590088 * d,
  ].map((x) => x * DEG);
  const s = (k) => Math.sin(E[k - 1]), c = (k) => Math.cos(E[k - 1]);
  const ra = 269.9949 + 0.0031 * T - 3.8787 * s(1) - 0.1204 * s(2) + 0.07 * s(3) - 0.0172 * s(4) + 0.0072 * s(6) - 0.0052 * s(10) + 0.0043 * s(13);
  const dec = 66.5392 + 0.013 * T + 1.5419 * c(1) + 0.0239 * c(2) - 0.0278 * c(3) + 0.0068 * c(4) - 0.0029 * c(6) + 0.0009 * c(7) + 0.0008 * c(10) - 0.0009 * c(13);
  const W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.561 * s(1) + 0.1208 * s(2) - 0.0642 * s(3) + 0.0158 * s(4) + 0.0252 * s(5) - 0.0066 * s(6) - 0.0047 * s(7) - 0.0046 * s(8) + 0.0028 * s(9) + 0.0052 * s(10) + 0.004 * s(11) + 0.0019 * s(12) - 0.0044 * s(13);
  const a = ra * DEG, de = dec * DEG, w = (W % 360) * DEG;
  const pole = [Math.cos(de) * Math.cos(a), Math.cos(de) * Math.sin(a), Math.sin(de)];
  const node = [Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2), 0]; // W を測りはじめる点（ICRF の赤道と月の赤道の交点。IAU の定義）
  const q = [pole[1] * node[2] - pole[2] * node[1], pole[2] * node[0] - pole[0] * node[2], pole[0] * node[1] - pole[1] * node[0]]; // pole × node（赤道面で、node から 90° 東）
  const x = add(mul(node, Math.cos(w)), mul(q, Math.sin(w))); // 経度 0°
  const y = [pole[1] * x[2] - pole[2] * x[1], pole[2] * x[0] - pole[0] * x[2], pole[0] * x[1] - pole[1] * x[0]]; // 東経 90°
  return { x, y, z: pole, ra, dec, W: W % 360 };
}
const surfaceDir = (ax, lat, lonE) => {
  const cl = Math.cos(lat * DEG);
  return add(add(mul(ax.x, cl * Math.cos(lonE * DEG)), mul(ax.y, cl * Math.sin(lonE * DEG))), mul(ax.z, Math.sin(lat * DEG)));
};
// ある向き（月の中心から）の緯度・経度
const latLon = (ax, v) => {
  const u = unit(v);
  return [Math.asin(dot(u, ax.z)) / DEG, Math.atan2(dot(u, ax.y), dot(u, ax.x)) / DEG];
};

// ---------- 地形（USGS Gazetteer。2026-10-11 に各ページで確認） ----------
// nasaPhotos：NASA のギャラリー（https://www.nasa.gov/gallery/lunar-flyby/）で、説明文がその地形の名前を出している写真（2026-10-11 確認）
// ltp：NASA の観測計画（Lunar Targeting Plan、4/5 時点の「計画」）に名前があるか
// texture2k：アプリの月の色の地図（CGI Moon Kit 2048×1024）を切り出して目で見た結果（visible／faint／not_resolved）
// proposal：Phase B・C での扱いの案（VERIFIED＝位置の照準を出してよい候補／FALLBACK＝位置を指さない説明カード／HIDDEN＝出さない）
const FEATURES = [
  { id: "reiner_gamma", usgs: 4987, en: "Reiner Gamma", type: "Albedo Feature", lat: 7.39, lon: -58.96, diamKm: 73.44, ltp: true, texture2k: "visible", nasaPhotos: ["art002e012114"], proposal: "VERIFIED" },
  { id: "glushko", usgs: 2195, en: "Glushko", type: "Crater", lat: 8.11, lon: -77.67, diamKm: 40.1, ltp: true, texture2k: "visible", nasaPhotos: [], proposal: "HIDDEN" },
  { id: "pierazzo", usgs: 15328, en: "Pierazzo", type: "Crater", lat: 3.3, lon: -100.24, diamKm: 9.29, ltp: true, texture2k: "not_resolved", nasaPhotos: ["art002e012261"], proposal: "HIDDEN" },
  { id: "ohm", usgs: 4417, en: "Ohm", type: "Crater", lat: 18.32, lon: -113.78, diamKm: 61.75, ltp: true, texture2k: "faint", nasaPhotos: ["art002e012261"], proposal: "HIDDEN" },
  { id: "mare_orientale", usgs: 3685, en: "Mare Orientale", type: "Mare", lat: -19.87, lon: -94.67, diamKm: 294.16, ltp: true, texture2k: "visible", nasaPhotos: ["art002e009277", "art002e009279", "art002e010232"], proposal: "VERIFIED" },
  { id: "hertzsprung", usgs: 2482, en: "Hertzsprung", type: "Crater", lat: 1.37, lon: -128.66, diamKm: 536.37, ltp: true, texture2k: "faint", nasaPhotos: ["art002e012093", "art002e021296", "art002e009287"], proposal: "FALLBACK" },
  { id: "vavilov", usgs: 6336, en: "Vavilov", type: "Crater", lat: -0.87, lon: -138.77, diamKm: 98.22, ltp: true, texture2k: "faint", nasaPhotos: ["art002e009282", "art002e012093"], proposal: "FALLBACK" },
  { id: "mare_imbrium", usgs: 3678, en: "Mare Imbrium", type: "Mare", lat: 34.72, lon: -14.91, diamKm: 1145.53, ltp: false, texture2k: "visible", nasaPhotos: [], proposal: "HIDDEN" },
];
const TEXEL_KM = (2 * Math.PI * R_M) / 2048; // CGI Moon Kit の色の地図（2048×1024）の赤道での1画素

// ---------- 1分ごとに計算 ----------
const iso = (ms) => new Date(ms).toISOString().replace(".000", "");
const START = Date.parse("2026-04-06T00:00:00Z"), END = Date.parse("2026-04-07T06:00:00Z"), STEP = 60000;
const samples = [];
for (let ms = START; ms <= END; ms += STEP) {
  const o = orion(ms), m = geo(A.Body.Moon, ms), s = geo(A.Body.Sun, ms), ax = moonAxes(ms);
  const toM = sub(m, o), dM = len(toM), toE = mul(o, -1), dE = len(toE), toS = sub(s, o), dS = len(toS);
  const rMang = Math.asin(R_M / dM) / DEG, rEang = Math.asin(R_E / dE) / DEG, rSang = Math.asin(R_S / dS) / DEG;
  samples.push({ ms, o, m, s, ax, dM, rMang, sepE: ang(toE, toM), rEang, sepS: ang(toS, toM), rSang });
}

// ---------- 出来事 ----------
const firstWhere = (f, from = 0) => {
  for (let i = from; i < samples.length; i++) if (f(samples[i])) return i;
  return -1;
};
const ca = samples.reduce((b, x) => (x.dM < b.dM ? x : b));
// 1秒きざみで最接近を詰める
let caMs = ca.ms, caD = ca.dM;
for (let ms = ca.ms - 60000; ms <= ca.ms + 60000; ms += 1000) {
  const dd = len(sub(geo(A.Body.Moon, ms), orion(ms)));
  if (dd < caD) [caMs, caD] = [ms, dd];
}
const iCa = samples.indexOf(ca);
const ev = (i, extra = {}) => (i < 0 ? null : { utc: iso(samples[i].ms), ...extra });
const events = {
  earthset_first_contact: ev(firstWhere((x) => x.sepE < x.rMang + x.rEang)), // 地球のふちが月のふちに触れる
  earthset_center: ev(firstWhere((x) => x.sepE < x.rMang)), // 地球の中心が隠れる
  earthset_complete: ev(firstWhere((x) => x.sepE < x.rMang - x.rEang)), // 地球がすっかり隠れる
  closest_approach: { utc: iso(caMs), altitudeKm: Math.round(caD - R_M), altitudeMi: Math.round((caD - R_M) / 1.609344) },
  earthrise_first_limb: ev(firstWhere((x) => x.sepE > x.rMang - x.rEang, iCa)),
  earthrise_center: ev(firstWhere((x) => x.sepE > x.rMang, iCa)),
  earthrise_complete: ev(firstWhere((x) => x.sepE > x.rMang + x.rEang, iCa)),
};
const iE0 = firstWhere((x) => x.sepS < x.rMang + x.rSang, iCa);
const iE1 = firstWhere((x) => x.sepS < x.rMang - x.rSang, iCa);
const iE2 = iE1 < 0 ? -1 : firstWhere((x) => x.sepS > x.rMang - x.rSang, iE1);
const iE3 = iE0 < 0 ? -1 : firstWhere((x) => x.sepS > x.rMang + x.rSang, iE0);
Object.assign(events, {
  eclipse_first_contact: ev(iE0),
  eclipse_total_start: ev(iE1),
  eclipse_total_end: ev(iE2),
  eclipse_last_contact: ev(iE3),
});

// ---------- 地形ごとの見え方 ----------
function featureAt(f, x) {
  const n = surfaceDir(x.ax, f.lat, f.lon), p = add(x.m, mul(n, R_M));
  const toO = sub(x.o, p), toS = sub(x.s, p);
  const e = ang(n, toO), i = ang(n, toS), dist = len(toO);
  const angDiam = ((f.diamKm / dist) / DEG); // 正面から見たときの見かけの直径（度）
  // 月の中心から地形までの、画面上の離れ具合（月の見かけの半径を 1 とする）
  const off = ang(sub(p, x.o), sub(x.m, x.o)) / x.rMang;
  return { e, i, dist, angDiam, foreshort: Math.cos(Math.min(e, 90) * DEG), off };
}
const windows = (f, pred) => {
  const out = [];
  let open = null;
  for (const x of samples) {
    const ok = pred(featureAt(f, x));
    if (ok && !open) open = { from: x.ms };
    if (!ok && open) out.push({ from: iso(open.from), to: iso(x.ms - STEP) }), (open = null);
  }
  if (open) out.push({ from: iso(open.from), to: iso(END), cut: true });
  return out;
};
const observations = FEATURES.map((f) => {
  const visible = windows(f, (a) => a.e < 90);
  const visibleLit = windows(f, (a) => a.e < 90 && a.i < 90);
  const readable = windows(f, (a) => a.e < 70 && a.i < 88); // 斜めすぎない・照らされている
  // 見やすい時間帯のなかで、いちばん正面に近いとき
  let best = null;
  for (const x of samples) {
    const a = featureAt(f, x);
    if (a.e < 70 && a.i < 88 && (!best || a.e < best.e)) best = { utc: iso(x.ms), ...a };
  }
  const r = (v, k = 1) => Math.round(v * 10 ** k) / 10 ** k;
  return {
    id: f.id,
    en: f.en,
    usgsFeatureId: f.usgs,
    usgsUrl: `https://planetarynames.wr.usgs.gov/Feature/${f.usgs}`,
    type: f.type,
    latDeg: f.lat,
    lonEastDeg: f.lon,
    diameterKm: f.diamKm,
    texelsAcrossIn2kMap: r(f.diamKm / TEXEL_KM),
    texture2k: f.texture2k,
    inLunarTargetingPlan: f.ltp,
    nasaPhotos: f.nasaPhotos.map((id) => `https://www.nasa.gov/image-detail/amf-${id}/`),
    proposal: f.proposal,
    windows: { visible, visibleLit, readable },
    best: best && {
      utc: best.utc,
      emissionDeg: r(best.e),
      incidenceDeg: r(best.i),
      distanceKm: Math.round(best.dist),
      angularDiameterDeg: r(best.angDiam, 2),
      foreshortening: r(best.foreshort, 2),
      offsetFromMoonCenter: r(best.off, 2),
    },
  };
});

// 場面の候補の時刻での見え方（NASA の写真の説明にある撮影時刻をふくむ）
//   18:19 UTC：art002e009277（観測の時間の直前。オリエンターレ盆地がまんなか）
//   19:41 UTC：art002e009279（オリエンターレ盆地の輪）
//   22:41 UTC：art002e009287・art002e021219（地球の入り。ヘルツシュプルング盆地とヴァヴィロフも写る）
const AT = ["2026-04-06T17:00:00Z", "2026-04-06T18:19:00Z", "2026-04-06T19:00:00Z", "2026-04-06T19:41:00Z", "2026-04-06T20:30:00Z", "2026-04-06T21:12:00Z", "2026-04-06T22:00:00Z", "2026-04-06T22:41:00Z", "2026-04-06T23:10:00Z"];
const atTimes = AT.map((t) => {
  const x = samples.find((y) => y.ms === Date.parse(t));
  const r = (v, k = 1) => Math.round(v * 10 ** k) / 10 ** k;
  return {
    utc: t.replace(".000", ""),
    moonDistanceKm: Math.round(x.dM),
    moonAngularDiameterDeg: r(2 * x.rMang, 2),
    subOrion: latLon(x.ax, sub(x.o, x.m)).map((v) => r(v, 1)),
    subSolar: latLon(x.ax, sub(x.s, x.m)).map((v) => r(v, 1)),
    features: Object.fromEntries(
      FEATURES.map((f) => {
        const a = featureAt(f, x);
        return [f.id, { e: r(a.e), i: r(a.i), angDiamDeg: r(a.angDiam, 2), off: r(a.off, 2), visible: a.e < 90, lit: a.i < 90 }];
      }),
    ),
  };
});

// 最接近のとき、オリオンの真下・地球の真下・太陽の真下の緯度経度（地図の向きの確かめ用）
const caS = samples[iCa];
const subPoints = {
  utc: iso(caS.ms),
  subOrion: latLon(caS.ax, sub(caS.o, caS.m)).map((v) => Math.round(v * 100) / 100),
  subEarth: latLon(caS.ax, mul(caS.m, -1)).map((v) => Math.round(v * 100) / 100),
  subSolar: latLon(caS.ax, sub(caS.s, caS.m)).map((v) => Math.round(v * 100) / 100),
  moonPole: { raDeg: Math.round(caS.ax.ra * 1e4) / 1e4, decDeg: Math.round(caS.ax.dec * 1e4) / 1e4, WDeg: Math.round(caS.ax.W * 1e4) / 1e4 },
};
// 月の表面の、日の当たる割合（オリオンから見える半球のうち）
const litFrac = (x) => {
  let lit = 0, all = 0;
  for (let la = -88; la <= 88; la += 4)
    for (let lo = -178; lo <= 178; lo += 4) {
      const n = surfaceDir(x.ax, la, lo), w = Math.cos(la * DEG);
      if (dot(n, sub(x.o, add(x.m, mul(n, R_M)))) <= 0) continue;
      all += w;
      if (dot(n, sub(x.s, x.m)) > 0) lit += w;
    }
  return Math.round((lit / all) * 100);
};

const out = {
  $comment:
    "Phase A の検証用の計算結果（ドラフト）。scripts/artemis2-observations.mjs で作った。アプリには読み込まない。月は球（地形の高さなし）。宇宙船の姿勢・窓の向きは入っていない（位置だけ）",
  source: {
    ephemerisPage: "https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/",
    file: file.split("/").at(-1),
    creationDate: meta.CREATION_DATE,
    originator: meta.ORIGINATOR,
    frame: `${meta.CENTER_NAME} / ${meta.REF_FRAME} / ${meta.TIME_SYSTEM}`,
    useableStart: meta.USEABLE_START_TIME,
    useableStop: meta.USEABLE_STOP_TIME,
    rows: rows.length,
  },
  method: {
    moonSun: "Astronomy Engine GeoVector（EQJ = J2000 赤道）",
    moonOrientation: "IAU WGCCRE 2009（周期項つき）",
    moonRadiusKm: R_M,
    earthRadiusKm: R_E,
    visible: "出射角 e < 90°",
    lit: "入射角 i < 90°",
    readable: "e < 70° かつ i < 88°",
    texelKm: Math.round(TEXEL_KM * 100) / 100,
    step: "60 s",
    window: `${iso(START)} — ${iso(END)}`,
  },
  events,
  subPoints,
  atTimes,
  litFractionOfVisibleHemisphere: {
    at_earthset: litFrac(samples[firstWhere((x) => x.sepE < x.rMang)]),
    at_closest_approach: litFrac(caS),
    at_earthrise: litFrac(samples[firstWhere((x) => x.sepE > x.rMang, iCa)]),
  },
  observations,
};
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
console.error(`events: ${JSON.stringify(events)}`);
