// curation/ の事実（value・source・as_of の組）を集めて、dots（ChatGPT の常駐エージェント）が
// 毎日見比べる「見張り表」を作る。scripts/build-prompts.mjs から呼ぶ。

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// 公式の「動き」が出る一覧ページ。カードの出典ではないが、新しい発表に気づくために見る
export const NEWS_PAGES = [
  ["JAXA プレスリリース一覧", "https://www.jaxa.jp/press/"],
  ["NASA 宇宙ステーションのブログ", "https://www.nasa.gov/blogs/spacestation/"],
];

function jsonFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...jsonFiles(p));
    else if (name.endsWith(".json")) out.push(p);
  }
  return out;
}

function valueText(v) {
  if (typeof v === "object" && v !== null) return JSON.stringify(v);
  return String(v);
}

// 1枚のカードから {path, value, source, as_of} を取り出す
export function factsOf(card) {
  const facts = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((x, i) => walk(x, `${path}[${i}]`));
      return;
    }
    if (typeof node !== "object" || node === null) return;
    if ("source" in node && "value" in node) {
      facts.push({ path, value: valueText(node.value), source: node.source, as_of: node.as_of ?? "" });
      return;
    }
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(card, "");
  return facts;
}

// 出典URLごとにまとめる。同じページの事実はまとめて見比べられるように
export function buildWatchList(root = "curation") {
  const bySource = new Map();
  for (const file of jsonFiles(root)) {
    const card = JSON.parse(readFileSync(file, "utf8"));
    const id = card.id ?? relative(root, file);
    for (const f of factsOf(card)) {
      if (!bySource.has(f.source)) bySource.set(f.source, []);
      bySource.get(f.source).push({ id, ...f });
    }
  }
  return [...bySource.entries()].sort(([a], [b]) => a.localeCompare(b));
}

const cell = (s) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function watchListMarkdown(root = "curation") {
  const lines = [];
  lines.push("## 公式の一覧ページ（新しい発表があるか）", "");
  for (const [label, url] of NEWS_PAGES) lines.push(`- ${label}：${url}`);
  lines.push("", "## 載せている事実（出典ページごと）", "");
  lines.push("「載せている値」と、いま出典ページに書いてあることが食い違っていないかを見る。");
  for (const [source, facts] of buildWatchList(root)) {
    lines.push("", `### ${source}`, "");
    lines.push("| カード | 項目 | 載せている値 | 確認日 |", "|---|---|---|---|");
    for (const f of facts) lines.push(`| ${f.id} | ${f.path} | ${cell(f.value)} | ${f.as_of} |`);
  }
  return lines.join("\n") + "\n";
}
