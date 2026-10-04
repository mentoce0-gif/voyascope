// 探査機の地球からの距離を、NASA JPL の Horizons（Solar System Dynamics）から取る関数。
// 取得スクリプト（scripts/fetch-horizons.mjs）とテストで使う。
//
// 使い方は、JPL SSD に問い合わせて了承を得た形にする（research/verification/2026-10-03-c14.md「JPL SSD とのやりとり」）：
// - 週に1回、1件ずつ呼ぶ。1回で先の6週間ぶん（1日ごと）をもらって使い回す
//   （Fair Use：変わらないデータや予測どおりに変わるデータは、キャッシュして使い回す。https://ssd-api.jpl.nasa.gov/）
// - 見る人のブラウザは Horizons を呼ばない（web/data/horizons.json だけを読む）
// - 値は丸めて置く（有効数字5桁）。画面ではさらに丸めて「約」を付け、「Horizons の計算値（取得日）」として出す
// - 出典は SSD の希望の形：Solar System Dynamics. (Downloaded 年, 月, 日). Horizons System. https://ssd.jpl.nasa.gov
// - 軌道のもとのデータを出した機関は、Horizons の説明（datasheet）に書かれているものだけを出す（curation の distance.supplier）。
//   カードに書いた説明の原文（distance.datasheet_quotes）が、取るたびにまだ説明にあるかを確かめる

export const API = "https://ssd.jpl.nasa.gov/api/horizons.api";
export const API_VERSION = "1.2"; // 出力の version。変わったら止めて、出力の形を確かめてから直す
export const DAYS = 42; // 1回で何日先までもらうか（週1回の取得が何回か失敗しても、表示が続く）
export const STEP_HOURS = 24;
export const START_UTC_HOUR = 15; // 表の時刻：日本時間の 0時（世界時 15時）
export const SIG = 5; // web/data に置く値の有効数字

const DAY_MS = 86400000;

// 有効数字 sig 桁に丸める
export function roundSig(x, sig = SIG) {
  if (!x) return 0;
  const p = 10 ** (Math.floor(Math.log10(Math.abs(x))) - sig + 1);
  return Math.round(Math.round(x / p) * p);
}

// 表のはじまり：now より前で、いちばん近い日本時間 0時（世界時 15時）
export function tableStart(now) {
  const t = now.getTime() - START_UTC_HOUR * 3600000;
  return new Date(Math.floor(t / DAY_MS) * DAY_MS + START_UTC_HOUR * 3600000);
}

const hz = (d) => `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`; // "2026-10-04 15:00"

// 1機ぶんの問い合わせの URL。地球の中心（500@399）からの距離（幾何学的な距離。光の時間の補正なし）を、1日ごとに
export function queryUrl(command, start, days = DAYS) {
  const stop = new Date(start.getTime() + days * DAY_MS);
  const q = {
    format: "json",
    COMMAND: `'${command}'`,
    OBJ_DATA: "'YES'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@399'",
    START_TIME: `'${hz(start)}'`,
    STOP_TIME: `'${hz(stop)}'`,
    STEP_SIZE: `'${STEP_HOURS / 24} d'`,
    VEC_TABLE: "'3'",
    VEC_CORR: "'NONE'",
    OUT_UNITS: "'KM-S'",
    CSV_FORMAT: "'YES'",
    VEC_LABELS: "'NO'",
  };
  return `${API}?${Object.entries(q)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&")}`;
}

const squash = (s) => String(s).replace(/\s+/g, " ").trim();

// 応答（JSON）を読む。{ target, km: [...], missingQuotes: [...] }。形が違えば例外
export function parseHorizons(api, { command, quotes = [], days = DAYS } = {}) {
  const version = api?.signature?.version;
  if (version !== API_VERSION) throw new VersionError(version);
  const text = api?.result;
  if (typeof text !== "string") throw new Error("応答に result がありません");
  const target = /Target body name:\s*(.+?)\s*(?:\{source:[^}]*\})?\s*$/m.exec(text)?.[1]?.trim();
  if (!target) throw new Error("対象の名前（Target body name）が読めません");
  if (!target.includes(`(${command})`)) throw new Error(`ちがう対象が返ってきました：${target}（${command} のはず）`);
  const soe = text.indexOf("$$SOE");
  const eoe = text.indexOf("$$EOE");
  if (soe < 0 || eoe < soe) throw new Error("表（$$SOE〜$$EOE）がありません");
  const rows = text
    .slice(soe + 5, eoe)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (rows.length !== days + 1) throw new Error(`表の行の数が ${rows.length} です（${days + 1} のはず）`);
  // CSV：JDTDB, 日時, X, Y, Z, VX, VY, VZ, LT, RG（距離 km）, RR
  const km = rows.map((r) => {
    const cols = r.split(",").map((c) => c.trim());
    const rg = Number(cols[9]);
    if (!Number.isFinite(rg) || rg <= 0) throw new Error(`距離（RG）が読めません：${r.slice(0, 60)}`);
    return roundSig(rg);
  });
  // カードに書いた説明の原文が、いまの説明にもあるか（空白・改行のちがいは見ない）
  const sheet = squash(text.slice(0, soe));
  return { target, km, missingQuotes: quotes.filter((q) => !sheet.includes(squash(q))) };
}

export class VersionError extends Error {
  constructor(version) {
    super(`Horizons API の version が ${version ?? "（なし）"} です（${API_VERSION} のはず）。出力の形が変わったかもしれないので、止めます`);
    this.name = "VersionError";
  }
}

// 1機ぶんの表（web/data/horizons.json の probes の中身）
export const probeTable = (parsed, { downloaded, start }) => ({
  target: parsed.target,
  downloaded: downloaded.toISOString(),
  start: start.toISOString(),
  km: parsed.km,
});

// 表がまだ使えるか（now が表の中にあるか）
export function tableCovers(table, now, stepHours = STEP_HOURS) {
  const start = Date.parse(table?.start ?? "");
  if (Number.isNaN(start) || !Array.isArray(table?.km) || table.km.length < 2) return false;
  const end = start + (table.km.length - 1) * stepHours * 3600000;
  return now.getTime() >= start && now.getTime() <= end;
}
