// 試作の部屋 01：観測ログ。アプリと同じ部品（通過の計算・OBS-LOG の文）を使い、時刻だけを仮に動かす
import { satrecFromOrbit } from "../../js/orbit.js";
import { findVisiblePasses, observerOf, dir8 } from "../../js/passes.js";
import { obsLogHtml, whenWord, clockWord, loadPrefecture } from "../../js/tonight.js";
import { esc } from "../../js/format.js";

const $ = (s) => document.querySelector(s);
const DAY = 86400e3;
const [prefs, orbit] = await Promise.all([
  fetch("../../data/prefectures.json").then((r) => r.json()),
  fetch("../../data/orbits/iss.json").then((r) => r.json()),
]);
const satrec = satrecFromOrbit(orbit);
const prefectures = prefs.prefectures;

let pref = prefectures.find((p) => p.code === loadPrefecture()) ?? prefectures.find((p) => p.name === "東京");
let at = new Date(); // 仮の時刻
let sky = "clear";
let list = [];

$("#pref").innerHTML = prefectures.map((p) => `<option value="${p.code}"${p === pref ? " selected" : ""}>${esc(p.name)}</option>`).join("");

// datetime-local は日本時間で読み書きする
const toLocal = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 16);
const fromLocal = (s) => new Date(`${s}:00+09:00`);

function renderPasses() {
  const now = new Date();
  list = findVisiblePasses(satrec, observerOf(pref), new Date(now.getTime() - 10 * DAY), { days: 20, limit: 40 });
  $("#passes").innerHTML = list.length
    ? list
        .map(
          (p, i) => `<li><button type="button" class="btn${p.start < now ? " past" : ""}" data-pass="${i}">
            <span>${esc(whenWord(p.start, now))} ${esc(clockWord(p.start))}</span>
            <span class="k small">${dir8(p.startAz)}→${dir8(p.endAz)}・約${Math.round(p.maxEl)}°</span></button></li>`,
        )
        .join("")
    : `<li class="k small">前後10日に、${esc(pref.name)}から見やすい通過はありません。</li>`;
}

// アプリと同じ選び方：3時間以内に始まった通過。なければ次の通過（予告だけ）
function renderLog() {
  $("#at").value = toLocal(at);
  $("#now-label").textContent = `仮の時刻：${at.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（日本時間）`;
  const obs = observerOf(pref);
  const recent = findVisiblePasses(satrec, obs, new Date(at.getTime() - 3 * 3600e3), { days: 3.5 / 24, limit: 4 }).filter((p) => p.start <= at);
  const next = findVisiblePasses(satrec, obs, at, { days: 5, limit: 1 });
  const pass = recent.at(-1) ?? next[0] ?? null;
  $("#log").innerHTML = pass ? obsLogHtml(pass, at, sky) : `<p class="k small">この時刻の前後に、見える通過はありません。</p>`;
}

$("#pref").addEventListener("change", (e) => {
  pref = prefectures.find((p) => p.code === e.target.value);
  renderPasses();
  renderLog();
});
$("#passes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-pass]");
  if (!b) return;
  at = new Date(list[Number(b.dataset.pass)].start.getTime() + 5 * 60e3);
  renderLog();
  $("#log").scrollIntoView({ behavior: "smooth" });
});
$("#at").addEventListener("change", (e) => {
  if (e.target.value) at = fromLocal(e.target.value);
  renderLog();
});
$("#now").addEventListener("click", () => {
  at = new Date();
  renderLog();
});
$("#log").addEventListener("click", (e) => {
  const s = e.target.closest("[data-sky]");
  if (s) {
    sky = s.dataset.sky;
    renderLog();
    return;
  }
  const copy = e.target.closest("[data-obslog-copy]");
  if (copy) {
    const text = $("[data-obslog-text]")?.textContent ?? "";
    const manual = () => {
      getSelection()?.selectAllChildren($("[data-obslog-text]"));
      copy.textContent = "選んだ文をコピーしてください";
    };
    navigator.clipboard?.writeText(text).then(() => (copy.textContent = "コピーしました"), manual) ?? manual();
  }
});

renderPasses();
renderLog();
