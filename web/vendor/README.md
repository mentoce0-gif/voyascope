# web/vendor

ブラウザで読み込むライブラリを、npm から取り出して置いている。
CDN を使わないのは、ローカルプレビューだけで動かすため（外部への通信を Google Fonts だけにする）。

| ファイル | 元 | バージョン | ライセンス |
|---|---|---|---|
| `globe.gl.min.js` | npm `globe.gl` の `dist/globe.gl.min.js`（three.js を内蔵） | 2.46.2（three 0.186.1） | MIT（`globe.gl.LICENSE`、`three.LICENSE`） |
| `satellite.min.js` | npm `satellite.js` から必要な関数だけを esbuild でまとめたもの | 7.1.0 | MIT（`satellite.js.LICENSE.md`） |
| `astronomy.min.js` | npm `astronomy-engine` から必要な関数だけを esbuild でまとめたもの（遠くを見る部屋で、月・太陽・惑星までの距離を計算する） | 2.1.19 | MIT（`astronomy-engine.LICENSE.txt`。ファイルの先頭にも残している） |
| `three-r128.min.js` | npm `three` の `src` から、遠くを見る部屋の3D（航路・天体・探査機の模型）で使う部品だけを esbuild でまとめたもの | 0.128.0（r128） | MIT（`three-r128.LICENSE`。ファイルの先頭にも書いている） |

`THIRD_PARTY_NOTICES.txt` は、globe.gl と satellite.js に入っているライブラリ（globe.gl の依存を含む46パッケージ：MIT・ISC・Apache-2.0・Unlicense・0BSD）のライセンス全文。下の「作り直し方」で npm install したあと `node scripts/build-notices.mjs /tmp/vendor/node_modules` で作り直す。

`web/data/land-110m.geojson` は npm `world-atlas`（Natural Earth 1:110m、パブリックドメイン）から `scripts/build-land.cjs` で作った（world-atlas は ISC：`world-atlas.LICENSE`）。画面ではこれを読まず、ここから前もって計算したミニ地図の陸地（`web/data/land-minimap.json`、`scripts/build-minimap-land.mjs`）を読む。

`astronomy.min.js`（gzip 後 約21KB）は、遠くを見る部屋を開いたときだけ読む（起動の読み込み量に入れない。`config/size-budget.json` の far）。npm のパッケージにライセンスのファイルがないため、ソースの先頭に書かれた MIT License の全文を `astronomy-engine.LICENSE.txt` に取り出している。

`three-r128.min.js`（gzip 後 約108KB）は、遠くを見る部屋を開いたときだけ読む（far）。地球の画面の globe.gl に入っている three（0.186.1）とは別に置いている。部屋の試作（`docs/design/far-room-visual-merged.html`）と探査機の模型（`web/js/far/models.js`。Codex 作）が r128 で作られていて、光の強さや色の扱いが新しい版とちがうため（入れ替えると見た目が変わる）。ES モジュールとして `import()` で読むので、`window.THREE` は作らない（globe.gl の部品は、起動のときに `window.THREE` があればそれを使う作りなので、混ざらないようにしている）。

`globe.gl.min.js` は大きい（gzip 後 約510KB）ので、`index.html` の `<link rel="preload">` で最初に読み始め、実行は `js/main.js` がする（ページに `<script>` で書くと、届くまでほかの読み込みが止まる。タスク012）。

## 作り直し方

```
mkdir /tmp/vendor && cd /tmp/vendor && npm init -y
npm install globe.gl@2.46.2 satellite.js@7.1.0
cp node_modules/globe.gl/dist/globe.gl.min.js <repo>/web/vendor/
cat > entry.mjs <<'JS'
export { twoline2satrec, json2satrec } from "./node_modules/satellite.js/dist/io.js";
export { propagate, gstime } from "./node_modules/satellite.js/dist/propagation.js";
export { eciToGeodetic, eciToEcf, ecfToLookAngles, degreesLat, degreesLong, degreesToRadians } from "./node_modules/satellite.js/dist/transforms.js";
JS
npx esbuild entry.mjs --bundle --format=esm --minify --legal-comments=inline --outfile=<repo>/web/vendor/satellite.min.js
```

astronomy-engine（`GeoVector` などの4つだけ。月・太陽・惑星の位置の計算に使う）：

```
mkdir /tmp/astro && cd /tmp/astro && npm init -y && npm install astronomy-engine@2.1.19
cat > entry.mjs <<'JS'
export { GeoVector, Body, MakeTime, KM_PER_AU } from "./node_modules/astronomy-engine/esm/astronomy.js";
JS
npx esbuild entry.mjs --bundle --format=esm --minify --legal-comments=inline --outfile=<repo>/web/vendor/astronomy.min.js
```

satellite.js の入口（`index.js`）は WebAssembly 版も一緒に読み込むため、使う関数だけを直接まとめている。

three.js r128（遠くを見る部屋の3D。使う部品だけ。足りない部品が出たら `entry.mjs` に足して作り直す）：

```
mkdir /tmp/three && cd /tmp/three && npm init -y && npm install three@0.128.0 esbuild
cat > entry.mjs <<'JS'
export { ACESFilmicToneMapping, AdditiveBlending, AmbientLight, BackSide, Box3, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, CubeTexture, CylinderGeometry, DirectionalLight, DodecahedronGeometry, Euler, ExtrudeGeometry, Float32BufferAttribute, Group, HemisphereLight, InstancedMesh, LatheGeometry, LineSegments, LinearFilter, Matrix4, Mesh, MeshStandardMaterial, Object3D, OrthographicCamera, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, Points, Quaternion, RepeatWrapping, Scene, ShaderMaterial, Shape, SphereGeometry, TorusGeometry, Vector2, Vector3, WebGLRenderTarget, WebGLRenderer, sRGBEncoding } from "./node_modules/three/src/Three.js";
JS
npx esbuild entry.mjs --bundle --format=esm --minify --legal-comments=inline \
  --banner:js="/*! three.js r128 (https://github.com/mrdoob/three.js) | Copyright 2010-2021 three.js authors | SPDX-License-Identifier: MIT | VOYASCOPE: subset bundled with esbuild, see web/vendor/README.md */" \
  --outfile=<repo>/web/vendor/three-r128.min.js
cp node_modules/three/LICENSE <repo>/web/vendor/three-r128.LICENSE
```
