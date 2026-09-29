// VOYASCOPE Phase 0：地球＋ISS 1機＋キャラカード＋時間早送り
import { satrecFromOrbit, positionAt, periodMinutes, SimClock } from "./orbit.js";
import { renderCard, updateLive } from "./card.js";
import { dateTimeShortJa, dateTimeJa, durationJa, latStr, lngStr } from "./format.js";

const COLORS = {
  navy: "#07142b",
  globe: "#0c2140",
  mint: "#5ef2c2",
  land: "rgba(94, 242, 194, 0.78)",
};
const EARTH_RADIUS_KM = 6371;
// 軌道データの基準時刻からこれ以上離れたら、位置がずれている可能性を知らせる
const STALE_DAYS = 7;

const $ = (sel) => document.querySelector(sel);

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
  const [orbit, card, thresholds, land] = await Promise.all([
    loadJson("data/orbits/iss.json"),
    loadJson("data/cards/iss.json"),
    loadJson("data/rank-thresholds.json"),
    loadJson("data/land-110m.geojson"),
  ]);
  return { orbit, card, thresholds, land };
}

// ---------- 観測画面 ----------
function startApp({ orbit, card, thresholds, land }) {
  const satrec = satrecFromOrbit(orbit);
  const clock = new SimClock();
  const epoch = new Date(orbit.epoch);

  $("#tle-info").textContent = `軌道データ取得：${dateTimeShortJa(new Date(orbit.fetched_at))}`;
  $("#about-tle").textContent =
    `軌道データ取得：${dateTimeJa(new Date(orbit.fetched_at))}／基準時刻（エポック）：${dateTimeJa(epoch)}／出典：${orbit.source}`;

  // ISS マーカー（HTML 要素を地球に重ねる）
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = "iss-marker";
  marker.setAttribute("aria-label", "ISS のカードを開く");
  marker.innerHTML = `<span class="ring"></span><span class="core"></span><span class="tag">ISS</span>`;
  marker.addEventListener("click", (e) => {
    e.stopPropagation();
    openCard();
  });

  const iss = { lat: 0, lng: 0, alt: 0 };
  const globeEl = $("#globe");
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
    .htmlElementsData([iss])
    .htmlLat("lat")
    .htmlLng("lng")
    .htmlAltitude("alt")
    .htmlElement(() => marker)
    .htmlTransitionDuration(0);

  const mat = globe.globeMaterial();
  mat.color.set(COLORS.globe);
  if (mat.emissive) mat.emissive.set("#06152c");
  if ("shininess" in mat) mat.shininess = 4;

  const controls = globe.controls();
  controls.minDistance = 130;
  controls.maxDistance = 900;

  const resize = () => globe.width(globeEl.clientWidth).height(globeEl.clientHeight);
  addEventListener("resize", resize);
  resize();

  // 初期位置：ISS の真上から見る
  const first = positionAt(satrec, clock.now());
  globe.pointOfView({ lat: first?.lat ?? 20, lng: first?.lng ?? 135, altitude: innerWidth < 640 ? 3.1 : 2.4 }, 0);

  // ---------- 時間の早送り ----------
  const speedButtons = [...document.querySelectorAll(".speed")];
  for (const b of speedButtons) {
    b.addEventListener("click", () => {
      clock.setSpeed(Number(b.dataset.speed));
      for (const o of speedButtons) o.setAttribute("aria-pressed", String(o === b));
    });
  }
  $("#now").addEventListener("click", () => {
    clock.reset();
    clock.setSpeed(1);
    for (const o of speedButtons) o.setAttribute("aria-pressed", String(o.dataset.speed === "1"));
  });

  // ---------- 追尾 ----------
  let follow = false;
  const followBtn = $("#follow");
  const setFollow = (on) => {
    follow = on;
    followBtn.setAttribute("aria-pressed", String(on));
  };
  followBtn.addEventListener("click", () => setFollow(!follow));
  // ドラッグで地球を回したら追尾をやめる
  controls.addEventListener("start", () => follow && setFollow(false));

  // ---------- カード ----------
  const cardDialog = $("#card");
  const cardBody = $("#card-body");
  renderCard(cardBody, { card, thresholds, isSample: true });
  function openCard() {
    if (!cardDialog.open) cardDialog.showModal();
  }
  for (const d of [cardDialog, $("#about")]) {
    d.addEventListener("click", (e) => {
      if (e.target === d || e.target.closest("[data-close]")) d.close();
    });
  }
  $("#card-open").addEventListener("click", openCard);
  $("#about-open").addEventListener("click", () => $("#about").showModal());

  // ---------- 毎フレームの更新 ----------
  const els = {
    time: $("#sim-time"),
    offset: $("#sim-offset"),
    lat: $("#t-lat"),
    lng: $("#t-lng"),
    alt: $("#t-alt"),
    spd: $("#t-spd"),
    warning: $("#tle-warning"),
  };
  let lastText = 0;
  let lastWarning = "";

  const tick = (t) => {
    const now = clock.now();
    const pos = positionAt(satrec, now);
    marker.hidden = !pos;
    if (pos) {
      iss.lat = pos.lat;
      iss.lng = pos.lng;
      iss.alt = pos.altKm / EARTH_RADIUS_KM;
      globe.htmlElementsData([iss]);
      if (follow) {
        const pov = globe.pointOfView();
        globe.pointOfView({ lat: pos.lat, lng: pos.lng, altitude: pov.altitude }, 0);
      }
    }

    // 文字の更新は間引く
    if (t - lastText > 100) {
      lastText = t;
      els.time.textContent = dateTimeJa(now);
      const off = clock.offset();
      els.offset.textContent = Math.abs(off) > 2000 ? `現在から ${durationJa(off)}` : "";
      els.lat.textContent = pos ? latStr(pos.lat) : "--";
      els.lng.textContent = pos ? lngStr(pos.lng) : "--";
      els.alt.textContent = pos ? `${pos.altKm.toFixed(1)} km` : "--";
      els.spd.textContent = pos ? `${pos.speedKmS.toFixed(2)} km/s` : "--";
      if (cardDialog.open) updateLive(cardBody, pos, periodMinutes(satrec));

      const ageDays = (now - epoch) / 86400000;
      let warning = "";
      if (!pos) {
        warning = "この時刻の ISS の位置は、いまの軌道データでは計算できません。";
      } else if (Math.abs(ageDays) > STALE_DAYS) {
        warning = `軌道データの基準時刻から ${Math.round(Math.abs(ageDays))} 日離れています。実際の位置とずれている可能性があります。`;
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
      e.path === "data/orbits/iss.json" && e.status === 404
        ? "軌道データ（web/data/orbits/iss.json）がありません。npm run fetch:orbits で取得してください。"
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
