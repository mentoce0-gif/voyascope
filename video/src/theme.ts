// 見た目はサイト（web/css/style.css）と同じ：navy / amber / mint、Zen Kaku Gothic New と JetBrains Mono
import {loadFont as loadZen} from '@remotion/google-fonts/ZenKakuGothicNew';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';

const zen = loadZen('normal', {weights: ['500', '700']});
const mono = loadMono('normal', {weights: ['400', '700'], subsets: ['latin']});

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
