// VOYASCOPE カード検証
// RULES.md ルール3「推測で書かない」を機械的に守らせる。
// 使い方: node scripts/validate.mjs <curation|examples>

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const root = process.argv[2] ?? "curation";
const kinds = [
  { dir: "spacecraft", schema: "spacecraft.schema.json" },
  { dir: "teams", schema: "team.schema.json" },
  { dir: "astronauts", schema: "astronaut.schema.json" },
  { dir: "events", schema: "event.schema.json" },
];

const loadJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addSchema(loadJson("schema/common.schema.json"), "common.schema.json");

const errors = [];
const ids = { spacecraft: new Set(), teams: new Set(), astronauts: new Set(), events: new Set() };
const cards = [];

for (const kind of kinds) {
  const dir = join(root, kind.dir);
  if (!existsSync(dir)) continue;
  const validate = ajv.compile(loadJson(join("schema", kind.schema)));
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const path = join(dir, file);
    let card;
    try {
      card = loadJson(path);
    } catch (e) {
      errors.push(`${path}: JSONとして読めません (${e.message})`);
      continue;
    }
    if (!validate(card)) {
      for (const err of validate.errors) {
        if (err.keyword === "oneOf" || err.keyword === "if") continue;
        // 「非公開」側の分岐のエラーは出典エラーと重複するので出さない
        if (err.schemaPath.includes("/oneOf/1/")) continue;
        const where = err.instancePath || "(ルート)";
        // 予定の日時は4つの書き方のどれか。どの書き方とも合わないときは1行にまとめる
        if (kind.dir === "events" && where.startsWith("/when/value")) {
          errors.push(`${path} /when/value: 日時の書き方が違います（at：時刻まで（UTC、末尾 Z）／date／from と to／month のどれか1つ）`);
          continue;
        }
        let hint = err.message;
        if (err.keyword === "pattern" && err.params.pattern === "^https://") {
          hint = "出典URLがありません（推測で書かない）";
        } else if (err.keyword === "additionalProperties") {
          hint = `スキーマにない項目 "${err.params.additionalProperty}" があります`;
        } else if (err.keyword === "enum") {
          hint = `使えない値です（候補: ${err.params.allowedValues.join(", ")}）`;
        } else if (err.keyword === "required") {
          hint = `必須項目 "${err.params.missingProperty}" がありません`;
        }
        errors.push(`${path} ${where}: ${hint}`);
      }
    }
    if (card.id && `${card.id}.json` !== file) {
      errors.push(`${path}: ファイル名と id が一致しません`);
    }
    ids[kind.dir].add(card.id);
    cards.push({ kind: kind.dir, path, card });
  }
}

// 参照の整合性チェック
for (const { kind, path, card } of cards) {
  if (kind === "spacecraft" && card.current_team && !ids.teams.has(card.current_team)) {
    errors.push(`${path}: current_team "${card.current_team}" が teams/ にありません`);
  }
  if (kind === "teams") {
    if (card.destination && !ids.spacecraft.has(card.destination)) {
      errors.push(`${path}: destination "${card.destination}" が spacecraft/ にありません`);
    }
    for (const member of card.crew ?? []) {
      if (!ids.astronauts.has(member.astronaut)) {
        errors.push(`${path}: crew "${member.astronaut}" が astronauts/ にありません`);
      }
    }
  }
  if (kind === "astronauts") {
    for (const team of card.teams ?? []) {
      if (!ids.teams.has(team)) {
        errors.push(`${path}: teams "${team}" が teams/ にありません`);
      }
    }
  }
  if (kind === "events") {
    // 形は合っていても、ありえない日付（2月30日など）や逆向きの幅を落とす
    const v = card.when?.value ?? {};
    const realDay = (s) => {
      const d = new Date(`${s}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    };
    const days = [v.date, v.from, v.to, v.month && `${v.month}-01`, card.window_end?.value].filter(Boolean);
    for (const d of days) if (!realDay(d)) errors.push(`${path}: "${d}" は日付として読めません`);
    if (v.at && Number.isNaN(Date.parse(v.at))) errors.push(`${path}: when "${v.at}" は日時として読めません`);
    if (v.from && v.to && v.from > v.to) errors.push(`${path}: when の from が to より後になっています`);
    if (card.kind === "launch" && !card.site) errors.push(`${path}: 打ち上げ（launch）には射場（site）が要ります`);
  }
}

const unique = [...new Set(errors)];
console.log(`検証対象: ${root}/ （${cards.length}枚）`);
if (unique.length) {
  console.log(`\n${unique.length}件の問題があります:\n`);
  for (const e of unique) console.log(`  - ${e}`);
  process.exit(1);
}
console.log("問題なし");
