import React from 'react';
import {AbsoluteFill, Composition, Sequence, interpolate, useCurrentFrame} from 'remotion';
import {DIP, FPS, HEIGHT, ORDER, TOTAL_FRAMES, WIDTH, beats, sec} from './script';
import {Now} from './scenes/Now';
import {Near} from './scenes/Near';
import {Depart} from './scenes/Depart';
import {Far} from './scenes/Far';
import {Cta} from './scenes/Cta';
import {Sources} from './scenes/Sources';

const SCENES = {now: Now, near: Near, depart: Depart, far: Far, cta: Cta, sources: Sources};

// ビートの頭と終わりに、短い暗転をかける
const Dip: React.FC<{len: number}> = ({len}) => {
	const frame = useCurrentFrame();
	const a = interpolate(frame, [0, DIP, len - DIP, len], [1, 0, 0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return <AbsoluteFill style={{background: '#000', opacity: a}} />;
};

export const Teaser: React.FC = () => {
	let at = 0;
	return (
		<AbsoluteFill style={{background: '#000'}}>
			{ORDER.map((k) => {
				const len = sec(beats[k].seconds);
				const S = SCENES[k];
				const from = at;
				at += len;
				return (
					<Sequence key={k} from={from} durationInFrames={len} name={k}>
						<S />
						<Dip len={len} />
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};

export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="VoyascopeTeaser" component={Teaser} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
		{/* 縦長（X・ショート向け）は、構図を作り直すときに足す */}
	</>
);
