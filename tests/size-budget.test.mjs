import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bootRuleErrors, expandFiles } from "../scripts/lib/size-budget.mjs";

const PRELOAD = { preload: ["vendor/globe.gl.min.js"] };
const page = (head, body = "") => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const GOOD_HEAD = `<link rel="preload" href="vendor/globe.gl.min.js" as="script">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X"></noscript>
  <link rel="stylesheet" href="css/style.css">`;

test("起動の決まり：いまの index.html は守っている", () => {
  assert.deepEqual(bootRuleErrors(readFileSync("web/index.html", "utf8"), PRELOAD), []);
  assert.deepEqual(bootRuleErrors(page(GOOD_HEAD, '<script type="module" src="js/main.js"></script>'), PRELOAD), []);
});

test("起動の決まり：ほかの読み込みを止める <script src> は NG（module・async・defer は OK）", () => {
  const errs = bootRuleErrors(page(GOOD_HEAD, '<script src="vendor/globe.gl.min.js"></script>'), PRELOAD);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /globe\.gl\.min\.js/);
  for (const ok of ['<script async src="a.js"></script>', '<script defer src="a.js"></script>', "<script type='module' src='a.js'></script>", "<script>var a = 1;</script>"]) {
    assert.deepEqual(bootRuleErrors(page(GOOD_HEAD, ok), PRELOAD), [], ok);
  }
  // コメントの中は数えない
  assert.deepEqual(bootRuleErrors(page(GOOD_HEAD, '<!-- <script src="old.js"></script> -->'), PRELOAD), []);
});

test("起動の決まり：外のサイトのスタイルシートは表示を止めない形で読む（noscript の中と自分の CSS は数えない）", () => {
  const blocking = page(`<link rel="preload" href="vendor/globe.gl.min.js" as="script"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">`);
  const errs = bootRuleErrors(blocking, PRELOAD);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /fonts\.googleapis\.com/);
  const screen = page(`<link rel="preload" href="vendor/globe.gl.min.js" as="script"><link rel="stylesheet" media="screen" href="https://example.com/a.css">`);
  assert.equal(bootRuleErrors(screen, PRELOAD).length, 1);
});

test("起動の決まり：大きなライブラリは preload で最初に読み始める", () => {
  const noPreload = page(`<link rel="stylesheet" href="css/style.css">`);
  const errs = bootRuleErrors(noPreload, PRELOAD);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /preload/);
  // as="script" がないものは数えない
  assert.equal(bootRuleErrors(page(`<link rel="preload" href="vendor/globe.gl.min.js">`), PRELOAD).length, 1);
});

test("数えるファイル：* と @craft-index を広げる。当たらない型は missing に入れる", () => {
  const { files, missing } = expandFiles("web", ["js/*.js", "@craft-index", "data/craft-index.json", "data/nothing-*.json", "data/none.json"]);
  assert.ok(files.includes("js/main.js"));
  assert.ok(files.includes("js/view.js"));
  assert.ok(!files.some((f) => f.endsWith(".md")));
  assert.ok(files.includes("data/cards/iss.json"));
  assert.ok(files.includes("data/orbits/iss.json"));
  assert.ok(files.includes("data/craft-index.json"));
  assert.deepEqual(missing, ["data/nothing-*.json", "data/none.json"]);
  // 同じファイルは1回だけ数える
  assert.equal(new Set(files).size, files.length);
});
