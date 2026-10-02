# web/vendor

ブラウザで読み込むライブラリを、npm から取り出して置いている。
CDN を使わないのは、ローカルプレビューだけで動かすため（外部への通信を Google Fonts だけにする）。

| ファイル | 元 | バージョン | ライセンス |
|---|---|---|---|
| `globe.gl.min.js` | npm `globe.gl` の `dist/globe.gl.min.js`（three.js を内蔵） | 2.46.2（three 0.186.1） | MIT（`globe.gl.LICENSE`、`three.LICENSE`） |
| `satellite.min.js` | npm `satellite.js` から必要な関数だけを esbuild でまとめたもの | 7.1.0 | MIT（`satellite.js.LICENSE.md`） |

`THIRD_PARTY_NOTICES.txt` は、上の2つに入っているライブラリ（globe.gl の依存を含む46パッケージ：MIT・ISC・Apache-2.0・Unlicense・0BSD）のライセンス全文。下の「作り直し方」で npm install したあと `node scripts/build-notices.mjs /tmp/vendor/node_modules` で作り直す。

`web/data/land-110m.geojson` は npm `world-atlas`（Natural Earth 1:110m、パブリックドメイン）から `scripts/build-land.cjs` で作った（world-atlas は ISC：`world-atlas.LICENSE`）。画面ではこれを読まず、ここから前もって計算したミニ地図の陸地（`web/data/land-minimap.json`、`scripts/build-minimap-land.mjs`）を読む。

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

satellite.js の入口（`index.js`）は WebAssembly 版も一緒に読み込むため、使う関数だけを直接まとめている。
