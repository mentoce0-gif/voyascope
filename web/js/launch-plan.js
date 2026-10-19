// 打ち上げの日の「計画の流れ」：打ち上げから分離までを、計画の時刻で追う（地球の画面の射場のビーコン・予定の詳細）
// 位置は描かない。打ち上がったか・分離できたかは、公式の発表を確かめてから記録する（2026-10-05 オーナー確認）
// 計画の時刻は、その打ち上げの日時のときだけのもの（日がずれると、1回目の燃焼のあとの計画が変わる）。
// 予定の日時（events.json の when.at）が forAt と同じときだけ使う
import { eventSpan, statusOf, countdownText } from "./events.js";

const S = (h, m, s) => ((h * 60 + m) * 60 + s) * 1000;

export const LAUNCH_PLANS = {
  // JAXA 2026年度ロケット打上げ計画書［2026年10月改訂版］の表2「ロケットの飛行計画」（10月20日に打ち上げた場合）
  //   https://www.jaxa.jp/press/2026/10/files/jaxa20261018-1_01.pdf
  //   照合：voyascope-research の research/verification/2026-10-06-c19.md、C33（2026-10-19：11の事象の時刻と高度を改訂版で確認）
  "mmx-launch": {
    forAt: "2026-10-19T19:41:03Z",
    source: "https://www.jaxa.jp/press/2026/10/files/jaxa20261018-1_01.pdf",
    sourceLabel: "JAXA 打上げ計画書［2026年10月改訂版］",
    craft: "MMX",
    steps: [
      { t: S(0, 0, 0), label: "打ち上げ（リフトオフ）" },
      { t: S(0, 1, 56), label: "固体ロケットブースタ（SRB-3）の1組目（2本）を分離" },
      { t: S(0, 1, 58), label: "SRB-3 の2組目（2本）を分離" },
      { t: S(0, 3, 17), label: "フェアリング（MMX を包むカバー）を分離" },
      { t: S(0, 4, 52), label: "第1段エンジンの燃焼停止" },
      { t: S(0, 4, 59), label: "第1段と第2段を分離" },
      { t: S(0, 5, 12), label: "第2段エンジンの1回目の燃焼（〜0:10:40）" },
      { t: S(0, 10, 40), label: "慣性飛行" },
      { t: S(1, 3, 57), label: "第2段エンジンの2回目の燃焼（〜1:10:21）" },
      { t: S(1, 11, 12), label: "MMX を分離（火星へ向かう軌道へ。高度 約592km）", separation: true },
    ],
  },
};

// 分離の予定のあと、しばらく（30分）は「分離の予定の時刻を過ぎました」を出す
export const AFTER_MS = 30 * 60000;

export const hms = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// いま計画の流れのどこか。流れの外（打ち上げ前・分離の予定の30分後より後・日時が計画書と違う・延期など）は null
export function launchProgress(ev, now) {
  const plan = LAUNCH_PLANS[ev?.id];
  // 打ち上げを公式で確かめたあと（done）も、分離の予定の30分後までは計画の流れを出す
  const st = statusOf(ev);
  if (!plan || (st !== "scheduled" && st !== "done") || ev.when?.value?.at !== plan.forAt) return null;
  const span = eventSpan(ev);
  const elapsed = now.getTime() - span.start;
  const sep = plan.steps.find((s) => s.separation).t;
  if (elapsed < 0 || elapsed >= sep + AFTER_MS) return null;
  let current = 0;
  plan.steps.forEach((s, i) => {
    if (s.t <= elapsed) current = i;
  });
  return { plan, elapsed, current, separated: elapsed >= sep, key: `${current}` };
}

// 打ち上げの前の1週間：射場のピンをゆっくり光らせて、名前を「MMX 打ち上げまで あと4日12時間」に（2026-10-15 オーナー）
// 日時（時刻まで）が公表されている予定だけ。延期・日付だけの予定・打ち上げの時刻を過ぎたら光らせない
export const SOON_MS = 7 * 86400000;
export function launchSoon(ev, now) {
  if (ev?.kind !== "launch" || statusOf(ev) !== "scheduled") return false;
  const span = eventSpan(ev);
  if (span?.precision !== "at") return false;
  const ms = span.start - now.getTime();
  return ms > 0 && ms <= SOON_MS;
}
export const soonTag = (ev, now) => `${LAUNCH_PLANS[ev.id]?.craft ?? ev.site.label} 打ち上げまで ${countdownText(ev, now)}`;

// 射場のピンの名前（ビーコンのあいだ）
export function beaconTag(p) {
  return p.separated ? `${p.plan.craft} 分離の予定の時刻を過ぎました` : `${p.plan.craft} 打ち上げから ${hms(p.elapsed)}（計画）`;
}

// 予定の詳細に出す「計画の流れ」（残り時間の代わりに。経過は毎秒書き換える）
export function launchFlowHtml(p) {
  const items = p.plan.steps
    .map((s, i) => `<li class="${i < p.current ? "done" : i === p.current ? "now" : ""}"><span class="mono">${hms(s.t)}</span>${s.label}</li>`)
    .join("");
  return `
    <div class="event-countdown launch-live">
      <span class="k">${p.separated ? "分離の予定の時刻を過ぎました（計画）" : "打ち上げから（計画の時刻で追っています）"}</span>
      <span class="mono" data-live="elapsed">${hms(p.elapsed)}</span>
      <span class="small">打ち上がったか・分離できたかは、JAXA の発表で確かめてください。位置は描きません</span>
    </div>
    <ol class="launch-flow" aria-label="打ち上げの日の流れ（計画）">${items}</ol>
    <p class="k small">時刻は打ち上げからの経過で、どれも「約」。出典：<a href="${p.plan.source}" target="_blank" rel="noopener">${p.plan.sourceLabel}</a></p>`;
}
