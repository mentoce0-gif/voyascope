// web/ から読むデータを、元のファイルから web/data/ にコピーする。
// web/ だけを配信する（npx serve web）ため、リポジトリ内の他のフォルダは直接読めない。
// 元ファイルを変えたら npm run sync:web を実行する。--check で「コピーが古くないか」だけ確かめる。

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const pairs = [
  // Phase 0 は見本のカードを使う（出典確認中）。curation/ に入ったら差し替える
  ["examples/spacecraft/iss.json", "web/data/cards/iss.json"],
  ["config/rank-thresholds.json", "web/data/rank-thresholds.json"],
];

const check = process.argv.includes("--check");
let stale = 0;
for (const [from, to] of pairs) {
  const src = readFileSync(from, "utf8");
  if (check) {
    if (!existsSync(to) || readFileSync(to, "utf8") !== src) {
      console.log(`古いコピー: ${to}（元: ${from}）`);
      stale++;
    }
    continue;
  }
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, src);
  console.log(`コピー: ${from} → ${to}`);
}
if (check) {
  if (stale) {
    console.log("npm run sync:web を実行してください");
    process.exit(1);
  }
  console.log("web/data/ のコピーは最新です");
}
