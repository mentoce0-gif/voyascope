// 遠くを見る部屋：光になって飛ぶ（体感の案 D。docs/design/far-room-feel.md）
// 位置は「地球からの距離の桁」（log10 km）で持つ。下へスワイプで遠くへ、上へスワイプで戻る（2026-10-04 オーナー）。
// はじく強さで速さが変わり、約1秒で止まる（試作と同じ）。光より速く進むのはワープ（作り話）で、
// 右上の「光で◯秒」が本当の光の速さ。動きを減らす設定では、星を流さず、押した場所へすぐ移る
import { C_KM_S, LIGHT_DAY_KM, kmFullJa, kmShortJa, lightTimeJa, lightYearsJa } from "./distance.js";

export const P0 = 2; // 100 km（地表の近く）から
export const PMAX = Math.log10(LIGHT_DAY_KM) + 0.08; // 1光日の少し先まで
const FRICTION = 0.2; // 1秒で速さが 0.2 倍になる（約1秒で止まる）
const MAX_V = 3; // 1秒に進める桁の数の上限

// 目盛りの間隔：1・2・5×10^n（ラベルが丸い数になるように）
export function niceStep(span) {
  const raw = span / 4;
  const e = 10 ** Math.floor(Math.log10(raw));
  const m = raw / e;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * e;
}

// 速さの表示：止まっている／秒速◯km／光の◯倍（ワープ）
export function speedText(km, v) {
  if (Math.abs(v) < 0.01) return { text: "停止中", warp: false };
  const kmPerS = Math.abs(km * Math.LN10 * v);
  if (kmPerS < C_KM_S) return { text: `秒速 ${Math.round(kmPerS).toLocaleString("ja-JP")} km`, warp: false };
  return { text: `ワープ中：光の ${Math.round(kmPerS / C_KM_S).toLocaleString("ja-JP")} 倍`, warp: true };
}

// いま通り過ぎたところ（いちばん遠い、通過済みの場所）
export const passedStop = (stops, p) => [...stops].reverse().find((s) => p >= Math.log10(s.km) - 0.02) ?? null;

const COLORS = {
  sky: "#050e1f",
  star: "228,236,247",
  text: "#e4ecf7",
  dim: "#8ea3c2",
  mint: "#5ef2c2",
  amber: "#ffb547",
};

export function createFly(root, { stops: initialStops, reduceMotion = false, coarse = false, onPass = () => {} }) {
  root.innerHTML = `
    <canvas class="fly-canvas" aria-hidden="true"></canvas>
    <div class="fly-hud" aria-hidden="true">
      <span class="fly-km mono">100 km</span>
      <span class="fly-sub mono" data-hud="ly"></span>
      <span class="fly-sub mono" data-hud="lt"></span>
      <span class="fly-warp mono" data-hud="warp">停止中</span>
    </div>
    <div class="fly-hint" aria-hidden="true">${coarse ? "↓ 下へスワイプして飛ぶ" : "↑ ホイールか ↑ キーで飛ぶ"}</div>
    <div class="fly-card" data-off="true" aria-live="polite"></div>`;
  const cv = root.querySelector("canvas");
  const ctx = cv.getContext("2d");
  const hud = {
    km: root.querySelector(".fly-km"),
    ly: root.querySelector('[data-hud="ly"]'),
    lt: root.querySelector('[data-hud="lt"]'),
    warp: root.querySelector('[data-hud="warp"]'),
  };
  const hint = root.querySelector(".fly-hint");
  const cardEl = root.querySelector(".fly-card");

  let stops = prepare(initialStops);
  let p = P0;
  let v = 0;
  let trip = null; // 押した場所へ飛ぶとき：{ from, to, t0, dur }（log10 km・ミリ秒）
  let W = 0;
  let H = 0;
  let dpr = 1;
  let raf = 0;
  let lastT = 0;
  let shown = undefined;
  let dirty = true;
  let visible = true;
  let hudAt = 0;

  // 星：画面の中心から外へ流れる（奥行き z が小さいほど手前）
  const stars = Array.from({ length: 240 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: 0.06 + Math.random() * 0.94 }));

  function prepare(list) {
    return [...list].map((s) => ({ ...s, p: Math.log10(Math.max(s.km, 1)) })).sort((a, b) => a.km - b.km);
  }

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = root.clientWidth;
    H = root.clientHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
  }
  const ro = new ResizeObserver(size);
  ro.observe(root);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    dirty = true;
  });
  io.observe(root);

  const hideHint = () => (hint.style.opacity = "0");
  const push = (dv) => {
    trip = null;
    v = Math.max(-MAX_V, Math.min(MAX_V, v + dv));
    hideHint();
    dirty = true;
  };

  // ---------- 操作 ----------
  let drag = null;
  root.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".fly-card")) return; // カードのボタンは飛ぶ操作にしない
    drag = { y: e.clientY };
    root.setPointerCapture(e.pointerId);
  });
  root.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y; // 下へなぞると遠くへ（宇宙を手前へ引き寄せる向き）
    drag.y = e.clientY;
    push(dy * 0.004);
  });
  const endDrag = () => (drag = null);
  root.addEventListener("pointerup", endDrag);
  root.addEventListener("pointercancel", endDrag);
  // ホイール：地表で下へ回したときは、ページを下へ（はしご）スクロールさせる
  root.addEventListener(
    "wheel",
    (e) => {
      if (p <= P0 + 1e-6 && e.deltaY > 0 && v <= 0) return;
      e.preventDefault();
      push(-e.deltaY * 0.0015);
    },
    { passive: false },
  );
  root.addEventListener("keydown", (e) => {
    const k = { ArrowUp: 0.35, ArrowDown: -0.35, PageUp: 1, PageDown: -1 }[e.key];
    if (k) {
      push(k);
      e.preventDefault();
    } else if (e.key === "Home") {
      reset();
      e.preventDefault();
    }
  });

  // ---------- 描く ----------
  const colorOf = (s) => s.color ?? COLORS.mint;

  function drawStars(dt) {
    const cx = W / 2;
    const cy = H * 0.42;
    const k = W * 0.15;
    const maxLen = Math.max(W, H) * 0.18;
    const sp = reduceMotion ? 0 : Math.min(Math.abs(v), MAX_V) * Math.sign(v);
    for (const s of stars) {
      const z0 = s.z;
      s.z -= sp * dt * 0.45;
      // 手前を通り過ぎた星は奥から、奥へ消えた星は手前から出し直す（出し直した星は線を引かない）
      const respawn = s.z <= 0.05 || s.z > 1;
      if (respawn) Object.assign(s, { z: s.z <= 0.05 ? 1 : 0.06, x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 });
      const x = cx + (s.x / s.z) * k;
      const y = cy + (s.y / s.z) * k;
      const a = Math.min(1, 0.25 + (1 - s.z) * 1.1);
      const w = Math.max(0.8, (1 - s.z) * 2.2);
      const len = respawn || z0 === s.z ? 0 : Math.hypot((s.x / z0) * k - (s.x / s.z) * k, (s.y / z0) * k - (s.y / s.z) * k);
      if (len < 0.5) {
        ctx.fillStyle = `rgba(${COLORS.star},${a})`;
        ctx.fillRect(x - w / 2, y - w / 2, w, w);
        continue;
      }
      // 線の長さを抑える（すぐそばを通る星が画面を横切らないように）
      const f = Math.min(1, maxLen / len);
      const px = x + ((s.x / z0) * k - (s.x / s.z) * k) * f;
      const py = y + ((s.y / z0) * k - (s.y / s.z) * k) * f;
      ctx.strokeStyle = `rgba(${COLORS.star},${a})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  // 地球：出発のとき（高さ100km）は下の大きな地平線。遠くへ行くほど小さくなり、下の物差しの上へ沈んでいく
  function drawEarth(km) {
    const cx = W / 2;
    const r = Math.min(H * 40, (6371 / km) * H * 0.9);
    if (r <= 0.6) return;
    const f = Math.max(0, Math.min(1, (Math.log10(km) - P0) / 2.5));
    const top = H * 0.6 + (H - 66 - H * 0.6) * f; // 地球のいちばん上の高さ
    const ey = top + r;
    const glow = ctx.createRadialGradient(cx, ey, r, cx, ey, r + Math.max(4, Math.min(28, r * 0.08)));
    glow.addColorStop(0, "rgba(127,196,255,.55)");
    glow.addColorStop(1, "rgba(127,196,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, ey, r + Math.max(4, Math.min(28, r * 0.08)), 0, Math.PI * 2);
    ctx.fill();
    // 縁の明るい帯は、地球の大きさによらず数ピクセルにする（大気の縁）
    const g = ctx.createRadialGradient(cx, ey, 0, cx, ey, r);
    g.addColorStop(0, "#123f73");
    g.addColorStop(Math.max(0, 1 - 60 / r), "#1d5fa8");
    g.addColorStop(Math.max(0, 1 - 5 / r), "#2f86c9");
    g.addColorStop(1, "#9fd8ff");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, ey, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 通り過ぎる場所：近づくと大きくなり、横へ流れていく。1光日は広がる輪
  function drawStops() {
    const cx = W / 2;
    const cy = H * 0.42;
    ctx.textAlign = "center";
    stops.forEach((s, i) => {
      if (s.kind === "earth") return;
      const d = s.p - p;
      if (d > 0.9 || d < -0.25) return;
      const t = (0.9 - d) / 1.15;
      if (s.kind === "light-day") {
        const rr = t * t * Math.max(W, H) * 0.9;
        ctx.strokeStyle = COLORS.amber;
        ctx.globalAlpha = Math.min(1, t * 1.4);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // 輪の上が画面の中にあるときだけ名前を出す（通り過ぎるときは、カードに出る）
        if (cy - rr - 8 >= 28) label(s.name, cx, cy - rr - 8, COLORS.amber);
        return;
      }
      const ang = -Math.PI / 2 + (i % 2 ? 0.9 : -0.9);
      const x = cx + Math.cos(ang) * t * t * W * 0.55;
      const y = cy + Math.sin(ang) * t * t * H * 0.5 + t * H * 0.3;
      const rad = 2 + t * t * 26;
      ctx.fillStyle = colorOf(s);
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
      // 名前は近づいてから出す（遠くの小さな点の名前が重ならないように）
      if (t > 0.4) {
        ctx.globalAlpha = Math.min(1, (t - 0.4) * 4);
        label(s.name, x, y - rad - 6, COLORS.text);
        ctx.globalAlpha = 1;
      }
    });
  }

  function label(text, x, y, color) {
    ctx.font = "13px 'Zen Kaku Gothic New', sans-serif";
    const w = ctx.measureText(text).width;
    const lx = Math.max(8 + w / 2, Math.min(W - 8 - w / 2, x));
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(5,14,31,.8)";
    ctx.strokeText(text, lx, y);
    ctx.fillStyle = color;
    ctx.fillText(text, lx, y);
  }

  // 下の物差し：0〜いまの距離。遠くへ行くほど縮尺が変わり、通り過ぎた場所（▼）は左へ押しつぶされる
  function drawTape(km) {
    const x0 = 16;
    const x1 = W - 16;
    const y = H - 26;
    const len = x1 - x0;
    ctx.fillStyle = "rgba(5,14,31,.84)";
    ctx.fillRect(0, H - 56, W, 56);
    ctx.strokeStyle = COLORS.dim;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    const step = niceStep(km);
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillStyle = COLORS.dim;
    ctx.textAlign = "center";
    for (let val = 0, i = 0; val <= km * 1.0001; val += step, i++) {
      const x = x0 + (val / km) * len;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 8);
      ctx.stroke();
      for (let k = 1; k < 5; k++) {
        const xs = x0 + ((val + (step * k) / 5) / km) * len;
        if (xs <= x1) {
          ctx.beginPath();
          ctx.moveTo(xs, y);
          ctx.lineTo(xs, y - 4);
          ctx.stroke();
        }
      }
      if (i > 0 && x < x1 - 60) ctx.fillText(kmShortJa(val, 3).replace(" ", ""), x, y + 14);
    }
    ctx.textAlign = "left";
    ctx.fillText("0", x0 - 2, y + 14);
    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.amber;
    ctx.fillText("いまここ", x1, y + 14);
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.mint;
    ctx.font = "11px 'Zen Kaku Gothic New', sans-serif";
    ctx.fillText(`物差し：1目盛り＝${kmShortJa(step / 5, 3)}`, x0, H - 42);
    for (const s of stops) {
      if (s.kind === "earth" || s.km > km) continue;
      const x = x0 + (s.km / km) * len;
      ctx.fillStyle = s.kind === "light-day" ? COLORS.amber : colorOf(s);
      ctx.beginPath();
      ctx.moveTo(x, y - 2);
      ctx.lineTo(x - 4, y - 10);
      ctx.lineTo(x + 4, y - 10);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawHud(km, now) {
    if (now - hudAt < 60 && Math.abs(v) > 0.01) return; // 動いているあいだの文字の書き換えは間引く
    hudAt = now;
    hud.km.textContent = kmFullJa(km);
    hud.ly.textContent = lightYearsJa(km);
    hud.lt.textContent = `光で ${lightTimeJa(km / C_KM_S)}`;
    const sp = speedText(km, v);
    hud.warp.textContent = sp.warp ? `${sp.text}（作り話）` : sp.text;
    hud.warp.dataset.warp = String(sp.warp);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
    lastT = now;
    const before = p;
    if (trip) {
      // 押した場所へ：ゆっくり出て、速くなり、ゆっくり着く（かかる時間は、進む桁の数で決まる）
      trip.t0 ??= now; // 動き出すのは、押したあとの最初のコマから
      const u = Math.max(0, Math.min(1, (now - trip.t0) / trip.dur));
      const e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
      p = trip.from + (trip.to - trip.from) * e;
      v = dt > 0 ? (p - before) / dt : 0;
      if (u >= 1) {
        p = trip.to;
        trip = null;
        v = 0;
      }
    } else {
      p = Math.max(P0, Math.min(PMAX, p + v * dt));
      if (p === P0 || p === PMAX) v = 0;
      v *= FRICTION ** dt;
      if (Math.abs(v) < 0.001) v = 0;
    }
    const moving = p !== before || v !== 0;
    const s = passedStop(stops, p);
    if (s !== shown) {
      shown = s;
      onPass(s);
    }
    if (!visible || (!moving && !dirty)) return;
    dirty = false;
    const km = 10 ** p;
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, W, H);
    drawStars(dt);
    drawEarth(km);
    drawStops();
    drawTape(km);
    drawHud(km, now);
  }

  function reset() {
    trip = null;
    v = 0;
    p = P0;
    dirty = true;
  }

  return {
    cardEl,
    start() {
      if (raf) return;
      lastT = performance.now();
      size();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    destroy() {
      this.stop();
      ro.disconnect();
      io.disconnect();
    },
    reset,
    // その距離まで飛ぶ（動きを減らす設定では、すぐ移る）
    flyTo(km) {
      const to = Math.max(P0, Math.min(PMAX, Math.log10(Math.max(km, 1))));
      hideHint();
      v = 0;
      if (reduceMotion) {
        p = to;
        trip = null;
      } else trip = { from: p, to, t0: null, dur: 700 + Math.min(1800, Math.abs(to - p) * 260) };
      dirty = true;
    },
    setStops(list) {
      stops = prepare(list);
      shown = undefined;
      dirty = true;
    },
    get km() {
      return 10 ** p;
    },
  };
}
