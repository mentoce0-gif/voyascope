// ミニ地図の陸地（計算済みの SVG の path）を作る：web/data/land-110m.geojson → web/data/land-minimap.json
// 陸地の GeoJSON（web/data/land-110m.geojson）を作り直したときだけ実行する。最新かどうかは npm test で確かめる
//   node scripts/build-minimap-land.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { LAND_SOURCE, LAND_OUTPUT, landMinimapJson } from "./lib/minimap-land.mjs";

const json = landMinimapJson(JSON.parse(readFileSync(LAND_SOURCE, "utf8")));
writeFileSync(LAND_OUTPUT, json);
console.log(`${LAND_OUTPUT} を書き出しました（${(json.length / 1024).toFixed(0)}KB）`);
