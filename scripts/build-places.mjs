// 「いま、どこの上？」に使う地名データ（web/data/places.json）を Natural Earth から作る。
// 普段は使わない（生成済みのファイルをコミットしている）。作り直すときだけ: node scripts/build-places.mjs
//
// - Natural Earth はパブリックドメイン（https://www.naturalearthdata.com/about/terms-of-use/）
// - 国は「日本の立場（worldview: JPN）」の版を使う。北方領土は日本、クリミアはウクライナなど、日本政府の見方に沿う
//   この版は 1:10m しかないので、線を間引いて軽くする
// - 海は 1:50m の海洋・海域（marine polys）。日本語名（name_ja）を使う
// - 版は v5.1.2 に固定（勝手に中身が変わらないように）

import { writeFileSync } from "node:fs";

const BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson";
const SOURCES = {
  land: `${BASE}/ne_10m_admin_0_countries_jpn.geojson`,
  sea: `${BASE}/ne_50m_geography_marine_polys.geojson`,
};
const TOLERANCE = 0.1; // 度。約11km。地名を当てるには十分（座標も0.1度に丸める）
// 表示名の差し替え（オーナー判断）。データの日本語名をそのまま使わないものだけ
const RENAME = { 中華民国: "台湾" };

// 線の間引き（Douglas–Peucker）
function simplify(points, tol) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let maxD = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      // 閉じた線（始点＝終点）のときは、始点からの距離で比べる
      const d = len < 1e-12 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round = (v) => Math.round(v * 10) / 10;
const polygonsOf = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);

function compact(features, nameOf) {
  const out = [];
  for (const f of features) {
    const name = nameOf(f.properties);
    if (!name || !f.geometry) continue;
    const polys = [];
    for (const poly of polygonsOf(f.geometry)) {
      const thin = (ring) => simplify(ring, TOLERANCE).map(([x, y]) => [round(x), round(y)]);
      // 外側の線が間引きでつぶれる小さな島は捨てる（穴だけが残らないように、外側から判断する）
      const outer = thin(poly[0]);
      if (outer.length < 4) continue;
      polys.push([outer, ...poly.slice(1).map(thin).filter((ring) => ring.length >= 4)]);
    }
    // 小さな国（島国など）が丸ごと消えないように、いちばん大きい島を四角で残す
    if (!polys.length) {
      const ring = polygonsOf(f.geometry)
        .map((poly) => poly[0])
        .sort((r1, r2) => r2.length - r1.length)[0];
      if (!ring) continue;
      const [x0, y0, x1, y1] = [Math.min(...ring.map((q) => q[0])), Math.min(...ring.map((q) => q[1])), Math.max(...ring.map((q) => q[0])), Math.max(...ring.map((q) => q[1]))].map(round);
      polys.push([[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]);
    }
    const xs = polys.flatMap((p) => p[0].map((q) => q[0]));
    const ys = polys.flatMap((p) => p[0].map((q) => q[1]));
    out.push({ n: RENAME[name] ?? name, b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], p: polys });
  }
  return out;
}

const get = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.json()).features;
};

const land = compact(await get(SOURCES.land), (p) => p.NAME_JA);
const sea = compact(await get(SOURCES.sea), (p) => p.name_ja);
const json = JSON.stringify({
  source: "Natural Earth v5.1.2（パブリックドメイン）。国は worldview: JPN の 1:10m、海は 1:50m。線を約11km（0.1度）の精度に間引いた",
  sources: SOURCES,
  land,
  sea,
});
writeFileSync("web/data/places.json", json);
console.log(`land: ${land.length}, sea: ${sea.length}, ${Math.round(json.length / 1024)} KB`);
