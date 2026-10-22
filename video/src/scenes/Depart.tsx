import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Badges, Beacon, Captions, Pill, Readout, Scrim, Space, Tag, TmRow, clamp, easeInOut, prog} from '../components/ui';
import {Globe, project, splitPath} from '../components/Globe';
import {beats, sec} from '../script';
import {EARTH_RADIUS_KM, GROUND_TRACK, facts} from '../facts';
import {C, F} from '../theme';
import {Layout, useLayout} from '../layout';

const b = beats.depart;
const pad = (v: number) => String(Math.floor(v)).padStart(2, '0');
const hms = (s: number) => `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
const lerp = (a: number, b2: number, t: number) => a + (b2 - a) * t;

// --- 計画（表2）から：事象の時刻（秒）と高度（km）
const steps = facts.mmx.planSteps.map((s) => ({...s, sec: s.t / 1000}));
const stepSec = (en: string) => steps.find((s) => s.en === en)!.sec;
const SECO1 = stepSec('COAST'); // 1回目の燃焼が終わり、慣性飛行に入る
const SELI2 = stepSec('SELI #2');
const SEP = steps.find((s) => s.separation)!.sec;
const COAST_MIN = Math.round((SELI2 - SECO1) / 60); // 約53分
// 高度：表2の事象の値（範囲は始まりと終わり）を結ぶ。絵の高さに使うだけで、画面の数字には出さない
const ALT_PTS: [number, number][] = [
	[0, 0],
	[116, 59],
	[197, 131],
	[292, 208],
	[640, 329],
	[SELI2, 322],
	[stepSec('SELI #2') + 384, 497],
	[SEP, 592],
];
const altAt = (s: number) => {
	for (let i = 0; i < ALT_PTS.length - 1; i++) {
		const [t0, a0] = ALT_PTS[i];
		const [t1, a1] = ALT_PTS[i + 1];
		if (s <= t1) return lerp(a0, a1, Math.max(0, (s - t0) / (t1 - t0)));
	}
	return ALT_PTS[ALT_PTS.length - 1][1];
};
// 地上の経路（計画書の図3から読み取った点）
const trackAt = (s: number) => {
	const g = GROUND_TRACK;
	for (let i = 0; i < g.length - 1; i++) {
		if (s <= g[i + 1].t) {
			const k = Math.max(0, (s - g[i].t) / (g[i + 1].t - g[i].t));
			return {lon: lerp(g[i].lon, g[i + 1].lon, k), lat: lerp(g[i].lat, g[i + 1].lat, k)};
		}
	}
	return g[g.length - 1];
};
const ALT_EXAG = 2; // 高さは2倍に誇張（そのままだと地球の表面にはりついて見えない）

// 動画の秒 → 計画の経過（秒）：上昇〜1回目の燃焼はゆっくり、慣性飛行は速く、2回目の燃焼〜分離はまたゆっくり
const T_ASC = b.liftoff + 1.6;
const T_CST = b.separation - 1.5;
const missionAt = (t: number) => {
	if (t <= b.liftoff) return 0;
	if (t <= T_ASC) return SECO1 * easeInOut((t - b.liftoff) / (T_ASC - b.liftoff));
	if (t <= T_CST) return lerp(SECO1, SELI2, (t - T_ASC) / (T_CST - T_ASC));
	if (t <= b.separation) return lerp(SELI2, SEP, easeInOut((t - T_CST) / (b.separation - T_CST)));
	return SEP;
};

// 太陽系の模式図：楕円の移行軌道（形は模式。位置は実際のものではない）。横と縦で置き場所と大きさが違う
const TH0 = (200 * Math.PI) / 180;
export const solarGeom = (L: Layout) => {
	const SUN = L.vertical ? {x: 540, y: 820} : {x: 1180, y: 470};
	const R1 = L.vertical ? 210 : 280; // 地球の軌道
	const R2 = L.vertical ? 330 : 430; // 火星の軌道
	const SQ = L.vertical ? 0.6 : 0.42; // 斜めから見た感じ（縦につぶす）
	const A = (R1 + R2) / 2;
	const E = (R2 - R1) / (R2 + R1);
	const onTransfer = (nu: number) => {
		const r = (A * (1 - E * E)) / (1 + E * Math.cos(nu));
		const th = TH0 + nu;
		return {x: SUN.x + r * Math.cos(th), y: SUN.y - r * Math.sin(th) * SQ};
	};
	const onCircle = (R: number, th: number) => ({x: SUN.x + R * Math.cos(th), y: SUN.y - R * Math.sin(th) * SQ});
	return {SUN, R1, R2, SQ, onTransfer, onCircle};
};
const arc = (f: (t: number) => {x: number; y: number}, t0: number, t1: number, n = 90) =>
	Array.from({length: n + 1}, (_, i) => f(t0 + ((t1 - t0) * i) / n))
		.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
		.join(' ');


// ビート3「出発」：種子島から、地球を約4分の3周して分離（計画書の表2・図3）→ 太陽系の模式図で火星へ
export const Depart: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const L = useLayout();
	const {SUN, R1, R2, SQ, onTransfer, onCircle} = solarGeom(L);
	const G = L.vertical ? {x: 540, y: 880, r: 380} : {x: 1240, y: 600, r: 360};
	const t = frame / 30;

	// --- 前半：地球と打ち上げ
	const out = prog(frame, b.toSolar.from, b.toSolar.to, easeInOut);
	const earth0 = onCircle(R1, TH0);
	const r = interpolate(out, [0, 1], [G.r, 12]);
	const gx = interpolate(out, [0, 1], [G.x, earth0.x]);
	const gy = interpolate(out, [0, 1], [G.y, earth0.y]);
	const ms = missionAt(t); // 計画の経過（秒）
	const after = Math.max(0, t - b.separation); // 分離のあと（動画の秒）
	const head = trackAt(ms);
	// カメラはロケットを追って地球を回す（ロケットは真ん中より少し右）
	const camLon = Math.min(head.lon, GROUND_TRACK[GROUND_TRACK.length - 1].lon) + after * 4;
	const spin = 18 - camLon;
	const tilt = interpolate(head.lat, [-30, 30], [-18, 24]);
	const P = (s: number, extra = 0) => {
		const g = trackAt(s);
		const h = (altAt(s) / EARTH_RADIUS_KM) * ALT_EXAG + extra;
		return project(g.lat, g.lon, r * (1 + h), spin, tilt);
	};
	// 通ってきた道：直近の約35分ぶんだけ（ぜんぶ残すと地球の縁の外に輪のように見える）
	const n = 120;
	const tr0 = Math.max(0, ms - 2100);
	const trailPts = ms > 0 ? Array.from({length: n}, (_, i) => P(tr0 + ((ms - tr0) * i) / (n - 1))) : [];
	const headPt = P(ms);
	const sepPt = P(SEP);
	// 分離のあと：MMX は地球から離れていく（形は模式）
	const mmxOut = after > 0 ? project(head.lat + after * 4, head.lon + after * 10, r * (1 + (altAt(SEP) / EARTH_RADIUS_KM) * ALT_EXAG + after * 0.7), spin, tilt) : headPt;
	const site = project(GROUND_TRACK[0].lat, GROUND_TRACK[0].lon, r, spin, tilt);
	const sepFlash = interpolate(t, [b.separation, b.separation + 0.6], [1, 0], clamp);
	const launchUi = interpolate(frame, [sec(b.toSolar.from) - 10, sec(b.toSolar.from) + 6], [1, 0], clamp);
	const fast = interpolate(t, [b.liftoff, b.liftoff + 0.3, b.separation, b.separation + 0.5], [0, 1, 1, 0], clamp);
	const cur = [...steps].reverse().find((s) => s.sec <= ms) ?? steps[0];
	const coasting = ms >= SECO1 && ms < SELI2;

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

	// 打ち上げ〜分離の線（MMX いまどこ の事象の弧と同じ考え）。目盛りは表2の時刻に比例
	const evW = L.vertical ? 560 : 620;
	const evY = L.vertical ? 350 : 316;
	const evX = (s: number) => (s / SEP) * evW;
	const evTicks = [
		{s: 0, label: 'LIFTOFF'},
		{s: SECO1, label: ''},
		{s: SELI2, label: ''},
		{s: SEP, label: 'MMX SEP'},
	];

	return (
		<AbsoluteFill>
			<Space drift={0.1} />
			<svg width={width} height={height} style={{position: 'absolute'}}>
				<g opacity={globeFade} transform={`translate(${gx} ${gy})`}>
					<Globe r={r} spin={spin} tilt={tilt} glow={1 - out} />
					{out < 0.5 ? (
						<g opacity={1 - out * 2}>
							{site.z > 0 ? <Beacon x={site.x} y={site.y} color={C.amber} r={7} ring={ms === 0} /> : null}
							{/* 通ってきた道：地球の裏に回ったところは薄い点線、手前ははっきり */}
							<path d={splitPath(trailPts, false)} stroke={C.amberDim} strokeWidth={2} strokeDasharray="3 7" fill="none" />
							<path d={splitPath(trailPts, true)} stroke={C.amber} strokeWidth={4} fill="none" strokeLinecap="round" />
							{after > 0 ? (
								<>
									<circle cx={sepPt.x} cy={sepPt.y} r={10 + (1 - sepFlash) * 60} fill="none" stroke={C.text} strokeWidth={3} opacity={sepFlash} />
									<line x1={sepPt.x} y1={sepPt.y} x2={mmxOut.x} y2={mmxOut.y} stroke={C.mint} strokeWidth={3} strokeDasharray="4 6" />
									<Beacon x={mmxOut.x} y={mmxOut.y} color={C.mint} r={7} ring={false} />
								</>
							) : ms > 0 ? (
								<Beacon x={headPt.x} y={headPt.y} color={C.amber} r={7} ring={false} />
							) : null}
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
				opacity={site.z > 0.25 ? Math.max(0, 1 - out * 2) * prog(frame, 0.3, 0.9) * interpolate(t, [b.liftoff + 1.2, b.liftoff + 1.8], [1, 0], clamp) : 0}
			/>
			<Tag
				x={gx + headPt.x}
				y={gy + headPt.y}
				dx={-40}
				dy={-80}
				text={`慣性飛行 約${COAST_MIN}分`}
				sub="COAST · 地球を回る"
				opacity={coasting ? interpolate(ms, [SECO1, SECO1 + 200, SELI2 - 200, SELI2], [0, 1, 1, 0], clamp) : 0}
			/>
			<Tag
				x={gx + sepPt.x}
				y={gy + sepPt.y}
				dx={-70}
				dy={70}
				text="分離（アフリカの上空）"
				sub={`MMX SEP · 計画 ${hms(SEP)}`}
				opacity={after > 0 ? Math.max(0, 1 - out * 2) : 0}
			/>
			<Tag x={SUN.x} y={SUN.y} dx={-50} dy={-80} text="太陽" color={C.amber} opacity={solar} size={26} />
			<Tag x={earth.x} y={earth.y} dx={-70} dy={60} text="地球" opacity={solar} size={26} />
			<Tag x={mars.x} y={mars.y} dx={70} dy={-60} text="火星" color="#f0a67c" sub={arrived > 0.5 ? 'フォボス' : undefined} opacity={solar} size={26} />
			<Tag x={mmx.x} y={mmx.y} dx={50} dy={70} text="MMX" color={C.amber} opacity={solar * interpolate(cruise, [0.7, 0.85], [1, 0], clamp)} size={26} />
			<Tag x={backMid.x} y={backMid.y} dx={-60} dy={-60} text="帰り道（予定）" opacity={back} size={24} />

			<Scrim />
			{/* 左上の計器：打ち上げからの経過（計画の時刻・早送り）と、計画の高度・速さ → 行き先 → 帰る年度 */}
			<Readout k="T+" value={hms(ms)} opacity={launchUi} />
			<TmRow
				at={0.4}
				opacity={launchUi}
				items={[
					{k: 'ALTITUDE', unit: 'km', v: cur.alt},
					{k: 'VELOCITY', unit: 'km/s', v: cur.vel},
					{k: 'EVENT', v: cur.en, color: C.amber},
				]}
			/>
			<svg width={width} height={height} style={{position: 'absolute', opacity: launchUi}}>
				<g transform={`translate(${L.pad + 4} ${evY})`}>
					<line x1={0} y1={0} x2={evW} y2={0} stroke="rgba(217,244,234,.35)" strokeWidth={2} />
					<line x1={evX(SECO1)} y1={0} x2={evX(SELI2)} y2={0} stroke={C.mint} strokeWidth={2} strokeDasharray="3 6" opacity={0.6} />
					<line x1={0} y1={0} x2={evX(ms)} y2={0} stroke={C.mint} strokeWidth={3} />
					{evTicks.map((e) => (
						<circle key={e.s} cx={evX(e.s)} cy={0} r={6} fill={ms >= e.s && ms > 0 ? C.mint : C.text} opacity={ms >= e.s ? 1 : 0.6} />
					))}
					<circle cx={evX(ms)} cy={0} r={11} fill="none" stroke={C.amber} strokeWidth={2.5} opacity={ms > 0 && ms < SEP ? 1 : 0} />
				</g>
			</svg>
			<div style={{position: 'absolute', left: 0, top: evY + 16, width, opacity: launchUi, fontFamily: F.mono, fontSize: 16, letterSpacing: '.12em'}}>
				{evTicks
					.filter((e) => e.label)
					.map((e) => (
						<span key={e.label} style={{position: 'absolute', left: L.pad + 4 + evX(e.s), transform: e.s === 0 ? 'translateX(-6px)' : e.s === SEP ? 'translateX(calc(-100% + 6px))' : 'translateX(-50%)', color: ms >= e.s ? C.text : C.textDim, whiteSpace: 'nowrap'}}>
							{e.label}
						</span>
					))}
				<span style={{position: 'absolute', left: L.pad + 4 + evX((SECO1 + SELI2) / 2), transform: 'translateX(-50%)', color: coasting ? C.amber : C.textDim, fontFamily: F.body, letterSpacing: 0, fontSize: 18, whiteSpace: 'nowrap'}}>
					慣性飛行 約{COAST_MIN}分
				</span>
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

			<Badges>
				{fast > 0 ? (
					<>
						<Pill color={C.amber} style={{opacity: fast}}>
							{b.badgeFast} ▶▶
						</Pill>
						<Pill style={{opacity: fast}}>{b.badgeAlt}</Pill>
					</>
				) : null}
				{solar > 0 ? <Pill style={{opacity: solar}}>{b.badgeSchematic}</Pill> : null}
			</Badges>
			<Captions items={b.captions} />
		</AbsoluteFill>
	);
};
