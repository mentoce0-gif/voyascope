// 機体の「状態」（運用中かどうか・止まっている／止まる予定か）をまとめる。
// - カードの status：公式ページで確認した運用の状態（出典つき）
// - 自動取得の運用状況（いまはみちびきだけ）：web/data/status/<id>.json（scripts/fetch-status.mjs）
// 時刻は観測時刻ではなく、実際の今（運用状況は「いま」の情報なので）

export const STATUS_LABELS = { operating: "運用中", standby: "待機中", ended: "運用終了" };

// サービス名の日本語（出典：https://qzss.go.jp/overview/services/index.html）。ないものは略号のまま出す
export const QZSS_SERVICE_JA = {
  PNT: "衛星測位サービス",
  SLAS: "サブメータ級測位補強サービス",
  CLAS: "センチメータ級測位補強サービス",
  "MADOCA-PPP": "高精度測位補強サービス",
  "Q-ANPI": "衛星安否確認サービス",
};
export const serviceJa = (code) => QZSS_SERVICE_JA[code] ?? code;

// これより古い取得は「しばらく取得できていない」とみなす（自動取得は6時間ごと、変化がなくても1日1回は書き換える）
export const STALE_MS = 36 * 60 * 60 * 1000;

const KIND_JA = { forecast: "予定された停止", unplanned: "予期せぬ停止", resumed: "再開", other: "お知らせ" };

// NAQU の種類の先頭（PNT_FCSTDV → PNT）がサービス
const noticeService = (n) => String(n.type ?? "").split("_")[0];

export function summarizeStatus(card, live, now = new Date()) {
  const base = card.status?.value ? { value: card.status.value, label: STATUS_LABELS[card.status.value] ?? card.status.value } : null;
  if (!live) return { base, live: null, badge: null };

  const t = now.getTime();
  // 終わっていないお知らせだけ（「再開」は出さない）
  const notices = live.notices
    .filter((n) => n.kind !== "resumed" && (!n.stop || Date.parse(n.stop) > t))
    .map((n) => ({
      number: n.number,
      kind: n.kind,
      kindJa: KIND_JA[n.kind] ?? KIND_JA.other,
      code: noticeService(n),
      service: serviceJa(noticeService(n)),
      start: n.start ? new Date(n.start) : null,
      stop: n.stop ? new Date(n.stop) : null,
      active: !n.start || Date.parse(n.start) <= t,
    }))
    .sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0));

  // サービスごとに：どれか1つでも X なら停止中（同じサービスで信号が複数ある）。
  // 表を取得したあとで停止期間に入ったお知らせも、停止中として扱う
  const byService = new Map();
  for (const s of live.services) {
    const prev = byService.get(s.service);
    byService.set(s.service, { code: s.service, ok: (prev?.ok ?? true) && s.ok });
  }
  const activeCodes = new Set(notices.filter((n) => n.active).map((n) => n.code));
  const services = [...byService.values()].map((s) => ({
    ...s,
    ok: s.ok && !activeCodes.has(s.code),
    ja: serviceJa(s.code),
  }));
  const down = services.filter((s) => !s.ok);

  const stale = t - Date.parse(live.fetched_at) > STALE_MS;
  const badge = down.length || notices.some((n) => n.active) ? "停止中" : notices.length ? "停止予定" : null;
  return {
    base,
    live: {
      services,
      down,
      notices,
      stale,
      source: live.source,
      sourceLabel: live.source_label,
      pageUpdated: live.page_updated,
      fetchedAt: new Date(live.fetched_at),
    },
    badge,
  };
}
