import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions, Hud, Space, clamp, prog} from '../components/ui';
import {beats, sec} from '../script';
import {facts} from '../facts';
import {C, F} from '../theme';

const b = beats.cta;
const n = (v: number) => v.toLocaleString('en-US');

// これまでの4つの窓（観測端末の4分割）
const PANELS = [
	{ch: 'CH-00', title: 'NOW', value: '2026-10-22', color: C.mint},
	{ch: 'CH-01', title: 'ISS', value: `${n(facts.iss.altitudeKm)} km`, color: C.mint},
	{ch: 'CH-02', title: 'MMX → MARS', value: facts.mmx.launchJst.slice(0, 10), color: C.amber},
	{ch: 'CH-03', title: 'VOYAGER 1 → 1 LIGHT-DAY', value: facts.voyager.lightDayIso, color: C.amber},
];

// ビート5「のぞこう」：4つの窓 → 1つの窓に集まって、ワードマークと URL
export const Cta: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const gather = prog(frame, b.gather.from, b.gather.to);
	const mark = prog(frame, b.wordmarkFrom, b.wordmarkFrom + 1.6);
	const url = prog(frame, b.wordmarkFrom + 1.0, b.wordmarkFrom + 2.2);
	const note = prog(frame, b.wordmarkFrom + 1.8, b.wordmarkFrom + 3.0);
	const panelsIn = prog(frame, 0, 1.0);
	const scan = (frame * 6) % 400;

	const pw = 560;
	const ph = 300;
	const gap = 40;
	return (
		<AbsoluteFill>
			<Space drift={0.08} />
			{PANELS.map((p, i) => {
				const col = i % 2;
				const row = Math.floor(i / 2);
				const x0 = width / 2 - pw - gap / 2 + col * (pw + gap);
				const y0 = height / 2 - ph - gap / 2 + row * (ph + gap);
				const x = interpolate(gather, [0, 1], [x0, width / 2 - pw / 2]);
				const y = interpolate(gather, [0, 1], [y0, height / 2 - ph / 2]);
				const a = panelsIn * interpolate(gather, [0.6, 1], [1, 0], clamp) * interpolate(frame, [sec(i * 0.15), sec(i * 0.15) + 12], [0, 1], clamp);
				return (
					<div
						key={p.ch}
						style={{
							position: 'absolute',
							left: x,
							top: y,
							width: pw,
							height: ph,
							opacity: a * 0.9,
							border: `2px solid ${C.mintDim}`,
							background: 'rgba(7, 20, 43, 0.75)',
							overflow: 'hidden',
						}}
					>
						<div style={{position: 'absolute', left: 0, right: 0, top: scan - 100, height: 2, background: C.mintFaint}} />
						<div style={{position: 'absolute', left: 24, top: 18, fontFamily: F.mono, fontSize: 20, letterSpacing: 4, color: C.textDim}}>{p.ch}</div>
						<div style={{position: 'absolute', left: 24, top: 110, fontFamily: F.mono, fontSize: 30, letterSpacing: 5, color: C.text}}>{p.title}</div>
						<div style={{position: 'absolute', left: 24, top: 160, fontFamily: F.mono, fontSize: 48, fontWeight: 700, color: p.color}}>{p.value}</div>
					</div>
				);
			})}

			<div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
				<div
					style={{
						opacity: mark,
						fontFamily: F.mono,
						fontWeight: 700,
						fontSize: 140,
						letterSpacing: `${interpolate(mark, [0, 1], [0.5, 0.22])}em`,
						marginRight: '-0.22em',
						color: C.text,
						textShadow: `0 0 40px ${C.mintFaint}, 0 0 12px ${C.mintDim}`,
					}}
				>
					VOYASCOPE
				</div>
				<div style={{opacity: url, transform: `translateY(${(1 - url) * 16}px)`, fontFamily: F.mono, fontSize: 48, letterSpacing: 6, color: C.amber, marginTop: 20}}>
					{b.url}
				</div>
				<div style={{opacity: note, fontFamily: F.body, fontSize: 26, color: C.textDim, marginTop: 70}}>{b.disclaimer}</div>
			</div>

			<Captions lines={b.lines} />
			<Hud label="OBS-FEED" right="ALL CH" />
		</AbsoluteFill>
	);
};
