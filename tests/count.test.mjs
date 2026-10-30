import { test } from "node:test";
import assert from "node:assert/strict";
import { count, EVENT_NAMES } from "../web/js/count.js";

const withPage = (hostname, fn) => {
  const sent = [];
  const nav = Object.getOwnPropertyDescriptor(globalThis, "navigator"); // Node にもある（読み取りだけ）
  globalThis.location = { hostname };
  Object.defineProperty(globalThis, "navigator", { value: { sendBeacon: (url, body) => sent.push([url, body]) }, configurable: true });
  try {
    fn();
  } finally {
    delete globalThis.location;
    if (nav) Object.defineProperty(globalThis, "navigator", nav);
    else delete globalThis.navigator;
  }
  return sent;
};

test("出来事の回数：本番だけ、決まった名前だけを /e へ送る", () => {
  assert.deepEqual(withPage("voyascope.org", () => count("start")), [["/e", "start"]]);
  assert.deepEqual(withPage("voyascope.org", () => count("東京")), []);
  assert.deepEqual(withPage("localhost", () => count("start")), []);
});

test("出来事の名前は短い英数字（Worker の上限 64 字に入る）", () => {
  for (const n of EVENT_NAMES) assert.match(n, /^[a-z0-9-]{1,32}$/);
});
