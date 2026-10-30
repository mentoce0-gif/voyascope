// 出来事の回数だけを数える（2026-10-28 オーナー。docs/m9-plan.md の 7.）
// 送るのは出来事の名前だけ。人を見分ける情報（Cookie・端末の番号・県・時刻の細かさなど）は送らない
// 受け口は Worker（src/lab-worker.js の /e）。Cloudflare の Workers Analytics Engine に、名前と時刻だけを記録する
// 本番（voyascope.org）のときだけ送る。手元の確認・プレビューでは数えない

export const EVENT_NAMES = new Set([
  "start", // 「観測を開始」を押した
  "far", // 遠くを見る部屋を開いた
  "tonight", // 「今夜」（観測）を開いた
  "from-missions", // 「一言でわかる」の「いまの位置を見る」から来た
  "mmx-now", // MMX の「いまどこ」を開いた
  "sky", // SKY OBSERVER を開いた
  "artemis2", // アルテミス2号のページを開いた
]);

export function count(name) {
  if (location.hostname !== "voyascope.org" || !EVENT_NAMES.has(name)) return;
  try {
    navigator.sendBeacon("/e", name);
  } catch {
    // 数えられなくても、画面には何も起きない
  }
}
