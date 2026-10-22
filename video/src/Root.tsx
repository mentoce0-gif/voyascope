import React from 'react';
import {AbsoluteFill, Audio, Composition, interpolate, staticFile} from 'remotion';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {FPS, HEIGHT, TRANSITION, Variant, WIDTH, orderOf, sec, secondsOf, totalFrames} from './script';
import {VariantProvider} from './variant';
import {ChromeOverlay} from './components/Chrome';
import {Now} from './scenes/Now';
import {Near} from './scenes/Near';
import {Sky} from './scenes/Sky';
import {Depart} from './scenes/Depart';
import {Far} from './scenes/Far';
import {Logo} from './scenes/Logo';
import {Sources} from './scenes/Sources';

const SCENES = {now: Now, near: Near, sky: Sky, depart: Depart, far: Far, logo: Logo, sources: Sources};

export const Teaser: React.FC<{variant: Variant}> = ({variant}) => {
	const total = totalFrames(variant);
	return (
		<VariantProvider v={variant}>
			<AbsoluteFill style={{background: '#050e1f'}}>
				<TransitionSeries>
					{orderOf(variant).flatMap((k, i) => {
						const S = SCENES[k];
						const seq = (
							<TransitionSeries.Sequence key={k} durationInFrames={sec(secondsOf(variant, k))} name={k}>
								<S />
							</TransitionSeries.Sequence>
						);
						return i === 0
							? [seq]
							: [<TransitionSeries.Transition key={`t${k}`} presentation={fade()} timing={linearTiming({durationInFrames: TRANSITION})} />, seq];
					})}
				</TransitionSeries>
				<ChromeOverlay />
				{/* 音楽：scripts/music.mjs がコードで合成したもの（npm run music） */}
				<Audio
					src={staticFile(`music/theme-${variant}.wav`)}
					volume={(f) => interpolate(f, [0, 10, total - 30, total], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
				/>
			</AbsoluteFill>
		</VariantProvider>
	);
};

const HimawariTeaser: React.FC = () => <Teaser variant="himawari" />;
const SkyTeaser: React.FC = () => <Teaser variant="sky" />;

export const RemotionRoot: React.FC = () => (
	<>
		{/* ひまわり版：ISS → ひまわり9号 → MMX → ボイジャー1号（地球からの距離のものさし） */}
		<Composition id="VoyascopeTeaser" component={HimawariTeaser} durationInFrames={totalFrames('himawari')} fps={FPS} width={WIDTH} height={HEIGHT} />
		{/* 流星群版：ISS → オリオン座流星群 → MMX → ボイジャー1号（衛星・星空・探査機・遠くを見る） */}
		<Composition id="VoyascopeTeaserSky" component={SkyTeaser} durationInFrames={totalFrames('sky')} fps={FPS} width={WIDTH} height={HEIGHT} />
		{/* 縦長（X・ショート向け）は、構図を作り直すときに足す */}
	</>
);
