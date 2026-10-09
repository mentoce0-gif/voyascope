// アルテミス2号ツアーの通り道を、NASA が公開した飛行の軌道データ（エフェメリス）から作る
//   出典：NASA「Track NASA's Artemis II Mission in Real Time」のページの all-artemis-ii-oem-files.zip
//   https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/
//   （ページに「物理モデル・アニメーション・可視化・追跡アプリなどを作るのに使える」とある。2026-10-09 オーナー了承）
//   使うのは、ZIP の中の Artemis_II_OEM_2026_04_10_Post-ICPS-Sep-to-EI.asc（ICPS 分離後〜大気圏突入、2026-04-10 作成）
//
// 使い方：node scripts/artemis2-trajectory.mjs <.asc のパス> > web/tour/artemis2/trajectory.json
//   ZIP はリポジトリに入れない（必要なときにページから取り直す）
//
// 書き出すもの（単位：秒・km）
//   - 時刻は、データの始まり（epoch）からの秒
//   - 座標は地球中心。月の公転面（最接近のときの月の位置と速さで決める）を x-y、北を z にした向き
//   - 月と太陽の位置は Astronomy Engine（web/vendor/astronomy.min.js）で計算
//   - 地球の向き（北極と、グリニッジの向き）も同じ座標で出す（地球の自転を本物の時刻に合わせるため）
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const A = createRequire(import.meta.url)("../web/vendor/astronomy.min.js");
const AU = A.KM_PER_AU;

const file = process.argv[2];
if (!file) {
  console.error("使い方：node scripts/artemis2-trajectory.mjs <OEM の .asc>");
  process.exit(1);
}
const text = readFileSync(file, "utf8");
const meta = Object.fromEntries([...text.matchAll(/^(\w+)\s*=\s*(.+)$/gm)].map((m) => [m[1], m[2].trim()]));
if (meta.REF_FRAME !== "EME2000" || meta.CENTER_NAME !== "EARTH" || meta.TIME_SYSTEM !== "UTC") throw new Error("想定と違う OEM です");

// 行：時刻 x y z vx vy vz（EME2000・km・km/s）
const rows = [...text.matchAll(/^(\d{4}-\d\d-\d\dT[\d:.]+)\s+(\S+)\s+(\S+)\s+(\S+)\s+\S+\s+\S+\s+\S+\s*$/gm)].map((m) => ({
  ms: Date.parse(`${m[1]}Z`),
  r: [Number(m[2]), Number(m[3]), Number(m[4])],
}));
const epoch = rows[0].ms;

const geo = (body, ms) => {
  const v = A.GeoVector(body, A.MakeTime(new Date(ms)), body === A.Body.Sun);
  return [v.x * AU, v.y * AU, v.z * AU];
};
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(...a);
const unit = (a) => a.map((v) => v / len(a));

// 月にいちばん近づく点
let iMin = 0, dMin = Infinity;
for (const [i, p] of rows.entries()) {
  const dd = len(sub(p.r, geo(A.Body.Moon, p.ms)));
  if (dd < dMin) [dMin, iMin] = [dd, i];
}
const tMin = rows[iMin].ms;

// 座標の向き：z＝月の公転の軸、x＝最接近のときの月の向き
const m0 = geo(A.Body.Moon, tMin), m1 = geo(A.Body.Moon, tMin + 60000);
const ez = unit(cross(m0, sub(m1, m0)));
const ex = unit(sub(m0, ez.map((v) => v * dot(m0, ez))));
const ey = cross(ez, ex);
const rot = (a) => [dot(a, ex), dot(a, ey), dot(a, ez)];

// 点を間引く：地球や月のそば（速く動くところ）は細かく、ほかは約12分ごと
const out = [];
let last = -Infinity;
for (const [i, p] of rows.entries()) {
  const t = (p.ms - epoch) / 1000;
  const near = len(p.r) < 60000 || len(sub(p.r, geo(A.Body.Moon, p.ms))) < 30000;
  if (!(i === 0 || i === rows.length - 1 || near || t - last >= 700)) continue;
  last = t;
  const c = rot(p.r), mo = rot(geo(A.Body.Moon, p.ms));
  out.push([Math.round(t), ...c.map(Math.round), ...mo.map(Math.round)]);
}

// 太陽の向き（最接近のとき）と、地球の向き
const sunDir = unit(rot(geo(A.Body.Sun, tMin)));
const pole = rot([0, 0, 1]); // EME2000 の z（地球の北極。歳差は小さいので無視）
// グリニッジの向き：地球回転角（ERA）で近似（UT1≒UTC）
const era = (ms) => 2 * Math.PI * (0.779057273264 + 1.00273781191135448 * (ms / 86400000 + 2440587.5 - 2451545.0));
const th0 = era(epoch);
const greenwich0 = rot([Math.cos(th0), Math.sin(th0), 0]);

const r4 = (a) => a.map((v) => Math.round(v * 1e4) / 1e4);
console.error(
  `点 ${out.length}（元 ${rows.length}）。最接近 ${new Date(tMin).toISOString()} 月面から ${Math.round(dMin - 1737.4)} km。終わり ${new Date(rows.at(-1).ms).toISOString()}`,
);
process.stdout.write(
  JSON.stringify({
    $comment:
      "NASA が公開した アルテミス2号の飛行の軌道データ（エフェメリス：Artemis_II_OEM_2026_04_10_Post-ICPS-Sep-to-EI、NASA/JSC/FOD/FDO 作成）を scripts/artemis2-trajectory.mjs で変換したもの。月と太陽の位置は Astronomy Engine で計算。単位：秒（epoch から）・km。地球中心、月の公転面が x-y",
    source: "https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/",
    file: "Artemis_II_OEM_2026_04_10_Post-ICPS-Sep-to-EI.asc",
    created: meta.CREATION_DATE,
    epoch: new Date(epoch).toISOString(),
    closestApproach: new Date(tMin).toISOString(),
    sun: r4(sunDir),
    earth: { pole: r4(pole), greenwich0: r4(greenwich0), rate: (2 * Math.PI * 1.00273781191135448) / 86400 },
    points: out,
  }) + "\n",
);
