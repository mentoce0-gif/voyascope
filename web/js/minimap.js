// 地上軌跡のミニ地図（正距円筒図法。横360×縦180 の SVG）
// 陸地の線（scripts/lib/minimap-land.mjs）も、この式で前もって作る
const x = (lng) => (lng + 180).toFixed(1);
const y = (lat) => (90 - lat).toFixed(1);
export { x as minimapX, y as minimapY };

// land：陸地の path 文字列（data/land-minimap.json。scripts/build-minimap-land.mjs が前もって作る）。
// 届く前は空文字（海と軌跡だけを描き、届いたら描き直す）
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
