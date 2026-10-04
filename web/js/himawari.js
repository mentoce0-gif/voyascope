// ひまわり9号の最新の画像（気象衛星センター「ひまわりリアルタイム画像」の日本付近・赤外）
// 利用条件：出典を書けば利用できる（https://www.data.jma.go.jp/mscweb/ja/general/note.html）。加工しない
// ファイル名は10分ごとの時刻（UTC）で、1日ごとに上書きされる。新しい画像は約15分後に出るので、
// 40分前の枠を使う（まだ上書きされていない前日の画像を「いま」として出さないため）
export const HIMAWARI_PAGE = "https://www.data.jma.go.jp/mscweb/data/himawari/";
const LAG_MIN = 40;
const pad = (n) => String(n).padStart(2, "0");

export function himawariImage(now = new Date()) {
  const slot = Math.floor((now.getTime() - LAG_MIN * 60000) / 600000) * 600000;
  const d = new Date(slot);
  return {
    url: `${HIMAWARI_PAGE}img/jpn/jpn_b13_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}.jpg`,
    // 気象衛星センターの一覧では、ファイル名の10分後の時刻が画像の時刻
    observed: new Date(slot + 600000),
  };
}

// 日本時間の「時:分」
export function hmJstOf(d) {
  const j = new Date(d.getTime() + 9 * 3600000);
  return `${j.getUTCHours()}:${pad(j.getUTCMinutes())}`;
}
