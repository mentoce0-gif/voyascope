// 「一言でわかる」ページの図（M13、2026-10-30 オーナー）：5つの問いごとに、three.js で描いた6秒でくり返す図。
// 図の中に、問い・名前・値・出典・「voyascope.org／非公式」を描く → その部分だけ切り抜いて X に出せる。
// 「画像を保存」（PNG）と「動画を保存」（1周＝6秒。H.264 の MP4 を作れるブラウザは MP4、ほかは WebM）。
// 値はページに書いたもの（#vis-data。build-summaries.mjs が作る）だけを使う。新しい事実は描かない。
// three.js は r128（web/vendor/three-r128.min.js）。描くのは1つの WebGL で、見えている図だけを動かす。
// 動きを減らす設定（prefers-reduced-motion）のときは止めた絵にする。WebGL がなければ何も出さない（文字だけで読める）
import * as THREE from "../vendor/three-r128.min.js";
import { makeKit, MODELS } from "../js/far/models.js";

const V = JSON.parse(document.getElementById("vis-data")?.textContent ?? "null");
const W = 1280, H = 720, LOOP = 6000;
const C = { navy: "#07142b", deep: "#050e1f", amber: "#ffb547", mint: "#5ef2c2", text: "#eef6f3", dim: "#9fb3c8" };
const FONT = '"Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const QUESTIONS = { 1: "何？", 2: "いま何が起きた？", 3: "どこ？", 4: "これまで→これから", 5: "どれくらい？" };
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer;
try {
  renderer = V && new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
} catch {
  renderer = null;
}
if (renderer) start();

function start() {
  renderer.setSize(W, H, false);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(C.deep, 1);
  const kit = makeKit(THREE);
  const dirty = new Set();
  // three.js は部品を絞った版なので、画像は CanvasTexture で、単色・線・点は小さなシェーダーで描く
  const earthMats = [];
  const im = new Image();
  im.onload = () => {
    const t = new THREE.CanvasTexture(im);
    t.encoding = THREE.sRGBEncoding;
    earthMats.forEach((m) => ((m.map = t), (m.needsUpdate = true)));
    dirty.forEach((f) => f());
  };
  im.src = new URL("../assets/earth/day-2048.jpg", import.meta.url).href;
  const flat = (color, opacity = 1, points = 0) =>
    new THREE.ShaderMaterial({
      transparent: opacity < 1 || points > 0,
      depthWrite: opacity >= 1,
      uniforms: { uC: { value: new THREE.Color(color) }, uA: { value: opacity } },
      vertexShader: `void main(){ ${points ? `gl_PointSize = ${points.toFixed(1)};` : ""} gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform vec3 uC; uniform float uA; void main(){ ${points ? "float d = length(gl_PointCoord-.5)*2.; if (d > 1.) discard;" : ""} gl_FragColor = vec4(uC, uA${points ? " * (1. - d * d)" : ""}); }`,
    });

  // ---------- 部品 ----------
  // 星（実在の星の位置ではない模様）
  function stars(n = 900, r = 60, seed = 7) {
    let s = seed;
    const rnd = () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u);
      pos.set([r * q * Math.cos(a), r * u, r * q * Math.sin(a)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, flat(0xbfd3ea, 0.8, 2.2));
  }
  function lights(scene) {
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
    sun.position.set(5, 3, 4);
    scene.add(sun, new THREE.AmbientLight(0x6f86a6, 0.45));
    const rim = new THREE.DirectionalLight(0x8fc8ff, 0.6);
    rim.position.set(-4, 1, -5);
    scene.add(rim);
  }
  // 地球の画像（NASA Blue Marble）を使った図は、下の帯にそう書く
  let building = null, usesEarth = false;
  function earth(r = 1) {
    if (building) building.earth = true;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
    earthMats.push(mat);
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 48), mat);
    const gm = flat(0x5ea8ff, 0.12);
    gm.side = THREE.BackSide;
    const glow = new THREE.Mesh(new THREE.SphereGeometry(r * 1.04, 48, 32), gm);
    m.add(glow);
    return m;
  }
  // 探査機の模型（遠くを見る部屋と同じもの）。地球のまわりの機体は、模型がないので小さな光の点
  function craft(size = 1) {
    if (V.model && MODELS[V.model]) {
      const g = MODELS[V.model](THREE, kit);
      const box = new THREE.Box3().setFromObject(g);
      const s = size / Math.max(...box.getSize(new THREE.Vector3()).toArray());
      const holder = new THREE.Group();
      g.position.sub(box.getCenter(new THREE.Vector3()));
      holder.add(g);
      holder.scale.setScalar(s);
      return holder;
    }
    return dot(C.mint, size * 0.18);
  }
  function dot(color, r) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), flat(color));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(r * 2.4, 24, 16), flat(color, 0.18));
    m.add(halo);
    return m;
  }
  function ring(r, color = C.mint, opacity = 0.6) {
    const pos = [];
    for (let i = 0; i < 128; i++) {
      const a = (i / 128) * Math.PI * 2, b = ((i + 1) / 128) * Math.PI * 2;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r, Math.cos(b) * r, 0, Math.sin(b) * r);
    }
    return segs(pos, color, opacity);
  }
  function line(a, b, color = C.dim, opacity = 0.5) {
    return segs([...a.toArray(), ...b.toArray()], color, opacity);
  }
  function segs(pos, color, opacity) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    const o = new THREE.LineSegments(g, flat(color, Math.min(opacity, 0.999)));
    o.material.uniforms.uA.value = opacity;
    return o;
  }
  // 地球のまわりの機体：地球と高さの輪（本当の比）と、輪を回る点。文字のじゃまにならないよう右へ寄せる
  function earthSystem(scene, cam, alt = 400, ringColor = C.mint, satColor = C.amber) {
    const R = 1, r = R * (1 + alt / 6371);
    const g = new THREE.Group();
    const e = earth(R);
    const orbit = ring(r, ringColor, 0.7);
    orbit.rotation.x = 0.35;
    const sat = dot(satColor, 0.035 * Math.max(1, r / 1.5));
    g.add(e, orbit, sat);
    scene.add(g);
    const d = Math.max(6.4, r * 2.9);
    const half = Math.tan((cam.fov / 2) * (Math.PI / 180)) * d * (W / H);
    g.position.x = half * 0.42;
    g.position.y = -0.3;
    cam.position.set(0, 0.12 * d, d);
    cam.lookAt(0, 0, 0);
    return {
      sat,
      update(t) {
        e.rotation.y = t * 0.8;
        const a = t * Math.PI * 2;
        sat.position.set(Math.cos(a) * r, 0, Math.sin(a) * r).applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.35);
      },
    };
  }
  const camera = (fov = 35) => new THREE.PerspectiveCamera(fov, W / H, 0.01, 200);
  const ease = (x) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, x))) / 2;
  const project = (v, cam) => {
    const p = v.clone().project(cam);
    return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H];
  };

  // ---------- 問いごとの場面 ----------
  // それぞれ { scene, cam, update(t), overlay(ctx, t) } を返す。t は 0〜1（6秒で1周）
  const SCENES = {
    // Q1 何？：機体がゆっくり回る
    1() {
      const scene = new THREE.Scene(), cam = camera(30);
      lights(scene);
      scene.add(stars());
      if (!V.model) {
        const es = earthSystem(scene, cam, V.q3?.altKm ?? 400);
        return {
          scene, cam,
          update: es.update,
          overlay(g) {
            title(g, 1);
            wrap(g, V.q1.text, 64, 230, 600, 46, `700 36px ${FONT}`, C.text, 4);
            footer(g, `出典：${V.q1.src}`);
          },
        };
      }
      const m = craft(1.6);
      m.position.set(1.15, -0.05, 0);
      scene.add(m);
      cam.position.set(0, 0.2, 6);
      return {
        scene, cam,
        update(t) {
          m.rotation.y = -0.6 + t * Math.PI * 2;
          m.rotation.x = 0.12 * Math.sin(t * Math.PI * 2);
        },
        overlay(g) {
          title(g, 1);
          wrap(g, V.q1.text, 64, 230, 640, 46, `700 36px ${FONT}`, C.text, 4);
          footer(g, `出典：${V.q1.src}`);
        },
      };
    },
    // Q2 いま何が起きた？：機体から電波の輪が広がる
    2() {
      const scene = new THREE.Scene(), cam = camera(30);
      lights(scene);
      scene.add(stars());
      let m, es, size = 1;
      if (V.model) {
        m = craft(1.3);
        m.position.set(1.6, 0, 0);
        scene.add(m);
        cam.position.set(0, 0, 6);
      } else {
        es = earthSystem(scene, cam, V.q3?.altKm ?? 400, C.dim, C.mint);
        m = es.sat;
        size = 0.25 * Math.max(1, (1 + (V.q3?.altKm ?? 400) / 6371) / 1.5);
      }
      const rings = Array.from({ length: 3 }, () => {
        const r = ring(1, C.mint, 0.8);
        r.rotation.x = Math.PI / 2;
        scene.add(r);
        return r;
      });
      return {
        scene, cam,
        update(t) {
          if (es) es.update(t * 0.25);
          else m.rotation.y = 0.5 + 0.25 * Math.sin(t * Math.PI * 2);
          const at = m.getWorldPosition(new THREE.Vector3());
          rings.forEach((r, i) => {
            const k = (t + i / 3) % 1;
            r.position.copy(at);
            r.lookAt(cam.position);
            r.rotateX(Math.PI / 2);
            r.scale.setScalar((0.5 + k * 2.4) * size);
            r.material.uniforms.uA.value = 0.75 * (1 - k);
          });
        },
        overlay(g) {
          title(g, 2);
          pill(g, V.q2.label, 64, 236);
          wrap(g, V.q2.note || "公式の発表で確かめた、いまの状態", 64, 312, 600, 42, `700 32px ${FONT}`, C.text, 5);
          footer(g, `出典：${V.q2.src}・${V.q2.asOf} 確認`);
        },
      };
    },
    // Q3 どこ？：探査機は地球からの距離（月・太陽と、桁でならべる）。地球のまわりの機体は、高さの輪を回る
    3() {
      const scene = new THREE.Scene(), cam = camera(32);
      lights(scene);
      scene.add(stars());
      if (V.group === "craft" || !V.q3?.km) {
        const es = earthSystem(scene, cam, V.q3?.altKm ?? 400);
        return {
          scene, cam,
          update: es.update,
          overlay(g) {
            title(g, 3);
            big(g, V.q3?.altKm ? `高さ 約${V.q3.altKm.toLocaleString("ja-JP")} km` : "地球のまわり", 64, 250);
            g.font = `24px ${FONT}`;
            g.fillStyle = C.dim;
            g.fillText("地球のまわりを回っている（輪の大きさは本当の比）", 64, 300);
            footer(g, V.q3?.src ? `出典：${V.q3.src}` : "");
          },
        };
      }
      // 桁のものさし：x = log10(km)。地球(0)・月・太陽・探査機
      const X0 = -3.7, X1 = 3.7, Y = -1.05;
      const lo = 3.5, hi = Math.max(11, Math.log10(V.q3.km) + 0.4);
      const X = (km) => X0 + ((Math.log10(Math.max(km, 10 ** lo)) - lo) / (hi - lo)) * (X1 - X0);
      const e = earth(0.32);
      e.position.set(X0, Y, 0);
      scene.add(e, line(new THREE.Vector3(X0, Y, 0), new THREE.Vector3(X1, Y, 0), C.dim, 0.35));
      const marks = [
        { name: "月", x: X(V.q3.moonKm), c: "#c9d3dc" },
        { name: "太陽", x: X(V.q3.sunKm), c: "#ffd27a" },
      ];
      for (const k of marks) {
        const d = dot(k.c, 0.06);
        d.position.set(k.x, Y, 0);
        scene.add(d);
      }
      const m = craft(0.7);
      const px = X(V.q3.km);
      m.position.set(px, Y + 0.05, 0);
      scene.add(m);
      const pulse = dot(C.mint, 0.05);
      scene.add(pulse);
      cam.position.set(0, 0.6, 9.2);
      cam.lookAt(0, -0.2, 0);
      return {
        scene, cam,
        update(t) {
          e.rotation.y = t * 0.8;
          m.rotation.y = t * Math.PI * 2;
          pulse.position.set(X0 + (px - X0) * ease(t * 1.25), Y, 0);
          pulse.visible = t < 0.85;
        },
        overlay(g) {
          title(g, 3);
          big(g, `地球から ${V.q3.text}`, 64, 250);
          g.font = `22px ${FONT}`;
          g.fillStyle = C.dim;
          g.fillText(`${V.q3.when}・目盛りは桁（10倍ごと）`, 64, 296);
          const lab = (x, s, col, dy = 40) => {
            const [sx, sy] = project(new THREE.Vector3(x, Y, 0), cam);
            g.font = `600 22px ${FONT}`;
            g.fillStyle = col;
            g.textAlign = "center";
            g.fillText(s, sx, sy + dy);
            g.textAlign = "left";
          };
          lab(X0, "地球", C.text);
          for (const k of marks) lab(k.x, k.name, k.c);
          lab(px, V.name, C.amber, -70);
          footer(g, `出典：${V.q3.src}`);
        },
      };
    },
    // Q4 これまで→これから：線の上を光が「打ち上げ」から「いま」へ進み、「これから」は琥珀の点
    4() {
      const scene = new THREE.Scene(), cam = camera(30);
      scene.add(stars(600));
      const items = (V.q4 ?? []).slice(-5);
      const n = items.length;
      const Y = -0.75;
      // 「これから」の予定がないときも、いまの先に余白を残す
      const slots = items.some((i) => i.kind === "next") ? n : n + 1;
      const xs = items.map((_, i) => (slots === 1 ? 0 : -3.3 + (6.6 * i) / (slots - 1)));
      scene.add(line(new THREE.Vector3(-4.2, Y, 0), new THREE.Vector3(4.2, Y, 0), C.dim, 0.45));
      const nowI = items.findIndex((i) => i.kind === "now");
      const nodes = items.map((it, i) => {
        const d = dot(it.kind === "now" ? C.mint : it.kind === "next" ? C.amber : C.dim, it.kind === "now" ? 0.11 : 0.08);
        d.position.set(xs[i], Y, 0);
        scene.add(d);
        return d;
      });
      const pulse = dot(C.mint, 0.06);
      scene.add(pulse);
      cam.position.set(0, 0.5, 8.6);
      cam.lookAt(0, -0.2, 0);
      return {
        scene, cam,
        update(t) {
          const k = ease(t / 0.7);
          pulse.position.set(xs[0] + (xs[nowI] - xs[0]) * k, Y, 0);
          pulse.visible = t < 0.8 && nowI > 0;
          const b = 1 + 0.35 * Math.sin(t * Math.PI * 4);
          nodes[nowI]?.scale.setScalar(b);
        },
        overlay(g) {
          title(g, 4);
          items.forEach((it, i) => {
            const [sx, sy] = project(new THREE.Vector3(xs[i], Y, 0), cam);
            const col = it.kind === "now" ? C.mint : it.kind === "next" ? C.amber : C.text;
            g.textAlign = "center";
            g.font = `20px ${MONO}`;
            g.fillStyle = it.kind === "now" ? C.mint : C.dim;
            g.fillText(it.d, sx, sy - 34);
            wrap(g, it.label, sx, sy + 48, Math.min(250, (W - 120) / n), 28, `700 22px ${FONT}`, col, 3, "center");
            g.textAlign = "left";
          });
          if (!items.some((i) => i.kind === "next")) {
            g.font = `20px ${FONT}`;
            g.fillStyle = C.dim;
            g.textAlign = "right";
            g.fillText("これから：公式に日付の出ている予定は、まだ載せていません", W - 64, 560);
            g.textAlign = "left";
          }
          footer(g, "出典：各出来事の公式の発表（ページの本文に）");
        },
      };
    },
    // Q5 どれくらい？：探査機は「光で何時間」を、地球からの光が進むあいだ時計が進む。地球のまわりは1周の時計
    5() {
      const scene = new THREE.Scene(), cam = camera(32);
      lights(scene);
      scene.add(stars());
      if (V.q5?.lightSec) {
        const Y = -1.15;
        const e = earth(0.5);
        e.position.set(-3.2, Y, 0);
        const m = craft(1.0);
        m.position.set(3.1, Y, 0);
        scene.add(e, m, line(new THREE.Vector3(-2.6, Y, 0), new THREE.Vector3(2.5, Y, 0), C.dim, 0.3));
        const beam = dot("#fff7d6", 0.07);
        scene.add(beam);
        cam.position.set(0, 0.4, 8.4);
        cam.lookAt(0, -0.2, 0);
        let k = 0;
        return {
          scene, cam,
          update(t) {
            k = ease(t / 0.8);
            beam.position.set(-2.6 + 5.1 * k, Y, 0);
            e.rotation.y = t;
            m.rotation.y = t * Math.PI;
          },
          overlay(g) {
            title(g, 5);
            big(g, `光で ${V.q5.light}`, 64, 250);
            const s = V.q5.lightSec * k;
            const h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60), se = Math.floor(s % 60);
            g.font = `600 30px ${MONO}`;
            g.fillStyle = C.mint;
            g.fillText(V.q5.lightSec >= 3600 ? `${h}:${String(mi).padStart(2, "0")}:${String(se).padStart(2, "0")}` : V.q5.lightSec >= 60 ? `${mi}:${String(se).padStart(2, "0")}` : `${s.toFixed(1)} 秒`, 64, 300);
            g.font = `22px ${FONT}`;
            g.fillStyle = C.dim;
            g.fillText(`地球から送った電波が届くまで${V.q5.ratio ? `・${V.q5.ratio}` : ""}`, 64, 340);
            footer(g, "光の速さ（定義の値）から計算");
          },
        };
      }
      // 地球のまわり：1周の時計
      const es = earthSystem(scene, cam, V.q5?.altKm ?? 400, C.amber, C.mint);
      let k = 0;
      return {
        scene, cam,
        update(t) {
          k = t;
          es.update(t);
        },
        overlay(g) {
          title(g, 5);
          const q = V.q5 ?? {};
          const lines = [
            q.periodMin && `地球を1周 約${q.periodMin}分`,
            q.speed && `秒速 約${q.speed} km`,
            q.lengthM && `大きさ 約${q.lengthM.toLocaleString("ja-JP")} m`,
            q.massT && `重さ 約${q.massT.toLocaleString("ja-JP")} トン`,
          ].filter(Boolean);
          big(g, lines[0] ?? "", 64, 250);
          if (q.periodMin) {
            g.font = `600 30px ${MONO}`;
            g.fillStyle = C.mint;
            g.fillText(`${Math.floor(q.periodMin * k)} 分`, 64, 300);
          }
          g.font = `24px ${FONT}`;
          g.fillStyle = C.dim;
          lines.slice(1).forEach((s, i) => g.fillText(s, 64, (q.periodMin ? 350 : 300) + i * 36));
          footer(g, `出典：${q.src ?? ""}`);
        },
      };
    },
  };

  // ---------- 文字（図の中に描く。切り抜いたときに、なんの図か分かるように） ----------
  function title(g, n) {
    g.fillStyle = C.mint;
    roundRect(g, 64, 56, 62, 34, 6);
    g.fill();
    g.font = `700 20px ${MONO}`;
    g.fillStyle = C.navy;
    g.fillText(`Q${n}`, 78, 80);
    g.font = `700 30px ${FONT}`;
    g.fillStyle = C.mint;
    g.fillText(QUESTIONS[n], 142, 84);
    g.font = `700 44px ${FONT}`;
    g.fillStyle = C.text;
    g.fillText(V.name, 64, 156);
  }
  function big(g, s, x, y) {
    g.font = `700 48px ${FONT}`;
    g.fillStyle = C.amber;
    g.fillText(s, x, y);
  }
  function pill(g, s, x, y) {
    g.font = `700 24px ${FONT}`;
    const w = g.measureText(s).width + 36;
    g.strokeStyle = C.mint;
    g.lineWidth = 2;
    roundRect(g, x, y - 30, w, 42, 21);
    g.stroke();
    g.fillStyle = C.mint;
    g.fillText(s, x + 18, y);
  }
  function footer(g, src) {
    g.fillStyle = "rgba(5,14,31,.72)";
    g.fillRect(0, H - 56, W, 56);
    g.font = `18px ${FONT}`;
    g.fillStyle = C.dim;
    g.fillText(src + (usesEarth ? `${src ? "・" : ""}地球の画像：NASA Blue Marble` : ""), 32, H - 22);
    g.textAlign = "right";
    g.font = `700 18px ${MONO}`;
    g.fillStyle = C.text;
    g.fillText("VOYASCOPE", W - 32 - g.measureText(" voyascope.org・非公式のファンメイド作品").width - 6, H - 22);
    g.font = `18px ${FONT}`;
    g.fillStyle = C.dim;
    g.fillText(" voyascope.org・非公式のファンメイド作品", W - 32, H - 22);
    g.textAlign = "left";
  }
  // 日本語の折り返し（1文字ずつ）。lines を超えたら「…」
  function wrap(g, s, x, y, w, lh, font, color, lines = 3, align = "left") {
    g.font = font;
    g.fillStyle = color;
    g.textAlign = align;
    const out = [];
    let cur = "";
    for (const ch of s) {
      // 行の頭に句読点・閉じかっこを置かない
      if (g.measureText(cur + ch).width > w && !"、。，．）」』】・ー…".includes(ch)) {
        out.push(cur);
        cur = ch;
      } else cur += ch;
    }
    if (cur) out.push(cur);
    if (out.length > lines) {
      out.length = lines;
      out[lines - 1] = out[lines - 1].slice(0, -1) + "…";
    }
    out.forEach((l, i) => g.fillText(l, x, y + i * lh));
    g.textAlign = "left";
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  // 左側の文字を読みやすくする影
  function shade(g) {
    const gr = g.createLinearGradient(0, 0, W * 0.62, 0);
    gr.addColorStop(0, "rgba(5,14,31,.85)");
    gr.addColorStop(1, "rgba(5,14,31,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }

  // ---------- 図を置く ----------
  const figs = [];
  for (const fig of document.querySelectorAll("figure.vis")) {
    const n = Number(fig.dataset.q);
    if (!SCENES[n]) continue;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", `${V.name}：Q${n} ${QUESTIONS[n]} の図`);
    const act = document.createElement("div");
    act.className = "act";
    const bImg = button("画像を保存"), bVid = button("動画を保存（6秒）");
    act.append(bImg, bVid);
    fig.append(cv, act);
    fig.hidden = false;
    const f = { n, fig, cv, g: cv.getContext("2d"), s: null, visible: false };
    figs.push(f);
    const drawStill = () => draw(f, f.last ?? 0.3);
    dirty.add(drawStill);
    bImg.onclick = () => {
      draw(f, f.last ?? 0.3);
      cv.toBlob((b) => save(b, `voyascope-${V.id}-q${n}.png`), "image/png");
    };
    bVid.onclick = () => record(f, bVid);
    if (!("MediaRecorder" in window) || !cv.captureStream) bVid.hidden = true;
    else if (!MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")) bVid.title = "このブラウザでは WebM で保存します（X に出すには MP4 への変換が要ります）";
  }
  function button(s) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s;
    return b;
  }
  function save(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function draw(f, t) {
    if (!f.s) {
      building = {};
      f.s = SCENES[f.n]();
      f.s.earth = building.earth;
      building = null;
    }
    usesEarth = f.s.earth;
    f.last = t;
    f.s.update(t);
    renderer.render(f.s.scene, f.s.cam);
    f.g.drawImage(renderer.domElement, 0, 0);
    shade(f.g);
    f.s.overlay(f.g, t);
  }
  // 1周（6秒）を録画する
  async function record(f, b) {
    // X に出せるのは H.264 の MP4。作れないブラウザは WebM（X に出すには変換が要る）
    const type = ["video/mp4;codecs=avc1.640028", "video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    if (!type) return;
    b.disabled = true;
    b.textContent = "録画中…";
    f.rec = true;
    const rec = new MediaRecorder(f.cv.captureStream(30), { mimeType: type, videoBitsPerSecond: 6e6 });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise((r) => (rec.onstop = r));
    rec.start();
    const t0 = performance.now();
    await new Promise((res) => {
      const step = () => {
        const k = (performance.now() - t0) / LOOP;
        draw(f, Math.min(k, 0.9999));
        if (k < 1) requestAnimationFrame(step);
        else res();
      };
      step();
    });
    rec.stop();
    await done;
    f.rec = false;
    save(new Blob(chunks, { type }), `voyascope-${V.id}-q${f.n}.${type.includes("mp4") ? "mp4" : "webm"}`);
    b.disabled = false;
    b.textContent = "動画を保存（6秒）";
  }

  const io = new IntersectionObserver((es) => es.forEach((e) => (figs.find((f) => f.cv === e.target).visible = e.isIntersecting)), { rootMargin: "100px" });
  figs.forEach((f) => {
    io.observe(f.cv);
    draw(f, 0.3);
  });
  if (still) return;
  const loop = (now) => {
    for (const f of figs) if (f.visible && !f.rec) draw(f, (now % LOOP) / LOOP);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
