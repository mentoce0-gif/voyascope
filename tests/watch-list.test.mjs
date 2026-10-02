import { test } from "node:test";
import assert from "node:assert/strict";
import { factsOf, buildWatchList, watchListMarkdown } from "../scripts/watch-list.mjs";

test("factsOf：value と source の組を、入れ子・配列の中まで拾う", () => {
  const card = {
    id: "x",
    status: { value: "operating", source: "https://a.example/", as_of: "2026-10-01" },
    stats: { mass_kg: { value: 1700, unit: "kg", source: "https://b.example/", as_of: "2026-09-30" } },
    site: [{ name: { value: "種子島", source: "https://a.example/" } }],
    links: [{ label: "公式", url: "https://c.example/" }],
    when: { value: { at: "2026-10-19T19:41:03Z" }, source: "https://a.example/", as_of: "2026-10-01" },
  };
  assert.deepEqual(
    factsOf(card).map((f) => [f.path, f.value, f.source]),
    [
      ["status", "operating", "https://a.example/"],
      ["stats.mass_kg", "1700", "https://b.example/"],
      ["site[0].name", "種子島", "https://a.example/"],
      ["when", '{"at":"2026-10-19T19:41:03Z"}', "https://a.example/"],
    ],
  );
});

test("見張り表：curation/ のすべての出典が載り、MMX の打ち上げ日時が入っている", () => {
  const list = buildWatchList("curation");
  assert.ok(list.length > 0);
  const md = watchListMarkdown("curation");
  for (const [source] of list) assert.ok(md.includes(`### ${source}`));
  assert.match(md, /\| mmx-launch \| when \| \{"at":"2026-10-19T19:41:03Z"\} \|/);
});
