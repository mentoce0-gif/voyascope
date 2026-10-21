// 観測ログ：見えた通過を、X に貼れる記号の形の1件にする（例：20261022_1824 / #ISS / NW→E / EL62° / ☀）
// 投稿は本人の操作だけ（X の投稿画面を文入りで開く・コピー）。VOYASCOPE からは何も送らない。場所（県）は入れない

const TZ = "Asia/Tokyo";
const SITE = "https://voyascope.org/";

// 空の様子は、見た人が選ぶ（天気のデータは持っていない）
export const SKIES = [
  { id: "clear", mark: "☀", label: "見えた" },
  { id: "partly", mark: "⛅", label: "雲の間から" },
  { id: "cloudy", mark: "☁", label: "雲で見えず" },
];

const DIR8_EN = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const dir8En = (az) => DIR8_EN[Math.round((((az % 360) + 360) % 360) / 45) % 8];

// 日本時間の「20261022_1824」。X が「:」の前後で区切ることがあるので「_」でつなぐ
export function stamp(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}${p.month}${p.day}_${p.hour}${p.minute}`;
}

export function obsLogText(pass, skyId = "clear", { tag = "#ISS" } = {}) {
  const sky = SKIES.find((s) => s.id === skyId) ?? SKIES[0];
  return [
    "#VOYASCOPE OBS-LOG",
    `${stamp(pass.start)} / ${tag} / ${dir8En(pass.startAz)}→${dir8En(pass.endAz)} / EL${Math.round(pass.maxEl)}° / ${sky.mark}`,
    SITE,
  ].join("\n");
}

export const postUrl = (text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
