// MMX の「いまどこ」：いま MMX をどこに描くか（2026-10-19 オーナー：MMX のアイコンから「いまどこ」）
// 推測で「打ち上がった」と描かない（RULES.md）。打ち上げ後の位置は、公式の発表でカードの状態が「済み」になってから、
// 計画の軌道（route.json：打ち上げ日の地球と、打ち上げ tof 日後〈仮〉の火星を結ぶ軌道）の上を、打ち上げからの日数で進める
import { eventSpan, statusOf } from "../../js/events.js";

const DAY = 86400000;

// phase:
//   before      … 打ち上げ前（種子島）
//   unconfirmed … 予定の時刻を過ぎたが、打ち上げの結果をまだ公式で確かめていない（種子島のまま）
//   postponed   … 延期（種子島）
//   flying      … 打ち上げ済み（カードの状態が done）。days は打ち上げからの日数
export function mmxPhase(ev, now) {
  const status = statusOf(ev);
  const start = eventSpan(ev)?.start ?? NaN;
  if (status === "postponed") return { phase: "postponed", launchAt: start };
  if (status === "done") return { phase: "flying", launchAt: start, days: Number.isFinite(start) ? Math.max(0, (now.getTime() - start) / DAY) : 0 };
  if (Number.isFinite(start) && now.getTime() >= start) return { phase: "unconfirmed", launchAt: start };
  return { phase: "before", launchAt: start };
}

// 打ち上げからの日数 → 計画の軌道の上の、どこまで来たか（0〜1）。route の transfer は 2 日ごとの点で、tof 日で火星に着く（仮）
export function transferProgress(days, tof) {
  if (!(tof > 0)) return 0;
  return Math.min(1, Math.max(0, days / tof));
}

// 残り時間のことば（「あと12時間37分」「あと3日4時間」）
export function untilText(ms) {
  if (!(ms > 0)) return "";
  const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d > 0) return `あと${d}日${h}時間`;
  if (h > 0) return `あと${h}時間${mm}分`;
  return `あと${mm}分`;
}
