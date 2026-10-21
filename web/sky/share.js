// 観測ログの文（X に貼る記号の形）と、端末の中の記録
import { stamp, dir8En, SKIES } from "../js/obslog.js";

export const SITE = "https://voyascope.org/";
const skyMark = (id) => (SKIES.find((s) => s.id === id) ?? SKIES[0]).mark;
const hashtag = (name) => `#${String(name).replace(/[\s・（）()]/g, "")}`;

// 流星群：20261022_0130 / #オリオン座流星群 / 12 METEORS / 45MIN / ☀
export function meteorLogText(log) {
  const min = Math.max(1, Math.round((log.end - log.start) / 60000));
  return [
    "#VOYASCOPE OBS-LOG",
    `${stamp(new Date(log.start))} / ${hashtag(log.title)} / ${log.count} ${log.count === 1 ? "METEOR" : "METEORS"} / ${min}MIN / ${skyMark(log.sky)}`,
    SITE,
  ].join("\n");
}

// ISS：20261022_1824 / #ISS / NW→E / EL62° / ☀（通過が分かっているときは方角と高さ）
export function issLogText(log) {
  const parts = [stamp(new Date(log.start)), "#ISS"];
  if (log.pass) parts.push(`${dir8En(log.pass.startAz)}→${dir8En(log.pass.endAz)}`, `EL${Math.round(log.pass.maxEl)}°`);
  parts.push(skyMark(log.sky));
  return ["#VOYASCOPE OBS-LOG", parts.join(" / "), SITE].join("\n");
}

export const logText = (log) => (log.kind === "meteor" ? meteorLogText(log) : issLogText(log));
export const postUrl = (text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

// 端末の中だけに残す（試作の部屋の記録。送らない）
const KEY = "voyascope.lab.skylog.v1";
export function loadLogs() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export function saveLogs(logs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(logs.slice(0, 200)));
    return true;
  } catch {
    return false;
  }
}
