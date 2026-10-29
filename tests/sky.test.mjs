import { test } from "node:test";
import assert from "node:assert/strict";
import { enu, azEl, rotation, cameraDir, project, steer, fists, absoluteAlpha } from "../web/sky/orient.js";
import { meteorLogText, issLogText } from "../web/sky/share.js";

const close = (a, b, tol = 0.5) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`);
const azClose = (a, b, tol = 0.5) => close(((a - b + 540) % 360) - 180, 0, tol);

test("向き：机に置く（画面が上）とカメラは真下", () => {
  close(cameraDir(rotation(0, 0, 0)).el, -90);
});

test("向き：縦に立てると、alpha=0 で北、alpha=90 で西（alpha は反時計回り）", () => {
  const n = cameraDir(rotation(0, 90, 0));
  azClose(n.az, 0);
  close(n.el, 0);
  azClose(cameraDir(rotation(90, 90, 0)).az, 270);
  azClose(cameraDir(rotation(270, 90, 0)).az, 90);
});

test("向き：立てて上に30°傾けると、高さ30°", () => {
  const d = cameraDir(rotation(0, 120, 0));
  close(d.el, 30);
  azClose(d.az, 0);
});

test("投影：カメラの向きは画面の真ん中、上にあるものは画面の上、右にあるものは右", () => {
  const R = rotation(0, 90, 0); // 北・水平
  const opt = { width: 400, height: 800, vfov: 60 };
  const c = project(R, 0, 0, opt);
  close(c.x, 200);
  close(c.y, 400);
  assert.ok(project(R, 0, 20, opt).y < 400);
  assert.ok(project(R, 20, 0, opt).x > 200); // 東は右
  assert.equal(project(R, 180, 0, opt).behind, true);
});

test("案内：右・上と角度", () => {
  const st = steer({ az: 350, el: 10 }, { az: 20, el: 40 });
  close(st.daz, 30);
  close(st.del, 30);
  assert.equal(fists(35), "握りこぶし4個ぶん");
  assert.equal(fists(2), "地平線すれすれ");
});

test("方位：iPhone の webkitCompassHeading（時計回り）を alpha にそろえる", () => {
  const st = {};
  azClose(absoluteAlpha({ alpha: 10, beta: 90, gamma: 0, webkitCompassHeading: 90 }, st), 270);
  assert.equal(absoluteAlpha({ alpha: 10, beta: 90, gamma: 0, absolute: false }, {}), null);
  assert.equal(absoluteAlpha({ alpha: 42, beta: 90, gamma: 0, absolute: true }, {}), 42);
});

test("ENU の往復", () => {
  const v = azEl(enu(123, 45));
  close(v.az, 123);
  close(v.el, 45);
});

test("観測ログの文：流星群と ISS", () => {
  const start = Date.parse("2026-10-21T16:30:00Z"); // 1:30 JST
  assert.equal(
    meteorLogText({ title: "オリオン座流星群", start, end: start + 45 * 60e3, count: 12, sky: "clear" }),
    "#VOYASCOPE OBS-LOG\n20261022_0130 / #オリオン座流星群 / 12 METEORS / 45MIN / ☀\nhttps://voyascope.org/",
  );
  assert.match(meteorLogText({ title: "オリオン座流星群", start, end: start, count: 1, sky: "cloudy" }), / 1 METEOR \/ 1MIN \/ ☁/);
  assert.equal(
    issLogText({ start, sky: "partly", pass: { startAz: 315, endAz: 95, maxEl: 61.6 } }),
    "#VOYASCOPE OBS-LOG\n20261022_0130 / #ISS / NW→E / EL62° / ⛅\nhttps://voyascope.org/",
  );
  assert.match(issLogText({ start, sky: "clear" }), /#ISS \/ ☀/);
});
