// web/vendor/ に置いたライブラリ（globe.gl の中に入っているもの、satellite.js）のライセンス全文を、
// web/vendor/THIRD_PARTY_NOTICES.txt にまとめる。MIT・ISC・Apache-2.0 などは、配るときにライセンス文を一緒に付ける決まり。
// 普段は使わない（生成物をコミットしている）。ライブラリを入れ替えたときだけ:
//   web/vendor/README.md の「作り直し方」と同じフォルダで npm install したあと
//   node scripts/build-notices.mjs <そのフォルダ>/node_modules

import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root || !existsSync(root)) {
  console.error("使い方: node scripts/build-notices.mjs <node_modules のパス>");
  process.exit(1);
}

const packages = new Map();
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const path = join(dir, name);
    if (name.startsWith("@")) {
      walk(path);
      continue;
    }
    const pj = join(path, "package.json");
    if (!existsSync(pj)) continue;
    const { name: pkg, version, license } = JSON.parse(readFileSync(pj, "utf8"));
    const files = readdirSync(path).filter((f) => /^(licen[cs]e|copying|notice)/i.test(f));
    const key = `${pkg}@${version}`;
    if (!packages.has(key)) {
      packages.set(key, {
        pkg,
        version,
        license: typeof license === "string" ? license : JSON.stringify(license),
        texts: files.map((f) => readFileSync(join(path, f), "utf8").trim()),
      });
    }
    if (existsSync(join(path, "node_modules"))) walk(join(path, "node_modules"));
  }
}
walk(root);

const list = [...packages.values()].sort((a, b) => a.pkg.localeCompare(b.pkg));
const missing = list.filter((p) => !p.texts.length);
if (missing.length) {
  console.error("ライセンス文が見つからない:", missing.map((p) => p.pkg).join(", "));
  process.exit(1);
}
const line = "-".repeat(72);
const body = [
  "VOYASCOPE が web/vendor/ に同梱しているライブラリのライセンス",
  "（globe.gl.min.js に入っているもの・satellite.min.js の元。VOYASCOPE 自身のライセンスとは別）",
  "",
  `${list.length} パッケージ：${list.map((p) => `${p.pkg} ${p.version}（${p.license}）`).join("、")}`,
  "",
  "フォント MgOpen（MAGENTA Ltd.）のライセンス文は globe.gl.min.js の中に含まれている。",
  "",
  ...list.flatMap((p) => [line, `${p.pkg} ${p.version}  —  ${p.license}`, line, "", ...p.texts.flatMap((t) => [t, ""])]),
].join("\n");
writeFileSync("web/vendor/THIRD_PARTY_NOTICES.txt", `${body}\n`);
console.log(`${list.length} パッケージ → web/vendor/THIRD_PARTY_NOTICES.txt`);
