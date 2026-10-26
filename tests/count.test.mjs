import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/lab-worker.js";
import { sourceOf, pathOf, tagOf, dayOf, hit } from "../src/count.js";
import { summarize } from "../web/lab/stats/stats.js";

// D1 のかわり（visits の表だけ）
function fakeD1() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) {
      let args = [];
      return {
        bind(...a) {
          args = a;
          return this;
        },
        async run() {
          if (sql.startsWith("INSERT")) {
            const key = args.join("|");
            rows.set(key, (rows.get(key) ?? 0) + 1);
          }
        },
        async all() {
          return { results: [...rows].map(([k, n]) => { const [day, path, source, tag] = k.split("|"); return { day, path, source, tag, n }; }).filter((r) => r.day >= args[0]) };
        },
      };
    },
  };
}
const post = (body, ua = "Mozilla/5.0 (iPhone) Safari") =>
  new Request("https://voyascope.org/api/hit", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "user-agent": ua } });

test("来た元はドメイン名から種類だけにする", () => {
  assert.equal(sourceOf(""), "direct");
  assert.equal(sourceOf("t.co"), "x");
  assert.equal(sourceOf("x.com"), "x");
  assert.equal(sourceOf("www.google.co.jp"), "search");
  assert.equal(sourceOf("gemini.google.com"), "ai");
  assert.equal(sourceOf("chatgpt.com"), "ai");
  assert.equal(sourceOf("discord.com"), "social");
  assert.equal(sourceOf("example-school.ed.jp"), "other");
  assert.equal(sourceOf("notx.com"), "other");
});

test("道と目印は決まった形だけ", () => {
  assert.equal(pathOf("/"), "/");
  assert.equal(pathOf("/mmx/now/"), "/mmx/now/");
  assert.equal(pathOf("/mmx"), "/mmx/");
  assert.equal(pathOf("/index.html"), "/");
  assert.equal(pathOf("/<script>"), null);
  assert.equal(pathOf("/" + "a".repeat(80)), null);
  assert.equal(tagOf("X1020"), "x1020");
  assert.equal(tagOf("a b"), "");
  assert.equal(tagOf(undefined), "");
});

test("日付は日本時間", () => {
  assert.equal(dayOf(Date.parse("2026-10-20T15:30:00Z")), "2026-10-21");
  assert.equal(dayOf(Date.parse("2026-10-20T14:59:00Z")), "2026-10-20");
});

test("数えるのは日・道・来た元の種類・目印の回数だけ", async () => {
  const STATS = fakeD1();
  const now = Date.parse("2026-10-21T01:00:00Z");
  assert.equal((await hit(post({ p: "/", r: "t.co", s: "x1020" }), { STATS }, now)).status, 204);
  await hit(post({ p: "/", r: "t.co", s: "x1020" }), { STATS }, now);
  await hit(post({ p: "/missions/jwst/", r: "www.google.com" }), { STATS }, now);
  assert.deepEqual([...STATS.rows], [
    ["2026-10-21|/|x|x1020", 2],
    ["2026-10-21|/missions/jwst/|search|", 1],
  ]);
});

test("数えないもの：巡回・サイトの中・こわれた中身・GET", async () => {
  const STATS = fakeD1();
  await hit(post({ p: "/", r: "" }, "Mozilla/5.0 (compatible; Googlebot/2.1)"), { STATS });
  await hit(post({ p: "/", r: "" }, "Mozilla/5.0 HeadlessChrome/140"), { STATS });
  await hit(post({ p: "/", r: "voyascope.org" }), { STATS });
  await hit(post("{こわれた"), { STATS });
  await hit(post({ p: "/", r: "x".repeat(600) }), { STATS });
  await hit(post({ p: "../etc" }), { STATS });
  assert.equal(STATS.rows.size, 0);
  assert.equal((await hit(new Request("https://voyascope.org/api/hit"), { STATS })).status, 405);
});

test("数える先（D1）がないあいだは、何もせず 204", async () => {
  assert.equal((await hit(post({ p: "/" }), {})).status, 204);
});

test("Worker：/api/hit はパスワードなし、表のデータは /lab/ の下でパスワードつき", async () => {
  const STATS = fakeD1();
  const env = { STATS, LAB_PASSWORD: "pw", ASSETS: { fetch: async () => new Response("asset") } };
  assert.equal((await worker.fetch(post({ p: "/", r: "t.co" }), env)).status, 204);
  assert.equal((await worker.fetch(new Request("https://voyascope.org/lab/stats/data"), env)).status, 401);
  const auth = `Basic ${btoa("a:pw")}`;
  const res = await worker.fetch(new Request("https://voyascope.org/lab/stats/data", { headers: { authorization: auth } }), env);
  const data = await res.json();
  assert.equal(data.ready, true);
  assert.equal(data.rows.length, 1);
  assert.equal(data.rows[0].source, "x");
});

test("表：直近7日・前の7日・日ごと・ページ・目印", () => {
  const rows = [
    { day: "2026-10-21", path: "/", source: "x", tag: "x1020", n: 5 },
    { day: "2026-10-20", path: "/", source: "direct", tag: "", n: 3 },
    { day: "2026-10-12", path: "/mmx/", source: "search", tag: "", n: 2 },
  ];
  const s = summarize(rows, "2026-10-21");
  assert.equal(s.last7, 8);
  assert.equal(s.prev7, 2);
  assert.equal(s.days[0].by.x, 5);
  assert.deepEqual(s.pages, [["/", 8], ["/mmx/", 2]]);
  assert.deepEqual(s.tags, [["x1020", 5]]);
});
