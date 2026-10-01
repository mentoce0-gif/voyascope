// 「いま、どこの上？」：緯度・経度から、国（陸）か海の名前を探す
// データは web/data/places.json（scripts/build-places.mjs が Natural Earth から作る）
// 国は日本の立場の境界。線は約11kmの精度なので、海岸や国境のすぐ近くでは隣の名前になることがある

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function find(list, x, y) {
  for (const f of list) {
    const [x0, y0, x1, y1] = f.b;
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    for (const [outer, ...holes] of f.p) {
      if (inRing(x, y, outer) && !holes.some((h) => inRing(x, y, h))) return f.n;
    }
  }
  return null;
}

// 見つからなければ null（推測で名前を出さない）
export function placeAt(places, lat, lng) {
  if (!places || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const x = ((((lng + 180) % 360) + 360) % 360) - 180;
  const land = find(places.land, x, lat);
  if (land) return { name: land, kind: "land" };
  const sea = find(places.sea, x, lat);
  if (sea) return { name: sea, kind: "sea" };
  return null;
}
