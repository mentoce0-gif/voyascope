// 空の家族分け（docs/sky-families.md の「仲間分け」）。色は強さではない
export const FAMILIES = [
  { id: "crewed", label: "有人", color: "#ffb547", classes: ["crewed_station", "crewed_vehicle"] },
  { id: "science", label: "気象・科学", color: "#4fd6d0", classes: ["science", "earth_observation", "weather"] },
  { id: "navigation", label: "測位", color: "#eef3f6", classes: ["navigation"] },
  { id: "band", label: "通信の帯", color: "#8a97a6", classes: ["communication"] },
  { id: "other", label: "その他", color: "#b9a6ff", classes: ["technology", "other"] },
];

export function familyOf(cls) {
  return FAMILIES.find((f) => f.classes.includes(cls)) ?? FAMILIES[FAMILIES.length - 1];
}
