// 遠くを見る部屋：探査機のカード（飛んでいるときの小さなカード・くわしいカード）と、距離のはしご
// 書くのは curation/probes の出典つきの事実だけ。距離は distance.js の計算か、カードに書かれた公式の値
import { esc, plainDateJa } from "../format.js";
import { whenText, countdownText } from "../events.js";
import { BODY_JA, kmJa, kmShortJa, kmFullJa, lightSeconds, lightTimeJa, decadeLabel } from "./distance.js";

const STATUS_JA = { operating: "運用中", ended: "運用終了", not_launched: "打ち上げ前" };
const ext = `target="_blank" rel="noopener noreferrer"`;
const src = (url) => (url ? ` <a class="src" href="${esc(url)}" ${ext}>出典</a>` : "");
const asOfJa = (d) => (d ? `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日` : "");
const factValue = (f) => (Array.isArray(f?.value) ? f.value.join("・") : (f?.value ?? ""));

// ---------- Horizons の計算値の出典（JPL SSD の希望の形。2026-10-04 の返事） ----------
// Solar System Dynamics. (Downloaded 2026, October 4). Horizons System. https://ssd.jpl.nasa.gov
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ymd = (iso) => /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
// 「Horizons System」はページ（カードの source）へ、URL は SSD のサイトへつなぐ
export function horizonsCredit(downloaded, page = "https://ssd.jpl.nasa.gov/horizons/") {
  const m = ymd(downloaded);
  const when = m ? `${m[1]}, ${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : "";
  return `Solar System Dynamics. (Downloaded ${when}). <a href="${esc(page)}" ${ext}>Horizons System</a>. <a href="https://ssd.jpl.nasa.gov" ${ext}>https://ssd.jpl.nasa.gov</a>`;
}
// 「10月4日に取得」（取得した日。世界時の日付）
const downloadedJa = (iso) => {
  const m = ymd(iso);
  return m ? `${Number(m[2])}月${Number(m[3])}日` : "";
};

// 距離の1行：数字と、どうやって出した値か
export function distanceParts(item) {
  const d = item.dist;
  if (!d) return { km: null, how: "準備中", lt: null };
  if (d.method === "on_earth") return { km: null, how: "打ち上げ前（地上）", lt: null };
  const lt = lightTimeJa(lightSeconds(d.km), { approx: d.approx });
  if (d.method === "planet") return { km: kmJa(d.km), short: kmShortJa(d.km), how: `${BODY_JA[d.body]}までの距離（計算）`, lt };
  if (d.method === "typical") return { km: `約 ${kmJa(d.km, 2)}`, short: `約${kmShortJa(d.km, 2)}`, how: "目安（その日の距離ではない）", lt };
  if (d.method === "dated") return { km: `約 ${kmJa(d.km, 2)}`, short: `約${kmShortJa(d.km, 2)}`, how: `${plainDateJa(d.at)}の値`, lt };
  // Horizons の計算値：3桁に丸めて「約」。取得した日を書く（通信で測った値ではない）
  if (d.method === "horizons") return { km: `約 ${kmJa(d.km, 3)}`, short: `約${kmShortJa(d.km, 3)}`, how: `Horizons の計算値（${downloadedJa(d.downloaded)}に取得）`, lt };
  // くらべる目安（月・太陽）と 1光日
  return { km: kmJa(d.km), short: kmShortJa(d.km), how: item.kind === "light-day" ? "光が24時間で進む距離" : "いまの距離（計算）", lt };
}

// その探査機のこれからの予定（いちばん近いもの1つ）
export const nextEvent = (item, upcoming) => upcoming.find((ev) => item.card?.events?.includes(ev.id)) ?? null;

// title：予定の名前を書きかえるとき（3D の旅では、機体の名前のすぐ下なので、名前を省いた短い形にする）
export function eventLine(ev, now, { full = false, title = ev?.title?.ja } = {}) {
  if (!ev) return "";
  const left = countdownText(ev, now);
  return `<span class="ev-when">${esc(whenText(ev, now, { full }))}</span>　${esc(title)}${left ? `<span class="ev-left">（${esc(left)}）</span>` : ""}`;
}

// 予定の名前から、はじめの機体の名前を省く（「ベピコロンボが水星を回る軌道に入る」→「水星を回る軌道に入る」）。
// 名前の（ ）の中と、全角・半角の数字のちがいは見ない。名前で始まらなければ、そのまま
export function eventTitleWithout(title, name) {
  const norm = (t) => t.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const base = norm(name.replace(/（.*?）/g, "")).trim();
  if (!base || !norm(title).startsWith(base)) return title;
  const after = title.slice(base.length); // 数字の置きかえは1文字ずつなので、もとの文字列をそのまま切れる
  const rest = after.replace(/^\s*[がの]\s*/, "");
  return rest && rest !== after ? rest : title;
}

// ---------- 飛んでいるときのカード（通り過ぎた場所） ----------
export function compactCardHtml(item, { now, upcoming, v1Event }) {
  if (!item || item.kind === "earth") return "";
  const dp = distanceParts(item);
  const head = `<div class="fc-name">${esc(item.name)}${item.kind === "landmark" ? `<span class="fc-tag">くらべる目安</span>` : ""}</div>`;
  const dist = `<div class="fc-dist"><span class="mono">${esc(dp.km)}</span> <span class="fc-how">${esc(dp.how)}</span></div>`;
  const lt = dp.lt ? `<div class="fc-lt">光で <span class="mono">${esc(dp.lt)}</span></div>` : "";
  if (item.kind === "landmark") {
    const extra =
      item.id === "sun"
        ? `いま見ている太陽の光は、${esc(dp.lt)}前に太陽を出た光`
        : `光なら ${esc(dp.lt)}で着く。ここまでは、ほとんど一瞬`;
    return `${head}${dist}${lt}<p class="fc-line">${extra}</p>`;
  }
  if (item.kind === "light-day") {
    const ev = v1Event
      ? `<p class="fc-line">ボイジャー1号は ${eventWhenJa(v1Event, now)}、ここに届く予定（NASA）。人がつくったもので、はじめて</p>
         <button type="button" class="fc-more" data-card="voyager-1">ボイジャー1号のカード</button>`
      : "";
    return `${head}${dist}${lt}${ev}`;
  }
  const ev = nextEvent(item, upcoming);
  return `${head}${dist}${lt}
    <p class="fc-line">${esc(item.card.location.value)}</p>
    ${ev ? `<p class="fc-ev">${eventLine(ev, now)}</p>` : ""}
    <button type="button" class="fc-more" data-card="${esc(item.id)}">カードを見る</button>`;
}

const eventWhenJa = (ev, now) => esc(whenText(ev, now));

// ---------- くわしいカード（ダイアログの中身） ----------
export function fullCardHtml(item, { now, upcoming }) {
  const c = item.card;
  const dp = distanceParts(item);
  const d = c.distance;
  const distBody = !item.dist
    ? `<span class="k">いまの距離は、探査機の位置のデータを使えるようになってから出します（準備中）。</span>`
    : d.method === "on_earth"
      ? `<span class="k">打ち上げ前なので、まだ地上にいます。</span>`
      : d.method === "horizons"
        ? `<span class="mono">${esc(dp.km)}</span>　<span class="k">${esc(dp.how)}</span><br>光で <span class="mono">${esc(dp.lt)}</span>
           <br><span class="k small">NASA ジェット推進研究所（JPL）の Horizons で、軌道から計算した値です。通信で測った値ではありません。${
             d.supplier ? `軌道のもとのデータ：${esc(d.supplier)}（Horizons の説明による）。` : ""
           }${d.note ? esc(d.note) : ""}</span>
           <br><span class="k small credit">出典：${horizonsCredit(item.dist.downloaded, d.source)}</span>`
        : `<span class="mono">${esc(dp.km)}</span>　<span class="k">${esc(dp.how)}</span><br>光で <span class="mono">${esc(dp.lt)}</span>${
            d.note ? `<br><span class="k small">${esc(d.note)}</span>` : ""
          }${src(d.source)}`;
  const status = c.status;
  const evs = upcoming.filter((ev) => c.events?.includes(ev.id));
  const row = (label, body) => `<div class="pc-row"><dt>${label}</dt><dd>${body}</dd></div>`;
  const note = (f) => (f?.note ? `<br><span class="k small">${esc(f.note)}</span>` : "");
  return `
    <div class="card-inner far-card-inner">
      <button type="button" class="close mono" data-close aria-label="閉じる">×</button>
      <p class="pc-kicker mono">MISSION / 探査機を知る</p>
      <h2 class="pc-title" id="far-card-title">${esc(c.name.ja)}</h2>
      <p class="pc-en">${esc(c.name.en)}</p>
      <dl class="pc-facts">
        ${row("いま", `${esc(c.location.value)}${src(c.location.source)}`)}
        ${row("状態", `<strong>${esc(STATUS_JA[status.value] ?? status.value)}</strong><span class="k">（${asOfJa(status.as_of)}に確認）</span>${note(status)}${src(status.source)}`)}
        ${row("距離", distBody)}
        ${evs.length ? row("予定", evs.map((ev) => `<div class="pc-ev">${eventLine(ev, now, { full: true })}${src(ev.when.source)}</div>`).join("")) : ""}
        ${row("任務", `${esc(c.mission.value)}${src(c.mission.source)}`)}
        ${row("運用", `${esc(factValue(c.operator))}${note(c.operator)}${src(c.operator.source)}`)}
        ${row("打ち上げ", `${plainDateJa(c.launch_date.value)}${note(c.launch_date)}${src(c.launch_date.source)}`)}
      </dl>
      <h3>公式のページ</h3>
      <ul class="link-list">${c.official_links.map((l) => `<li><a href="${esc(l.url)}" ${ext}>${esc(l.label)}</a></li>`).join("")}</ul>
      <p class="k small">内容は ${plainDateJa(c.updated_at)} に公式のページで確かめたものです。※非公式ファンメイド作品です。宇宙機関・運用者とは関係ありません。</p>
    </div>`;
}

// ---------- 距離のはしご（Codex 案の形。桁ごとの段。下へ行くほど10倍遠い） ----------
export const LADDER_DECADES = [5, 6, 7, 8, 9, 10];

// numbers：旅の停留所の番号（はしごの左の「01」）。旅に出てこないものは空
export function ladderHtml(items, { now, upcoming, v1Event, numbers = {} }) {
  const placed = items.filter((it) => it.dist && it.dist.method !== "on_earth");
  const onEarth = items.filter((it) => it.dist?.method === "on_earth");
  const pending = items.filter((it) => it.kind === "probe" && !it.dist);
  const num = (id) => (numbers[id] ? String(numbers[id]).padStart(2, "0") : "");
  const place = (it) => {
    const dp = distanceParts(it);
    const ev = it.kind === "probe" ? nextEvent(it, upcoming) : null;
    const cls = it.kind === "probe" ? "probe" : it.kind;
    const v1 = it.kind === "light-day" && v1Event ? `<span class="lad-ev">ボイジャー1号が ${eventWhenJa(v1Event, now)} にここへ（NASA の予告）</span>` : "";
    // 計算した値はぜんぶの桁、目安・日付つき・Horizons の値は丸めて「約」
    const dist = it.dist.approx ? dp.short : kmFullJa(it.dist.km);
    return `<li><button type="button" class="lad-place ${cls}" data-go="${esc(it.id)}">
      <span class="lad-num mono">${num(it.id)}</span>
      <span class="lad-main"><span class="lad-name">${esc(it.name)}${it.kind === "landmark" ? `<span class="li-tag">くらべる目安</span>` : ""}</span><span class="lad-how">${esc(dp.how)}</span>${ev ? `<span class="lad-ev">${eventLine(ev, now)}</span>` : ""}${v1}</span>
      <span class="lad-dist mono">${esc(dist)}<small>光で ${esc(dp.lt)}</small></span>
      <span class="lad-arrow" aria-hidden="true">↗</span>
    </button></li>`;
  };
  const rungs = LADDER_DECADES.map((e, n) => {
    const inRung = placed.filter((it) => Math.floor(Math.log10(it.dist.km)) === e).sort((a, b) => a.dist.km - b.dist.km);
    return `<li class="lad-step">
      <div class="lad-label"><h4 class="lad-scale">${esc(decadeLabel(e))}</h4><small class="mono">10<sup>${e}</sup> km</small></div>
      <div class="lad-content"><ul class="lad-places">${inRung.map(place).join("") || `<li class="lad-empty">この段に載せている場所は、ありません</li>`}</ul>${
        n < LADDER_DECADES.length - 1 ? `<p class="lad-ten mono" aria-hidden="true">↓ <span>×10</span> FARTHER</p>` : ""
      }</div>
    </li>`;
  }).join("");
  const ground = onEarth.length
    ? `<li class="lad-step ground">
      <div class="lad-label"><h4 class="lad-scale">地上</h4><small class="mono">ON EARTH</small></div>
      <div class="lad-content"><ul class="lad-places">${onEarth
        .map((it) => {
          const ev = nextEvent(it, upcoming);
          return `<li><button type="button" class="lad-place probe" data-card="${esc(it.id)}">
            <span class="lad-num mono"></span>
            <span class="lad-main"><span class="lad-name">${esc(it.name)}</span>${ev ? `<span class="lad-ev">${eventLine(ev, now)}</span>` : ""}</span>
            <span class="lad-dist">打ち上げ前</span>
            <span class="lad-arrow" aria-hidden="true">＋</span>
          </button></li>`;
        })
        .join("")}</ul></div>
    </li>`
    : "";
  const pend = pending.length
    ? `<div class="lad-pending">
       <p class="eyebrow">STILL ON A JOURNEY</p>
       <h4 class="lad-pending-title">いまの距離は準備中</h4>
       <p class="far-note">探査機の位置のデータを使えるようになってから、距離を出します。カードは見られます。</p>
       <ul class="lad-places">${pending
         .map((it) => `<li><button type="button" class="lad-place probe pending" data-card="${esc(it.id)}"><span class="lad-num mono"></span><span class="lad-main"><span class="lad-name">${esc(it.name)}</span><span class="lad-how">${esc(it.card.location.value)}</span></span><span class="lad-dist">準備中</span><span class="lad-arrow" aria-hidden="true">＋</span></button></li>`)
         .join("")}</ul>
     </div>`
    : "";
  return `<ol class="ladder">${ground}${rungs}</ol>${pend}`;
}
