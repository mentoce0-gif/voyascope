// アルテミス2号のミッション：オリオンを外から見せる場面のカードと、エンドクレジットの「ミッションの結果」
// C27（チャッピー）を公式ページで照合したものだけ（voyascope-research の research/verification/2026-10-12-c27.md）
// 人物は、公式の名前・役割・所属だけ（RULES.md：キャッチコピー・セリフ・能力値・写真・私生活は付けない）

// NASA「Artemis II Priorities and Objectives」（https://www.nasa.gov/wp-content/uploads/2026/03/artemis-ii-mission-prioirities-objectives-.pdf）
//   「The primary goal of Artemis II is a crewed test flight in lunar space.」
//   4.「Demonstrate Orion proximity operations using the Interim Cryogenic Propulsion Stage」
//   7.「Validate Orion's life support system and critical crew survival systems」
//   11.「Demonstrate Orion environmental, communication, propulsion, navigation systems」 12.「Demonstrate optical communications capability」
//   19.「Demonstrate Orion heat shield performance during reentry from cislunar velocity」
//   86.「Demonstrate crew manual piloting」・k.「Lunar Observation Campaign」
// 乗員：NASA「Our Artemis Crew」（https://www.nasa.gov/feature/our-artemis-crew/）
//   「Commander Reid Wiseman, pilot Victor Glover, and mission specialist Christina Koch from NASA, and mission specialist Jeremy Hansen from the Canadian Space Agency.」
//   名前は英語の表記（日本語の公式の表記は、4人そろっては確認できていない）
// 打ち上げ：NASA（https://www.nasa.gov/news-release/nasa-welcomes-record-setting-artemis-ii-moonfarers-back-to-earth/）「6:35 p.m. April 1」
export const MISSION = {
  tag: "ミッション · NASA",
  name: "Artemis II（アルテミス2号）",
  log: "乗員 4人 · 打ち上げ 2026-04-01 · 約10日（NASA）",
  lead: "目的：月のまわりでの、人を乗せた試験飛行（NASA）",
  summary: "乗員 · 試すこと",
  rows: [
    {
      k: "乗員",
      items: ["Commander · Reid Wiseman（NASA）", "Pilot · Victor Glover（NASA）", "Mission Specialist · Christina Koch（NASA）", "Mission Specialist · Jeremy Hansen（CSA）"],
    },
    {
      k: "試すこと",
      items: ["生命維持（NASA）", "手動での操縦（NASA）", "ロケットの上段（ICPS）を目印にした接近（NASA）", "通信・光通信（NASA）", "月の観測（NASA）", "月から帰る速さでの再突入（NASA）"],
    },
  ],
  links: [
    { href: "https://www.nasa.gov/wp-content/uploads/2026/03/artemis-ii-mission-prioirities-objectives-.pdf", text: "NASA の目標 ↗", aria: "NASA の目標の文書（PDF）" },
    { href: "https://www.nasa.gov/feature/our-artemis-crew/", text: "NASA の乗員 ↗", aria: "NASA の乗員のページ" },
  ],
};

// 飛行後の NASA の発表（https://www.nasa.gov/news-release/nasa-to-host-artemis-ii-crew-postflight-news-conference/）
//   「the crew achieved the mission's primary objectives, including testing its life support systems; manually piloting the Orion spacecraft;
//    performing maneuvers to propel Orion to the Moon and adjust its course; conducting a lunar flyby with unprecedented views of the Moon's far side;
//    and completing a safe re-entry and recovery. The astronauts also set a record for the farthest distance traveled by humans away …」
//   最遠の距離 252,756 マイル：https://www.nasa.gov/blogs/missions/2026/04/06/artemis-ii-flight-day-6-lunar-flyby-updates/（7:02 p.m.）
export const RESULTS = {
  head: "主要目標を達成 · NASA の発表（飛行後）",
  items: ["生命維持の試験 ✓", "手動での操縦 ✓", "月への噴射と、軌道の修正 ✓", "月フライバイ ✓", "安全な再突入と回収 ✓", "人類の最遠記録 · 地球から 252,756 mi ✓"],
};
