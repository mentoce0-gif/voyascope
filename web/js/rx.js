// 詳細の名前の横の「受信」：この機体の新しい軌道データを、最近受け取れているか（2026-10-26 オーナー）
// 取得は6時間ごと（update-orbits）。新しいデータが来たときだけ fetched_at が進む。時刻は観測時刻ではなく、いまの本当の時刻で見る
export const RX_NEW_H = 7; // 直近の取得（6時間ごと）で受け取った：光ってちらつく
export const RX_OFF_H = 48; // これより長く新しいデータが来ていない：消える

export function rxState(fetchedAt, now = new Date()) {
  const t = Date.parse(fetchedAt ?? "");
  if (!Number.isFinite(t)) return { state: "off", hours: null };
  const hours = Math.max(0, (now.getTime() - t) / 3600000);
  return { state: hours <= RX_NEW_H ? "new" : hours <= RX_OFF_H ? "on" : "off", hours };
}

const agoJa = (h) => (h < 1 ? "1時間以内" : h < 48 ? `${Math.floor(h)}時間前` : `${Math.floor(h / 24)}日前`);

export function rxHtml(fetchedAt, now = new Date()) {
  const { state, hours } = rxState(fetchedAt, now);
  const label = state === "off" ? "受信なし" : "受信";
  const ago = hours == null ? "--" : agoJa(hours);
  const say =
    state === "off"
      ? `受信なし：新しい軌道データが${hours == null ? "ありません" : `${ago}から来ていません`}（CelesTrak）`
      : `受信：${ago}に新しい軌道データを受け取りました（CelesTrak）`;
  return `<div class="rx rx-${state}" role="img" aria-label="${say}" title="${say}">
    <svg class="rx-icon" viewBox="0 0 24 24" aria-hidden="true"><path class="rx-w2" d="M4.2 4.6a10.5 10.5 0 0 0 0 14.8M19.8 4.6a10.5 10.5 0 0 1 0 14.8"/><path class="rx-w1" d="M7.4 7.8a6 6 0 0 0 0 8.4M16.6 7.8a6 6 0 0 1 0 8.4"/><circle cx="12" cy="12" r="2.2"/></svg>
    <span class="rx-text"><span class="rx-label">${label}</span><span class="rx-ago mono">${ago}</span></span>
  </div>`;
}
