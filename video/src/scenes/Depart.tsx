import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions, Hud, Space, clamp, prog} from '../components/ui';
import {Globe, project} from '../components/Globe';
import {beats, sec} from '../script';
import {facts} from '../facts';
import {C, F} from '../theme';

const b = beats.depart;
const LIFTOFF_S = 1.4; // ビートの中で打ち上げる時刻（秒）
const pad = (v: number) => String(Math.floor(v)).padStart(2, '0');

// 太陽系の模式図：楕円の移行軌道（形は模式。位置は実際のものではない）
const SUN = {x: 960, y: 540};
const R1 = 230; // 地球の軌道
const R2 = 340; // 火星の軌道
const SQ = 0.5; // 斜めから見た感じ（縦につぶす）
const TH0 = (200 * Math.PI) / 180;
const A = (R1 + R2) / 2;
const E = (R2 - R1) / (R2 + R1);
const onTransfer = (nu: number) => {
	const r = (A * (1 - E * E)) / (1 + E * Math.cos(nu));
	const th = TH0 + nu;
	return {x: SUN.x + r * Math.cos(th), y: SUN.y - r * Math.sin(th) * SQ};
};
const onCircle = (R: number, th: number) => ({x: SUN.x + R * Math.cos(th), y: SUN.y - R * Math.sin(th) * SQ});
const arc = (f: (t: number) => {x: number; y: number}, t0: number, t1: number, n = 90) =>
	Array.from({length: n + 1}, (_, i) => f(t0 + ((t1 - t0) * i) / n))
		.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
		.join(' ');

// ビート3「出発」：種子島から MMX → 太陽系の模式図で火星へ
export const Depart: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();

	// --- 前半：地球のアップと打ち上げ
	const out = prog(frame, b.toSolar.from, b.toSolar.to);
	const r = interpolate(out, [0, 1], [420, 8]);
	const gx = interpolate(out, [0, 1], [760, onCircle(R1, TH0).x]);
	const gy = interpolate(out, [0, 1], [700, onCircle(R1, TH0).y]);
	const {lat, lng} = facts.mmx.sitePos;
	const spin = -lng + 8 + frame * 0.03;
	const site = project(lat, lng, r, spin, 22);
	const pulse = 0.5 + 0.5 * Math.sin(frame / 5);
	const lp = prog(frame, LIFTOFF_S, b.toSolar.from, (t) => t * t); // 上昇はだんだん速く
	const sx = gx + site.x;
	const sy = gy + site.y;
	const ctrl = {x: sx + 120, y: sy - 520};
	const end = {x: sx + 1150, y: sy - 760};
	const bez = (t: number) => ({
		x: (1 - t) ** 2 * sx + 2 * (1 - t) * t * ctrl.x + t * t * end.x,
		y: (1 - t) ** 2 * sy + 2 * (1 - t) * t * ctrl.y + t * t * end.y,
	});
	const head = bez(lp);
	const tPlus = Math.max(0, frame / 30 - LIFTOFF_S);
	const launchUi = interpolate(frame, [sec(0.3), sec(0.9), sec(b.toSolar.from) - 6, sec(b.toSolar.from) + 6], [0, 1, 1, 0], clamp);

	// --- 後半：太陽系の模式図
	const solar = prog(frame, b.toSolar.from + 0.6, b.toSolar.to + 0.4);
	const cruise = prog(frame, 10.4, 15.6, (t) => t); // 往路（模式）
	const back = prog(frame, 15.2, 19.0); // 帰り道の点線を引く
	const mmx = onTransfer(Math.PI * cruise);
	const marsTh = TH0 + Math.PI - (1 - cruise) * 0.9;
	const mars = onCircle(R2, marsTh);
	const earthTh = TH0 + cruise * 1.9;
	const earth = onCircle(R1, earthTh);
	const arrived = interpolate(cruise, [0.92, 1], [0, 1], clamp);
	const phobosA = frame / 7;
	const phobos = {x: mars.x + 30 * Math.cos(phobosA), y: mars.y + 14 * Math.sin(phobosA)};

	return (
		<AbsoluteFill>
			<Space drift={0.12} />
			<svg width={width} height={height} style={{position: 'absolute'}}>
				{/* 前半 */}
				<g opacity={1 - solar}>
					<g transform={`translate(${gx} ${gy})`}>
						<Globe r={r} spin={spin} tilt={22} glow={1 - out} />
						{site.z > 0 && r > 40 ? (
							<g>
								<circle cx={site.x} cy={site.y} r={14 + 14 * pulse} fill={C.amber} opacity={0.25 * (1 - pulse) + 0.1} />
								<circle cx={site.x} cy={site.y} r={7} fill={C.amber} />
							</g>
						) : null}
					</g>
					{lp > 0 && out < 0.6 ? (
						<g opacity={1 - out / 0.6}>
							<path d={arc(bez, 0, lp, 60)} stroke={C.amber} strokeWidth={3} fill="none" opacity={0.8} />
							<circle cx={head.x} cy={head.y} r={22} fill={C.amber} opacity={0.25} />
							<circle cx={head.x} cy={head.y} r={6} fill="#fff" />
						</g>
					) : null}
				</g>

				{/* 後半：模式図 */}
				<g opacity={solar}>
					<circle cx={SUN.x} cy={SUN.y} r={60} fill={C.amber} opacity={0.12} />
					<circle cx={SUN.x} cy={SUN.y} r={18} fill={C.amber} />
					<ellipse cx={SUN.x} cy={SUN.y} rx={R1} ry={R1 * SQ} stroke={C.mintDim} strokeWidth={1.5} fill="none" />
					<ellipse cx={SUN.x} cy={SUN.y} rx={R2} ry={R2 * SQ} stroke={C.ref} strokeOpacity={0.5} strokeWidth={1.5} fill="none" />
					<path d={arc(onTransfer, 0, Math.PI)} stroke={C.amberDim} strokeWidth={2} strokeDasharray="4 10" fill="none" />
					<path d={arc(onTransfer, 0, Math.PI * cruise)} stroke={C.amber} strokeWidth={3} fill="none" />
					{back > 0 ? (
						<path d={arc(onTransfer, Math.PI, Math.PI + Math.PI * back)} stroke={C.mint} strokeWidth={2} strokeDasharray="3 9" fill="none" opacity={0.8} />
					) : null}
					<circle cx={earth.x} cy={earth.y} r={11} fill={C.mint} />
					<circle cx={mars.x} cy={mars.y} r={10} fill="#e08a5c" />
					<g opacity={arrived}>
						<ellipse cx={mars.x} cy={mars.y} rx={30} ry={14} stroke={C.textDim} strokeWidth={1} fill="none" />
						<circle cx={phobos.x} cy={phobos.y} r={4} fill={C.text} />
					</g>
					<circle cx={mmx.x} cy={mmx.y} r={18} fill={C.amber} opacity={0.3 * (0.6 + 0.4 * pulse)} />
					<circle cx={mmx.x} cy={mmx.y} r={6} fill="#fff" />
				</g>
			</svg>

			{/* 前半の計器 */}
			<div style={{position: 'absolute', left: 1180, top: 230, opacity: launchUi, fontFamily: F.mono, color: C.text}}>
				<div style={{fontSize: 20, letterSpacing: 4, color: C.textDim}}>LIFTOFF / TANEGASHIMA</div>
				<div style={{fontSize: 34, color: C.amber, marginTop: 6}}>{facts.mmx.launchJst}</div>
				<div style={{fontSize: 20, letterSpacing: 4, color: C.textDim, marginTop: 34}}>MISSION ELAPSED</div>
				<div style={{fontSize: 56, fontWeight: 700, color: C.mint}}>
					T+ {pad(tPlus / 3600)}:{pad((tPlus % 3600) / 60)}:{pad(tPlus % 60)}
				</div>
				<div style={{fontFamily: F.body, fontSize: 26, color: C.textDim, marginTop: 30}}>{facts.mmx.vehicle}</div>
			</div>

			{/* 後半のラベル */}
			<div style={{position: 'absolute', inset: 0, opacity: solar, fontFamily: F.body, fontSize: 26}}>
				<div style={{position: 'absolute', left: SUN.x - 24, top: SUN.y + 30, color: C.amber}}>太陽</div>
				<div style={{position: 'absolute', left: earth.x - 20, top: earth.y + 18, color: C.mint}}>地球</div>
				<div style={{position: 'absolute', left: mars.x + 22, top: mars.y - 46, color: '#e8a17a'}}>火星</div>
				<div style={{position: 'absolute', left: mars.x + 40, top: mars.y + 4, color: C.text, opacity: arrived, fontSize: 22}}>フォボス</div>
				<div style={{position: 'absolute', left: mmx.x + 20, top: mmx.y - 50, color: C.amber, fontFamily: F.mono, fontSize: 26, letterSpacing: 3, opacity: interpolate(cruise, [0.75, 0.88], [1, 0], clamp)}}>MMX</div>
				<div style={{position: 'absolute', left: 1440, top: 250, opacity: back, fontFamily: F.mono}}>
					<div style={{fontSize: 20, letterSpacing: 4, color: C.textDim}}>SAMPLE RETURN</div>
					<div style={{fontSize: 54, fontWeight: 700, color: C.mint}}>
						{facts.mmx.returnFy}<span style={{fontFamily: F.body, fontSize: 32, marginLeft: 6}}>年度</span>
					</div>
					<div style={{fontFamily: F.body, fontSize: 22, color: C.textDim}}>（予定）</div>
				</div>
			</div>

			<Captions lines={b.lines} />
			<Hud label="MMX → MARS" right="CH-02" note={solar > 0.01 ? b.schematicNote : undefined} />
		</AbsoluteFill>
	);
};
