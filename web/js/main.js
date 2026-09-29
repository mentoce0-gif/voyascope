// VOYASCOPE：地球＋環＋注目の機体＋詳細パネル＋タイムライン
import { satrecFromOrbit, positionAt, periodMinutes, groundTrack, SimClock } from "./orbit.js";
import { renderPanel, updatePanelLive } from "./card.js";
import { summarizeStatus } from "./status.js";
import { landPath, renderMinimap } from "./minimap.js";
import { displayAltitude, RINGS } from "./scale.js";
import { FAMILIES, familyOf } from "./families.js";
import { esc, dateTimeShortJa, dateTimeJa, durationJa } from "./format.js";
import { findVisiblePasses, observerOf } from "./passes.js";
import { renderTonight, renderPrefSelect, loadPrefecture, savePrefecture, whenWord, clockWord } from "./tonight.js";

const COLORS = {
  navy: "#07142b",
  globe: "#0c2140",
  mint: "#5ef2c2",
  land: "rgba(94, 242, 194, 0.78)",
};
// 軌道データの基準時刻からこれ以上離れたら、位置がずれている可能性を知らせる
const STALE_DAYS = 7;

const $ = (sel) => document.querySelector(sel);
// 地球の上と一覧に出す短い名前（日本語の愛称が長いときは英語の略称）
const shortName = (c) => (c.card.name.ja.length <= 7 ? c.card.name.ja : c.card.name.en.length <= 8 ? c.card.name.en : c.id.toUpperCase());

// 画面が狭いときは、一覧と詳細を下から出るシートにする（style.css と合わせる）
const isNarrow = () => matchMedia("(max-width: 900px)").matches;

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

async function loadJson(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) {
    const err = new Error(`${path} を読み込めません（HTTP ${res.status}）`);
    err.status = res.status;
    err.path = path;
    throw err;
  }
  return res.json();
}

async function loadAll() {
  const [index, land, prefs] = await Promise.all([
    loadJson("data/craft-index.json"),
    loadJson("data/land-110m.geojson"),
    loadJson("data/prefectures.json"),
  ]);
  const craft = await Promise.all(
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
  );
  return { craft: craft.filter((c) => c.orbit), land, prefectures: prefs.prefectures };
}

// ---------- 観測画面 ----------
function startApp({ craft, land, prefectures }) {
  const clock = new SimClock();

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

  // ---------- 地球 ----------
  const globeEl = $("#globe");
  const hidden = new Set(); // 表示しない家族
  const markerData = () => craft.filter((c) => c.pos && !hidden.has(c.family.id));
  const globe = Globe({ animateIn: true })(globeEl)
    .backgroundColor(COLORS.navy)
    .showAtmosphere(true)
    .atmosphereColor(COLORS.mint)
    .atmosphereAltitude(0.14)
    .showGraticules(true)
    .hexPolygonsData(land.features)
    .hexPolygonResolution(3)
    .hexPolygonMargin(0.35)
    .hexPolygonUseDots(true)
    .hexPolygonColor(() => COLORS.land)
    .pathsData(ringPaths)
    .pathPoints("points")
    .pathPointLat((p) => p[0])
    .pathPointLng((p) => p[1])
    .pathPointAlt((p) => p[2])
    .pathColor(() => "rgba(94, 242, 194, 0.38)")
    .pathDashLength(0.012)
    .pathDashGap(0.008)
    .pathTransitionDuration(0)
    .htmlElementsData([])
    .htmlLat("lat")
    .htmlLng("lng")
    .htmlAltitude("alt")
    .htmlElement((d) => d.el)
    .htmlTransitionDuration(0);

  const mat = globe.globeMaterial();
  mat.color.set(COLORS.globe);
  if (mat.emissive) mat.emissive.set("#06152c");
  if ("shininess" in mat) mat.shininess = 4;

  const controls = globe.controls();
  controls.minDistance = 130;
  controls.maxDistance = 1100;

  // パネルで隠れない位置に地球を置く
  const detailPanel = $("#detail-panel");
  const layoutGlobe = () => {
    globe.width(globeEl.clientWidth).height(globeEl.clientHeight);
    if (isNarrow()) globe.globeOffset([0, -40]);
    else globe.globeOffset([detailPanel.hidden ? 150 : -20, -30]);
  };
  addEventListener("resize", layoutGlobe);
  layoutGlobe();
  // 下のバーの実際の高さを、パネルや注記の位置に使う
  const bottomBar = $(".bottom-bar");
  new ResizeObserver(() => $("#app").style.setProperty("--bottom-h", `${bottomBar.offsetHeight}px`)).observe(bottomBar);
  const topBar = $(".top-bar");
  new ResizeObserver(() => $("#app").style.setProperty("--top-h", `${topBar.offsetHeight}px`)).observe(topBar);

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
  let selected = null;
  const famTabs = $("#fam-tabs");
  const listEl = $("#craft-list");
  const renderFamTabs = () => {
    famTabs.innerHTML = [{ id: "all", label: "すべて" }, ...present]
      .map(
        (f) =>
          `<button type="button" class="fam-tab" data-fam="${f.id}" aria-pressed="${f.id === listFilter}">${esc(f.label)}</button>`,
      )
      .join("");
  };
  // 止まっている／止まる予定のお知らせがある機体に小さな札を付ける（実際の今で判断）
  const statusBadge = (c) => {
    const { badge } = summarizeStatus(c.card, c.status, new Date());
    return badge ? ` <span class="st-badge${badge === "停止中" ? " down" : ""}">${badge}</span>` : "";
  };
  const renderList = () => {
    listEl.innerHTML = craft
      .filter((c) => listFilter === "all" || c.family.id === listFilter)
      .map(
        (c) => `<li><button type="button" class="craft-item" data-id="${c.id}" aria-current="${c === selected}">
          <span class="craft-icon" style="--c:${c.family.color}" aria-hidden="true"></span>
          <span class="craft-names"><span class="craft-id">${esc(shortName(c))}</span><span class="craft-ja">${esc(c.card.name.en)}${statusBadge(c)}</span></span>
          <span class="craft-alt mono" data-alt="${c.id}">--</span>
          <span class="chev" aria-hidden="true">›</span>
        </button></li>`,
      )
      .join("");
  };
  famTabs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fam]");
    if (!b) return;
    listFilter = b.dataset.fam;
    renderFamTabs();
    renderList();
  });
  listEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-id]");
    if (b) select(craft.find((c) => c.id === b.dataset.id));
  });

  const legend = $("#fam-legend");
  legend.innerHTML = FAMILIES.filter((f) => f.id !== "other")
    .map(
      (f) =>
        `<label class="toggle"><input type="checkbox" data-fam="${f.id}" checked><span class="fam-dot" style="--c:${f.color}"></span>${esc(f.label)}</label>`,
    )
    .join("");
  legend.addEventListener("change", (e) => {
    const id = e.target.dataset.fam;
    if (!id) return;
    if (e.target.checked) hidden.delete(id);
    else hidden.add(id);
  });
  $("#rings-toggle").addEventListener("change", (e) => {
    showRings = e.target.checked;
    globe.pathsData(showRings ? ringPaths : []);
    $(".scale-note").hidden = !showRings;
  });

  const listPanel = $("#list-panel");
  $("#list-open").addEventListener("click", () => {
    listPanel.classList.toggle("open");
    if (isNarrow() && listPanel.classList.contains("open")) closeDetail();
  });

  // ---------- 詳細パネル ----------
  const detailBody = $("#detail-body");
  let tab = "overview";
  let lastMapAt = 0;
  let landD = null;
  const updateDetailLive = (force = false) => {
    if (!selected || detailPanel.hidden) return;
    updatePanelLive(detailBody, { pos: selected.pos, periodMin: selected.period });
    const svg = detailBody.querySelector('[data-live="map"]');
    const t = clock.now().getTime();
    if (svg && (force || Math.abs(t - lastMapAt) > 20000)) {
      lastMapAt = t;
      landD ??= landPath(land);
      renderMinimap(svg, { land: landD, segments: groundTrack(selected.satrec, new Date(t)), pos: selected.pos });
    }
  };
  const renderDetail = () => {
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
    updateDetailLive(true);
  };

  function select(c) {
    selected = c;
    detailPanel.hidden = false;
    if (isNarrow()) listPanel.classList.remove("open");
    renderDetail();
    renderList();
    layoutGlobe();
    if (c.pos) globe.pointOfView({ lat: c.pos.lat, lng: c.pos.lng }, 900);
  }
  function closeDetail() {
    selected = null;
    detailPanel.hidden = true;
    setFollow(false);
    renderList();
    layoutGlobe();
  }
  detailBody.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return closeDetail();
    const t = e.target.closest("[data-tab]");
    if (t) {
      tab = t.dataset.tab;
      renderDetail();
    }
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !detailPanel.hidden && !document.querySelector("dialog[open]")) closeDetail();
  });

  // ---------- タイムライン ----------
  const slider = $("#timeline");
  const playBtn = $("#play");
  const speedButtons = [...document.querySelectorAll(".speed")];
  let dragging = false;
  const syncControls = () => {
    playBtn.dataset.playing = String(clock.playing);
    playBtn.setAttribute("aria-label", clock.playing ? "一時停止" : "再生");
    for (const b of speedButtons) b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === clock.speed));
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
  $("#now").addEventListener("click", () => {
    clock.live();
    syncControls();
    if (selected) renderDetail();
  });
  for (const b of speedButtons) {
    b.addEventListener("click", () => {
      clock.setSpeed(Number(b.dataset.speed));
      if (!clock.playing) clock.setPlaying(true);
      syncControls();
    });
  }

  // ---------- 追尾 ----------
  let follow = false;
  const followBtn = $("#follow");
  function setFollow(on) {
    follow = on && !!selected;
    followBtn.setAttribute("aria-pressed", String(follow));
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
    $("#tonight-label").textContent = pref ? `今夜・${pref.name}` : "今夜・頭の上";
    tonightChip.hidden = !pref;
    if (pref) {
      tonightChip.textContent = passes.length
        ? `${pref.name}　ISS ${whenWord(passes[0].start, now)} ${clockWord(passes[0].start)}`
        : `${pref.name}　ISS 見える通過なし（5日間）`;
    }
  };
  prefSelect.addEventListener("change", () => {
    pref = prefectures.find((p) => p.code === prefSelect.value) ?? null;
    savePrefecture(pref?.code);
    updateTonight();
  });
  tonightBody.addEventListener("click", (e) => {
    const b = e.target.closest("[data-jump]");
    const p = b && passes[Number(b.dataset.jump)];
    if (!p || !iss) return;
    clock.live();
    clock.jumpToOffset(p.start.getTime() - Date.now() - 60e3);
    syncControls();
    select(iss);
    setFollow(true);
  });
  tonightChip.addEventListener("click", () => {
    listPanel.classList.add("open");
    if (isNarrow()) closeDetail();
    listPanel.scrollTop = 0;
  });
  updateTonight();

  // ---------- このアプリについて ----------
  const about = $("#about");
  about.addEventListener("click", (e) => {
    if (e.target === about || e.target.closest("[data-close]")) about.close();
  });
  $("#about-open").addEventListener("click", () => about.showModal());

  // ---------- 毎フレームの更新 ----------
  const els = { time: $("#sim-time"), badge: $("#live-badge"), warning: $("#tle-warning") };
  let lastText = 0;
  let lastWarning = "";

  renderFamTabs();
  renderList();
  syncControls();

  const tick = (t) => {
    if (clock.clampToTimeline()) syncControls();
    const now = clock.now();
    for (const c of craft) {
      c.pos = positionAt(c.satrec, now);
      if (c.pos) {
        c.lat = c.pos.lat;
        c.lng = c.pos.lng;
        c.alt = displayAltitude(c.pos.altKm);
      }
      c.el.classList.toggle("selected", c === selected);
    }
    const pov = globe.pointOfView();
    globe.htmlElementsData(markerData());
    if (follow && selected?.pos) globe.pointOfView({ lat: selected.pos.lat, lng: selected.pos.lng, altitude: pov.altitude }, 0);

    // 文字の更新は間引く
    if (t - lastText > 100) {
      lastText = t;
      els.time.textContent = dateTimeJa(now);
      const live = clock.isLive();
      els.badge.dataset.live = String(live);
      els.badge.textContent = live ? "LIVE" : `${durationJa(clock.offset())}${clock.playing ? "" : " 停止中"}`;
      if (!dragging) slider.value = String(Math.round(clock.offset() / 60000));
      for (const c of craft) {
        const n = listEl.querySelector(`[data-alt="${c.id}"]`);
        if (n) n.textContent = c.pos ? `約 ${Math.round(c.pos.altKm).toLocaleString("ja-JP")} km` : "--";
        // 画面の右端で名前が切れるときは、名前を印の左に出す
        const r = c.el.getBoundingClientRect();
        if (r.width) c.el.classList.toggle("tag-left", r.left + 34 + (c.el.querySelector(".tag")?.offsetWidth ?? 0) > innerWidth - 8);
      }
      updateDetailLive();
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
    if (typeof Globe !== "function") throw new Error("3D表示のライブラリを読み込めません");
    data = await loadAll();
    status.textContent = "準備ができました";
  } catch (e) {
    status.classList.add("error");
    status.textContent =
      e.path?.startsWith("data/orbits/") && e.status === 404
        ? `軌道データ（web/${e.path}）がありません。npm run fetch:orbits で取得してください。`
        : `読み込みに失敗しました：${e.message}`;
    $("#start-label").textContent = "ERROR";
    return;
  }
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
