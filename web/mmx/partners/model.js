// MMX の国際協力のページ：自前の模型（js/far/models.js）を、モジュールの単位で光らせる
// 機器ひとつひとつの位置は確かめていないので、部品ごとには光らせない（docs/mmx-partners-study.md の案D）
import * as THREE from "../../vendor/three-r128.min.js";
import { makeKit, MODELS } from "../../js/far/models.js";

const AMBER = new THREE.Color(0xffb547);

export function initModel(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!navigator.webdriver });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 50);
  camera.position.set(0, 0.15, 4.4);
  scene.add(new THREE.AmbientLight(0x6d86b8, 0.35));
  scene.add(new THREE.HemisphereLight(0x9fb6e0, 0x1a1410, 0.4));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4); sun.position.set(3, 2, 4); scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9cc2ff, 0.8); rim.position.set(-3, 1, -3); scene.add(rim);

  const mmx = MODELS.mmx(THREE, makeKit(THREE));
  const holder = new THREE.Group(); holder.add(mmx); scene.add(holder);
  mmx.rotation.set(0.18, 0, 0.05);

  // どのメッシュがどのモジュールか（ローバは探査モジュールの中の群れ）
  const parts = mmx.userData.parts;
  const meshes = [];
  for (const [key, group] of Object.entries(parts)) {
    group.traverse((o) => {
      if (!o.isMesh) return;
      let p = o, part = key;
      while (p && p !== group) { if (p.name === "rover") part = "rover"; p = p.parent; }
      meshes.push({ mesh: o, part, base: o.material });
    });
  }
  const cache = new Map();
  const variant = (base, mode) => {
    const k = base.uuid + mode;
    if (!cache.has(k)) {
      const m = base.clone();
      if (mode === "lit") { m.emissive = AMBER.clone(); m.emissiveIntensity = 0.55; }
      else { m.color = m.color.clone().multiplyScalar(0.22); if (m.emissive) m.emissive.setRGB(0, 0, 0); m.transparent = true; m.opacity = 0.55; }
      cache.set(k, m);
    }
    return cache.get(k);
  };

  // lit：光らせるモジュールの集まり。null ならすべて元の色
  function setLit(lit) {
    for (const { mesh, part, base } of meshes) {
      mesh.material = !lit ? base : variant(base, lit.has(part) ? "lit" : "dim");
    }
    // ローバだけが光るときは、ローバの側（模型の -X）を手前へ回す
    if (lit?.has("rover") && !lit.has("explore")) {
      const k = Math.round((yaw - Math.PI / 2) / (2 * Math.PI));
      turnTo = Math.PI / 2 + k * 2 * Math.PI; hold = 5;
    }
  }

  // 指でまわす（離すとゆっくり回り続ける）
  let yaw = -0.6, spin = 0.12, drag = null, turnTo = null, hold = 0;
  canvas.addEventListener("pointerdown", (e) => { drag = e.clientX; turnTo = null; hold = 0; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (drag === null) return; yaw += (e.clientX - drag) * 0.01; drag = e.clientX; });
  const end = () => { drag = null; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let last = performance.now();
  renderer.setAnimationLoop((t) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (turnTo !== null) { yaw += (turnTo - yaw) * Math.min(1, dt * 4); if (Math.abs(turnTo - yaw) < 0.002) turnTo = null; }
    else if (hold > 0) hold -= dt;
    else if (drag === null && !still) yaw += spin * dt;
    holder.rotation.y = yaw;
    renderer.render(scene, camera);
  });
  return { setLit };
}
