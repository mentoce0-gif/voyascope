// アルテミス2号に乗ってみる（試作）
// - 通り道は trajectory.json（NASA が公開した飛行の軌道データ〔エフェメリス〕を scripts/artemis2-trajectory.mjs で変換したもの）
//   月・太陽の位置と地球の向きも、本物の時刻から計算してある
// - 窓の外は「〜のような眺め」：地球・月・太陽の位置は通り道から計算し、見た目は NASA の写真を参考にした描き方
// - 単位：1 = 1000 km。地球の中心が原点、月の公転面が x-z 面
// - three.js は遠くを見る部屋と同じ r128 の部品だけの版（vendor/three-r128.min.js）。スプライト・線などは ShaderMaterial で作る
import * as THREE from "../../vendor/three-r128.min.js";
import { moonAxesAt, observe, gate, TARGETS } from "./lunar.js";

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
// 月面を観測する時間（UTC）。Mare Orientale が見えて照らされている時間のなか（計算：22:10 UTC まで見やすい）。
// NASA の写真 art002e009277（2:19 p.m. EDT＝18:19 UTC）・art002e009279（3:41 p.m. EDT＝19:41 UTC）の時刻をふくむ
// 根拠：docs/research/artemis2-lunar-observation-verification.md
const T_OBS0 = (Date.parse("2026-04-06T18:30:00Z") - EPOCH) / 1000, T_OBS1 = (Date.parse("2026-04-06T19:50:00Z") - EPOCH) / 1000;
// 場面の台本。sec：その場面を見る秒（読める速さ。速くする操作はなし）
// 月までと地球までの、何もない長い道のりは「ワープ」で飛ばして、月のそばの場面をじっくり見せる（2026-10-11 オーナー）
//   warp：時間圧縮（2026-10-11 オーナー：ワープではなく時間圧縮）。宇宙船は速くならない。航路の上で点と日時だけが早く進む。
//         そのあいだは「航路」の眺めにして、章の見出し（行き先と、進んでいく日時）を出す
//   observe：月面の地形を観測する（景色 → 見つける → 知る → NASA の資料へ。web/tour/artemis2/lunar.js）
const SEGS = [
  { t0: 0, t1: d(0.35), sec: 16, look: "earth", say: "地球をはなれて、月へ。うしろの窓に、地球がだんだん小さくなっていきます。" },
  { t0: d(0.35), t1: T_MOON - d(0.42), sec: 6, look: "moon", warp: { head: "月のそばへ", sub: "数日間の航路を、6秒に縮めています" } },
  { t0: T_MOON - d(0.42), t1: T_OBS0, sec: 12, look: "moon", say: "月が大きくなってきました。半分ほどに、日が当たっています。" },
  { t0: T_OBS0, t1: T_OBS1, sec: 24, look: "target", observe: "mare_orientale" },
  { t0: T_OBS1, t1: T_SET - d(0.008), sec: 10, look: "moon", say: "月の重力に引かれて、だんだん速くなります。" },
  { t0: T_SET - d(0.008), t1: T_SET + d(0.004), sec: 16, look: "earth", set: true, fov: 24, photo: "earthset", say: "月のふちに、地球が沈んでいきます（地球の入り）。望遠で見ています。" },
  { t0: T_SET + d(0.004), t1: T_RISE - d(0.008), sec: 30, look: "moon", far: true, photo: "farside", say: "月の裏側です。月が電波をさえぎるので、およそ40分、地球と連絡がとれません。" },
  { t0: T_RISE - d(0.008), t1: T_RISE + d(0.012), sec: 18, look: "earth", rise: true, fov: 16, photo: "earthrise", say: "月の地平線から、地球が昇ってきます（地球の出）。望遠で見ています。" },
  { t0: T_RISE + d(0.012), t1: T_ECLIPSE + d(0.02), sec: 20, look: "moon", photo: "eclipse", say: "月の向こうに、太陽が隠れていきます。" },
  { t0: T_ECLIPSE + d(0.02), t1: T_END - d(0.6), sec: 6, look: "earth", warp: { head: "地球へ", sub: "数日間の航路を、6秒に縮めています" } },
  { t0: T_END - d(0.6), t1: T_END - d(0.3), sec: 14, look: "earth", say: "地球が近づいてきました。月をまわって、そのまま地球へ戻ってくる通り道です（自由帰還軌道）。" },
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
  const k = s.warp ? u * u * (3 - 2 * u) : u; // 時間圧縮は、ゆっくり始まって、ゆっくり終わる（時刻はいつも前に進む）
  return { t: s.t0 + (s.t1 - s.t0) * k, seg: s, u };
};
const FAR_SEG = SEGS.find((s) => s.far);
$("#tl-moon").style.left = `${((FAR_SEG.r0 + FAR_SEG.sec / 2) / RIDE_SEC) * 100}%`;


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

// ---------- 状態 ----------
let mode = "intro"; // intro → boarding → ride → ending
let view = "window"; // 乗っているあいだの見る場所：window（窓から）・earth（地球から）・route（航路）。outside（外から）は乗ってすぐの数秒だけ（ボタンはなし。2026-10-10 オーナー）
let autoOutside = false; // 乗ってすぐは、外からオリオンの姿を見せる（ボタンを押したらやめる）
let lookOverride = null; // 「地球向き」「月向き」を押したとき。場面が変わったら台本の向きに戻る
let lastSeg = null;
let ride = 0; // 乗ってからの秒（台本の時計）
let paused = false;
let boardT = 0;
const camFrom = new THREE.Vector3(), lookQ = new THREE.Quaternion(), tmpQ = new THREE.Quaternion(), mtx = new THREE.Matrix4();
let yaw = 0, pitch = 0, dragging = false, lastDrag = 0;

// 外から見る位置：通り道と月の通り道がぜんぶ入るように、斜め上から
// 縦長の画面（スマホ）と「航路」では、上から見下ろして地球→月を横に置き、画面いっぱいに（2026-10-10 オーナー）
const INTRO_TARGET = new THREE.Vector3(), INTRO_CAM = new THREE.Vector3(), INTRO_UP = new THREE.Vector3();
const INTRO_BOX = new THREE.Box3();
for (const p of P) {
  INTRO_BOX.expandByPoint(v3(p[1], p[2], p[3])); // 宇宙船の通り道だけで決める（月は9日で大きく動くので入れない）
}
// 上から見下ろして、地球→月が横に並ぶ向きで、通り道が画面に収まる距離を出す
// top・bottom：上下に空けておく割合（計器・案内・下の操作の分）
function fitTopDown(target, cam, up, { top = 0.1, bottom = 0.1 } = {}) {
  const sz = INTRO_BOX.getSize(new THREE.Vector3());
  INTRO_BOX.getCenter(target);
  const vf = (camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  const avail = 1 - top - bottom; // 縦に使える割合
  const dW = (sz.x / 2) * 1.35 / Math.tan(hf / 2); // 左右に余白（名前の文字の分も）
  const dH = (sz.z / 2) * 1.2 / (Math.tan(vf / 2) * avail);
  const dist = Math.max(dW, dH);
  // 使える範囲のまんなかに通り道が来るように、見る点をずらす（画面の下＝ +z）
  target.z += dist * Math.tan(vf / 2) * (bottom - top);
  cam.copy(target).add(new THREE.Vector3(0, dist, 0));
  up.set(0, 0, -1);
}
function setIntroView() {
  const size = INTRO_BOX.getSize(new THREE.Vector3()).length();
  INTRO_BOX.getCenter(INTRO_TARGET);
  if (mode === "ride" && shownView === "route") {
    fitTopDown(INTRO_TARGET, INTRO_CAM, INTRO_UP, innerWidth < innerHeight ? { top: 0.3, bottom: 0.38 } : { top: 0.26, bottom: 0.24 });
  } else if (innerWidth < innerHeight) {
    fitTopDown(INTRO_TARGET, INTRO_CAM, INTRO_UP, { top: 0.08, bottom: 0.56 }); // 下の案内の枠より上に
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
// 外から見るときの目印：名前の文字のかわりに、絵のアイコン（2026-10-11 オーナー：文字は野暮ったいので）
const ICONS = {
  earth: '<svg viewBox="0 0 40 40"><defs><radialGradient id="ie" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#a8e6ff"/><stop offset=".5" stop-color="#2f7fd0"/><stop offset="1" stop-color="#0a2457"/></radialGradient></defs><circle cx="20" cy="20" r="14" fill="url(#ie)"/><path d="M6 20h28M20 6c5 4 5 24 0 28M20 6c-5 4-5 24 0 28M8.5 13h23M8.5 27h23" fill="none" stroke="#d9f4ea" stroke-opacity=".38" stroke-width="1"/><circle cx="20" cy="20" r="16.5" fill="none" stroke="#9fe3ff" stroke-opacity=".5"/></svg>',
  moon: '<svg viewBox="0 0 40 40"><defs><radialGradient id="im" cx="35%" cy="32%" r="75%"><stop offset="0" stop-color="#f2f0ea"/><stop offset=".6" stop-color="#a9a69d"/><stop offset="1" stop-color="#5a5852"/></radialGradient></defs><circle cx="20" cy="20" r="12" fill="url(#im)"/><g fill="#6f6c64" opacity=".7"><circle cx="16" cy="16" r="2.6"/><circle cx="24" cy="23" r="3.2"/><circle cx="15" cy="25" r="1.6"/><circle cx="24" cy="14" r="1.3"/></g></svg>',
  orion: '<svg viewBox="0 0 48 48"><circle class="ring" cx="24" cy="24" r="20" fill="none" stroke="#ffb547" stroke-width="1.6"/><g fill="#ffb547"><path d="M20.5 12h7l3.5 10h-14z"/><rect x="18" y="23" width="12" height="9" rx="1"/><path d="M8 26.5h9v2H8zM31 26.5h9v2h-9z" opacity=".9"/><rect x="6" y="24.5" width="4" height="6" rx=".6" opacity=".7"/><rect x="38" y="24.5" width="4" height="6" rx=".6" opacity=".7"/><path d="M21 32h6l-1 3h-4z" opacity=".8"/></g></svg>',
};
const labels = [
  { el: document.createElement("span"), name: "地球", icon: ICONS.earth, obj: () => earth.position, cls: "earth" },
  { el: document.createElement("span"), name: "月", icon: ICONS.moon, obj: () => moon.position, cls: "moon" },
  { el: document.createElement("button"), name: "オリオン", icon: ICONS.orion, obj: () => orionMark.position, cls: "orion", orion: true },
];
for (const m of labels) {
  m.el.className = `label ${m.cls}`;
  m.el.innerHTML = m.icon;
  if (m.orion) m.el.type = "button";
  else m.el.setAttribute("role", "img");
  m.el.setAttribute("aria-label", m.name);
  document.body.append(m.el);
}
// 光るオリオンの目印は、押すと乗れる（ボタン。キーボードでも押せる）
labels[2].el.addEventListener("click", () => mode === "intro" && board());
function placeLabels() {
  for (const m of labels) {
    const p = m.obj().clone().project(camera);
    const showAll = mode === "intro" || (mode === "ride" && shownView === "route");
    m.el.hidden = !(showAll || (m.orion && mode === "ride" && shownView === "earth")) || p.z > 1;
    if (m.orion) {
      m.el.classList.toggle("tap", mode === "intro");
      m.el.setAttribute("aria-label", mode === "intro" ? "オリオンに乗る" : "オリオン（いまここ）");
      m.el.tabIndex = mode === "intro" ? 0 : -1;
    }
    // 絵は、その天体・オリオンの位置にちょうど重ねる（遠くて小さい本物の姿の、目印として）
    m.el.style.transform = `translate(${((p.x + 1) / 2) * innerWidth}px, ${((1 - p.y) / 2) * innerHeight}px) translate(-50%, -50%)`;
  }
}
introCamera();

const POLE = dir3(traj.earth.pole), G0 = dir3(traj.earth.greenwich0), EAST0 = POLE.clone().cross(G0);
const mtxE = new THREE.Matrix4(), mtxM = new THREE.Matrix4();
let moonAx = null;
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

function fmtKm(km) {
  return km >= 10000 ? `${(km / 10000).toFixed(1)}<small>万 km</small>` : `${Math.round(km).toLocaleString("ja-JP")}<small>km</small>`;
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
  const look = lookOverride ?? seg.look;
  let target = look === "moon" ? s.moon : look === "target" ? obsWorld(s) ?? s.moon : new THREE.Vector3();
  let up = new THREE.Vector3(0, 1, 0);
  if (!lookOverride && (seg.rise || seg.set)) {
    // 地球の入り・地球の出：月のふち（地球にいちばん近いところ）と地球のあいだを見る。月の地平線が下、地球が上になる向き
    const eDir = s.craft.clone().negate().normalize();
    const toM = s.moon.clone().sub(s.craft);
    const mDir = toM.clone().normalize();
    const angR = Math.asin(Math.min(1, R_M / toM.length()));
    const axis = new THREE.Vector3().crossVectors(mDir, eDir).normalize();
    const limb = mDir.clone().applyAxisAngle(axis, angR);
    const mid = eDir.clone().add(limb).normalize();
    target = camera.position.clone().add(mid);
    up = eDir.clone().sub(limb).normalize();
  }
  mtx.lookAt(camera.position, target, up);
  tmpQ.setFromRotationMatrix(mtx);
  if (!dragging && performance.now() - lastDrag > 1800) {
    yaw *= 0.97;
    pitch *= 0.97;
  }
  // 観測の場面（縦長の画面）：下のカードに隠れないよう、地形を画面の上寄り（高さの約36%）に置く
  const lift = look === "target" && innerWidth < innerHeight ? -camera.fov * 0.14 * (Math.PI / 180) : 0;
  const off = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch + lift, yaw, 0, "YXZ"));
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
  $("#hud-day").textContent = `${jst.format(ms)}（日本時間）・打ち上げから ${((ms - LAUNCH) / 86400000).toFixed(1)} 日`;
  $("#hud-earth").innerHTML = fmtKm(s.rKm);
  $("#hud-moon").innerHTML = fmtKm(Math.max(0, s.moonKm - 1737.4));
  $("#hud-speed").innerHTML = `${s.speed.toFixed(2)}<small>km/s</small>`;
  $("#hud-light").innerHTML = `${(s.rKm / 299792.458).toFixed(2)}<small>秒</small>`;
}

// ---------- 画面の切り替え ----------
// 外から見るカメラの位置：オリオンの斜めうしろ。ゆっくり回りこむ
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

function board() {
  mode = "boarding";
  boardT = 0;
  camFrom.copy(camera.position);
  lookQ.copy(camera.quaternion);
  $("#intro").hidden = true;
  pathLine.visible = false; // 通り道の線がカメラの前を横切らないように
  for (const m of labels) m.el.hidden = true;
}
function setView(v, { auto = false } = {}) {
  view = v;
  if (!auto) autoOutside = false;
  for (const b of document.querySelectorAll("[data-view]")) b.setAttribute("aria-pressed", String(b.dataset.view === v));
  applyView(v);
}
// 画面に出す眺め（ふだんは選んだ眺め。時間圧縮のあいだだけ「航路」）
let shownView = "window";
function applyView(v) {
  shownView = v;
  $("#look").hidden = v !== "window";
  $("#window-frame").classList.toggle("on", v === "window");
  wing.visible = v === "window";
  orion.visible = v === "outside";
  orion.userData.fill.visible = v === "outside";
  pathLine.visible = v === "route" || v === "earth";
  orionMark.visible = v === "route" || v === "earth";
  setNear(v === "outside" ? 0.0008 : 0.05);
  if (v === "route") setIntroView(), introCamera();
  if (v === "window") lookQ.copy(camera.quaternion);
}
function setLook(l) {
  lookOverride = l;
  yaw = pitch = 0;
  for (const b of document.querySelectorAll("[data-look]")) b.setAttribute("aria-pressed", String(b.dataset.look === l));
}
// 映画のような帯（はじめ・外から見るとき・終わりのほう）
const body = document.body;
const setCinema = (on) => body.classList.toggle("cinema", on);
// 暗転してから切り替える（外からの眺め → 窓の中）
let dipping = false;
function dip(fn) {
  if (dipping) return;
  dipping = true;
  const f = $("#fade");
  f.classList.remove("slow");
  f.classList.add("on");
  setTimeout(() => {
    fn();
    f.classList.remove("on");
    dipping = false;
  }, 950);
}
function startRide(at = 0) {
  mode = "ride";
  body.classList.add("riding");
  ride = at;
  lastSeg = null;
  setLook(null);
  autoOutside = at < OUTSIDE_SEC;
  setView(autoOutside ? "outside" : "window", { auto: true });
  $("#intro").hidden = true;
  $("#ending").hidden = true;
  $("#ending").classList.remove("on");
  $("#hud").hidden = false;
  $("#controls").hidden = false;
  $("#caption").hidden = false;
}
function leaveRide() {
  mode = "intro";
  warpFx(null);
  resetObserve();
  body.classList.remove("riding");
  setCinema(true);
  setView("route", { auto: true });
  setIntroView();
  setNear(0.05);
  wing.visible = false;
  $("#window-frame").classList.remove("on");
  $("#reentry").style.opacity = 0;
  for (const id of ["#hud", "#controls", "#caption"]) $(id).hidden = true;
  showPhoto(null);
  lastCaption = null;
  introCamera();
  $("#intro").hidden = false;
}
// 帰ってきたとき：ゆっくり暗くなって、事実 → ひとこと → エンドクレジット → ボタン（自動ではほかへ移らない）
const endTimers = [];
function finishRide() {
  mode = "ending";
  warpFx(null);
  resetObserve();
  const el = $("#ending");
  el.hidden = false;
  el.classList.remove("on", "credits", "done");
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("on")));
  for (const id of ["#hud", "#controls", "#caption"]) $(id).hidden = true;
  showPhoto(null);
  endTimers.push(setTimeout(() => el.classList.add("credits"), 12500));
  endTimers.push(setTimeout(() => el.classList.add("done"), 14500));
}
$("#board").addEventListener("click", board);
$("#again").addEventListener("click", () => {
  while (endTimers.length) clearTimeout(endTimers.pop());
  $("#ending").hidden = true;
  $("#reentry").style.opacity = 0;
  $("#ending").classList.remove("on");
  place(0);
  camFrom.copy(camera.position);
  startRide(0);
});
$("#leave").addEventListener("click", leaveRide);
$("#pause").addEventListener("click", () => {
  paused = !paused;
  $("#pause").textContent = paused ? "つづける" : "一時停止";
});
// 次の場面へ（速くする「×2・×4」のかわり。字幕を読む速さは変えない。2026-10-11 オーナー）
$("#skip").addEventListener("click", () => {
  if (mode !== "ride") return;
  if (autoOutside) ride = OUTSIDE_SEC;
  else ride = rideToMission(ride).seg.r1;
});
for (const b of document.querySelectorAll("[data-view]")) b.addEventListener("click", () => setView(b.dataset.view));
for (const b of document.querySelectorAll("[data-look]")) b.addEventListener("click", () => setLook(lookOverride === b.dataset.look ? null : b.dataset.look));

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
  if (mode !== "ride" || shownView !== "window") return;
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
  if (mode === "intro" || (mode === "ride" && shownView === "route")) introCamera();
  // スマホでは、写真の欄を画面の下の積み重ね（字幕の下）に入れる
  const ph = $("#photo"), narrow = w <= 700;
  if (narrow && ph.parentElement !== $(".dock")) $(".dock").insertBefore(ph, $("#controls"));
  else if (!narrow && ph.parentElement !== document.body) document.body.append(ph);
}
addEventListener("resize", resize);
resize();

function resetObserve() {
  observeState = "none";
  body.classList.remove("quiet");
  $("#obs").hidden = true;
  $("#reticle").classList.remove("on");
}
// 時間圧縮：章の見出し（行き先と、進んでいく日時。日本時間）
let chapterSeg = null;
function warpFx(seg, u, t) {
  $("#caption").classList.toggle("off", !!seg?.warp || (!!seg?.observe && observeState !== "discover"));
  const ch = $("#chapter");
  if (seg?.warp && chapterSeg !== seg) {
    chapterSeg = seg;
    $("#chapter-head").textContent = seg.warp.head;
    $("#chapter-sub").textContent = seg.warp.sub;
  }
  if (seg?.warp) $("#chapter-date").textContent = `${jst.format(EPOCH + t * 1000)}（日本時間）`;
  ch.classList.toggle("on", !!seg?.warp && u > 0.04 && u < 0.92);
  if (!seg?.warp) chapterSeg = null;
}

// ---------- 月面の観測（景色 → 見つける → 知る → NASA の資料へ） ----------
// 照準は、web/tour/artemis2/lunar.js の gate() を満たすときだけ（月の向こう側・夜・画面の外・小さすぎるときは出さない）
const obsTarget = (seg) => TARGETS.find((x) => x.id === seg.observe);
// 画面の座標（1 = 1000 km・y が上）→ 軌道データの座標（km・z が北）
const toData = (v) => [v.x / KM, -v.z / KM, v.y / KM];
let observeState = "none";
function obsWorld(s) {
  const tg = TARGETS.find((x) => x.id === lastSeg?.observe);
  if (!tg || !moonAx) return null;
  const o = observe(tg, moonAx, toData(s.craft), toData(s.moon), traj.sun);
  return s.moon.clone().addScaledVector(dir3(o.n), R_M);
}
// 観測の場面の画角：はじめは月ぜんたい（景色）、見つける・知るでは望遠
const obsFov = (u) => (innerWidth < innerHeight ? 12 : 10) - smoothstep(u, 0.25, 0.45) * (innerWidth < innerHeight ? 3.5 : 3);
// 場面のなかの段階：景色（HUD なし）→ 見つける（照準と名前）→ 知る（下に小さなカード）
function observePhase(seg, u, s, sv) {
  const ret = $("#reticle"), card = $("#obs");
  let phase = "none";
  if (seg.observe && mode === "ride") phase = u < 0.3 ? "scenery" : u < 0.58 ? "discover" : "reveal";
  if (phase !== observeState) {
    observeState = phase;
    body.classList.toggle("quiet", phase === "scenery" || phase === "discover");
    if (phase === "reveal") {
      const tg = obsTarget(seg);
      $("#obs-name").textContent = tg.ja ? `${tg.ja}（${tg.en}）` : tg.en;
      $("#obs-text").textContent = tg.reveal;
      const a = $("#obs-link");
      a.href = tg.link.url;
      a.textContent = `${tg.link.text} ›`;
      $("#obs-usgs").href = tg.usgs;
    }
    card.hidden = phase !== "reveal";
  }
  // 照準：見つける・知るのとき、条件を満たせば
  let show = false;
  if ((phase === "discover" || phase === "reveal") && sv === "window" && moonAx) {
    const tg = obsTarget(seg);
    const o = observe(tg, moonAx, toData(s.craft), toData(s.moon), traj.sun);
    const w = s.moon.clone().addScaledVector(dir3(o.n), R_M).project(camera);
    const x = ((w.x + 1) / 2) * innerWidth, y = ((1 - w.y) / 2) * innerHeight;
    const pxPerDeg = innerHeight / camera.fov;
    const inView = w.z < 1 && x > innerWidth * 0.08 && x < innerWidth * 0.92 && y > innerHeight * 0.1 && y < innerHeight * 0.8;
    const diamPx = o.angDiamDeg * pxPerDeg;
    const g = gate(tg, o, { inView, diamPx });
    ret.dataset.why = g.why;
    if (g.ok) {
      show = true;
      const r = clamp(diamPx * 1.25, 34, 180);
      ret.style.width = ret.style.height = `${r}px`;
      ret.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      $("#reticle-name").textContent = tg.ja ?? tg.en;
    }
  }
  ret.classList.toggle("on", show);
  return phase;
}

// ---------- 毎フレーム ----------
const OUTSIDE_SEC = 9; // 乗ってすぐ、外からオリオンの姿を見せる秒数
const OUTSIDE_SAY = "オリオン宇宙船。4人の宇宙飛行士が乗っています（姿は再現モデル）。";
const END_CINEMA_SEC = 26; // 終わりの何秒前から、映画のような帯にするか
let last = performance.now();
let introT = 0;
const camTo = new THREE.Vector3();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (mode === "intro") {
    introT = (introT + dt * DAY * 0.6) % T_END; // 外から見ると、オリオンが道のりをゆっくりたどる
    const s = place(introT);
    orionMark.position.copy(s.craft);
    orionMark.scale.setScalar(22);
    stars.position.copy(camera.position);
    updateSunAndCorona();
  } else if (mode === "boarding") {
    // 光るオリオンへ近づいて、外から姿を見る位置まで
    boardT += dt / 3.2;
    const s = place(0);
    placeOrion(s);
    orion.visible = orion.userData.fill.visible = boardT > 0.55;
    const k = smoothstep(boardT, 0, 1);
    outsideCam(s, 0, 0, camTo);
    camera.position.lerpVectors(camFrom, camTo, k);
    if (k > 0.85) setNear(0.0008);
    // 外から見るときと同じく、オリオンと地球のあいだを見る（乗ったあとに向きが飛ばないように）
    const toO = s.craft.clone().sub(camera.position).normalize(), toE = camera.position.clone().negate().normalize();
    mtx.lookAt(camera.position, camera.position.clone().add(toO.clone().multiplyScalar(innerWidth < innerHeight ? 4.5 : 1.6).add(toE)), k > 0.6 ? outsideUp(toO, toE) : new THREE.Vector3(0, 1, 0));
    tmpQ.setFromRotationMatrix(mtx);
    camera.quaternion.copy(lookQ.slerp(tmpQ, 0.08));
    orionMark.position.copy(s.craft);
    orionMark.visible = boardT < 0.8;
    orionMark.scale.setScalar(Math.max(0.002, camera.position.distanceTo(s.craft) * 0.08));
    stars.position.copy(camera.position);
    updateSunAndCorona();
    if (boardT >= 1) startRide();
  } else if (mode === "ride") {
    if (!paused) ride += dt;
    if (ride >= RIDE_SEC) {
      finishRide();
    } else {
      const { t, seg, u } = rideToMission(ride);
      if (seg !== lastSeg) {
        if (lastSeg) setLook(null); // 場面が変わったら、台本の向きに戻る
        lastSeg = seg;
      }
      if (autoOutside && ride >= OUTSIDE_SEC) {
        autoOutside = false;
        dip(() => setView("window", { auto: true }));
      }
      setCinema(autoOutside || dipping || !!seg.warp || ride > RIDE_SEC - END_CINEMA_SEC);
      warpFx(seg, u, t);
      const s = place(t);
      placeOrion(s);
      orionMark.position.copy(s.craft);
      // 時間圧縮のあいだは「航路」の眺め（点と日時だけが進む）。終わったら、選んでいた眺めに戻す
      const sv = seg.warp ? "route" : view === "outside" && !autoOutside ? "window" : view;
      if (sv !== shownView) applyView(sv);
      if (sv === "window") {
        camera.position.copy(s.craft);
        aim(s, seg, u);
      } else if (sv === "outside") {
        outsideCam(s, t, ride * 0.12, camera.position);
        // オリオンと地球のあいだを見る（両方が画面に入るように）
        const toO = s.craft.clone().sub(camera.position).normalize(), toE = camera.position.clone().negate().normalize();
        mtx.lookAt(camera.position, camera.position.clone().add(toO.clone().multiplyScalar(innerWidth < innerHeight ? 4.5 : 1.6).add(toE)), outsideUp(toO, toE));
        camera.quaternion.setFromRotationMatrix(mtx);
      } else if (sv === "earth") {
        // 地球から見上げる：地球の表面のすぐ上から、オリオンのほうを見る（オリオンは光る印で）
        camera.position.copy(s.craft).normalize().multiplyScalar(R_E * 1.06);
        mtx.lookAt(camera.position, s.craft, new THREE.Vector3(0, 1, 0));
        camera.quaternion.setFromRotationMatrix(mtx);
        orionMark.scale.setScalar(camera.position.distanceTo(s.craft) * 0.035);
      } else {
        setIntroView(); // 「航路」：画角が変わっている途中でも、通り道が収まるように毎回合わせる
        introCamera();
        orionMark.scale.setScalar(22);
      }
      stars.position.copy(camera.position);
      const fovGoal = sv === "window" ? (seg.observe ? obsFov(u) : seg.fov) ?? (innerWidth < innerHeight ? 70 : 55) : sv === "earth" ? 40 : sv === "outside" ? (innerWidth < innerHeight ? 62 : 46) : innerWidth < innerHeight ? 70 : 55;
      if (Math.abs(camera.fov - fovGoal) > 0.05) {
        camera.fov += (fovGoal - camera.fov) * 0.06;
        camera.updateProjectionMatrix();
      }
      const eclipse = sv === "window" ? updateSunAndCorona() : (updateSunAndCorona(), 0);
      const obsPhase = observePhase(seg, u, s, sv);
      hud(s, t);
      $("#tl-fill").style.width = `${(ride / RIDE_SEC) * 100}%`;
      setCaption(
        autoOutside
          ? OUTSIDE_SAY
          : seg.observe
            ? obsPhase === "discover" ? obsTarget(seg).discover : ""
          : eclipse > 0.35
            ? "太陽が月に隠れました（日食）。月のふちだけが光って見えます。"
            : seg.far && Math.abs(t - T_MOON) < d(0.004)
              ? "月にいちばん近づきました。月面から約6,545km（4,067マイル）です。"
              : seg.say,
      );
      showPhoto(autoOutside || seg.observe ? null : seg.photo ?? null);
      // 大気に入る：最後のほう、オレンジに光る
      $("#reentry").style.opacity = String(seg === SEGS.at(-1) ? smoothstep(u, 0.45, 0.9) * 0.9 : 0);
    }
  }
  for (const m of [sun, corona, orionMark]) faceCamera(m);
  placeLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// はじめ：黒から、ゆっくり明るく（映画の幕開けのように）
setCinema(true);
setTimeout(() => {
  $("#fade").classList.add("slow");
  $("#fade").classList.remove("on");
}, 300);

// 確かめ用：#ride=秒 で、その場面から乗る（例：#ride=100&pause）
const hp = new URLSearchParams(location.hash.slice(1));
if (hp.has("ride")) {
  place(0);
  startRide(Number(hp.get("ride")) || 0);
  lookQ.copy(camera.quaternion);
  if (hp.has("view")) setView(hp.get("view"));
  if (hp.has("pause")) {
    paused = true;
    $("#pause").textContent = "つづける";
  }
}
