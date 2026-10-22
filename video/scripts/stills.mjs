// 確認用のスティル（要所のフレームの静止画）を out/stills/ に書き出す。
// 使い方：node scripts/stills.mjs            … 各ビートの要所
//        node scripts/stills.mjs 300 615     … 指定したフレームだけ
//        VARIANT=sky node scripts/stills.mjs … 流星群版（ふだんはひまわり版）
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {mkdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {webpackOverride} from '../webpack-override.mjs';

const root = path.resolve(import.meta.dirname, '..');

// [ビート, そのビートの頭からの秒]。フレームは timing.json から計算する（ビートの長さを変えてもずれない）
const T = JSON.parse(readFileSync(path.join(root, 'src/timing.json'), 'utf8'));
const VARIANT = process.env.VARIANT ?? 'himawari';
const COMP = {himawari: 'VoyascopeTeaser', sky: 'VoyascopeTeaserSky'}[VARIANT];
const ORDER = T.variants[VARIANT].order;
const secOf = (k) => T.variants[VARIANT].beats[k] ?? T.beats[k];
const beatStart = {};
ORDER.reduce((at, k) => ((beatStart[k] = at), at + Math.round(secOf(k) * T.fps) - T.transition), 0);
const POINTS = [
	['now', 1.0], ['now', 3.0], ['now', 6.5],
	['near', 0.4], ['near', 3.0], ['near', 6.5], ['near', 10.0], ['near', 14.0],
	['sky', 1.6], ['sky', 4.3], ['sky', 7.8], ['sky', 11.2], ['sky', 14.8],
	['depart', 1.0], ['depart', 2.4], ['depart', 3.6], ['depart', 5.0], ['depart', 6.4], ['depart', 7.9], ['depart', 9.4], ['depart', 12.5], ['depart', 17.5],
	['far', 1.5], ['far', 4.0], ['far', 9.0], ['far', 14.5],
	['logo', 1.5], ['logo', 3.6], ['logo', 4.6], ['logo', 5.6], ['logo', 9.5],
	['sources', 4],
];
const DEFAULT = {};
POINTS.filter(([k, s]) => ORDER.includes(k) && s < secOf(k)).forEach(([k, s], i) => {
	DEFAULT[`${String(i).padStart(2, '0')}-${k}`] = [beatStart[k] + Math.round(s * T.fps)];
});
const args = process.argv.slice(2).map(Number);
const frames = args.length ? Object.fromEntries(args.map((f) => [`f`, [f]])) : DEFAULT;

const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts'), webpackOverride, publicDir: path.join(root, 'public')});
const browserExecutable = process.env.REMOTION_BROWSER ?? null;
const chromeMode = process.env.REMOTION_CHROME_MODE ?? 'headless-shell';
const composition = await selectComposition({serveUrl, id: COMP, browserExecutable, chromeMode});
mkdirSync(path.join(root, 'out/stills'), {recursive: true});
for (const [name, list] of Object.entries(frames)) {
	for (const frame of list) {
		const output = path.join(root, `out/stills/${VARIANT}-${name}-${String(frame).padStart(4, '0')}.png`);
		await renderStill({serveUrl, composition, frame, output, browserExecutable, chromeMode});
		console.log(output);
	}
}
