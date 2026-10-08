// VOYASCOPE：地球＋環＋注目の機体＋詳細パネル＋タイムライン
import { satrecFromOrbit, positionAt, periodMinutes, groundTrack, SimClock } from "./orbit.js";
import { renderPanel, updatePanelLive, imageCredit } from "./card.js";
import { summarizeStatus } from "./status.js";
import { renderMinimap } from "./minimap.js";
import { setupEarth } from "./earth.js";
import { displayAltitude, RINGS } from "./scale.js";
import { FAMILIES, familyOf } from "./families.js";
import { starfieldDataUrl } from "./stars.js";
import { placeAt } from "./places.js";
import { esc, dateTimeShortJa, dateTimeJa, dateTimeCompactJa, durationJa, latJa, lngJa } from "./format.js";
import { findVisiblePasses, observerOf, dir8 } from "./passes.js";
import { renderTonight, renderPrefSelect, loadPrefecture, savePrefecture, whenWord, clockWord } from "./tonight.js";
import { upcomingEvents, eventsListHtml, eventPanelHtml, nextChipHtml, bigCountdown, whenShort, hmJst, eventSpan } from "./events.js";
import {
  worldLaunches,
  dataState,
  siteClusters,
  launchesListHtml,
  launchPanelHtml,
  bigLaunchCountdown,
  launchWhenShort,
  missionName,
  placeName,
  placeShort,
  jstShort,
  REF_NOTE,
} from "./launches.js";
import { activeMeteors, meteorHtml, meteorStoryHtml, radiantDirection, createStream } from "./meteors.js";
import { showsCraft, showsEvent, showsLaunch, loadView, saveView, isViewMode } from "./view.js";

const COLORS = {
  navy: "#07142b",
  mint: "#5ef2c2",
  atmosphere: "#7fc4ff",
};
// 軌道データの基準時刻からこれ以上離れたら、位置がずれている可能性を知らせる
const STALE_DAYS = 7;

const $ = (sel) => document.querySelector(sel);
// 地球の上と一覧に出す短い名前（日本語の愛称が長いときは英語の略称）
const shortName = (c) => (c.card.name.ja.length <= 7 ? c.card.name.ja : c.card.name.en.length <= 8 ? c.card.name.en : c.id.toUpperCase());

// 画面が狭いときは、一覧と詳細を下から出るシートにする（style.css と合わせる）
const isNarrow = () => matchMedia("(max-width: 900px)").matches;
// 予定の始まりの時刻（射場のピンを日付の順に並べるため）
const eventSpanStart = (ev) => eventSpan(ev)?.start ?? NaN;

// ---------- 起動画面のノイズ ----------
function startNoise(canvas) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const ctx = canvas.getContext("2d");
  const w = (canvas.width = 160);
  const h = (canvas.height = 100);
  const img = ctx.createImageData(w, h);
  let running = true;
  let last = 0;
  const frame = (t) => {
    if (!running) return;
    if (t - last > 70) {
      last = t;
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return () => (running = false);
}

// options：fetch に足す指定（あとから読む重いデータは priority: "low"。対応していないブラウザは無視する）
async function loadJson(path, options = {}) {
  const res = await fetch(path, { cache: "no-cache", ...options });
  if (!res.ok) {
    const err = new Error(`${path} を読み込めません（HTTP ${res.status}）`);
    err.status = res.status;
    err.path = path;
    throw err;
  }
  return res.json();
}

// 3D 表示のライブラリ（globe.gl、約500KB）を実行する。index.html の <link rel="preload"> で最初に読み始めているので、
// ここでは届いたものを実行するだけ。<script> をページに直接書くと、届くまでほかの部品とデータの読み込みが止まる
function loadGlobeLib() {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "vendor/globe.gl.min.js";
    s.onload = () => (typeof Globe === "function" ? resolve() : reject(new Error("3D表示のライブラリを読み込めません")));
    s.onerror = () => reject(new Error("3D表示のライブラリを読み込めません"));
    document.head.append(s);
  });
}

// 「観測を開始」を押せるまでに要るデータ
async function loadAll() {
  // 機体の一覧が届いたら、すぐに各機体のカードと軌道を読み始める（ほかのデータを待たない）
  const craftLoading = loadJson("data/craft-index.json").then((index) =>
    Promise.all(
      index.craft.map(async (c) => {
        const [card, orbit, crewData, status] = await Promise.all([
          loadJson(c.card),
          // 軌道データがまだない機体（自動取得の前など）は、表示しないだけにする
          c.orbit ? loadJson(c.orbit).catch((e) => (e.status === 404 ? null : Promise.reject(e))) : null,
          c.crew ? loadJson(c.crew).catch(() => null) : null,
          // 運用状況（自動取得）は、なければカードの「状態」だけを出す
          c.status ? loadJson(c.status).catch(() => null) : null,
        ]);
        return { id: c.id, card, orbit, crewData, status, sample: !!c.sample };
      }),
    ),
  );
  const [craft, prefs, eventsData, launchesData] = await Promise.all([
    craftLoading,
    loadJson("data/prefectures.json"),
    // 予定は、読めなくても地球と機体は出す
    loadJson("data/events.json").catch(() => ({ events: [] })),
    // 世界の打ち上げ（参考）も同じ。読めなければ「読み込めませんでした」と出す
    loadJson("data/launches.json").catch(() => null),
  ]);
  return { craft: craft.filter((c) => c.orbit), prefectures: prefs.prefectures, events: eventsData.events ?? [], launchesData };
}

// あとから読む重いデータ。「観測を開始」を押せるようになってから、裏で読み始める（起動を遅らせない）
// 読めなくても動く：地名がなければ座標だけ、陸地がなければ海と軌跡だけを出す
function loadLater() {
  return {
    // 「いま、どこの上？」の地名
    places: loadJson("data/places.json", { priority: "low" }).catch(() => null),
    // ミニ地図の陸地（計算済みの path）
    land: loadJson("data/land-minimap.json", { priority: "low" })
      .then((d) => d.d)
      .catch(() => null),
  };
}

// ---------- 観測画面 ----------
function startApp({ craft, prefectures, events, launchesData, later }) {
  const clock = new SimClock();
  let roomOpen = false; // 遠くを見る部屋を開いているか

  // 機体ごとの準備（軌道・家族・地球の上の印）
  for (const c of craft) {
    c.satrec = satrecFromOrbit(c.orbit);
    c.period = periodMinutes(c.satrec);
    c.family = familyOf(c.card.class);
    c.lat = 0;
    c.lng = 0;
    c.alt = 0;
    c.pos = null;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "craft-marker";
    el.style.setProperty("--c", c.family.color);
    el.setAttribute("aria-label", `${c.card.name.ja} の詳細を開く`);
    el.innerHTML = `<span class="ring"></span><span class="core"></span><span class="tag">${esc(shortName(c))}</span>`;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      select(c);
    });
    c.el = el;
  }

  // ---------- 予定：射場のピン（打ち上げの予定。打ち上がるまで軌道は描かない） ----------
  const plannedFamily = FAMILIES.find((f) => f.id === "planned");
  const sites = events
    .filter((ev) => ev.kind === "launch" && ev.site?.position?.value)
    .map((ev) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "site-marker";
      el.style.setProperty("--c", plannedFamily.color);
      el.setAttribute("aria-label", `${ev.title.ja}（${ev.site.label}）の予定を開く`);
      el.innerHTML = `<span class="diamond"></span><span class="tag"></span>`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        selectEvent(ev);
      });
      const { lat, lng } = ev.site.position.value;
      return { ev, el, lat, lng, alt: 0.012, shown: false };
    });

  // ---------- 世界の打ち上げ（参考）：射場のピン。点線のひし形と「参考」の印。「予定」タブを開いたときだけ出す ----------
  // 近い射場（ケネディとケープカナベラルなど）は1本にまとめ、いちばん近い打ち上げの名前と日付を出す
  const worldPins = siteClusters(launchesData?.launches ?? []).map((cl) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "site-marker is-ref";
    el.setAttribute("aria-describedby", "ref-note");
    el.innerHTML = `<span class="diamond"></span><span class="tag"><span class="tag-text"></span> <span class="ref-mark">参考</span></span><span class="ref-tip" aria-hidden="true">${esc(REF_NOTE)}</span>`;
    const pin = { el, lat: cl.position.lat, lng: cl.position.lng, alt: 0.012, launches: cl.launches, first: null, shown: false };
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (pin.first) selectLaunch(pin.first);
    });
    return pin;
  });

  // 軌道データの取得日（いちばん古いもの）
  const oldest = craft.reduce((a, c) => (!a || c.orbit.fetched_at < a.orbit.fetched_at ? c : a), null);
  $("#tle-info").textContent = `軌道データ取得：${dateTimeShortJa(new Date(oldest.orbit.fetched_at))}`;
  $("#about-tle").textContent = craft
    .map(
      (c) =>
        `${c.card.name.ja}：取得 ${dateTimeJa(new Date(c.orbit.fetched_at))}／基準時刻（エポック） ${dateTimeJa(new Date(c.orbit.epoch))}／出典 ${c.orbit.source}`,
    )
    .join("\n");

  // ---------- 環 ----------
  const ringPaths = RINGS.map((r) => ({
    ...r,
    points: Array.from({ length: 73 }, (_, i) => [0, -180 + i * 5, r.alt]),
  }));
  let showRings = true;
  // 選んだ機体の軌道（前後に半周ずつ、1周分）。地球と一緒に回る座標なので、低軌道の線は1周で閉じない
  let orbitPath = null;
  let orbitFor = null;
  let orbitAt = 0;
  const refreshPaths = () => globe.pathsData([...(showRings ? ringPaths : []), ...(orbitPath ? [orbitPath] : [])]);
  const updateOrbitPath = (now) => {
    orbitFor = selected;
    orbitAt = now.getTime();
    // 静止軌道の機体はほとんど動かないので線を引かない（環で分かる）
    if (!selected || !(selected.period < 600)) {
      if (orbitPath) {
        orbitPath = null;
        refreshPaths();
      }
      return;
    }
    const half = selected.period / 2;
    const step = Math.max(0.5, selected.period / 240);
    const points = [];
    for (let m = -half; m <= half; m += step) {
      const p = positionAt(selected.satrec, new Date(orbitAt + m * 60000));
      if (p) points.push([p.lat, p.lng, displayAltitude(p.altKm)]);
    }
    orbitPath = { solid: true, color: [`${selected.family.color}22`, `${selected.family.color}ee`, `${selected.family.color}22`], points };
    refreshPaths();
  };

  // ---------- 地球 ----------
  const app = $("#app");
  const globeEl = $("#globe");
  const hidden = new Set(); // 表示しない家族（凡例・スマホの一覧のタブ）
  let viewMode = loadView(); // 表示切替：すべて／日本のみ／衛星のみ／打ち上げ予定のみ（view.js）
  const markerData = () => craft.filter((c) => c.pos && !hidden.has(c.family.id) && showsCraft(viewMode, c.card));
  // 射場のピン：公式の予定と、世界の打ち上げ（参考）。表示切替で絞る。選んでいる打ち上げのピンはいつも出す
  const siteData = () =>
    hidden.has("planned")
      ? []
      : [
          ...sites.filter((s) => s.shown && showsEvent(viewMode, s.ev)),
          ...worldPins.filter((p) => p.shown && (showsLaunch(viewMode, p.first) || p.launches.includes(selectedLaunch))),
        ];
  const globe = Globe({ animateIn: true })(globeEl)
    .backgroundColor(COLORS.navy)
    .showAtmosphere(true)
    .atmosphereColor(COLORS.atmosphere)
    .atmosphereAltitude(0.16)
    .showGraticules(false)
    .pathsData(ringPaths)
    .pathPoints("points")
    .pathPointLat((p) => p[0])
    .pathPointLng((p) => p[1])
    .pathPointAlt((p) => p[2])
    .pathColor((d) => d.color ?? "rgba(94, 242, 194, 0.38)")
    .pathDashLength((d) => (d.solid ? 1 : 0.012))
    .pathDashGap((d) => (d.solid ? 0 : 0.008))
    .pathStroke((d) => (d.solid ? 1.2 : null))
    .pathTransitionDuration(0)
    .htmlElementsData([])
    .htmlLat("lat")
    .htmlLng("lng")
    .htmlAltitude("alt")
    .htmlElement((d) => d.el)
    .htmlTransitionDuration(0);

  // 流星群のちり（イメージ）：放射点の方向から地球へ近づき、大気に飛び込んで流れ星になる。「すべて」の表示のときだけ
  // 地球の上に透明なキャンバスを重ねて描く（丸くぼけた小さな光・瞬き・尾・消えていく流れ星）
  const dustCanvas = document.createElement("canvas");
  dustCanvas.className = "dust-layer";
  dustCanvas.setAttribute("aria-hidden", "true");
  globeEl.appendChild(dustCanvas);
  const dctx = dustCanvas.getContext("2d");
  let dustDrawn = false;
  const drawDust = (frame) => {
    const w = globeEl.clientWidth;
    const h = globeEl.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (dustCanvas.width !== Math.round(w * dpr) || dustCanvas.height !== Math.round(h * dpr)) {
      dustCanvas.width = Math.round(w * dpr);
      dustCanvas.height = Math.round(h * dpr);
    }
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (dustDrawn) dctx.clearRect(0, 0, w, h);
    dustDrawn = !!frame;
    if (!frame) return;
    const cam = globe.camera().position;
    const R = globe.getGlobeRadius();
    const cc = cam.x * cam.x + cam.y * cam.y + cam.z * cam.z - R * R;
    // 地球の陰（カメラから見て地球の向こう）なら null
    const screen = ({ lat, lng, alt }) => {
      const p = globe.getCoords(lat, lng, alt);
      const dx = p.x - cam.x;
      const dy = p.y - cam.y;
      const dz = p.z - cam.z;
      const aa = dx * dx + dy * dy + dz * dz;
      const bb = 2 * (cam.x * dx + cam.y * dy + cam.z * dz);
      const disc = bb * bb - 4 * aa * cc;
      if (disc > 0) {
        const t1 = (-bb - Math.sqrt(disc)) / (2 * aa);
        if (t1 > 0 && t1 < 1) return null;
      }
      return globe.getScreenCoords(lat, lng, alt);
    };
    dctx.globalCompositeOperation = "lighter";
    dctx.lineCap = "round";
    for (const p of frame.points) {
      const head = screen(p);
      if (!head) continue;
      const tail = screen(p.tail);
      if (tail) {
        const g = dctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
        g.addColorStop(0, "rgba(160, 225, 255, 0)");
        g.addColorStop(1, `rgba(170, 230, 255, ${(0.35 * p.glow).toFixed(3)})`);
        dctx.strokeStyle = g;
        dctx.lineWidth = 0.8;
        dctx.beginPath();
        dctx.moveTo(tail.x, tail.y);
        dctx.lineTo(head.x, head.y);
        dctx.stroke();
      }
      const r = 1.1 + 1.2 * p.glow;
      const g = dctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, r * 2.2);
      g.addColorStop(0, `rgba(225, 245, 255, ${(0.9 * p.glow).toFixed(3)})`);
      g.addColorStop(1, "rgba(160, 225, 255, 0)");
      dctx.fillStyle = g;
      dctx.beginPath();
      dctx.arc(head.x, head.y, r * 2.2, 0, Math.PI * 2);
      dctx.fill();
    }
    for (const f of frame.flashes) {
      const a = screen(f);
      const b = screen(f.end);
      if (!a || !b) continue;
      const k = f.life * f.life * f.bright; // 消えるときは早く暗くなる
      const g = dctx.createLinearGradient(a.x, a.y, b.x, b.y);
      g.addColorStop(0, "rgba(255, 220, 150, 0)");
      g.addColorStop(1, `rgba(255, 236, 190, ${k.toFixed(3)})`);
      dctx.strokeStyle = g;
      dctx.lineWidth = 3.2;
      dctx.globalAlpha = 0.35;
      dctx.beginPath();
      dctx.moveTo(a.x, a.y);
      dctx.lineTo(b.x, b.y);
      dctx.stroke();
      dctx.globalAlpha = 1;
      dctx.lineWidth = 1.2;
      dctx.stroke();
      const hg = dctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 4);
      hg.addColorStop(0, `rgba(255, 250, 230, ${k.toFixed(3)})`);
      hg.addColorStop(1, "rgba(255, 210, 122, 0)");
      dctx.fillStyle = hg;
      dctx.beginPath();
      dctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      dctx.fill();
    }
    dctx.globalCompositeOperation = "source-over";
  };
  const stream = createStream(240);
  const streamStill = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let streamAt = 0;
  let streamOn = false;
  let streamEv = null;
  let streamDir = null;
  const radiantEl = document.createElement("button");
  radiantEl.type = "button";
  radiantEl.className = "radiant-marker";
  radiantEl.addEventListener("click", (e) => {
    e.stopPropagation();
    if (streamEv) selectEvent(streamEv);
  });
  const radiantData = () =>
    streamEv && streamDir ? [{ el: radiantEl, lat: streamDir.lat, lng: streamDir.lng, alt: 1.1 }] : [];
  const updateStream = (t, now) => {
    const ev = viewMode === "all" ? activeMeteors(events, now)[0] : null;
    if (!ev) {
      if (streamOn) drawDust(null);
      streamOn = false;
      streamEv = null;
      return;
    }
    if (ev !== streamEv) {
      streamEv = ev;
      radiantEl.innerHTML = `<span class="radiant-arrow" aria-hidden="true">↓</span><span class="tag">${esc(ev.title.ja.replace(/（.*）/, ""))}のちりが来る方向<span class="ref-mark">イメージ</span></span>`;
      radiantEl.setAttribute("aria-label", `${ev.title.ja}：ちりが来る方向（イメージ）。詳細を開く`);
    }
    if (t - streamAt < 33) return;
    const dt = streamStill ? 0 : Math.min((t - streamAt) / 1000, 0.1);
    streamAt = t;
    streamDir = radiantDirection(ev.radiant.value, now);
    drawDust(stream.step(dt, streamDir.u));
    streamOn = true;
  };

  // 「いま、どこの上？」の地名（重いので、起動のあとに裏で読んでいる。届くまでは座標だけを出す）
  let places = null;
  later.places.then((d) => (places = d));

  // 地球のまわりの星空（飾り。地球を回すと一緒に動く）
  globe.backgroundImageUrl(starfieldDataUrl());

  // 写実的な地球（昼と夜の境目は観測時刻に合わせて動く）
  const updateEarth = setupEarth(globe);
  let lastEarthAt = 0;

  const controls = globe.controls();
  controls.minDistance = 130;
  controls.maxDistance = 1100;

  // パネルで隠れない位置に地球を置く
  const detailPanel = $("#detail-panel");
  const layoutGlobe = () => {
    globe.width(globeEl.clientWidth).height(globeEl.clientHeight);
    placeGlobe();
  };
  // 地球の位置だけを直す（大きさは変えないので軽い）
  const placeGlobe = () => {
    if (isNarrow()) {
      // 下からシートが出ているときは、上のバーとシートの間の真ん中に地球を置く
      const sheetTops = [...document.querySelectorAll(".side-panel")]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.height > 0)
        .map((r) => r.top);
      const top = $(".top-bar").offsetHeight + ($("#view-switch")?.offsetHeight ?? 0);
      const dy = sheetTops.length ? Math.round((top + Math.min(...sheetTops)) / 2 - globeEl.clientHeight / 2) : -40;
      setOffset(0, dy);
    } else setOffset(!detailPanel.hidden ? -20 : nextPanelShown() ? 0 : 150, -30);
  };
  // 右の「次の出来事」の列（PC の広い画面）が出ているか。出し分けは style.css（詳細・一覧の「予定」のあいだは出さない）
  const nextPanel = $("#next-panel");
  const nextPanelShown = () => getComputedStyle(nextPanel).display !== "none";
  let lastOffset = "";
  const setOffset = (x, y) => {
    if (`${x},${y}` === lastOffset) return;
    lastOffset = `${x},${y}`;
    globe.globeOffset([x, y]);
  };
  addEventListener("resize", layoutGlobe);
  layoutGlobe();
  // 下のバーの実際の高さを、パネルや注記の位置に使う
  const bottomBar = $(".bottom-bar");
  new ResizeObserver(() => app.style.setProperty("--bottom-h", `${bottomBar.offsetHeight}px`)).observe(bottomBar);
  const topBar = $(".top-bar");
  new ResizeObserver(() => app.style.setProperty("--top-h", `${topBar.offsetHeight}px`)).observe(topBar);
  // シートの開け閉め・高さの変化に合わせて地球の位置を直す
  const sheetObserver = new ResizeObserver(() => isNarrow() && placeGlobe());
  for (const el of document.querySelectorAll(".side-panel")) sheetObserver.observe(el);

  const first = craft[0] && positionAt(craft[0].satrec, clock.now());
  // スマホの縦長の画面では、静止軌道の環が横幅に収まるところまで引いて見る
  const startAltitude = () => {
    if (!isNarrow()) return 3.2;
    const tanHalf = Math.tan(((globe.camera().fov * Math.PI) / 180) / 2) * (globe.width() / globe.height());
    const geoRadius = 1 + RINGS.find((r) => r.id === "geo").alt; // 地球の半径を1としたとき
    return Math.min(9, Math.max(5, (geoRadius * 1.1) / tanHalf - 1));
  };
  globe.pointOfView({ lat: first?.lat ?? 25, lng: first?.lng ?? 135, altitude: startAltitude() }, 0);

  // ---------- 注目の一覧と家族 ----------
  const present = FAMILIES.filter((f) => craft.some((c) => c.family.id === f.id));
  let listFilter = "all";
  let query = "";
  let selected = null;
  let selectedEvent = null; // 詳細に出している予定（機体を選んでいるときは null）
  let selectedLaunch = null; // 詳細に出している世界の打ち上げ（参考）
  const famTabs = $("#fam-tabs");
  const listEl = $("#craft-list");
  const renderFamTabs = () => {
    const tab = (f) =>
      `<button type="button" class="fam-tab" data-fam="${f.id}" aria-pressed="${f.id === listFilter}"><span class="fam-label">${esc(f.label)}</span><span class="fam-bold" aria-hidden="true">${esc(f.label)}</span></button>`;
    // 太字の見えない文字を重ねて、選んだとき（太字）でもタブの幅が変わらない（ほかのタブがずれない）ようにする
    // 左は家族で絞るタブ。右の2つは見る画面の切り替え：「予定」は次の出来事（公式の日付）、「観測」は今夜の空（ISS の見える通過）
    famTabs.innerHTML =
      `<span class="fam-group">${[{ id: "all", label: "すべて" }, ...present].map(tab).join("")}</span>` +
      `<span class="fam-group fam-views">${[{ id: "planned", label: "予定" }, { id: "tonight", label: "観測" }].map(tab).join("")}</span>`;
    fitFamTabs();
  };
  // PC：タブが1行に入らないとき（ブラウザの文字を大きくしているときなど）は、入る大きさまで文字だけを小さくする
  // すき間と余白は px なので、文字の幅だけが割合で縮む。10px より小さくはしない（それでも入らなければ横に送る）
  const fitFamTabs = () => {
    famTabs.style.removeProperty("--fam-fit");
    if (isNarrow() || !famTabs.clientWidth) return;
    const over = famTabs.scrollWidth - famTabs.clientWidth;
    if (over <= 0) return;
    const tabs = [...famTabs.querySelectorAll(".fam-tab")];
    const textWidth = tabs.reduce((sum, t) => {
      const cs = getComputedStyle(t);
      const edges = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"].reduce((a, k) => a + parseFloat(cs[k]), 0);
      return sum + t.getBoundingClientRect().width - edges;
    }, 0);
    const fontPx = parseFloat(getComputedStyle(tabs[0]).fontSize);
    const fit = Math.max(10 / fontPx, (textWidth - over - 2) / textWidth); // 2px は丸めの分の余裕
    famTabs.style.setProperty("--fam-fit", fit.toFixed(3));
  };
  // 名前（日本語・英語・id）で探す。全角・半角や大文字・小文字の違いは無視する
  const fold = (t) => String(t ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  const matchesQuery = (c, q) => {
    const f = fold(q);
    return !f || [c.card.name.ja, c.card.name.en, c.id].some((t) => fold(t).includes(f));
  };
  // 状態の点：運用中は緑、止まっている／止まる予定は琥珀、分からなければ灰色
  const statusPip = (c) => {
    const s = summarizeStatus(c.card, c.status, new Date());
    if (s.badge) return "warn";
    return s.base?.value === "operating" ? "ok" : "unknown";
  };
  // 止まっている／止まる予定のお知らせがある機体に小さな札を付ける（実際の今で判断）
  const statusBadge = (c) => {
    const { badge } = summarizeStatus(c.card, c.status, new Date());
    return badge ? ` <span class="st-badge${badge === "停止中" ? " down" : ""}">${badge}</span>` : "";
  };
  const renderList = () => {
    const shown = craft
      .filter((c) => listFilter === "all" || listFilter === "tonight" || c.family.id === listFilter)
      .filter((c) => showsCraft(viewMode, c.card))
      .filter((c) => matchesQuery(c, query));
    if (!shown.length) {
      listEl.innerHTML = query
        ? `<li class="list-empty k">「${esc(query)}」に当たる機体はありません。</li>`
        : `<li class="list-empty k">この表示に当たる機体はありません。</li>`;
      return;
    }
    listEl.innerHTML = shown
      .map(
        (c) => `<li><button type="button" class="craft-item" data-id="${c.id}" aria-current="${c === selected}">
          ${
            c.card.image
              ? `<span class="craft-thumb" style="--c:${c.family.color}" aria-hidden="true"><img src="${esc(c.card.image.file)}" alt="" loading="lazy"></span>`
              : `<span class="craft-icon" style="--c:${c.family.color}" aria-hidden="true"></span>`
          }
          <span class="craft-names"><span class="craft-id">${esc(shortName(c))}</span><span class="craft-ja">${esc(c.card.name.en)}${statusBadge(c)}</span></span>
          <span class="craft-alt mono"><span class="st-pip ${statusPip(c)}" aria-hidden="true"></span><span data-alt="${c.id}">--</span></span>
          <span class="chev" aria-hidden="true">›</span>
        </button></li>`,
      )
      .join("");
  };
  // 「観測」タブは今夜の空、「予定」タブは次の出来事を、機体の一覧の代わりに出す
  const tonightSection = $("#tonight-section");
  const eventsSection = $("#events-section");
  const worldSection = $("#world-section");
  // fromView：表示切替から呼ばれたとき（表示切替を呼び返さない）
  const showListFilter = (id, { fromView = false } = {}) => {
    listFilter = id;
    const tonight = id === "tonight";
    const planned = id === "planned";
    tonightSection.hidden = !tonight;
    eventsSection.hidden = !planned;
    worldSection.hidden = !planned;
    listEl.hidden = tonight || planned;
    $("#list-title").hidden = tonight || planned;
    app.classList.toggle("list-planned", planned);
    placeGlobe();
    // 一覧と地球をそろえる：「予定」タブは「打ち上げ予定のみ」。予定から離れたら「すべて」に戻す
    if (!fromView) {
      if (planned && viewMode !== "launches") setView("launches", { fromList: true });
      else if (!planned && viewMode === "launches") setView("all", { fromList: true });
    }
    renderFamTabs();
    renderList();
    if (planned) renderEvents();
  };
  famTabs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fam]");
    if (!b) return;
    showListFilter(b.dataset.fam);
    if (isNarrow()) showOnlyFamily(b.dataset.fam);
  });
  const searchEl = $("#craft-search");
  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    if (listFilter === "tonight" || listFilter === "planned") showListFilter("all");
    else renderList();
  });
  listEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-id]");
    if (b) select(craft.find((c) => c.id === b.dataset.id));
  });

  const legend = $("#fam-legend");
  legend.innerHTML = FAMILIES.filter((f) => f.id !== "other")
    .map(
      (f) =>
        `<label class="toggle"><input type="checkbox" data-fam="${f.id}" checked><span class="fam-dot fam-${f.id}" style="--c:${f.color}"></span>${esc(f.label)}</label>`,
    )
    .join("");
  legend.addEventListener("change", (e) => {
    const id = e.target.dataset.fam;
    if (!id) return;
    if (e.target.checked) hidden.delete(id);
    else hidden.add(id);
  });
  // スマホ：一覧のタブで選んだ家族だけを地球にも出す（「予定」は射場のピンだけ。「すべて」「観測」は全部）
  function showOnlyFamily(id) {
    hidden.clear();
    if (id === "planned" || present.some((f) => f.id === id)) for (const f of FAMILIES) if (f.id !== id) hidden.add(f.id);
    for (const input of legend.querySelectorAll("input")) input.checked = !hidden.has(input.dataset.fam);
  }
  // ---------- 表示切替（地球の上）：すべて／日本のみ／衛星のみ／打ち上げ予定のみ。一覧も合わせる ----------
  const viewSwitch = $("#view-switch");
  // fromList：一覧のタブから呼ばれたとき（家族ごとの表示と一覧のタブはそのまま）
  function setView(mode, { fromList = false } = {}) {
    if (!isViewMode(mode)) return;
    viewMode = mode;
    saveView(mode);
    for (const b of viewSwitch.querySelectorAll("[data-view]")) b.setAttribute("aria-pressed", String(b.dataset.view === mode));
    if (!fromList) {
      // 表示切替は表示の組み合わせのひな形なので、凡例（スマホは一覧のタブ）で消したものも全部に戻す。
      // 一覧も合わせる：打ち上げ予定のみ → 予定タブ。ほかは家族のタブ・予定タブから「すべて」へ（観測タブはそのまま）
      hidden.clear();
      for (const input of legend.querySelectorAll("input")) input.checked = true;
      if (mode === "launches") {
        if (listFilter !== "planned") showListFilter("planned", { fromView: true });
      } else if (listFilter !== "all" && listFilter !== "tonight") showListFilter("all", { fromView: true });
    }
    $("#list-title").textContent = mode === "japan" ? "注目・日本のみ" : "注目";
    $("#events-sub").textContent = $("#next-panel-sub").textContent = mode === "japan" ? "日本のものだけ・公式の日付だけ" : "日本と世界・公式の日付だけ";
    updateRoomNav();
    renderList();
    renderEvents();
  }
  // 押したときは、見どころへ地球を向ける：日本のみ → 日本、打ち上げ予定のみ → 次の打ち上げの射場
  // （一覧の先頭と同じく、公式の予定を先に。なければ世界の打ち上げ（参考）のいちばん近いもの）
  const JAPAN_VIEW = { lat: 36, lng: 138 };
  function lookForView(mode) {
    if (follow) return;
    if (mode === "japan") return globe.pointOfView(JAPAN_VIEW, 900);
    if (mode !== "launches") return;
    const next = siteData()
      .map((p) => ({ p, official: !!p.ev, t: p.ev ? eventSpanStart(p.ev) : Date.parse(p.first?.net ?? "") }))
      .filter((x) => Number.isFinite(x.t))
      .sort((a, b) => b.official - a.official || a.t - b.t)[0];
    if (next) globe.pointOfView({ lat: next.p.lat, lng: next.p.lng }, 900);
  }
  viewSwitch.addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    setView(b.dataset.view);
    lookForView(b.dataset.view);
  });
  // ---------- 部屋の帯（PC）：地球のまわり・遠くを見る・これから行く（2026-10-04 オーナー：イメージ図の A 案） ----------
  // 「これから行く」＝打ち上げ予定のみの表示（射場のピン）と一覧の「予定」。「地球のまわり」に戻ると「すべて」。
  // 「遠くを見る」は、下の「遠くを見る部屋」のところで開く。PC では、地球の上の「遠くを見る」と「打ち上げ予定のみ」は帯と同じなので出さない（style.css）
  const roomNav = $("#room-nav");
  function updateRoomNav() {
    const room = viewMode === "launches" ? "launch" : "earth";
    for (const b of roomNav.querySelectorAll('[data-room]:not([data-room="far"])')) {
      if (b.dataset.room === room) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    }
  }
  roomNav.addEventListener("click", (e) => {
    const b = e.target.closest("[data-room]");
    if (!b || b.dataset.room === "far") return;
    if (b.dataset.room === "earth") {
      if (viewMode === "launches") setView("all"); // 日本のみ・衛星のみの表示のときは、そのまま
      return;
    }
    if (viewMode !== "launches") setView("launches");
    lookForView("launches");
  });

  // 環：PC は下のバー、スマホは一覧の下。どちらで切り替えても両方そろえる
  const ringInputs = [$("#rings-toggle"), $("#rings-toggle-list")];
  for (const input of ringInputs) {
    input.addEventListener("change", () => {
      showRings = input.checked;
      for (const other of ringInputs) other.checked = showRings;
      refreshPaths();
      $(".scale-note").hidden = !showRings;
    });
  }

  const listPanel = $("#list-panel");
  $("#list-open").addEventListener("click", () => {
    listPanel.classList.toggle("open");
    // 一覧は選ぶための画面なので、スマホでは全部の高さで開く（つまみで半分にできる）
    setExpanded(listPanel, listPanel.classList.contains("open"));
    if (isNarrow() && listPanel.classList.contains("open")) closeDetail();
  });

  // ---------- 詳細パネル ----------
  const detailBody = $("#detail-body");
  let tab = "overview";
  let lastMapAt = 0;
  // ミニ地図の陸地（起動のあとに裏で読んでいる。届いたら、開いている詳細のミニ地図を描き直す）
  let landD = "";
  later.land.then((d) => {
    if (!d) return;
    landD = d;
    updateDetailLive(true);
  });
  const updateDetailLive = (force = false) => {
    if (selectedLaunch && !detailPanel.hidden) {
      // 世界の打ち上げ（参考）：予定の時刻までの残り時間。時刻を過ぎたら描き直す
      const n = detailBody.querySelector('[data-live="countdown"]');
      if (!n) return;
      const text = bigLaunchCountdown(selectedLaunch, clock.now());
      if (!text) renderDetail();
      else if (n.textContent !== text) n.textContent = text;
      return;
    }
    if (selectedEvent && !detailPanel.hidden) {
      // 予定：打ち上げまでの残り時間を毎秒書き換える。時刻を過ぎたら描き直して残り時間を消す
      const n = detailBody.querySelector('[data-live="countdown"]');
      if (!n) return;
      const text = bigCountdown(selectedEvent, clock.now());
      if (!text) renderDetail();
      else if (n.textContent !== text) n.textContent = text;
      return;
    }
    if (!selected || detailPanel.hidden) return;
    updatePanelLive(detailBody, { pos: selected.pos, periodMin: selected.period, place: selected.pos && placeAt(places, selected.pos.lat, selected.pos.lng) });
    const svg = detailBody.querySelector('[data-live="map"]');
    const t = clock.now().getTime();
    if (svg && (force || Math.abs(t - lastMapAt) > 20000)) {
      lastMapAt = t;
      renderMinimap(svg, { land: landD, segments: groundTrack(selected.satrec, new Date(t)), pos: selected.pos });
    }
  };
  const renderDetail = () => {
    if (selectedLaunch) {
      detailBody.innerHTML = launchPanelHtml(selectedLaunch, clock.now(), { fetchedAt: launchesData?.fetched_at });
      return;
    }
    if (selectedEvent) {
      detailBody.innerHTML = eventPanelHtml(selectedEvent, clock.now());
      // 流星群は「しくみ」の図（母天体の通り道と、放射点のある星座）を、出典の前に足す
      if (selectedEvent.kind === "meteor") detailBody.querySelector(".event-h")?.insertAdjacentHTML("beforebegin", meteorStoryHtml(selectedEvent, clock.now()));
      return;
    }
    if (!selected) return;
    const c = selected;
    tab = renderPanel(detailBody, {
      card: c.card,
      crewData: c.crewData,
      now: clock.now(),
      isSample: c.sample,
      family: c.family,
      tab,
      status: c.status,
      orbitMeta: `取得 ${dateTimeShortJa(new Date(c.orbit.fetched_at))}・基準時刻 ${dateTimeShortJa(new Date(c.orbit.epoch))}（CelesTrak）`,
    });
    detailBody.querySelector("[data-follow]")?.setAttribute("aria-pressed", String(follow));
    // ひまわりの最新画像が読めないときは、画像の枠ごと隠す（イラストは残る）
    const sat = detailBody.querySelector("[data-live-sat]");
    sat?.addEventListener("error", () => sat.closest("figure").classList.add("failed"), { once: true });
    updateDetailLive(true);
  };

  function select(c) {
    selected = c;
    selectedEvent = null;
    selectedLaunch = null;
    detailPanel.hidden = false;
    app.classList.add("has-selected");
    if (isNarrow()) listPanel.classList.remove("open");
    renderDetail();
    renderList();
    layoutGlobe();
    if (c.pos) globe.pointOfView({ lat: c.pos.lat, lng: c.pos.lng }, 900);
  }
  // 予定を詳細に出す。射場があれば地球をそこへ向ける
  function selectEvent(ev) {
    if (!ev) return;
    selected = null;
    selectedEvent = ev;
    selectedLaunch = null;
    setFollow(false);
    detailPanel.hidden = false;
    app.classList.add("has-selected");
    if (isNarrow()) listPanel.classList.remove("open");
    renderDetail();
    renderList();
    layoutGlobe();
    const p = ev.site?.position?.value;
    if (p) globe.pointOfView({ lat: p.lat, lng: p.lng }, 900);
    // 流星群は、ちりが飛び込んでくる様子を斜め横から見られる向きに（放射点が真上になる地点から、赤道の側へ55°ずらす）
    else if (ev.kind === "meteor" && ev === streamEv && streamDir)
      globe.pointOfView({ lat: streamDir.lat - Math.sign(streamDir.lat || 1) * 55, lng: streamDir.lng }, 900);
  }
  // 世界の打ち上げ（参考）を詳細に出す。射場があれば地球をそこへ向ける
  function selectLaunch(l) {
    if (!l) return;
    selected = null;
    selectedEvent = null;
    selectedLaunch = l;
    setFollow(false);
    detailPanel.hidden = false;
    app.classList.add("has-selected");
    if (isNarrow()) listPanel.classList.remove("open");
    renderDetail();
    renderList();
    layoutGlobe();
    const p = l.site?.position;
    if (p) globe.pointOfView({ lat: p.lat, lng: p.lng }, 900);
  }
  function closeDetail() {
    setExpanded(detailPanel, false);
    selected = null;
    selectedEvent = null;
    selectedLaunch = null;
    detailPanel.hidden = true;
    app.classList.remove("has-selected");
    setFollow(false);
    renderList();
    layoutGlobe();
  }
  detailBody.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return closeDetail();
    if (e.target.closest("[data-follow]")) return setFollow(!follow);
    const t = e.target.closest("[data-tab]");
    if (t) {
      tab = t.dataset.tab;
      renderDetail();
    }
  });
  // ---------- スマホのシート：つまみを押すと「半分 ⇄ 全部」、下へ引くと縮める→閉じる ----------
  function setExpanded(panel, on) {
    panel.classList.toggle("expanded", on);
    const h = panel.querySelector(".sheet-handle");
    h.setAttribute("aria-expanded", String(on));
    h.setAttribute("aria-label", on ? "縮める" : "広げる");
  }
  function closeSheet(panel) {
    if (panel === listPanel) {
      setExpanded(listPanel, false);
      listPanel.classList.remove("open");
    } else closeDetail();
  }
  for (const h of document.querySelectorAll(".sheet-handle")) {
    const panel = h.closest(".side-panel");
    let startY = null;
    let dy = 0;
    let dragged = false;
    h.addEventListener("pointerdown", (e) => {
      startY = e.clientY;
      dy = 0;
      dragged = false;
      h.setPointerCapture(e.pointerId);
      panel.style.transition = "none";
    });
    h.addEventListener("pointermove", (e) => {
      if (startY === null) return;
      dy = e.clientY - startY;
      if (Math.abs(dy) > 8) dragged = true;
      if (dy > 0) panel.style.transform = `translateY(${dy}px)`; // 指について下がる
    });
    const end = () => {
      if (startY === null) return;
      startY = null;
      panel.style.transform = "";
      panel.style.transition = "";
      if (!dragged) return;
      const expanded = panel.classList.contains("expanded");
      if (dy < -30) setExpanded(panel, true);
      else if (dy > 70 && expanded && dy < 220) setExpanded(panel, false);
      else if (dy > 70) closeSheet(panel);
    };
    h.addEventListener("pointerup", end);
    h.addEventListener("pointercancel", () => {
      dragged = false;
      dy = 0;
      end();
    });
    // 押しただけ（キーボードの Enter も）なら広げる／縮める。引いたあとのクリックは無視する
    h.addEventListener("click", () => {
      if (dragged) {
        dragged = false;
        return;
      }
      setExpanded(panel, !panel.classList.contains("expanded"));
    });
  }

  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !detailPanel.hidden && !document.querySelector("dialog[open]")) closeDetail();
  });

  // ---------- タイムライン ----------
  const slider = $("#timeline");
  const playBtn = $("#play");
  const speedButtons = [...document.querySelectorAll(".speed")];
  const speedCycle = $("#speed-cycle");
  const SPEEDS = speedButtons.map((b) => Number(b.dataset.speed));
  let dragging = false;
  const syncControls = () => {
    playBtn.dataset.playing = String(clock.playing);
    playBtn.setAttribute("aria-label", clock.playing ? "一時停止" : "再生");
    for (const b of speedButtons) b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === clock.speed));
    speedCycle.textContent = `×${clock.speed}`;
    speedCycle.setAttribute("aria-label", `再生の速さ ×${clock.speed}（押すと切り替わる）`);
  };
  slider.addEventListener("input", () => {
    dragging = true;
    clock.jumpToOffset(Number(slider.value) * 60000);
  });
  slider.addEventListener("change", () => {
    dragging = false;
    if (selected) renderDetail(); // 滞在中のチームは時刻で変わる
  });
  playBtn.addEventListener("click", () => {
    clock.setPlaying(!clock.playing);
    syncControls();
  });
  const backToNow = () => {
    clock.live();
    syncControls();
    if (selected) renderDetail();
  };
  $("#now").addEventListener("click", backToNow);
  // 上の LIVE 表示も、時刻をずらしているときは押すと現在に戻る（スマホではこれが「現在へ」）
  $("#live-badge").addEventListener("click", () => !clock.isLive() && backToNow());
  for (const b of speedButtons) {
    b.addEventListener("click", () => {
      clock.setSpeed(Number(b.dataset.speed));
      if (!clock.playing) clock.setPlaying(true);
      syncControls();
    });
  }

  speedCycle.addEventListener("click", () => {
    const i = SPEEDS.indexOf(clock.speed);
    clock.setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
    if (!clock.playing) clock.setPlaying(true);
    syncControls();
  });

  // ---------- 追尾 ----------
  let follow = false;
  const followBtn = $("#follow");
  function setFollow(on) {
    follow = on && !!selected;
    followBtn.setAttribute("aria-pressed", String(follow));
    detailBody.querySelector("[data-follow]")?.setAttribute("aria-pressed", String(follow));
  }
  followBtn.addEventListener("click", () => {
    if (!selected && craft[0]) select(craft[0]);
    setFollow(!follow);
  });
  controls.addEventListener("start", () => follow && setFollow(false));

  // ---------- 今夜・頭の上（ISS の見える通過） ----------
  const iss = craft.find((c) => c.id === "iss");
  const prefSelect = $("#pref-select");
  const tonightBody = $("#tonight-body");
  const tonightChip = $("#tonight-chip");
  let pref = prefectures.find((p) => p.code === loadPrefecture()) ?? null;
  let passes = [];
  let passesAt = 0;
  renderPrefSelect(prefSelect, prefectures, pref?.code);
  // タイムライン（+24時間まで）に入る通過だけ「見る」ボタンを出す
  const jumpable = (p) => p.start.getTime() - Date.now() < 24 * 3600e3 - 5 * 60e3;
  const updateTonight = () => {
    const now = new Date();
    passes = pref && iss ? findVisiblePasses(iss.satrec, observerOf(pref), now, { days: 5, limit: 3 }) : [];
    passesAt = now.getTime();
    renderTonight(tonightBody, { pref, passes, now, jumpable });
    // 流星群（極大の前の日から）：放射点の方角・高さと月明かり
    const meteors = activeMeteors(events, now);
    if (meteors.length) tonightBody.insertAdjacentHTML("beforeend", meteors.map((ev) => meteorHtml(ev, pref && observerOf(pref), pref?.name, now)).join(""));
    $("#tonight-label").textContent = pref ? `今夜・${pref.name}` : "今夜・頭の上";
    tonightChip.hidden = false;
    // PCは案内の文、スマホは短い「今夜」ボタン（文は読み上げ用に残す）
    const chipText = !pref
      ? "県を選ぶと、ISS が見える時刻が出ます"
      : `${esc(pref.name)}<span class="sep" aria-hidden="true"></span>${
          passes.length ? `ISS ${whenWord(passes[0].start, now)} ${clockWord(passes[0].start)}` : "ISS 見える通過なし（5日間）"
        }`;
    tonightChip.innerHTML = `<span class="pin" aria-hidden="true">⌖</span><span class="chip-full">${chipText}</span><span class="chip-short" aria-hidden="true">今夜</span>`;
    renderEvents(); // 「予定」の先頭に出す今夜の通過も作り直す
  };
  prefSelect.addEventListener("change", () => {
    pref = prefectures.find((p) => p.code === prefSelect.value) ?? null;
    savePrefecture(pref?.code);
    updateTonight();
  });
  tonightBody.addEventListener("click", (e) => {
    const story = e.target.closest("[data-meteor-story]");
    if (story) {
      selectEvent(events.find((ev) => ev.id === story.dataset.meteorStory));
      return;
    }
    const b = e.target.closest("[data-jump]");
    const p = b && passes[Number(b.dataset.jump)];
    if (!p || !iss) return;
    clock.live();
    clock.jumpToOffset(p.start.getTime() - Date.now() - 60e3);
    syncControls();
    select(iss);
    setFollow(true);
  });
  // 上のバーのボタンから、一覧のタブを開く（スマホでは全部の高さで）
  const openListTab = (id) => {
    showListFilter(id);
    if (isNarrow()) showOnlyFamily(id);
    listPanel.classList.add("open");
    setExpanded(listPanel, true);
    if (isNarrow()) closeDetail();
    listPanel.scrollTop = 0;
  };
  tonightChip.addEventListener("click", () => openListTab("tonight"));

  // ---------- 予定：次の出来事（公式の日付）と、上のバーの「次の出来事」 ----------
  const eventsBody = $("#events-body");
  const nextChip = $("#next-chip");
  const worldBody = $("#world-body");
  let upcoming = [];
  let world = [];
  let eventsAt = -Infinity;
  let eventsHtml = "";
  let worldHtml = "";
  let nextHtml = "";
  const nextPanelBody = $("#next-panel-body");
  let nextPanelHtml = "";
  $("#world-fetched").textContent = launchesData?.fetched_at ? `取得：${jstShort(launchesData.fetched_at)}（日本時間）` : "";
  // 今夜〜明日の ISS の見える通過（計算）を、予定の先頭に出す
  const tonightRow = () => {
    const p = passes[0];
    const now = new Date();
    if (!pref || !p || p.start - now > 24 * 3600e3) return null;
    return {
      day: whenWord(p.start, now),
      time: hmJst(p.start),
      title: `ISS が${pref.name}の空を通る`,
      sub: `${dir8(p.startAz)}から${dir8(p.endAz)}へ・計算：公開の軌道データから`,
    };
  };
  function renderEvents() {
    const now = clock.now();
    eventsAt = now.getTime();
    upcoming = upcomingEvents(events, now);
    // 一覧と「次の出来事」：日本のみの表示なら日本の予定だけ
    const listed = viewMode === "japan" ? upcoming.filter((ev) => showsEvent("japan", ev)) : upcoming;
    if (!eventsSection.hidden) {
      const html = eventsListHtml(listed, now, { tonight: tonightRow() });
      // 書き換えると押しかけのボタンが消えるので、変わったときだけ
      if (html !== eventsHtml) eventsBody.innerHTML = eventsHtml = html;
    }
    // 右の列（PC の広い画面）。画面の幅を変えたときにすぐ出せるよう、隠れているあいだも作っておく（変わったときだけ書き換える）
    const nextPanelNew = eventsListHtml(listed, now, { tonight: tonightRow(), summary: true });
    if (nextPanelNew !== nextPanelHtml) nextPanelBody.innerHTML = nextPanelHtml = nextPanelNew;
    // 上のバー：いちばん近い予定（延期なら「延期」と出る）
    const next = listed[0];
    const chip = next ? nextChipHtml(next, now) : "";
    if (chip !== nextHtml) {
      nextChip.innerHTML = nextHtml = chip;
      nextChip.setAttribute("aria-label", next ? `次の出来事：${next.title.ja}。予定の一覧を開く` : "");
    }
    nextChip.hidden = !next;
    // 射場のピン：これからの打ち上げだけ。名前は「種子島 10/20」
    const ids = new Set(upcoming.map((ev) => ev.id));
    for (const s of sites) {
      s.shown = ids.has(s.ev.id);
      s.el.querySelector(".tag").textContent = `${s.ev.site.label} ${whenShort(s.ev, now)[0]}`;
    }

    // 世界の打ち上げ（参考）：公式の予定と同じものは除く。データの古さは実際の今で判断する
    const state = dataState(launchesData, new Date());
    world = worldLaunches(launchesData, events, now, new Date());
    if (!worldSection.hidden) {
      const japan = viewMode === "japan";
      const html = launchesListHtml(japan ? world.filter((l) => showsLaunch("japan", l)) : world, now, {
        state,
        fetchedAt: launchesData?.fetched_at,
        noteId: "ref-note",
        empty: japan ? "いま載せている、日本の射場からの打ち上げはありません。" : undefined,
      });
      if (html !== worldHtml) worldBody.innerHTML = worldHtml = html;
    }
    // ピン：まとめた射場のうち、いちばん近い打ち上げ。公式の射場のピンと重なるところには立てない
    const shownSites = sites.filter((s) => s.shown);
    const worldIds = new Set(world.map((l) => l.id));
    for (const p of worldPins) {
      const visible = p.launches.filter((l) => worldIds.has(l.id)).sort((a, b) => a.net.localeCompare(b.net));
      p.first = visible[0] ?? null;
      p.shown = !!p.first && !shownSites.some((s) => Math.hypot(s.lat - p.lat, s.lng - p.lng) < 0.5);
      if (!p.first) continue;
      const label = `${placeShort(p.first, { country: false })} ${launchWhenShort(p.first, now)[0]}`;
      const text = p.el.querySelector(".tag-text");
      if (text.textContent !== label) text.textContent = label;
      p.el.setAttribute("aria-label", `${missionName(p.first)}（${placeName(p.first)}）の打ち上げ予定を開く。参考`);
    }
  }
  nextChip.addEventListener("click", () => openListTab("planned"));
  for (const body of [eventsBody, nextPanelBody]) {
    body.addEventListener("click", (e) => {
      const b = e.target.closest("[data-event]");
      if (b) return selectEvent(events.find((ev) => ev.id === b.dataset.event));
      if (e.target.closest('[data-go="tonight"]')) showListFilter("tonight");
    });
  }
  worldBody.addEventListener("click", (e) => {
    const b = e.target.closest("[data-launch]");
    if (b) selectLaunch(world.find((l) => l.id === b.dataset.launch));
  });
  // 一覧の行にマウスを乗せる（キーボードで選ぶ）と、地球の上の同じ射場のピンを光らせる。どこの打ち上げかを目で追えるように
  const peekPins = (e) => {
    const ev = e.type === "mouseover" || e.type === "focusin" ? e.target.closest("[data-event]") : null;
    const lb = e.type === "mouseover" || e.type === "focusin" ? e.target.closest("[data-launch]") : null;
    const l = lb && world.find((x) => x.id === lb.dataset.launch);
    for (const s of sites) s.el.classList.toggle("peek", !!ev && s.ev.id === ev.dataset.event);
    for (const p of worldPins) p.el.classList.toggle("peek", !!l && p.launches.includes(l));
  };
  for (const body of [eventsBody, worldBody]) {
    for (const type of ["mouseover", "mouseleave", "focusin", "focusout"]) body.addEventListener(type, peekPins);
  }
  updateTonight();

  // ---------- 遠くを見る部屋（M7 v0）：探査機までの距離と、光で届く時間 ----------
  // 部屋の部品（js/far/・天体の位置の計算）は、はじめて開くときに読む（起動の読み込み量に入れない）。
  // 開いているあいだは地球の描画を止める。ブラウザの「戻る」で閉じられるように、履歴に #far を足す
  const farBtn = $("#far-open");
  const farLabel = farBtn.querySelector(".far-open-label");
  const farNav = roomNav.querySelector('[data-room="far"]');
  const farOpeners = [farBtn, farNav];
  let farOpener = farBtn; // 閉じたら、押したボタンにフォーカスを戻す
  let far = null;
  let farLoading = null;
  // 入口にマウスを乗せた・指で触れた・フォーカスしたときから読み始める（押してから開くまでを短くする）
  const loadFar = () =>
    (farLoading ??= import("./far/room.js")
      .then(({ createFarRoom }) => createFarRoom({ events, onClose: onFarClosed }))
      .catch((e) => {
        farLoading = null; // もう一度押したら読み直す
        throw e;
      }));
  for (const el of farOpeners) for (const type of ["pointerenter", "focus", "touchstart"]) el.addEventListener(type, () => loadFar().catch(() => {}), { passive: true, once: true });
  async function openFar(entry, opener = isNarrow() ? farBtn : farNav) {
    if (roomOpen || farOpeners.some((el) => el.getAttribute("aria-busy") === "true")) return;
    farOpener = opener;
    opener.setAttribute("aria-busy", "true");
    try {
      far = await loadFar();
    } catch (e) {
      console.error(e);
      const label = opener === farBtn ? farLabel : farNav;
      label.textContent = "読み込めませんでした";
      setTimeout(() => (label.textContent = "遠くを見る"), 4000);
      return;
    } finally {
      opener.removeAttribute("aria-busy");
    }
    roomOpen = true;
    globe.pauseAnimation();
    far.open();
    if (entry === "pushed") history.pushState({ far: true }, "", "#far");
  }
  function onFarClosed() {
    roomOpen = false;
    globe.resumeAnimation();
    if (location.hash === "#far") history.back();
    farOpener.focus();
  }
  farBtn.addEventListener("click", () => openFar("pushed", farBtn));
  farNav.addEventListener("click", () => openFar("pushed", farNav));
  addEventListener("popstate", () => {
    if (location.hash === "#far") openFar("history");
    else if (roomOpen) far.close();
  });
  // 最初に開いたときは、いつも地球の画面から（2026-10-05 オーナー）。部屋の中で再読み込みしたときや、
  // #far つきのリンク・ブックマーク・ホーム画面から開いたときも、部屋へは飛ばずに #far を消す
  if (location.hash === "#far") history.replaceState(null, "", location.pathname + location.search);

  // ---------- このアプリについて ----------
  const about = $("#about");
  about.addEventListener("click", (e) => {
    if (e.target === about || e.target.closest("[data-close]")) about.close();
  });
  $("#about-open").addEventListener("click", () => about.showModal());
  $("#menu-open").addEventListener("click", () => about.showModal());
  // 機体の画像の出典（利用条件どおりのクレジット）
  $("#about-images").innerHTML = craft
    .filter((c) => c.card.image)
    .map((c) => `<li>${esc(c.card.name.ja)}：${imageCredit(c.card.image)}</li>`)
    .join("");

  // 射場の名前が重なったら、日付の遅いほうの名前を隠す（ひし形は残り、マウスを乗せると名前が出る）。
  // 機体の名前と、選んでいる・一覧で指しているピンの名前を優先する
  const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  function declutterPins() {
    const kept = [];
    for (const c of craft) {
      const r = c.el.isConnected && c.el.querySelector(".tag")?.getBoundingClientRect();
      if (r?.width) kept.push(r);
    }
    // 先に全部の位置を読み、あとでまとめて書き換える（読み書きを交互にすると、そのたびに配置の計算が走る）
    const pins = siteData()
      .filter((p) => p.el.isConnected)
      .map((p) => ({
        p,
        r: p.el.querySelector(".tag").getBoundingClientRect(),
        first: p.el.classList.contains("selected") || p.el.classList.contains("peek"),
        t: p.ev ? eventSpanStart(p.ev) : Date.parse(p.first?.net ?? ""),
      }))
      .sort((a, b) => b.first - a.first || a.t - b.t);
    const hides = pins.map(({ r, first }) => {
      const hide = !first && kept.some((k) => overlaps(k, r));
      if (!hide) kept.push(r);
      return hide;
    });
    pins.forEach(({ p }, i) => p.el.classList.toggle("tag-hidden", hides[i]));
  }

  // ---------- 毎フレームの更新 ----------
  const els = { time: $("#sim-time"), badge: $("#live-badge"), warning: $("#tle-warning") };
  const eiTime = $("#ei-time");
  const eiView = $("#ei-view");
  const eiCount = $("#ei-count");
  let lastText = 0;
  let lastWarning = "";

  renderFamTabs();
  // 一覧のパネルの大きさが変わったとき（画面の大きさ・PC とスマホの切り替え）と、フォントを読み終わったときに、タブを入れ直す
  new ResizeObserver(fitFamTabs).observe(listPanel);
  document.fonts?.ready.then(fitFamTabs);
  setView(viewMode); // 覚えている表示（なければ「すべて」）。一覧も描く
  syncControls();

  const tick = (t) => {
    // 遠くを見る部屋を開いているあいだは、地球の計算と描画を止める（部屋の動きを軽くするため）
    if (roomOpen) {
      requestAnimationFrame(tick);
      return;
    }
    if (clock.clampToTimeline()) syncControls();
    const now = clock.now();
    // 選んだ機体の軌道の線：選び直したとき、または観測時刻で20秒ごと
    if (selected !== orbitFor || Math.abs(now - orbitAt) > 20000) updateOrbitPath(now);
    // 昼と夜の境目：観測時刻で1分以上動いたら更新（早送りでも滑らかに）
    if (Math.abs(now - lastEarthAt) > 60000) {
      lastEarthAt = now.getTime();
      updateEarth(now);
    }
    for (const c of craft) {
      c.pos = positionAt(c.satrec, now);
      if (c.pos) {
        c.lat = c.pos.lat;
        c.lng = c.pos.lng;
        c.alt = displayAltitude(c.pos.altKm);
      }
      c.el.classList.toggle("selected", c === selected);
    }
    for (const s of sites) s.el.classList.toggle("selected", s.ev === selectedEvent);
    for (const p of worldPins) p.el.classList.toggle("selected", !!selectedLaunch && p.launches.includes(selectedLaunch));
    const pov = globe.pointOfView();
    updateStream(t, now);
    globe.htmlElementsData([...markerData(), ...siteData(), ...radiantData()]);
    if (follow && selected?.pos) globe.pointOfView({ lat: selected.pos.lat, lng: selected.pos.lng, altitude: pov.altitude }, 0);

    // 文字の更新は間引く
    if (t - lastText > 100) {
      lastText = t;
      els.time.textContent = isNarrow() ? dateTimeCompactJa(now) : dateTimeJa(now);
      // 「現在の地球」：観測時刻・カメラが見ている地点・表示中の機体数
      eiTime.textContent = dateTimeJa(now);
      const pov = globe.pointOfView();
      eiView.textContent = `${latJa(pov.lat)} ${lngJa(((pov.lng + 540) % 360) - 180)}`;
      const shownCraft = markerData();
      const pins = siteData().length;
      const fams = [...new Set(shownCraft.map((c) => c.family.label))].join("・");
      eiCount.textContent = [shownCraft.length ? `${shownCraft.length}機（${fams}）` : "", pins ? `射場 ${pins}か所` : ""].filter(Boolean).join("・") || "なし";
      const live = clock.isLive();
      els.badge.dataset.live = String(live);
      app.dataset.live = String(live);
      els.badge.textContent = live ? "LIVE" : durationJa(clock.offset());
      els.badge.dataset.paused = String(!live && !clock.playing);
      els.badge.setAttribute("aria-label", live ? "いまの時刻を表示中" : `現在に戻る（いまは ${els.badge.textContent}）`); // 「停止中」は CSS で足す（スマホでは再生ボタンの形で分かるので出さない）
      if (!dragging) slider.value = String(Math.round(clock.offset() / 60000));
      for (const c of craft) {
        const n = listEl.querySelector(`[data-alt="${c.id}"]`);
        if (n) n.textContent = c.pos ? `約 ${Math.round(c.pos.altKm).toLocaleString("ja-JP")} km` : "--";
        // 画面の右端で名前が切れるときは、名前を印の左に出す
        const r = c.el.getBoundingClientRect();
        if (r.width) c.el.classList.toggle("tag-left", r.left + 34 + (c.el.querySelector(".tag")?.offsetWidth ?? 0) > innerWidth - 8);
      }
      updateDetailLive();
      declutterPins();
      // 予定と「次の出来事」：観測時刻で30秒ごと（早送りや時刻の移動にもついていく）
      if (Math.abs(now - eventsAt) > 30000) renderEvents();
      // 通過の予報は10分ごと、または次の通過が終わったら作り直す
      if (pref && (Date.now() - passesAt > 600e3 || (passes[0] && passes[0].end.getTime() < Date.now()))) updateTonight();

      const ageDays = Math.max(...craft.map((c) => Math.abs(now - new Date(c.orbit.epoch)) / 86400000));
      let warning = "";
      if (craft.some((c) => !c.pos)) {
        warning = "この時刻の位置は、いまの軌道データでは計算できない機体があります。";
      } else if (ageDays > STALE_DAYS) {
        warning = `軌道データの基準時刻から ${Math.round(ageDays)} 日離れています。実際の位置とずれている可能性があります。`;
      }
      if (warning !== lastWarning) {
        lastWarning = warning;
        els.warning.textContent = warning;
        els.warning.hidden = !warning;
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- 起動 ----------
async function boot() {
  const stopNoise = startNoise($("#noise"));
  const status = $("#boot-status");
  const startBtn = $("#start");
  let data;
  try {
    // データと 3D 表示のライブラリを並べて読む（どちらかを待ってからもう一方、にしない）
    [data] = await Promise.all([loadAll(), loadGlobeLib()]);
    // 読み込めた機体数と、軌道データのいちばん古い取得時刻（UTC）
    const fetched = data.craft.map((c) => c.orbit.fetched_at).sort()[0];
    status.textContent = [
      "ORBITAL DATA LOADED",
      `${data.craft.length} OBJECTS ONLINE`,
      fetched ? `UPDATED ${fetched.slice(0, 16).replace("T", " ")} UTC` : "",
    ].join("\n");
  } catch (e) {
    status.classList.add("error");
    status.textContent =
      e.path?.startsWith("data/orbits/") && e.status === 404
        ? `軌道データ（web/${e.path}）がありません。npm run fetch:orbits で取得してください。`
        : `読み込みに失敗しました：${e.message}`;
    $("#start-label").textContent = "読み込めませんでした";
    return;
  }
  // 重いデータ（地名・ミニ地図の陸地）は、ここから裏で読む。ボタンを押すまでの時間を使う
  data.later = loadLater();
  $("#start-label").textContent = "観測を開始";
  startBtn.disabled = false;
  startBtn.focus();
  startBtn.addEventListener(
    "click",
    () => {
      $("#app").hidden = false;
      try {
        startApp(data);
      } catch (e) {
        $("#app").hidden = true;
        status.classList.add("error");
        status.textContent = `起動に失敗しました：${e.message}`;
        return;
      }
      const bootEl = $("#boot");
      bootEl.classList.add("leaving");
      setTimeout(() => {
        bootEl.hidden = true;
        stopNoise();
      }, 650);
    },
    { once: true },
  );
}

boot();
