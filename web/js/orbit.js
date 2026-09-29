// 軌道計算（SGP4 をブラウザ内で実行）
import { twoline2satrec, json2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong } from "../vendor/satellite.min.js";

// web/data/orbits/<id>.json から SGP4 の計算に使う形を作る。OMM（JSON）と TLE のどちらでもよい
export function satrecFromOrbit(orbit) {
  let satrec;
  if (orbit.format === "omm" && orbit.omm) satrec = json2satrec(orbit.omm);
  else if (orbit.format === "tle" && orbit.tle) satrec = twoline2satrec(orbit.tle.line1, orbit.tle.line2);
  else throw new Error(`軌道データの形式が分かりません（${orbit.format}）`);
  if (satrec.error) throw new Error(`軌道データを読み込めません（error ${satrec.error}）`);
  return satrec;
}

// 指定時刻の位置。計算できないときは null
export function positionAt(satrec, date) {
  const pv = propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === "boolean") return null;
  const geo = eciToGeodetic(pv.position, gstime(date));
  const v = pv.velocity;
  const pos = {
    lat: degreesLat(geo.latitude),
    lng: degreesLong(geo.longitude),
    altKm: geo.height,
    // 慣性座標系での速さ（地球の自転を差し引かない、軌道上の速さ）
    speedKmS: Math.hypot(v.x, v.y, v.z),
  };
  return Object.values(pos).every(Number.isFinite) ? pos : null;
}

// 1周の時間（分）。TLE の平均運動（rad/分）から計算
export function periodMinutes(satrec) {
  return (2 * Math.PI) / satrec.no;
}

// 画面の時間を早送りするための時計
export class SimClock {
  constructor() {
    this.speed = 1;
    this.reset();
  }
  reset() {
    this.anchorReal = performance.now();
    this.anchorSim = Date.now();
  }
  now() {
    return new Date(this.anchorSim + (performance.now() - this.anchorReal) * this.speed);
  }
  setSpeed(speed) {
    this.anchorSim = this.now().getTime();
    this.anchorReal = performance.now();
    this.speed = speed;
  }
  // 現実の時刻とのずれ（ミリ秒）
  offset() {
    return this.now().getTime() - Date.now();
  }
}
