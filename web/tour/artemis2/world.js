// アルテミス2号のページの 3D の世界（地球・月・太陽・星・オリオンの再現モデル・NASA の軌道データ）
// - 通り道は trajectory.json（NASA が公開した飛行の軌道データ〔エフェメリス〕を scripts/artemis2-trajectory.mjs で変換したもの）
//   月・太陽の位置と、地球・月の向きも、本物の時刻から計算してある
// - 単位：1 = 1000 km。地球の中心が原点、月の公転面が x-z 面
// - three.js は遠くを見る部屋と同じ r128 の部品だけの版（vendor/three-r128.min.js）。スプライト・線などは ShaderMaterial で作る
import * as THREE from "../../vendor/three-r128.min.js";
import { moonAxesAt } from "./lunar.js";


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
// 月にいちばん近づく時刻（scripts/artemis2-trajectory.mjs が点のあいだも1秒きざみで詰めた値。点は4分ごとなので、点から選ぶと約2分ずれる）
const T_MOON = (Date.parse(traj.closestApproach) - EPOCH) / 1000;
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
// 色の地図は明るいので、少し暗くして白く飛ばないように（color で掛ける）
const moon = new THREE.Mesh(new THREE.SphereGeometry(R_M, 96, 64), new THREE.MeshStandardMaterial({ map: moonTex, bumpMap: moonBump, bumpScale: 0.02, roughness: 1, metalness: 0, color: 0xb4b4b4 }));
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

// オリオンの姿：公式の文章と NASA の写真を参考にした再現モデル（2026-10-11 オーナー）。形と比率は公式の資料の文章から（C24。2026-10-11 照合）：
// 上から クルーモジュール（円すい）→ クルーモジュールアダプター（白い輪）→ 欧州サービスモジュール（白い円柱、直径 約4 m）、
// 下にメインエンジン1基と補助エンジン8基、横に姿勢制御エンジンのポッド6つ。太陽電池の翼は4枚の X 字、1枚 約7.4 m（板3枚）、
// 広げると 約19 m（ESA）。細かい角度・色は公式の値がないので近い形にしたもの。NASA・ESA の画像や3Dデータはそのまま使っていない。
// 本当の大きさでは見えないので、外から見るときだけ、カメラのすぐそばに置く（1 m ＝ 画面の ORION_M）
const wingTex = canvasTex(256, 128, (g, w, h) => {
  // 太陽電池の板：濃い紺のセルと、明るい枠（NASA の写真を参考に）
  g.fillStyle = "#c9ccd2";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#101a33";
  g.fillRect(6, 6, w - 12, h - 12);
  g.strokeStyle = "rgba(110,140,200,0.35)";
  for (let x = 6; x <= w - 6; x += 10) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x, h - 6); g.stroke(); }
  for (let y = 6; y <= h - 6; y += 10) { g.beginPath(); g.moveTo(6, y); g.lineTo(w - 6, y); g.stroke(); }
});
// クルーモジュールの外側：金属の光沢のタイル（飛んでいるときの NASA の写真では、青みがかって見える）
const cmTex = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = "#9fb4c0";
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) {
    for (let x = (y / 16) % 2 ? 0 : 12; x < w; x += 24) {
      const v = 150 + Math.floor(Math.random() * 60);
      g.fillStyle = `rgba(${v - 40},${v},${v + 20},0.55)`;
      g.fillRect(x, y, 23, 15);
    }
  }
  g.fillStyle = "rgba(160,95,55,0.9)"; // 銅色の帯
  g.fillRect(0, h * 0.62, w, 5);
  g.fillRect(0, h * 0.97, w, 6);
});
const ORION_M = 0.0018;
const orion = (() => {
  const grp = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf1f2f3, roughness: 0.62, metalness: 0.05 });
  const cmMat = new THREE.MeshStandardMaterial({ map: cmTex, roughness: 0.35, metalness: 0.45 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.5, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.55, metalness: 0.5 });
  const wingMat = new THREE.MeshStandardMaterial({ map: wingTex, roughness: 0.4, metalness: 0.35 });
  const add = (geo, mat, x, y, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); grp.add(m); return m; };
  add(new THREE.CylinderGeometry(0.95, 2.45, 3.0, 48, 1, true), cmMat, 0, 2.15); // クルーモジュール（円すい）
  add(new THREE.CylinderGeometry(0.95, 0.95, 0.05, 32), grey, 0, 3.65); // てっぺん
  add(new THREE.CylinderGeometry(0.5, 0.55, 0.35, 24), grey, 0, 3.82); // ドッキングのところ
  add(new THREE.CylinderGeometry(2.5, 2.5, 1.0, 48), white, 0, 0.15); // クルーモジュールアダプター（白い幅広の帯。クルーモジュールの底と同じくらいの太さ）
  add(new THREE.CylinderGeometry(2.5, 2.0, 0.3, 48), white, 0, -0.5); // 段になって細くなる
  add(new THREE.CylinderGeometry(2.0, 2.0, 2.2, 48), white, 0, -1.75); // サービスモジュールの本体（白い円柱）
  add(new THREE.CylinderGeometry(2.0, 1.7, 0.6, 48), grey, 0, -3.15); // 下のほう
  add(new THREE.CylinderGeometry(1.7, 1.7, 0.08, 48), dark, 0, -3.48); // 底の面
  add(new THREE.CylinderGeometry(0.28, 0.6, 1.1, 24, 1, true), dark, 0, -4.05); // メインエンジン
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    add(new THREE.CylinderGeometry(0.06, 0.13, 0.38, 10), dark, Math.cos(a) * 1.25, -3.7, Math.sin(a) * 1.25); // 補助エンジン
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    add(new THREE.BoxGeometry(0.3, 0.32, 0.3), grey, Math.cos(a) * 2.08, -1.05, Math.sin(a) * 2.08); // 姿勢制御エンジンのポッド
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.15;
    add(new THREE.BoxGeometry(0.22, 0.14, 0.18), grey, Math.cos(a) * 2.03, -2.4 + (k % 2) * 0.9, Math.sin(a) * 2.03); // 側面の小さな箱（取り付け具など）
  }
  // 太陽電池の翼：4枚の X 字。板3枚（2.13 m × 1.92 m）を並べる。板の面は太陽（うしろ）に向ける
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), grey);
    boom.position.x = 2.25;
    arm.add(boom);
    for (let k = 0; k < 3; k++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.13, 0.04, 1.92), wingMat);
      panel.position.x = 2.5 + 1.065 + k * 2.25;
      arm.add(panel);
    }
    arm.rotation.y = Math.PI / 4 + (i * Math.PI) / 2;
    arm.position.y = -1.75; // サービスモジュールの横から（NASA の写真を参考に）
    grp.add(arm);
  }
  grp.scale.setScalar(ORION_M);
  grp.visible = false;
  // 外から見るときの、ひかえめな正面の光（地球の夜の側を背にすると、真っ黒になって形が見えないため）
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.55);
  fill.position.set(0.3, 0.4, 1);
  camera.add(fill);
  fill.target = grp;
  fill.visible = false; // 外から見るときだけ（月を照らさないように）
  grp.userData.fill = fill;
  scene.add(grp);
  return grp;
})();

// 窓の手前の太陽電池パネル（NASA の写真が、パネルの翼のカメラで撮られていたことを参考にした飾り）
const wing = (() => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), new THREE.MeshStandardMaterial({ map: wingTex, side: DOUBLE_SIDE, roughness: 0.45, metalness: 0.3 }));
  m.position.set(-0.95, -0.3, -1.1);
  m.rotation.set(-0.9, 0.35, 0.25);
  m.visible = false;
  camera.add(m);
  return m;
})();

const POLE = dir3(traj.earth.pole), G0 = dir3(traj.earth.greenwich0), EAST0 = POLE.clone().cross(G0);
const mtxE = new THREE.Matrix4(), mtxM = new THREE.Matrix4();
let moonAx = null;
const getMoonAx = () => moonAx;
function place(t) {
  const s = stateAt(t);
  moon.position.copy(s.moon);
  // 月の向き：IAU のモデル（trajectory.json の moonFrame。秤動も入る）。球の模型は +x が経度0°・+y が北極・−z が東経90°
  moonAx = moonAxesAt(traj.moonFrame, t);
  moon.quaternion.setFromRotationMatrix(mtxM.makeBasis(dir3(moonAx.x), dir3(moonAx.z), dir3(moonAx.y).negate()));
  // 地球の向き：北極と、その時刻のグリニッジの向きに合わせる（球の模型は、+y が北極・+x が経度0°）
  const th = traj.earth.rate * t;
  const g = G0.clone().multiplyScalar(Math.cos(th)).addScaledVector(EAST0, Math.sin(th));
  earth.quaternion.setFromRotationMatrix(mtxE.makeBasis(g, POLE, g.clone().cross(POLE)));
  return s;
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

const vel = new THREE.Vector3(), side = new THREE.Vector3(), upv = new THREE.Vector3();
function outsideCam(s, t, spin, out) {
  // 地球を背にしたオリオンを、斜め横から（4分の3の向き）見る。白い帯とサービスモジュールが見えるように。ゆっくり回りこむ
  vel.copy(s.craft).normalize(); // 地球 → オリオン
  const axis = tailToSun.copy(SUN).negate(); // オリオンの先の向き（うしろを太陽に）
  side.copy(vel).addScaledVector(axis, -vel.dot(axis));
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0).cross(axis);
  side.normalize(); // 機体の軸に直角で、地球と反対寄りの向き
  upv.crossVectors(axis, side).normalize();
  const a = spin * 0.6;
  const dir = new THREE.Vector3()
    .addScaledVector(vel, 0.9) // 地球を背に
    .addScaledVector(side, 0.42 * Math.cos(a))
    .addScaledVector(upv, 0.2 * Math.sin(a))
    .addScaledVector(axis, -0.22) // 少しうしろ（太陽の当たる側）から
    .normalize();
  return out.copy(s.craft).addScaledVector(dir, 0.1);
}
// 外から見るときの画面の上の向き：横長の画面ではオリオンと地球を左右に、縦長（スマホ）では上下に（地球が上）並べる
function outsideUp(toO, toE) {
  return innerWidth < innerHeight ? toE.clone().sub(toO).normalize() : upv;
}
const ORION_UP = new THREE.Vector3(0, 1, 0), tailToSun = new THREE.Vector3();
function placeOrion(s) {
  // 姿勢：うしろ（サービスモジュールの側）を太陽に向ける（NASA の説明 "tail-to-Sun"。いつもこの向きとは限らない）
  orion.position.copy(s.craft);
  orion.quaternion.setFromUnitVectors(ORION_UP, tailToSun.copy(SUN).negate());
}
function setNear(n) {
  if (camera.near === n) return;
  camera.near = n;
  camera.updateProjectionMatrix();
}

function orionIconURL(size = 128) {
  const iconScene = new THREE.Scene();
  const parent = orion.parent, vis = orion.visible;
  const p0 = orion.position.clone(), q0 = orion.quaternion.clone(), s0 = orion.scale.clone();
  iconScene.add(orion);
  orion.visible = true;
  orion.position.set(0, 0, 0);
  orion.quaternion.setFromEuler(new THREE.Euler(1.15, 0.0, -0.8));
  orion.scale.setScalar(1);
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(6, 9, 12);
  iconScene.add(key, new THREE.AmbientLight(0xbfd4ff, 0.55));
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  cam.position.set(0, 0.2, 38);
  cam.lookAt(0, 0.2, 0);
  const rt = new THREE.WebGLRenderTarget(size, size);
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(iconScene, cam);
  const px = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
  renderer.setRenderTarget(null);
  rt.dispose();
  parent.add(orion);
  orion.visible = vis;
  orion.position.copy(p0);
  orion.quaternion.copy(q0);
  orion.scale.copy(s0);
  // 上下を反転して 2D の絵に
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d"), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  g.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

export {
  THREE, clamp, smoothstep, KM, R_E, R_M, DAY, $, traj, P, EPOCH, T_END, v3, dir3, stateAt, T_MOON, SUN, d, T_SET, T_RISE, T_ECLIPSE,
  canvas, renderer, scene, camera, light, earthshine, loadTex, billboardMat, billboard, faceCamera, canvasTex, glowTex,
  stars, earth, atmo, moon, sun, corona, pathLine, orionMark, orion, wing, place, getMoonAx, updateSunAndCorona, outsideCam, outsideUp, placeOrion, setNear, orionIconURL,
};
