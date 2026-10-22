import React from 'react';
import {AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Pill, Space, clamp, ease, easeInOut, prog} from '../components/ui';
import {beats, sec} from '../script';
import {C, F} from '../theme';
// サイトで使っているロゴ（オーナーのもの）をそのまま使う
import logoSrc from '../../../web/assets/brand/logo-1200.webp';

const b = beats.logo;
const LW = 1200; // ロゴの画像の幅（そのままの大きさで出す）
const LH = 207;
const LX = (1920 - LW) / 2;
const LY = 400;
// ロゴの中の金色の輪（画像の座標。金色の画素から測った）
const RING = {cx: 241, cy: 112, rx: 112, ry: 36, rot: -40.7};
const SPARK = {x: 255, y: 57}; // 輪の上の光

// 輪の上の点（角度 a）を画面の座標に
const ringPt = (a: number) => {
	const th = (RING.rot * Math.PI) / 180;
	const x = RING.rx * Math.cos(a);
	const y = RING.ry * Math.sin(a);
	return {x: LX + RING.cx + x * Math.cos(th) - y * Math.sin(th), y: LY + RING.cy + x * Math.sin(th) + y * Math.cos(th)};
};

// ビート5「のぞこう」：ことば → 光が金の輪を描く → 文字が現れて本物のロゴに → URL と注記
export const Logo: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();

	const tag = interpolate(frame, [sec(b.tagline.from), sec(b.tagline.from) + 14, sec(b.tagline.to) - 12, sec(b.tagline.to)], [0, 1, 1, 0], clamp);
	const tagY = interpolate(frame, [sec(b.tagline.from), sec(b.tagline.from) + 20], [24, 0], {...clamp, easing: ease});

	// 光が右から飛んできて（ボイジャー1号へ届いた光のつづき）、輪を1周描く
	const fly = prog(frame, b.ring - 0.6, b.ring, (x) => x * x);
	const draw = prog(frame, b.ring, b.reveal - 0.2, easeInOut);
	const a0 = -0.35; // 描きはじめの角度（右上）
	const startPt = ringPt(a0);
	const flyFrom = {x: width + 40, y: 150};
	const head = draw > 0 ? ringPt(a0 + draw * Math.PI * 2) : {x: flyFrom.x + (startPt.x - flyFrom.x) * fly, y: flyFrom.y + (startPt.y - flyFrom.y) * fly};
	const sparkOn = frame >= sec(b.ring - 0.6) && frame < sec(b.reveal) + 6;
	const ringPath = Array.from({length: 121}, (_, i) => ringPt(a0 + (i / 120) * Math.PI * 2 * draw))
		.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
		.join(' ');

	// 文字：左から現れる（マスクが右へ動く）
	const letters = prog(frame, b.ring + 0.9, b.reveal + 0.2, easeInOut);
	const mask = `linear-gradient(90deg, #000 ${letters * 130 - 30}%, transparent ${letters * 130}%)`;
	const flash = interpolate(frame, [sec(b.reveal), sec(b.reveal) + 4, sec(b.reveal) + 28], [0, 1, 0], clamp);
	const svgRingFade = interpolate(frame, [sec(b.reveal), sec(b.reveal) + 16], [1, 0], clamp);
	const breathe = 0.5 + 0.5 * Math.sin(frame / 20);
	const url = prog(frame, b.reveal + 0.8, b.reveal + 1.6);
	const note = prog(frame, b.reveal + 1.4, b.reveal + 2.2);
	const glow = interpolate(frame, [sec(b.ring), sec(b.reveal)], [0, 1], clamp);

	return (
		<AbsoluteFill>
			<Space drift={0.05} density={220} />
			<AbsoluteFill
				style={{
					background: `radial-gradient(ellipse at ${((LX + RING.cx) / width) * 100}% ${((LY + RING.cy) / height) * 100}%, rgba(255,181,71,${0.14 * glow}) 0%, rgba(255,181,71,0) 38%)`,
				}}
			/>

			{/* ことば */}
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: '50%',
					textAlign: 'center',
					transform: `translateY(calc(-50% + ${tagY}px))`,
					opacity: tag,
					fontFamily: F.body,
					fontWeight: 700,
					fontSize: 88,
					letterSpacing: '.06em',
					color: C.text,
				}}
			>
				{b.tagline.text}
			</div>

			{/* 本物のロゴ（文字が左から現れる） */}
			<Img
				src={logoSrc}
				style={{
					position: 'absolute',
					left: LX,
					top: LY,
					width: LW,
					height: LH,
					WebkitMaskImage: mask,
					maskImage: mask,
					filter: `drop-shadow(0 0 ${10 + 14 * flash}px rgba(94,242,194,${0.18 + 0.25 * flash}))`,
				}}
			/>

			{/* 光が描く金の輪（本物のロゴの輪に重なってから消える） */}
			<svg width={width} height={height} style={{position: 'absolute'}}>
				<defs>
					<linearGradient id="ring-g" x1="0" y1="1" x2="1" y2="0">
						<stop offset="0" stopColor="#ffb547" />
						<stop offset="0.55" stopColor="#ffd27a" />
						<stop offset="1" stopColor="#ffb547" />
					</linearGradient>
					<radialGradient id="spark-g">
						<stop offset="0" stopColor="#fff8e6" />
						<stop offset="0.35" stopColor="#ffd27a" stopOpacity="0.9" />
						<stop offset="1" stopColor="#ffb547" stopOpacity="0" />
					</radialGradient>
				</defs>
				{fly > 0 && draw === 0 ? (
					<line x1={flyFrom.x} y1={flyFrom.y} x2={head.x} y2={head.y} stroke="url(#ring-g)" strokeWidth={2} opacity={0.35} />
				) : null}
				{draw > 0 ? <path d={ringPath} stroke="url(#ring-g)" strokeWidth={7} fill="none" strokeLinecap="round" opacity={svgRingFade} /> : null}
				{sparkOn ? (
					<g>
						<circle cx={head.x} cy={head.y} r={34} fill="url(#spark-g)" />
						<circle cx={head.x} cy={head.y} r={5} fill="#fff" />
					</g>
				) : null}
				{/* 着地の光（ロゴの輪の上の光の位置） */}
				<circle cx={LX + SPARK.x} cy={LY + SPARK.y} r={30 + 70 * flash} fill="url(#spark-g)" opacity={0.85 * flash} />
				<circle cx={LX + SPARK.x} cy={LY + SPARK.y} r={26} fill="url(#spark-g)" opacity={frame > sec(b.reveal) ? 0.25 + 0.2 * breathe : 0} />
			</svg>

			{/* URL と注記（MMX いまどこ のボタンと同じ形） */}
			<div style={{position: 'absolute', left: 0, right: 0, top: LY + LH + 70, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34}}>
				<div
					style={{
						opacity: url,
						transform: `translateY(${(1 - url) * 16}px)`,
						padding: '16px 46px',
						border: `2px solid ${C.amber}`,
						borderRadius: 999,
						background: 'rgba(40,24,6,.82)',
						boxShadow: '0 0 30px rgba(255,181,71,.28)',
						fontFamily: F.mono,
						fontWeight: 700,
						fontSize: 46,
						letterSpacing: '.14em',
						color: C.amber,
					}}
				>
					{b.url}
				</div>
				<div style={{opacity: note}}>
					<Pill icon style={{fontSize: 24}}>
						{b.disclaimer}
					</Pill>
				</div>
			</div>
		</AbsoluteFill>
	);
};
