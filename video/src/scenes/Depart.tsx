import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Beacon, Captions, Pill, Readout, Scrim, Space, Tag, TmRow, clamp, easeInOut, prog} from '../components/ui';
import {Globe, project} from '../components/Globe';
import {beats, sec} from '../script';
import {facts} from '../facts';
import {C, F} from '../theme';

const b = beats.depart;
const pad = (v: number) => String(Math.floor(v)).padStart(2, '0');
const hms = (s: number) => `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
const vehicleCode = /[（(]([^）)]+)[）)]/.exec(facts.mmx.vehicle)?.[1] ?? facts.mmx.vehicle;
const liftoffClock = facts.mmx.launchJst.slice(11).replace(' JST', ''); // 04:41:03

// 太陽系の模式図：楕円の移行軌道（形は模式。位置は実際のものではない）
const SUN = {x: 1180, y: 470};
const R1 = 280; // 地球の軌道
const R2 = 430; // 火星の軌道
const SQ = 0.42; // 斜めから見た感じ（縦につぶす）
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

// 打ち上げの道（形は模式）：u=0 打ち上げ、u=1 分離、u>1 地球を離れていく
const G = {x: 1320, y: 700, r: 380, tilt: 22};
const ascent = (u: number) => {
	const {lat, lng} = facts.mmx.sitePos;
	const h = u <= 1 ? 0.13 * Math.sqrt(u) : 0.13 + (u - 1) * 1.6;
	return {lat: lat - 9 * Math.min(u, 1.4), lon: lng + 80 * u, h};
};

// ビート3「出発」：種子島から MMX → 太陽系の模式図で火星へ
export const Depart: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const t = frame / 30;

	// --- 前半：地球と打ち上げ
	const out = prog(frame, b.toSolar.from, b.toSolar.to, easeInOut);
	const earth0 = onCircle(R1, TH0);
	const r = interpolate(out, [0, 1], [G.r, 12]);
	const gx = interpolate(out, [0, 1], [G.x, earth0.x]);
	const gy = interpolate(out, [0, 1], [G.y, earth0.y]);
	const spin = -facts.mmx.sitePos.lng - 22 + frame * 0.03;
	const site = project(facts.mmx.sitePos.lat, facts.mmx.sitePos.lng, r, spin, G.tilt);
	const u =
		t < b.liftoff
			? 0
			: t < b.separation
				? easeInOut((t - b.liftoff) / (b.separation - b.liftoff))
				: 1 + 0.5 * Math.min(1, (t - b.separation) / (b.toSolar.from - b.separation));
	const pt = (uu: number) => {
		const a = ascent(uu);
		return project(a.lat, a.lon, r * (1 + a.h), spin, G.tilt);
	};
	const trail = Array.from({length: 80}, (_, i) => pt((u * i) / 79))
		.map((p, i) => `${i ? 'L' : 'M'}${(gx + p.x).toFixed(1)} ${(gy + p.y).toFixed(1)}`)
		.join(' ');
	const head = pt(u);
	const sepPt = pt(1);
	const sepFlash = interpolate(t, [b.separation, b.separation + 0.6], [1, 0], clamp);
	const elapsed = Math.min(u, 1) * facts.mmx.sepElapsedMin * 60;
	const launchUi = interpolate(frame, [sec(b.toSolar.from) - 10, sec(b.toSolar.from) + 6], [1, 0], clamp);
	const fast = t > b.liftoff ? interpolate(t, [b.liftoff, b.liftoff + 0.3, b.separation, b.separation + 0.4], [0, 1, 1, 0], clamp) : 0;
	const sepClock = `≈ ${pad(facts.mmx.sepElapsedMin / 60)}:${pad(facts.mmx.sepElapsedMin % 60)}`;

	// --- 後半：太陽系の模式図
	const solar = prog(frame, b.toSolar.from + 0.6, b.toSolar.to + 0.2);
	const globeFade = 1 - prog(frame, b.toSolar.from + 0.2, b.toSolar.from + 1.1);
	const cruise = prog(frame, b.cruise.from, b.cruise.to, easeInOut);
	const back = prog(frame, 15.2, 19.2);
	const mmx = onTransfer(Math.PI * cruise);
	const mars = onCircle(R2, TH0 + Math.PI - (1 - cruise) * 0.9);
	const earth = onCircle(R1, TH0 + cruise * 1.9);
	const arrived = interpolate(cruise, [0.9, 1], [0, 1], clamp);
	const phA = frame / 7;
	const phobos = {x: mars.x + 36 * Math.cos(phA), y: mars.y + 15 * Math.sin(phA)};
	const backMid = onTransfer(Math.PI * 1.5);

	// 打ち上げ〜分離の小さな線（MMX いまどこ の事象の弧と同じ考え）
	const evW = 560;
	const evP = Math.min(u, 1);

	return (
		<AbsoluteFill>
			<Space drift={0.1} />
			<svg width={width} height={height} style={{position: 'absolute'}}>
				<g opacity={globeFade}>
					<g transform={`translate(${gx} ${gy})`}>
						<Globe r={r} spin={spin} tilt={G.tilt} glow={1 - out} />
					</g>
					{out < 0.5 ? (
						<g opacity={1 - out * 2}>
							{site.z > 0 ? <Beacon x={gx + site.x} y={gy + site.y} color={C.amber} r={7} ring={u === 0} /> : null}
							{u > 0 ? <path d={trail} stroke={C.amber} strokeWidth={4} fill="none" strokeLinecap="round" /> : null}
							{u >= 1 ? (
								<circle cx={gx + sepPt.x} cy={gy + sepPt.y} r={10 + (1 - sepFlash) * 60} fill="none" stroke={C.text} strokeWidth={3} opacity={sepFlash} />
							) : null}
							{u > 0 ? <Beacon x={gx + head.x} y={gy + head.y} color={u >= 1 ? C.mint : C.amber} r={7} ring={false} /> : null}
						</g>
					) : null}
				</g>

				<g opacity={solar}>
					<circle cx={SUN.x} cy={SUN.y} r={70} fill={C.amber} opacity={0.12} />
					<circle cx={SUN.x} cy={SUN.y} r={22} fill={C.amber} />
					<ellipse cx={SUN.x} cy={SUN.y} rx={R1} ry={R1 * SQ} stroke={C.mintDim} strokeWidth={2} fill="none" />
					<ellipse cx={SUN.x} cy={SUN.y} rx={R2} ry={R2 * SQ} stroke={C.ref} strokeOpacity={0.55} strokeWidth={2} fill="none" />
					<path d={arc(onTransfer, 0, Math.PI)} stroke={C.amberDim} strokeWidth={2.5} strokeDasharray="5 10" fill="none" />
					<path d={arc(onTransfer, 0, Math.PI * cruise)} stroke={C.amber} strokeWidth={4} fill="none" />
					{back > 0 ? (
						<path d={arc(onTransfer, Math.PI, Math.PI + Math.PI * back)} stroke={C.mint} strokeWidth={3} strokeDasharray="4 9" fill="none" />
					) : null}
					<circle cx={earth.x} cy={earth.y} r={14} fill={C.mint} />
					<circle cx={mars.x} cy={mars.y} r={13} fill="#e08a5c" />
					<g opacity={arrived}>
						<ellipse cx={mars.x} cy={mars.y} rx={36} ry={15} stroke={C.textDim} strokeWidth={1.5} fill="none" />
						<circle cx={phobos.x} cy={phobos.y} r={5} fill={C.text} />
					</g>
					<Beacon x={mmx.x} y={mmx.y} color={C.amber} r={7} ring={cruise < 1} />
				</g>
			</svg>

			{/* タグ */}
			<Tag
				x={gx + site.x}
				y={gy + site.y}
				dx={-80}
				dy={-70}
				text={facts.mmx.site}
				sub="TANEGASHIMA"
				color={C.amber}
				opacity={Math.max(0, 1 - out * 2) * prog(frame, 0.3, 0.9)}
			/>
			<Tag x={gx + sepPt.x} y={gy + sepPt.y} dx={70} dy={-60} text={`分離 ${facts.mmx.sepJst}ごろ`} sub="MMX SEP" opacity={u >= 1 ? Math.max(0, 1 - out * 2) : 0} />
			<Tag x={SUN.x} y={SUN.y} dx={-50} dy={-80} text="太陽" color={C.amber} opacity={solar} size={26} />
			<Tag x={earth.x} y={earth.y} dx={-70} dy={60} text="地球" opacity={solar} size={26} />
			<Tag x={mars.x} y={mars.y} dx={70} dy={-60} text="火星" color="#f0a67c" sub={arrived > 0.5 ? 'フォボス' : undefined} opacity={solar} size={26} />
			<Tag x={mmx.x} y={mmx.y} dx={50} dy={70} text="MMX" color={C.amber} opacity={solar * interpolate(cruise, [0.7, 0.85], [1, 0], clamp)} size={26} />
			<Tag x={backMid.x} y={backMid.y} dx={-60} dy={-60} text="帰り道（予定）" opacity={back} size={24} />

			<Scrim />
			{/* 左上の計器：打ち上げからの経過（早送り）→ 行き先 → 帰る年度 */}
			<Readout k="T+" value={t < b.separation ? hms(elapsed) : sepClock} opacity={launchUi} />
			<TmRow
				at={0.4}
				opacity={launchUi}
				items={[
					{k: 'LIFTOFF', unit: 'JST', v: liftoffClock, color: C.amber},
					{k: 'VEHICLE', v: vehicleCode},
					{k: 'PAYLOAD', v: 'MMX'},
				]}
			/>
			<svg width={width} height={height} style={{position: 'absolute', opacity: launchUi}}>
				<g transform="translate(84 316)">
					<line x1={0} y1={0} x2={evW} y2={0} stroke="rgba(217,244,234,.35)" strokeWidth={2} />
					<line x1={0} y1={0} x2={evW * evP} y2={0} stroke={C.mint} strokeWidth={3} />
					<circle cx={0} cy={0} r={7} fill={u > 0 ? C.mint : C.text} />
					<circle cx={evW} cy={0} r={7} fill={u >= 1 ? C.amber : C.text} opacity={u >= 1 ? 1 : 0.6} />
					<circle cx={evW * evP} cy={0} r={11} fill="none" stroke={C.amber} strokeWidth={2.5} opacity={u > 0 && u < 1 ? 1 : 0} />
				</g>
			</svg>
			<div
				style={{
					position: 'absolute',
					left: 70,
					top: 332,
					width: evW + 28,
					display: 'flex',
					justifyContent: 'space-between',
					opacity: launchUi,
					fontFamily: F.mono,
					fontSize: 17,
					letterSpacing: '.14em',
				}}
			>
				<span style={{color: C.text}}>LIFTOFF</span>
				<span style={{color: u >= 1 ? C.amber : C.textDim, fontWeight: u >= 1 ? 700 : 400}}>MMX SEP</span>
			</div>
			<Readout
				k="TARGET"
				value="PHOBOS"
				color={C.amber}
				opacity={interpolate(frame, [sec(b.cruise.from) - 6, sec(b.cruise.from) + 6, sec(14.8) - 6, sec(14.8)], [0, 1, 1, 0], clamp)}
				changeAt={b.cruise.from}
			/>
			<Readout k="RETURN" value={`FY${facts.mmx.returnFy}`} color={C.mint} opacity={interpolate(frame, [sec(14.8), sec(14.8) + 6], [0, 1], clamp)} changeAt={14.8} />
			<TmRow at={b.cruise.from} opacity={solar} items={[{k: 'FROM', v: 'EARTH'}, {k: 'TO', v: 'MARS · PHOBOS', color: C.amber}]} />

			<div style={{position: 'absolute', right: 72, top: 116, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10}}>
				{fast > 0 ? (
					<Pill color={C.amber} style={{opacity: fast}}>
						{b.badgeFast} ▶▶
					</Pill>
				) : null}
				{solar > 0 ? <Pill style={{opacity: solar}}>{b.badgeSchematic}</Pill> : null}
			</div>
			<Captions items={b.captions} />
		</AbsoluteFill>
	);
};
