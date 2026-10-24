// 描き出しに使う外部の素材を public/assets/ に取ってくる（リポジトリには入れない）。
//   node scripts/fetch-assets.mjs
// 取ってきたものは sha256 で確かめる（中身が変わっていたら止まる）。
//
// - ボイジャー1号の3D模型：NASA Science「Voyager 3D Model」
//     https://science.nasa.gov/resource/voyager-3d-model/
//     クレジット：NASA Visualization Technology Applications and Development (VTAD)
//     NASA の素材は米国では著作権の対象外（NASA Images and Media Usage Guidelines：
//     https://www.nasa.gov/nasa-brand-center/images-and-media/ ）。出典を書き、NASA の推奨と見えないようにする。NASA のロゴは使わない
// - フォント：Zen Kaku Gothic New・JetBrains Mono（SIL Open Font License。google/fonts のリポジトリから）
//     描き出しのときにネットの Google Fonts を読まないので、どの環境でも同じ字になる
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'public/assets');
mkdirSync(dir, {recursive: true});

const GF = 'https://raw.githubusercontent.com/google/fonts/main/ofl';
const ASSETS = [
	{
		file: 'voyager-nasa-vtad.glb',
		url: 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/v/Voyager.glb',
		sha256: '5338241f2e89e9cfe3ebb82f519b4cad64c97e66883cccba6fdda98667aec731',
	},
	{file: 'ZenKakuGothicNew-Medium.ttf', url: `${GF}/zenkakugothicnew/ZenKakuGothicNew-Medium.ttf`, sha256: '651a3f7280b7f36262601ee76d8388a8dc4372dcc67aff025a608939a562b525'},
	{file: 'ZenKakuGothicNew-Bold.ttf', url: `${GF}/zenkakugothicnew/ZenKakuGothicNew-Bold.ttf`, sha256: '0081cedabc4921982fcd061f845a005664ac7fb642af2dd34b4007bc63ccd235'},
	{file: 'JetBrainsMono.ttf', url: `${GF}/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf`, sha256: '48715a42ec242c21e9f02692891e147d022299a52e48d5e413e1a942193ffeda'},
];

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
for (const a of ASSETS) {
	const out = path.join(dir, a.file);
	if (existsSync(out) && sha(out) === a.sha256) {
		console.log(`ok   ${a.file}`);
		continue;
	}
	// curl はプロキシの設定（HTTPS_PROXY）や証明書の設定をそのまま使える
	execFileSync('curl', ['-sSfL', '-o', out, a.url], {stdio: 'inherit'});
	const h = sha(out);
	if (h !== a.sha256) throw new Error(`${a.file} の中身が想定と違います（sha256 ${h}）。出どころを確かめてください`);
	console.log(`got  ${a.file}`);
}
