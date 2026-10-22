// 確認用のスティル（要所のフレームの静止画）を out/stills/ に書き出す。
// 使い方：node scripts/stills.mjs            … 各ビートの要所
//        node scripts/stills.mjs 300 615     … 指定したフレームだけ
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const DEFAULT = {
	// フレーム＝秒×30。ビートの頭：now 0／near 300／depart 840／far 1440／cta 1980／sources 2400
	'1-now': [45, 120, 230],
	'2-near': [330, 460, 700, 800],
	'3-depart': [880, 1000, 1180, 1300, 1420],
	'4-far': [1500, 1700, 1960],
	'5-cta': [2040, 2110, 2300],
	'6-sources': [2500],
};
const args = process.argv.slice(2).map(Number);
const frames = args.length ? Object.fromEntries(args.map((f) => [`f`, [f]])) : DEFAULT;

const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts')});
const browserExecutable = process.env.REMOTION_BROWSER ?? null;
const chromeMode = process.env.REMOTION_CHROME_MODE ?? 'headless-shell';
const composition = await selectComposition({serveUrl, id: 'VoyascopeTeaser', browserExecutable, chromeMode});
mkdirSync(path.join(root, 'out/stills'), {recursive: true});
for (const [name, list] of Object.entries(frames)) {
	for (const frame of list) {
		const output = path.join(root, `out/stills/${name}-${String(frame).padStart(4, '0')}.png`);
		await renderStill({serveUrl, composition, frame, output, browserExecutable, chromeMode});
		console.log(output);
	}
}
