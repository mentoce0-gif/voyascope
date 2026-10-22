import React from 'react';
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, F} from '../theme';
import {Line, sec} from '../script';

export const ease = Easing.bezier(0.16, 1, 0.3, 1); // 止まる手前でゆっくり
export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const prog = (frame: number, fromS: number, toS: number, e = ease) =>
	interpolate(frame, [sec(fromS), sec(toS)], [0, 1], {...clamp, easing: e});

// 背景：navy のグラデーション＋模擬の星（実在の星の位置ではない）
export const Space: React.FC<{drift?: number; density?: number; fadeIn?: number}> = ({
	drift = 0.15,
	density = 260,
	fadeIn = 0,
}) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const appear = fadeIn ? interpolate(frame, [0, fadeIn], [0, 1], clamp) : 1;
	const stars = Array.from({length: density}, (_, i) => {
		const x = (random(`x${i}`) * width - frame * drift * (0.3 + random(`z${i}`))) % width;
		const y = random(`y${i}`) * height;
		const r = 0.5 + random(`r${i}`) ** 3 * 1.8;
		const tw = 0.55 + 0.45 * Math.sin(frame / (12 + random(`t${i}`) * 30) + i);
		return <circle key={i} cx={(x + width) % width} cy={y} r={r} fill={C.text} opacity={tw * appear * (0.25 + random(`o${i}`) * 0.6)} />;
	});
	return (
		<AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 60%, ${C.navy700} 0%, ${C.navy800} 45%, ${C.navy900} 100%)`}}>
			<svg width={width} height={height}>{stars}</svg>
		</AbsoluteFill>
	);
};

// 観測端末の枠：四隅のかぎ・上のラベル・走査線
export const Hud: React.FC<{label: string; right?: string; note?: string}> = ({label, right, note}) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const k = 44;
	const m = 48;
	const corner = (x: number, y: number, sx: number, sy: number) => (
		<path d={`M${x} ${y + sy * k} L${x} ${y} L${x + sx * k} ${y}`} stroke={C.mintDim} strokeWidth={2} fill="none" />
	);
	const blink = Math.floor(frame / 15) % 2 === 0;
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<svg width={width} height={height} style={{position: 'absolute'}}>
				{corner(m, m, 1, 1)}
				{corner(width - m, m, -1, 1)}
				{corner(m, height - m, 1, -1)}
				{corner(width - m, height - m, -1, -1)}
			</svg>
			<div style={{position: 'absolute', left: m + 18, top: m + 10, fontFamily: F.mono, fontSize: 22, letterSpacing: 4, color: C.mint}}>
				<span style={{color: blink ? C.amber : C.amberDim}}>●</span> VOYASCOPE // {label}
			</div>
			{right ? (
				<div style={{position: 'absolute', right: m + 18, top: m + 10, fontFamily: F.mono, fontSize: 22, letterSpacing: 3, color: C.textDim}}>
					{right}
				</div>
			) : null}
			{note ? (
				<div style={{position: 'absolute', right: m + 18, bottom: m + 10, fontFamily: F.body, fontSize: 20, color: C.textDim}}>{note}</div>
			) : null}
			<AbsoluteFill
				style={{
					background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0.10) 1px, transparent 1px, transparent 4px)',
					mixBlendMode: 'multiply',
				}}
			/>
		</AbsoluteFill>
	);
};

// 字幕（＝ナレーション案）：1行ずつ、下からふわっと
export const Captions: React.FC<{lines: Line[]; align?: 'left' | 'center'}> = ({lines, align = 'left'}) => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			{lines.map((l, i) => {
				const a = interpolate(frame, [sec(l.from), sec(l.from) + 14, sec(l.to) - 10, sec(l.to)], [0, 1, 1, 0], clamp);
				if (a <= 0) return null;
				const y = interpolate(frame, [sec(l.from), sec(l.from) + 18], [24, 0], {...clamp, easing: ease});
				const track = interpolate(frame, [sec(l.from), sec(l.to)], [0.02, 0.08], clamp);
				const size = l.size === 'xl' ? 92 : l.size === 'm' ? 48 : 60;
				const center = align === 'center' || l.size === 'xl';
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: center ? 0 : 140,
							right: center ? 0 : undefined,
							bottom: center ? undefined : 150,
							top: center ? '50%' : undefined,
							textAlign: center ? 'center' : 'left',
							transform: `translateY(${center ? `calc(-50% + ${y}px)` : `${y}px`})`,
							opacity: a,
							fontFamily: F.body,
							fontWeight: 700,
							fontSize: size,
							letterSpacing: `${track}em`,
							color: C.text,
							textShadow: `0 0 24px ${C.navy900}, 0 0 4px ${C.navy900}`,
						}}
					>
						{l.text}
					</div>
				);
			})}
		</AbsoluteFill>
	);
};

// 計器の1行：ラベルと、数字のカウントアップ
export const Readout: React.FC<{
	label: string;
	value: number;
	unit: string;
	decimals?: number;
	from: number;
	to: number;
	x: number;
	y: number;
	color?: string;
	prefix?: string;
}> = ({label, value, unit, decimals = 0, from, to, x, y, color = C.mint, prefix = '約'}) => {
	const frame = useCurrentFrame();
	const p = prog(frame, from, to);
	const show = interpolate(frame, [sec(from) - 6, sec(from) + 6], [0, 1], clamp);
	const v = (value * p).toLocaleString('en-US', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
	return (
		<div style={{position: 'absolute', left: x, top: y, opacity: show}}>
			<div style={{fontFamily: F.mono, fontSize: 20, letterSpacing: 4, color: C.textDim}}>{label}</div>
			<div style={{fontFamily: F.mono, fontSize: 54, fontWeight: 700, color, lineHeight: 1.15}}>
				<span style={{fontFamily: F.body, fontSize: 30, marginRight: 8, color: C.textDim}}>{prefix}</span>
				{v}
				<span style={{fontSize: 28, marginLeft: 10, color: C.textDim}}>{unit}</span>
			</div>
			<div style={{width: 300 * p, height: 2, background: color, opacity: 0.6, marginTop: 6}} />
		</div>
	);
};
