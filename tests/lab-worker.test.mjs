import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { passwordOf } from "../src/lab-worker.js";

const ASSETS = { fetch: async (req) => new Response(`asset:${new URL(req.url).pathname}`, { headers: { "cache-control": "public, max-age=300" } }) };
const basic = (user, pw) => `Basic ${btoa(String.fromCharCode(...new TextEncoder().encode(`${user}:${pw}`)))}`;
const get = (path, auth, env = { ASSETS, LAB_PASSWORD: "ほし-123" }) =>
  worker.fetch(new Request(`https://voyascope.org${path}`, { headers: auth ? { authorization: auth } : {} }), env);

test("試作の部屋の外は、そのまま配る", async () => {
  const res = await get("/index.html");
  assert.equal(await res.text(), "asset:/index.html");
});

test("パスワードがないと 401（ブラウザの入力の画面を出す）", async () => {
  for (const path of ["/lab", "/lab/", "/lab/obslog/"]) {
    const res = await get(path);
    assert.equal(res.status, 401, path);
    assert.match(res.headers.get("www-authenticate"), /^Basic /);
  }
  assert.equal((await get("/lab/", basic("x", "ちがう"))).status, 401);
  assert.equal((await get("/lab/", "Basic !!!")).status, 401);
});

test("合っていれば配る。名前は何でもよい。キャッシュさせず、検索にも出さない", async () => {
  const res = await get("/lab/obslog/", basic("", "ほし-123"));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "asset:/lab/obslog/");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-robots-tag"), "noindex");
});

test("パスワードを設定していないあいだは開かない", async () => {
  assert.equal((await get("/lab/", basic("", ""), { ASSETS })).status, 503);
});

test("「/laboratory」のような道は試作の部屋ではない", async () => {
  assert.equal(await (await get("/laboratory")).text(), "asset:/laboratory");
});

test("Basic の読み取り：「:」を含むパスワード", () => {
  assert.equal(passwordOf(basic("a", "b:c")), "b:c");
  assert.equal(passwordOf(null), null);
});
