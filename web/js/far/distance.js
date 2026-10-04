// 遠くを見る部屋：地球からの距離と、光で届く時間
// 月・太陽・惑星の位置はブラウザで計算する（Astronomy Engine、MIT License）。
// 探査機は、カードの distance の書き方どおりに出す。推測の値は使わない：
//   planet=いる惑星までの距離（計算）／typical=公式の目安の値／dated=日付つきの公式の値／
//   horizons=NASA JPL の Horizons の計算値（週に1回取った表 web/data/horizons.json）／pending=準備中／on_earth=打ち上げ前
import { GeoVector, Body, MakeTime, KM_PER_AU } from "../../vendor/astronomy.min.js";

export const C_KM_S = 299792.458; // 光の速さ（km/秒。定義の値）
export const LIGHT_DAY_KM = C_KM_S * 86400; // 1光日：光が24時間で進む距離（約259億km）
export const LIGHT_YEAR_KM = C_KM_S * 86400 * 365.25; // 1光年（1年＝365.25日）

export const BODY_JA = { Moon: "月", Sun: "太陽", Mercury: "水星", Venus: "金星", Mars: "火星", Jupiter: "木星", Saturn: "土星" };

// 地球の中心から天体の中心までの距離（km）。光が地球に届くまでの時間の分だけ前の位置で計算する
export function bodyDistanceKm(name, date) {
  const body = BODY_JA[name] && Body[name];
  if (!body) throw new Error(`計算できない天体: ${name}`);
  const v = GeoVector(body, MakeTime(date), false);
  return Math.hypot(v.x, v.y, v.z) * KM_PER_AU;
}

// くらべる目安（探査機ではないもの）。月と太陽は計算、1光日は定義から
export function landmarks(date) {
  return [
    { id: "moon", name: "月", km: bodyDistanceKm("Moon", date), kind: "landmark" },
    { id: "sun", name: "太陽", km: bodyDistanceKm("Sun", date), kind: "landmark" },
    { id: "light-day", name: "1光日", km: LIGHT_DAY_KM, kind: "light-day" },
  ];
}

// Horizons の表（1日ごと）から、date の距離を出す（となりの2日を線でつなぐ）。
// 表がない・date が表の外（取得が止まって古くなった）ときは null（準備中に戻す。古い値を「いま」と見せない）
export function horizonsKm(table, id, date) {
  const t = table?.probes?.[id];
  const start = Date.parse(t?.start ?? "");
  const step = (table?.step_hours ?? 0) * 3600000;
  if (!t || Number.isNaN(start) || !(step > 0) || !Array.isArray(t.km) || t.km.length < 2) return null;
  const x = (date.getTime() - start) / step;
  if (!(x >= 0 && x <= t.km.length - 1)) return null;
  const i = Math.min(Math.floor(x), t.km.length - 2);
  const km = t.km[i] + (t.km[i + 1] - t.km[i]) * (x - i);
  return Number.isFinite(km) && km > 0 ? km : null;
}

// 探査機の距離。{ km, method, body?, at?, approx, downloaded?, supplier? }。距離を出せないとき（準備中）は null。
// horizons は web/data/horizons.json の中身（なければ Horizons の探査機は準備中）
export function probeDistance(card, date, horizons = null) {
  const d = card.distance ?? {};
  switch (d.method) {
    case "planet":
      return { km: bodyDistanceKm(d.body, date), method: "planet", body: d.body, approx: false };
    case "typical":
      return { km: d.value, method: "typical", approx: true };
    case "dated":
      return { km: d.value, method: "dated", at: d.at, approx: true };
    case "horizons": {
      // 丸めた値で持つ（JPL SSD に伝えた出し方。画面ではさらに3桁に丸めて「約」を付ける）。
      // 有効数字5桁は、1光日（約259億km）より手前か先かを、半日ほどの細かさで分けるため
      const km = horizonsKm(horizons, card.id, date);
      if (km === null) return null;
      return { km: roundSig(km, 5), method: "horizons", approx: true, downloaded: horizons.probes[card.id].downloaded, supplier: d.supplier ?? null };
    }
    case "on_earth":
      return { km: 0, method: "on_earth", approx: false };
    default:
      return null;
  }
}

// 光で届く時間（秒）
export const lightSeconds = (km) => km / C_KM_S;

// ---------- 数の書き方 ----------

// 有効数字 sig 桁に丸める
export function roundSig(x, sig) {
  if (!x) return 0;
  const p = 10 ** (Math.floor(Math.log10(Math.abs(x))) - sig + 1);
  return Math.round(x / p) * p;
}

const group = (n) => Math.round(n).toLocaleString("ja-JP");

// 「2億4,700万 km」「150万 km」「95億 km」（有効数字 sig 桁。万・億・兆で区切る）
export function kmJa(km, sig = 3) {
  const r = roundSig(km, sig);
  if (r >= 1e12) {
    const cho = Math.floor(r / 1e12);
    const oku = Math.round((r - cho * 1e12) / 1e8);
    return `${group(cho)}兆${oku ? `${group(oku)}億` : ""} km`;
  }
  if (r >= 1e8) {
    const oku = Math.floor(r / 1e8);
    const man = Math.round((r - oku * 1e8) / 1e4);
    return `${group(oku)}億${man ? `${group(man)}万` : ""} km`;
  }
  if (r >= 1e4) {
    const man = Math.floor(r / 1e4);
    const rest = Math.round(r - man * 1e4);
    return `${group(man)}万${rest ? group(rest) : ""} km`;
  }
  return `${group(r)} km`;
}

// はしご・物差し用の短い書き方：「2.47億 km」「150万 km」「38.4万 km」
export function kmShortJa(km, sig = 3) {
  const r = roundSig(km, sig);
  const fmt = (v) => String(+v.toPrecision(sig));
  if (r >= 1e12) return `${fmt(r / 1e12)}兆 km`;
  if (r >= 1e8) return `${fmt(r / 1e8)}億 km`;
  if (r >= 1e4) return `${fmt(r / 1e4)}万 km`;
  return `${group(r)} km`;
}

// HUD 用：ぜんぶの桁（「25,902,068,371 km」）
export const kmFullJa = (km) => `${group(km)} km`;

// 光の時間：「1.3 秒」「8 分 19 秒」「23 時間 52 分」。
// approx（目安の値・日付つきの値）は、もとの値の細かさに合わせて丸めて「約」を付ける
export function lightTimeJa(seconds, { approx = false } = {}) {
  const s = Math.max(0, seconds);
  if (approx) {
    if (s < 60) return `約 ${Math.round(s)} 秒`;
    if (s < 3600) return `約 ${Math.round(s / 60)} 分`;
    const m10 = Math.round(s / 600) * 10; // 10分単位
    const h = Math.floor(m10 / 60);
    const m = m10 % 60;
    return `約 ${h} 時間${m ? ` ${m} 分` : ""}`;
  }
  if (s < 1) return `${s.toFixed(4)} 秒`;
  if (s < 60) return `${s.toFixed(1)} 秒`;
  if (s < 3600) return `${Math.floor(s / 60)} 分 ${Math.floor(s % 60)} 秒`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h} 時間${m ? ` ${m} 分` : ""}`;
}

// 光年：「0.00274 光年」「1.6×10⁻⁷ 光年」
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export function lightYearsJa(km) {
  const ly = km / LIGHT_YEAR_KM;
  if (ly >= 1e-4) return `${ly.toFixed(5)} 光年`;
  const [m, e] = ly.toExponential(1).split("e");
  return `${m}×10${String(Number(e)).replace(/./g, (c) => SUP[c])} 光年`;
}

// 桁ごとの段（はしご）の名前：「10万 km〜」「1000万 km〜」「1億 km〜」
export function decadeLabel(e) {
  if (e >= 12) return `${10 ** (e - 12)}兆 km〜`;
  if (e >= 8) return `${10 ** (e - 8)}億 km〜`;
  if (e >= 4) return `${10 ** (e - 4)}万 km〜`;
  return `${10 ** e} km〜`;
}
