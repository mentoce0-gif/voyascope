// 空の家族分け（docs/sky-families.md の「仲間分け」）。色は強さではない
// 「予定」は機体ではなく射場のピン（打ち上げの予定）。地球の上の表示を切り替えるためだけの家族
export const FAMILIES = [
  { id: "crewed", label: "有人", color: "#ffb547", classes: ["crewed_station", "crewed_vehicle"] },
  { id: "science", label: "気象・科学", color: "#4fd6d0", classes: ["science", "earth_observation", "weather"] },
  { id: "navigation", label: "測位", color: "#eef3f6", classes: ["navigation"] },
  { id: "band", label: "通信の帯", color: "#8a97a6", classes: ["communication"] },
  { id: "planned", label: "予定", color: "#5ef2c2", classes: [] },
  { id: "other", label: "その他", color: "#b9a6ff", classes: ["technology", "other"] },
];

export function familyOf(cls) {
  return FAMILIES.find((f) => f.classes.includes(cls)) ?? FAMILIES.find((f) => f.id === "other");
}
