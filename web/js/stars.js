// 背景の星空（地球のまわりの「宇宙」）
// 画像ファイルは使わず、ブラウザの中で描く。星の位置は飾りで、実際の星座ではない
// 球に貼る正距円筒図法の画像なので、星が球の上で均一に散らばるように緯度を選び、極に近いほど横に伸ばして描く

// 毎回同じ星空になるように、決まった種から乱数を作る
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 星の色：ほとんどは白、少しだけ青白・黄・橙
const TINTS = [
  [255, 255, 255],
  [255, 255, 255],
  [255, 255, 255],
  [205, 222, 255],
  [255, 236, 200],
  [255, 208, 170],
];

export function starfieldDataUrl({ width = 4096, height = 2048, count = 9000, seed = 20261001, base = "#050d1f" } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);
  const rand = seeded(seed);
  for (let i = 0; i < count; i++) {
    const lat = Math.asin(2 * rand() - 1); // 球の上で均一
    const x = rand() * width;
    const y = ((Math.PI / 2 - lat) / Math.PI) * height;
    // 明るさ：暗い星が多く、明るい星は少ない
    const b = Math.pow(rand(), 3.2);
    const r = 0.3 + b * 1.05;
    const alpha = 0.18 + b * 0.82;
    const [cr, cg, cb] = TINTS[Math.floor(rand() * TINTS.length)];
    const stretch = Math.min(6, 1 / Math.max(0.05, Math.cos(lat)));
    ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * stretch, r, 0, 0, Math.PI * 2);
    ctx.fill();
    // 明るい星だけ、ほんのり光のにじみ
    if (b > 0.8) {
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, 0.06)`;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 2.6 * stretch, r * 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas.toDataURL("image/png");
}
