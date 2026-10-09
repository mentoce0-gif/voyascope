// 遠くを見る部屋：3D の旅（タスク015）。合わせた試作（docs/design/far-room-visual-merged.html）を、本体のデータで動くようにしたもの。
// さわり心地＝Claude 案、表示＝Codex 案、航路＝スイングバイの弧をつないだ道。探査機の模型は Codex が作った models.js（公式を参考にしたイメージ）。
// 停留所（着く場所）は journeyStops が、部屋に並べるもの（room.js の roomItems）から作る：距離があって、見せ方（LOOK）が決まっているもの。
// 距離・文・予定は、計算とカード（curation/probes）と予定（curation/events）だけから書く。航路の形・機体の向き・大きさは演出。
// three.js は r128（web/vendor/three-r128.min.js）。room.js が読み込んで THREE として渡す。WebGL を使えないときは createJourney が投げる（room.js が v0 の飛ぶ画面に戻す）
import { esc } from "../format.js";
import { whenText } from "../events.js";
import { C_KM_S, LIGHT_DAY_KM, LIGHT_YEAR_KM, kmFullJa, kmJa, kmShortJa, lightTimeJa } from "./distance.js";
import { distanceParts, nextEvent, eventLine, eventTitleWithout } from "./probe-card.js";
import { makeKit, MODELS } from "./models.js";

// ---------- 調整できる値（試作と同じ） ----------
export const TUNE = {
  UNITS_PER_DECADE: 50, // 航路の長さ：距離の1桁あたり（3D の単位）。1回はじくと、だいたい1桁進む
  MIN_STRAIGHT: 22, // スイングバイの弧のあと、次の場所に着くまでの最低のまっすぐの長さ
  FRICTION: 0.2, // 1秒で速さがこの倍になる（約1秒で止まる）
  SWIPE_GAIN: 0.24, // 指を1px動かしたときに足す速さ（単位/秒）
  WHEEL_GAIN: 0.08, // ホイール1単位あたり
  KEY_PUSH: 18, // ↑↓キー1回
  PAGE_PUSH: 50, // PageUp/PageDown 1回
  MAX_V: 165, // 速さの上限（単位/秒）
  SNAP_RANGE: 16, // ゆっくり近づいたとき、この長さ以内の場所に吸い寄せて止める
  SNAP_SPEED: 34, // これより遅いと吸い寄せる
  GRAVITY: 26, // スイングバイの天体に近づくとき、引き込まれる強さ（単位/秒²）
  SLING: 0.9, // スイングバイで飛び出す強さ（次の場所までの何割まで、ひとりでに進むか）
  FOV_PORTRAIT: 66, // 視野（縦長の画面、度）
  FOV_LANDSCAPE: 54, // 視野（横長の画面、度）
  FOV_WARP: 22, // いちばん速いワープのときに広げる視野（度）
  FOV_SLING: 9, // スイングバイで飛び出す瞬間に広げる視野（度）
  BANK: 0.2, // スイングバイで傾ける大きさ（ラジアン）
  STAR_COUNT: 1400, // 流れる星
  SKY_STARS: 2400, // 遠くの星
  TRIP_MIN: 1.9, // 「その先へ」の飛行の長さ（秒）：最短
  TRIP_MAX: 5.4, // 最長
  TRIP_PER_UNIT: 0.017, // 航路の長さ1あたり
  PIXEL_RATIO_MAX: 1.75,
};

const C = C_KM_S;
const EARTH_R = 6371; // 地球の半径（km）。うしろの窓の、地球の見かけの大きさに使う
export const P0 = 2; // 100 km（地表の近く）から
export const PMAX = Math.log10(LIGHT_DAY_KM) + 0.2; // 1光日の少し先まで

// ---------- 見せ方（演出） ----------
// kind: body=天体／model=探査機の模型／duo=天体＋模型／gate=1光日の輪。
// swing: gravity=重力でスイングバイ（大きく曲がって飛び出す）／around=まわりを回りこむ（探査機と太陽）
// R：大きさ（3D の単位）、kq：弧の半径の倍率、turn：曲がる角度（度）、tilt：弧の傾き（度）、size：着いたときの見かけの大きさの倍率
export const LOOK = {
  moon: { kind: "body", body: "moon", R: 2.6, kq: 3.0, turn: 78, tilt: -14, bank: 1, size: 1, swing: "gravity", by: "月" },
  jwst: { kind: "model", model: "jwst", R: 1.75, kq: 2.6, turn: 36, tilt: 12, bank: 0.5, size: 1, swing: "around" },
  hayabusa2: { kind: "model", model: "hayabusa2", R: 1.6, kq: 2.6, turn: 34, tilt: -10, bank: 0.5, size: 0.9, swing: "around" },
  "parker-solar-probe": { kind: "model", model: "parker-solar-probe", R: 1.6, kq: 2.6, turn: 38, tilt: 12, bank: 0.5, size: 0.9, swing: "around" },
  sun: { kind: "body", body: "sun", R: 3.6, kq: 2.9, turn: 40, tilt: -8, bank: 0.5, size: 0.62, swing: "around" },
  bepicolombo: { kind: "duo", body: "mercury", model: "bepicolombo", R: 1.5, mR: 1.6, kq: 2.6, turn: 70, tilt: 14, bank: 1, size: 1, swing: "gravity", by: "水星" },
  perseverance: { kind: "body", body: "mars", R: 2.4, kq: 3.0, turn: 76, tilt: -10, bank: 1, size: 1, swing: "gravity", by: "火星", lens: true },
  juno: { kind: "duo", body: "jupiter", model: "juno", R: 3.0, mR: 1.75, kq: 2.6, turn: 66, tilt: 10, bank: 1, size: 1, swing: "gravity", by: "木星", rpm: 2 }, // rpm：1分に2回まわる（NASA のジュノーのページ）
  "new-horizons": { kind: "model", model: "new-horizons", R: 1.5, kq: 2.7, turn: 32, tilt: 12, bank: 0.5, size: 0.72, swing: "around", dust: true },
  "voyager-2": { kind: "model", model: "voyager", R: 1.75, kq: 2.6, turn: 30, tilt: -12, bank: 0.5, size: 0.8, swing: "around" },
  // 1光日の輪。ボイジャー1号（11月18日にここへ届く予定。NASA の予告）を輪のそばに置く。アンテナを地球（こちら）に向け、回さない
  "light-day": { kind: "gate", R: 7, size: 1, swing: "gate", model: "voyager", mR: 2.0, mOff: [1.3, 1.2, 5.0], mPose: [0.9, -0.6, -0.1], still: true },
};
// ボイジャー1号は自分の停留所を作らず、1光日の輪のそばに置く（いまの距離は 1光日のすぐ手前）
export const GATE_COMPANION = "voyager-1";
// その場所へ向かうときの言葉（Codex 案。新しい3つも同じ調子で、カードに書いてあることだけ）
export const TRAVEL = {
  moon: "地球を、離れる。",
  jwst: "小さな光が、姿になる。",
  hayabusa2: "小惑星をめざす、旅の途中へ。",
  "parker-solar-probe": "太陽のまわりを回る機体へ。",
  sun: "光の生まれる方へ。",
  bepicolombo: "その先に、旅する機体。",
  perseverance: "もうひとつの地面へ。",
  juno: "いちばん大きな惑星へ。",
  "new-horizons": "遠さの、桁を越える。",
  "voyager-2": "恒星間空間を飛ぶ機体へ。",
  "light-day": "光の一日を、追い越す。",
};
const EN = { moon: "THE MOON", sun: "THE SUN", "light-day": "ONE LIGHT-DAY" };
// 右上の「地球からの距離」の横に付ける印（その値の出し方）
const TAG = { typical: "目安", dated: "目安", horizons: "計算値" };
const LONG_NAME = 11; // これより長い名前は、スマホでは1行に縮めて収める（説明が上へ伸びないように）

// ---------- 停留所（本体のデータから） ----------
// items：room.js の roomItems。距離があって、見せ方の決まっているものを近い順に。文・予定・距離の書き方はカードと計算から
export function journeyStops(items, { now = new Date(), upcoming = [], v1Event = null } = {}) {
  const v1 = items.find((it) => it.id === GATE_COMPANION) ?? null;
  return items
    .filter((it) => it.id !== GATE_COMPANION && it.dist && it.dist.km > 0 && LOOK[it.id])
    .sort((a, b) => a.dist.km - b.dist.km)
    .map((it) => {
      const d = it.dist;
      const dp = distanceParts(it);
      const st = {
        id: it.id,
        kind: it.kind,
        name: it.name,
        en: EN[it.id] ?? String(it.card?.name?.en ?? it.name).toUpperCase(),
        km: d.km,
        approx: !!d.approx,
        tag: TAG[d.method] ?? "",
        dist: d.approx ? dp.short : kmFullJa(d.km), // 計算した値はぜんぶの桁、目安・日付つき・Horizons は丸めて「約」
        sayDist: d.approx ? dp.km : kmJa(d.km),
        lt: dp.lt,
        how: dp.how,
        text: "",
        event: "", // HTML（eventLine）
        sayEvent: "",
        card: it.card ? it.id : null, // 「探査機をもっと知る」で開くカード
        companion: null,
      };
      if (it.id === "moon") st.text = `光なら ${dp.lt}で着く。ここまでは、ほとんど一瞬`;
      else if (it.id === "sun") st.text = `いま見ている太陽の光は、${dp.lt}前に太陽を出た光`;
      else if (it.kind === "light-day") {
        if (v1Event) st.text = `ボイジャー1号は ${whenText(v1Event, now)}、ここに届く予定（NASA）。人がつくったもので、はじめて`;
        else if (v1?.card) st.text = `ボイジャー1号は、${v1.card.location.value}`;
        else st.text = "光が24時間で進む距離";
        if (v1?.card) st.card = GATE_COMPANION;
        if (v1 && (v1Event || v1.dist?.km > 0)) {
          const dp1 = v1.dist?.km > 0 ? distanceParts(v1) : null;
          st.companion = { name: v1.name, dist: dp1?.short ?? null, how: dp1?.how ?? null, beyond: !!(dp1 && v1.dist.km >= LIGHT_DAY_KM) };
          // 説明の小さな行は、1光日の説明の代わりに、ボイジャー1号のいまの距離（名前と「光で 24 時間」で、1光日のことは分かる）
          if (dp1) st.how = `${v1.name}は いま${dp1.short}・${dp1.how}`;
        }
      } else {
        st.text = it.card?.location?.value ?? "";
        const ev = nextEvent(it, upcoming);
        if (ev) {
          st.event = eventLine(ev, now, { title: eventTitleWithout(ev.title.ja, it.name) }); // 名前のすぐ下なので、名前を省く（試作と同じ）
          st.sayEvent = `${whenText(ev, now)} ${ev.title.ja}`;
        }
      }
      return st;
    });
}

// 名前（大きな見出し）。ウェッブは PC で2行に分ける（試作と同じ）。「・」のあとで折り返せるようにする
export function titleHtml(st) {
  if (st.id === "jwst" && st.name === "ジェイムズ・ウェッブ宇宙望遠鏡") return 'ジェイムズ・ウェッブ<br class="br-wide">宇宙望遠鏡';
  return esc(st.name).replace(/・/g, "・<wbr>");
}

// ---------- 数の書き方 ----------
const DEG = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const group = (n) => Math.round(n).toLocaleString("ja-JP");
// 光年：0 がたくさん並ぶのを見せる（有効数字4桁）
export function lightYears(km) {
  const ly = km / LIGHT_YEAR_KM;
  const d = clamp(3 - Math.floor(Math.log10(ly)), 4, 16);
  return ly.toFixed(d);
}
export function niceStep(span) {
  const raw = span / 4;
  const e = 10 ** Math.floor(Math.log10(raw));
  const m = raw / e;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * e;
}
// 地球の見かけの大きさ（うしろの窓）
export function angleText(deg) {
  if (deg >= 10) return `${Math.round(deg)} 度`;
  if (deg >= 1) return `${deg.toFixed(1)} 度`;
  return `${Number(deg.toPrecision(2)).toFixed(Math.max(2, 1 - Math.floor(Math.log10(deg))))} 度`;
}
// いまの速さ：km（いまの距離）・dp（距離の桁が、航路1単位で何桁変わるか）・v（速さ。単位/秒）
export function speedInfo(km, dp, v) {
  if (Math.abs(v) < 0.3) return { text: "いまの速さ 0 km/秒", warp: 0 };
  const kmps = Math.abs(km * Math.LN10 * dp * v);
  if (kmps < C) return { text: `いまの速さ 秒速 ${group(kmps)} km`, warp: 0 };
  const ratio = kmps / C;
  return { text: `ワープ中：光の ${group(ratio)} 倍`, warp: Math.min(1, Math.log10(ratio + 1) / 3.2), fiction: true };
}

// ---------- 画面の部品 ----------
export function journeyHtml({ coarse = false } = {}) {
  const hint = coarse
    ? `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18m-4-4 4 4 4-4"/></svg><span>下へはじいて自由に飛ぶ<small>上へはじくと地球の方へ</small></span>`
    : `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V3m-4 4 4-4 4 4"/></svg><span>ホイールか ↑ キーで自由に飛ぶ<small>↓ キーで地球の方へ。Home で地表へ</small></span>`;
  return `
    <div class="viewport" data-j="viewport" tabindex="0" role="group" aria-label="宇宙を飛ぶ画面。下へスワイプか ↑ キーで遠くへ、上へスワイプか ↓ キーで地球の方へ。Home キーで地表へ戻る" aria-describedby="far-warp-note">
      <canvas class="space" data-j="space" aria-hidden="true"></canvas>
    </div>
    <div class="vignette" aria-hidden="true"></div>
    <div class="warp-vignette" data-j="warp-vignette" aria-hidden="true"></div>
    <div class="flash" data-j="flash" aria-hidden="true"></div>
    <div class="overlay" aria-hidden="true">
      <div class="lens-line" data-j="lens-line"></div>
      <div class="lens-pin" data-j="lens-pin"></div>
      <div class="lens" data-j="lens"><span>火星の地面（望遠・イメージ）</span></div>
      <div class="reticle" data-j="reticle"><i></i><i></i><i></i><i></i></div>
      <div class="reticle-label" data-j="reticle-label"><span>NEXT</span><b data-j="reticle-name"></b></div>
    </div>

    <header class="topbar">
      <button type="button" class="far-back" data-far-close><span aria-hidden="true">‹</span> 地球へ戻る</button>
      <span class="j-brand" aria-hidden="true"><img src="assets/brand/logo-600.webp" alt="" width="600" height="104"><span class="brand-room">遠くを見る部屋</span></span>
      <div class="top-actions">
        <button type="button" class="round" data-j="sound" aria-pressed="false" aria-label="音を出す">
          <svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4L6 8H3v8h3l5 4z"/><path class="off" d="m16 9 6 6m0-6-6 6"/><path class="on" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>
        </button>
        <button type="button" class="map-link" data-far-ladder aria-label="距離のはしごを見る"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M19 4v16M5 5h14M5 12h14M5 19h14"/></svg><span>距離のはしご</span></button>
      </div>
    </header>

    <div class="telemetry">
      <div class="metric-label">地球からの距離<span class="approx" data-j="approx"></span></div>
      <div class="distance"><span data-j="km">100</span><small>km</small></div>
      <div class="submetrics"><span><b data-j="ly"></b> 光年</span><span>光で <b data-j="lt"></b></span></div>
      <div class="speed" data-j="speed">いまの速さ 0 km/秒</div>
    </div>
    <div class="top-status"><span class="status-dot" aria-hidden="true"></span><span data-j="status">地球の、すぐそば。</span></div>
    <figure class="rear" data-j="rear" data-off="true" aria-hidden="true">
      <canvas data-j="rear-cv"></canvas>
      <figcaption><span>うしろ：地球</span><span>見かけの大きさ</span><b data-j="rear-size"></b></figcaption>
    </figure>
    <div class="chapter-rail" aria-hidden="true"><span data-j="chapter-num">00</span><div class="rail-line"><i data-j="rail-fill"></i></div><span data-j="chapter-total">00</span></div>
    <div class="scene-tag" aria-hidden="true"><span class="tag-line"></span><span data-j="scene-name">EARTH</span><small data-j="scene-caption">高さ 100 km から、出発</small></div>

    <div class="story">
      <div class="eyebrow" data-j="eyebrow">A JOURNEY BEYOND / 光の旅</div>
      <div class="story-en" data-j="story-en" aria-hidden="true"></div>
      <h3 class="story-title" data-j="title">その先の、<br>まだ先へ。</h3>
      <p data-j="text">光になって、地球の輪の外へ。<br>遠くで旅をつづける探査機に、会いにいこう。</p>
      <div class="hero-meta" data-j="meta" hidden></div>
      <div class="hero-event" data-j="event" hidden></div>
      <button type="button" class="detail-link" data-j="details" hidden>探査機をもっと知る <span aria-hidden="true">＋</span></button>
      <a class="detail-link tour-link" data-j="tour" href="tour/artemis2/" hidden><i class="orion-dot" aria-hidden="true"></i>アルテミス2号に乗ってみる <span aria-hidden="true">›</span></a>
    </div>
    <div class="travel-label" aria-hidden="true"><span data-j="travel-word">地球を、離れる。</span><small data-j="travel-sub"></small></div>

    <div class="journey-controls">
      <p class="interaction-hint">${hint}</p>
      <button type="button" class="primary" data-j="primary">
        <span class="primary-text"><span data-j="primary-label">旅をはじめる</span><small data-j="primary-sub"></small></span>
        <span class="arrow" aria-hidden="true"><svg class="i" viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></span>
      </button>
    </div>

    <div class="bottom-panel">
      <div class="ruler-head"><span>地球から、いまいる場所まで</span><span class="mono" data-j="ruler-km">100 km</span></div>
      <canvas class="ruler" data-j="ruler" aria-hidden="true"></canvas>
      <div class="footline"><p id="far-warp-note">光より速く進むのはワープ（作り話）です</p><button type="button" data-j="home">地表へ戻る ↶</button></div>
    </div>
    <p class="model-note">公式を参考にしたイメージ</p>
    <p class="look-hint" aria-hidden="true"><svg class="i" viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4"/></svg><span>${coarse ? "指でなぞって、まわりから眺める" : "ドラッグか ← → キーで、まわりから眺める"}</span></p>`;
}

// ---------- 3D の旅 ----------
// root：.journey（中身は journeyHtml）。THREE：three.js r128 のモジュール。
// WebGL を使えなければ投げる（何も残さない）。返すもの：setStops・start・stop・flyTo・home
export function createJourney(root, { THREE, stops: initialStops, coarse = false, onDetails = () => {}, say = () => {}, keyTarget = root, isBlocked = () => false } = {}) {
  const $ = (name) => root.querySelector(`[data-j="${name}"]`);
  const viewport = $("viewport");
  const canvas = $("space");
  const reduceQuery = matchMedia("(prefers-reduced-motion: reduce)");
  let reduce = reduceQuery.matches;

  // WebGL。作れなければ、ここで投げる
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });

  let STOPS = prepareStops(initialStops);
  let total = STOPS.length;
  function prepareStops(list) {
    return list.map((pl) => ({ ...pl, p: Math.log10(pl.km) }));
  }
  // その停留所の見せ方。1光日は、ボイジャー1号がいるときだけ模型を置く（1光日を越えたら、輪の向こう側に）
  function lookFor(pl) {
    const lk = LOOK[pl.id];
    if (lk.kind !== "gate") return lk;
    if (!pl.companion) return { ...lk, model: null };
    return pl.companion.beyond ? { ...lk, mOff: [lk.mOff[0], lk.mOff[1], -lk.mOff[2]] } : lk;
  }

  const NOISE = `
float hash(vec3 p){ p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1.,0.,0.)), f.x), mix(hash(i + vec3(0.,1.,0.)), hash(i + vec3(1.,1.,0.)), f.x), f.y),
             mix(mix(hash(i + vec3(0.,0.,1.)), hash(i + vec3(1.,0.,1.)), f.x), mix(hash(i + vec3(0.,1.,1.)), hash(i + vec3(1.,1.,1.)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
`;

  // ---------- 航路：スイングバイの弧をつないだ道 ----------
  // 場所ごとに「着いた地点 E」→ まっすぐ → 天体（機体）のまわりの弧 → まっすぐ → 次の E。
  // 距離の桁（p）は、E と E のあいだで道の長さに比例して割り振る（1桁 ≒ UNITS_PER_DECADE。近い場所どうしは、弧が重ならないよう長めにとる）
  let FI = null; // 画面の形
  let ROUTE = null;
  function frameInfo() {
    const W = Math.max(1, root.clientWidth), H = Math.max(1, root.clientHeight), aspect = W / H;
    const t = smooth01((aspect - 0.62) / (1.25 - 0.62)); // 0 = 縦長（スマホ）、1 = 横長（PC）
    const vfov = lerp(TUNE.FOV_PORTRAIT, TUNE.FOV_LANDSCAPE, t);
    const tv = Math.tan((vfov * DEG) / 2), th = tv * aspect;
    // 縦長の画面：着いた場所（天体・機体）を、上の数字（地球からの距離）の下から、下の説明（名前・文）の上までのあいだに収める。
    // 画面が低いとき（アプリの中・ブラウザのバーが出ているとき）は、小さく・上に置いて、名前に重ならないようにする
    const bandTop = 150, bandBottom = Math.max(bandTop + 90, H - (H < 781 ? 400 : 440));
    const band = bandBottom - bandTop, cy = bandTop + band / 2, rPx = Math.min(0.58 * (W / 2), band * 0.5);
    const shortK = clamp((H - 300) / 400, 0.6, 1); // 横長で低い画面（横にしたスマホ）：上の数字にかからないよう、着いた場所を小さく
    return {
      W, H, aspect, t, vfov, tv, th, portrait: t < 0.5, bandTop, bandBottom,
      // 着いたときに、見せたいもの（天体・機体）を置く画面の場所（中央が 0、右と上が +1）と見かけの半径
      focus: { x: lerp(0.04, 0.4, t), y: lerp(1 - (2 * cy) / H, 0.03, t) },
      orbit: { x: lerp(1.8, 0.85, t), y: lerp(0.12, 0.05, t) }, // スイングバイの弧の上：天体の中心は画面の右の外。縁だけが右に見える
      around: { x: lerp(0.03, 0.3, t), y: lerp(0.3, 0.03, t) }, // 回りこむ弧の上：機体を見つづける
      aR: lerp(Math.atan((rPx / (W / 2)) * th), Math.atan(0.5 * tv) * shortK, t),
      startPitch: lerp(14, 3, t) * DEG, // 出発のとき、地平線を見せるために下を向く
    };
  }
  function encounterGeom(lk) {
    const aR = Math.min(FI.aR * lk.size, 0.6);
    if (lk.kind === "gate") return { e: lk.R / Math.tan(aR * 1.25), q: 0 };
    const q = lk.kq * lk.R;
    if (lk.kind === "duo") {
      // 機体を手前に大きく、天体をその右上の奥に
      const dist = lk.mR / Math.sin(aR), b = 0.15 * q, c = -0.12 * q;
      const a = Math.sqrt(Math.max(dist * dist - b * b - c * c, (0.5 * dist) ** 2));
      return { q, e: a + 0.8 * q, model: { a, b, c } };
    }
    const dist = lk.R / Math.sin(aR);
    if (lk.swing === "around") return { q: 0.8 * dist, e: 0.6 * dist }; // 機体（太陽）から同じくらいの距離のまま、まわりを回る
    return { q, e: Math.sqrt(Math.max(dist * dist - q * q, (0.55 * q) ** 2)) };
  }
  function buildRoute() {
    const V = THREE.Vector3, STEP = 0.4;
    const pos = new V(), dir = new V(0, 0, -1), worldUp = new V(0, 1, 0), rel = new V(), qs = new THREE.Quaternion();
    const xs = [], ss = [];
    let s = 0;
    const add = () => {
      xs.push(pos.x, pos.y, pos.z);
      ss.push(s);
    };
    const straight = (L) => {
      const n = Math.max(1, Math.ceil(L / STEP));
      for (let k = 0; k < n; k++) {
        pos.addScaledVector(dir, L / n);
        s += L / n;
        add();
      }
    };
    const arc = (center, axis, angle) => {
      // 右へ曲がる（axis のまわりに -angle）
      const r = center.distanceTo(pos), n = Math.max(2, Math.ceil((angle * r) / STEP));
      qs.setFromAxisAngle(axis, -angle / n);
      for (let k = 0; k < n; k++) {
        rel.subVectors(pos, center).applyQuaternion(qs);
        pos.addVectors(center, rel);
        dir.applyQuaternion(qs);
        s += (angle * r) / n;
        add();
      }
    };
    add();
    const stops = [], anchors = [{ s: 0, p: P0 }];
    let tail = 0, prevP = P0;
    STOPS.forEach((pl, i) => {
      const lk = lookFor(pl), g = encounterGeom(lk);
      straight(Math.max(TUNE.UNITS_PER_DECADE * (pl.p - prevP), tail + TUNE.MIN_STRAIGHT) - tail);
      const axis = worldUp.clone().addScaledVector(dir, -worldUp.dot(dir)).normalize().applyAxisAngle(dir, (lk.tilt ?? 0) * DEG);
      const right = new V().crossVectors(dir, axis).normalize();
      const st = { i, pl, lk, g, sE: s, E: pos.clone(), dirIn: dir.clone(), axis, right };
      anchors.push({ s, p: Math.max(pl.p, prevP) });
      if (lk.kind === "gate") {
        st.center = pos.clone().addScaledVector(dir, g.e);
        st.normal = dir.clone();
        st.sA = st.sX = s + g.e;
        tail = 0;
      } else {
        straight(g.e);
        st.sA = s;
        st.center = pos.clone().addScaledVector(right, g.q);
        arc(st.center, axis, lk.turn * DEG);
        st.sX = s;
        tail = st.sX - st.sE;
      }
      st.focus = g.model ? st.E.clone().addScaledVector(st.dirIn, g.model.a).addScaledVector(right, g.model.b).addScaledVector(axis, g.model.c) : st.center;
      // 見る向きを変え始める長さ（着く前）と、前へ向き直る長さ（弧のあと）
      const before = i ? st.sE - stops[i - 1].sX : st.sE;
      st.win = Math.min(30, 0.5 * before);
      stops.push(st);
      prevP = Math.max(pl.p, prevP);
    });
    stops.forEach((st, i) => {
      const after = (stops[i + 1]?.sE ?? s + 40) - st.sX;
      st.wout = st.lk.kind === "gate" ? 3 : Math.min(14, 0.4 * after);
      st.sMid = st.sA + 0.5 * (st.sX - st.sA);
    });
    straight(Math.max(TUNE.UNITS_PER_DECADE * (PMAX - prevP), (stops[stops.length - 1]?.g.e ?? 0) + 26));
    anchors.push({ s, p: Math.max(PMAX, prevP + 0.05) });
    const n = ss.length, ps = new Float64Array(n);
    for (let j = 0, k = 0; j < n; j++) {
      while (k < anchors.length - 2 && ss[j] > anchors[k + 1].s) k++;
      const a = anchors[k], b = anchors[k + 1];
      ps[j] = a.p + (b.p - a.p) * clamp((ss[j] - a.s) / (b.s - a.s || 1), 0, 1);
    }
    return { xs: Float32Array.from(xs), ss: Float64Array.from(ss), ps, len: s, stops, anchors };
  }
  function routeIndex(s) {
    const ss = ROUTE.ss;
    let lo = 0, hi = ss.length - 1;
    if (s <= ss[0]) return 0;
    if (s >= ss[hi]) return hi - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ss[mid] <= s) lo = mid;
      else hi = mid;
    }
    return lo;
  }
  function routePos(s, out) {
    const j = routeIndex(s), ss = ROUTE.ss, xs = ROUTE.xs, t = clamp((s - ss[j]) / (ss[j + 1] - ss[j] || 1), 0, 1);
    return out.set(lerp(xs[3 * j], xs[3 * j + 3], t), lerp(xs[3 * j + 1], xs[3 * j + 4], t), lerp(xs[3 * j + 2], xs[3 * j + 5], t));
  }
  function routeP(s) {
    const j = routeIndex(s), ss = ROUTE.ss, t = clamp((s - ss[j]) / (ss[j + 1] - ss[j] || 1), 0, 1);
    return lerp(ROUTE.ps[j], ROUTE.ps[j + 1], t);
  }
  function routeS(p) {
    const ps = ROUTE.ps;
    let lo = 0, hi = ps.length - 1;
    if (p <= ps[0]) return 0;
    if (p >= ps[hi]) return ROUTE.len;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ps[mid] <= p) lo = mid;
      else hi = mid;
    }
    return lerp(ROUTE.ss[lo], ROUTE.ss[hi], (p - ps[lo]) / (ps[hi] - ps[lo] || 1));
  }
  function dpds(s) {
    const a = ROUTE.anchors;
    for (let k = 0; k < a.length - 1; k++) if (s <= a[k + 1].s) return (a[k + 1].p - a[k].p) / (a[k + 1].s - a[k].s || 1);
    return 0;
  }

  // ---------- カメラの向き ----------
  const camera = new THREE.PerspectiveCamera(TUNE.FOV_LANDSCAPE, 1, 0.05, 2000);
  const qTarget = new THREE.Quaternion(), qTmp = new THREE.Quaternion(), qEnc = new THREE.Quaternion();
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vDir = new THREE.Vector3();
  const mLook = new THREE.Matrix4(), ZERO = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
  const lookQuat = (dir, out) => out.setFromRotationMatrix(mLook.lookAt(ZERO, dir, UP));
  function routeTangent(s, out) {
    routePos(Math.min(ROUTE.len, s + 0.6), vA);
    routePos(Math.max(0, s - 0.6), vB);
    return out.subVectors(vA, vB).normalize();
  }
  // 見せたいもの（target）を、画面の (x, y) に置く向き。中央が 0、右と上が +1（1 を超えると画面の外）
  function lookAtNdc(camPos, target, x, y, out) {
    lookQuat(vDir.subVectors(target, camPos).normalize(), out);
    out.multiply(qTmp.setFromAxisAngle(AY, Math.atan(x * FI.th)));
    return out.multiply(qTmp.setFromAxisAngle(AX, -Math.atan(y * FI.tv)));
  }
  // 着いた場所を見る向き：見せたいものを画面の決まった場所（FI.focus）に置く
  function encounterQuat(camPos, st, out) {
    const f = st.lk.kind === "gate" ? { x: 0, y: FI.portrait ? FI.focus.y : 0.02 } : FI.focus; // 縦長：上の数字と下の説明のあいだ
    return lookAtNdc(camPos, st.focus, f.x, f.y, out);
  }
  // 弧の上の向き。スイングバイは天体を画面の右はしに置いたまま回る（縁が流れ、空が回る）。回りこむときは機体を見つづける
  function orbitQuat(camPos, st, out) {
    const o = st.lk.swing === "gravity" ? FI.orbit : FI.around;
    return lookAtNdc(camPos, st.center, o.x, o.y, out);
  }
  // [wE, wO]：wE＝着いた場所を見る、wO＝弧の上で回りながら見る。着く前に向き始め、E→弧の入口で「回る向き」へ移り、弧のあとで前へ向き直る
  function lookWeights(st, s) {
    if (s < st.sE - st.win) return [0, 0];
    if (s <= st.sE) return [smooth01((s - (st.sE - st.win)) / st.win), 0];
    if (st.lk.kind === "gate") {
      const hold = st.sE + 0.4 * st.g.e, end = st.sE + st.g.e + 3;
      return [s <= hold ? 1 : s >= end ? 0 : 1 - smooth01((s - hold) / (end - hold)), 0];
    }
    const toArc = smooth01((s - st.sE) / Math.max(0.1, st.sA - st.sE));
    const hold = st.sA + 0.6 * (st.sX - st.sA), end = st.sX + st.wout;
    const wO = s <= hold ? toArc : s >= end ? 0 : 1 - smooth01((s - hold) / (end - hold));
    return [1 - toArc, wO];
  }
  // スイングバイの弧で、曲がる向きへ傾ける
  function bankAt(s) {
    let r = 0;
    for (const st of ROUTE.stops) {
      const L = st.sX - st.sA;
      if (!(L > 0)) continue;
      const u = (s - (st.sA - 0.35 * L)) / (1.7 * L);
      if (u > 0 && u < 1) r -= TUNE.BANK * st.lk.bank * Math.sin(Math.PI * u);
    }
    return r;
  }
  function cameraQuat(s, camPos, out) {
    lookQuat(routeTangent(s, vDir), out);
    const sp = FI.startPitch * (1 - smooth01((routeP(s) - P0) / 0.6));
    if (sp > 1e-4) out.multiply(qTmp.setFromAxisAngle(AX, -sp));
    for (const st of ROUTE.stops) {
      const [wE, wO] = lookWeights(st, s);
      if (wO > 0) out.slerp(orbitQuat(camPos, st, qEnc), wO);
      if (wE > 0) out.slerp(encounterQuat(camPos, st, qEnc), wE);
    }
    if (!reduce) {
      const r = bankAt(s);
      if (r) out.multiply(qTmp.setFromAxisAngle(AZ, r));
    }
    return out;
  }

  // ---------- 景色 ----------
  function flatMat(hex, opacity = 1) {
    return new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(hex) }, uAlpha: { value: opacity } },
      vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAlpha; void main(){ gl_FragColor = vec4(uColor, uAlpha); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }
  function glowMesh(hex, opacity) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(hex) }, uAlpha: { value: opacity } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv;
          void main(){ float r = length(vUv - 0.5) * 2.0; float a = r < 0.18 ? mix(1.0, 0.25, r / 0.18) : 0.25 * pow(max(0.0, 1.0 - (r - 0.18) / 0.82), 1.6);
            gl_FragColor = vec4(uColor * a * uAlpha, 1.0); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    m.userData.base = opacity;
    return m;
  }

  // 背景の星雲：方向ごとの色を1回だけ GPU で描いて、空の球に貼る（スイングバイで向きが変わると空が回る）。
  // 描いたものは WebGL が失われると消えるので、戻ったら描き直す
  function makeNebula() {
    const rt = new THREE.WebGLRenderTarget(2048, 1024, { depthBuffer: false });
    const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    scene.add(
      new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
          fragmentShader: `${NOISE}
            varying vec2 vUv;
            float fbm6(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
            void main(){
              float phi = vUv.x * 6.2831853, th = (1.0 - vUv.y) * 3.14159265;
              vec3 d = vec3(-cos(phi) * sin(th), cos(th), sin(phi) * sin(th));
              vec3 pole = normalize(vec3(0.52, 0.7, 0.48));
              vec3 q = d * 2.4;
              float dust = fbm6(q + fbm6(q * 1.8) * 0.9);
              float small = fbm6(q * 5.0 + 7.0);
              float along = dot(d, normalize(cross(pole, vec3(0.0, 0.0, 1.0))));
              float band = exp(-pow((dot(d, pole) + 0.07 * sin(along * 5.0)) * 3.4, 2.0));
              float lanes = smoothstep(0.32, 0.68, dust);
              float veins = pow(abs(small - 0.45) * 2.0, 1.8);
              vec3 col = vec3(0.009, 0.024, 0.052);
              col += vec3(0.075, 0.19, 0.215) * band * lanes;
              col += vec3(0.09, 0.13, 0.12) * band * band * small * 0.55;
              col *= 1.0 - band * smoothstep(0.48, 0.67, dust) * 0.5;
              col += vec3(0.11, 0.08, 0.035) * band * band * band * veins * 0.5;
              col += vec3(0.015, 0.05, 0.055) * smoothstep(0.55, 0.8, fbm6(q * 0.9 + 11.0));
              col += vec3(0.05, 0.035, 0.02) * smoothstep(0.6, 0.85, fbm6(q * 1.1 + 23.0));
              float tiny = step(0.995, hash(floor(d * 300.0))) * (0.25 + 0.5 * hash(floor(d * 300.0) + 3.0));
              col += vec3(0.6, 0.7, 0.75) * tiny * 0.35;
              gl_FragColor = vec4(col, 1.0);
            }`,
          depthTest: false,
          depthWrite: false,
        }),
      ),
    );
    const draw = () => {
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
    };
    draw();
    return { texture: rt.texture, draw };
  }

  // 地球の陸地（経度・緯度の多角形。日本のまわりだけ少しくわしく。地図は演出用の大まかな形）
  function landTexture() {
    const c = document.createElement("canvas");
    c.width = 2048;
    c.height = 1024;
    const x = c.getContext("2d");
    x.fillStyle = "#000";
    x.fillRect(0, 0, 2048, 1024);
    x.fillStyle = "#fff";
    const land = [
      [[-168, 65], [-150, 70], [-130, 70], [-116, 74], [-96, 80], [-78, 72], [-58, 53], [-64, 44], [-79, 26], [-88, 19], [-81, 9], [-97, 17], [-105, 23], [-116, 30], [-124, 47], [-138, 58], [-153, 59]],
      [[-80, 11], [-65, 9], [-51, 3], [-35, -7], [-40, -21], [-52, -35], [-68, -55], [-76, -43], [-72, -18], [-81, -4]],
      [[-53, 60], [-43, 61], [-20, 75], [-30, 82], [-48, 84], [-62, 76]],
      [[-10, 36], [-9, 44], [-1, 49], [5, 54], [7, 61], [20, 70], [32, 69], [35, 60], [49, 57], [61, 63], [80, 72], [112, 73], [140, 69], [170, 60], [160, 58], [156, 51], [143, 53], [141, 47], [135, 43], [130, 42.5], [129.7, 40.5], [128.4, 38.6], [129.4, 35.5], [126.6, 34.5], [126.1, 37.7], [124.6, 40], [121.5, 39], [122.5, 37], [119.5, 35], [121.9, 31], [120, 26], [117, 23.5], [110, 21], [108, 9], [99, 5], [91, 20], [81, 8], [73, 18], [64, 24], [56, 17], [45, 13], [37, 26], [28, 37], [19, 40], [13, 43], [8, 39], [0, 36]],
      [[-17, 15], [-16, 28], [-4, 36], [15, 32], [31, 31], [36, 20], [51, 12], [43, 0], [39, -16], [29, -34], [19, -35], [12, -17], [5, -5], [-9, 5]],
      [[114, -22], [124, -14], [139, -12], [150, -23], [153, -35], [135, -39], [117, -34]],
      [[46, -13], [50, -17], [47, -25], [44, -24]],
      [[96, 5], [106, -6], [114, -8], [120, -5], [131, -4], [139, -8], [148, -8], [140, -3], [121, 3], [113, 7], [108, 1]],
      [[-180, -74], [-130, -72], [-90, -70], [-60, -64], [-30, -76], [0, -70], [50, -69], [100, -66], [160, -72], [180, -74], [180, -90], [-180, -90]],
      // 本州・北海道・九州・四国
      [[130.9, 34.0], [131.3, 34.4], [132.4, 35.4], [133.6, 35.5], [135.2, 35.7], [136.0, 36.2], [136.8, 37.2], [137.3, 36.9], [138.2, 37.0], [138.6, 37.8], [139.4, 38.3], [139.9, 39.0], [140.0, 39.9], [139.9, 40.6], [140.3, 41.2], [141.2, 41.2], [141.5, 40.5], [142.0, 39.6], [141.6, 38.4], [141.0, 38.0], [141.0, 36.9], [140.6, 36.0], [140.9, 35.7], [140.4, 35.1], [139.8, 34.9], [139.2, 35.2], [138.8, 34.6], [138.2, 34.6], [137.2, 34.6], [136.8, 34.3], [136.0, 33.4], [135.2, 33.7], [135.1, 34.3], [134.2, 34.6], [133.0, 34.3], [132.0, 33.9], [131.0, 33.9]],
      [[140.0, 41.5], [140.1, 42.3], [139.8, 42.6], [140.5, 43.3], [141.4, 43.2], [141.6, 44.4], [141.9, 45.4], [142.9, 44.6], [143.8, 44.2], [144.8, 43.9], [145.3, 44.3], [145.6, 43.3], [144.3, 42.9], [143.3, 42.0], [141.2, 42.6], [140.9, 41.6]],
      [[129.8, 33.3], [130.4, 33.9], [131.0, 33.9], [131.6, 33.4], [131.9, 32.6], [131.4, 31.4], [130.7, 31.0], [130.2, 31.3], [130.1, 32.1], [129.6, 32.7]],
      [[132.4, 33.0], [132.7, 33.8], [133.5, 34.2], [134.6, 34.2], [134.7, 33.8], [134.2, 33.3], [133.1, 32.7]],
    ];
    for (const pts of land) {
      x.beginPath();
      pts.forEach(([lon, lat], i) => {
        const px = ((lon + 180) / 360) * 2048, py = ((90 - lat) / 180) * 1024;
        if (i) x.lineTo(px, py);
        else x.moveTo(px, py);
      });
      x.closePath();
      x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearFilter;
    return t;
  }

  // 探査機の模型（models.js）。いちばん長い辺が 2 になるように作ってある（userData.normalizedSize）。部品を InstancedMesh でまとめているので、
  // r128 の Box3.setFromObject では大きさを測れない。いちばん長い辺 = 2R になるように、R 倍するだけにする
  // 光に合わせた質感（試作 2026-10-04）：宇宙の暗さに合わせて映り込みを少し控え、金の断熱材のしわを少し強く、白い面は少し粗くする
  function naturalKit(K) {
    for (const m of Object.values(K)) if (m.isMaterial && m !== K.mirror) m.envMapIntensity *= 0.7;
    K.gold.bumpScale = 0.009;
    K.gold.roughness = 0.36;
    K.white.roughness = 0.62;
    K.solar.roughness = 0.26;
  }
  function holdModel(g, R) {
    const holder = new THREE.Group();
    holder.add(g);
    holder.scale.setScalar(R);
    holder.userData.inner = g;
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return holder;
  }

  renderer.setClearColor(0x050e1f, 1);
  renderer.autoClear = false;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; // 模型の影（主光の1つだけ。見ている模型のまわりだけを測る）
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const skyScene = new THREE.Scene();
  const mainScene = new THREE.Scene();
  mainScene.add(camera);

  // 空：星雲（方向で決まる色）と遠くの星。カメラの位置について回り、向きは世界に固定
  const skyGroup = new THREE.Group();
  skyScene.add(skyGroup);
  const nebula = makeNebula();
  const neb = new THREE.Mesh(
    new THREE.SphereGeometry(900, 64, 32),
    new THREE.ShaderMaterial({
      uniforms: { map: { value: nebula.texture } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D map; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(map, vUv).rgb, 1.0); }`,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  neb.renderOrder = 0;
  skyGroup.add(neb);
  let skyStars;
  {
    const n = TUNE.SKY_STARS, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * r * 700, u * 700, Math.sin(a) * r * 700], i * 3);
      const t = Math.random();
      col.set(t < 0.12 ? [1, 0.82, 0.55] : t < 0.3 ? [0.62, 0.95, 0.85] : [0.85, 0.9, 1], i * 3);
      size[i] = Math.random() < 0.06 ? 2.4 + Math.random() * 1.2 : 0.9 + Math.random() * 1.1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    skyStars = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 1 }, uTime: { value: 0 } },
        vertexShader: `uniform float uScale, uTime; attribute vec3 aColor; attribute float aSize; varying vec3 vC; varying float vA;
          void main(){ vC = aColor; vA = 0.55 + 0.45 * sin(uTime * 1.3 + position.x * 0.05 + position.y * 0.03); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale; }`,
        fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vC, smoothstep(0.5, 0.0, d) * vA); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    skyStars.renderOrder = 1;
    skyGroup.add(skyStars);
  }

  // 地球：出発のときだけ前の下に見える。本当の見かけの大きさで、うしろへ遠ざかる（空の一部として描く）
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { uLand: { value: landTexture() }, uSun: { value: new THREE.Vector3(0, -0.2, -1).normalize() }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vObj, vN, vV; varying vec2 vUv;
      void main(){ vUv = uv; vObj = position; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `${NOISE}
      uniform sampler2D uLand; uniform vec3 uSun; uniform float uTime; varying vec3 vObj, vN, vV; varying vec2 vUv;
      void main(){
        vec3 n = normalize(vN), v = normalize(vV);
        float d = dot(n, uSun);
        float lit = smoothstep(-0.1, 0.4, d);
        float terrain = fbm(vObj * 9.0);
        vec2 wob = (vec2(fbm(vObj * 40.0), fbm(vObj * 37.0 + 3.0)) - 0.5) * 0.006;
        float land = smoothstep(0.42, 0.58, texture2D(uLand, vUv + wob).r + (fbm(vObj * 90.0) - 0.5) * 0.45);
        vec3 sea = mix(vec3(0.010, 0.035, 0.080), vec3(0.040, 0.110, 0.180), terrain);
        vec3 ground = mix(vec3(0.060, 0.120, 0.090), vec3(0.230, 0.280, 0.180), terrain);
        vec3 col = mix(sea, ground, land);
        float cloud = smoothstep(0.52, 0.72, fbm(vObj * 6.0 + vec3(uTime * 0.003, 0.0, 0.0) + fbm(vObj * 3.5) * 1.6));
        col = mix(col, vec3(0.78, 0.86, 0.88), cloud * 0.85);
        col *= 0.02 + 1.1 * lit;
        float night = 1.0 - smoothstep(-0.12, 0.08, d);
        float city = step(0.86, noise(vObj * 300.0)) * smoothstep(0.42, 0.68, noise(vObj * 52.0)) * land * night * (1.0 - cloud * 0.8);
        col += vec3(1.0, 0.58, 0.2) * city * 0.95;
        col += vec3(0.6, 0.75, 0.7) * pow(max(dot(reflect(-uSun, n), v), 0.0), 40.0) * (1.0 - land) * (1.0 - cloud) * lit * 0.4;
        float fres = pow(1.0 - max(dot(n, v), 0.0), 7.0);
        col += vec3(0.18, 0.5, 0.72) * fres * (0.25 + 0.75 * smoothstep(-0.3, 0.3, d));
        gl_FragColor = vec4(col, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), earthMat);
  earth.renderOrder = 2;
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 64),
    new THREE.ShaderMaterial({
      uniforms: { uSun: earthMat.uniforms.uSun },
      vertexShader: `varying vec3 vN, vV; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform vec3 uSun; varying vec3 vN, vV;
        void main(){ vec3 n = normalize(vN); float edge = pow(max(0.0, 1.0 + dot(n, normalize(vV))), 4.0); float day = 0.3 + 0.7 * smoothstep(-0.35, 0.25, dot(n, uSun));
          gl_FragColor = vec4(vec3(0.33, 0.78, 0.95) * edge * day * 0.9, 1.0); }`,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  atmo.renderOrder = 3;
  skyScene.add(earth, atmo);
  // 地平線の向こうの夜明けの光
  const dawn = glowMesh(0xffc88a, 0.9);
  dawn.renderOrder = 4;
  skyScene.add(dawn);
  // 日本が足もとに来るように地球を回しておく（東へ向かって出発する）
  {
    const lon = 138.5, lat = 36.5, phi = ((lon + 180) / 360) * Math.PI * 2, th = (90 - lat) * DEG;
    const local = new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
    const q = new THREE.Quaternion().setFromUnitVectors(local, new THREE.Vector3(0, 1, 0));
    const north = new THREE.Vector3(0, 1, 0).addScaledVector(local, -local.y).normalize().applyQuaternion(q);
    const yaw = Math.atan2(north.z, north.x) - Math.PI; // 北を左（-x）へ。東が前（-z）になる
    earth.userData.q0 = new THREE.Quaternion().setFromAxisAngle(AY, yaw).multiply(q);
  }

  // 流れる星：カメラのまわりの箱にくり返し置く（どの向きに飛んでも流れる）。速いほど長い線
  let starMat;
  {
    const N = TUNE.STAR_COUNT, BOX = 180;
    const seg = new Float32Array(N * 6), tail = new Float32Array(N * 2), scol = new Float32Array(N * 6), head = new Float32Array(N * 3), hcol = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const x = Math.random() * BOX, y = Math.random() * BOX, z = Math.random() * BOX, t = Math.random();
      const c3 = t < 0.12 ? [1, 0.82, 0.55] : t < 0.3 ? [0.62, 0.95, 0.85] : [0.85, 0.9, 1];
      seg.set([x, y, z, x, y, z], i * 6);
      tail.set([0, 1], i * 2);
      scol.set([...c3, ...c3], i * 6);
      head.set([x, y, z], i * 3);
      hcol.set(c3, i * 3);
    }
    starMat = new THREE.ShaderMaterial({
      uniforms: { uCam: { value: new THREE.Vector3() }, uVel: { value: new THREE.Vector3() }, uBox: { value: BOX }, uScale: { value: 1 }, uTime: { value: 0 } },
      vertexShader: `uniform vec3 uCam, uVel; uniform float uBox, uScale, uTime; attribute vec3 aColor; attribute float aTail; varying vec3 vC; varying float vA;
        void main(){
          vec3 rel = mod(position - uCam, uBox) - 0.5 * uBox;
          float d = length(rel);
          vec4 mv = viewMatrix * vec4(uCam + rel - uVel * aTail, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = 0.75 + 0.25 * sin(uTime * 1.7 + position.x * 3.1 + position.y * 1.3);
          vA = smoothstep(0.5 * uBox, 0.3 * uBox, d) * smoothstep(1.5, 4.5, d) * (1.0 - aTail * 0.92) * tw;
          vC = aColor;
          gl_PointSize = clamp(uScale * 22.0 / max(-mv.z, 0.1), 1.0, 4.0);
        }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ gl_FragColor = vec4(vC, vA * 0.9); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(seg, 3));
    lg.setAttribute("aTail", new THREE.BufferAttribute(tail, 1));
    lg.setAttribute("aColor", new THREE.BufferAttribute(scol, 3));
    const lines = new THREE.LineSegments(lg, starMat);
    lines.frustumCulled = false;
    mainScene.add(lines);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(head, 3));
    pg.setAttribute("aTail", new THREE.BufferAttribute(new Float32Array(N), 1));
    pg.setAttribute("aColor", new THREE.BufferAttribute(hcol, 3));
    const pointMat = starMat.clone();
    pointMat.uniforms = starMat.uniforms;
    pointMat.fragmentShader = `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vC, vA * smoothstep(0.5, 0.0, d)); }`;
    const pts = new THREE.Points(pg, pointMat);
    pts.frustumCulled = false;
    mainScene.add(pts);
  }

  // 天体（月・水星・火星・木星は1つの式で描き分ける。太陽は光る式）。停留所ごとに1つ作る
  const bodyVS = `varying vec3 vO, vN, vV; void main(){ vO = position; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`;
  const BODY_KIND = { moon: 1, mercury: 2, mars: 3, jupiter: 4 };
  const bodyMat = (kind) =>
    new THREE.ShaderMaterial({
      uniforms: { uKind: { value: kind }, uLight: { value: new THREE.Vector3(0, 0, 1) }, uAlpha: { value: 1 } },
      vertexShader: bodyVS,
      fragmentShader: `${NOISE}
        uniform float uKind, uAlpha; uniform vec3 uLight; varying vec3 vO, vN, vV;
        void main(){
          vec3 N = normalize(vN), V = normalize(vV);
          float nl = dot(N, uLight), lit = smoothstep(-0.06, 0.55, nl);
          vec3 col;
          if (uKind < 1.5) {
            float maria = smoothstep(0.35, 0.59, fbm(vO * 4.0));
            float pits = 1.0 - smoothstep(0.1, 0.27, noise(vO * 54.0));
            col = mix(vec3(0.23, 0.28, 0.30), vec3(0.55, 0.58, 0.55), maria);
            col *= 0.68 + fbm(vO * 23.0) * 0.5 + noise(vO * 180.0) * 0.08 - pits * 0.2;
          } else if (uKind < 2.5) {
            float craters = 1.0 - smoothstep(0.08, 0.24, noise(vO * 40.0));
            col = mix(vec3(0.30, 0.28, 0.26), vec3(0.62, 0.58, 0.53), fbm(vO * 6.0));
            col *= 0.75 + fbm(vO * 30.0) * 0.4 - craters * 0.22;
          } else if (uKind < 3.5) {
            float dark = smoothstep(0.5, 0.7, fbm(vO * 2.2 + 4.0));
            col = mix(vec3(0.46, 0.17, 0.07), vec3(0.80, 0.42, 0.20), fbm(vO * 3.2));
            col = mix(col, vec3(0.28, 0.12, 0.07), dark * 0.6);
            float cap = smoothstep(0.86, 0.93, abs(normalize(vO).y) + fbm(vO * 8.0) * 0.05);
            col = mix(col, vec3(0.92, 0.90, 0.86), cap);
            col *= 0.85 + fbm(vO * 24.0) * 0.3;
          } else {
            // 木星：緯度にそった縞（明るい帯と暗い帯）。太さの違う縞を重ね、境目を少し乱す（演出の絵）
            vec3 u = normalize(vO);
            float f = u.y * 17.0 + (fbm(vec3(u.x * 3.0, u.y * 10.0, u.z * 3.0)) - 0.5) * 1.8;
            float band = 0.55 * sin(f) + 0.3 * sin(f * 2.3 + 1.7) + 0.15 * sin(f * 5.1 + 0.4);
            col = mix(vec3(0.46, 0.35, 0.26), vec3(0.72, 0.66, 0.57), smoothstep(-0.45, 0.55, band));
            col = mix(col, vec3(0.56, 0.48, 0.40), smoothstep(0.55, 0.95, abs(u.y)) * 0.8);
            col *= 0.86 + fbm(vO * 14.0 + vec3(0.0, u.y * 6.0, 0.0)) * 0.26;
          }
          col *= 0.035 + 1.15 * lit;
          float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          vec3 rimC = uKind > 3.5 ? vec3(0.95, 0.82, 0.66) : uKind > 2.5 ? vec3(1.0, 0.55, 0.35) : vec3(0.55, 0.7, 0.9);
          col += rimC * rim * (0.06 + 0.5 * max(nl, 0.0)) * (uKind > 3.5 ? 0.6 : uKind > 2.5 ? 0.9 : 0.35);
          gl_FragColor = vec4(col, uAlpha);
        }`,
      transparent: true,
    });
  const sunMat = () =>
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 } },
      vertexShader: bodyVS,
      fragmentShader: `${NOISE}
        uniform float uTime, uAlpha; varying vec3 vO, vN, vV;
        void main(){
          float n = fbm(vO * 5.0 + vec3(uTime * 0.12, uTime * 0.07, 0.0));
          float mu = max(dot(normalize(vN), normalize(vV)), 0.0);
          vec3 c = mix(vec3(1.0, 0.48, 0.12), vec3(1.0, 0.93, 0.74), pow(mu, 0.6));
          c *= 0.88 + 0.3 * (n - 0.5);
          gl_FragColor = vec4(c * 1.15, uAlpha);
        }`,
      transparent: true,
    });
  const sphere = new THREE.SphereGeometry(1, 64, 40);
  const bodyMeshes = new Map(); // 停留所の id → 天体
  function bodyFor(st) {
    let m = bodyMeshes.get(st.pl.id);
    if (!m || m.userData.body !== st.lk.body) {
      if (m) mainScene.remove(m);
      m = new THREE.Mesh(sphere, st.lk.body === "sun" ? sunMat() : bodyMat(BODY_KIND[st.lk.body]));
      m.userData.body = st.lk.body;
      mainScene.add(m);
      bodyMeshes.set(st.pl.id, m);
    }
    return m;
  }
  const sunGlows = [];
  for (const [hex, k, o] of [[0xfff0c8, 3.0, 1.6], [0xffb547, 6.2, 0.9], [0xff7a2e, 13, 0.4]]) {
    const gm = glowMesh(hex, o);
    gm.userData.k = k;
    sunGlows.push(gm);
    mainScene.add(gm);
  }

  // 探査機の模型（公式を参考にしたイメージ）。停留所ごとに1つ作る（ボイジャーは2号と、1光日のそばの1号で2つ）
  const kit = makeKit(THREE);
  naturalKit(kit);
  const holders = new Map(); // 停留所の id → 模型
  function holderFor(st) {
    let h = holders.get(st.pl.id);
    if (!h || h.userData.model !== st.lk.model) {
      if (h) mainScene.remove(h);
      h = holdModel(MODELS[st.lk.model](THREE, kit), st.lk.mR ?? st.lk.R);
      h.userData.model = st.lk.model;
      mainScene.add(h);
      holders.set(st.pl.id, h);
    }
    return h;
  }
  // 光：太陽の光らしい白い主光（影をつくる）と、弱い補助光。補助光はカメラについて回り、主光も「カメラから見て左上の前」の向きを保つ。
  // 主光の影は、見ている模型のまわりだけを測る（render で毎回置き直す）
  camera.add(new THREE.AmbientLight(0xc9d6e6, 0.12));
  for (const [hex, inten, from] of [[0xffcf9a, 0.55, [5, 2, -4]], [0x5ef2c2, 0.12, [-6, -2, 1]]]) {
    const L = new THREE.DirectionalLight(hex, inten);
    L.position.set(...from);
    camera.add(L);
    L.target.position.set(0, 0, 0);
    camera.add(L.target);
  }
  const keyLight = new THREE.DirectionalLight(0xfff2e2, 2.6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.bias = -0.0005;
  mainScene.add(keyLight, keyLight.target);

  // 1光日の輪（アンバー）
  const gate = new THREE.Group();
  {
    const ringMat = flatMat(0xffb547, 0.95);
    gate.add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.0075, 8, 220), ringMat));
    gate.add(new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.003, 6, 220), ringMat));
    const ticks = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2, r0 = i % 6 ? 1.02 : 0.95, r1 = 1.06;
      ticks.push(Math.cos(a) * r0, Math.sin(a) * r0, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.Float32BufferAttribute(ticks, 3));
    gate.add(new THREE.LineSegments(tg, flatMat(0xffb547, 0.8)));
    const halo = glowMesh(0xffb547, 0.1);
    halo.scale.setScalar(3.2);
    gate.add(halo);
    gate.userData.halo = halo;
  }
  mainScene.add(gate);

  // ニュー・ホライズンズのあたりに、うすい氷のちり（カイパーベルトの雰囲気。演出）
  let dust;
  {
    const n = 600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 3 + 34 * Math.cbrt(Math.random());
      pos.set([Math.cos(a) * Math.sqrt(1 - u * u) * r, u * r * 0.45, Math.sin(a) * Math.sqrt(1 - u * u) * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dust = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: { uAlpha: { value: 0 }, uScale: { value: 1 } },
        vertexShader: `uniform float uScale; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uScale * 16.0 / -mv.z, 1.0, 3.5); }`,
        fragmentShader: `uniform float uAlpha; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.75, 0.84, 0.92), uAlpha * smoothstep(0.5, 0.0, d)); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    mainScene.add(dust);
  }

  // 航路の点線（これから進む道。足もとの少し下に描く）
  const routeMat = new THREE.ShaderMaterial({
    uniforms: { uS: { value: 0 }, uAlpha: { value: 0.5 }, uScale: { value: 1 } },
    vertexShader: `uniform float uS, uScale; attribute float aS; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        vA = smoothstep(uS + 1.5, uS + 6.0, aS) * (1.0 - smoothstep(uS + 48.0, uS + 80.0, aS));
        gl_PointSize = clamp(uScale * 7.0 / max(-mv.z, 0.1), 1.0, 5.0); }`,
    fragmentShader: `uniform float uAlpha; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.37, 0.95, 0.76, vA * uAlpha * smoothstep(0.5, 0.15, d)); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  let routePts = null;

  // 火星の地面を見る望遠の窓（別の小さな景色。四角い範囲に描き、丸い枠を重ねる）
  const lensScene = new THREE.Scene();
  const lensCam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  lensCam.position.set(5.6, 3.5, 8.4);
  lensCam.lookAt(0, -0.25, 0);
  lensScene.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }`,
        fragmentShader: `varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; if (r > 1.0) discard;
          vec3 sky = mix(vec3(0.20, 0.10, 0.07), vec3(0.03, 0.05, 0.10), smoothstep(-0.2, 0.9, vUv.y));
          gl_FragColor = vec4(sky, 1.0); }`,
        depthWrite: false,
        depthTest: false,
      }),
    ),
  );
  lensScene.children[0].renderOrder = -1;
  // 火星の地面と、パーサヴィアランス（公式を参考にしたイメージ）。太陽の光が、地面に影を落とす
  const rover = holdModel(MODELS.perseverance(THREE, kit), 1.45);
  {
    const roverInner = rover.userData.inner, half = (roverInner.userData.normalizedSize[1] * rover.scale.y) / 2;
    rover.rotation.y = rover.userData.spin = roverInner.userData.pose[1];
    lensScene.add(rover);
    const soil = new THREE.MeshStandardMaterial({ color: 0x7c4128, roughness: 1, metalness: 0 });
    soil.color.convertSRGBToLinear();
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.75, 0.12, 64), soil);
    ground.position.y = -half - 0.06;
    ground.receiveShadow = true;
    lensScene.add(ground);
    for (let i = 0; i < 18; i++) {
      const a = i * 2.399, r = 1.25 + (i % 3) * 0.32;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.03 + (i % 4) * 0.02, 0), soil);
      rock.position.set(Math.cos(a) * r, -half + 0.01, Math.sin(a) * r);
      rock.castShadow = rock.receiveShadow = true;
      lensScene.add(rock);
    }
    lensScene.add(new THREE.HemisphereLight(0xe2b68c, 0x5a2814, 0.42));
    const lensKey = new THREE.DirectionalLight(0xfff0dc, 2.3);
    lensKey.position.set(-3, 6, 3);
    lensKey.castShadow = true;
    lensKey.shadow.mapSize.set(1024, 1024);
    Object.assign(lensKey.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 });
    lensKey.shadow.bias = -0.0005;
    lensKey.shadow.normalBias = 0.02;
    lensScene.add(lensKey);
  }

  // 航路と景色の置き場所を、画面の形と停留所に合わせて作り直す
  function placeScene() {
    FI = frameInfo();
    root.style.setProperty("--band-bottom", `${FI.bandBottom}px`);
    ROUTE = buildRoute();
    // 航路の点
    if (routePts) {
      mainScene.remove(routePts);
      routePts.geometry.dispose();
    }
    {
      const pos = [], as = [], v = new THREE.Vector3();
      for (let s = 0; s <= ROUTE.len; s += 1.25) {
        routePos(s, v);
        pos.push(v.x, v.y - 0.85, v.z);
        as.push(s);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("aS", new THREE.Float32BufferAttribute(as, 1));
      routePts = new THREE.Points(g, routeMat);
      routePts.frustumCulled = false;
      mainScene.add(routePts);
    }
    const q = new THREE.Quaternion(), e = new THREE.Euler();
    for (const st of ROUTE.stops) {
      const lk = st.lk;
      encounterQuat(st.E, st, q); // 着いたときのカメラの向き
      st.qE = q.clone();
      st.objects = [];
      if (lk.body) {
        const b = bodyFor(st);
        b.position.copy(st.center);
        b.scale.setScalar(lk.R);
        if (b.material.uniforms.uLight) b.material.uniforms.uLight.value.set(-0.8, 0.5, 0.45).applyQuaternion(q).normalize(); // 左上の前から照らす
        st.objects.push(b);
        if (lk.body === "sun")
          for (const gm of sunGlows) {
            gm.position.copy(st.center);
            gm.scale.setScalar(lk.R * gm.userData.k);
            st.objects.push(gm);
          }
      }
      if (lk.model) {
        const holder = holderFor(st);
        holder.position.copy(st.focus);
        if (lk.mOff) holder.position.addScaledVector(st.right, lk.mOff[0]).addScaledVector(st.axis, lk.mOff[1]).addScaledVector(st.dirIn, -lk.mOff[2]); // 右・上・手前へずらす
        const inner = holder.userData.inner;
        holder.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(e.set(...(lk.mPose ?? inner.userData.pose))));
        st.model = holder;
        st.objects.push(holder);
        // 回りこんで見るときの中心（模型）と、引く量（どの向きから見ても、模型の全体が着いたときの円に収まるように）
        st.pivot = holder.position;
        const [sx, sy, sz] = inner.userData.normalizedSize;
        st.lookOut = Math.max(1, 0.5 * Math.hypot(sx, sy, sz));
      } else {
        st.pivot = st.focus; // 天体だけ：球なので、どの向きでも同じ大きさ
        st.lookOut = 1;
      }
      if (lk.kind === "gate") {
        gate.position.copy(st.center);
        gate.scale.setScalar(lk.R * (FI.portrait ? 0.72 : 1)); // 縦長：輪を小さくして、上の数字と下の名前にかからないようにする
        gate.quaternion.setFromUnitVectors(AZ, st.normal);
        st.objects.push(gate);
      }
      if (lk.dust) {
        dust.position.copy(st.focus);
        st.objects.push(dust);
      }
    }
    $("chapter-total").textContent = String(total).padStart(2, "0");
  }

  // ---------- 状態 ----------
  let s = 0; // 航路の上の位置（3D の単位）
  let v = 0; // 速さ（単位/秒。+ が遠くへ）
  let trip = null; // 案内つきの飛行 { from, to, t0, dur, target }
  let pointer = null;
  const look = { yaw: 0, pitch: 0, yawTo: 0, st: null }; // そばで観測中：ドラッグで回りこんで見る角度（ラジアン。yawTo はキーで回すときの行き先）と、その場所
  let snap = null; // 吸い寄せている場所
  let kickFov = 0;
  let lastT = performance.now(), raf = 0, visible = false, running = false, started = false;
  let announced = "";
  let ctxLost = false;

  function cancelTrip() {
    trip = null;
  }
  function push(dv) {
    cancelTrip();
    snap = null;
    v = clamp(v + dv, -TUNE.MAX_V, TUNE.MAX_V);
    audio.wake();
    wake();
  }
  const nextStop = (from = s) => ROUTE.stops.find((st) => st.sE > from + 0.5) ?? null;
  const prevStop = (from = s) => [...ROUTE.stops].reverse().find((st) => st.sE < from - 0.5) ?? null;
  // target：停留所の番号／"home"（地表の近く）／"end"（1光日の先）
  function startTrip(to, target) {
    snap = null;
    pointer = null;
    const dist = Math.abs(to - s);
    if (reduce || dist < 0.01) {
      s = to;
      v = 0;
      trip = null;
      arrive(target);
      wake();
      return;
    }
    const dur = target === "home" ? TUNE.TRIP_MAX : clamp(TUNE.TRIP_MIN + dist * TUNE.TRIP_PER_UNIT, TUNE.TRIP_MIN, TUNE.TRIP_MAX);
    trip = { from: s, to, t0: null, dur: dur * 1000, target };
    audio.sweep();
    wake();
  }
  function finishTrip() {
    if (!trip) return;
    const t = trip;
    trip = null;
    s = t.to;
    v = 0;
    arrive(t.target);
  }
  function arrive(target) {
    v = 0;
    if (target === "home") say("地表の近く（高さ100km）に戻りました。");
    else if (target === "end") {
      say("1光日の先に着きました。地球の輪の外は、桁が違う。");
      audio.ping(true);
    }
  }
  // 場所に着いたら知らせる（自由に飛んで止まったときも）
  function announce(st) {
    if (!st || announced === st.pl.id) return;
    announced = st.pl.id;
    const pl = st.pl;
    say(`${pl.name}。地球から${pl.sayDist}。光で${pl.lt}。${pl.text}${pl.sayEvent ? `。${pl.sayEvent}` : ""}`);
    audio.ping(pl.kind === "light-day");
  }

  // いまの様子：intro（地表の近く）／encounter（場所のそば）／swing（弧の上）／travel（案内つきで飛行中）／free（自由に飛行中）／rest（途中で止まっている）／end
  function modeNow() {
    const sw = ROUTE.stops.find((st) => st.lk.kind !== "gate" && s > st.sE + 0.6 && s < st.sX + 1);
    if (trip || (pointer && !pointer.look) || Math.abs(v) > 0.5) return { mode: sw ? "swing" : trip ? "travel" : "free", st: sw };
    if (s < 0.3) return { mode: "intro" };
    if (s > ROUTE.len - 0.3) return { mode: "end" };
    const st = ROUTE.stops.find((x) => Math.abs(s - x.sE) < 0.6);
    if (st) return { mode: "encounter", st };
    return { mode: "rest", st: sw };
  }

  // ---------- 操作：指・マウス・ホイール・キー（試作と同じ） ----------
  viewport.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const m = modeNow();
    if (m.mode === "encounter") {
      // そばで観測中：なぞると、見せたもののまわりを回りこんで見る（ここでは飛ばない。先へは「その先へ」のボタンで）
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, look: true };
      look.st = m.st;
      root.classList.add("looked");
    } else {
      cancelTrip();
      snap = null;
      pointer = { id: e.pointerId, y: e.clientY };
    }
    viewport.setPointerCapture(e.pointerId);
    wake();
  });
  viewport.addEventListener("pointermove", (e) => {
    if (!pointer || pointer.id !== e.pointerId) return;
    if (pointer.look) {
      const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      look.yaw = look.yawTo = look.yaw - dx * 0.008; // 右へなぞると、右へ回って見える
      look.pitch = clamp(look.pitch - dy * 0.006, -1.0, 1.0); // 下へなぞると、上から見下ろす
      wake();
      return;
    }
    // 下へなぞると遠くへ（宇宙を手前へ引き寄せる向き。2026-10-04 オーナー）。上へなぞると地球の方へ
    const dy = e.clientY - pointer.y;
    pointer.y = e.clientY;
    push(dy * TUNE.SWIPE_GAIN);
  });
  const endDrag = (e) => {
    if (pointer && pointer.id === e.pointerId) {
      pointer = null;
      wake();
    }
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("lostpointercapture", endDrag);
  viewport.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) return;
      if (s <= 0.01 && e.deltaY > 0 && v <= 0) return; // 地表で下へ回したら、ページを下へ（距離のはしごへ）
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewport.clientHeight : 1;
      push(-e.deltaY * unit * TUNE.WHEEL_GAIN);
    },
    { passive: false },
  );
  function onKey(e) {
    if (!running || isBlocked() || e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const r = root.getBoundingClientRect();
    if (r.bottom < innerHeight * 0.5 || r.top > innerHeight * 0.5) return; // 飛ぶ画面が半分より上・下へ外れているとき（はしごを見ているとき）は飛ばない
    const k = { ArrowUp: TUNE.KEY_PUSH, ArrowDown: -TUNE.KEY_PUSH, PageUp: TUNE.PAGE_PUSH, PageDown: -TUNE.PAGE_PUSH }[e.key];
    const turn = { ArrowLeft: 0.26, ArrowRight: -0.26 }[e.key];
    if (turn) {
      const m = modeNow();
      if (m.mode === "encounter") {
        e.preventDefault();
        look.st = m.st;
        look.yawTo += turn;
        root.classList.add("looked");
        wake();
      }
      return;
    }
    if (k) {
      e.preventDefault();
      if (reduce) keyStep(Math.sign(k));
      else push(k);
    } else if (e.key === "Home") {
      e.preventDefault();
      startTrip(0, "home");
    }
  }
  keyTarget.addEventListener("keydown", onKey);
  // 動きを減らす設定では、キー1回で隣の場所へすぐ移る
  function keyStep(dir) {
    if (dir > 0) {
      const st = nextStop();
      startTrip(st ? st.sE : ROUTE.len, st ? st.i : "end");
    } else {
      const st = prevStop();
      startTrip(st ? st.sE : 0, st ? st.i : "home");
    }
  }
  $("primary").addEventListener("click", () => {
    if (trip) {
      finishTrip();
      wake();
      return;
    }
    const m = modeNow();
    if (m.mode === "end") {
      startTrip(0, "home");
      return;
    }
    const st = nextStop();
    if (st) startTrip(st.sE, st.i);
    else startTrip(ROUTE.len, "end");
  });
  $("home").addEventListener("click", () => startTrip(0, "home"));
  $("details").addEventListener("click", () => {
    const id = modeNow().st?.pl.card;
    if (id) onDetails(id);
  });

  // ---------- 音（ブラウザの中で作る音だけ。最初は消しておく） ----------
  const audio = (() => {
    let ctx = null, master, hum, filt, noiseGain, noiseBuf, on = false;
    function startAudio() {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      hum = ctx.createOscillator();
      hum.type = "sawtooth";
      hum.frequency.value = 42;
      filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 220;
      const hg = ctx.createGain();
      hg.gain.value = 0.05;
      hum.connect(filt);
      filt.connect(hg);
      hg.connect(master);
      hum.start();
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 900;
      bp.Q.value = 0.7;
      noiseGain = ctx.createGain();
      noiseGain.gain.value = 0;
      src.connect(bp);
      bp.connect(noiseGain);
      noiseGain.connect(master);
      src.start();
    }
    return {
      toggle() {
        on = !on;
        if (on && !ctx) startAudio();
        if (ctx) {
          ctx.resume();
          master.gain.setTargetAtTime(on ? 0.22 : 0, ctx.currentTime, 0.08);
        }
        return on;
      },
      wake() {
        if (ctx && on) ctx.resume();
      },
      // 部屋を閉じたら止める（もう一度開いたら、音を出す設定のまま続ける）
      pause() {
        if (ctx && ctx.state === "running") ctx.suspend();
      },
      update(speedNorm, warp) {
        if (!ctx || !on) return;
        const t = ctx.currentTime;
        hum.frequency.setTargetAtTime(42 + speedNorm * 70, t, 0.1);
        filt.frequency.setTargetAtTime(220 + speedNorm * 900, t, 0.1);
        noiseGain.gain.setTargetAtTime(warp * 0.06, t, 0.15);
      },
      ping(gateHit = false) {
        if (!ctx || !on) return;
        const t = ctx.currentTime;
        for (const [f, dl] of gateHit ? [[392, 0], [587, 0.05], [784, 0.1]] : [[1046, 0], [1568, 0.06]]) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = gateHit ? "triangle" : "sine";
          o.frequency.value = f;
          g.gain.setValueAtTime(0, t + dl);
          g.gain.linearRampToValueAtTime(gateHit ? 0.18 : 0.12, t + dl + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dl + (gateHit ? 1.2 : 0.5));
          o.connect(g);
          g.connect(master);
          o.start(t + dl);
          o.stop(t + dl + 1.3);
        }
      },
      // スイングバイで飛び出すときの「ひゅうっ」
      whoosh() {
        if (!ctx || !on) return;
        const t = ctx.currentTime, src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = noiseBuf;
        bp.type = "bandpass";
        bp.Q.value = 1.4;
        bp.frequency.setValueAtTime(260, t);
        bp.frequency.exponentialRampToValueAtTime(1900, t + 0.35);
        bp.frequency.exponentialRampToValueAtTime(240, t + 1.1);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.2, t + 0.22);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        src.connect(bp);
        bp.connect(g);
        g.connect(master);
        src.start(t);
        src.stop(t + 1.25);
      },
      sweep() {
        if (!ctx || !on) return;
        const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(70, t);
        o.frequency.exponentialRampToValueAtTime(180, t + 1.4);
        o.frequency.exponentialRampToValueAtTime(50, t + 2.8);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.08, t + 0.8);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
        o.connect(g);
        g.connect(master);
        o.start(t);
        o.stop(t + 2.9);
      },
    };
  })();
  $("sound").addEventListener("click", (e) => {
    let on = false;
    try {
      on = audio.toggle();
    } catch {
      say("このブラウザでは音を出せません。");
    }
    e.currentTarget.setAttribute("aria-pressed", String(on));
    e.currentTarget.setAttribute("aria-label", on ? "音を消す" : "音を出す");
  });

  // ---------- 大きさ ----------
  const rulerCv = $("ruler"), rctx = rulerCv.getContext("2d"), rearCv = $("rear-cv"), rearCtx = rearCv.getContext("2d");
  let pixelRatio = Math.min(window.devicePixelRatio || 1, TUNE.PIXEL_RATIO_MAX), dpr = window.devicePixelRatio || 1;
  let rulerW = 1, rearS = 76;
  // 画面の形・停留所が変わったら、航路を作り直す。いまの場所（着いている停留所／距離）はそのまま
  let stopsChanged = false;
  function rebuild() {
    stopsChanged = false;
    const keepP = ROUTE ? routeP(s) : P0;
    const keepId = ROUTE ? ROUTE.stops.find((x) => Math.abs(s - x.sE) < 0.6)?.pl.id : undefined;
    const keepTrip = trip && ROUTE ? { p0: routeP(trip.from), id: typeof trip.target === "number" ? ROUTE.stops[trip.target]?.pl.id : null } : null;
    placeScene();
    const kept = keepId !== undefined ? ROUTE.stops.find((x) => x.pl.id === keepId) : null;
    s = kept ? kept.sE : routeS(keepP);
    if (keepTrip) {
      const to = keepTrip.id ? ROUTE.stops.find((x) => x.pl.id === keepTrip.id) : null;
      trip.from = routeS(keepTrip.p0);
      if (to) {
        trip.to = to.sE;
        trip.target = to.i;
      } else if (typeof trip.target === "number") trip = null; // 行き先がなくなった
      else trip.to = trip.target === "end" ? ROUTE.len : 0;
    }
    if (look.st) look.st = ROUTE.stops.find((x) => x.pl.id === look.st.pl.id) ?? null;
    if (snap) snap = null;
    started = false;
    uiKey = "";
    lastUi = 0;
  }
  function size() {
    if (!root.clientWidth || !root.clientHeight) return; // 部屋を閉じているあいだ
    dpr = window.devicePixelRatio || 1;
    rebuild();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(FI.W, FI.H, false);
    camera.aspect = FI.aspect;
    camera.fov = FI.vfov;
    camera.updateProjectionMatrix();
    rulerW = rulerCv.clientWidth || 1;
    rulerCv.width = rulerW * dpr;
    rulerCv.height = 34 * dpr;
    rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rearS = rearCv.clientWidth || 76;
    rearCv.width = rearS * dpr;
    rearCv.height = rearS * dpr;
    rearCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wake();
  }

  // ---------- 計器・物差し・うしろの窓 ----------
  function drawRuler(km) {
    const w = rulerW, c = rctx, y = 10, x0 = 1, x1 = w - 5, len = x1 - x0;
    c.clearRect(0, 0, w, 34);
    c.strokeStyle = "rgba(94,242,194,0.35)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x0, y + 0.5);
    c.lineTo(x1, y + 0.5);
    c.stroke();
    const step = niceStep(km), minor = step / 5;
    c.strokeStyle = "rgba(94,242,194,0.28)";
    for (let k = 0; k * minor <= km * 1.0001 && k < 400; k++) {
      const x = Math.round(x0 + ((k * minor) / km) * len) + 0.5, major = k % 5 === 0;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y + (major ? 7 : 4));
      c.stroke();
    }
    for (const pl of STOPS) {
      if (pl.km > km * 1.0001) continue;
      const x = x0 + (pl.km / km) * len;
      c.fillStyle = pl.kind === "light-day" ? "#ffb547" : "#5ef2c2";
      c.shadowColor = c.fillStyle;
      c.shadowBlur = 6;
      c.fillRect(Math.round(x) - 1, y - 5, 2, 10);
      c.shadowBlur = 0;
    }
    c.fillStyle = "#ffb547";
    c.shadowColor = "rgba(255,181,71,0.6)";
    c.shadowBlur = 8;
    c.beginPath();
    c.arc(x1, y + 0.5, 3.5, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    c.font = "9px 'Zen Kaku Gothic New', sans-serif";
    c.fillStyle = "rgba(143,179,168,0.95)";
    c.textBaseline = "top";
    c.textAlign = "left";
    c.fillText("地球", x0, y + 12);
    c.textAlign = "right";
    c.fillText("現在地", x1 + 4, y + 12);
    c.textAlign = "center";
    c.fillStyle = "rgba(94,242,194,0.85)";
    c.fillText(`1目盛り＝${kmShortJa(minor, 2)}`, w / 2, y + 12);
  }
  function drawRear(km, alpha) {
    const S = rearS, c = rearCtx, cx = S / 2, cy = S / 2, R = S / 2 - 1.5;
    c.clearRect(0, 0, S, S);
    if (alpha <= 0) return;
    c.save();
    c.globalAlpha = alpha;
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    const bg = c.createRadialGradient(cx, cy, 0, cx, cy, R);
    bg.addColorStop(0, "rgba(12,33,64,0.9)");
    bg.addColorStop(1, "rgba(5,14,31,0.92)");
    c.fillStyle = bg;
    c.fill();
    c.strokeStyle = "rgba(94,242,194,0.45)";
    c.lineWidth = 1;
    c.stroke();
    c.strokeStyle = "rgba(94,242,194,0.18)";
    for (const [a, b, d, e] of [[cx, cy - R + 4, cx, cy - R + 10], [cx, cy + R - 4, cx, cy + R - 10], [cx - R + 4, cy, cx - R + 10, cy], [cx + R - 4, cy, cx + R - 10, cy]]) {
      c.beginPath();
      c.moveTo(a, b);
      c.lineTo(d, e);
      c.stroke();
    }
    // 見かけの大きさ（窓の視野は 60 度）。本当の角度で描く
    const half = Math.asin(EARTH_R / (EARTH_R + km)), r = (R * Math.tan(half)) / Math.tan(30 * DEG);
    c.beginPath();
    c.arc(cx, cy, R - 1, 0, Math.PI * 2);
    c.clip();
    if (r >= 1.4) {
      const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      g.addColorStop(0, "#9fe6ff");
      g.addColorStop(0.5, "#2f7fb8");
      g.addColorStop(0.85, "#0f3a66");
      g.addColorStop(1, "#06213f");
      c.fillStyle = g;
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(120,220,255,0.5)";
      c.lineWidth = 1;
      c.stroke();
    } else {
      const halo = c.createRadialGradient(cx, cy, 0, cx, cy, 7);
      halo.addColorStop(0, "rgba(140,220,255,0.9)");
      halo.addColorStop(0.25, "rgba(94,180,242,0.35)");
      halo.addColorStop(1, "rgba(94,180,242,0)");
      c.fillStyle = halo;
      c.fillRect(cx - 8, cy - 8, 16, 16);
      c.fillStyle = "#cfefff";
      c.beginPath();
      c.arc(cx, cy, 1.1, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  // ---------- 表示（Codex 案の形） ----------
  let uiKey = "", lastUi = 0, travelKey = "";
  const meta = $("meta"), evEl = $("event"), det = $("details"), tour = $("tour"), title = $("title"), story = root.querySelector(".story");
  function setStory(mode, st) {
    root.classList.toggle("moving", mode === "travel" || mode === "free" || mode === "swing");
    root.classList.toggle("encounter", mode === "encounter");
    root.classList.toggle("rest", mode === "rest");
    if (root.dataset.mode !== mode) root.dataset.mode = mode;
    const key = `${mode}:${st?.pl.id ?? ""}`;
    if (key === uiKey) return;
    uiKey = key;
    if (mode === "travel" || mode === "free" || mode === "swing" || mode === "rest") return;
    meta.hidden = evEl.hidden = det.hidden = tour.hidden = true;
    const pl = st?.pl;
    const long = mode === "encounter" && pl.name.length > LONG_NAME;
    title.classList.toggle("fit", long); // スマホでは1行に縮めて収める（PC は2行のまま）
    title.style.setProperty("--chars", long ? String(pl.name.length + 0.6) : "");
    if (mode === "intro") {
      $("eyebrow").textContent = "A JOURNEY BEYOND / 光の旅";
      title.innerHTML = "その先の、<br>まだ先へ。";
      $("text").innerHTML = "光になって、地球の輪の外へ。<br>遠くで旅をつづける探査機に、会いにいこう。";
      $("scene-name").textContent = "EARTH";
      $("scene-caption").textContent = "高さ 100 km から、出発";
    } else if (mode === "end") {
      $("eyebrow").textContent = "BEYOND THE ORBIT";
      title.innerHTML = "地球の輪の外は、<br>桁が違う。";
      $("text").textContent = "うしろの窓の、あの小さな点が地球。もう一度、違う速さで旅をしてみよう。";
      $("scene-name").textContent = "THE JOURNEY CONTINUES";
      $("scene-caption").textContent = "まだ、先がある。";
    } else if (mode === "encounter") {
      const n = String(st.i + 1).padStart(2, "0");
      $("eyebrow").textContent = `${n} / ${String(total).padStart(2, "0")} · ${pl.kind === "probe" ? "探査機のとなりで" : pl.kind === "light-day" ? "光の1日" : "くらべる目安"}`;
      title.innerHTML = titleHtml(pl);
      $("text").textContent = pl.text;
      meta.hidden = false;
      meta.innerHTML = `${esc(pl.dist)} ／ 光で ${esc(pl.lt)}<small>${esc(pl.how)}</small>`;
      if (pl.event) {
        evEl.hidden = false;
        evEl.innerHTML = pl.event;
      }
      det.hidden = !pl.card;
      tour.hidden = pl.id !== "moon"; // 月：アルテミス2号の旅に乗るページ（web/tour/artemis2/。2026-10-09 オーナー）
      $("scene-name").textContent = pl.en;
      $("story-en").textContent = pl.en;
      $("scene-caption").textContent = pl.kind === "probe" ? "いま、あなたのすぐそばに。" : "光の旅の、ひとつの目印。";
      // 説明の上の端（文の長さで変わる）。スマホでは「なぞって眺める」の案内を、これより上に置く（重ならないように）
      root.style.setProperty("--story-top", `${story.offsetTop}px`);
    }
  }
  function setPrimary(mode, st) {
    let label, sub = "";
    if (trip) label = "到着まで進む";
    else if (mode === "intro") {
      label = "旅をはじめる";
      sub = ROUTE.stops[0] ? `まずは${ROUTE.stops[0].pl.name}へ` : "";
    } else if (mode === "end") label = "もう一度、地球から";
    else if (mode === "encounter") {
      const lk = st.lk, nx = ROUTE.stops[st.i + 1];
      if (lk.swing === "gravity") {
        label = "スイングバイで、その先へ";
        sub = `${lk.by}の重力で、向きと速さを変える`;
      } else if (lk.swing === "around") {
        label = "回りこんで、その先へ";
        sub = nx ? `次は ${nx.pl.name}` : "";
      } else label = "1光日の、その先へ";
    } else {
      const nx = nextStop();
      label = nx ? "次の場所へ" : "1光日の、その先へ";
      sub = nx ? `次は ${nx.pl.name}` : "";
    }
    if ($("primary-label").textContent !== label) $("primary-label").textContent = label;
    if ($("primary-sub").textContent !== sub) $("primary-sub").textContent = sub;
  }
  function setTravel(mode, st) {
    let word = "", sub = "";
    if (mode === "swing" && st) {
      if (st.lk.swing === "gravity") {
        word = `${st.lk.by}の重力で、曲がる。`;
        sub = "SWING-BY / 向きと速さが変わる";
      } else {
        word = st.pl.kind === "probe" ? "となりを、回りこむ。" : "太陽を、回りこむ。";
        sub = "FLY-AROUND / 向きを変える";
      }
    } else if (v < -0.5 || (trip && trip.to < trip.from)) {
      const pv = prevStop();
      word = "地球の方へ、もどる。";
      sub = `BACK / ${pv ? pv.pl.name : "地表の近く"}`;
    } else {
      const nx = nextStop();
      word = mode === "rest" ? "ここで、ひと息。" : mode === "free" ? "桁を越えて、進む。" : nx ? (TRAVEL[nx.pl.id] ?? "次の場所へ。") : "光の一日、その先へ。";
      sub = nx ? `NEXT / ${nx.pl.name}` : "BEYOND / 1光日の先";
    }
    const key = word + sub;
    if (key === travelKey) return;
    travelKey = key;
    $("travel-word").textContent = word;
    $("travel-sub").textContent = sub;
  }
  const STATUS = { intro: "地球の、すぐそば。", encounter: "そばで、観測中", travel: "光になって、進む", free: "自由に飛行中", rest: "ここで、ひと息", end: "光の一日、その先" };
  function drawUi(now, km, sp, m) {
    if (now - lastUi < 66 && (trip || Math.abs(v) > 0.5)) return;
    lastUi = now;
    const st = m.mode === "encounter" ? m.st : null, approx = !!st?.pl.approx;
    const shownKm = st ? st.pl.km : km;
    $("km").textContent = group(shownKm);
    $("approx").textContent = st?.pl.tag ?? "";
    $("ly").textContent = (approx ? "約 " : "") + lightYears(shownKm);
    $("lt").textContent = lightTimeJa(shownKm / C, { approx });
    const spd = $("speed");
    spd.innerHTML = sp.fiction ? `${esc(sp.text)}<span class="fiction">作り話</span>` : esc(sp.text);
    spd.classList.toggle("warp", !!sp.fiction);
    $("ruler-km").textContent = `${group(shownKm)} km`;
    drawRuler(shownKm);
    const passed = ROUTE.stops.filter((x) => x.sE <= s + 0.5).length;
    $("chapter-num").textContent = String(passed).padStart(2, "0");
    $("rail-fill").style.height = `${(100 * s) / ROUTE.len}%`;
    let status = STATUS[m.mode] ?? "";
    if (m.mode === "swing") status = m.st?.lk.swing === "gravity" ? "スイングバイ中" : "回りこみ中";
    if (m.mode === "travel" && trip && Math.abs(trip.to - s) < 12) status = "まもなく、となりへ";
    if ($("status").textContent !== status) $("status").textContent = status;
    setStory(m.mode, m.st);
    setPrimary(m.mode, m.st);
    setTravel(m.mode, m.st);
    if (m.mode === "encounter") announce(m.st);
    else announced = "";
  }

  // ---------- 毎フレーム ----------
  const camPos = new THREE.Vector3(), prevPos = new THREE.Vector3(), velV = new THREE.Vector3(), tmpV = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const KEY_DIR = new THREE.Vector3(-3, 5, 7).normalize(); // 主光の向き（カメラから見て左上の前）
  const qBase = new THREE.Quaternion(), qLookY = new THREE.Quaternion(), qLookP = new THREE.Quaternion(), vRight = new THREE.Vector3();
  let frameMs = 16, frames = 0, qualityAt = 0, idleFrames = 0;
  function step(dt, now) {
    const before = s;
    if (trip) {
      trip.t0 ??= now;
      const u = clamp((now - trip.t0) / trip.dur, 0, 1);
      const e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
      s = trip.from + (trip.to - trip.from) * e;
      v = dt > 0 ? (s - before) / dt : 0;
      if (u >= 1) finishTrip();
    } else {
      s = clamp(s + v * dt, 0, ROUTE.len);
      if (s === 0 || s === ROUTE.len) v = 0;
      if (!pointer) {
        // スイングバイの天体に近づくと、引き込まれて速くなる
        const well = ROUTE.stops.find((st) => st.lk.swing === "gravity" && s > st.sE + 0.4 && s < st.sMid);
        if (well && v > 0.5) v = Math.min(TUNE.MAX_V, v + TUNE.GRAVITY * dt);
        // ゆっくりになったら、進む先の場所へ吸い寄せて止める
        if (!snap && Math.abs(v) < TUNE.SNAP_SPEED) {
          let best = null, bd = TUNE.SNAP_RANGE;
          for (const st of ROUTE.stops) {
            const d = st.sE - s;
            if (v > 0.5 ? d > 0.2 : v < -0.5 ? d < -0.2 : Math.abs(d) < 2)
              if (Math.abs(d) < bd) {
                bd = Math.abs(d);
                best = st;
              }
          }
          snap = best;
        }
        if (snap) {
          const d = snap.sE - s;
          v += (9 * d - 5.2 * v) * dt;
          if (Math.abs(d) < 0.03 && Math.abs(v) < 0.4) {
            s = snap.sE;
            v = 0;
            snap = null;
          }
        } else {
          v *= TUNE.FRICTION ** dt;
          if (Math.abs(v) < 0.3) v = 0;
        }
      }
    }
    // 弧を抜けた瞬間：飛び出す（スイングバイ）・1光日の輪をくぐる
    if (s > before)
      for (const st of ROUTE.stops) {
        if (st.lk.kind === "gate") {
          if (before < st.sA && s >= st.sA) {
            pulse(true);
            audio.ping(true);
          }
          continue;
        }
        if (st.lk.swing === "gravity" && before < st.sMid && s >= st.sMid) {
          kickFov = 1;
          pulse(false);
          audio.whoosh();
          if (!trip && !pointer) {
            const nx = ROUTE.stops[st.i + 1], remain = (nx ? nx.sE : ROUTE.len) - s;
            v = Math.max(v, Math.min(TUNE.MAX_V, remain * TUNE.SLING * Math.log(1 / TUNE.FRICTION)));
            snap = null;
          }
        }
      }
    return before;
  }
  function pulse(gateHit) {
    if (reduce) return;
    const f = $("flash");
    f.classList.toggle("gate", gateHit);
    f.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: gateHit ? 900 : 650, easing: "ease-out" });
  }
  function frame(now) {
    raf = 0;
    if (!running || !visible || document.hidden || ctxLost) return;
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
    frameMs = frameMs * 0.95 + (now - lastT) * 0.05;
    lastT = now;
    const before = step(dt, now);
    const p = routeP(s), km = 10 ** p;
    const sp = speedInfo(km, dpds(s), v);
    const m = modeNow();
    drawUi(now, km, sp, m);
    audio.update(Math.min(1, Math.abs(v) / TUNE.MAX_V), sp.warp);
    const warp = reduce ? 0 : sp.warp;
    $("warp-vignette").style.opacity = String(warp * 0.9);
    // うしろの窓（地球が前から消えたら出す）
    const rearA = smooth01((p - P0 - 0.35) / 0.25);
    $("rear").dataset.off = String(rearA <= 0);
    if (rearA > 0) {
      drawRear(km, rearA);
      $("rear-size").textContent = angleText((2 * Math.asin(EARTH_R / (EARTH_R + km))) / DEG);
    }
    const moving = s !== before || v !== 0 || !!trip || !!pointer || kickFov > 0.01 || look.yawTo !== look.yaw || !!(look.st && m.mode !== "encounter");
    if (moving) idleFrames = 0;
    else idleFrames++;
    // 止まっているあいだは、ゆっくり回る模型や星のまたたきのために1コマおきに描く（動きを減らす設定では描くのをやめる）
    if (moving || idleFrames < 3 || (!reduce && idleFrames % 2 === 0)) render(now, dt, p, km, warp, m);
    if (moving || idleFrames < 3 || !reduce) raf = requestAnimationFrame(frame);
  }
  function render(now, dt, p, km, warp, m) {
    routePos(s, camPos);
    if (!started) prevPos.copy(camPos);
    velV.subVectors(camPos, prevPos).divideScalar(Math.max(dt, 1e-3));
    prevPos.copy(camPos);
    // カメラ：航路の上。向きは「進む向き」と「着いた場所を見る向き」を混ぜ、弧では傾ける。ワープでは視野が広がる
    cameraQuat(s, camPos, qTarget);
    // そばで観測中の「回りこんで見る」：見せたもの（模型。なければ天体）を中心に、カメラごと回す（見せたものは画面の同じ場所のまま）。
    // 離れるとき（その先へ・はじいたとき）は、角度を 0 に戻しながら航路に乗る
    qBase.copy(qTarget);
    const here = m.mode === "encounter" ? m.st : null;
    if (look.st && look.st !== here) {
      const k = reduce ? 0 : Math.exp(-dt / 0.22);
      look.yaw = look.yawTo = look.yaw * k;
      look.pitch *= k;
      if (Math.abs(look.yaw) + Math.abs(look.pitch) < 1e-3) {
        look.yaw = look.yawTo = look.pitch = 0;
        look.st = null;
      }
    } else if (look.st && look.yawTo !== look.yaw) {
      look.yaw += (look.yawTo - look.yaw) * (reduce ? 1 : 1 - Math.exp(-dt / 0.12)); // キーで回すときは、なめらかに
      if (Math.abs(look.yawTo - look.yaw) < 1e-4) look.yaw = look.yawTo;
    }
    if (look.st && (look.yaw || look.pitch)) {
      const F = look.st.pivot;
      qLookY.setFromAxisAngle(look.st.axis, look.yaw);
      vRight.set(1, 0, 0).applyQuaternion(qTarget).applyQuaternion(qLookY);
      qLookP.setFromAxisAngle(vRight, look.pitch).multiply(qLookY);
      // 回すほど少し引く（模型の対角線が見えても、名前の上に出ない）
      const out = 1 + (look.st.lookOut - 1) * smooth01((Math.abs(look.yaw) + Math.abs(look.pitch)) / 0.5);
      camPos.sub(F).multiplyScalar(out).applyQuaternion(qLookP).add(F);
      qTarget.premultiply(qLookP);
    }
    // 回りこんで見ているあいだは、位置と向きを一緒に動かす（見せたものが画面の同じ場所のまま）
    if (!started || reduce || (look.st && look.st === here)) camera.quaternion.copy(qTarget);
    else camera.quaternion.slerp(qTarget, 1 - Math.exp(-dt / 0.07));
    started = true;
    kickFov = Math.max(0, kickFov - dt * 1.6);
    camera.fov = FI.vfov + (reduce ? 0 : TUNE.FOV_WARP * warp + TUNE.FOV_SLING * Math.sin(Math.PI * Math.min(1, kickFov)));
    camera.updateProjectionMatrix();
    const shake = reduce ? 0 : warp * 0.05;
    camera.position.copy(camPos);
    if (shake) camera.position.add(tmpV.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));
    camera.updateMatrixWorld();
    const t = now / 1000;

    // 空
    skyGroup.position.copy(camera.position);
    skyStars.material.uniforms.uScale.value = Math.min(pixelRatio, 2);
    skyStars.material.uniforms.uTime.value = reduce ? 0 : t;
    // 地球（出発のときだけ）
    const showEarth = p < P0 + 1.0;
    earth.visible = atmo.visible = dawn.visible = showEarth;
    if (showEarth) {
      const alpha = Math.asin(EARTH_R / (EARTH_R + km)), beta = clamp(p - P0, 0, 1) * 0.6, D = 60;
      tmpV.set(0, -Math.cos(beta), Math.sin(beta));
      earth.position.copy(camera.position).addScaledVector(tmpV, D);
      earth.scale.setScalar(D * Math.sin(alpha));
      atmo.position.copy(earth.position);
      atmo.scale.setScalar(earth.scale.x + 0.12);
      earth.quaternion.setFromAxisAngle(AX, beta + 0.32 * (p - P0)).multiply(earth.userData.q0);
      earthMat.uniforms.uTime.value = reduce ? 0 : t;
      dawn.position.copy(camera.position).addScaledVector(earthMat.uniforms.uSun.value, 50);
      dawn.quaternion.copy(camera.quaternion);
      dawn.scale.setScalar(26);
      dawn.material.uniforms.uAlpha.value = 0.75 * (1 - smooth01((p - P0) / 0.8));
    }
    // 流れる星：速いほど長い線
    starMat.uniforms.uCam.value.copy(camera.position);
    const spd = velV.length();
    starMat.uniforms.uVel.value.copy(velV).multiplyScalar(reduce ? 0 : Math.min(0.075, 26 / Math.max(spd, 1)));
    if (reduce || spd < 0.5) starMat.uniforms.uVel.value.set(0, 0, 0);
    starMat.uniforms.uScale.value = Math.min(pixelRatio, 2) * (FI.H / 800);
    starMat.uniforms.uTime.value = reduce ? 0 : t;
    // 航路の点線：着いているときは明るく、動いているときはうすく
    routeMat.uniforms.uS.value = s;
    routeMat.uniforms.uAlpha.value = m.mode === "encounter" || m.mode === "intro" ? 0.85 : 0.4;
    routeMat.uniforms.uScale.value = Math.min(pixelRatio, 2) * (FI.H / 800);
    // 天体・模型：近い場所だけ出す
    for (const b of bodyMeshes.values()) b.visible = false;
    for (const g of sunGlows) g.visible = false;
    for (const h of holders.values()) h.visible = false;
    gate.visible = false;
    dust.visible = false;
    for (const st of ROUTE.stops) {
      const dist = camera.position.distanceTo(st.focus);
      const prev = ROUTE.stops[st.i - 1];
      if (s > st.sX + 70 || st.sE - s > 240 || (prev && s < prev.sA - 1)) continue;
      const a = smooth01((240 - (st.sE - s)) / 70);
      for (const o of st.objects) {
        o.visible = true;
        if (o.material?.uniforms?.uAlpha && o !== dust) o.material.uniforms.uAlpha.value = (o.userData.base ?? 1) * a;
        if (sunGlows.includes(o)) o.quaternion.copy(camera.quaternion);
      }
      if (st.lk.body === "sun") bodyMeshes.get(st.pl.id).material.uniforms.uTime.value = reduce ? 0 : t;
      if (st.model && !reduce) {
        // ジュノーは本体の軸のまわりを、本当の速さ（1分に2回）で回る。ほかの機体は、ゆっくり向きを変えるだけ
        const inner = st.model.userData.inner;
        if (st.lk.rpm) inner.children[0].rotation.y += (dt * st.lk.rpm * Math.PI * 2) / 60;
        else if (!st.lk.still) inner.rotation.y += dt * 0.05;
      }
      if (st.lk.kind === "gate") gate.userData.halo.quaternion.copy(camera.quaternion).premultiply(tmpQ.copy(gate.quaternion).invert());
      if (st.lk.dust) dust.material.uniforms.uAlpha.value = 0.55 * smooth01((60 - dist) / 30);
      dust.material.uniforms.uScale.value = Math.min(pixelRatio, 2) * (FI.H / 800);
    }

    // 主光の影：いちばん近くに見えている模型のまわりだけを測る
    let nearM = null, nearD = Infinity;
    for (const st of ROUTE.stops)
      if (st.model?.visible) {
        const d = camera.position.distanceTo(st.model.position);
        if (d < nearD) {
          nearD = d;
          nearM = st.model;
        }
      }
    keyLight.castShadow = !!nearM;
    if (nearM) {
      const R = nearM.scale.x, sc = keyLight.shadow.camera;
      tmpV.copy(KEY_DIR).applyQuaternion(qBase); // 回りこんで見ても、光（太陽）の向きは変えない
      keyLight.target.position.copy(nearM.position);
      keyLight.target.updateMatrixWorld();
      keyLight.position.copy(nearM.position).addScaledVector(tmpV, 6 * R);
      sc.left = sc.bottom = -1.5 * R;
      sc.right = sc.top = 1.5 * R;
      sc.near = 0.5 * R;
      sc.far = 9 * R;
      sc.updateProjectionMatrix();
      keyLight.shadow.normalBias = 0.012 * R;
    }

    // 次の行き先の照準（遠くに小さく見えているあいだ）
    const nx = trip || Math.abs(v) > 0.5 || m.mode === "rest" ? nextStop() : null;
    const ret = $("reticle"), retL = $("reticle-label");
    let shown = false;
    if (nx && v >= -0.5 && nx.sE - s > 22 && camera.position.distanceTo(nx.focus) > 34) {
      tmpV.copy(nx.focus).project(camera);
      if (tmpV.z < 1 && Math.abs(tmpV.x) < 0.92 && Math.abs(tmpV.y) < 0.86) {
        const x = (tmpV.x * 0.5 + 0.5) * FI.W, y = (-tmpV.y * 0.5 + 0.5) * FI.H;
        ret.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        $("reticle-name").textContent = nx.pl.name;
        const lx = clamp(x + 22, 8, FI.W - 200);
        retL.style.transform = `translate3d(${lx}px, ${y - 14}px, 0)`;
        shown = true;
      }
    }
    if (!shown) ret.style.transform = retL.style.transform = "translate3d(-999px,-999px,0)";

    // 望遠の窓：火星のそば
    const per = ROUTE.stops.find((x) => x.lk.lens);
    const lensW = per ? lookWeights(per, s)[0] : 0, lensOn = lensW > 0.85 && Math.abs(v) < 8;
    const lens = $("lens"), line = $("lens-line"), pin = $("lens-pin");
    lens.classList.toggle("on", lensOn);
    line.classList.toggle("on", lensOn);
    pin.classList.toggle("on", lensOn);
    root.classList.toggle("lens-on", lensOn);
    root.classList.toggle("gate-on", m.mode === "encounter" && m.st?.lk.kind === "gate");
    // 「公式を参考にしたイメージ」：探査機の模型が見えているあいだだけ出す
    const mst = m.st;
    root.classList.toggle("model-on", lensOn || (!!mst?.lk.model && (m.mode === "encounter" || m.mode === "swing" || m.mode === "rest")));
    let lensRect = null;
    if (lensW > 0.5) {
      tmpV.copy(per.center).project(camera);
      const mx = (tmpV.x * 0.5 + 0.5) * FI.W, my = (-tmpV.y * 0.5 + 0.5) * FI.H;
      const mr = (per.lk.R / camera.position.distanceTo(per.center) / Math.tan((camera.fov * DEG) / 2)) * (FI.H / 2);
      const lr = FI.portrait ? clamp((FI.bandBottom - FI.bandTop) * 0.36, 44, 58) : clamp(FI.H * 0.12, 56, 92);
      // 縦長：右がわ、上の数字（約175px まで）の下から、説明より上（窓の下の文字の分もあける）。横長：火星の左下
      const lx = FI.portrait ? FI.W - lr - 14 : clamp(mx - mr * 1.35, lr + 12, FI.W - lr - 12);
      const ly = FI.portrait ? clamp(my + mr * 0.42, 176 + lr, Math.max(176 + lr, FI.bandBottom - lr - 24)) : clamp(my + mr * 0.45, lr + 90, FI.H - lr - 230);
      lens.style.width = lens.style.height = `${2 * lr}px`;
      lens.style.transform = `translate3d(${lx - lr}px, ${ly - lr}px, 0)`;
      const px = mx - mr * 0.3, py = my + mr * 0.25;
      pin.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      const ang = Math.atan2(py - ly, px - lx), dd = Math.hypot(px - lx, py - ly);
      line.style.width = `${Math.max(0, dd - lr - 6)}px`;
      line.style.transform = `translate3d(${lx + Math.cos(ang) * lr}px, ${ly + Math.sin(ang) * lr}px, 0) rotate(${ang}rad)`;
      lensRect = { x: lx - lr, y: ly - lr, w: 2 * lr };
      // 窓の中のローバーは、ゆっくり回る。なぞると、その分だけ回して見られる
      if (!reduce) rover.userData.spin += dt * 0.12;
      rover.rotation.y = rover.userData.spin + (look.st === per ? look.yaw : 0);
    }

    // 描く
    renderer.clear();
    renderer.render(skyScene, camera);
    renderer.clearDepth();
    renderer.render(mainScene, camera);
    if (lensRect && lensOn) {
      const y = FI.H - lensRect.y - lensRect.w;
      renderer.setScissorTest(true);
      renderer.setScissor(lensRect.x, y, lensRect.w, lensRect.w);
      renderer.setViewport(lensRect.x, y, lensRect.w, lensRect.w);
      renderer.clearDepth();
      renderer.render(lensScene, lensCam);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, FI.W, FI.H);
    }
    // 重いときは、描く細かさを自動で下げる
    frames++;
    if (now - qualityAt > 2500 && frames > 90) {
      qualityAt = now;
      frames = 0;
      if (frameMs > 24 && pixelRatio > 1) {
        pixelRatio = Math.max(1, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(FI.W, FI.H, false);
      }
    }
  }
  function wake() {
    idleFrames = 0;
    if (!raf && running && visible && !document.hidden && !ctxLost) {
      lastT = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  const ro = new ResizeObserver(() => size());
  ro.observe(root);
  const io = new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting;
      if (visible) wake();
      else pointer = null;
    },
    { threshold: 0.02 },
  );
  io.observe(root);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) wake();
  });
  reduceQuery.addEventListener("change", () => {
    reduce = reduceQuery.matches;
    if (reduce && trip) finishTrip();
    wake();
  });
  // WebGL が失われたら（スマホでほかのアプリに切り替えたときなど）止めて、戻ったら星雲を描き直す
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    ctxLost = true;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    ctxLost = false;
    nebula.draw();
    started = false;
    wake();
  });

  // 最初の形
  size();

  // ---------- 外から使うもの ----------
  // 停留所を入れ替える（1分ごとの計算し直し）。並びが同じなら、距離と文だけを書き換える（航路はそのまま）
  // 部屋を閉じているあいだに並びが変わったときは、開いたときに作り直す（いまの場所は、古い航路から引き継ぐ）
  function setStops(list) {
    const next = prepareStops(list);
    const same = next.length === STOPS.length && next.every((pl, i) => pl.id === STOPS[i].id && !!pl.companion === !!STOPS[i].companion && pl.companion?.beyond === STOPS[i].companion?.beyond);
    STOPS = next;
    total = STOPS.length;
    if (same && ROUTE && !stopsChanged) {
      ROUTE.stops.forEach((st, i) => (st.pl = STOPS[i]));
      uiKey = "";
      travelKey = "";
    } else if (root.clientWidth) rebuild();
    else stopsChanged = true;
    wake();
  }
  // その場所へ飛ぶ（はしごから）。停留所でないもの（ボイジャー1号）は、いちばん近い停留所へ
  function flyTo(id, km = null) {
    if (!ROUTE) return;
    let st = ROUTE.stops.find((x) => x.pl.id === id);
    if (!st && id === GATE_COMPANION) st = ROUTE.stops.find((x) => x.lk.kind === "gate");
    if (!st && km > 0) {
      const p = Math.log10(km);
      st = [...ROUTE.stops].sort((a, b) => Math.abs(a.pl.p - p) - Math.abs(b.pl.p - p))[0];
    }
    if (st) startTrip(st.sE, st.i);
  }
  return {
    setStops,
    flyTo,
    home: () => ROUTE && startTrip(0, "home"),
    // 部屋を開いたとき。閉じる前にいた場所から続ける（音を出す設定なら、音も）
    start() {
      running = true;
      visible = true;
      if (!ROUTE || stopsChanged) size();
      started = false;
      audio.wake();
      wake();
    },
    // 部屋を閉じたとき。飛んでいる途中なら、行き先に着いたことにする（知らせは読まない）
    stop() {
      running = false;
      pointer = null;
      if (trip) {
        s = trip.to;
        v = 0;
        trip = null;
      }
      audio.pause();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    focus: () => viewport.focus({ preventScroll: true }),
  };
}
