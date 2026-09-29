// world-atlas の countries-110m（Natural Earth 1:110m）から、陸地のドット表示用 GeoJSON（web/data/land-110m.geojson）を作る。
// 普段は使わない（生成済みのファイルをコミットしている）。作り直すときだけ次を実行する:
//   npm install --no-save world-atlas@2 topojson-client@3 h3-js@4
//   node scripts/build-land.cjs > web/data/land-110m.geojson
// - 国名などの属性は使わないので捨てる
// - 点がすべて同じ位置にある「つぶれた」多角形は h3 の計算で失敗するので除く
const topo = require("topojson-client");
const world = require("world-atlas/countries-110m.json");
const h3 = require("h3-js");
const distinct = (ring) => new Set(ring.map((p) => p.join(","))).size;
const features = [];
let dropped = 0;
for (const f of topo.feature(world, world.objects.countries).features) {
  if (!f.geometry) continue;
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const ok = polys.filter((p) => distinct(p[0]) >= 3 || (dropped++, false));
  for (const p of ok) h3.polygonToCells(p, 3, true); // 失敗したらここで止まる
  if (ok.length) features.push({ type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: ok } });
}
process.stdout.write(JSON.stringify({ type: "FeatureCollection", features }));
console.error(`features: ${features.length}, dropped degenerate polygons: ${dropped}`);
