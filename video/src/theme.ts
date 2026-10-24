// 見た目はサイト（web/css/style.css）と同じ：navy / amber / mint、Zen Kaku Gothic New と JetBrains Mono
// フォントは手元のファイルから読む（npm run assets で public/assets/ に取ってくる。描き出しのときにネットを使わない）
import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

const zen = {fontFamily: 'Zen Kaku Gothic New'};
const mono = {fontFamily: 'JetBrains Mono'};
loadFont({family: zen.fontFamily, url: staticFile('assets/ZenKakuGothicNew-Medium.ttf'), weight: '500'});
loadFont({family: zen.fontFamily, url: staticFile('assets/ZenKakuGothicNew-Bold.ttf'), weight: '700'});
loadFont({family: mono.fontFamily, url: staticFile('assets/JetBrainsMono.ttf'), weight: '100 800'});

export const C = {
	navy900: '#050e1f',
	navy800: '#07142b',
	navy700: '#0c2140',
	navy600: '#143057',
	mint: '#5ef2c2',
	mintDim: 'rgba(94, 242, 194, 0.55)',
	mintFaint: 'rgba(94, 242, 194, 0.16)',
	amber: '#ffb547',
	amberDim: 'rgba(255, 181, 71, 0.6)',
	text: '#d9f4ea',
	textDim: '#8fb3a8',
	ref: '#a8bce0',
};

export const F = {
	body: `${zen.fontFamily}, sans-serif`,
	mono: `${mono.fontFamily}, monospace`,
};
