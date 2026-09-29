import { test } from "node:test";
import assert from "node:assert/strict";
import { teamsAboard } from "../web/js/card.js";

const team = (id, launch, ret) => ({
  id,
  launch_date: launch && { value: launch, source: "https://example.org" },
  return_date: ret && { value: ret, source: "https://example.org" },
  crew: [],
});
const data = {
  teams: [
    team("returned", "2026-02-13", "2026-10-10"),
    team("aboard", "2026-07-14"),
    team("future", "2026-10-01"),
    team("no-date"),
  ],
};
const ids = (now) => teamsAboard(data, new Date(now)).map((t) => t.id);

test("打ち上げ済みで、帰還日が来ていないチームだけ", () => {
  assert.deepEqual(ids("2026-09-29T12:00:00Z"), ["returned", "aboard"]);
  assert.deepEqual(ids("2026-10-05T00:00:00Z"), ["returned", "aboard", "future"]);
  assert.deepEqual(ids("2026-10-10T00:00:00Z"), ["aboard", "future"]);
});

test("データがなくても落ちない", () => {
  assert.deepEqual(teamsAboard(undefined, new Date()), []);
});
