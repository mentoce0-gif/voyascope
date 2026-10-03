// 遠くを見る部屋（M7 v0）：光になって飛ぶ（D）＋その下に距離のはしご（A）。docs/design/far-room-feel.md
// 地球の画面の「遠くを見る」を押したときに main.js が読み込む（起動の読み込み量に入れない）。
// 距離：月・太陽・惑星は開いた時刻の位置からブラウザで計算。探査機はカードの書き方どおり（distance.js）
import { dateTimeShortJa } from "../format.js";
import { upcomingEvents } from "../events.js";
import { landmarks, probeDistance } from "./distance.js";
import { createFly } from "./fly.js";
import { compactCardHtml, fullCardHtml, ladderHtml } from "./probe-card.js";

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

// 部屋に並べるもの：くらべる目安（月・太陽・1光日）と探査機。距離のないもの（準備中）は dist: null
export function roomItems(probes, now) {
  const marks = landmarks(now).map((m) => ({
    id: m.id,
    kind: m.kind,
    name: m.name,
    color: COLORS[m.id],
    dist: { km: m.km, method: m.kind, approx: false },
  }));
  const craft = probes.map((card) => ({ id: card.id, kind: "probe", name: card.name.ja, card, dist: probeDistance(card, now) }));
  return [...marks, ...craft];
}

// 飛ぶ画面で通り過ぎる場所：地表の近く＋距離のあるもの（地上にいる探査機は除く）
export const flyStops = (items) => [
  { id: "earth", kind: "earth", name: "地表の近く", km: 100 },
  ...items.filter((it) => it.dist && it.dist.km > 0).map((it) => ({ id: it.id, kind: it.kind, name: it.name, km: it.dist.km, color: it.color })),
];

export async function createFarRoom({ events = [], onClose = () => {} } = {}) {
  const [probes] = await Promise.all([loadProbes(), loadCss("css/far.css")]);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;

  const room = document.createElement("dialog");
  room.className = "far-room";
  room.setAttribute("aria-labelledby", "far-title");
  room.innerHTML = `
    <header class="far-head">
      <button type="button" class="far-back" data-far-close><span aria-hidden="true">‹</span> 地球へ戻る</button>
      <div class="far-titles">
        <h2 id="far-title" class="far-title">遠くを見る部屋</h2>
        <p class="far-sub">地球からの距離と、光で届く時間<span class="far-at mono"></span></p>
      </div>
    </header>
    <div class="far-scroll">
      <section class="far-fly-wrap" aria-labelledby="far-fly-title">
        <h3 id="far-fly-title" class="visually-hidden">光になって飛ぶ</h3>
        <div class="far-fly" tabindex="0" aria-label="遠くへ飛ぶ画面。上へスワイプか ↑ キーで遠くへ、下へスワイプか ↓ キーで地球へ戻る。Home キーで地表へ"></div>
        <div class="far-fly-foot">
          <button type="button" class="btn" data-far-reset>地表へ戻る</button>
          <button type="button" class="btn" data-far-ladder>↓ 距離のはしご（一覧）</button>
        </div>
        <p class="far-note">数字は地球からの距離。<b>光より速く進むのは「ワープ」（作り話）</b>で、右上の「光で◯秒」が本当の光の速さです。下の物差しは「0〜いまの距離」で、遠くへ行くほど縮尺が変わります。</p>
      </section>
      <section class="far-ladder-wrap" aria-labelledby="far-ladder-title">
        <h3 id="far-ladder-title" class="far-h3">距離のはしご</h3>
        <p class="far-note">1段下がるごとに10倍遠くなります。名前を押すと、その距離まで飛びます。</p>
        <div class="far-ladder"></div>
      </section>
      <section class="far-about" aria-labelledby="far-about-title">
        <h3 id="far-about-title" class="far-h3">距離の出し方</h3>
        <ul class="far-about-list">
          <li><b>月・太陽・水星・火星</b>：この部屋を開いた時刻の位置から、あなたのブラウザで計算しています（Astronomy Engine）。1分ごとに計算し直します。</li>
          <li><b>惑星にいる探査機</b>は、その惑星までの距離です（ベピコロンボは水星に着く途中なので目安）。</li>
          <li><b>ジェイムズ・ウェッブ宇宙望遠鏡</b>は NASA の説明の目安（約150万km）、<b>ニュー・ホライズンズ</b>は NASA が発表した日付つきの値です。いまの距離ではありません。</li>
          <li><b>1光日</b>は、光が24時間で進む距離です（秒速 299,792.458 km × 86,400 秒）。</li>
          <li>探査機の「いま」「状態」「任務」は、運用している機関の公式ページで確かめたものです。カードの「出典」から元のページを開けます。</li>
        </ul>
        <p class="far-note">※非公式ファンメイド作品です。宇宙機関・運用者とは関係ありません。</p>
      </section>
    </div>
    <dialog class="card far-card-dialog" aria-labelledby="far-card-title"></dialog>`;
  document.body.append(room);

  const $ = (sel) => room.querySelector(sel);
  const flyEl = $(".far-fly");
  const ladderEl = $(".far-ladder");
  const cardDialog = $(".far-card-dialog");
  const atEl = $(".far-at");

  let now = new Date();
  let items = [];
  let upcoming = [];
  let v1Event = null;
  let current = null; // 飛ぶ画面のカードに出しているもの
  let timer = 0;

  const ctx = () => ({ now, upcoming, v1Event });
  const fly = createFly(flyEl, {
    stops: [],
    reduceMotion,
    coarse,
    onPass: (stop) => {
      current = stop && stop.kind !== "earth" ? items.find((it) => it.id === stop.id) : null;
      renderFlyCard();
    },
  });

  // 書き直すときに、押そうとしていたボタン（キーボードのフォーカス）を失わないようにする
  function rewrite(el, html) {
    if (el.innerHTML === html) return;
    const f = el.contains(document.activeElement) ? document.activeElement : null;
    const key = f && (f.dataset.go ? `[data-go="${f.dataset.go}"]` : f.dataset.card ? `[data-card="${f.dataset.card}"]` : null);
    el.innerHTML = html;
    if (key) el.querySelector(key)?.focus({ preventScroll: true });
  }

  // 同じ中身なら書き直さない（読み上げで同じカードを何度も読まないように）
  let flyCardHtml = "";
  function renderFlyCard() {
    const html = compactCardHtml(current, ctx());
    if (html === flyCardHtml) return;
    flyCardHtml = html;
    rewrite(fly.cardEl, html);
    fly.cardEl.dataset.off = String(!html);
  }

  function refresh() {
    now = new Date();
    items = roomItems(probes, now);
    upcoming = upcomingEvents(events, now);
    v1Event = upcoming.find((ev) => ev.id === "voyager-1-one-light-day") ?? null;
    if (current) current = items.find((it) => it.id === current.id) ?? null;
    fly.setStops(flyStops(items));
    rewrite(ladderEl, ladderHtml(items, ctx()));
    atEl.textContent = `（${dateTimeShortJa(now)} の計算）`;
    renderFlyCard();
  }

  function openCard(id) {
    const it = items.find((x) => x.id === id);
    if (!it?.card) return;
    cardDialog.innerHTML = fullCardHtml(it, ctx());
    cardDialog.showModal();
  }

  // ---------- 操作 ----------
  room.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-far-close]")) return close();
    if (t.closest("[data-far-reset]")) return fly.reset();
    if (t.closest("[data-far-ladder]")) return $(".far-ladder-wrap").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    const card = t.closest("[data-card]");
    if (card) return openCard(card.dataset.card);
    const go = t.closest("[data-go]");
    if (go) {
      const it = items.find((x) => x.id === go.dataset.go);
      if (!it?.dist) return;
      $(".far-fly-wrap").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      fly.flyTo(it.dist.km);
      flyEl.focus({ preventScroll: true });
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
    fly.stop();
    if (cardDialog.open) cardDialog.close();
    onClose();
  });

  function open() {
    if (room.open) return;
    refresh();
    room.showModal();
    $(".far-scroll").scrollTop = 0;
    fly.start();
    flyEl.focus({ preventScroll: true });
    timer = setInterval(refresh, REFRESH_MS);
  }

  function close() {
    if (room.open) room.close(); // 片づけは close のイベントで
  }

  return { open, close, isOpen: () => room.open };
}
