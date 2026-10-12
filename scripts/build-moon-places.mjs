// 月の地名マップのデータ（web/tour/artemis2/moon-places.json）を、USGS / IAU Gazetteer of Planetary Nomenclature の各ページから作る
//   https://planetarynames.wr.usgs.gov/Feature/<ID>（位置・直径・由来・承認の年・輪郭の WKT）
//   1ページずつ、間をあけて取る（全部で約40ページ。ふだんは動かさない。地名を増やすときだけ）
//   輪郭は USGS のページにも「おおよそ（approximate）」とある。地図の飾りの線として使い、境界の正確さは言わない
//
// 使い方：node scripts/build-moon-places.mjs > web/tour/artemis2/moon-places.json
//
// 日本語の名前（ja）は、公式・公的なページで確認できたものだけ（docs/research/artemis2-lunar-observation-verification.md・C25・C28）
// artemis：アルテミス2号との関係（NASA の観測計画 Lunar Targeting Plan・NASA の写真の説明文）。照合済みのものだけ

const UA = "VOYASCOPE (unofficial fan-made, non-commercial; https://voyascope.org)";
// [英語名, USGS の ID, 日本語名（出典があるものだけ）]
const PLACES = [
  ["Oceanus Procellarum", 4395],
  ["Mare Imbrium", 3678, "雨の海"],
  ["Mare Serenitatis", 3686],
  ["Mare Tranquillitatis", 3691],
  ["Mare Crisium", 3671],
  ["Mare Fecunditatis", 3673],
  ["Mare Nectaris", 3683],
  ["Mare Nubium", 3684],
  ["Mare Humorum", 3677],
  ["Mare Frigoris", 3674],
  ["Mare Vaporum", 3694],
  ["Mare Cognitum", 3670],
  ["Mare Insularum", 3680],
  ["Mare Smythii", 3689],
  ["Mare Marginis", 3681],
  ["Mare Undarum", 3693],
  ["Mare Australe", 3665],
  ["Mare Orientale", 3685, "東の海"],
  ["Mare Moscoviense", 3682],
  ["Mare Ingenii", 3679],
  ["Sinus Iridum", 5565],
  ["Copernicus", 1296],
  ["Tycho", 6163],
  ["Kepler", 2990],
  ["Aristarchus", 380],
  ["Plato", 4757],
  ["Grimaldi", 2252],
  ["Clavius", 1236],
  ["Ptolemaeus", 4860],
  ["Langrenus", 3273],
  ["Theophilus", 5965],
  ["Petavius", 4668],
  ["Archimedes", 350],
  ["Eratosthenes", 1820],
  ["Tsiolkovskiy", 6108],
  ["Korolev", 3090],
  ["Apollo", 326],
  ["Hertzsprung", 2482, "ヘルツシュプルング盆地"],
  ["Vavilov", 6336],
  ["Schrödinger", 5381],
  ["Reiner Gamma", 4987, "ライナーガンマ"],
  ["Glushko", 2195],
  ["Ohm", 4417, "オーム"],
  ["Montes Rook", 4015],
  ["Montes Cordillera", 4008, "コルディレラ山脈"],
];

// アルテミス2号との関係（照合済み）
//   LTP：https://assets.science.nasa.gov/content/dam/science/missions/artemis/ArtemisII_LunarTargetingPlan.pdf（4/5 時点の「計画」）
//   写真：https://www.nasa.gov/gallery/lunar-flyby/ の説明文（docs/research/artemis2-lunar-observation-verification.md §6）
const ARTEMIS = {
  "Reiner Gamma": { why: "NASA の観測計画：高地と海の境目の、明るい渦模様（Set of bright lunar swirls near highland-mare boundary）", photo: "art002e012114" },
  "Mare Orientale": { why: "NASA の観測計画：月でいちばん若い大きな盆地（Youngest large basin on the Moon）。暗い溶融物と明るい輪", photo: "art002e009277" },
  Hertzsprung: { why: "NASA の観測計画：古く崩れた多重の輪の盆地。若いオリエンターレと比べる（Older, degraded multiring basin … to compare with the younger Orientale Basin）", photo: "art002e012093" },
  Vavilov: { why: "NASA の観測計画：中央の山と段になった壁のクレーター（Complex crater with central peak and terraced walls）", photo: "art002e009282" },
  Glushko: { why: "NASA の観測計画：光条の明るいクレーター。Ohm と比べて、光条の変わり方を見る（Crater Duo）" },
  Ohm: { why: "NASA の観測計画：光条のある小さなクレーター。Glushko と比べる（Crater Duo）", photo: "art002e012261" },
  Aristarchus: { why: "NASA の観測計画：火山の地形が多い台地（Aristarchus Plateau）と、明るい Aristarchus クレーター", photo: "art002e012028" },
  Apollo: { why: "NASA の観測計画：昼と夜の境目の近くで、地形・明るさ・色を話し合う（Apollo Basin）" },
  Grimaldi: { why: "NASA の写真の説明文：オリエンターレの北東の、丸く黒い点（Grimaldi crater）", photo: "art002e009278" },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/\s+/g, " ");
const num = (t, k) => {
  const m = t.match(new RegExp(`${k} (-?[\\d.]+)`));
  return m ? Number(m[1]) : null;
};
// 輪郭の点を減らす：輪を等間隔に間引いて、多くても 48 点に（地図の飾りの線なので十分）
function thin(pts, max = 48) {
  if (pts.length <= max) return pts;
  const step = pts.length / max;
  const out = [];
  for (let i = 0; i < max; i++) out.push(pts[Math.floor(i * step)]);
  out.push(pts.at(-1));
  return out;
}

const out = [];
for (const [en, id, ja] of PLACES) {
  const html = await fetch(`https://planetarynames.wr.usgs.gov/Feature/${id}`, { headers: { "User-Agent": UA } }).then((r) => r.text());
  const t = text(html);
  const name = (t.match(/Feature Name (.*?) Clean Name/) ?? [])[1]?.trim();
  if (name !== en) throw new Error(`USGS ${id}: 名前が違う（${name} ≠ ${en}）`);
  const type = (t.match(/Feature Type (.*?) Location/) ?? [])[1]?.trim();
  const after = t.split("Approval Status")[1] ?? "";
  const origin = (after.match(/Origin (.*?) Reference/) ?? [])[1]?.trim() ?? null;
  const year = Number((after.match(/Approval Date (\d{4})/) ?? [])[1]) || null;
  // 輪郭：経度は 0〜360（東経）なので、−180〜180 に直す。四角い枠だけのもの（5点）は使わない
  const wkt = (t.match(/WKT String ((?:MULTI)?POLYGON .*?\)\)\)?)(?= [A-Z][a-z])/) ?? [])[1] ?? "";
  const rings = [...wkt.matchAll(/\(([^()]+)\)/g)]
    .map((m) => m[1].split(",").map((p) => p.trim().split(/\s+/).map(Number)))
    .filter((r) => r.length > 6)
    .map((r) => thin(r.map(([lon, lat]) => [Math.round((((lon + 180) % 360 + 360) % 360 - 180) * 100) / 100, Math.round(lat * 100) / 100])));
  const kind = /^Mare|^Oceanus/.test(type) ? "mare" : /^Sinus/.test(type) ? "sinus" : /^Mons/.test(type) ? "montes" : /^Albedo/.test(type) ? "albedo" : "crater";
  out.push({
    id: en.toLowerCase().replace(/ö/g, "o").replace(/[^a-z]+/g, "_"),
    en,
    ja: ja ?? null,
    kind,
    usgs: id,
    lat: num(t, "Center Latitude"),
    lon: num(t, "Center Longitude"),
    diamKm: num(t, "Diameter"),
    origin,
    year,
    artemis: ARTEMIS[en] ?? null,
    // 海・湾・山脈・明るい模様は USGS の輪郭。クレーターは円で描く（輪郭は円と同じなので持たない）
    rings: kind === "crater" ? [] : rings,
  });
  await sleep(400);
}
process.stdout.write(
  JSON.stringify({
    $comment: "月の地名マップのデータ。scripts/build-moon-places.mjs で USGS / IAU Gazetteer of Planetary Nomenclature の各ページから作った。輪郭はおおよそ（USGS の注記どおり）",
    source: "https://planetarynames.wr.usgs.gov/",
    places: out,
  }) + "\n",
);
