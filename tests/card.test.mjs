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

test("帰還の予定が月まで・年までのときは、その月・年が終わるまで滞在中", () => {
  const partial = { teams: [team("month", "2026-02-13", "2026-10"), team("year", "2026-10-01", "2027")] };
  const at = (now) => teamsAboard(partial, new Date(now)).map((t) => t.id);
  assert.deepEqual(at("2026-10-03T00:00:00Z"), ["month", "year"]);
  assert.deepEqual(at("2026-10-31T23:59:59Z"), ["month", "year"]);
  assert.deepEqual(at("2026-11-01T00:00:00Z"), ["year"]);
  assert.deepEqual(at("2027-12-31T00:00:00Z"), ["year"]);
  assert.deepEqual(at("2028-01-01T00:00:00Z"), []);
});

test("データがなくても落ちない", () => {
  assert.deepEqual(teamsAboard(undefined, new Date()), []);
});
