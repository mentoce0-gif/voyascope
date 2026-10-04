// 遠くを見る部屋（M7）：光になって飛ぶ 3D の旅（D）＋その下に距離のはしご（A）。docs/design/far-room-feel.md
// 見た目は合わせた試作（docs/design/far-room-visual-merged.html）を本体に入れたもの（タスク015）。3D の旅は journey.js。
// 地球の画面の「遠くを見る」を押したときに main.js が読み込む（起動の読み込み量に入れない）。
// 距離：月・太陽・惑星は開いた時刻の位置からブラウザで計算。探査機はカードの書き方どおり（distance.js）。
// Horizons の計算値は、週に1回取った表（data/horizons.json）を読む。読めなければ、その探査機は「準備中」のまま。
// 3D は three.js r128（vendor/three-r128.min.js）。読めない・WebGL を使えないときは、v0 の飛ぶ画面（fly.js。2D）にする
import { dateTimeShortJa } from "../format.js";
import { upcomingEvents } from "../events.js";
import { landmarks, probeDistance } from "./distance.js";
import { createFly } from "./fly.js";
import { compactCardHtml, fullCardHtml, ladderHtml, horizonsCredit } from "./probe-card.js";
import { journeyHtml, journeyStops, createJourney, GATE_COMPANION } from "./journey.js";

const COLORS = { moon: "#c9d3e0", sun: "#ffd27a" };
const REFRESH_MS = 60000; // 開いているあいだ、1分ごとに距離を計算し直す

function loadCss(href) {
  return new Promise((resolve, reject) => {
    if (document.querySelector("link[data-far-css]")) return resolve();
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    l.dataset.farCss = "";
    l.onload = () => resolve();
    l.onerror = () => reject(new Error("部屋の見た目を読み込めません"));
    document.head.append(l);
  });
}

async function loadProbes() {
  const res = await fetch("data/probes.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`data/probes.json を読み込めません（HTTP ${res.status}）`);
  return (await res.json()).probes ?? [];
}

// Horizons の表。なくても部屋は開く（Horizons の探査機が準備中になるだけ）
async function loadHorizons() {
  try {
    const res = await fetch("data/horizons.json", { cache: "no-cache" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// three.js r128（ES モジュール。window.THREE は作らない）。読めなければ null（v0 の飛ぶ画面にする）。
// 地球の画面の globe.gl に入っている three（新しい版）が付けた印（window.__THREE__）があると、r128 が
// 「three が2つある」と警告するので、読み込むあいだだけ外す（2つは別々の画面で使っていて、混ざらない）
async function loadThree() {
  const mark = window.__THREE__;
  try {
    delete window.__THREE__;
    return await import("../../vendor/three-r128.min.js");
  } catch (e) {
    console.warn("3D の部品を読み込めないため、かんたんな飛ぶ画面にします", e);
    return null;
  } finally {
    if (mark === undefined) delete window.__THREE__;
    else window.__THREE__ = mark;
  }
}

// 部屋に並べるもの：くらべる目安（月・太陽・1光日）と探査機。距離のないもの（準備中）は dist: null
export function roomItems(probes, now, horizons = null) {
  const marks = landmarks(now).map((m) => ({
    id: m.id,
    kind: m.kind,
    name: m.name,
    color: COLORS[m.id],
    dist: { km: m.km, method: m.kind, approx: false },
  }));
  const craft = probes.map((card) => ({ id: card.id, kind: "probe", name: card.name.ja, card, dist: probeDistance(card, now, horizons) }));
  return [...marks, ...craft];
}

// v0 の飛ぶ画面（3D を使えないとき）で通り過ぎる場所：地表の近く＋距離のあるもの（地上にいる探査機は除く）
export const flyStops = (items) => [
  { id: "earth", kind: "earth", name: "地表の近く", km: 100 },
  ...items.filter((it) => it.dist && it.dist.km > 0).map((it) => ({ id: it.id, kind: it.kind, name: it.name, km: it.dist.km, color: it.color })),
];

// はしごの左の番号：旅の停留所の番号。ボイジャー1号は、模型を置いている1光日と同じ番号
export function stopNumbers(stops) {
  const n = Object.fromEntries(stops.map((st, i) => [st.id, i + 1]));
  if (n["light-day"] && stops.find((st) => st.id === "light-day")?.companion) n[GATE_COMPANION] = n["light-day"];
  return n;
}

const FALLBACK_HTML = `
  <header class="topbar">
    <button type="button" class="far-back" data-far-close><span aria-hidden="true">‹</span> 地球へ戻る</button>
    <span class="j-brand" aria-hidden="true"><img src="assets/brand/logo-600.webp" alt="" width="600" height="104"><span class="brand-room">遠くを見る部屋</span></span>
    <div class="top-actions"><button type="button" class="map-link" data-far-ladder aria-label="距離のはしごを見る"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M19 4v16M5 5h14M5 12h14M5 19h14"/></svg><span>距離のはしご</span></button></div>
  </header>
  <div class="far-fly-wrap">
    <div class="far-fly" tabindex="0" aria-label="遠くへ飛ぶ画面。下へスワイプか ↑ キーで遠くへ、上へスワイプか ↓ キーで地球へ戻る。Home キーで地表へ"></div>
    <div class="far-fly-foot">
      <button type="button" class="btn" data-far-reset>地表へ戻る</button>
      <button type="button" class="btn" data-far-ladder>↓ 距離のはしご（一覧）</button>
    </div>
    <p class="far-note">この端末では 3D で表示できないため、かんたんな画面で飛びます。数字は地球からの距離。<b>光より速く進むのは「ワープ」（作り話）</b>で、右上の「光で◯秒」が本当の光の速さです。</p>
  </div>`;

export async function createFarRoom({ events = [], onClose = () => {} } = {}) {
  const [probes, horizons, THREE] = await Promise.all([loadProbes(), loadHorizons(), loadThree(), loadCss("css/far.css")]);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;

  const room = document.createElement("dialog");
  room.className = "far-room";
  room.setAttribute("aria-labelledby", "far-title");
  room.innerHTML = `
    <div class="far-scroll">
      <section class="journey" data-mode="intro" aria-labelledby="far-title">
        <h2 id="far-title" class="visually-hidden">遠くを見る部屋</h2>
        ${THREE ? journeyHtml({ coarse }) : ""}
      </section>
      <section class="atlas" aria-labelledby="far-ladder-title">
        <div class="atlas-head">
          <div><p class="eyebrow">THE DISTANCE BETWEEN US</p><h3 id="far-ladder-title" class="atlas-title">遠さにも、<br>階段がある。</h3></div>
          <div class="atlas-intro"><p><b>距離のはしご</b></p><p>ひとつ下へ行くと、10倍遠くへ。<br>名前を押すと、その場所まで飛べます。</p><p class="far-at mono"></p></div>
        </div>
        <div class="far-ladder"></div>
        <div class="closing">
          <p class="eyebrow">BEYOND THE ORBIT</p>
          <p class="closing-copy">地球の輪の外は、<br>桁が違う。</p>
          <button type="button" class="again" data-far-again>もう一度、地球から <span aria-hidden="true">↗</span></button>
        </div>
        <section class="far-about" aria-labelledby="far-about-title">
          <h3 id="far-about-title" class="far-h3">距離の出し方</h3>
          <ul class="far-about-list">
            <li><b>月・太陽・水星・火星・木星</b>：この部屋を開いた時刻の位置から、あなたのブラウザで計算しています（Astronomy Engine）。1分ごとに計算し直します。</li>
            <li><b>火星・木星にいる探査機</b>は、その惑星までの距離です。</li>
            <li><b>ボイジャー1号・2号、パーカー・ソーラー・プローブ、はやぶさ２、ジェイムズ・ウェッブ宇宙望遠鏡、ベピコロンボ</b>は、NASA ジェット推進研究所（JPL）の Horizons で、軌道から計算した値です。週に1回、6週間ぶんの表を取って、この部屋を開いた時刻の値にしています。通信で測った値ではありません。軌道のもとのデータを出した機関（ESA・JAXA など）は、カードに書いています。<br><span class="far-credit">出典：<span data-far-credit>Solar System Dynamics. Horizons System. https://ssd.jpl.nasa.gov</span></span></li>
            <li><b>ニュー・ホライズンズ</b>は、NASA が発表した日付つきの値です。いまの距離ではありません。</li>
            <li><b>1光日</b>は、光が24時間で進む距離です（秒速 299,792.458 km × 86,400 秒）。</li>
            <li>探査機の「いま」「状態」「任務」は、運用している機関の公式ページで確かめたものです。カードの「出典」から元のページを開けます。</li>
            <li>天体・機体の配置とスイングバイの航路は、距離を感じるための演出です。実際の航路・向き・大きさとは異なります。探査機の模型は、公式を参考にしたイメージです。<b>光より速く進むのは「ワープ」（作り話）</b>です。</li>
          </ul>
          <p class="far-note far-keys">キーボード：↑ ↓・PageUp／PageDown で飛ぶ ／ Home で地表へ ／ そばにいるときは ← → でまわりから眺める</p>
          <p class="far-note">※非公式ファンメイド作品です。宇宙機関・運用者とは関係ありません。</p>
        </section>
      </section>
    </div>
    <dialog class="card far-card-dialog" aria-labelledby="far-card-title"></dialog>
    <div class="visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-far-say></div>`;
  document.body.append(room);

  const $ = (sel) => room.querySelector(sel);
  // 「距離の出し方」の出典に、取得した日を入れる（いちばん新しい取得）
  const downloaded = Object.values(horizons?.probes ?? {}).map((p) => p.downloaded).filter(Boolean).sort().pop();
  if (downloaded) $("[data-far-credit]").innerHTML = horizonsCredit(downloaded);
  const scroller = $(".far-scroll");
  const journeyEl = $(".journey");
  const atlasEl = $(".atlas");
  const ladderEl = $(".far-ladder");
  const cardDialog = $(".far-card-dialog");
  const atEl = $(".far-at");
  const sayEl = $("[data-far-say]");
  const say = (text) => (sayEl.textContent = text);

  let now = new Date();
  let items = [];
  let stops = [];
  let upcoming = [];
  let v1Event = null;
  let view = null; // 飛ぶ画面：3D の旅（journey）か、v0 の飛ぶ画面（fly）
  let timer = 0;
  let pendingStart = 0;

  const ctx = () => ({ now, upcoming, v1Event });

  // 書き直すときに、押そうとしていたボタン（キーボードのフォーカス）を失わないようにする
  function rewrite(el, html) {
    if (el.innerHTML === html) return;
    const f = el.contains(document.activeElement) ? document.activeElement : null;
    const key = f && (f.dataset.go ? `[data-go="${f.dataset.go}"]` : f.dataset.card ? `[data-card="${f.dataset.card}"]` : null);
    el.innerHTML = html;
    if (key) el.querySelector(key)?.focus({ preventScroll: true });
  }

  // ---------- 飛ぶ画面 ----------
  // 3D の旅。WebGL を使えなければ createJourney が投げる
  function journeyView() {
    const j = createJourney(journeyEl, {
      THREE,
      stops,
      coarse,
      onDetails: openCard,
      say,
      keyTarget: room,
      isBlocked: () => cardDialog.open,
    });
    return {
      kind: "journey",
      start: () => j.start(),
      stop: () => j.stop(),
      update: () => j.setStops(stops),
      flyTo: (it) => j.flyTo(it.id, it.dist?.km),
      home: () => j.home(),
      focus: () => j.focus(),
    };
  }
  // v0 の飛ぶ画面（2D）。3D を使えないとき
  function flyView() {
    journeyEl.classList.add("fallback");
    journeyEl.innerHTML = `<h2 id="far-title" class="visually-hidden">遠くを見る部屋</h2>${FALLBACK_HTML}`;
    const flyEl = journeyEl.querySelector(".far-fly");
    let current = null; // 飛ぶ画面のカードに出しているもの
    let flyCardHtml = "";
    // 同じ中身なら書き直さない（読み上げで同じカードを何度も読まないように）
    const renderFlyCard = () => {
      const html = compactCardHtml(current, ctx());
      if (html === flyCardHtml) return;
      flyCardHtml = html;
      rewrite(fly.cardEl, html);
      fly.cardEl.dataset.off = String(!html);
    };
    const fly = createFly(flyEl, {
      stops: flyStops(items),
      reduceMotion,
      coarse,
      onPass: (stop) => {
        current = stop && stop.kind !== "earth" ? items.find((it) => it.id === stop.id) : null;
        renderFlyCard();
      },
    });
    return {
      kind: "fly",
      start: () => fly.start(),
      stop: () => fly.stop(),
      update: () => {
        if (current) current = items.find((it) => it.id === current.id) ?? null;
        fly.setStops(flyStops(items));
        renderFlyCard();
      },
      flyTo: (it) => fly.flyTo(it.dist.km),
      home: () => fly.reset(),
      focus: () => flyEl.focus({ preventScroll: true }),
    };
  }
  function makeView() {
    if (THREE) {
      try {
        return journeyView();
      } catch (e) {
        console.warn("3D を使えないため、かんたんな飛ぶ画面にします", e); // WebGL を使えない
      }
    }
    return flyView();
  }

  function renderLadder() {
    const numbers = view ? (view.kind === "journey" ? stopNumbers(stops) : {}) : THREE ? stopNumbers(stops) : {};
    rewrite(ladderEl, ladderHtml(items, { ...ctx(), numbers }));
  }

  function refresh() {
    now = new Date();
    items = roomItems(probes, now, horizons);
    upcoming = upcomingEvents(events, now);
    v1Event = upcoming.find((ev) => ev.id === "voyager-1-one-light-day") ?? null;
    stops = journeyStops(items, ctx());
    view?.update();
    renderLadder();
    atEl.textContent = `${dateTimeShortJa(now)} の計算`;
  }

  function openCard(id) {
    const it = items.find((x) => x.id === id);
    if (!it?.card) return;
    cardDialog.innerHTML = fullCardHtml(it, ctx());
    cardDialog.showModal();
  }

  const scrollTo = (el) => el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });

  // ---------- 操作 ----------
  room.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-far-close]")) return close();
    if (t.closest("[data-far-ladder]")) return scrollTo(atlasEl);
    if (t.closest("[data-far-reset]")) return view?.home();
    if (t.closest("[data-far-again]")) {
      scrollTo(journeyEl);
      view?.focus();
      return view?.home();
    }
    const card = t.closest("[data-card]");
    if (card) return openCard(card.dataset.card);
    const go = t.closest("[data-go]");
    if (go) {
      const it = items.find((x) => x.id === go.dataset.go);
      if (!it?.dist || !view) return;
      scrollTo(journeyEl);
      view.focus();
      view.flyTo(it);
    }
  });
  cardDialog.addEventListener("click", (e) => {
    if (e.target === cardDialog || e.target.closest("[data-close]")) cardDialog.close();
  });
  // Esc：くわしいカードが開いていればそれだけを閉じる（いちばん上のダイアログをブラウザが閉じる）。
  // 部屋がどう閉じても（「地球へ戻る」・Esc・ブラウザの「戻る」）、ここで片づける
  room.addEventListener("close", (e) => {
    if (e.target !== room) return;
    clearInterval(timer);
    cancelAnimationFrame(pendingStart);
    view?.stop();
    if (cardDialog.open) cardDialog.close();
    onClose();
  });

  function open() {
    if (room.open) return;
    refresh();
    room.showModal();
    scroller.scrollTop = 0;
    if (view) {
      view.start();
      view.focus();
    } else {
      // はじめて開いたとき：部屋を出してから（次の次のコマで）飛ぶ画面を作る。3D の準備のあいだも、部屋の文字は見える
      journeyEl.querySelector(".viewport")?.focus({ preventScroll: true });
      pendingStart = requestAnimationFrame(() => {
        pendingStart = requestAnimationFrame(() => {
          if (!room.open || view) return;
          view = makeView();
          renderLadder();
          view.start();
          view.focus();
        });
      });
    }
    timer = setInterval(refresh, REFRESH_MS);
  }

  function close() {
    if (room.open) room.close(); // 片づけは close のイベントで
  }

  return { open, close, isOpen: () => room.open };
}
