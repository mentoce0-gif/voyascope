import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions, Hud, Space, clamp} from '../components/ui';
import {beats} from '../script';
import {C, F} from '../theme';

const b = beats.now;

// ビート1「いま」：黒から星がにじみ、照準がゆっくり回る
export const Now: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const typed = Math.floor(interpolate(frame, [12, 12 + b.clock.length * 2], [0, b.clock.length], clamp));
	const reticle = interpolate(frame, [20, 70], [0, 1], clamp);
	const rot = frame * 0.25;
	const cx = width / 2;
	const cy = height / 2;
	return (
		<AbsoluteFill>
			<Space fadeIn={50} drift={0.25} />
			<svg width={width} height={height} style={{position: 'absolute', opacity: reticle * 0.8}}>
				<g transform={`translate(${cx} ${cy}) rotate(${rot})`}>
					<circle r={300} fill="none" stroke={C.mintFaint} strokeWidth={2} />
					<circle r={300} fill="none" stroke={C.mintDim} strokeWidth={2} strokeDasharray="4 22" />
					<circle r={420} fill="none" stroke={C.mintFaint} strokeWidth={1} strokeDasharray="120 40" />
					{[0, 90, 180, 270].map((a) => (
						<line key={a} x1={0} y1={-330} x2={0} y2={-380} stroke={C.mint} strokeWidth={3} transform={`rotate(${a})`} />
					))}
				</g>
			</svg>
			<div style={{position: 'absolute', left: 140, top: 160, fontFamily: F.mono, fontSize: 30, letterSpacing: 6, color: C.mint}}>
				{b.clock.slice(0, typed)}
				<span style={{opacity: Math.floor(frame / 12) % 2 ? 0 : 1, color: C.amber}}>▮</span>
			</div>
			<Captions lines={b.lines} />
			<Hud label="OBS-FEED" right="CH-00" />
		</AbsoluteFill>
	);
};
