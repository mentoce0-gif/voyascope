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

// 地上軌跡：center の前後 minutes 分を stepMin 分おきに。経度 ±180° をまたぐところで線を分ける
export function groundTrack(satrec, center, { before = 90, after = 90, stepMin = 1 } = {}) {
  const segments = [];
  let seg = [];
  let prevLng = null;
  for (let m = -before; m <= after; m += stepMin) {
    const p = positionAt(satrec, new Date(center.getTime() + m * 60000));
    if (!p) continue;
    if (prevLng !== null && Math.abs(p.lng - prevLng) > 180) {
      if (seg.length > 1) segments.push(seg);
      seg = [];
    }
    seg.push({ lat: p.lat, lng: p.lng, past: m < 0 });
    prevLng = p.lng;
  }
  if (seg.length > 1) segments.push(seg);
  return segments;
}

// 観測時刻の時計。タイムライン（現在の −6時間〜+24時間）の中だけを動く
export const TIMELINE = { minMs: -6 * 3600e3, maxMs: 24 * 3600e3 };

export class SimClock {
  constructor(realNow = () => Date.now(), perfNow = () => performance.now()) {
    this.realNow = realNow;
    this.perfNow = perfNow;
    this.speed = 1;
    this.playing = true;
    this.live();
  }
  // 現在時刻に戻して、等倍で再生する
  live() {
    this.anchorReal = this.perfNow();
    this.anchorSim = this.realNow();
    this.speed = 1;
    this.playing = true;
  }
  now() {
    const elapsed = this.playing ? (this.perfNow() - this.anchorReal) * this.speed : 0;
    return new Date(this.anchorSim + elapsed);
  }
  #rebase() {
    this.anchorSim = this.now().getTime();
    this.anchorReal = this.perfNow();
  }
  setSpeed(speed) {
    this.#rebase();
    this.speed = speed;
  }
  setPlaying(playing) {
    this.#rebase();
    this.playing = playing;
  }
  // 現実の時刻とのずれ（ミリ秒）
  offset() {
    return this.now().getTime() - this.realNow();
  }
  // タイムラインの位置（現在からのずれ）へ移動する
  jumpToOffset(ms) {
    const clamped = Math.min(TIMELINE.maxMs, Math.max(TIMELINE.minMs, ms));
    this.anchorSim = this.realNow() + clamped;
    this.anchorReal = this.perfNow();
  }
  // タイムラインの端を越えたら止める。止めたら true
  clampToTimeline() {
    const off = this.offset();
    if (off > TIMELINE.maxMs) {
      this.jumpToOffset(TIMELINE.maxMs);
      this.setPlaying(false);
      return true;
    }
    if (off < TIMELINE.minMs) this.jumpToOffset(TIMELINE.minMs);
    return false;
  }
  isLive() {
    return this.playing && this.speed === 1 && Math.abs(this.offset()) < 2000;
  }
}
