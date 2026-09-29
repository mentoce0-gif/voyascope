// 地上軌跡のミニ地図（正距円筒図法。横360×縦180 の SVG）
const x = (lng) => (lng + 180).toFixed(1);
const y = (lat) => (90 - lat).toFixed(1);

// 陸地の GeoJSON を SVG の path 文字列にする（最初に1回だけ）
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

export function renderMinimap(svg, { land, segments, pos }) {
  const past = [];
  const future = [];
  for (const seg of segments) {
    // 過去と未来で線を分ける（境目の点は両方に入れて途切れないように）
    let cur = null;
    for (const p of seg) {
      const bucket = p.past ? past : future;
      if (cur !== bucket) {
        const prev = cur?.at(-1)?.at(-1);
        cur = bucket;
        cur.push(prev ? [prev] : []);
      }
      cur.at(-1).push(p);
    }
  }
  const line = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.lng)} ${y(p.lat)}`).join("");
  svg.innerHTML = `
    <rect x="0" y="0" width="360" height="180" class="mm-sea"/>
    <path d="M0 90H360M180 0V180" class="mm-grid"/>
    <path d="${land}" class="mm-land"/>
    ${past.filter((s) => s.length > 1).map((s) => `<path d="${line(s)}" class="mm-past"/>`).join("")}
    ${future.filter((s) => s.length > 1).map((s) => `<path d="${line(s)}" class="mm-future"/>`).join("")}
    ${pos ? `<circle cx="${x(pos.lng)}" cy="${y(pos.lat)}" r="4" class="mm-now"/>` : ""}
  `;
}
