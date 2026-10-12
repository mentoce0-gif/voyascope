// 打ち上げの日の「計画の流れ」：打ち上げから分離までを、計画の時刻で追う（地球の画面の射場のビーコン・予定の詳細）
// 位置は描かない。打ち上がったか・分離できたかは、公式の発表を確かめてから記録する（2026-10-05 オーナー確認）
// 計画の時刻は、その打ち上げの日時のときだけのもの（日がずれると、1回目の燃焼のあとの計画が変わる）。
// 予定の日時（events.json の when.at）が forAt と同じときだけ使う
import { eventSpan, statusOf } from "./events.js";

const S = (h, m, s) => ((h * 60 + m) * 60 + s) * 1000;

export const LAUNCH_PLANS = {
  // JAXA 打上げ計画書（10月20日に打ち上げた場合）https://www.jaxa.jp/press/2026/08/files/jaxa20260820-1_01.pdf
  //   照合：voyascope-research の research/verification/2026-10-06-c19.md（打ち上げの約1時間11分12秒後に、火星遷移軌道で MMX を分離）
  "mmx-launch": {
    forAt: "2026-10-19T19:41:03Z",
    source: "https://www.jaxa.jp/press/2026/08/files/jaxa20260820-1_01.pdf",
    sourceLabel: "JAXA 打上げ計画書（10月20日に打ち上げた場合）",
    craft: "MMX",
    steps: [
      { t: S(0, 0, 0), label: "打ち上げ" },
      { t: S(0, 5, 12), label: "第2段エンジンの1回目の燃焼（〜0:10:40）" },
      { t: S(0, 10, 40), label: "慣性飛行" },
      { t: S(1, 3, 57), label: "第2段エンジンの2回目の燃焼（〜1:10:21）" },
      { t: S(1, 11, 12), label: "MMX を分離（火星へ向かう軌道へ）", separation: true },
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
  if (!plan || statusOf(ev) !== "scheduled" || ev.when?.value?.at !== plan.forAt) return null;
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

// 射場のピンの名前（ビーコンのあいだ）
export function beaconTag(p) {
  return p.separated ? `${p.plan.craft} 分離の予定の時刻を過ぎました` : `${p.plan.craft} 打ち上げから ${hms(p.elapsed)}（計画）`;
}
