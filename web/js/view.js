// 表示切替：地球と一覧に出すものを「すべて／日本のみ／衛星のみ／打ち上げ予定のみ」で切り替える（2026-10-02 オーナー）
// 日本の決め方（事実だけで決める）
// - 機体：カードの「運用」（出典つき）に日本の機関が入っている。ISS は JAXA が入っているので日本に入る
// - 公式の予定：regions に japan がある
// - 世界の打ち上げ（参考）：射場が日本にある

export const VIEW_MODES = [
  { id: "all", label: "すべて", short: "すべて" },
  { id: "japan", label: "日本のみ", short: "日本" },
  { id: "craft", label: "衛星のみ", short: "衛星" },
  { id: "launches", label: "打ち上げ予定のみ", short: "打ち上げ" },
];
export const DEFAULT_VIEW = "all";
const IDS = new Set(VIEW_MODES.map((m) => m.id));
export const isViewMode = (id) => IDS.has(id);

// カードの「運用」に出てくる日本の機関（名前の一部で照合する）
const JAPAN_ORGS = ["JAXA", "宇宙航空研究開発機構", "気象庁", "内閣府", "環境省", "国立環境研究所", "国立天文台", "文部科学省", "情報通信研究機構", "NICT"];

export function isJapanCraft(card) {
  const v = card?.operator?.value;
  const names = Array.isArray(v) ? v : v ? [v] : [];
  return names.some((n) => JAPAN_ORGS.some((o) => String(n).includes(o)));
}
export const isJapanEvent = (ev) => (ev?.regions ?? []).includes("japan");
export const isJapanLaunch = (l) => l?.site?.country === "JPN";

// それぞれの表示で出すか
export const showsCraft = (mode, card) => mode !== "launches" && (mode !== "japan" || isJapanCraft(card));
export const showsEvent = (mode, ev) => mode !== "craft" && (mode !== "japan" || isJapanEvent(ev));
export const showsLaunch = (mode, l) => mode !== "craft" && (mode !== "japan" || isJapanLaunch(l));

// 選んだ表示はブラウザにだけ覚える（読めなくても動く）
const KEY = "voyascope.view";
export function loadView() {
  try {
    const v = localStorage.getItem(KEY);
    return isViewMode(v) ? v : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}
export function saveView(id) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // 保存できなくても、その場の表示は切り替わる
  }
}
