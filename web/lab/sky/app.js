// 試作 02：SKY OBSERVER（空を見る）。流星群と ISS を、スマホをかざして探し、見えたら記録して X に貼る
// 素案（オーナーと ChatGPT の v0.4）の画面の流れを引きつぎ、計算はアプリと同じ部品（passes.js・meteors.js）につないだ
// 位置は県（県庁あたり）だけ。GPS は使わない。記録・写真はこの端末の中だけ（送らない）
import { satrecFromOrbit } from "../../js/orbit.js";
import { findVisiblePasses, observerOf, skyAt, dir8, sunEci, SUN_BELOW } from "../../js/passes.js";
import { radiantSky, meteorNight, moonEci, moonLit, activeMeteors } from "../../js/meteors.js";
import { whenWord, clockWord, loadPrefecture, savePrefecture } from "../../js/tonight.js";
import { esc } from "../../js/format.js";
import { gstime, eciToEcf, ecfToLookAngles } from "../../vendor/satellite.min.js";
import { enu, rotation, cameraDir, project, steer, fists, absoluteAlpha } from "./orient.js";
import { logText, postUrl, loadLogs, saveLogs } from "./share.js";

const $ = (q) => document.querySelector(q);
const DEG = 180 / Math.PI;
const TZ = "Asia/Tokyo";
const hm = (d) => new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, hour: "numeric", minute: "2-digit", hourCycle: "h23" }).format(d);
const dateTime = (d) => new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, month: "numeric", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit", hourCycle: "h23" }).format(d);
const lookAt = (observer, eci, date) => {
  const la = ecfToLookAngles(observer, eciToEcf(eci, gstime(date)));
  return { az: ((la.azimuth * DEG) % 360 + 360) % 360, el: la.elevation * DEG };
};
const ico = {
  home: '<path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  eye: '<circle cx="12" cy="12" r="9"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="3"/>',
  log: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ico[n]}</svg>`;

// ---------- データ ----------
const [prefData, orbit, eventsData] = await Promise.all(
  ["../../data/prefectures.json", "../../data/orbits/iss.json", "../../data/events.json"].map((u) => fetch(u).then((r) => r.json())),
);
const prefectures = prefData.prefectures;
const satrec = satrecFromOrbit(orbit);
const events = eventsData.events ?? [];
// いま出現期間の流星群。なければ次の流星群
const meteorEvent =
  activeMeteors(events, new Date())[0] ??
  events.filter((e) => e.kind === "meteor" && e.radiant?.value && Date.parse(e.when?.value?.date ?? 0) > Date.now()).sort((a, b) => Date.parse(a.when.value.date) - Date.parse(b.when.value.date))[0] ??
  null;

// ---------- 状態 ----------
const SESSION_KEY = "voyascope.lab.skysession.v1";
const OFFSET_KEY = "voyascope.lab.skyoffset.v1";
const readJson = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d;
  } catch {
    return d;
  }
};
const writeJson = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // 保存できなくても、開いているあいだは使える
  }
};
const s = {
  page: "home",
  subject: meteorEvent ? "meteor" : "iss",
  pref: prefectures.find((p) => p.code === loadPrefecture()) ?? null,
  logs: loadLogs(),
  active: null,
  session: readJson(SESSION_KEY, null), // 流星を数えている途中
  sky: "clear",
  offset: Number(readJson(OFFSET_KEY, 0)) || 0, // 方位の合わせ（度、時計回り）
  sensor: "off", // off | on | none
  view: null, // センサーがないとき：指で動かす向き { az, el }
  cam: null,
  photo: null,
};
const observer = () => observerOf(s.pref ?? prefectures.find((p) => p.name === "東京"));

// ---------- 計算 ----------
// 重い計算（通過・今夜の流れ）は、県と分ごとに覚えておく
const memo = new Map();
const cached = (name, now, fn) => {
  const key = `${name}:${s.pref?.code}:${Math.floor(now.getTime() / 60e3)}`;
  if (!memo.has(key)) {
    if (memo.size > 20) memo.clear();
    memo.set(key, fn());
  }
  return memo.get(key);
};
const meteorTonight = (now = new Date()) => cached("night", now, () => meteorTonightRaw(now));
function meteorTonightRaw(now) {
  if (!meteorEvent) return null;
  // 夜のあいだに開いても、今夜（日の入りのあと〜明け方）をまるごと出す
  const dark = lookAt(observer(), sunEci(now), now).el <= SUN_BELOW;
  const night = meteorNight(meteorEvent.radiant.value, observer(), dark ? new Date(now.getTime() - 12 * 3600e3) : now);
  if (!night) return null;
  const { samples } = night;
  const rise = samples[0].rad.el > 0 ? null : samples.find((x) => x.rad.el > 0)?.date ?? null;
  const moonSet = samples.find((x, i) => i > 0 && samples[i - 1].moon.el > 0 && x.moon.el <= 0)?.date ?? null;
  const moonRise = samples.find((x, i) => i > 0 && samples[i - 1].moon.el <= 0 && x.moon.el > 0)?.date ?? null;
  // 見ごろ（計算の目安）：月が沈んでいて、放射点が高さ25°以上
  let good = samples.filter((x) => x.moon.el < 0 && x.rad.el >= 25);
  if (!good.length) good = samples.filter((x) => x.rad.el >= 25);
  const best = good.length ? { start: good[0].date, end: good.at(-1).date, moonless: good[0].moon.el < 0 } : null;
  return { ...night, rise, moonSet, moonRise, best };
}
const radiantNow = (now = new Date()) => meteorEvent && radiantSky(meteorEvent.radiant.value, observer(), now);
const moonNow = (now = new Date()) => lookAt(observer(), moonEci(now), now);
const issNow = (now = new Date()) => skyAt(satrec, observer(), now);
const issPasses = (now = new Date()) => cached("iss", now, () => issPassesRaw(now));
function issPassesRaw(now) {
  const recent = findVisiblePasses(satrec, observer(), new Date(now.getTime() - 3 * 3600e3), { days: 3.5 / 24, limit: 4 }).filter((p) => p.start <= now);
  const next = findVisiblePasses(satrec, observer(), now, { days: 10, limit: 1 })[0] ?? null;
  return { recent: recent.at(-1) ?? null, next };
}

// 案内の目標：流星群は放射点。ISS は通過の前30分なら出てくる点、通過中・それ以外はいまの位置
function mainTarget(now = new Date()) {
  if (s.subject === "meteor") {
    const r = radiantNow(now);
    return r && { ...r, label: "放射点" };
  }
  const { recent, next } = issPasses(now);
  if (recent && recent.end >= now) return { ...issNow(now), label: "ISS" };
  if (next && next.start - now < 30 * 60e3) return { ...next.track[0], label: "ISS が出てくるところ", pass: next };
  return { ...issNow(now), label: "ISS（いまの位置）" };
}

// ---------- 画面の部品 ----------
let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}
function header() {
  $("#top").innerHTML = `<div><div class="logo">VOYA<span class="mint">SCOPE</span></div><div class="logo-sub">SKY OBSERVER · LAB</div></div>
    <div style="display:flex;gap:6px"><button class="pill" data-act="pref">⌖ ${esc(s.pref?.name ?? "県を選ぶ")}</button><button class="pill" data-act="night" aria-pressed="${document.documentElement.classList.contains("night")}" title="赤い画面（暗さに慣れた目を守る）">●夜</button></div>`;
}
function tabs() {
  const cur = s.page === "logs" || s.page === "share" ? "logs" : s.page;
  $("#tabs").innerHTML = `<button data-act="home" ${cur === "home" ? 'aria-current="page"' : ""}>${icon("home")}みつける</button>
    <button data-act="guide" class="center">${icon("eye")}空を見る</button>
    <button data-act="logs" ${cur === "logs" ? 'aria-current="page"' : ""}>${icon("log")}観測ログ <span class="mono">${s.logs.length}</span></button>`;
}
const segment = () => `<div class="segment" role="group" aria-label="見るもの">
  <button data-act="subject" data-v="meteor" aria-pressed="${s.subject === "meteor"}" ${meteorEvent ? "" : "disabled"}>流星群</button>
  <button data-act="subject" data-v="iss" aria-pressed="${s.subject === "iss"}">ISS</button></div>`;
const where = (p) => (p.el > 0 ? `${dir8(p.az)}の空・高さ約${Math.round(p.el)}°（${fists(p.el)}）` : `地平線の下（${dir8(p.az)}の方）`);

function timelineSvg(n, now) {
  const t0 = n.dark.start.getTime() - 1800e3;
  const t1 = n.dark.end.getTime() + 1800e3;
  const W = 340, H = 110, top = 14, base = 86;
  const x = (t) => (((t - t0) / (t1 - t0)) * W).toFixed(1);
  const y = (el) => (base - (Math.max(0, el) / 90) * (base - top)).toFixed(1);
  const band = (a, b, cls) => `<rect x="${x(a)}" y="${top}" width="${(x(b) - x(a)).toFixed(1)}" height="${base - top}" ${cls}/>`;
  const moonRuns = [];
  let run = null;
  for (const sm of n.samples) {
    if (sm.moon.el > 0) run = run ?? { a: sm.date.getTime() };
    if (run) run.b = sm.date.getTime();
    if (sm.moon.el <= 0 && run) moonRuns.push(run), (run = null);
  }
  if (run) moonRuns.push(run);
  const curve = n.samples.map((sm, i) => `${i ? "L" : "M"}${x(sm.date.getTime())} ${y(sm.rad.el)}`).join("");
  const ticks = [];
  for (let t = Math.ceil(t0 / 7200e3) * 7200e3; t < t1; t += 7200e3) ticks.push(`<text x="${x(t)}" y="${H - 6}" class="tl-text" text-anchor="middle">${hm(new Date(t)).replace(/:00$/, "時")}</text>`);
  const nowX = now.getTime() > t0 && now.getTime() < t1 ? `<path d="M${x(now.getTime())} ${top - 6}V${base}" stroke="#ffb547" stroke-width="1.5"/><text x="${x(now.getTime())}" y="${top - 8}" class="tl-text" text-anchor="middle" style="fill:#ffb547">いま</text>` : "";
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="今夜の見ごろの図：放射点の高さと月">
    ${band(n.dark.start.getTime(), n.dark.end.getTime(), 'fill="rgba(94,242,194,.05)"')}
    ${moonRuns.map((r) => band(r.a, r.b, 'fill="rgba(255,181,71,.14)"')).join("")}
    ${n.best ? band(n.best.start.getTime(), n.best.end.getTime(), 'fill="rgba(94,242,194,.16)" stroke="rgba(94,242,194,.6)" stroke-dasharray="3 4"') : ""}
    <path d="M0 ${base}H${W}" stroke="rgba(217,244,234,.3)"/>
    <path d="${curve}" fill="none" stroke="#5ef2c2" stroke-width="2"/>
    ${n.best ? `<text x="${((Number(x(n.best.start.getTime())) + Number(x(n.best.end.getTime()))) / 2).toFixed(1)}" y="${top + 12}" class="tl-best" text-anchor="middle">見ごろ</text>` : ""}
    ${moonRuns.length ? `<text x="${(Number(x(moonRuns[0].a)) + 4).toFixed(1)}" y="${base - 4}" class="tl-text" style="fill:#ffb547">月</text>` : ""}
    ${ticks.join("")}${nowX}
  </svg>`;
}

function homeMeteor(now) {
  const ev = meteorEvent;
  const n = meteorTonight(now);
  const r = radiantNow(now);
  const lit = Math.round(moonLit(now) * 100);
  const rate = ev.rate?.value;
  const rateShort = rate ? rate.split("。")[0] : "—";
  return `<div class="eyebrow">TONIGHT · METEOR SHOWER</div>
    <h1 class="hero-title">${esc(ev.title.ja)}</h1>
    <p class="hero-sub">${esc(ev.when_label ?? "極大")}：${esc(ev.when.value.date.replace(/^\d+-0?(\d+)-0?(\d+)$/, "$1月$2日"))}ごろ。${esc(ev.summary?.value ?? "")}</p>
    <div class="big-now"><div class="caps mint">NOW · 放射点（${esc(s.pref?.name ?? "東京")}から）</div>
      <div class="val">${r.el > 0 ? `<b>${dir8(r.az)}</b>の空・高さ約${Math.round(r.el)}°` : `まだ<b>地平線の下</b>`}</div>
      <div class="small dim">${r.el > 0 ? `${fists(r.el)}。ここを中心に、空を広く見わたします` : n?.rise ? `${hm(n.rise)}ごろ ${dir8(radiantSky(ev.radiant.value, observer(), n.rise).az)} の空からのぼります` : "今夜の暗いあいだはのぼりません"}</div>
    </div>
    ${
      n
        ? `<div class="facts">
      <div class="fact"><div class="k">見ごろ（計算の目安）</div><div class="v">${n.best ? `${hm(n.best.start)}〜${hm(n.best.end)}` : "—"}</div></div>
      <div class="fact"><div class="k">月（明るい部分 ${lit}%）</div><div class="v">${n.moonSet ? `${hm(n.moonSet)}ごろ沈む` : n.moonRise ? `${hm(n.moonRise)}ごろのぼる` : n.moonUp.length ? "一晩じゅう空に" : "今夜は出ない"}</div></div>
      <div class="fact"><div class="k">空が暗い時間</div><div class="v">${hm(n.dark.start)}〜${hm(n.dark.end)}</div></div>
      <div class="fact"><div class="k">数の目安（国立天文台）</div><div class="v">${esc(rateShort)}</div></div>
    </div>
    <div class="timeline">${timelineSvg(n, now)}</div>`
        : ""
    }
    <div class="cta"><button class="primary" data-act="guide">空を見る ↗</button></div>
    <p class="note">流れ星は、放射点から四方へ、空のどこにでも流れます。放射点だけを見つめず、空を広く見てください。街の明かりが少ない、空の広い場所が向いています。<br>時刻・方角は${esc(s.pref?.name ?? "東京")}の県庁あたりでの計算の目安です。天気（雲）は考えていません。</p>
    <details class="src"><summary>出典と計算について</summary><ul>
      <li>極大の日：<a href="${esc(ev.when.source)}" target="_blank" rel="noopener">${esc(ev.when.note ?? ev.when.source)}</a></li>
      <li>放射点：<a href="${esc(ev.radiant.source)}" target="_blank" rel="noopener">${esc(ev.radiant.note ?? ev.radiant.source)}</a></li>
      ${rate ? `<li>数の目安：${esc(rate)}（<a href="${esc(ev.rate.source)}" target="_blank" rel="noopener">${esc(ev.rate.note ?? "出典")}</a>）</li>` : ""}
      ${ev.constellation?.stars ? `<li>星座の星の位置：<a href="${esc(ev.constellation.stars.source)}" target="_blank" rel="noopener">${esc(ev.constellation.stars.note ?? "出典")}</a></li>` : ""}
      <li>放射点・月の位置と「見ごろ」は、VOYASCOPE がブラウザで計算した目安です（月が沈んでいて、放射点が高さ25°以上の時間）</li>
    </ul></details>`;
}

function homeIss(now) {
  const { next } = issPasses(now);
  const cur = issNow(now);
  return `<div class="eyebrow">ISS · INTERNATIONAL SPACE STATION</div>
    <h1 class="hero-title">あの光を、<br>空で見つけよう。</h1>
    <div class="big-now"><div class="caps mint">NEXT · 見やすい通過（${esc(s.pref?.name ?? "東京")}）</div>
      ${
        next
          ? `<div class="val"><b>${esc(whenWord(next.start, now))}</b> ${esc(clockWord(next.start))}</div><div class="small dim">${dir8(next.startAz)}から${dir8(next.endAz)}へ・いちばん高いとき約${Math.round(next.maxEl)}°（${fists(next.maxEl)}）・約${Math.max(1, Math.round((next.end - next.start) / 60000))}分</div>`
          : `<div class="val">この先10日、見やすい通過はありません</div>`
      }
    </div>
    <div class="facts"><div class="fact"><div class="k">いまの ISS</div><div class="v">${where(cur)}</div></div>
      <div class="fact"><div class="k">見える条件</div><div class="v">${cur.el > 10 && cur.sunEl <= SUN_BELOW && cur.sunlit ? "いま見える" : "いまは見えない"}</div></div></div>
    <div class="cta"><button class="primary" data-act="guide">空を見る ↗</button></div>
    <p class="note">ISS は、空が暗く、ISS に日が当たっているときだけ見えます（日の入りのあと・日の出の前）。時刻と方角は、公開の軌道データから計算した${esc(s.pref?.name ?? "東京")}の県庁あたりでの目安です。</p>`;
}

function home() {
  const now = new Date();
  return `<section class="home">${segment()}${s.subject === "meteor" && meteorEvent ? homeMeteor(now) : homeIss(now)}</section>`;
}

// ---------- 記録・共有・ログ ----------
const METEOR_SKY = [
  { id: "clear", mark: "☀", label: "晴れ" },
  { id: "partly", mark: "⛅", label: "雲の合間" },
  { id: "cloudy", mark: "☁", label: "くもり" },
];
const ISS_SKY = [
  { id: "clear", mark: "☀", label: "見えた" },
  { id: "partly", mark: "⛅", label: "雲の間から" },
  { id: "cloudy", mark: "☁", label: "雲で見えず" },
];
function draftLog(now = new Date()) {
  if (s.subject === "meteor") {
    const ss = s.session ?? { start: now.getTime(), taps: [] };
    return { kind: "meteor", title: meteorEvent.title.ja, start: ss.start, end: now.getTime(), count: ss.taps.length, sky: s.sky };
  }
  const { recent, next } = issPasses(now);
  const pass = recent ?? (next && next.start - now < 30 * 60e3 ? next : null);
  return { kind: "iss", title: "ISS", start: (pass?.start ?? now).getTime?.() ?? now.getTime(), end: now.getTime(), sky: s.sky, pass: pass && { startAz: pass.startAz, endAz: pass.endAz, maxEl: pass.maxEl } };
}
function record() {
  const d = draftLog();
  const opts = d.kind === "meteor" ? METEOR_SKY : ISS_SKY;
  const min = Math.max(1, Math.round((d.end - d.start) / 60000));
  return `<section class="section"><div class="caps amber">OBS-LOG / NEW</div>
    <h2>${d.kind === "meteor" ? "今夜の空を、残す。" : "見えた空を、残す。"}</h2>
    <p class="lead">${d.kind === "meteor" ? `${esc(d.title)}・${min}分で <b class="amber">${d.count}個</b>` : d.pass ? `${dateTime(new Date(d.start))} の通過` : `${dateTime(new Date(d.start))}（通過の予測なし）`}。空のようすを選んで記録します。</p>
    <div class="choices" role="group" aria-label="空のようす">${opts.map((o) => `<button class="choice" data-act="sky" data-v="${o.id}" aria-pressed="${s.sky === o.id}"><b>${o.mark}</b>${o.label}</button>`).join("")}</div>
    <div class="compose"><div class="caps amber">PREVIEW</div><pre class="mono small" style="white-space:pre-wrap;margin:8px 0 0">${esc(logText(d))}</pre></div>
    <div class="row-actions"><button class="secondary" data-act="guide">空に戻る</button><button class="primary" data-act="save">この内容で記録</button></div>
    <p class="note">記録はこの端末の中だけに残ります（送りません）。場所（県）は文に入れません。</p></section>`;
}
function share() {
  const l = s.active;
  if (!l) return logs();
  return `<section class="section"><div class="caps amber">OBS-LOG / SHARE</div><h2>見た空を、記録に。</h2>
    <p class="lead">X に貼る文を作りました。直してから投稿できます。写真は、載せたい人だけ X の投稿画面で添えてください。</p>
    <div class="compose"><div class="caps amber">POST</div><textarea id="post" aria-label="投稿する文">${esc(l.text ?? logText(l))}</textarea>
      <button class="secondary" data-act="resetText" style="margin-top:6px;min-height:36px">自動の文に戻す</button></div>
    <div class="row-actions"><button class="secondary" data-act="copy">コピー</button><button class="primary" data-act="post">X で投稿 ↗</button></div>
    <div class="row-actions"><button class="secondary" data-act="logs">ログ一覧へ</button><button class="secondary" data-act="delete">この記録を消す</button></div>
    <p class="note">X へは自動で送りません。「X で投稿」で X の投稿画面を開きます。</p></section>`;
}
function logs() {
  return `<section class="section"><div class="caps mint">OBS-LOG / この端末</div><h2>見上げた記録。</h2>
    <p class="lead">試作の部屋の記録です。この端末のブラウザにだけ残ります。</p>
    ${
      s.logs.length
        ? s.logs
            .map(
              (l, i) => `<div class="log-item"><div><div class="t">${esc(l.title)} ${l.kind === "meteor" ? `<span class="amber">${l.count}個</span>` : ""}</div>
        <div class="m">${dateTime(new Date(l.start))} · ${l.kind === "meteor" ? `${Math.max(1, Math.round((l.end - l.start) / 60000))}分` : (ISS_SKY.find((o) => o.id === l.sky)?.label ?? "")}</div></div>
        <button class="secondary" data-act="open" data-v="${i}">開く ↗</button></div>`,
            )
            .join("")
        : `<div class="empty">✧<br>まだ記録はありません。<br>「空を見る」から始めましょう。</div>`
    }</section>`;
}

// ---------- 空を見る（かざす画面） ----------
let raf = 0;
let sensorState = {};
let Rsmooth = null;
let lastOrient = 0;
let wakeLock = null;

function guideHtml() {
  const met = s.subject === "meteor";
  return `<section class="guide" id="guide">
    <video id="cam" playsinline muted autoplay ${s.cam ? "" : "hidden"}></video>
    <canvas id="sky"></canvas>
    <div class="guide-top"><button class="circle-btn" data-act="home" aria-label="もどる">←</button>
      <div class="row"><button class="pill" data-act="sensor" id="sensor-btn">${s.sensor === "on" ? "向き：センサー" : "向きセンサーを使う"}</button>
      <button class="pill" data-act="calib">方位を合わせる</button>
      <button class="pill" data-act="camera" aria-pressed="${!!s.cam}">${s.cam ? "カメラ ●" : "カメラ"}</button>
      <button class="pill" data-act="night">●夜</button></div></div>
    <div class="guide-status" id="gstatus"></div>
    <div class="guide-spacer"></div>
    <div class="guide-bottom">
      <div class="steer"><div class="arr" id="arr">◎</div><div><div class="major" id="smajor"></div><div class="minor" id="sminor"></div></div></div>
      ${
        met
          ? `<div class="counter"><div class="count"><b id="count">${s.session?.taps.length ?? 0}</b><span id="timer">${s.session ? "" : "まだ"}</span></div>
        <button class="primary" data-act="tap">流れた！ ＋1</button></div>
        <div class="guide-actions">${s.cam ? `<button class="secondary" data-act="shot">写真</button>` : ""}<button class="secondary" data-act="undo" ${s.session?.taps.length ? "" : "disabled"}>1つ戻す</button><button class="secondary" data-act="finish">観測を終える</button></div>`
          : `<div class="guide-actions">${s.cam ? `<button class="secondary" data-act="shot">写真</button>` : ""}<button class="primary" data-act="seen">✓ 見えた！</button><button class="secondary" data-act="notseen">見えなかった</button></div>`
      }
      <p class="tiny dim">計算の目安です（県庁あたり）。スマホの方位は10〜20°ずれることがあります。最後は画面から目を離して、空で探してください。</p>
    </div></section>`;
}

// 端末の向き（センサー・指）→ 回転
function virtualRotation(view) {
  const f = enu(view.az, view.el);
  const r = [Math.cos(view.az / DEG), -Math.sin(view.az / DEG), 0];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  return [0, 1, 2].map((i) => [r[i], u[i], -f[i]]);
}
const norm = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l);
};
function smoothRotation(R) {
  const col = (M, j) => [M[0][j], M[1][j], M[2][j]];
  if (!Rsmooth) return (Rsmooth = R);
  const k = 0.25;
  let x = norm(col(Rsmooth, 0).map((v, i) => v * (1 - k) + col(R, 0)[i] * k));
  let y = col(Rsmooth, 1).map((v, i) => v * (1 - k) + col(R, 1)[i] * k);
  const d = x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  y = norm(y.map((v, i) => v - d * x[i]));
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  Rsmooth = [0, 1, 2].map((i) => [x[i], y[i], z[i]]);
  return Rsmooth;
}
function onOrient(ev) {
  if (ev.beta == null) return;
  let alpha = absoluteAlpha(ev, sensorState);
  sensorState.noNorth = alpha == null;
  if (alpha == null) alpha = ev.alpha ?? 0;
  // 合わせ（時計回り）は alpha（反時計回り）から引く
  let R = rotation(alpha - s.offset, ev.beta, ev.gamma ?? 0);
  // 画面が横向きなら、画面の座標に回す
  const th = (screen.orientation?.angle ?? window.orientation ?? 0) / DEG;
  if (th) {
    const [c, sn] = [Math.cos(-th), Math.sin(-th)];
    R = R.map((row) => [row[0] * c + row[1] * sn, -row[0] * sn + row[1] * c, row[2]]);
  }
  smoothRotation(R);
  lastOrient = performance.now();
  if (s.sensor !== "on") {
    s.sensor = "on";
    const b = $("#sensor-btn");
    if (b) b.textContent = "向き：センサー";
  }
}
async function enableSensor() {
  try {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== "granted") throw new Error("denied");
    }
  } catch {
    toast("向きのセンサーが使えませんでした。指で空を動かして探せます");
    s.sensor = "none";
    return;
  }
  window.removeEventListener("deviceorientationabsolute", onOrient);
  window.removeEventListener("deviceorientation", onOrient);
  if ("ondeviceorientationabsolute" in window) window.addEventListener("deviceorientationabsolute", onOrient);
  else window.addEventListener("deviceorientation", onOrient);
  setTimeout(() => {
    if (s.sensor !== "on") {
      s.sensor = "none";
      toast("この端末では向きのセンサーが届きません。指で空を動かして探せます");
    }
  }, 1500);
}

function currentRotation() {
  if (s.sensor === "on" && Rsmooth && performance.now() - lastOrient < 3000) return Rsmooth;
  if (!s.view) {
    const t = mainTarget();
    s.view = { az: t?.az ?? 90, el: Math.max(15, Math.min(70, t?.el ?? 20)) };
  }
  return virtualRotation(s.view);
}

// 空を描く（写真の合成にも使う）
function drawSky(ctx, w, h, R, now, { camera = false } = {}) {
  const vfov = 62;
  const P = (az, el) => project(R, az, el, { width: w, height: h, vfov });
  const f = h / 2 / Math.tan((vfov / 2) / DEG);
  const u = Math.max(1, w / 400); // 線の太さの単位
  if (!camera) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#030a17");
    g.addColorStop(1, "#0a1830");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const poly = (pts, style, width, dash = []) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    let pen = false;
    for (const p of pts) {
      if (p.behind || Math.abs(p.x) > w * 4 || Math.abs(p.y) > h * 4) {
        pen = false;
        continue;
      }
      if (pen) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
      pen = true;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const label = (x, y, text, color, size = 12, align = "left") => {
    ctx.font = `${Math.round(size * u)}px "Zen Kaku Gothic New", sans-serif`;
    ctx.textAlign = align;
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = "rgba(2,6,15,.85)";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  };
  // 高さの線（30°・60°）と地平線
  for (const el of [30, 60]) poly(Array.from({ length: 73 }, (_, i) => P(i * 5, el)), "rgba(94,242,194,.12)", 1 * u, [3 * u, 7 * u]);
  poly(Array.from({ length: 145 }, (_, i) => P(i * 2.5, 0)), "rgba(217,244,234,.55)", 1.5 * u);
  const DIRS = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
  DIRS.forEach((d, i) => {
    const p = P(i * 45, 0);
    if (p.behind || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 40) return;
    label(p.x, p.y + 18 * u, d, i === 0 ? "#ffb547" : "#d9f4ea", 13, "center");
    ctx.fillStyle = "#d9f4ea";
    ctx.fillRect(p.x - 0.75 * u, p.y - 6 * u, 1.5 * u, 12 * u);
  });
  // 月
  const moon = moonNow(now);
  const mp = P(moon.az, moon.el);
  if (!mp.behind && moon.el > -2) {
    ctx.strokeStyle = "#ffb547";
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    ctx.arc(mp.x, mp.y, 9 * u, 0, Math.PI * 2);
    ctx.stroke();
    label(mp.x + 13 * u, mp.y + 4 * u, "月", "#ffb547", 12);
  }
  if (s.subject === "meteor" && meteorEvent) {
    // 星座の線と星（出典つきのデータ）
    const c = meteorEvent.constellation;
    const stars = (c?.stars?.value ?? []).map((st) => ({ ...st, ...radiantSky(st, observer(), now) }));
    for (const [a, b] of c?.lines ?? []) {
      const A = stars[a], B = stars[b];
      if (A && B) poly([P(A.az, A.el), P(B.az, B.el)], "rgba(94,242,194,.6)", 1.5 * u);
    }
    for (const st of stars) {
      const p = P(st.az, st.el);
      if (p.behind) continue;
      ctx.fillStyle = "#e6f7ff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(2, 5 - st.mag) * u, 0, Math.PI * 2);
      ctx.fill();
      if (st.mag < 0.5) label(p.x + 8 * u, p.y - 6 * u, st.name.replace(/（.*）/, ""), "rgba(217,244,234,.85)", 11);
    }
    if (c?.name && stars.length) {
      const m = stars.reduce((acc, st) => ({ az: acc.az, el: Math.min(acc.el, st.el) }), { az: stars[0].az, el: 90 });
      const p = P(m.az, m.el - 4);
      if (!p.behind) label(p.x, p.y, c.name, "rgba(94,242,194,.8)", 12, "center");
    }
    // 放射点：半径6°の輪（「このあたり」）
    const r = radiantNow(now);
    const p = P(r.az, r.el);
    if (!p.behind) {
      const rad = f * Math.tan(6 / DEG);
      const g2 = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      g2.addColorStop(0, "rgba(94,242,194,.22)");
      g2.addColorStop(1, "rgba(94,242,194,0)");
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#5ef2c2";
      ctx.lineWidth = 2 * u;
      ctx.setLineDash([6 * u, 6 * u]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // 四方へ流れる向きの矢印（模式）
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.4;
        poly([{ x: p.x + Math.cos(a) * rad * 1.15, y: p.y + Math.sin(a) * rad * 1.15 }, { x: p.x + Math.cos(a) * rad * 1.7, y: p.y + Math.sin(a) * rad * 1.7 }], "rgba(217,244,234,.35)", 1.5 * u);
      }
      label(p.x, p.y - rad - 10 * u, "放射点", "#5ef2c2", 14, "center");
    }
  } else {
    // ISS：見える通過の道と、いまの位置
    const { recent, next } = issPasses(now);
    const pass = recent && recent.end >= now ? recent : next && next.start - now < 6 * 3600e3 ? next : null;
    if (pass) {
      poly(pass.track.map((t) => P(t.az, t.el)), "rgba(255,181,71,.9)", 2.5 * u, [8 * u, 6 * u]);
      const a = P(pass.track[0].az, pass.track[0].el);
      if (!a.behind) {
        ctx.fillStyle = "#ffb547";
        ctx.beginPath();
        ctx.arc(a.x, a.y, 5 * u, 0, Math.PI * 2);
        ctx.fill();
        label(a.x + 9 * u, a.y - 8 * u, `ここから ${hm(pass.start)}`, "#ffb547", 13);
      }
    }
    const cur = issNow(now);
    const p = P(cur.az, cur.el);
    if (!p.behind) {
      ctx.strokeStyle = "#5ef2c2";
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 * u, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#5ef2c2";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 * u, 0, Math.PI * 2);
      ctx.fill();
      const vis = cur.el > 10 && cur.sunEl <= SUN_BELOW && cur.sunlit;
      label(p.x + 14 * u, p.y + 4 * u, `ISS いま${cur.el < 0 ? "（地平線の下）" : vis ? "" : "（見えない時間）"}`, "#5ef2c2", 13);
    }
  }
  // 方位のテープ（画面の上。いま向いている方位の左右45°を、目盛りと8方位で）
  const camDir = cameraDir(R);
  const tapeY = 124 * u;
  const span = 45;
  ctx.fillStyle = "rgba(5,14,31,.6)";
  ctx.fillRect(0, tapeY - 20 * u, w, 30 * u);
  for (let az = Math.ceil((camDir.az - span) / 5) * 5; az <= camDir.az + span; az += 5) {
    const x = w / 2 + ((az - camDir.az) / span) * (w / 2);
    const a = ((az % 360) + 360) % 360;
    if (a % 45 === 0) label(x, tapeY, DIRS[a / 45], a === 0 ? "#ffb547" : "#d9f4ea", 13, "center");
    else {
      ctx.fillStyle = "rgba(217,244,234,.45)";
      ctx.fillRect(x - 0.5 * u, tapeY - (a % 15 === 0 ? 10 : 5) * u, 1 * u, (a % 15 === 0 ? 10 : 5) * u);
    }
  }
  ctx.fillStyle = "#ffb547";
  ctx.beginPath();
  ctx.moveTo(w / 2, tapeY + 4 * u);
  ctx.lineTo(w / 2 - 5 * u, tapeY + 11 * u);
  ctx.lineTo(w / 2 + 5 * u, tapeY + 11 * u);
  ctx.fill();
  // 真ん中の照準
  ctx.strokeStyle = "rgba(217,244,234,.7)";
  ctx.lineWidth = 1.2 * u;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 16 * u, 0, Math.PI * 2);
  ctx.moveTo(w / 2 - 6 * u, h / 2);
  ctx.lineTo(w / 2 + 6 * u, h / 2);
  ctx.moveTo(w / 2, h / 2 - 6 * u);
  ctx.lineTo(w / 2, h / 2 + 6 * u);
  ctx.stroke();
  // 目標が画面の外なら、ふちに矢印
  const t = mainTarget(now);
  if (t) {
    const q = P(t.az, t.el);
    const inside = !q.behind && q.x > 30 && q.x < w - 30 && q.y > 30 && q.y < h - 30;
    if (!inside) {
      const ang = Math.atan2(-q.dy, q.dx);
      const rr = Math.min(w, h) * 0.38;
      const x = w / 2 + Math.cos(ang) * rr, y = h / 2 + Math.sin(ang) * rr;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = "#ffb547";
      ctx.beginPath();
      ctx.moveTo(18 * u, 0);
      ctx.lineTo(-10 * u, -12 * u);
      ctx.lineTo(-4 * u, 0);
      ctx.lineTo(-10 * u, 12 * u);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

function steerText(now) {
  const t = mainTarget(now);
  const R = currentRotation();
  const cam = cameraDir(R);
  if (!t) return { arr: "◎", major: "見るものがありません", minor: "" };
  const absolute = `${dir8(t.az)}の空・${t.el > 0 ? fists(t.el) : "地平線の下"}`;
  if (t.el < 0) {
    const n = s.subject === "meteor" ? meteorTonight(now) : null;
    return { arr: "↓", major: `${t.label}はいま地平線の下`, minor: n?.rise ? `${hm(n.rise)}ごろ ${dir8(t.az)} の方からのぼります` : `${dir8(t.az)}の方の、地平線の下にあります` };
  }
  const st = steer(cam, t);
  if (st.sep < 12) {
    return s.subject === "meteor"
      ? { arr: "◎", major: "放射点はこのあたり", minor: "ここを中心に、空を広く見わたして。流れ星は空のどこにでも流れます" }
      : { arr: "◎", major: `${t.label}はこのあたり`, minor: absolute };
  }
  const h = Math.abs(st.daz) > 8 ? `${st.daz > 0 ? "右" : "左"}へ約${Math.round(Math.abs(st.daz) / 5) * 5}°` : "";
  const v = Math.abs(st.del) > 8 ? `${st.del > 0 ? "上" : "下"}へ約${Math.round(Math.abs(st.del) / 5) * 5}°` : "";
  const arrows = { "1,1": "↗", "1,-1": "↘", "-1,1": "↖", "-1,-1": "↙", "1,0": "→", "-1,0": "←", "0,1": "↑", "0,-1": "↓" };
  const key = `${h ? Math.sign(st.daz) : 0},${v ? Math.sign(st.del) : 0}`;
  return { arr: arrows[key] ?? "◎", major: [h, v].filter(Boolean).join("・") || "もう少し", minor: `${t.label}：${absolute}` };
}

function loop() {
  const cv = $("#sky");
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const now = new Date();
  drawSky(ctx, w, h, currentRotation(), now, { camera: !!s.cam });
  const st = steerText(now);
  $("#arr").textContent = st.arr;
  $("#smajor").textContent = st.major;
  $("#sminor").textContent = st.minor;
  const cam = cameraDir(currentRotation());
  $("#gstatus").textContent = `${s.sensor === "on" ? (sensorState.noNorth ? "SENSOR（北が分からない端末：方位を合わせて）" : "SENSOR") : "指で動かせます"} · いま ${dir8(cam.az)} ${Math.round(cam.az)}° / 高さ ${Math.round(cam.el)}°${s.offset ? ` · 合わせ ${s.offset > 0 ? "+" : ""}${Math.round(s.offset)}°` : ""}`;
  if (s.session) {
    const sec = Math.floor((Date.now() - s.session.start) / 1000);
    $("#timer") && ($("#timer").textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`);
  }
  raf = requestAnimationFrame(loop);
}

function bindDrag() {
  const cv = $("#sky");
  let last = null;
  cv.addEventListener("pointerdown", (e) => {
    if (s.sensor === "on") return;
    last = { x: e.clientX, y: e.clientY };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", (e) => {
    if (!last || s.sensor === "on") return;
    const k = 62 / cv.clientHeight;
    currentRotation();
    s.view.az = (s.view.az - (e.clientX - last.x) * k + 360) % 360;
    s.view.el = Math.max(-10, Math.min(89, s.view.el + (e.clientY - last.y) * k));
    last = { x: e.clientX, y: e.clientY };
  });
  cv.addEventListener("pointerup", () => (last = null));
  cv.addEventListener("pointercancel", () => (last = null));
}

async function keepAwake() {
  try {
    wakeLock = await navigator.wakeLock?.request("screen");
  } catch {
    wakeLock = null;
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && s.page === "guide") keepAwake();
});

async function toggleCamera() {
  if (s.cam) {
    s.cam.getTracks().forEach((t) => t.stop());
    s.cam = null;
    render();
    return;
  }
  try {
    s.cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    render();
  } catch {
    toast("カメラを開けませんでした（許可・端末を確かめてください）。カメラなしでも探せます");
  }
}

// 写真：カメラの画面に、空の印と観測ログの文字を重ねる（この端末の中で作る）
async function takePhoto() {
  const v = $("#cam");
  if (!v || v.readyState < 2) return toast("カメラの準備ができていません");
  const W = 1080, H = Math.round((W * (v.clientHeight || 1920)) / (v.clientWidth || 1080));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const sc = Math.max(W / v.videoWidth, H / v.videoHeight);
  g.drawImage(v, (W - v.videoWidth * sc) / 2, (H - v.videoHeight * sc) / 2, v.videoWidth * sc, v.videoHeight * sc);
  const now = new Date();
  drawSky(g, W, H, currentRotation(), now, { camera: true });
  const text = logText(draftLog(now)).split("\n").slice(0, 2).join("  ");
  const grd = g.createLinearGradient(0, H - 160, 0, H);
  grd.addColorStop(0, "rgba(5,14,31,0)");
  grd.addColorStop(1, "rgba(5,14,31,.9)");
  g.fillStyle = grd;
  g.fillRect(0, H - 160, W, 160);
  g.fillStyle = "#d9f4ea";
  g.font = '600 30px "JetBrains Mono", monospace';
  g.textAlign = "left";
  g.fillText(text.length > 60 ? text.slice(0, 60) + "…" : text, 36, H - 48);
  g.fillStyle = "#ffb547";
  g.font = '600 24px "JetBrains Mono", monospace';
  g.fillText("VOYASCOPE · 印は計算の目安", 36, H - 96);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
  s.photo = { blob, url: URL.createObjectURL(blob), text: logText(draftLog(now)) };
  sheetPhoto();
}

// ---------- シート ----------
function closeSheet() {
  $("#sheet").hidden = true;
  $("#sheet").innerHTML = "";
}
function sheetPref(first = false) {
  $("#sheet").hidden = false;
  $("#sheet").innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="県を選ぶ"><div class="caps mint">YOUR SKY</div>
    <h2>どこの空を見ますか？</h2>
    <p>県を選ぶと、その県庁あたりでの方角・高さ・時刻を計算します。位置情報（GPS）は使いません。選んだ県はこのブラウザにだけ保存します。</p>
    <select id="pref-select">${prefectures.map((p) => `<option value="${p.code}" ${p === (s.pref ?? prefectures.find((x) => x.name === "東京")) ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>
    <button class="primary" data-act="prefOk">この県にする</button>${first ? "" : `<button class="secondary" data-act="sheetClose">閉じる</button>`}</div>`;
}
function sheetCalib() {
  const moon = moonNow();
  $("#sheet").hidden = false;
  $("#sheet").innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="方位を合わせる"><div class="caps mint">CALIBRATE</div>
    <h2>方位を合わせる</h2>
    ${
      moon.el > 3 && s.sensor === "on"
        ? `<p>いま月が${dir8(moon.az)}の空に出ています。<b>月を画面の真ん中の丸に入れて</b>から「月に合わせる」を押すと、スマホの方位のずれを直せます。</p><button class="primary" data-act="calibMoon">月に合わせる</button>`
        : `<p>スマホの方位は、近くの金属や磁石で10〜20°ずれることがあります。${s.sensor === "on" ? "月が出ているときは、月で合わせられます。" : ""}知っている方角（建物・道の向き）と、画面の「北・東・南・西」が合うように動かしてください。</p>`
    }
    <label class="small dim" for="off">手で合わせる：<output id="offv" class="mono">${Math.round(s.offset)}°</output></label>
    <input type="range" id="off" min="-60" max="60" step="1" value="${Math.round(Math.max(-60, Math.min(60, s.offset)))}">
    <button class="secondary" data-act="calibReset">合わせを消す</button><button class="secondary" data-act="sheetClose">閉じる</button></div>`;
}
function sheetPhoto() {
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([s.photo.blob], "x.jpg", { type: "image/jpeg" })] }));
  $("#sheet").hidden = false;
  $("#sheet").innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="写真"><div class="caps mint">PHOTO · この端末の中で作りました</div>
    <img class="photo" src="${s.photo.url}" alt="カメラの画面に空の印を重ねた写真">
    ${canShare ? `<button class="primary" data-act="photoShare">写真と文を共有（X など）</button>` : ""}
    <button class="secondary" data-act="photoSave">画像を保存</button><button class="secondary" data-act="sheetClose">閉じる</button>
    <p class="tiny dim" style="margin-top:10px">夜空はスマホのカメラでは暗く写ることが多いです。印は計算の目安で、写真の中の本物の星とずれることがあります。人や家が写っていないか確かめてから共有してください。</p></div>`;
}

// ---------- 画面の切り替え ----------
function render() {
  cancelAnimationFrame(raf);
  header();
  tabs();
  const page = $("#page");
  if (s.page === "guide") {
    page.innerHTML = guideHtml();
    const v = $("#cam");
    if (s.cam && v) {
      v.srcObject = s.cam;
      v.play().catch(() => {});
    }
    bindDrag();
    keepAwake();
    raf = requestAnimationFrame(loop);
    return;
  }
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
  page.innerHTML = s.page === "home" ? home() : s.page === "record" ? record() : s.page === "share" ? share() : logs();
  page.scrollTop = 0;
}
const go = (p) => {
  s.page = p;
  render();
};

function saveLog() {
  const l = { id: `${Date.now()}`, ...draftLog() };
  s.logs.unshift(l);
  if (!saveLogs(s.logs)) toast("この端末に保存できませんでした（開いているあいだだけ残ります）");
  if (l.kind === "meteor") {
    s.session = null;
    writeJson(SESSION_KEY, null);
  }
  s.active = l;
  go("share");
}

$("#app").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act;
  const v = b.dataset.v;
  if (act === "home" || act === "logs") return go(act);
  if (act === "guide") return go("guide");
  if (act === "subject") {
    s.subject = v;
    s.view = null;
    return render();
  }
  if (act === "pref") return sheetPref();
  if (act === "prefOk") {
    s.pref = prefectures.find((p) => p.code === $("#pref-select").value) ?? s.pref;
    savePrefecture(s.pref?.code);
    closeSheet();
    return render();
  }
  if (act === "sheetClose") return closeSheet();
  if (act === "night") {
    document.documentElement.classList.toggle("night");
    try {
      localStorage.setItem("voyascope.lab.night", document.documentElement.classList.contains("night") ? "1" : "");
    } catch {}
    return s.page === "guide" ? null : header();
  }
  if (act === "sensor") return enableSensor();
  if (act === "calib") return sheetCalib();
  if (act === "calibMoon") {
    const cam = cameraDir(currentRotation());
    const moon = moonNow();
    s.offset = (((s.offset + (moon.az - cam.az)) + 540) % 360) - 180;
    writeJson(OFFSET_KEY, s.offset);
    closeSheet();
    return toast("月で方位を合わせました");
  }
  if (act === "calibReset") {
    s.offset = 0;
    writeJson(OFFSET_KEY, 0);
    return sheetCalib();
  }
  if (act === "camera") return toggleCamera();
  if (act === "tap") {
    if (!s.session) s.session = { start: Date.now(), taps: [] };
    s.session.taps.push(Date.now());
    writeJson(SESSION_KEY, s.session);
    navigator.vibrate?.(30);
    $("#count").textContent = s.session.taps.length;
    const u = $('[data-act="undo"]');
    if (u) u.disabled = false;
    return;
  }
  if (act === "undo") {
    s.session?.taps.pop();
    writeJson(SESSION_KEY, s.session);
    $("#count").textContent = s.session?.taps.length ?? 0;
    return;
  }
  if (act === "finish") {
    if (!s.session) s.session = { start: Date.now(), taps: [] };
    s.sky = "clear";
    return go("record");
  }
  if (act === "seen" || act === "notseen") {
    s.sky = act === "seen" ? "clear" : "cloudy";
    return go("record");
  }
  if (act === "sky") {
    s.sky = v;
    return render();
  }
  if (act === "save") return saveLog();
  if (act === "open") {
    s.active = s.logs[Number(v)];
    return go("share");
  }
  if (act === "resetText") {
    delete s.active.text;
    saveLogs(s.logs);
    return render();
  }
  if (act === "copy" || act === "post") {
    const text = $("#post").value;
    if (act === "post") return window.open(postUrl(text), "_blank", "noopener");
    try {
      await navigator.clipboard.writeText(text);
      toast("コピーしました");
    } catch {
      $("#post").select();
      toast("選んだ文をコピーしてください");
    }
    return;
  }
  if (act === "delete") {
    s.logs = s.logs.filter((l) => l !== s.active);
    saveLogs(s.logs);
    s.active = null;
    return go("logs");
  }
  if (act === "shot") return takePhoto();
  if (act === "photoShare") {
    try {
      await navigator.share({ files: [new File([s.photo.blob], `voyascope-${Date.now()}.jpg`, { type: "image/jpeg" })], text: s.photo.text });
    } catch {
      // 共有をやめたときも、ここに来る
    }
    return;
  }
  if (act === "photoSave") {
    const a = document.createElement("a");
    a.href = s.photo.url;
    a.download = `voyascope-${Date.now()}.jpg`;
    a.click();
    return;
  }
});
$("#app").addEventListener("input", (e) => {
  if (e.target.id === "post" && s.active) {
    s.active.text = e.target.value;
    saveLogs(s.logs);
  }
  if (e.target.id === "off") {
    s.offset = Number(e.target.value);
    writeJson(OFFSET_KEY, s.offset);
    $("#offv").textContent = `${s.offset}°`;
  }
});
window.addEventListener("pagehide", () => s.cam?.getTracks().forEach((t) => t.stop()));

try {
  if (localStorage.getItem("voyascope.lab.night")) document.documentElement.classList.add("night");
} catch {}
render();
if (!s.pref) sheetPref(true);
// 時刻で変わる表示（ホームの「いま」）を1分ごとに
setInterval(() => s.page === "home" && document.visibilityState === "visible" && !$("#sheet").innerHTML && render(), 60e3);
