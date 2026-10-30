// 右下の SCOPE ボタンと、弧に広がるランチャー（M13、2026-10-30 オーナー：A＋C 案）
//   押したまま指をすべらせて、離したところの項目へ。押して離すだけなら開いたまま（もう一度押して選ぶ）
//   キーボード：Enter・スペースで開く、矢印で選ぶ、Enter で決める、Esc で閉じる
//   地球をなぞる操作とぶつからないように、ボタンから始めた指の動きだけを見る

const OPEN_MS = 180; // これより長く押していたら「押したまま選ぶ」とみなす
const MOVE_PX = 14; // これより動いたら「押したまま選ぶ」

// ボタンの中心から見た角度（度。左が180、上が90）に項目を並べる
export function arcAngles(n, from = 180, to = 90) {
  if (n <= 1) return [from];
  return Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));
}

// 指の位置（ボタンの中心からの dx・dy。画面の下向きが +dy）から、いちばん近い項目の番号。近すぎるときは -1
export function pickIndex(dx, dy, angles, minR = 36) {
  if (Math.hypot(dx, dy) < minR) return -1;
  const a = (Math.atan2(-dy, dx) * 180) / Math.PI;
  const deg = a < -90 ? a + 360 : a; // 左下（-180〜-90）は 180〜270 として扱う
  let best = -1, bestD = Infinity;
  angles.forEach((t, i) => {
    const d = Math.abs(deg - t);
    if (d < bestD) (best = i), (bestD = d);
  });
  return bestD <= 40 ? best : -1;
}

export function createLauncher({ fab, root = document.body, items, radius = () => (innerWidth < 380 ? 128 : 140) }) {
  const layer = document.createElement("div");
  layer.className = "launcher";
  layer.hidden = true;
  layer.innerHTML = `<div class="launcher-dim" data-close></div><p class="launcher-hint">押したまま指をすべらせて、離したところへ</p><ul class="launcher-items" role="menu" aria-label="SCOPE（行き先を選ぶ）"></ul>`;
  root.append(layer);
  const ul = layer.querySelector("ul");
  let shown = [], els = [], angles = [], sel = -1, open = false, press = null;

  function render() {
    shown = items.filter((it) => !it.hidden?.());
    angles = arcAngles(shown.length);
    ul.innerHTML = "";
    els = shown.map((it, i) => {
      const li = document.createElement("li");
      li.setAttribute("role", "none");
      const b = document.createElement("button");
      b.type = "button";
      b.className = `launcher-item${it.accent ? " accent" : ""}`;
      b.setAttribute("role", "menuitem");
      b.dataset.i = i;
      b.innerHTML = `<b>${it.label}</b><small>${it.sub}</small>`;
      b.setAttribute("aria-label", `${it.label}：${it.sub}`);
      b.addEventListener("click", () => choose(i));
      li.append(b);
      ul.append(li);
      return b;
    });
    place();
  }
  function center() {
    const r = fab.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }
  function place() {
    const [cx, cy] = center();
    const R = radius();
    els.forEach((b, i) => {
      const t = (angles[i] * Math.PI) / 180;
      b.style.left = `${cx + Math.cos(t) * R}px`;
      b.style.top = `${cy - Math.sin(t) * R}px`;
    });
    layer.style.setProperty("--cx", `${cx}px`);
    layer.style.setProperty("--cy", `${cy}px`);
    layer.style.setProperty("--r", `${R}px`);
  }
  function setSel(i) {
    sel = i;
    els.forEach((b, j) => b.classList.toggle("sel", j === i));
  }
  function show() {
    if (open) return;
    render();
    open = true;
    layer.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => layer.classList.add("on"));
  }
  function hide(focusFab = true) {
    if (!open) return;
    open = false;
    layer.classList.remove("on");
    layer.hidden = true;
    fab.setAttribute("aria-expanded", "false");
    setSel(-1);
    if (focusFab) fab.focus();
  }
  function choose(i) {
    const it = shown[i];
    hide(false);
    if (it) it.action();
  }

  fab.setAttribute("aria-haspopup", "menu");
  fab.setAttribute("aria-expanded", "false");
  fab.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const wasOpen = open;
    show();
    press = { id: e.pointerId, t: performance.now(), x: e.clientX, y: e.clientY, moved: false, wasOpen };
    fab.setPointerCapture(e.pointerId);
  });
  fab.addEventListener("pointermove", (e) => {
    if (!press || e.pointerId !== press.id) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_PX) press.moved = true;
    const [cx, cy] = center();
    setSel(pickIndex(e.clientX - cx, e.clientY - cy, angles));
  });
  const end = (e) => {
    if (!press || e.pointerId !== press.id) return;
    const p = press;
    press = null;
    const held = p.moved || performance.now() - p.t > OPEN_MS;
    if (held && sel >= 0) choose(sel);
    else if (p.wasOpen && !p.moved) hide(); // 開いているときにもう一度押したら閉じる
    else setSel(-1); // 押して離しただけ：開いたまま
  };
  fab.addEventListener("pointerup", end);
  fab.addEventListener("pointercancel", (e) => {
    press = null;
    if (e) setSel(-1);
  });
  // キーボード
  fab.addEventListener("click", (e) => {
    if (e.detail === 0) open ? hide() : (show(), setSel(0), els[0]?.focus());
  });
  layer.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return hide();
    const k = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (k) {
      e.preventDefault();
      const i = (Math.max(0, sel) + k + els.length) % els.length;
      setSel(i);
      els[i].focus();
    }
  });
  layer.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) hide();
  });
  addEventListener("resize", () => open && place());
  return { open: show, close: hide };
}
