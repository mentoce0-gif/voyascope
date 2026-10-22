// 画面の部品。見た目は MMX いまどこ（web/mmx/now/）に合わせる：
// 左上に大きな計器の数字、mint の縦線つきの値、下に3段の字幕（key／太字の title／sub）、丸いピル、点線のリーダーつきのタグ
import React from 'react';
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, F} from '../theme';
import {Caption, sec} from '../script';
import {useLayout} from '../layout';

export const ease = Easing.bezier(0.16, 1, 0.3, 1); // 止まる手前でゆっくり
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const prog = (frame: number, fromS: number, toS: number, e: (t: number) => number = ease) =>
	interpolate(frame, [sec(fromS), sec(toS)], [0, 1], {...clamp, easing: e});
// from〜to のあいだだけ見える（前後 fade フレームで溶ける）
export const window = (frame: number, fromS: number, toS: number, fade = 12) =>
	interpolate(frame, [sec(fromS), sec(fromS) + fade, sec(toS) - fade, sec(toS)], [0, 1, 1, 0], clamp);

const shadow = `0 0 18px ${C.navy900}, 0 0 6px ${C.navy900}, 0 2px 3px rgba(0,0,0,.8)`;

// 背景：navy のグラデーション＋模擬の星（実在の星の位置ではない）
export const Space: React.FC<{drift?: number; density?: number}> = ({drift = 0.12, density = 280}) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const stars = Array.from({length: density}, (_, i) => {
		const x = (((random(`x${i}`) * width - frame * drift * (0.3 + random(`z${i}`))) % width) + width) % width;
		const y = random(`y${i}`) * height;
		const r = 0.5 + random(`r${i}`) ** 3 * 1.8;
		const tw = 0.6 + 0.4 * Math.sin(frame / (12 + random(`t${i}`) * 30) + i);
		return <circle key={i} cx={x} cy={y} r={r} fill={C.text} opacity={tw * (0.2 + random(`o${i}`) * 0.55)} />;
	});
	return (
		<AbsoluteFill style={{background: `radial-gradient(ellipse at 55% 45%, ${C.navy700} 0%, ${C.navy800} 45%, ${C.navy900} 100%)`}}>
			<svg width={width} height={height}>{stars}</svg>
		</AbsoluteFill>
	);
};

// 字幕を読みやすくする、下の暗がり
export const Scrim: React.FC = () => (
	<AbsoluteFill
		style={{
			background: `linear-gradient(180deg, rgba(5,14,31,.55) 0%, rgba(5,14,31,0) 22%, rgba(5,14,31,0) 52%, rgba(5,14,31,.82) 100%)`,
			pointerEvents: 'none',
		}}
	/>
);

// **ではさんだところ** を計器の色の数字にする
const rich = (s: string) =>
	s.split(/\*\*(.+?)\*\*/g).map((part, i) =>
		i % 2 ? (
			<b key={i} style={{fontFamily: F.mono, color: C.mint, fontWeight: 700, margin: '0 .15em'}}>
				{part}
			</b>
		) : (
			<span key={i}>{part}</span>
		),
	);

// 字幕（3段）：左下。key → title（1行ずつ下から）→ sub の順に出る
export const Captions: React.FC<{items: Caption[]}> = ({items}) => {
	const frame = useCurrentFrame();
	const L = useLayout();
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			{items.map((c, i) => {
				const a = window(frame, c.from, c.to, 10);
				if (a <= 0) return null;
				const f0 = sec(c.from);
				const lines = c.title.split('\n');
				return (
					<div key={i} style={{position: 'absolute', left: L.pad, bottom: L.capBottom, right: L.vertical ? L.pad : 700, opacity: a}}>
						<div
							style={{
								fontFamily: F.mono,
								fontSize: 24,
								letterSpacing: '.14em',
								color: C.mint,
								textShadow: shadow,
								opacity: interpolate(frame, [f0, f0 + 8], [0, 1], clamp),
							}}
						>
							{c.key}
						</div>
						<div style={{marginTop: 10}}>
							{lines.map((l, j) => {
								const p = interpolate(frame, [f0 + 4 + j * 5, f0 + 22 + j * 5], [0, 1], {...clamp, easing: ease});
								return (
									<div
										key={j}
										style={{
											fontFamily: F.body,
											fontWeight: 700,
											fontSize: L.capTitle,
											lineHeight: 1.32,
											color: C.text,
											textShadow: shadow,
											opacity: p,
											transform: `translateY(${(1 - p) * 26}px)`,
											whiteSpace: 'nowrap',
										}}
									>
										{l}
									</div>
								);
							})}
						</div>
						{c.sub ? (
							<div
								style={{
									marginTop: 14,
									fontFamily: F.body,
									fontSize: L.capSub,
									color: C.textDim,
									textShadow: shadow,
									opacity: interpolate(frame, [f0 + 16, f0 + 30], [0, 1], clamp),
									whiteSpace: 'nowrap',
								}}
							>
								{rich(c.sub)}
							</div>
						) : null}
					</div>
				);
			})}
		</AbsoluteFill>
	);
};

// 左上の大きな計器の数字（MMX いまどこ の時計と同じ形）。value が変わると下から差し替わる
export const Readout: React.FC<{k: string; value: string; color?: string; changeAt?: number; opacity?: number}> = ({
	k,
	value,
	color = C.text,
	changeAt,
	opacity = 1,
}) => {
	const frame = useCurrentFrame();
	const L = useLayout();
	const p = changeAt === undefined ? 1 : interpolate(frame, [sec(changeAt), sec(changeAt) + 10], [0, 1], {...clamp, easing: ease});
	return (
		<div style={{position: 'absolute', left: L.pad, top: L.readoutTop, opacity, display: 'flex', alignItems: 'baseline', gap: 16, textShadow: shadow}}>
			<span style={{fontFamily: F.mono, fontSize: 24, letterSpacing: '.2em', color: C.mint, opacity: p}}>{k}</span>
			<span
				style={{
					fontFamily: F.mono,
					fontWeight: 700,
					fontSize: 72,
					letterSpacing: '.03em',
					color,
					lineHeight: 1,
					display: 'inline-block',
					opacity: p,
					transform: `translateY(${(1 - p) * 18}px)`,
				}}
			>
				{value}
			</span>
		</div>
	);
};

// 値の行（ラベルは小さく2段、値は mint の縦線つき）
export type TmItem = {k: string; unit?: string; v: string; color?: string};
export const TmRow: React.FC<{items: TmItem[]; at?: number; opacity?: number; top?: number}> = ({items, at = 0, opacity = 1, top}) => {
	const frame = useCurrentFrame();
	const L = useLayout();
	return (
		<div style={{position: 'absolute', left: L.pad, top: top ?? L.tmTop, display: 'flex', gap: L.vertical ? 28 : 40, alignItems: 'flex-end', opacity, textShadow: shadow}}>
			{items.map((it, i) => {
				const p = interpolate(frame, [sec(at) + i * 5, sec(at) + i * 5 + 12], [0, 1], {...clamp, easing: ease});
				return (
					<div key={it.k} style={{display: 'flex', alignItems: 'flex-end', gap: 14, opacity: p, transform: `translateY(${(1 - p) * 10}px)`}}>
						<div style={{fontFamily: F.mono, fontSize: 17, letterSpacing: '.16em', color: C.textDim, lineHeight: 1.3}}>
							{it.k}
							{it.unit ? <div style={{fontSize: 17, letterSpacing: '.1em'}}>{it.unit}</div> : null}
						</div>
						<div
							style={{
								fontFamily: F.mono,
								fontWeight: 700,
								fontSize: L.vertical ? 34 : 40,
								lineHeight: 1,
								paddingLeft: 14,
								borderLeft: `3px solid ${it.color ?? C.mint}`,
								color: it.color === C.amber ? C.amber : C.text,
								whiteSpace: 'nowrap',
							}}
						>
							{it.v}
						</div>
					</div>
				);
			})}
		</div>
	);
};

// 丸いピル（右上の注記・早送り など）
export const Pill: React.FC<{children: React.ReactNode; color?: string; style?: React.CSSProperties; icon?: boolean}> = ({
	children,
	color = C.textDim,
	style,
	icon,
}) => (
	<div
		style={{
			display: 'inline-flex',
			alignItems: 'center',
			gap: 12,
			padding: '8px 20px',
			border: `1.5px solid ${color === C.textDim ? 'rgba(143,179,168,.4)' : color}`,
			borderRadius: 999,
			background: 'rgba(5,14,31,.7)',
			color,
			fontFamily: F.body,
			fontSize: 22,
			whiteSpace: 'nowrap',
			...style,
		}}
	>
		{icon ? (
			<span
				style={{
					width: 22,
					height: 22,
					border: '1.5px solid currentColor',
					borderRadius: '50%',
					display: 'inline-grid',
					placeItems: 'center',
					fontFamily: F.mono,
					fontSize: 14,
					fontStyle: 'italic',
				}}
			>
				i
			</span>
		) : null}
		{children}
	</div>
);

// 場面ごとの注記（模式図・早送り など）を右上に積む。縦では小さくして、計器の下に
export const Badges: React.FC<{children: React.ReactNode; opacity?: number}> = ({children, opacity = 1}) => {
	const L = useLayout();
	return (
		<div
			style={{
				position: 'absolute',
				right: L.vertical ? 48 : 72,
				top: L.badgeTop,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'flex-end',
				gap: 10,
				opacity,
				zoom: L.vertical ? 0.82 : 1,
			}}
		>
			{children}
		</div>
	);
};

// 点（x, y）から点線のリーダーをのばして、太字のタグ（MMX いまどこ の .tag と .leader）
export const Tag: React.FC<{x: number; y: number; text: string; dx?: number; dy?: number; color?: string; opacity?: number; size?: number; sub?: string}> = ({
	x,
	y,
	text,
	dx = 60,
	dy = -60,
	color = C.mint,
	opacity = 1,
	size = 28,
	sub,
}) => {
	if (opacity <= 0) return null;
	const lx = x + dx;
	const ly = y + dy;
	const left = dx >= 0;
	return (
		<>
			<svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity}} width={1} height={1}>
				<line x1={x} y1={y} x2={lx} y2={ly} stroke={color} strokeWidth={1.6} strokeDasharray="5 6" opacity={0.8} />
			</svg>
			<div
				style={{
					position: 'absolute',
					left: lx,
					top: ly,
					transform: `translate(${left ? '8px' : 'calc(-100% - 8px)'}, -50%)`,
					opacity,
					whiteSpace: 'nowrap',
					textShadow: shadow,
					textAlign: left ? 'left' : 'right',
				}}
			>
				<div style={{fontFamily: F.body, fontWeight: 700, fontSize: size, color}}>{text}</div>
				{sub ? <div style={{fontFamily: F.mono, fontSize: size * 0.68, color: C.textDim, letterSpacing: '.08em'}}>{sub}</div> : null}
			</div>
		</>
	);
};

// 光る点（中心・にじみ・脈打つ輪）
export const Beacon: React.FC<{x: number; y: number; color?: string; r?: number; ring?: boolean}> = ({x, y, color = C.mint, r = 7, ring = true}) => {
	const frame = useCurrentFrame();
	const p = (frame % 45) / 45;
	return (
		<g>
			{ring ? <circle cx={x} cy={y} r={r + p * 34} fill="none" stroke={color} strokeWidth={2} opacity={(1 - p) * 0.7} /> : null}
			<circle cx={x} cy={y} r={r * 3} fill={color} opacity={0.18} />
			<circle cx={x} cy={y} r={r} fill={color} />
			<circle cx={x} cy={y} r={r * 0.45} fill="#fff" />
		</g>
	);
};
