// ミニ地図（web/js/minimap.js）の陸地を、SVG の path 文字列にする
// 画面で毎回計算すると、432KB の GeoJSON を読むことになる。前もって作っておき、画面は計算済みの文字列だけを読む
// （scripts/build-minimap-land.mjs → web/data/land-minimap.json）

// 正距円筒図法（横360×縦180）。画面のミニ地図と同じ式を使う
import { minimapX as x, minimapY as y } from "../../web/js/minimap.js";

export function landPath(geojson) {
  const rings = [];
  for (const f of geojson.features) {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const poly of polys) {
      const outer = poly[0];
      // 細かすぎる点は間引く（ミニ地図なので 1° 未満の差は見えない）
      let d = "";
      let last = null;
      for (const [lng, lat] of outer) {
        const px = x(lng);
        const py = y(lat);
        const key = `${Math.round(lng)},${Math.round(lat)}`;
        if (key === last) continue;
        last = key;
        d += `${d ? "L" : "M"}${px} ${py}`;
      }
      if (d) rings.push(d + "Z");
    }
  }
  return rings.join("");
}

export const LAND_SOURCE = "web/data/land-110m.geojson";
export const LAND_OUTPUT = "web/data/land-minimap.json";

export function landMinimapJson(geojson) {
  return (
    JSON.stringify({
      $comment: "scripts/build-minimap-land.mjs が web/data/land-110m.geojson から作る。手で編集しない。",
      d: landPath(geojson),
    }) + "\n"
  );
}
