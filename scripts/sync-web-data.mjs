// web/ から読むデータを、元のファイルから web/data/ に書き出す。
// web/ だけを配信する（npx serve web）ため、リポジトリ内の他のフォルダは直接読めない。
// 元ファイルを変えたら npm run sync:web を実行する。--check で「書き出したものが古くないか」だけ確かめる。
//
// - 機体カード：そのままコピー
// - 乗員：その機体に向かったチーム（teams/ の destination）と、その飛行士（astronauts/）を1つのファイルにまとめる
//   いま乗っているかどうか（打ち上げ済み・未帰還）はアプリ側で判断する

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

// Phase 0〜1 は見本（examples/）を使う（出典確認中）。curation/ に入ったら差し替える
const SOURCE = "examples";
const CRAFT = ["iss"];

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const readDir = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => readJson(join(dir, f))) : [];

const outputs = [];
const teams = readDir(join(SOURCE, "teams"));
const astronauts = new Map(readDir(join(SOURCE, "astronauts")).map((a) => [a.id, a]));

for (const id of CRAFT) {
  const card = readFileSync(join(SOURCE, "spacecraft", `${id}.json`), "utf8");
  outputs.push([`web/data/cards/${id}.json`, card]);

  const crew = {
    $comment: `scripts/sync-web-data.mjs が ${SOURCE}/teams と ${SOURCE}/astronauts から作る。手で編集しない。`,
    teams: teams
      .filter((t) => t.destination === id)
      .map((t) => ({
        ...t,
        crew: t.crew.map((m) => ({ ...m, astronaut: astronauts.get(m.astronaut) ?? { id: m.astronaut } })),
      })),
  };
  outputs.push([`web/data/cards/${id}-crew.json`, JSON.stringify(crew, null, 2) + "\n"]);
}

// アプリが最初に読む一覧。機体ごとのカード・軌道・乗員のファイルの場所
const orbitIds = new Set(JSON.parse(readFileSync("config/orbits.json", "utf8")).objects.map((o) => o.id));
const index = {
  $comment: "scripts/sync-web-data.mjs が作る。手で編集しない。",
  craft: CRAFT.map((id) => ({
    id,
    card: `data/cards/${id}.json`,
    orbit: orbitIds.has(id) ? `data/orbits/${id}.json` : null,
    crew: `data/cards/${id}-crew.json`,
  })),
};
outputs.push(["web/data/craft-index.json", JSON.stringify(index, null, 2) + "\n"]);

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
