import React from 'react';
import {AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {Beacon, Captions, Pill, Readout, Scrim, Space, Tag, TmRow, clamp, ease, easeInOut, prog} from '../components/ui';
import {beats, sec} from '../script';
import {facts} from '../facts';
import {C, F} from '../theme';

const b = beats.sky;
const o = facts.orionids;
const D = Math.PI / 180;

// --- 夜空：赤経・赤緯をそのまま平らに（南の空を見上げた向き。東が左）
const SKY = {ra0: 88, dec0: 9, k: 24, cx: 1180, cy: 470};
const skyXY = (ra: number, dec: number) => ({
	x: SKY.cx - (ra - SKY.ra0) * Math.cos(SKY.dec0 * D) * SKY.k,
	y: SKY.cy - (dec - SKY.dec0) * SKY.k,
});
const RAD = skyXY(o.radiant.ra, o.radiant.dec);

// --- ハレー彗星の軌道（JPL SBDB の軌道要素から計算。黄道を上から見た図）
const HALLEY = (() => {
	const {e, a, i, om, w} = o.orbit;
	const cO = Math.cos(om * D), sO = Math.sin(om * D), cw = Math.cos(w * D), sw = Math.sin(w * D), ci = Math.cos(i * D);
	return Array.from({length: 721}, (_, k) => {
		const E = (k / 720) * Math.PI * 2;
		const x = a * (Math.cos(E) - e);
		const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
		return {X: (cO * cw - sO * sw * ci) * x + (-cO * sw - sO * cw * ci) * y, Y: (sO * cw + cO * sw * ci) * x + (-sO * sw + cO * cw * ci) * y};
	});
})();
// 極大のころの地球：太陽黄経（カードの値）の反対側
const EARTH_L = (o.solarLon - 180) * D;
const EARTH = {X: Math.cos(EARTH_L), Y: Math.sin(EARTH_L)};

// ビート「星空」：オリオン座流星群（夜空）→ もとをたどるとハレー彗星
export const Sky: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const t = frame / 30;

	const skyOn = 1 - prog(frame, b.toHalley.from, b.toHalley.from + 0.8);
	const halleyOn = prog(frame, b.toHalley.from + 0.4, b.toHalley.to);

	// 流れ星：放射点から外へ（数・向き・長さは演出）
	const meteors = b.meteors.map((tm, i) => {
		const dt = t - tm;
		if (dt < 0 || dt > 0.9) return null;
		const ang = random(`ma${i}`) * Math.PI * 2;
		const d0 = 70 + random(`md${i}`) * 230;
		const L = 170 + random(`ml${i}`) * 230;
		const p = Math.min(1, dt / 0.5);
		const head = d0 + L * ease(p);
		const tail = d0 + L * Math.max(0, ease(p) - 0.45);
		const fade = interpolate(dt, [0, 0.08, 0.5, 0.9], [0, 1, 0.8, 0], clamp);
		const hx = RAD.x + Math.cos(ang) * head, hy = RAD.y + Math.sin(ang) * head;
		const tx = RAD.x + Math.cos(ang) * tail, ty = RAD.y + Math.sin(ang) * tail;
		return (
			<g key={i} opacity={fade}>
				<defs>
					<linearGradient id={`mg${i}`} gradientUnits="userSpaceOnUse" x1={tx} y1={ty} x2={hx} y2={hy}>
						<stop offset="0" stopColor="#ffffff" stopOpacity={0} />
						<stop offset="1" stopColor="#ffffff" stopOpacity={1} />
					</linearGradient>
				</defs>
				<line x1={tx} y1={ty} x2={hx} y2={hy} stroke={`url(#mg${i})`} strokeWidth={3} strokeLinecap="round" />
				<circle cx={hx} cy={hy} r={3.5} fill="#fff" />
				<circle cx={hx} cy={hy} r={12} fill={C.mint} opacity={0.25} />
			</g>
		);
	});

	// ハレー彗星の図のカメラ：地球のそばから、軌道ぜんたいへ引く
	const z = prog(frame, b.toHalley.to, b.toHalley.to + 3.2, easeInOut);
	const s = Math.exp(interpolate(z, [0, 1], [Math.log(230), Math.log(25)]));
	const focus = {X: interpolate(z, [0, 1], [EARTH.X, 0]), Y: interpolate(z, [0, 1], [EARTH.Y, 0])};
	const anchor = {x: interpolate(z, [0, 1], [1200, 1500]), y: interpolate(z, [0, 1], [520, 880])};
	const toScr = (p: {X: number; Y: number}) => ({x: anchor.x + (p.X - focus.X) * s, y: anchor.y - (p.Y - focus.Y) * s});
	const halleyD = HALLEY.map((p, k) => {
		const q = toScr(p);
		return `${k ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
	}).join(' ');
	const sun = toScr({X: 0, Y: 0});
	const earth = toScr(EARTH);
	const far = toScr(HALLEY[360]); // 遠日点のあたり
	const pulse = (frame % 40) / 40;

	return (
		<AbsoluteFill>
			<Space drift={0.03} density={360} />
			{/* 夜空 */}
			<svg width={width} height={height} style={{position: 'absolute', opacity: skyOn}}>
				{o.lines.map(([a2, b2], i) => {
					const p = skyXY(o.stars[a2].ra, o.stars[a2].dec);
					const q = skyXY(o.stars[b2].ra, o.stars[b2].dec);
					return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={C.ref} strokeOpacity={0.45} strokeWidth={1.5} />;
				})}
				{o.stars.map((st) => {
					const p = skyXY(st.ra, st.dec);
					const r = Math.max(2.2, 7 - st.mag * 1.4);
					return (
						<g key={st.name}>
							<circle cx={p.x} cy={p.y} r={r * 3} fill="#fff" opacity={0.08} />
							<circle cx={p.x} cy={p.y} r={r} fill={st.name.startsWith('ベテルギウス') ? '#ffd2a8' : '#e8f1ff'} />
						</g>
					);
				})}
				{/* 放射点 */}
				<circle cx={RAD.x} cy={RAD.y} r={16 + pulse * 26} fill="none" stroke={C.amber} strokeWidth={2} opacity={1 - pulse} />
				<circle cx={RAD.x} cy={RAD.y} r={10} fill="none" stroke={C.amber} strokeWidth={2.5} />
				{meteors}
			</svg>
			<div style={{opacity: skyOn}}>
				<Tag x={RAD.x} y={RAD.y} dx={-70} dy={-50} text="放射点" sub="RADIANT" color={C.amber} opacity={prog(frame, 0.6, 1.2)} size={26} />
				<Tag x={skyXY(o.stars[0].ra, o.stars[0].dec).x} y={skyXY(o.stars[0].ra, o.stars[0].dec).y} dx={110} dy={-40} text="オリオン座" color={C.ref} opacity={prog(frame, 1.0, 1.6)} size={26} />
			</div>

			{/* ハレー彗星の軌道（上から見た図） */}
			<svg width={width} height={height} style={{position: 'absolute', opacity: halleyOn}}>
				<circle cx={sun.x} cy={sun.y} r={Math.max(8, s * 0.12)} fill={C.amber} />
				<circle cx={sun.x} cy={sun.y} r={Math.max(24, s * 0.3)} fill={C.amber} opacity={0.12} />
				<circle cx={sun.x} cy={sun.y} r={s} fill="none" stroke={C.mintDim} strokeWidth={2} />
				<path d={halleyD} fill="none" stroke={C.ref} strokeWidth={2.5} />
				<Beacon x={earth.x} y={earth.y} color={C.mint} r={8} />
			</svg>
			<div style={{opacity: halleyOn}}>
				<Tag x={earth.x} y={earth.y} dx={90} dy={interpolate(z, [0, 1], [60, -90])} text={`${o.peakJa}ごろの地球`} sub="ハレー彗星の通り道のすぐ近く" opacity={1} size={26} />
				<Tag x={sun.x} y={sun.y} dx={50} dy={-60} text="太陽" color={C.amber} opacity={prog(frame, b.toHalley.to + 1.4, b.toHalley.to + 2.2)} size={24} />
				<Tag x={far.x} y={far.y} dx={60} dy={40} text="ハレー彗星の軌道" color={C.ref} opacity={prog(frame, b.toHalley.to + 2.4, b.toHalley.to + 3.2)} size={26} />
			</div>

			<Scrim />
			{/* 左上の計器 */}
			<Readout k="PEAK" value={o.peakIso} color={C.text} opacity={1 - halleyOn} />
			<TmRow
				at={0.4}
				opacity={1 - halleyOn}
				items={[
					{k: 'RADIANT', unit: 'RA / DEC', v: `${o.radiant.ra.toFixed(1)}° / +${o.radiant.dec.toFixed(1)}°`, color: C.amber},
					{k: 'RATE', unit: '/h', v: o.rate},
				]}
			/>
			<Readout k="PARENT" value="1P/HALLEY" color={C.ref} opacity={halleyOn} changeAt={b.toHalley.from + 0.4} />
			<TmRow at={b.toHalley.to} opacity={halleyOn} items={[{k: 'PERIHELION', unit: 'au', v: o.orbit.q.toFixed(2)}, {k: 'ECCENTRICITY', v: o.orbit.e.toFixed(3)}]} />
			<div style={{position: 'absolute', right: 72, top: 116}}>
				{halleyOn < 1 ? <Pill style={{opacity: 1 - halleyOn}}>{b.badgeMeteors}</Pill> : null}
				{halleyOn > 0 ? <Pill style={{opacity: halleyOn}}>{b.badgeHalley}</Pill> : null}
			</div>
			<Captions items={b.captions} />
		</AbsoluteFill>
	);
};
