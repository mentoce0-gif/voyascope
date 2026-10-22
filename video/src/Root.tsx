import React from 'react';
import {AbsoluteFill, Audio, Composition, interpolate, staticFile} from 'remotion';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {FPS, HEIGHT, ORDER, TOTAL_FRAMES, TRANSITION, WIDTH, beats, sec} from './script';
import {ChromeOverlay} from './components/Chrome';
import {Now} from './scenes/Now';
import {Near} from './scenes/Near';
import {Depart} from './scenes/Depart';
import {Far} from './scenes/Far';
import {Logo} from './scenes/Logo';
import {Sources} from './scenes/Sources';

const SCENES = {now: Now, near: Near, depart: Depart, far: Far, logo: Logo, sources: Sources};

export const Teaser: React.FC = () => (
	<AbsoluteFill style={{background: '#050e1f'}}>
		<TransitionSeries>
			{ORDER.flatMap((k, i) => {
				const S = SCENES[k];
				const seq = (
					<TransitionSeries.Sequence key={k} durationInFrames={sec(beats[k].seconds)} name={k}>
						<S />
					</TransitionSeries.Sequence>
				);
				return i === 0 ? [seq] : [<TransitionSeries.Transition key={`t${k}`} presentation={fade()} timing={linearTiming({durationInFrames: TRANSITION})} />, seq];
			})}
		</TransitionSeries>
		<ChromeOverlay />
		{/* 音楽：scripts/music.mjs がコードで合成したもの（npm run music） */}
		<Audio src={staticFile('music/theme.wav')} volume={(f) => interpolate(f, [0, 10, TOTAL_FRAMES - 30, TOTAL_FRAMES], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />
	</AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="VoyascopeTeaser" component={Teaser} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
		{/* 縦長（X・ショート向け）は、構図を作り直すときに足す */}
	</>
);
