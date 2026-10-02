// 読み込み量の上限を確かめる（CI）。スマホで重くならないように。上限は config/size-budget.json
//   node scripts/check-size.mjs
// 上限を超えたら、まず小さくできないかを考える（画像を縮める・あとから読む）。上げるときは理由を PR に書く
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expandFiles, transferSize, allFiles, bootRuleErrors } from "./lib/size-budget.mjs";

const ROOT = "web";
const budget = JSON.parse(readFileSync("config/size-budget.json", "utf8"));
const kb = (b) => `${(b / 1024).toFixed(0)}KB`;
let failed = false;
const fail = (msg) => {
  failed = true;
  console.log(`::error::${msg}`);
};

console.log("読み込み量（文字のファイルは gzip 後、画像はそのまま）");
for (const g of budget.groups) {
  const { files, missing } = expandFiles(ROOT, g.files);
  for (const m of missing) fail(`${g.label}：${m} に当たるファイルがありません（config/size-budget.json を直す）`);
  const sizes = files.map((f) => [f, transferSize(join(ROOT, f))]).sort((a, b) => b[1] - a[1]);
  const total = sizes.reduce((a, [, s]) => a + s, 0);
  const ok = total <= g.max_kb * 1024;
  console.log(`  ${ok ? "OK" : "NG"}  ${g.label}：${kb(total)}／上限 ${g.max_kb}KB（${files.length}ファイル）`);
  if (!ok) {
    fail(`${g.label}が上限を超えました：${kb(total)}／上限 ${g.max_kb}KB`);
    for (const [f, s] of sizes.slice(0, 8)) console.log(`        ${kb(s).padStart(6)}  ${f}`);
  }
}

const big = allFiles(ROOT)
  .map((f) => [f, transferSize(join(ROOT, f))])
  .filter(([, s]) => s > budget.max_file_kb * 1024);
for (const [f, s] of big) fail(`${f} が1ファイルの上限を超えました：${kb(s)}／上限 ${budget.max_file_kb}KB`);
console.log(`  ${big.length ? "NG" : "OK"}  1ファイルの上限 ${budget.max_file_kb}KB（web/ のすべて）`);

const errors = bootRuleErrors(readFileSync(join(ROOT, "index.html"), "utf8"), { preload: budget.preload ?? [] });
for (const e of errors) fail(`index.html：${e}`);
console.log(`  ${errors.length ? "NG" : "OK"}  起動を遅らせる読み込みがない（index.html）`);

process.exit(failed ? 1 : 0);
