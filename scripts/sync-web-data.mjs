// web/ から読むデータを、元のファイルから web/data/ に書き出す。
// web/ だけを配信する（npx serve web）ため、リポジトリ内の他のフォルダは直接読めない。
// 元ファイルを変えたら npm run sync:web を実行する。--check で「書き出したものが古くないか」だけ確かめる。
//
// - 機体：config/orbits.json に並んだ順。カードは curation/（出典確認済み）を優先し、なければ examples/（見本）
// - 運用状況：config/status.json にある機体だけ、自動取得したファイルの場所を載せる
// - 乗員：その機体に向かったチーム（teams/ の destination）と、その飛行士（astronauts/）を1つのファイルにまとめる
//   いま乗っているかどうか（打ち上げ済み・未帰還）はアプリ側で判断する
// - 予定：curation/events を1つのファイルにまとめる。過ぎたかどうか・並べ替えはアプリ側でする

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const readDir = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => readJson(join(dir, f))) : [];

// カードの置き場所：出典確認済み（curation）が先
function cardSource(id) {
  for (const root of ["curation", "examples"]) {
    const path = join(root, "spacecraft", `${id}.json`);
    if (existsSync(path)) return { root, path };
  }
  return null;
}

const outputs = [];
const { objects } = readJson("config/orbits.json");
// 運用状況を自動で取りに行く機体（scripts/fetch-status.mjs が web/data/status/ に書く）
const statusIds = new Set(readJson("config/status.json").qzss.map((c) => c.id));
const craft = [];

for (const { id } of objects) {
  const src = cardSource(id);
  if (!src) {
    console.log(`カードがないので表示しない: ${id}`);
    continue;
  }
  const cardText = readFileSync(src.path, "utf8");
  const card = JSON.parse(cardText);
  outputs.push([`web/data/cards/${id}.json`, cardText]);

  let crew = null;
  if (card.class?.startsWith("crewed")) {
    const teams = readDir(join(src.root, "teams"));
    const astronauts = new Map(readDir(join(src.root, "astronauts")).map((a) => [a.id, a]));
    const data = {
      $comment: `scripts/sync-web-data.mjs が ${src.root}/teams と ${src.root}/astronauts から作る。手で編集しない。`,
      teams: teams
        .filter((t) => t.destination === id)
        .map((t) => ({
          ...t,
          crew: t.crew.map((m) => ({ ...m, astronaut: astronauts.get(m.astronaut) ?? { id: m.astronaut } })),
        })),
    };
    crew = `data/cards/${id}-crew.json`;
    outputs.push([`web/${crew}`, JSON.stringify(data, null, 2) + "\n"]);
  }

  craft.push({
    id,
    card: `data/cards/${id}.json`,
    orbit: `data/orbits/${id}.json`,
    crew,
    status: statusIds.has(id) ? `data/status/${id}.json` : null,
    sample: src.root === "examples",
  });
}

// アプリが最初に読む一覧。機体ごとのカード・軌道・乗員のファイルの場所
const index = { $comment: "scripts/sync-web-data.mjs が作る。手で編集しない。", craft };
outputs.push(["web/data/craft-index.json", JSON.stringify(index, null, 2) + "\n"]);
// 予定（次の出来事・これから行く）。出典を確認した curation/events だけを使う。並べ替えはアプリがする
const eventsDir = "curation/events";
const events = existsSync(eventsDir)
  ? readdirSync(eventsDir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => readJson(join(eventsDir, f)))
  : [];
const eventsData = { $comment: "scripts/sync-web-data.mjs が curation/events から作る。手で編集しない。", events };
outputs.push(["web/data/events.json", JSON.stringify(eventsData, null, 2) + "\n"]);
// 今夜の通過（県単位）に使う代表地点
outputs.push(["web/data/prefectures.json", readFileSync("config/prefectures.json", "utf8")]);

const check = process.argv.includes("--check");
let stale = 0;
for (const [to, text] of outputs) {
  if (check) {
    if (!existsSync(to) || readFileSync(to, "utf8") !== text) {
      console.log(`古い: ${to}`);
      stale++;
    }
    continue;
  }
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, text);
  console.log(`書き出し: ${to}`);
}
if (check) {
  if (stale) {
    console.log("npm run sync:web を実行してください");
    process.exit(1);
  }
  console.log("web/data/ は最新です");
}
