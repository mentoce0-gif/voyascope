// アルテミス2号ツアー：月面の地形を観測する場面の計算（three.js を使わない。tests/artemis2-lunar.test.mjs で確かめる）
// 座標は trajectory.json と同じ（地球中心・km。月の公転面が x-y）。画面の座標への変換は world.js（dir3）で行う。
// 根拠と検証：docs/research/artemis2-lunar-observation-verification.md

export const R_MOON_KM = 1737.4;
const DEG = Math.PI / 180;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const angDeg = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) / DEG;

// 時刻 t（epoch からの秒）の月の軸。trajectory.json の moonFrame（1時間ごと）を補間する
//   x：経度0°・緯度0°の向き、y：東経90°、z：北極
export function moonAxesAt(frame, t) {
  const n = frame.x.length / 3;
  const f = Math.max(0, Math.min(n - 1, t / frame.step));
  const i = Math.min(n - 2, Math.floor(f)), u = f - i;
  const pick = (arr) => [0, 1, 2].map((k) => arr[i * 3 + k] * (1 - u) + arr[(i + 1) * 3 + k] * u);
  const z = unit(pick(frame.z));
  const x0 = pick(frame.x), xz = dot(x0, z);
  const x = unit([x0[0] - z[0] * xz, x0[1] - z[1] * xz, x0[2] - z[2] * xz]);
  return { x, y: cross(z, x), z };
}

// 緯度・経度（USGS：東経が正）→ 月の中心から見た向き
export function surfaceDir(ax, latDeg, lonEastDeg) {
  const cl = Math.cos(latDeg * DEG), la = Math.sin(latDeg * DEG);
  const c = cl * Math.cos(lonEastDeg * DEG), s = cl * Math.sin(lonEastDeg * DEG);
  return [0, 1, 2].map((k) => ax.x[k] * c + ax.y[k] * s + ax.z[k] * la);
}

// ある向き（月の中心から）の緯度・経度
export function latLonOf(ax, v) {
  const u = unit(v);
  return [Math.asin(dot(u, ax.z)) / DEG, Math.atan2(dot(u, ax.y), dot(u, ax.x)) / DEG];
}

// 地形の見え方。craft・moon：位置（km）、sunDir：太陽への向き（単位ベクトル。数時間ではほとんど変わらない）
//   e：出射角（法線とオリオンへの向き。90°以上は月の向こう側）
//   i：入射角（法線と太陽への向き。90°以上は夜）
//   distKm：オリオンからの距離、angDiamDeg：直径の見かけの角度（正面から見たとき）
export function observe(target, ax, craft, moon, sunDir) {
  const n = surfaceDir(ax, target.latDeg, target.lonEastDeg);
  const p = [0, 1, 2].map((k) => moon[k] + n[k] * R_MOON_KM);
  const toO = [0, 1, 2].map((k) => craft[k] - p[k]);
  const distKm = Math.hypot(...toO);
  return {
    n,
    p,
    e: angDeg(n, toO),
    i: angDeg(n, sunDir),
    distKm,
    angDiamDeg: target.diameterKm / distKm / DEG,
  };
}

// 照準を出してよいか（設計：日照・遮蔽・視野・画素の大きさを満たす場面だけ）
//   o：observe() の結果、screen：{ inView（画面の中で、ふちから離れている）, diamPx（画面の上の直径） }
export const GATE = { maxEmission: 75, maxIncidence: 88, minDiamPx: 18 };
export function gate(target, o, screen) {
  if (target.status !== "VERIFIED") return { ok: false, why: "unverified" };
  if (!(o.e < 90)) return { ok: false, why: "far-side" };
  if (!(o.e < GATE.maxEmission)) return { ok: false, why: "too-oblique" };
  if (!(o.i < GATE.maxIncidence)) return { ok: false, why: "night" };
  if (!screen.inView) return { ok: false, why: "off-screen" };
  if (!(screen.diamPx >= GATE.minDiamPx)) return { ok: false, why: "too-small" };
  return { ok: true, why: "" };
}

// 観測する地形（位置は USGS / IAU Gazetteer。事実は NASA の写真の説明文・NASA の解説から）
//   status：VERIFIED＝照準を出してよい／FALLBACK＝位置を指さない情報カードだけ／HIDDEN＝出さない
//   画面に出すのは「情報」だけ（文の説明はしない。2026-10-11 オーナー）。facts の1行が1つの事実
//   日本語の呼び方：JAXA の公式ページの表記があるものだけ（ja。C25 を照合）。盆地は JAXA の表記が「オリエンタル盆地」「オリエンターレ盆地」
//   「オリエンタレ・ベイスン」と揺れているので、2009 年の画像ギャラリーの「オリエンターレ盆地」（https://www.kaguya.jaxa.jp/ja/new/new2009_j.htm）を使う
//   fov：[景色の画角, 見つけるときの画角]（縦の画角。度）
//   origin：名前の由来（USGS の各ページの Origin。承認の年は Approval Date）。地名は「」で囲んで、どこまでが名前か分かるように
//   research：その地形での研究・探査（C26 を公式ページで照合したものだけ。予定は「計画」と書く）
//   log：NASA の観測計画（Lunar Targeting Plan。4/5 時点の「計画」）にあるか（planned）と、
//        NASA の写真の説明文がその地形の名前を出しているか（photographed）。「撮影された」は写真があること。観測の中身の評価ではない
//        計画：https://assets.science.nasa.gov/content/dam/science/missions/artemis/ArtemisII_LunarTargetingPlan.pdf
//   zoom：拡大図（CGI Moon Kit の 16K の地図から切り出したもの。web/assets/moon/）
export const TARGETS = [
  {
    id: "reiner_gamma",
    en: "Reiner Gamma",
    ja: "ライナーガンマ", // JAXA の表記（https://www.selene.jaxa.jp/ja/new/new2009_j.htm「「かぐや」HDTVによるライナーガンマ」。C25 を照合）
    status: "VERIFIED",
    latDeg: 7.39,
    lonEastDeg: -58.96,
    diameterKm: 73.44,
    fov: [11, 5.5],
    usgs: "https://planetarynames.wr.usgs.gov/Feature/4987",
    // NASA の写真 art002e012114 の説明文「The sinuous Reiner Gamma swirl contrasts with the darker mare surface」
    // 近くのクレーター：NASA のポッドキャスト「And it was renamed Reiner Gamma, for the nearby Reiner impact crater.」
    origin: "近くの「Reiner」クレーターにちなむ（NASA）· その名はイタリアの天文学者・数学者 Vincentio Reinieri（?–1648）· IAU 承認 1935（USGS）",
    facts: ["明るい渦模様（swirl）· 約73 km（USGS）", "暗い海のなか（NASA）", "クレーターではなく、明るさの模様（USGS の分類）· 月にしかない（NASA）"],
    // 研究（C26 を照合：voyascope-research の research/verification/2026-10-11-c26.md）。形成の原因は断定しない
    //   LRO：https://science.nasa.gov/photojournal/reiner-gamma/（2010）・局所的な磁場：https://science.nasa.gov/image-detail/20100521/
    //   Lunar Vertex：https://science.nasa.gov/lunar-science/clps-deliveries/cp-11/（計画。年はページの本文で確認できず、出さない）
    research: ["LRO が撮影（NASA・2010）", "局所的な磁場がある · できかたは研究中（NASA）", "Lunar Vertex：着陸して磁場と太陽風を調べる計画（NASA）"],
    // 拡大図：CGI Moon Kit の lroc_color_16bit_srgb_16k.tif（1画素 約0.67 km）から、中心のまわり 300×300 画素（幅約200 km）を切り出し、
    // 明るさの幅を少し広げて（autocontrast を 45% だけ混ぜる）224×224 の WebP にした（docs/research/artemis2-lunar-observation-verification.md §12）
    zoom: { file: "reiner-gamma-zoom-224.webp", alt: "Reiner Gamma の拡大。暗い海のなかに、明るい渦模様（幅約200 kmの範囲）", caption: "拡大 · 幅200 km · NASA SVS" },
    link: "https://www.nasa.gov/image-detail/amf-art002e012114/",
    log: { planned: true, photographed: true },
  },
  {
    id: "mare_orientale",
    en: "Mare Orientale",
    ja: "東の海", // JAXA「かぐや」の成果のページの表記（https://www.kaguya.jaxa.jp/ja/science/result_of_kaguya_j_info_201401.htm）
    status: "VERIFIED",
    latDeg: -19.87,
    lonEastDeg: -94.67,
    diameterKm: 294.16,
    fov: [12, 8.5],
    usgs: "https://planetarynames.wr.usgs.gov/Feature/3685",
    // 盆地全体（Orientale basin）の位置ではない。照準は、まんなかの暗いところ（Mare Orientale）だけを指す
    // 「海」は溶岩：NASA Moon Facts（https://science.nasa.gov/moon/facts/）「The dark features, called maria (Latin for seas), are impact basins that were filled with lava」
    // NASA の写真 art002e009277 の説明文「Orientale basin is visible in the center, with a black patch of ancient lava in the center」「This 600-mile-wide impact crater」（2:19 p.m. EDT 撮影）
    // 山の輪：art002e009278「wrapped in rings of mountains」
    origin: "ラテン語で「東の海」（Eastern sea）· IAU 承認 1964（USGS）",
    // 盆地：https://science.nasa.gov/moon/lunar-craters/the-explosive-history-of-orientale-basin/「formed about 3.8 billion years ago」
    //       https://science.nasa.gov/photojournal/orientale-basin/「The distinct outer ring is about 950 kilometers (590 miles) from east-to-west」
    facts: ["海（mare）· 直径 294 km（USGS）", "溶岩の平原（NASA）", "まわりの山の輪とあわせて「オリエンターレ盆地」（Orientale basin）· 外側の輪 東西約950 km（NASA）", "約38億年前の衝突でできた（NASA）"],
    // 研究（C26 を照合）：GRAIL https://science.nasa.gov/photojournal/grail-gravity-map-of-orientale-basin/（2016 公開）
    //   かぐや https://www.kaguya.jaxa.jp/ja/science/result_of_kaguya_j_info_201401.htm（2014）
    //   アルテミス2号 https://science.nasa.gov/feature/artemis-ii-preliminary-lunar-science-report/（2026年10月）
    research: ["GRAIL：重力の地図（NASA・2016 公開）", "かぐや：輪の高さと直径を計測（JAXA・2014）", "アルテミス2号の写真を LRO の地図に重ねた（NASA・2026年10月）"],
    link: "https://www.nasa.gov/image-detail/amf-art002e009277/",
    log: { planned: true, photographed: true }, // 計画の名前は「Orientale Basin」
  },
  {
    id: "hertzsprung",
    en: "Hertzsprung",
    ja: "ヘルツシュプルング盆地", // JAXA「かぐや」の成果のページの表記（https://www.selene.jaxa.jp/ja/science/RSAT/Farside_Gravity_Field_j.htm）
    status: "FALLBACK", // 中心は USGS で確認済み。2K の地図ではうすく、見えるとは言えないので、位置は指さない
    latDeg: 1.37,
    lonEastDeg: -128.66,
    diameterKm: 536.37,
    usgs: "https://planetarynames.wr.usgs.gov/Feature/2482",
    // NASA の写真 art002e012093「Hertzsprung Basin comes into view with its distinctive two concentric rings of mountains」
    // NASA の観測計画（Lunar Targeting Plan）の説明「Older, degraded multiring basin on the lunar farside to compare with the younger Orientale Basin」
    origin: "デンマークの天文学者 Ejnar Hertzsprung（1873–1967）· IAU 承認 1970（USGS）",
    facts: ["盆地 · 直径 536 km（USGS）", "2重の山の輪（NASA）", "「オリエンターレ盆地」より古い（NASA）"],
    // 研究（C26 を照合）：LRO https://science.nasa.gov/photojournal/hertzsprung-constellation-site/
    //   かぐや https://www.selene.jaxa.jp/ja/science/RSAT/Farside_Gravity_Field_j.htm（2009）
    research: ["LRO：内側の輪の岩（斜長岩とみられる）を撮影（NASA）", "かぐや：裏側の重力の地図（JAXA・2009）"],
    link: "https://www.nasa.gov/image-detail/amf-art002e012093/",
    log: { planned: true, photographed: true }, // 計画の名前は「Hertzsprung Basin」
  },
];

// 観測の場面の時間（UTC）。どれも、その地形が見えて照らされている時間のなか（tests/artemis2-lunar.test.mjs で確かめる）
//   検証：docs/research/artemis2-lunar-observation-verification.md §5（Reiner Gamma は 20:46、Mare Orientale は 22:10 まで見やすい）
//   Mare Orientale の時間は、NASA の写真 art002e009279（3:41 p.m. EDT＝19:41 UTC。オリエンターレ盆地の輪）の時刻をふくむ
export const OBSERVE_WINDOWS = {
  reiner_gamma: ["2026-04-06T17:45:00Z", "2026-04-06T18:25:00Z"],
  mare_orientale: ["2026-04-06T18:25:00Z", "2026-04-06T19:50:00Z"],
};

// 観測の記録（NASA の観測計画 → NASA の写真）。地形のほかに、計画にあった出来事も
//   地球の入り：計画「Earthset」、写真 art002e021219（6:41 p.m. EDT）
//   地球の出：計画「Earthrise」、写真（NASA の発表 https://www.nasa.gov/news-release/nasas-artemis-ii-crew-beams-official-moon-flyby-photos-to-earth/ 7:22 p.m. EDT）
//   日食：計画「Sunset」（As the sun is eclipsed by the Moon）、写真（同じ発表）
export const OBS_LOG = [
  ...TARGETS.map((x) => ({ name: x.ja ?? x.en, planned: x.log.planned, photographed: x.log.photographed })),
  { name: "地球の入り", planned: true, photographed: true },
  { name: "地球の出", planned: true, photographed: true },
  { name: "日食", planned: true, photographed: true },
];
