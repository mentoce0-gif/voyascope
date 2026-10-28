// ARTEMIS II（アルテミス2号のページ）。2026-10-12 オーナーの再構築：Apple の製品ページのように
//   第1章 ヒーロー（縦にスワイプ・ホイール・↓ で次へ。最後にオリオンが出発）
//   第2章 月の地名マップ（USGS の地名。タッチで月が左へよけてカード。アルテミス2号に関係する地名は琥珀色。オリオンの実際の航路を点線で）
//   第3章 撮影モード（地球の入り・地球の出・日食をスワイプで）
//   地球へ戻る（月から離れて、暗くなって、余韻だけ）
// 画面に出す事実は、照合済みのものだけ（lunar.js・mission.js・moon-places.json のコメントに出典）
import {
  THREE, clamp, smoothstep, KM, R_M, $, traj, P, EPOCH, v3, dir3, stateAt, T_MOON, SUN, d, T_SET, T_RISE, T_ECLIPSE,
  renderer, scene, camera, light, canvasTex, glowTex, billboardMat, billboard, faceCamera,
  stars, moon, sun, corona, pathLine, orionMark, orion, wing, place, getMoonAx, updateSunAndCorona, outsideCam, outsideUp, placeOrion, setNear,
} from "./world.js";
import { TARGETS, moonAxesAt } from "./lunar.js";
import { MISSION, RESULTS } from "./mission.js";
import { count } from "../../js/count.js";

count("artemis2");

const PLACES = (await fetch("moon-places.json").then((r) => r.json())).places;
// 月面に降りたもの（NASA NSSDCA の一覧と、各機関の公式の発表。moon-landers.json のコメント）
const LANDERS = await fetch("moon-landers.json").then((r) => r.json());
const body = document.body;
const portrait = () => innerWidth < innerHeight;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let chapter = "hero";
const setChapter = (c) => {
  chapter = c;
  body.className = `ch-${c}`;
  $("#map").hidden = c !== "map";
  $("#photo").hidden = c !== "photo";
};
const fade = (on, slow = false) => {
  const f = $("#fade");
  f.classList.toggle("slow", slow);
  f.classList.toggle("on", on);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mtx = new THREE.Matrix4(), tmpQ = new THREE.Quaternion();
const look = (pos, target, up) => {
  mtx.lookAt(pos, target, up);
  camera.quaternion.setFromRotationMatrix(mtx);
};
const setFov = (f, k = 1) => {
  if (Math.abs(camera.fov - f) < 0.02) return;
  camera.fov += (f - camera.fov) * k;
  camera.updateProjectionMatrix();
};

// ---------- 道のりの箱（上から見下ろして、ぜんぶ入れる） ----------
const BOX = new THREE.Box3();
for (const p of P) BOX.expandByPoint(v3(p[1], p[2], p[3]));
const BOX_C = BOX.getCenter(new THREE.Vector3()), BOX_S = BOX.getSize(new THREE.Vector3());
function overview(tilt, spin, out) {
  // 地球→月が横に並ぶ向きで、上から少し斜めに
  const vf = (camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  const dist = Math.max(((BOX_S.x / 2) * 1.25) / Math.tan(hf / 2), ((BOX_S.z / 2) * 1.6) / Math.tan(vf / 2)) * (portrait() ? 1.05 : 1);
  const a = spin;
  out.set(BOX_C.x + Math.sin(a) * dist * tilt, BOX_C.y + dist * Math.cos(tilt * 0.9), BOX_C.z + Math.cos(a) * dist * tilt);
  return out;
}
// 地球からいちばん遠いところ（NASA：252,756 mi。軌道データの点から）
const FAR_I = P.reduce((b, p, i) => (Math.hypot(p[1], p[2], p[3]) > Math.hypot(P[b][1], P[b][2], P[b][3]) ? i : b), 0);

// ---------- 地球の入り・地球の出の向き（月のふちと地球のあいだ。地球が上） ----------
function riseAim(s) {
  const eDir = s.craft.clone().negate().normalize();
  const toM = s.moon.clone().sub(s.craft), mDir = toM.clone().normalize();
  const angR = Math.asin(Math.min(1, R_M / toM.length()));
  const axis = new THREE.Vector3().crossVectors(mDir, eDir).normalize();
  const limb = mDir.clone().applyAxisAngle(axis, angR);
  // 上：月の中心から地球のほうへ（地球が地平線の下にあっても、向きがひっくり返らないように）
  const up = eDir.clone().addScaledVector(mDir, -eDir.dot(mDir)).normalize();
  return { target: camera.position.clone().add(eDir.clone().add(limb).normalize()), up };
}

// =====================================================================
// 第1章：ヒーロー
// =====================================================================
const SLIDES = [...document.querySelectorAll(".slide")];
let heroIdx = 0, heroT = 0, heroLock = 0, launching = false, launchT = 0;
const pathGeo = pathLine.geometry, PATH_N = pathGeo.attributes.position.count;
function goHero(i, first = false) {
  if (launching) return;
  i = clamp(i, 0, SLIDES.length - 1);
  if (i === heroIdx && !first) return;
  heroIdx = i;
  heroT = 0;
  SLIDES.forEach((el, k) => {
    el.classList.toggle("on", k === i);
    el.classList.toggle("delay", first && k === 0);
    el.setAttribute("aria-hidden", String(k !== i));
  });
  document.querySelectorAll(".dots button").forEach((b, k) => b.setAttribute("aria-current", String(k === i)));
  $("#next").hidden = i === SLIDES.length - 1;
  orion.visible = orion.userData.fill.visible = i === 1 || i === 4;
  pathLine.visible = i === 0 || i === 3;
  orionMark.visible = i === 0 || i === 3;
  wing.visible = false;
  setNear(i === 1 || i === 4 ? 0.0008 : 0.05);
  if (i === 3) countUp();
}
function heroStep(dir) {
  const now = performance.now();
  if (now < heroLock || chapter !== "hero") return;
  heroLock = now + 900;
  if (dir > 0 && heroIdx === SLIDES.length - 1) return launch();
  goHero(heroIdx + dir);
}
// 記録の数字：0 → 252,756（NASA）
function countUp() {
  const el = $("#count"), t0 = performance.now(), N = 252756;
  const tick = (now) => {
    const k = reduce ? 1 : smoothstep((now - t0) / 1800, 0, 1);
    el.textContent = Math.round(N * k).toLocaleString("en-US");
    if (k < 1 && heroIdx === 3) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
async function launch() {
  if (launching) return;
  launching = true;
  launchT = 0;
  $("#hero").classList.add("launching");
  await sleep(reduce ? 200 : 1700);
  fade(true);
  await sleep(1400);
  launching = false;
  $("#hero").classList.remove("launching");
  enterMap();
}
const camTo = new THREE.Vector3(), flare = billboard(billboardMat(glowTex(0.12), [1, 0.75, 0.45], 0));
scene.add(flare);
function heroFrame(dt) {
  heroT += dt;
  const i = heroIdx;
  if (i === 0 || i === 3) {
    // 道のりぜんたい：月はいちばん近づいたときの場所。線は少しずつ描く
    place(T_MOON);
    overview(0.42, heroT * 0.025 + (i === 3 ? 0.6 : 0), camera.position);
    look(camera.position, BOX_C, new THREE.Vector3(0, 1, 0));
    setFov(portrait() ? 62 : 46, 1);
    const k = i === 0 ? smoothstep(heroT, 1.6, 6) : 1;
    pathGeo.setDrawRange(0, Math.floor(PATH_N * k));
    const pi = i === 0 ? Math.min(P.length - 1, Math.floor((P.length - 1) * k)) : FAR_I;
    orionMark.position.copy(v3(P[pi][1], P[pi][2], P[pi][3]));
    orionMark.scale.setScalar(camera.position.distanceTo(orionMark.position) * 0.03);
  } else if (i === 1 || i === 4) {
    // オリオンの再現モデル（地球を背に）。射出のときは、月のほうへ加速して小さくなる
    const s = place(d(0.35));
    placeOrion(s);
    outsideCam(s, 0, heroT * (i === 1 ? 0.08 : 0.05) + (i === 4 ? 1.8 : 0), camTo);
    if (!launching) camera.position.copy(camTo);
    const toO = s.craft.clone().sub(camera.position).normalize(), toE = camera.position.clone().negate().normalize();
    const aim = camera.position.clone().add(toO.clone().multiplyScalar(portrait() ? 4.5 : 1.6).add(toE));
    const up = outsideUp(toO, toE);
    // 横長の画面は文字が下の真ん中にくるので、オリオンを少し上へ
    if (!portrait()) aim.addScaledVector(up, -aim.distanceTo(camera.position) * 0.16);
    look(camera.position, aim, up);
    setFov(portrait() ? 62 : 46, 1);
    if (launching) {
      launchT += dt;
      const toMoon = s.moon.clone().sub(s.craft).normalize();
      const k = launchT * launchT * 0.06; // ゆっくり出て、だんだん速く
      orion.position.addScaledVector(toMoon, k);
      flare.position.copy(orion.position).addScaledVector(toMoon, -0.006);
      flare.scale.setScalar(0.03 + launchT * 0.02);
      flare.material.uniforms.opacity.value = Math.min(1, launchT * 1.5);
    } else flare.material.uniforms.opacity.value = 0;
  } else if (i === 2) {
    // 乗員：月の地平線へ沈んでいく地球（オリオンの位置から計算した眺め。このときの月面は日が当たっている）
    const t = T_SET - d(0.012) + Math.min(heroT * 12, d(0.01));
    const s = place(t);
    camera.position.copy(s.craft);
    const a = riseAim(s);
    // 文字が下にあるので、地平線と地球を画面の上のほうへ
    const fov = portrait() ? 30 : 20;
    const dir = a.target.clone().sub(camera.position).normalize();
    a.target.copy(camera.position).add(dir.addScaledVector(a.up, -Math.tan((fov * Math.PI) / 180) * (portrait() ? 0.16 : 0.07)));
    look(camera.position, a.target, a.up);
    setFov(fov, 1);
  }
}

// =====================================================================
// 第2章：月の地名マップ
// =====================================================================
// 月の上の向き（体の座標：x＝経度0°、y＝東経90°、z＝北極）→ 球の模型の座標（+x・−z・+y）
const local = (lat, lon, r = R_M) => {
  const a = (lat * Math.PI) / 180, b = (lon * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(a) * Math.cos(b) * r, Math.sin(a) * r, -Math.cos(a) * Math.sin(b) * r);
};
// 地図の飾り（輪郭・クレーターの円・オリオンの真下の道）を、月と同じ形の少し大きな球に貼る
const OV_W = 2048, OV_H = 1024;
const xy = (lon, lat) => [((lon + 180) / 360) * OV_W, ((90 - lat) / 180) * OV_H];
function strokeLonLat(g, pts) {
  g.beginPath();
  let prev = null;
  for (const [lon, lat] of pts) {
    const [x, y] = xy(lon, lat);
    if (!prev || Math.abs(lon - prev) > 180) g.moveTo(x, y);
    else g.lineTo(x, y);
    prev = lon;
  }
  g.stroke();
}
// 球の上の円（中心と角の半径）を、経度・緯度の点の列に
function circleLonLat(lat, lon, radKm, n = 72) {
  const ang = radKm / 1737.4, a = (lat * Math.PI) / 180, b = (lon * Math.PI) / 180, out = [];
  for (let k = 0; k <= n; k++) {
    const th = (k / n) * Math.PI * 2;
    const la = Math.asin(Math.sin(a) * Math.cos(ang) + Math.cos(a) * Math.sin(ang) * Math.cos(th));
    const lo = b + Math.atan2(Math.sin(th) * Math.sin(ang) * Math.cos(a), Math.cos(ang) - Math.sin(a) * Math.sin(la));
    out.push([((((lo * 180) / Math.PI + 180) % 360) + 360) % 360 - 180, (la * 180) / Math.PI]);
  }
  return out;
}
// オリオンの航路：最接近の前後。月の体の座標で（地面との関係が正しくなるように、その時刻の月の向きで直す）
const TRACK = [];
for (let t = T_MOON - d(0.75); t <= T_MOON + d(0.75); t += 120) TRACK.push(t);
const trackPts = TRACK.map((t) => {
  const s = stateAt(t), ax = moonAxesAt(traj.moonFrame, t);
  // 画面の座標 → 軌道データの座標（km）
  const r = [(s.craft.x - s.moon.x) / KM, -(s.craft.z - s.moon.z) / KM, (s.craft.y - s.moon.y) / KM];
  const bx = r[0] * ax.x[0] + r[1] * ax.x[1] + r[2] * ax.x[2];
  const by = r[0] * ax.y[0] + r[1] * ax.y[1] + r[2] * ax.y[2];
  const bz = r[0] * ax.z[0] + r[1] * ax.z[1] + r[2] * ax.z[2];
  const dist = Math.hypot(bx, by, bz);
  return { t, local: new THREE.Vector3(bx * KM, bz * KM, -by * KM), lat: (Math.asin(bz / dist) * 180) / Math.PI, lon: (Math.atan2(by, bx) * 180) / Math.PI, dist };
}).filter((p) => p.dist < 30000); // 地図に描くのは、月の中心から 3万 km まで
// 航路を見る向き：月をまわる道の面を、斜め上から（道の曲がりがよく見えるように）
const ROUTE_CAM = (() => {
  const near = trackPts.reduce((a, b) => (b.dist < a.dist ? b : a));
  const i = trackPts.indexOf(near), v = trackPts[Math.min(trackPts.length - 1, i + 1)].local.clone().sub(trackPts[Math.max(0, i - 1)].local);
  const n = new THREE.Vector3().crossVectors(near.local, v).normalize();
  const dir = n.multiplyScalar(Math.cos(0.55)).addScaledVector(near.local.clone().normalize(), Math.sin(0.55)).normalize();
  // 模型の座標（+x・北・−東）→ 緯度・経度
  return { lat: (Math.asin(dir.y) * 180) / Math.PI, lon: (Math.atan2(-dir.z, dir.x) * 180) / Math.PI };
})();
const overlayTex = canvasTex(OV_W, OV_H, (g) => {
  g.lineJoin = g.lineCap = "round";
  for (const p of PLACES) {
    const art = !!p.artemis;
    g.strokeStyle = art ? "rgba(255,181,71,0.95)" : "rgba(238,246,243,0.42)";
    g.lineWidth = art ? 2.6 : 1.4;
    g.setLineDash(p.kind === "montes" ? [6, 5] : []);
    if (p.rings.length) for (const r of p.rings) strokeLonLat(g, r);
    else if (p.kind === "crater" && p.diamKm >= 25) strokeLonLat(g, circleLonLat(p.lat, p.lon, p.diamKm / 2));
  }
  // オリオンの真下の道（月面から 2万 km より近いところ）
  g.setLineDash([10, 8]);
  g.strokeStyle = "rgba(255,181,71,0.9)";
  g.lineWidth = 3;
  strokeLonLat(g, trackPts.filter((p) => p.dist < 20000).map((p) => [p.lon, p.lat]));
});
const overlay = new THREE.Mesh(
  new THREE.SphereGeometry(R_M * 1.002, 96, 64),
  new THREE.ShaderMaterial({
    uniforms: { map: { value: overlayTex }, k: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform float k; varying vec2 vUv; void main(){ vec4 c = texture2D(map, vUv); gl_FragColor = vec4(c.rgb, c.a * k); }`,
    transparent: true,
    depthWrite: false,
  }),
);
moon.add(overlay);
// オリオンの航路（点線。月のまわりの、本当の形と大きさ）
const trackLine = (() => {
  const pos = new Float32Array(trackPts.length * 3);
  trackPts.forEach((p, i) => pos.set([p.local.x, p.local.y, p.local.z], i * 3));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.Points(
    g,
    new THREE.ShaderMaterial({
      uniforms: { k: { value: 0 } },
      vertexShader: `void main(){ gl_PointSize = 3.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float k; void main(){ gl_FragColor = vec4(1.0, 0.71, 0.28, 0.85 * k); }`,
      transparent: true,
      depthWrite: false,
    }),
  );
  moon.add(m);
  return m;
})();
// 地図のあいだは、カメラについてくる光（どこを向けても読めるように）
const headLight = new THREE.DirectionalLight(0xffffff, 0);
headLight.position.set(0.2, 0.4, 1);
camera.add(headLight);
headLight.target = moon;

// 地名のボタン
const KIND_JA = { mare: "海", sinus: "湾", crater: "クレーター", montes: "山脈", albedo: "明るい模様" };
const labelsEl = $("#labels");
const LABELS = PLACES.map((p) => {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `place ${p.kind === "mare" || p.kind === "sinus" ? "mare" : ""} ${p.artemis ? "art" : ""}`;
  el.textContent = p.ja ?? p.en;
  el.setAttribute("aria-label", `${p.ja ?? p.en}（${KIND_JA[p.kind]}）`);
  el.addEventListener("click", () => selectPlace(p));
  labelsEl.append(el);
  const pri = (p.artemis ? 3000 : 0) + (p.kind === "mare" ? 1500 : 0) + p.diamKm;
  return { p, el, pri, local: local(p.lat, p.lon), normal: local(p.lat, p.lon, 1) };
});
const orionTag = document.createElement("button");
orionTag.type = "button";
orionTag.className = "place orion-tag";
orionTag.textContent = "ORION";
orionTag.setAttribute("aria-label", "オリオン（アルテミス2号のミッション）");
orionTag.addEventListener("click", () => selectOrion());
labelsEl.append(orionTag);
// 着陸地点のボタン（「着陸」を押したときだけ出す）
const SITE_KIND = { crewed: "人が降りた場所", lander: "着陸機", rover: "ローバー（止まった場所）", impact: "衝突した場所" };
const SITES = LANDERS.sites.map((p) => {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `place site ${p.kind} off`;
  el.textContent = p.name + (p.guess ? "（推測）" : "");
  el.setAttribute("aria-label", `${p.name}（${SITE_KIND[p.kind]}）`);
  el.addEventListener("click", () => selectSite(p));
  labelsEl.append(el);
  const pri = { crewed: 3000, lander: 2000, rover: 1000, impact: 1500 }[p.kind] + (p.who.includes("日本") ? 500 : 0);
  return { p, el, pri, site: true, local: local(p.lat, p.lon), normal: local(p.lat, p.lon, 1) };
});
const ALL_LABELS = [...LABELS, ...SITES];
let siteView = false;
// 最接近の高さのものさし（航路を見るとき）：月の直径と、月面からオリオンまでを、同じ線の上に並べる
//   NASA「4,067 miles above the lunar surface at their closest approach」（https://www.nasa.gov/blogs/missions/2026/04/11/artemis-ii-astronauts-back-in-houston-reunite-with-families/。C22 で照合）
//   NASA Moon Facts「With a radius of about 1,080 miles (1,740 kilometers)」（https://science.nasa.gov/moon/facts/）→ 直径 約3,480 km。6,545 ÷ 3,480 ≒ 1.9
//   線の位置と長さは軌道データ（最接近の点）から。表示の数字は NASA の値
const RULER = (() => {
  const near = trackPts.reduce((a, b) => (b.dist < a.dist ? b : a));
  const dir = near.local.clone().normalize();
  const mk = (a, b, rgb) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([a.x, a.y, a.z, b.x, b.y, b.z]), 3));
    const m = new THREE.LineSegments(
      g,
      new THREE.ShaderMaterial({
        uniforms: { k: { value: 0 } },
        vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float k; void main(){ gl_FragColor = vec4(${rgb}, 0.95 * k); }`,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    m.renderOrder = 5;
    moon.add(m);
    return m;
  };
  const top = dir.clone().multiplyScalar(R_M), bottom = dir.clone().multiplyScalar(-R_M);
  const lines = [mk(bottom, top, "0.37, 0.95, 0.76"), mk(top, near.local, "1.0, 0.71, 0.28")];
  const tag = (cls, html) => {
    const el = document.createElement("div");
    el.className = `ruler-tag ${cls} off`;
    el.innerHTML = html;
    labelsEl.append(el);
    return el;
  };
  return {
    lines,
    tags: [
      { el: tag("dia", "月の直径<b>約3,480 km</b>"), at: new THREE.Vector3() },
      { el: tag("alt", "最接近 · 月面から<b>6,545 km</b><small>月の直径の 約1.9倍 · NASA</small>"), at: top.clone().add(near.local).multiplyScalar(0.5) },
    ],
  };
})();
function placeRuler(dt) {
  const on = chapter === "map" && (routeView || selected?.orion);
  for (const l of RULER.lines) l.material.uniforms.k.value = clamp(l.material.uniforms.k.value + (on ? dt : -dt * 2), 0, 1);
  for (const t of RULER.tags) {
    const sp = moon.localToWorld(tmpV.copy(t.at)).project(camera);
    const vis = on && sp.z < 1 && Math.abs(sp.x) < 0.95 && Math.abs(sp.y) < 0.95;
    t.el.classList.toggle("off", !vis);
    if (!vis) continue;
    const x = ((sp.x + 1) / 2) * innerWidth, y = ((1 - sp.y) / 2) * innerHeight;
    if (t.el.classList.contains("dia")) {
      // 直径：月の左がわに（月の見かけの半径だけずらす）
      const c = moon.getWorldPosition(tmpN), edge = c.clone().addScaledVector(tmpV.setFromMatrixColumn(camera.matrixWorld, 0), R_M).project(camera);
      const rpx = ((edge.x - c.project(camera).x) / 2) * innerWidth;
      t.el.style.transform = `translate(${x - rpx - 12}px, ${y - 14}px) translateX(-100%)`;
    } else t.el.style.transform = `translate(${x + 10}px, ${y - 10}px)`;
  }
}

// カメラの位置：月の体の座標の緯度・経度と距離（ドラッグで回す。ゆっくり自動で回る）
const cam = { lat: 8, lon: -35, dist: 3.4, toLat: 8, toLon: -35, toDist: 3.4, auto: true };
let routeView = false, selected = null, viewOff = { x: 0, y: 0 };
function enterMap() {
  setChapter("map");
  place(T_MOON);
  orion.visible = orion.userData.fill.visible = false;
  pathLine.visible = false;
  wing.visible = false;
  orionMark.visible = true;
  flare.material.uniforms.opacity.value = 0;
  setNear(0.05);
  light.intensity = 0.25;
  headLight.intensity = 1.35;
  cam.dist = cam.toDist = portrait() ? 4.4 : 3.4;
  fade(false, true);
  setTimeout(() => $("#map-hint").classList.add("off"), 6000);
}
function camDir(lat, lon) {
  const ax = getMoonAx(), a = (lat * Math.PI) / 180, b = (lon * Math.PI) / 180;
  return dir3(ax.x).multiplyScalar(Math.cos(a) * Math.cos(b)).add(dir3(ax.y).multiplyScalar(Math.cos(a) * Math.sin(b))).add(dir3(ax.z).multiplyScalar(Math.sin(a)));
}
const wrap = (x) => ((((x + 180) % 360) + 360) % 360) - 180;
function mapFrame(dt) {
  if (cam.auto && !selected) cam.toLon = wrap(cam.toLon - dt * 3);
  cam.lat += (cam.toLat - cam.lat) * Math.min(1, dt * 3.2);
  cam.lon += wrap(cam.toLon - cam.lon) * Math.min(1, dt * 3.2);
  cam.dist += (cam.toDist - cam.dist) * Math.min(1, dt * 2.6);
  const M = moon.position;
  camera.position.copy(M).addScaledVector(camDir(cam.lat, cam.lon), R_M * cam.dist);
  look(camera.position, M, dir3(getMoonAx().z));
  setFov(portrait() ? 50 : 38, 1);
  // カードを開いているあいだは、月を左（スマホは上）へよける
  const goal = selected ? (portrait() ? { x: 0, y: innerHeight * 0.2 } : { x: (380 + 40) / 2, y: 0 }) : { x: 0, y: 0 };
  viewOff.x += (goal.x - viewOff.x) * Math.min(1, dt * 4);
  viewOff.y += (goal.y - viewOff.y) * Math.min(1, dt * 4);
  camera.setViewOffset(innerWidth, innerHeight, viewOff.x, viewOff.y, innerWidth, innerHeight);
  overlay.material.uniforms.k.value = Math.min(1, overlay.material.uniforms.k.value + dt * 0.8);
  trackLine.material.uniforms.k.value = Math.min(1, trackLine.material.uniforms.k.value + dt * 0.5);
  // オリオン：航路の上を、ゆっくりめぐる（20秒で1周）
  const tp = trackPts[Math.floor(((performance.now() / 20000) % 1) * trackPts.length)];
  moon.localToWorld(orionMark.position.copy(tp.local));
  orionMark.scale.setScalar(camera.position.distanceTo(orionMark.position) * 0.035);
  placeLabels();
  placeRuler(dt);
}
// 地名を画面に置く（こちらを向いていないもの・重なるものは隠す。アルテミス2号に関係するもの・海を優先）
const tmpV = new THREE.Vector3(), tmpN = new THREE.Vector3();
function placeLabels() {
  const boxes = [];
  const toCam = (w) => tmpN.copy(camera.position).sub(w).normalize();
  const items = ALL_LABELS.filter((L) => !!L.site === siteView).sort((a, b) => b.pri - a.pri);
  for (const L of ALL_LABELS) if (!!L.site !== siteView) L.el.classList.add("off");
  for (const L of items) {
    moon.localToWorld(tmpV.copy(L.local));
    const n = L.normal.clone().applyQuaternion(moon.quaternion);
    const facing = n.dot(toCam(tmpV));
    const sp = tmpV.clone().project(camera);
    const x = ((sp.x + 1) / 2) * innerWidth, y = ((1 - sp.y) / 2) * innerHeight;
    const w = L.el.textContent.length * 12 + 16, h = 20;
    let ok = facing > 0.22 && sp.z < 1 && (routeView ? L.p.artemis || L.p.kind === "mare" : true);
    if (ok) for (const b of boxes) if (x < b.x + b.w && x + w > b.x && y - h / 2 < b.y + b.h && y + h / 2 > b.y - 0) { ok = false; break; }
    if (ok) boxes.push({ x, y: y - h / 2, w, h });
    L.el.classList.toggle("off", !ok);
    L.el.classList.toggle("sel", selected === L.p);
    if (ok) L.el.style.transform = `translate(${x - 5}px, ${y - 11}px)`;
  }
  const sp = orionMark.position.clone().project(camera);
  const vis = sp.z < 1 && Math.abs(sp.x) < 1 && Math.abs(sp.y) < 1;
  orionTag.classList.toggle("off", !vis);
  if (vis) orionTag.style.transform = `translate(${((sp.x + 1) / 2) * innerWidth - 7}px, ${((1 - sp.y) / 2) * innerHeight - 11}px)`;
}

// ---------- カード ----------
const card = $("#card");
function li(text) {
  return Object.assign(document.createElement("li"), { textContent: text });
}
function row(dl, k, v) {
  const dd = document.createElement("dd");
  if (Array.isArray(v)) dd.append(Object.assign(document.createElement("ul"), {})), dd.firstChild.append(...v.map(li));
  else dd.textContent = v;
  dl.append(Object.assign(document.createElement("dt"), { textContent: k }), dd);
}
function links(list) {
  $("#card-links").replaceChildren(
    ...list.map((l) => {
      const a = Object.assign(document.createElement("a"), { href: l.href, target: "_blank", rel: "noopener", textContent: l.text });
      a.setAttribute("aria-label", l.aria);
      return a;
    }),
  );
}
const fmtKm = (km) => `${Math.round(km).toLocaleString("ja-JP")} km`;
function selectPlace(p) {
  selected = p;
  cam.auto = false;
  cam.toLat = clamp(p.lat, -70, 70);
  cam.toLon = p.lon;
  cam.toDist = clamp(1.35 + (p.diamKm / 1737.4) * 2.2, 2.0, 3.6) + (portrait() ? 0.8 : 0);
  routeView = false;
  $("#b-route").setAttribute("aria-pressed", "false");
  const tg = TARGETS.find((x) => x.usgs.endsWith(`/${p.usgs}`));
  $("#card-tag").textContent = "地名 · IAU";
  $("#card-art").hidden = !p.artemis;
  const nm = $("#card-name");
  nm.textContent = p.ja ?? p.en;
  if (p.ja) nm.append(Object.assign(document.createElement("small"), { textContent: p.en }));
  $("#card-meta").textContent = `${KIND_JA[p.kind]} · 大きさ ${fmtKm(p.diamKm)} · IAU ${p.year ?? "—"}（USGS）`;
  $("#card-why").textContent = p.artemis?.why ?? "";
  const cmp = $("#card-compare"), isBasin = p.id === "mare_orientale" || p.id === "hertzsprung";
  cmp.hidden = !isBasin;
  cmp.querySelectorAll(".cmp").forEach((c) => c.classList.toggle("cur", (c.dataset.k === "orientale") === (p.id === "mare_orientale")));
  const z = $("#card-zoom");
  z.hidden = !tg?.zoom;
  if (tg?.zoom) {
    $("#card-zoom-img").src = `../../assets/moon/${tg.zoom.file}`;
    $("#card-zoom-img").alt = tg.zoom.alt;
    $("#card-zoom-cap").textContent = tg.zoom.caption;
  }
  const dl = $("#card-dl");
  dl.replaceChildren();
  if (p.origin) row(dl, "名前の由来", `${p.origin}（USGS）`);
  if (tg) {
    row(dl, "概要", tg.facts);
    if (tg.research?.length) row(dl, "研究", tg.research);
  }
  links([
    { href: `https://planetarynames.wr.usgs.gov/Feature/${p.usgs}`, text: "USGS ↗", aria: "USGS の地名のページ" },
    ...(p.artemis?.photo ? [{ href: `https://www.nasa.gov/image-detail/amf-${p.artemis.photo}/`, text: "📷 NASA ↗", aria: "NASA の写真と説明" }] : []),
  ]);
  showCard();
}
function selectOrion() {
  selected = { orion: true };
  cam.auto = false;
  cam.toDist = portrait() ? 30 : 22;
  cam.toLat = clamp(ROUTE_CAM.lat, -80, 80);
  cam.toLon = ROUTE_CAM.lon;
  $("#card-tag").textContent = MISSION.tag;
  $("#card-art").hidden = false;
  $("#card-name").textContent = MISSION.name;
  $("#card-meta").textContent = MISSION.log;
  $("#card-why").textContent = MISSION.lead;
  $("#card-compare").hidden = $("#card-zoom").hidden = true;
  const dl = $("#card-dl");
  dl.replaceChildren();
  for (const r of MISSION.rows) row(dl, r.k, r.items);
  row(dl, "結果", [RESULTS.head, ...RESULTS.items]);
  links(MISSION.links);
  showCard();
}
const fmtLat = (v) => `${Math.abs(v)}°${v < 0 ? "S" : "N"}`, fmtLon = (v) => `${Math.abs(v)}°${v < 0 ? "W" : "E"}`;
function selectSite(p) {
  selected = p;
  cam.auto = false;
  cam.toLat = clamp(p.lat, -75, 75);
  cam.toLon = p.lon;
  cam.toDist = 2.4 + (portrait() ? 0.8 : 0);
  $("#card-tag").textContent = "着陸地点 · NASA";
  $("#card-art").hidden = true;
  $("#card-name").textContent = p.name;
  $("#card-meta").textContent = `${SITE_KIND[p.kind]} · ${p.who} · ${p.date}（UTC）`;
  $("#card-why").textContent = p.statusText ?? (p.status === "unknown" ? "いまの状態：不明（終わったという公式の発表を確認できていない）" : p.kind === "crewed" ? "人が月面に降りた場所" : "");
  $("#card-compare").hidden = $("#card-zoom").hidden = true;
  const dl = $("#card-dl");
  dl.replaceChildren();
  row(dl, "座標", `${fmtLat(p.lat)}, ${fmtLon(p.lon)}（NASA NSSDCA）`);
  if (p.guess) row(dl, "推測", p.guess);
  if (p.note) row(dl, "注記", p.note);
  links([
    { href: LANDERS.source.href, text: "NASA の一覧 ↗", aria: LANDERS.source.text },
    ...(p.statusSrc ? [{ href: p.statusSrc, text: "公式の発表 ↗", aria: "運用の状態の公式の発表" }] : []),
  ]);
  showCard();
}
// 「着陸」を押したとき：月のいま（C29 を照合。voyascope-research の research/verification/2026-10-12-c29.md）
//   LRO：https://science.nasa.gov/solar-system/moon/nasas-moon-orbiter-spots-new-once-in-century-moon-crater/（2026-09-16）
//   Chandrayaan-2：https://www.isro.gov.in/Indian_Space_Situational_Awareness_Report_2025.html（2026-04-16）「Chandrayaan-2 Orbiter (CH2O) … are also active.」
//   CAPSTONE：https://www.nasa.gov/technology/space-comms/nasas-capstone-completes-extended-mission-testing-lunar-technologies/（2026-07-06）
//   Moon Base：https://www.nasa.gov/reference/moonbase-about/ 「NASA plans to establish the Moon Base near the lunar South Pole」「Phase Three (2032 and Beyond): Live and Work on the Moon」
//   アルテミス4号：https://www.nasa.gov/news-release/nasa-marches-toward-artemis-iii-mission-in-2027-names-crew-members/ 「Artemis IV, the first planned crewed mission to the lunar South Pole in 2028」
//   ILRS：https://english.www.gov.cn/news/202504/24/content_WS680976d7c6d0868f4e8f2045.html 「a basic model to be built by 2035 in the lunar south pole region」
function showMoonNow() {
  selected = { now: true };
  $("#card-tag").textContent = "月のいま · 2026年10月";
  $("#card-art").hidden = true;
  $("#card-name").textContent = "月面に降りたもの";
  $("#card-meta").textContent = `${LANDERS.sites.length} か所（NASA の一覧から）`;
  $("#card-why").textContent = "人が住む基地は、まだない（推測：NASA は南極付近に Moon Base を「これから」作る計画）";
  $("#card-compare").hidden = $("#card-zoom").hidden = true;
  const dl = $("#card-dl");
  dl.replaceChildren();
  row(dl, "月を回る探査機", ["LRO（NASA）· 2026年9月の記事で、撮った写真から新しいクレーターを報告", "Chandrayaan-2 周回機（ISRO）· 2026年4月の報告で「運用中」", "CAPSTONE · NASA の活動は2026年6月に終了。Advanced Space が試験に使い続ける（NASA）"]);
  row(dl, "これからの計画", ["アルテミス4号：月の南極に人が降りる（2028年の計画・NASA）", "Moon Base：南極付近。2032年以降に長く住んで働く（3段階の計画・NASA）", "ILRS（中国・ロシア）：2035年までに南極域で基本形（計画）"]);
  row(dl, "印の色", ["白：人が降りた場所（アポロ）", "緑：着陸機・ローバー", "赤：着陸できずに衝突した場所"]);
  links([
    { href: LANDERS.source.href, text: "NASA の一覧 ↗", aria: LANDERS.source.text },
    { href: "https://www.nasa.gov/reference/moonbase-about/", text: "NASA Moon Base ↗", aria: "NASA の Moon Base の計画" },
  ]);
  showCard();
}
function showCard() {
  card.hidden = false;
  card.scrollTop = 0;
  $("#tip").hidden = true;
}
function closeCard() {
  if (card.hidden) return;
  card.hidden = true;
  selected = null;
  if (!routeView) cam.toDist = portrait() ? 4.4 : 3.4;
}
$("#card-close").addEventListener("click", closeCard);

// ---------- 月の豆知識（NASA の原文から。C28 で照合：voyascope-research の research/verification/2026-10-12-c28.md） ----------
// NASA「Moon Facts」https://science.nasa.gov/moon/facts/
//   「The Moon likely formed after a Mars-sized body collided with Earth several billion years ago. The resulting debris from both Earth and the impactor accumulated to form our natural satellite」
//   「The Moon is rotating at the same rate that it revolves around Earth (called synchronous rotation), so the same hemisphere faces Earth all the time.」
//   「Humans didn't see the lunar far side until a Soviet spacecraft flew past in 1959.」
//   「The dark features, called maria (Latin for seas), are impact basins that were filled with lava between 4.2 and 1.2 billion years ago.」
//   「the gravity on the surface of the Moon is one-sixth of Earth's」
//   「The temperature on the Moon reaches about 260 degrees Fahrenheit (127 degrees Celsius) when in full Sun, but in darkness, the temperatures plummet to about -280 degrees Fahrenheit (-173 degrees Celsius).」
// NASA SVS「The Moon From the Other Side」https://svs.gsfc.nasa.gov/vis/a000000/a004200/a004253/G2015-013_ViewOtherSide.html
//   「The far side of the Moon has fewer of the smooth, dark spots, called maria, that cover the side that faces Earth. Instead, the far side is covered with craters of all sizes.」
// NASA「Laser Beams Reflected Between Earth and Moon Boost Science」https://www.nasa.gov/missions/laser-beams-reflected-between-earth-and-moon-boost-science
//   「the Earth and Moon are slowly drifting apart at the rate that fingernails grow, or 1.5 inches (3.8 centimeters) per year」
//   「Two were delivered by Apollo 11 and 14 crews … Soviet robotic rovers called Lunokhod 1 and 2 … carry two additional reflectors」
//   （Moon Facts には「about an inch farther away each year」とある。測った値を書いている、こちらの記事を使う）
const NASA_MOON = "https://science.nasa.gov/moon/facts/";
const TIPS = [
  { text: "月は、もとは地球の一部だった？ 火星くらいの天体が地球にぶつかり、地球とその天体のかけらが集まって月ができた、と考えられています。", src: NASA_MOON },
  { text: "月は、自転と、地球のまわりを回る速さが同じ。だから、いつも同じ面を地球に向けています。人が裏側を初めて見たのは1959年、ソ連の探査機が通りすぎたときでした。", src: NASA_MOON },
  { text: "月の裏側には、暗い「海」が少なく、大小のクレーターでおおわれています。アルテミス2号が回ったのは、この裏側です。", src: "https://svs.gsfc.nasa.gov/vis/a000000/a004200/a004253/G2015-013_ViewOtherSide.html" },
  { text: "暗く見える「海」は、水ではありません。42億〜12億年前に、溶岩で満たされた盆地です。", src: NASA_MOON },
  { text: "月は、1年に約3.8cm、地球から離れています。爪がのびるのと同じくらいの速さです（アポロなどが月に置いた反射板に、レーザーを当てて測っています）。", src: "https://www.nasa.gov/missions/laser-beams-reflected-between-earth-and-moon-boost-science" },
  { text: "月の重力は、地球の6分の1。月面を歩く宇宙飛行士が、はずむように見えるのはそのためです。", src: NASA_MOON },
  { text: "月面の温度は、日なたで約127℃、暗いところでは約−173℃まで下がります。", src: NASA_MOON },
];
let tipI = 0;
function showTip(i) {
  tipI = (i + TIPS.length) % TIPS.length;
  $("#tip-n").textContent = `${tipI + 1}/${TIPS.length}`;
  $("#tip-text").textContent = TIPS[tipI].text;
  $("#tip-src").href = TIPS[tipI].src;
  $("#tip").hidden = false;
}
$("#b-tips").addEventListener("click", () => ($("#tip").hidden ? showTip(tipI) : ($("#tip").hidden = true)));
$("#tip-next").addEventListener("click", () => showTip(tipI + 1));
$("#tip-prev").addEventListener("click", () => showTip(tipI - 1));
$("#tip-close").addEventListener("click", () => ($("#tip").hidden = true));
$("#b-sites").addEventListener("click", () => {
  siteView = !siteView;
  $("#b-sites").setAttribute("aria-pressed", String(siteView));
  if (routeView) $("#b-route").click();
  if (siteView) {
    cam.toDist = portrait() ? 4.4 : 3.4;
    showMoonNow();
  } else closeCard();
});
$("#b-route").addEventListener("click", () => {
  routeView = !routeView;
  if (routeView && siteView) {
    siteView = false;
    $("#b-sites").setAttribute("aria-pressed", "false");
  }
  $("#b-route").setAttribute("aria-pressed", String(routeView));
  cam.toDist = routeView ? (portrait() ? 34 : 24) : portrait() ? 4.4 : 3.4;
  cam.auto = !routeView;
  if (routeView) {
    closeCard();
    cam.toLat = clamp(ROUTE_CAM.lat, -80, 80);
    cam.toLon = ROUTE_CAM.lon;
  }
});

// ---------- 地図の操作：ドラッグで回す・つまむ／ホイールで寄る ----------
const ptrs = new Map();
let pinch0 = 0;
const canvas = renderer.domElement;
canvas.addEventListener("pointerdown", (e) => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.setPointerCapture(e.pointerId);
  if (chapter === "map") cam.auto = false;
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
  }
  touch0 = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (chapter !== "map") return;
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], dd = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch0) cam.toDist = clamp(cam.toDist * (pinch0 / dd), 1.6, 40);
    pinch0 = dd;
    return;
  }
  const k = (0.18 * cam.dist) / 3.4;
  cam.toLon = wrap(cam.toLon - dx * k);
  cam.toLat = clamp(cam.toLat + dy * k, -80, 80);
  cam.lon = wrap(cam.lon - dx * k);
  cam.lat = clamp(cam.lat + dy * k, -80, 80);
});
let touch0 = null;
const up = (e) => {
  ptrs.delete(e.pointerId);
  pinch0 = 0;
  if (!touch0) return;
  const dx = e.clientX - touch0.x, dy = e.clientY - touch0.y;
  // ヒーロー：縦にスワイプ。撮影モード：横にスワイプ
  if (chapter === "hero" && Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) heroStep(dy < 0 ? 1 : -1);
  if (chapter === "photo" && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) photoGo(photoI + (dx < 0 ? 1 : -1));
  touch0 = null;
};
canvas.addEventListener("pointerup", up);
canvas.addEventListener("pointercancel", up);
addEventListener(
  "wheel",
  (e) => {
    if (chapter === "hero") {
      if (Math.abs(e.deltaY) > 8) heroStep(e.deltaY > 0 ? 1 : -1);
    } else if (chapter === "map" && !card.contains(e.target)) {
      e.preventDefault();
      cam.auto = false;
      cam.toDist = clamp(cam.toDist * (1 + e.deltaY * 0.0012), 1.6, 40);
    }
  },
  { passive: false },
);
addEventListener("keydown", (e) => {
  if (chapter === "hero") {
    if (["ArrowDown", "PageDown", " "].includes(e.key) && !(document.activeElement instanceof HTMLButtonElement)) heroStep(1), e.preventDefault();
    if (["ArrowUp", "PageUp"].includes(e.key)) heroStep(-1), e.preventDefault();
  } else if (chapter === "photo") {
    if (e.key === "ArrowRight") photoGo(photoI + 1);
    if (e.key === "ArrowLeft") photoGo(photoI - 1);
    if (e.key === "Escape") toMapFromPhoto();
  } else if (chapter === "map" && e.key === "Escape") closeCard();
});

// =====================================================================
// 第3章：撮影モード
// =====================================================================
const NASA_FLYBY = "https://www.nasa.gov/news-release/nasas-artemis-ii-crew-beams-official-moon-flyby-photos-to-earth/";
const SCENES = [
  { title: "地球の入り", t0: T_SET - d(0.008), t1: T_SET + d(0.004), set: true, fov: [26, 22], meta: "NASA 撮影 4/7 7:41（日本時間）· Orion の窓から", url: "https://science.nasa.gov/earth/earth-observatory/earthset-from-the-lunar-far-side/" },
  { title: "地球の出", t0: T_RISE - d(0.002), t1: T_RISE + d(0.012), set: true, fov: [20, 16], meta: "NASA 撮影 4/7 8:22（日本時間）· NASA はアポロ8号の「Earthrise」（1968）と並べて紹介", url: NASA_FLYBY },
  { title: "日食", t0: T_ECLIPSE - d(0.02), t1: T_ECLIPSE + d(0.02), fov: [44, 34], meta: "4/7 9:35〜（日本時間・NASA）· 皆既 約54分 · 写真の左はしの光は金星", url: NASA_FLYBY },
];
let photoI = 0, photoT = 0;
function photoGo(i) {
  photoI = (i + SCENES.length) % SCENES.length;
  photoT = 0;
  const s = SCENES[photoI];
  $("#ph-n").textContent = `${photoI + 1}/${SCENES.length}`;
  $("#ph-title").textContent = s.title;
  $("#ph-meta").textContent = s.meta;
  $("#ph-link").href = s.url;
}
async function enterPhoto() {
  fade(true);
  await sleep(900);
  closeCard();
  $("#tip").hidden = true;
  camera.clearViewOffset();
  viewOff = { x: 0, y: 0 };
  setChapter("photo");
  overlay.material.uniforms.k.value = trackLine.material.uniforms.k.value = 0;
  for (const L of ALL_LABELS) L.el.classList.add("off");
  orionTag.classList.add("off");
  orionMark.visible = false;
  light.intensity = 1.7;
  headLight.intensity = 0;
  wing.visible = true;
  photoGo(0);
  fade(false);
}
async function toMapFromPhoto() {
  fade(true);
  await sleep(900);
  wing.visible = false;
  enterMap();
}
function photoFrame(dt) {
  photoT += dt;
  const sc = SCENES[photoI];
  const u = (photoT / 16) % 1; // 16秒で、その場面の時間をひとめぐり
  const s = place(sc.t0 + (sc.t1 - sc.t0) * u);
  camera.position.copy(s.craft);
  if (sc.set) {
    const a = riseAim(s);
    look(camera.position, a.target, a.up);
  } else look(camera.position, s.moon, new THREE.Vector3(0, 1, 0));
  setFov(portrait() ? sc.fov[0] : sc.fov[1], photoT < 0.1 ? 1 : 0.08);
}
$("#ph-prev").addEventListener("click", () => photoGo(photoI - 1));
$("#ph-next").addEventListener("click", () => photoGo(photoI + 1));
$("#ph-back").addEventListener("click", toMapFromPhoto);
$("#b-photo").addEventListener("click", enterPhoto);

// =====================================================================
// 地球へ戻る：月から離れて、暗くなって、余韻だけ（2026-10-12 オーナー）
// =====================================================================
let leaveT = 0;
const leaveFrom = new THREE.Vector3(), leaveDir = new THREE.Vector3();
function startLeave() {
  closeCard();
  $("#tip").hidden = true;
  camera.clearViewOffset();
  for (const L of ALL_LABELS) L.el.classList.add("off");
  orionTag.classList.add("off");
  setChapter("leave");
  leaveT = 0;
  leaveFrom.copy(camera.position);
  leaveDir.copy(camera.position).sub(moon.position).normalize();
  $("#leave").hidden = false;
  setTimeout(() => fade(true, true), reduce ? 0 : 3200);
  setTimeout(() => $("#leave").classList.add("on"), reduce ? 400 : 6400);
}
function leaveFrame(dt) {
  leaveT += dt;
  // ゆっくり出て、だんだん速く。月はうしろに小さくなる
  const k = leaveT * leaveT * 0.9;
  camera.position.copy(leaveFrom).addScaledVector(leaveDir, k);
  look(camera.position, moon.position, dir3(getMoonAx().z));
  overlay.material.uniforms.k.value = Math.max(0, overlay.material.uniforms.k.value - dt);
  trackLine.material.uniforms.k.value = Math.max(0, trackLine.material.uniforms.k.value - dt);
}
$("#b-home").addEventListener("click", startLeave);
$("#again").addEventListener("click", () => location.reload());

// ---------- そのほか ----------
$("#next").addEventListener("click", () => heroStep(1));
$("#launch").addEventListener("click", launch);
document.querySelectorAll(".dots button").forEach((b) => b.addEventListener("click", () => goHero(Number(b.dataset.go))));
$("#info-open").addEventListener("click", () => $("#info").showModal());

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (chapter === "hero") heroFrame(dt);
  else if (chapter === "map") mapFrame(dt);
  else if (chapter === "photo") photoFrame(dt);
  else if (chapter === "leave") leaveFrame(dt);
  stars.position.copy(camera.position);
  updateSunAndCorona();
  for (const m of [sun, corona, orionMark, flare]) faceCamera(m);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// はじめ：黒から、ゆっくり明るく。最初の1枚は少しおいてから
goHero(0, true);
requestAnimationFrame(frame);
setTimeout(() => fade(false, true), 300);

// 確かめ用：#map・#photo・#hero=3・#leave
const hp = location.hash.slice(1);
if (hp === "map") enterMap();
else if (hp === "photo") enterMap(), enterPhoto();
else if (hp.startsWith("hero=")) goHero(Number(hp.slice(5)));
else if (hp === "leave") enterMap(), setTimeout(startLeave, 500);
