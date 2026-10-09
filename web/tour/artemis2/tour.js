// アルテミス2号に乗ってみる（試作）
// - 通り道は trajectory.json（NASA が公開した飛行の軌道データ〔エフェメリス〕を scripts/artemis2-trajectory.mjs で変換したもの）
//   月・太陽の位置と地球の向きも、本物の時刻から計算してある
// - 窓の外は「〜のような眺め」：地球・月・太陽の位置は通り道から計算し、見た目は NASA の写真を参考にした描き方
// - 単位：1 = 1000 km。地球の中心が原点、月の公転面が x-z 面
// - three.js は遠くを見る部屋と同じ r128 の部品だけの版（vendor/three-r128.min.js）。スプライト・線などは ShaderMaterial で作る
import * as THREE from "../../vendor/three-r128.min.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const DOUBLE_SIDE = 2; // THREE.DoubleSide（この版の部品には名前がない）

const KM = 1 / 1000;
const R_E = 6371 * KM;
const R_M = 1737.4 * KM;
const DAY = 86400;
const $ = (s) => document.querySelector(s);

// ---------- 通り道 ----------
const traj = await fetch("trajectory.json").then((r) => r.json());
const P = traj.points; // [t, x, y, z, mx, my, mz]（秒・km。x-y が月の公転面）
const EPOCH = Date.parse(traj.epoch); // t = 0 の日時
const T_END = P.at(-1)[0];
// データの (x, y, z) → 画面の (x, z, -y)（画面は y が上）
const v3 = (x, y, z) => new THREE.Vector3(x * KM, z * KM, -y * KM);
const dir3 = ([x, y, z]) => new THREE.Vector3(x, z, -y).normalize();

// 時刻 t（秒）の宇宙船と月の位置（エルミート補間。速度は前後の点から）
function stateAt(t) {
  t = Math.max(0, Math.min(T_END, t));
  let i = 0, j = P.length - 1;
  while (j - i > 1) {
    const m = (i + j) >> 1;
    if (P[m][0] <= t) i = m;
    else j = m;
  }
  const a = P[i], b = P[j];
  const h = b[0] - a[0] || 1;
  const u = (t - a[0]) / h;
  const der = (k, c) => {
    const p0 = P[Math.max(0, k - 1)], p1 = P[Math.min(P.length - 1, k + 1)];
    return (p1[c] - p0[c]) / (p1[0] - p0[0] || 1);
  };
  const herm = (c) => {
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
    return h00 * a[c] + h10 * h * der(i, c) + h01 * b[c] + h11 * h * der(j, c);
  };
  const x = herm(1), y = herm(2), z = herm(3);
  const vel = (c) => der(i, c) * (1 - u) + der(j, c) * u;
  const mx = a[4] + (b[4] - a[4]) * u, my = a[5] + (b[5] - a[5]) * u, mz = a[6] + (b[6] - a[6]) * u;
  return {
    craft: v3(x, y, z),
    moon: v3(mx, my, mz),
    speed: Math.hypot(vel(1), vel(2), vel(3)),
    rKm: Math.hypot(x, y, z),
    moonKm: Math.hypot(x - mx, y - my, z - mz),
  };
}
// 月にいちばん近づく時刻
const moonDist = (p) => Math.hypot(p[1] - p[4], p[2] - p[5], p[3] - p[6]);
const T_MOON = P.reduce((b, p) => (moonDist(p) < moonDist(b) ? p : b))[0];
// 太陽の向き（最接近のとき。数時間ではほとんど変わらない）
const SUN = dir3(traj.sun);

const d = (x) => x * DAY;

// 地球が月の陰に隠れているか（宇宙船から見て）
const earthHidden = (s) => {
  const e = s.craft.clone().negate().normalize(), m = s.moon.clone().sub(s.craft);
  return e.angleTo(m.clone().normalize()) < Math.asin(Math.min(1, R_M / m.length()));
};
// 地球が月の陰に入る時刻（地球の入り）
const T_SET = (() => {
  for (let t = T_MOON - d(0.3); t < T_MOON + d(0.3); t += 60) if (earthHidden(stateAt(t))) return t;
  return T_MOON - d(0.02);
})();
// 地球が月の陰から出てくる時刻（地球の出）。月にいちばん近づいたあとで探す
const T_RISE = (() => {
  let hidden = false;
  for (let t = T_MOON - d(0.3); t < T_MOON + d(1); t += 60) {
    const h = earthHidden(stateAt(t));
    if (hidden && !h) return t;
    hidden = h;
  }
  return T_MOON + d(0.14);
})();

// ---------- 乗っているあいだの台本（飛行の時刻 → 実際の秒数）。月のまわりはゆっくり ----------
// 順番は本物のとおり：地球の入り → 月にいちばん近づく → 地球の出 → 日食（軌道データから計算すると、写真の時刻とそろう）
// 日食のまんなか：宇宙船から見て、月と太陽がいちばん重なる時刻
const T_ECLIPSE = (() => {
  let best = T_MOON, bestA = Infinity;
  for (let t = T_MOON; t < T_MOON + d(0.25); t += 60) {
    const s = stateAt(t);
    const a = s.moon.clone().sub(s.craft).angleTo(SUN);
    if (a < bestA) [best, bestA] = [t, a];
  }
  return best;
})();
const SEGS = [
  { t0: 0, t1: d(0.35), sec: 20, look: "earth", say: "地球をはなれて、月へ。うしろの窓に、地球がだんだん小さくなっていきます。" },
  { t0: d(0.35), t1: T_MOON - d(0.42), sec: 26, look: "moon", say: "月まで、およそ38万km。何もない宇宙を、何日もかけて進みます。" },
  { t0: T_MOON - d(0.42), t1: T_SET - d(0.008), sec: 26, look: "moon", say: "月が大きくなってきました。月の重力に引かれて、だんだん速くなります。" },
  { t0: T_SET - d(0.008), t1: T_SET + d(0.004), sec: 16, look: "earth", set: true, fov: 24, photo: "earthset", say: "月のふちに、地球が沈んでいきます（地球の入り）。望遠で見ています。" },
  { t0: T_SET + d(0.004), t1: T_RISE - d(0.008), sec: 44, look: "moon", far: true, photo: "farside", say: "月の裏側です。月が電波をさえぎるので、およそ40分、地球と連絡がとれません。" },
  { t0: T_RISE - d(0.008), t1: T_RISE + d(0.012), sec: 24, look: "earth", rise: true, fov: 16, photo: "earthrise", say: "月の地平線から、地球が昇ってきます（地球の出）。望遠で見ています。" },
  { t0: T_RISE + d(0.012), t1: T_ECLIPSE + d(0.02), sec: 28, look: "moon", photo: "eclipse", say: "月の向こうに、太陽が隠れていきます。" },
  { t0: T_ECLIPSE + d(0.02), t1: T_END - d(0.3), sec: 28, look: "earth", say: "地球へ帰ります。月の重力で向きを変えて、地球へ戻ってくる通り道です（自由帰還軌道）。" },
  { t0: T_END - d(0.3), t1: T_END, sec: 18, look: "earth", say: "大気に入ります。まわりの空気がとても熱くなり、オレンジ色に光ります。" },
];
let acc = 0;
for (const s of SEGS) {
  s.r0 = acc;
  acc += s.sec;
  s.r1 = acc;
}
const RIDE_SEC = acc;
const rideToMission = (r) => {
  const s = SEGS.find((x) => r < x.r1) ?? SEGS.at(-1);
  const u = Math.min(1, Math.max(0, (r - s.r0) / s.sec));
  return { t: s.t0 + (s.t1 - s.t0) * u, seg: s, u };
};
$("#tl-moon").style.left = `${((SEGS[4].r0 + SEGS[4].sec / 2) / RIDE_SEC) * 100}%`;


// ---------- 3D ----------
const canvas = $("#scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x01040b);
const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 2500);
scene.add(camera);

const light = new THREE.DirectionalLight(0xffffff, 1.7);
light.position.copy(SUN).multiplyScalar(1000);
scene.add(light);
scene.add(new THREE.AmbientLight(0x2a3a4e, 0.32));
// 地球照：地球で照り返した光が、月の夜の側をうっすら照らす（NASA の写真の説明にもある）
const earthshine = new THREE.DirectionalLight(0x9fc3ff, 0.32);
scene.add(earthshine);

const loadTex = (src) => {
  const img = new Image();
  const tex = new THREE.CanvasTexture(img);
  img.onload = () => (tex.needsUpdate = true);
  img.src = src;
  return tex;
};
// いつもカメラのほうを向く四角（光・太陽・オリオンの印）。加算で光らせる
const billboardMat = (map, color = [1, 1, 1], opacity = 1) =>
  new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, color: { value: new THREE.Vector3(...color) }, opacity: { value: opacity } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 color; uniform float opacity; varying vec2 vUv;
      void main(){ vec4 c = texture2D(map, vUv); gl_FragColor = vec4(c.rgb * color, c.a * opacity); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
const billboard = (mat) => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
const faceCamera = (m) => m.quaternion.copy(camera.quaternion);
const canvasTex = (w, h, draw) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  return new THREE.CanvasTexture(c);
};

// 星（遠くの飾り。カメラについてくる）
const stars = (() => {
  const n = 2600, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const z = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    pos.set([r * Math.cos(a) * 1800, z * 1800, r * Math.sin(a) * 1800], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(
    g,
    new THREE.ShaderMaterial({
      vertexShader: `void main(){ gl_PointSize = 1.6; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `void main(){ gl_FragColor = vec4(0.81, 0.91, 1.0, 0.75); }`,
      transparent: true,
      depthWrite: false,
    }),
  );
})();
scene.add(stars);

// 地球：昼の画像と夜の明かりを、太陽の向きで混ぜる。1日で1回まわる
const earth = new THREE.Mesh(
  new THREE.SphereGeometry(R_E, 96, 64),
  new THREE.ShaderMaterial({
    uniforms: {
      day: { value: loadTex("../../assets/earth/day-2048.jpg") },
      night: { value: loadTex("../../assets/earth/night-2048.jpg") },
      sun: { value: SUN },
    },
    vertexShader: `varying vec2 vUv; varying vec3 vN;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D day; uniform sampler2D night; uniform vec3 sun; varying vec2 vUv; varying vec3 vN;
      void main(){ float l = dot(normalize(vN), sun);
        vec3 d = texture2D(day, vUv).rgb * (0.05 + 1.15 * max(l, 0.0));
        vec3 n = texture2D(night, vUv).rgb * 1.3 * (1.0 - smoothstep(-0.2, 0.15, l));
        gl_FragColor = vec4(d + n, 1.0); }`,
  }),
);
scene.add(earth);
// 大気のうす青い光
const atmo = new THREE.Mesh(
  new THREE.SphereGeometry(R_E * 1.035, 64, 48),
  new THREE.ShaderMaterial({
    uniforms: { sun: { value: SUN } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 sun; varying vec3 vN; varying vec3 vV;
      void main(){ float rim = pow(1.0 - max(dot(vN, vV), 0.0), 3.0); float lit = smoothstep(-0.3, 0.4, dot(vN, sun));
        gl_FragColor = vec4(0.35, 0.6, 1.0, rim * lit * 0.9); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  }),
);
scene.add(atmo);

// 月：NASA SVS の CGI Moon Kit（LRO の写真をつないだ色の地図と、レーザー高度計の標高の地図）。経度0°（地球の側）が真ん中
// https://svs.gsfc.nasa.gov/4720 （クレジット：NASA's Scientific Visualization Studio）。web/assets/moon/ に WebP にして置いた
const moonTex = loadTex("../../assets/moon/lroc-color-2048.webp");
const moonBump = loadTex("../../assets/moon/ldem-1024.webp");
const moon = new THREE.Mesh(new THREE.SphereGeometry(R_M, 96, 64), new THREE.MeshStandardMaterial({ map: moonTex, bumpMap: moonBump, bumpScale: 0.02, roughness: 1, metalness: 0 }));
scene.add(moon);

// 太陽と、月に隠れたときに月のふちで光る輪（コロナのような光）
const glowTex = (inner, ring) =>
  canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    if (ring) {
      gr.addColorStop(0, "rgba(255,240,210,0)");
      gr.addColorStop(0.38, "rgba(255,240,210,0)");
      gr.addColorStop(0.45, "rgba(255,245,225,0.95)");
      gr.addColorStop(0.6, "rgba(255,220,170,0.35)");
      gr.addColorStop(1, "rgba(255,200,140,0)");
    } else {
      gr.addColorStop(0, "rgba(255,255,250,1)");
      gr.addColorStop(inner, "rgba(255,245,215,0.9)");
      gr.addColorStop(0.35, "rgba(255,210,150,0.25)");
      gr.addColorStop(1, "rgba(255,190,120,0)");
    }
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
  });
const sun = billboard(billboardMat(glowTex(0.07)));
scene.add(sun);
const corona = billboard(billboardMat(glowTex(0, true), [1, 1, 1], 0));
scene.add(corona);

// 通り道（外から見るとき）と、光るオリオン
const pathLine = (() => {
  const pos = [];
  for (let i = 1; i < P.length; i++) {
    const a = v3(P[i - 1][1], P[i - 1][2], P[i - 1][3]), b = v3(P[i][1], P[i][2], P[i][3]);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(
    g,
    new THREE.ShaderMaterial({
      vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `void main(){ gl_FragColor = vec4(0.37, 0.95, 0.76, 0.5); }`,
      transparent: true,
      depthWrite: false,
    }),
  );
})();
scene.add(pathLine);
const orionMark = billboard(billboardMat(glowTex(0.15), [1, 0.82, 0.48]));
orionMark.scale.setScalar(22);
scene.add(orionMark);

// 窓の手前の太陽電池パネル（NASA の写真が、パネルの翼のカメラで撮られていたことを参考にした飾り）
const wing = (() => {
  const tex = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = "#16213a";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(140,170,220,0.35)";
    for (let x = 0; x <= w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), new THREE.MeshStandardMaterial({ map: tex, side: DOUBLE_SIDE, roughness: 0.45, metalness: 0.3 }));
  m.position.set(-0.95, -0.52, -1.1);
  m.rotation.set(-0.9, 0.35, 0.25);
  m.visible = false;
  camera.add(m);
  return m;
})();

// ---------- 状態 ----------
let mode = "intro"; // intro → boarding → ride → outro
let ride = 0; // 乗ってからの秒（台本の時計）
let speedMul = 1;
let paused = false;
let boardT = 0;
const camFrom = new THREE.Vector3(), lookQ = new THREE.Quaternion(), tmpQ = new THREE.Quaternion(), mtx = new THREE.Matrix4();
let yaw = 0, pitch = 0, dragging = false, lastDrag = 0;

// 外から見る位置：通り道と月の通り道がぜんぶ入るように、斜め上から
// 縦長の画面（スマホ）では、地球→月を縦に置いて、下の案内の枠より上に収める
const INTRO_TARGET = new THREE.Vector3(), INTRO_CAM = new THREE.Vector3(), INTRO_UP = new THREE.Vector3();
const INTRO_BOX = new THREE.Box3();
for (const p of P) {
  INTRO_BOX.expandByPoint(v3(p[1], p[2], p[3])); // 宇宙船の通り道だけで決める（月は9日で大きく動くので入れない）
}
function setIntroView() {
  const size = INTRO_BOX.getSize(new THREE.Vector3()).length();
  INTRO_BOX.getCenter(INTRO_TARGET);
  if (innerWidth < innerHeight) {
    // 月の側（月がいちばん近いときの位置）を上に。真上から見下ろす
    const far = P.reduce((b, p) => (Math.hypot(p[1], p[2], p[3]) > Math.hypot(b[1], b[2], b[3]) ? p : b));
    const toMoon = v3(far[1], far[2], far[3]).setY(0).normalize(); // 地球から、いちばん遠いところへの向き
    INTRO_UP.copy(toMoon);
    INTRO_TARGET.addScaledVector(toMoon, -size * 0.5); // 絵を画面の上のほうへ
    INTRO_CAM.copy(INTRO_TARGET).add(new THREE.Vector3(0, size * 2.0, 0)).addScaledVector(toMoon, -size * 0.14);
  } else {
    INTRO_UP.set(0, 1, 0);
    // 月の側を左・地球を右に見る向き（左下の案内の枠に地球が隠れないように）。絵を少し右へ
    INTRO_TARGET.x += size * 0.3;
    INTRO_CAM.copy(INTRO_TARGET).add(new THREE.Vector3(0, size * 0.96, -size * 0.65));
  }
}
function introCamera() {
  camera.position.copy(INTRO_CAM);
  mtx.lookAt(INTRO_CAM, INTRO_TARGET, INTRO_UP);
  camera.quaternion.setFromRotationMatrix(mtx);
}
setIntroView();
// 外から見るときの名前（地球・月・オリオン）
const labels = [
  { el: document.createElement("span"), text: "地球", obj: () => earth.position },
  { el: document.createElement("span"), text: "月", obj: () => moon.position },
  { el: document.createElement("span"), text: "オリオン（触れると乗れます）", obj: () => orionMark.position, cls: "orion" },
];
for (const m of labels) {
  m.el.className = `label ${m.cls ?? ""}`;
  m.el.textContent = m.text;
  document.body.append(m.el);
}
function placeLabels() {
  for (const m of labels) {
    const p = m.obj().clone().project(camera);
    m.el.hidden = mode !== "intro" && mode !== "outro";
    const x = ((p.x + 1) / 2) * innerWidth;
    const flip = x + m.el.offsetWidth > innerWidth - 8; // 右にはみ出すときは、左側に出す
    m.el.classList.toggle("flip", flip);
    m.el.style.transform = `translate(${x}px, ${((1 - p.y) / 2) * innerHeight}px)${flip ? " translateX(-100%)" : ""}`;
  }
}
introCamera();

const POLE = dir3(traj.earth.pole), G0 = dir3(traj.earth.greenwich0), EAST0 = POLE.clone().cross(G0);
const mtxE = new THREE.Matrix4();
function place(t) {
  const s = stateAt(t);
  moon.position.copy(s.moon);
  // 月はいつも同じ面を地球に向ける（テクスチャの真ん中が地球の側）
  const toE = s.moon.clone().negate();
  moon.rotation.y = Math.atan2(-toE.z, toE.x);
  // 地球の向き：北極と、その時刻のグリニッジの向きに合わせる（球の模型は、+y が北極・+x が経度0°）
  const th = traj.earth.rate * t;
  const g = G0.clone().multiplyScalar(Math.cos(th)).addScaledVector(EAST0, Math.sin(th));
  earth.quaternion.setFromRotationMatrix(mtxE.makeBasis(g, POLE, g.clone().cross(POLE)));
  return s;
}

function fmtKm(km) {
  return km >= 10000 ? `${(km / 10000).toFixed(1)}万 km` : `${Math.round(km).toLocaleString("ja-JP")} km`;
}

let lastCaption = null;
function setCaption(text) {
  const el = $("#caption");
  if (text === lastCaption) return;
  lastCaption = text;
  el.classList.add("fade");
  setTimeout(() => {
    el.textContent = text;
    el.classList.remove("fade");
  }, 350);
}

// 本物の写真（ページには載せず、NASA のページへ案内する）。説明は NASA の説明文から
const NASA_FLYBY_PHOTOS = "https://www.nasa.gov/news-release/nasas-artemis-ii-crew-beams-official-moon-flyby-photos-to-earth/";
const PHOTOS = {
  earthset: {
    text: "地球の入り：月の裏側で、地球が月のふちに沈む場面。2026年4月6日 午後6時41分（米国東部夏時間。日本時間 4月7日 午前7時41分）に撮影。",
    url: "https://science.nasa.gov/earth/earth-observatory/earthset-from-the-lunar-far-side/",
  },
  farside: {
    text: "月の裏側：ヴァヴィロフ・クレーターと、ヘルツシュプルング盆地のふち。乗員が手持ちのカメラ（焦点距離 400 mm）で撮影（2026年4月6日）。",
    url: NASA_FLYBY_PHOTOS,
  },
  earthrise: {
    text: "地球の出：2026年4月6日 午後7時22分（米国東部夏時間。日本時間 4月7日 午前8時22分）、オリオンの窓から撮影。地球は細い三日月の形。",
    url: NASA_FLYBY_PHOTOS,
  },
  eclipse: {
    text: "日食：うしろから太陽に照らされた月。月が太陽をすっぽり隠し、皆既が54分近くつづくほどの大きさに見えました。写真の左はしの銀色の光は金星（2026年4月6日）。",
    url: NASA_FLYBY_PHOTOS,
  },
};
let shownPhoto = null;
function showPhoto(key) {
  if (key === shownPhoto) return;
  shownPhoto = key;
  const el = $("#photo");
  el.hidden = !key;
  document.body.classList.toggle("has-photo", !!key);
  if (!key) return;
  $("#photo-text").textContent = PHOTOS[key].text;
  $("#photo-link").href = PHOTOS[key].url;
}

// 見る向き：台本の向き（地球・月）に、ドラッグで見回した分を足す
function aim(s, seg, u) {
  let target = seg.look === "moon" ? s.moon : new THREE.Vector3();
  let up = new THREE.Vector3(0, 1, 0);
  if (seg.rise || seg.set) {
    // 地球の入り・地球の出：月のふち（地球にいちばん近いところ）と地球のあいだを見る。月の地平線が下、地球が上になる向き
    const eDir = s.craft.clone().negate().normalize();
    const toM = s.moon.clone().sub(s.craft);
    const mDir = toM.clone().normalize();
    const angR = Math.asin(Math.min(1, R_M / toM.length()));
    const axis = new THREE.Vector3().crossVectors(mDir, eDir).normalize();
    const limb = mDir.clone().applyAxisAngle(axis, angR);
    const look = eDir.clone().add(limb).normalize();
    target = camera.position.clone().add(look);
    up = eDir.clone().sub(limb).normalize();
  }
  mtx.lookAt(camera.position, target, up);
  tmpQ.setFromRotationMatrix(mtx);
  if (!dragging && performance.now() - lastDrag > 1800) {
    yaw *= 0.97;
    pitch *= 0.97;
  }
  const off = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
  tmpQ.multiply(off);
  lookQ.slerp(tmpQ, u < 0.15 && seg !== SEGS[0] ? 0.03 : 0.08);
  camera.quaternion.copy(lookQ);
}

function updateSunAndCorona() {
  earthshine.position.copy(moon.position).negate(); // 地球（原点）から月へ向かう光
  sun.position.copy(camera.position).addScaledVector(SUN, 900);
  sun.scale.setScalar(70);
  // 月の見かけの大きさと、太陽との角度
  const toMoon = moon.position.clone().sub(camera.position);
  const dist = toMoon.length();
  const ang = Math.asin(Math.min(1, R_M / dist));
  const sep = toMoon.normalize().angleTo(SUN);
  const k = clamp(1 - (sep - ang * 0.6) / (ang * 0.9), 0, 1);
  corona.material.uniforms.opacity.value = k;
  corona.position.copy(camera.position).addScaledVector(SUN, 899);
  corona.scale.setScalar(2 * 899 * Math.tan(ang) * 1.7);
  return k;
}

// 打ち上げ：2026-04-01 18:35 EDT（NASA）
const LAUNCH = Date.UTC(2026, 3, 1, 22, 35);
const jst = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
function hud(s, t) {
  const ms = EPOCH + t * 1000;
  $("#hud-day").textContent = `${jst.format(ms)}（日本時間）· 打ち上げから ${((ms - LAUNCH) / 86400000).toFixed(1)} 日`;
  $("#hud-earth").textContent = fmtKm(s.rKm);
  $("#hud-moon").textContent = fmtKm(Math.max(0, s.moonKm - 1737.4));
  $("#hud-speed").textContent = `${s.speed.toFixed(2)} km/s`;
  $("#hud-light").textContent = `${(s.rKm / 299792.458).toFixed(2)} 秒`;
}

// ---------- 画面の切り替え ----------
function board() {
  mode = "boarding";
  boardT = 0;
  camFrom.copy(camera.position);
  lookQ.copy(camera.quaternion);
  $("#intro").hidden = true;
  $("#outro").hidden = true;
}
function startRide(at = 0) {
  mode = "ride";
  ride = at;
  pathLine.visible = false;
  orionMark.visible = false;
  wing.visible = true;
  $("#intro").hidden = true;
  $("#outro").hidden = true;
  for (const m of labels) m.el.hidden = true;
  $("#window-frame").classList.add("on");
  $("#hud").hidden = false;
  $("#controls").hidden = false;
  $("#caption").hidden = false;
}
function endRide(finished) {
  mode = finished ? "outro" : "intro";
  pathLine.visible = true;
  orionMark.visible = true;
  wing.visible = false;
  $("#window-frame").classList.remove("on");
  $("#reentry").style.opacity = 0;
  for (const id of ["#hud", "#controls", "#caption"]) $(id).hidden = true;
  showPhoto(null);
  document.body.classList.remove("has-photo");
  lastCaption = null;
  introCamera();
  $(finished ? "#outro" : "#intro").hidden = false;
}

$("#board").addEventListener("click", board);
$("#again").addEventListener("click", board);
$("#leave").addEventListener("click", () => endRide(false));
$("#pause").addEventListener("click", () => {
  paused = !paused;
  $("#pause").textContent = paused ? "つづける" : "一時停止";
});
$("#speed").addEventListener("click", () => {
  speedMul = speedMul === 1 ? 2 : speedMul === 2 ? 4 : 1;
  $("#speed").textContent = `×${speedMul}`;
});

// 外から見ているとき：光るオリオンに触れると乗る
canvas.addEventListener("click", (e) => {
  if (mode !== "intro") return;
  const r = canvas.getBoundingClientRect();
  const p = orionMark.position.clone().project(camera);
  const sx = ((p.x + 1) / 2) * r.width, sy = ((1 - p.y) / 2) * r.height;
  if (Math.hypot(e.clientX - r.left - sx, e.clientY - r.top - sy) < 36) board();
});
// 乗っているとき：ドラッグで見回す
let px = 0, py = 0;
canvas.addEventListener("pointerdown", (e) => {
  if (mode !== "ride") return;
  dragging = true;
  px = e.clientX;
  py = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  yaw -= (e.clientX - px) * 0.004;
  pitch = clamp(pitch - (e.clientY - py) * 0.004, -1.2, 1.2);
  px = e.clientX;
  py = e.clientY;
});
const stopDrag = () => {
  dragging = false;
  lastDrag = performance.now();
};
canvas.addEventListener("pointerup", stopDrag);
canvas.addEventListener("pointercancel", stopDrag);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 70 : 55;
  camera.updateProjectionMatrix();
  setIntroView();
  if (mode === "intro" || mode === "outro") introCamera();
}
addEventListener("resize", resize);
resize();

// ---------- 毎フレーム ----------
let last = performance.now();
let introT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (mode === "intro" || mode === "outro") {
    introT = (introT + dt * DAY * 0.6) % T_END; // 外から見ると、オリオンが道のりをゆっくりたどる
    const s = place(introT);
    orionMark.position.copy(s.craft);
    stars.position.copy(camera.position);
    updateSunAndCorona();
  } else if (mode === "boarding") {
    boardT += dt / 2.6;
    const s = place(0);
    const k = smoothstep(boardT, 0, 1);
    camera.position.lerpVectors(camFrom, s.craft, k);
    mtx.lookAt(camera.position, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
    tmpQ.setFromRotationMatrix(mtx);
    camera.quaternion.copy(lookQ.slerp(tmpQ, 0.06));
    orionMark.position.copy(s.craft);
    stars.position.copy(camera.position);
    updateSunAndCorona();
    if (boardT >= 1) startRide();
  } else if (mode === "ride") {
    if (!paused) ride += dt * speedMul;
    if (ride >= RIDE_SEC) {
      endRide(true);
    } else {
      const { t, seg, u } = rideToMission(ride);
      const s = place(t);
      camera.position.copy(s.craft);
      stars.position.copy(camera.position);
      aim(s, seg, u);
      const fovGoal = seg.fov ?? (innerWidth < innerHeight ? 70 : 55);
      if (Math.abs(camera.fov - fovGoal) > 0.05) {
        camera.fov += (fovGoal - camera.fov) * 0.04;
        camera.updateProjectionMatrix();
      }
      const eclipse = updateSunAndCorona();
      hud(s, t);
      $("#tl-fill").style.width = `${(ride / RIDE_SEC) * 100}%`;
      setCaption(eclipse > 0.35 ? "太陽が月に隠れました（日食）。月のふちだけが光って見えます。" : seg.far && Math.abs(t - T_MOON) < d(0.004) ? "月にいちばん近づきました。月面から約6,545km（4,067マイル）です。" : seg.say);
      showPhoto(seg.photo ?? null);
      // 大気に入る：最後の数秒、オレンジに光る
      $("#reentry").style.opacity = String(seg === SEGS.at(-1) ? smoothstep(u, 0.55, 1) * 0.9 : 0);
    }
  }
  for (const m of [sun, corona, orionMark]) faceCamera(m);
  placeLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 確かめ用：#ride=秒 で、その場面から乗る（例：#ride=100&pause）
const hp = new URLSearchParams(location.hash.slice(1));
if (hp.has("ride")) {
  place(0);
  startRide(Number(hp.get("ride")) || 0);
  lookQ.copy(camera.quaternion);
  if (hp.has("pause")) {
    paused = true;
    $("#pause").textContent = "つづける";
  }
}
