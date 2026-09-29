// prompts/src/*.md の末尾に RULES.md の全文をつなげて、コピーしてすぐ使える依頼文を作る。
// RULES.md や prompts/src/ を変えたら npm run build:prompts を実行する（--check で古くないかだけ確かめる）。

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const rules = readFileSync("RULES.md", "utf8");
const targets = [
  ["prompts/src/chappy.md", "prompts/chappy-research.md"],
  ["prompts/src/grok.md", "prompts/grok-news.md"],
];
const header = "<!-- このファイルは scripts/build-prompts.mjs が作る。直接編集せず prompts/src/ を直す -->\n\n";

const check = process.argv.includes("--check");
let stale = 0;
for (const [src, out] of targets) {
  const text = header + readFileSync(src, "utf8") + rules;
  if (check) {
    if (!existsSync(out) || readFileSync(out, "utf8") !== text) {
      console.log(`古い: ${out}`);
      stale++;
    }
    continue;
  }
  writeFileSync(out, text);
  console.log(`作成: ${out}`);
}
if (check && stale) {
  console.log("npm run build:prompts を実行してください");
  process.exit(1);
}
