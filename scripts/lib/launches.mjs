// 世界の打ち上げ予定（参考）：Launch Library 2（The Space Devs）の応答を、VOYASCOPE の表示用に作り直す関数。
// 取得スクリプト（scripts/fetch-launches.mjs）とテストで使う。
//
// The Space Devs は宇宙機関の公式ではない（有志の非営利団体。データは手作業で維持され、正確さは保証されない）。
// 利用条件（research/verification/2026-10-02-c8.md）に合わせて：
// - 1回の取得で必要な項目だけを残し、日本語の名前を付けた形に作り直す（受け取った JSON をそのまま置かない）
// - 「日時が確かめられている（Go）」「公式の確認待ち（TBC）」で、日付まで決まっているものだけを残す
// - 出典として「Launch Library 2（The Space Devs）」を表示する（画面側）

export const SOURCE_LABEL = "Launch Library 2（The Space Devs）";
export const SOURCE_URL = "https://thespacedevs.com/llapi";

const DAY = 86400000;

// "Falcon 9 Block 5 | Crew-13" の後ろ半分（任務の名前がないとき）
const missionFromName = (name) => String(name ?? "").split(" | ").slice(1).join(" | ") || null;

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

// 1件を表示用の形にする。使えないもの（状態・精度が対象外、項目が足りない）は null
export function toLaunch(r, config) {
  const status = config.statuses[String(r?.status?.id)];
  const precision = config.precisions[String(r?.net_precision?.id)];
  const net = Date.parse(r?.net ?? "");
  if (!status || !precision || Number.isNaN(net) || typeof r.id !== "string") return null;
  const rocket = r.rocket?.configuration;
  const pad = r.pad;
  const loc = pad?.location;
  if (!rocket?.name || !pad || !loc?.name) return null;

  const provider = r.launch_service_provider?.name ?? null;
  const country = pad.country?.alpha_3_code ?? loc.country?.alpha_3_code ?? null;
  const placeName = config.locations[String(loc.id)] ?? null;
  const missionName = r.mission?.name ?? missionFromName(r.name);
  const missionType = r.mission?.type ?? null;
  const orbit = r.mission?.orbit ?? null;
  const lat = num(pad.latitude);
  const lng = num(pad.longitude);
  const windowEnd = Date.parse(r.window_end ?? "");

  return {
    id: r.id,
    net: new Date(net).toISOString(),
    precision,
    // 打ち上げられる時間の終わり（同じ時刻なら書かない）
    window_end: !Number.isNaN(windowEnd) && windowEnd > net ? new Date(windowEnd).toISOString() : null,
    status: status.code,
    status_label: status.label,
    status_ja: status.ja,
    updated: r.last_updated ?? null,
    rocket: { name: rocket.name, full_name: rocket.full_name || rocket.name },
    provider: provider ? { name: provider, ja: config.providers[provider] ?? null } : null,
    mission: {
      name: missionName ? (config.placeholders[missionName] ?? missionName) : null,
      placeholder: !!(missionName && config.placeholders[missionName]),
      type: missionType && missionType !== "Unknown" ? missionType : null,
      type_ja: (missionType && config.mission_types[missionType]) ?? null,
      orbit: orbit && !["N/A", "Unknown"].includes(orbit.abbrev) ? orbit.name : null,
      orbit_ja: (orbit && config.orbits[orbit.abbrev]) ?? null,
    },
    site: {
      location_id: loc.id ?? null,
      name: loc.name,
      ja: placeName?.ja ?? null,
      short: placeName?.short ?? null,
      pad: pad.name ?? null,
      country,
      country_ja: (country && config.countries[country]) ?? null,
      // 空中・海上からの打ち上げなど、位置のないものはピンを立てない
      position: lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null,
    },
  };
}

// 応答全体 → web/data/launches.json の中身。応答の形が違えば例外（取得スクリプトはそこで止まり、前回のデータが残る）
export function buildLaunches(api, config, fetchedAt) {
  if (!api || !Array.isArray(api.results)) throw new Error("応答に results がありません。API の形が変わった可能性があります");
  const t = fetchedAt.getTime();
  const all = api.results.map((r) => toLaunch(r, config));
  const usable = all.filter(Boolean);
  if (api.results.length > 0 && usable.length === 0) {
    throw new Error(`${api.results.length} 件すべてが読めません。API の形が変わった可能性があります`);
  }
  const launches = usable
    .filter((l) => Date.parse(l.net) <= t + config.days_ahead * DAY)
    .sort((a, b) => a.net.localeCompare(b.net) || a.id.localeCompare(b.id))
    .slice(0, config.max_launches);
  return {
    record: {
      $comment: "Launch Library 2（The Space Devs）の打ち上げ予定から scripts/fetch-launches.mjs が作る。手で編集しない。宇宙機関の公式の発表ではない（画面では「参考」の印を付ける）",
      source: SOURCE_URL,
      source_label: SOURCE_LABEL,
      fetched_at: fetchedAt.toISOString(),
      days_ahead: config.days_ahead,
      launches,
    },
    skipped: all.length - usable.length,
  };
}

// 前回の取得からの時間（時間）。ファイルがない・読めないときは Infinity
export function ageHours(existing, now) {
  const t = Date.parse(existing?.fetched_at ?? "");
  return Number.isNaN(t) ? Infinity : (now.getTime() - t) / 3600000;
}
