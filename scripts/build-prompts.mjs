// prompts/src/*.md の末尾に RULES.md の全文をつなげて、コピーしてすぐ使える依頼文を作る。
// あわせて、dots が毎日読む見張り表（prompts/dots-watch.md）を curation/ から作る。
// RULES.md・prompts/src/・curation/ を変えたら npm run build:prompts を実行する（--check で古くないかだけ確かめる）。

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { watchListMarkdown } from "./watch-list.mjs";

const rules = readFileSync("RULES.md", "utf8");
const targets = [
  ["prompts/src/chappy.md", "prompts/chappy-research.md"],
  ["prompts/src/grok.md", "prompts/grok-news.md"],
  ["prompts/src/dots.md", "prompts/dots.md"],
];
const header = "<!-- このファイルは scripts/build-prompts.mjs が作る。直接編集せず prompts/src/ を直す -->\n\n";
const watchHeader =
  "<!-- このファイルは scripts/build-prompts.mjs が curation/ から作る。直接編集しない -->\n\n" +
  "# VOYASCOPE 見張り表（dots が毎日読む）\n\n";

const outputs = targets.map(([src, out]) => [out, header + readFileSync(src, "utf8") + rules]);
outputs.push(["prompts/dots-watch.md", watchHeader + watchListMarkdown("curation")]);

const check = process.argv.includes("--check");
let stale = 0;
for (const [out, text] of outputs) {
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
