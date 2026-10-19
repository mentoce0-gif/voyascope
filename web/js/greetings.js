// 「いってらっしゃい」（打ち上げ）と「おかえり」（帰還）のお知らせ。
// データの更新のあと、最初に開いたときに1回だけ出す。出してよいものには、curation で greeting を付けてある
// （打ち上げの成功・無事の帰還を公式で確かめたときだけ。schema/common.schema.json の greeting）
import { esc, plainDateJa } from "./format.js";
import { eventSpan, jstDay, hmJst, knownSource } from "./events.js";

const STORE_KEY = "voyascope.greeted";

// 出典の URL から「www.jaxa.jp」のような短い名前
const host = (url) => {
  if (knownSource(url)) return knownSource(url); // 動画などは機関の名前で
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// いま出すお知らせ（まだ見ていないもの）。出来事の日から greeting.until（日本時間）まで
export function pendingGreetings({ events = [], craft = [] }, now, seen = new Set()) {
  const today = jstDay(now);
  const list = [];
  for (const ev of events) {
    const g = ev.greeting;
    const span = eventSpan(ev);
    if (!g || ev.kind !== "launch" || ev.status?.value !== "done" || !span) continue;
    if (span.start > now.getTime() || today > g.until) continue;
    list.push({ key: `launch:${ev.id}`, type: "launch", name: g.name, ev, at: span.start });
  }
  for (const c of craft) {
    for (const t of c.crewData?.teams ?? []) {
      const g = t.greeting;
      const day = t.return_date?.value;
      if (!g || !/^\d{4}-\d{2}-\d{2}$/.test(day ?? "")) continue;
      if (day > today || today > g.until) continue;
      list.push({ key: `return:${t.id}`, type: "return", name: t.name.value, team: t, place: c.card.name.ja, at: Date.parse(day) });
    }
  }
  return list.filter((g) => !seen.has(g.key)).sort((a, b) => b.at - a.at);
}

// 計器の読み取りのような並び（左に英字の項目名、右に値）
const readout = (rows) => `<dl class="greet-read">${rows.filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
const dotted = (day) => day.replace(/-/g, ".");

function launchHtml({ name, ev }) {
  const span = eventSpan(ev);
  const at = new Date(span.start);
  const when = span.precision === "at" ? `${dotted(jstDay(at))} ${hmJst(at)} JST` : dotted(jstDay(at));
  const say = `${plainDateJa(jstDay(at))}${span.precision === "at" ? ` ${hmJst(at)}（日本時間）` : ""}、${ev.vehicle?.value ? `${esc(ev.vehicle.value)}で` : ""}打ち上げられました。`;
  const now = ev.id === "mmx-launch" ? `<a class="btn greet-go" href="mmx/now/" aria-label="MMX はいまどこ？（航路の画面を開く）">いまどこ？</a>` : "";
  return `
    <p class="greet-kicker"><i aria-hidden="true"></i>BON VOYAGE</p>
    <h2 class="greet-title"><span class="gt-pre">いってらっしゃい、</span><span class="gt-name">${esc(name)}</span></h2>
    <p class="greet-say">${say}</p>
    ${readout([["LAUNCH", esc(when)], ["VEHICLE", esc(ev.vehicle?.value ?? "")], ["SITE", esc(ev.site?.label ?? "")]])}
    <p class="greet-src">出典：<a href="${esc(ev.status.source)}" target="_blank" rel="noopener noreferrer">${esc(host(ev.status.source))}</a></p>
    <div class="greet-actions">${now}<button type="button" class="btn" data-greet-event="${esc(ev.id)}">予定を見る</button></div>`;
}

function returnHtml({ name, team, place }) {
  const n = team.crew?.length;
  const who = n ? `${n}人が` : "";
  return `
    <p class="greet-kicker"><i aria-hidden="true"></i>WELCOME HOME</p>
    <h2 class="greet-title"><span class="gt-pre">おかえりなさい、</span><span class="gt-name">${esc(name)}</span></h2>
    <p class="greet-say">${plainDateJa(team.return_date.value)}、${who}${esc(place)}から地球に帰ってきました。</p>
    ${readout([["RETURN", esc(dotted(team.return_date.value))], ["FROM", esc(place)], ["CREW", n ? `${n}人` : ""]])}
    <p class="greet-src">出典：<a href="${esc(team.return_date.source)}" target="_blank" rel="noopener noreferrer">${esc(host(team.return_date.source))}</a></p>`;
}

export const greetingHtml = (g) => `<section class="greet greet-${g.type}">${g.type === "launch" ? launchHtml(g) : returnHtml(g)}</section>`;

// 見たお知らせの記録（このブラウザだけ。使えなければ、開くたびに出る）
export function loadSeen() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    return new Set();
  }
}
export function saveSeen(seen, keys) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...new Set([...seen, ...keys])].slice(-50)));
  } catch {
    // 保存できない環境（プライベートブラウズなど）は、そのまま
  }
}
