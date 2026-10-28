// 空の家族分け（docs/sky-families.md の「仲間分け」）。色は強さではない
// 色は 2026-10-28 の配色（オーナー）：機体は落ち着いた青。測位（みちびきなど）は白、通信の帯は灰。琥珀は警告だけに使うので、有人にも使わない
// 「予定」は機体ではなく射場のピン（打ち上げの予定）。地球の上の表示を切り替えるためだけの家族
export const FAMILIES = [
  { id: "crewed", label: "有人", color: "#5c9dff", classes: ["crewed_station", "crewed_vehicle"] },
  { id: "science", label: "気象・科学", color: "#5c9dff", classes: ["science", "earth_observation", "weather"] },
  { id: "navigation", label: "測位", color: "#f3f6fc", classes: ["navigation"] },
  { id: "band", label: "通信の帯", color: "#8a97a6", classes: ["communication"] },
  { id: "planned", label: "予定", color: "#5c9dff", classes: [] },
  { id: "other", label: "その他", color: "#5c9dff", classes: ["technology", "other"] },
];

export function familyOf(cls) {
  return FAMILIES.find((f) => f.classes.includes(cls)) ?? FAMILIES.find((f) => f.id === "other");
}
