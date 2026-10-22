// すべての場面に重ねる帯：左上のブランド、右上の注記のピル、下の「地球からの距離」の目盛り
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, F} from '../theme';
import {FPS, beatStart, chrome} from '../script';
import {useVariant} from '../variant';
import {Pill, clamp, easeInOut} from './ui';

// ブランドのアイコン（web/favicon.svg と同じ形：ロゴの「O」と、斜めに回る金色の輪）
export const BrandIcon: React.FC<{size?: number}> = ({size = 52}) => (
	<svg width={size} height={size} viewBox="0 0 64 64">
		<defs>
			<linearGradient id="bi-ring" x1="0" y1="1" x2="1" y2="0">
				<stop offset="0" stopColor="#ffb547" />
				<stop offset="0.55" stopColor="#ffd27a" />
				<stop offset="1" stopColor="#ffb547" />
			</linearGradient>
			<radialGradient id="bi-spark">
				<stop offset="0" stopColor="#fff8e6" />
				<stop offset="0.35" stopColor="#ffd27a" stopOpacity="0.9" />
				<stop offset="1" stopColor="#ffb547" stopOpacity="0" />
			</radialGradient>
		</defs>
		<circle cx="32" cy="33" r="14" fill="none" stroke="#eef6f3" strokeWidth="4.2" />
		<ellipse cx="32" cy="32" rx="26" ry="8.5" fill="none" stroke="url(#bi-ring)" strokeWidth="3.4" transform="rotate(-40 32 32)" />
		<circle cx="43" cy="17.5" r="6" fill="url(#bi-spark)" />
	</svg>
);

// 目盛りの曲線（ゆるい弧）の上の点
const X0 = 80;
const X1 = 1840;
const Y = 1022;
const BOW = 26;
const at = (t: number) => {
	const x = X0 + (X1 - X0) * t;
	const y = Y - BOW * 4 * t * (1 - t);
	return {x, y};
};
// 目盛りの位置：距離の版は近いほど詰める、流星群の版（アプリの4本柱）は等間隔
const TICKS_BY: Record<string, number[]> = {himawari: [0, 0.2, 0.42, 0.68, 1], sky: [0, 0.25, 0.5, 0.75, 1]};
const posToT = (TICK_T: number[], pos: number) => {
	const i = Math.min(TICK_T.length - 2, Math.floor(pos));
	return TICK_T[i] + (TICK_T[i + 1] - TICK_T[i]) * (pos - i);
};

export const ChromeOverlay: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const v = useVariant();
	const arcCfg = chrome.arcs[v];
	const TICK_T = TICKS_BY[v];
	// ロゴの場面に入ったら消える
	const logoAt = beatStart(v, 'logo');
	const vis = interpolate(frame, [0, 12, logoAt, logoAt + 14], [0, 1, 1, 0], clamp);
	if (vis <= 0) return null;

	// いまの場所（目盛りの位置）を、台本のキーから決める
	const keys = arcCfg.keys.map(([b, s, p]) => [beatStart(v, b) + s * FPS, p] as const);
	let pos = keys[0][1];
	for (let i = 0; i < keys.length - 1; i++) {
		const [f0, p0] = keys[i];
		const [f1, p1] = keys[i + 1];
		if (frame >= f0) pos = interpolate(frame, [f0, f1], [p0, p1], {...clamp, easing: easeInOut});
	}
	const tNow = posToT(TICK_T, pos);
	const nowPt = at(tNow);
	const path = (t0: number, t1: number) =>
		Array.from({length: 60}, (_, i) => at(t0 + ((t1 - t0) * i) / 59))
			.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
			.join(' ');
	const pulse = (frame % 40) / 40;

	return (
		<AbsoluteFill style={{opacity: vis, pointerEvents: 'none'}}>
			{/* 左上：ブランド */}
			<div style={{position: 'absolute', left: 72, top: 40, display: 'flex', alignItems: 'center', gap: 18}}>
				<div
					style={{
						width: 64,
						height: 64,
						borderRadius: '50%',
						border: '1.5px solid rgba(94,242,194,.55)',
						background: 'rgba(5,14,31,.72)',
						display: 'grid',
						placeItems: 'center',
					}}
				>
					<BrandIcon size={48} />
				</div>
				<span style={{fontFamily: F.mono, fontSize: 26, letterSpacing: '.32em', color: C.text}}>VOYASCOPE</span>
			</div>
			{/* 右上：注記 */}
			<div style={{position: 'absolute', right: 72, top: 50}}>
				<Pill icon>{chrome.pill}</Pill>
			</div>

			{/* 下：地球からの距離 */}
			<svg width={width} height={height} style={{position: 'absolute'}}>
				<path d={path(0, 1)} fill="none" stroke="rgba(217,244,234,.3)" strokeWidth={1.5} />
				<path d={path(tNow, 1)} fill="none" stroke={C.mint} strokeWidth={2} strokeDasharray="4 6" opacity={0.5} />
				<path d={path(0, tNow)} fill="none" stroke={C.mint} strokeWidth={3} />
				{TICK_T.map((t, i) => {
					const p = at(t);
					const past = tNow >= t - 0.001;
					return <circle key={i} cx={p.x} cy={p.y} r={past ? 7 : 5} fill={past ? C.mint : C.text} opacity={past ? 1 : 0.6} />;
				})}
				<circle cx={nowPt.x} cy={nowPt.y} r={14 + pulse * 18} fill="none" stroke={C.amber} strokeWidth={2} opacity={1 - pulse} />
				<circle cx={nowPt.x} cy={nowPt.y} r={13} fill="none" stroke={C.amber} strokeWidth={3} />
				<circle cx={nowPt.x} cy={nowPt.y} r={6} fill={C.amber} />
			</svg>
			{arcCfg.ticks.map((tk, i) => {
				const p = at(TICK_T[i]);
				const near = Math.abs(pos - i) < 0.5;
				const align = i === 0 ? 'left' : i === arcCfg.ticks.length - 1 ? 'right' : 'center';
				return (
					<div
						key={tk.label}
						style={{
							position: 'absolute',
							left: p.x,
							top: p.y - 64,
							transform: `translateX(${align === 'left' ? '-6px' : align === 'right' ? 'calc(-100% + 6px)' : '-50%'})`,
							textAlign: align,
							fontFamily: F.mono,
							whiteSpace: 'nowrap',
							textShadow: `0 0 10px ${C.navy900}`,
						}}
					>
						<div style={{fontSize: 19, fontWeight: 700, letterSpacing: '.12em', color: near ? C.amber : C.text, opacity: near ? 1 : 0.75}}>
							{tk.label}
						</div>
						<div style={{fontSize: 16, letterSpacing: '.08em', color: C.textDim}}>{tk.sub || ' '}</div>
					</div>
				);
			})}
			<div style={{position: 'absolute', left: 80, top: Y + 22, fontFamily: F.mono, fontSize: 15, letterSpacing: '.2em', color: C.textDim}}>
				<span style={{fontFamily: /[ぁ-んァ-ン一-龥]/.test(arcCfg.title) ? F.body : F.mono, letterSpacing: /[ぁ-ん]/.test(arcCfg.title) ? '.08em' : undefined}}>{arcCfg.title}</span>
				{arcCfg.note ? <span style={{fontFamily: F.body, letterSpacing: 0, marginLeft: 14}}>（{arcCfg.note}）</span> : null}
			</div>
		</AbsoluteFill>
	);
};
