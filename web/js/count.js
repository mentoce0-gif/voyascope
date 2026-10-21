// アクセスを数える（2026-10-21 オーナー：案A。サーバ側は src/count.js）。
// 外から来て開いたときだけ、1回「ページの道・来た元のドメイン名・投稿の目印（?s=）」を送る。
// サイトの中の移動・再読み込み・戻る／進むは数えない。Cookie は使わず、利用者を見分ける ID も作らない。
// オーナーの端末は、一度 ?me=1 を開くと数えない（?me=0 で元に戻す）。印はその端末のブラウザにだけ残る
(function () {
  if (location.hostname !== "voyascope.org") return;
  var q = new URLSearchParams(location.search);
  try {
    if (q.get("me") === "1") localStorage.setItem("voyascope:nocount", "1");
    if (q.get("me") === "0") localStorage.removeItem("voyascope:nocount");
    if (localStorage.getItem("voyascope:nocount")) return;
  } catch (e) {}
  var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
  if (nav && nav.type !== "navigate") return;
  var ref = "";
  try {
    ref = document.referrer ? new URL(document.referrer).hostname : "";
  } catch (e) {}
  if (ref === location.hostname) return;
  var body = JSON.stringify({ p: location.pathname, r: ref, s: q.get("s") || "" });
  if (!(navigator.sendBeacon && navigator.sendBeacon("/api/hit", body))) {
    fetch("/api/hit", { method: "POST", body: body, keepalive: true }).catch(function () {});
  }
})();
