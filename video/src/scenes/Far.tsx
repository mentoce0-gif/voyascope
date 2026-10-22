import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions, Hud, Space, clamp, prog} from '../components/ui';
import {beats, sec} from '../script';
import {facts} from '../facts';
import {C, F} from '../theme';

const b = beats.far;
const SUN = {x: 1480, y: 720};
const VGR = {x: 330, y: 300};
const pad = (v: number) => String(Math.floor(v)).padStart(2, '0');

// ビート4「いちばん遠く」：太陽系が点になるまで引き、光がボイジャー1号まで1日かけて届く
export const Far: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const shrink = prog(frame, 0, 2.4);
	const R1 = interpolate(shrink, [0, 1], [230, 5]);
	const R2 = interpolate(shrink, [0, 1], [340, 8]);
	const helio = interpolate(prog(frame, 1.6, 4.0), [0, 1], [0, 1]);
	const vAppear = prog(frame, 0.4, 2.0);
	const c = prog(frame, b.count.from, b.count.to, (t) => t);
	const hours = 24 * c;
	const light = {x: SUN.x + (VGR.x - SUN.x) * c, y: SUN.y + (VGR.y - SUN.y) * c};
	const counting = interpolate(frame, [sec(b.count.from) - 8, sec(b.count.from) + 4], [0, 1], clamp);
	const done = c >= 1;
	const pulse = 0.5 + 0.5 * Math.sin(frame / 6);
	// ボイジャー1号はゆっくり外へ（動きは演出。速さの比は実際のものではない）
	const vx = VGR.x - frame * 0.03;
	const vy = VGR.y - frame * 0.012;

	return (
		<AbsoluteFill>
			<Space drift={0.04} density={340} />
			<svg width={width} height={height} style={{position: 'absolute'}}>
				{/* 太陽圏のはて（模式） */}
				<circle cx={SUN.x} cy={SUN.y} r={560} fill="none" stroke={C.ref} strokeOpacity={0.35 * helio} strokeWidth={2} strokeDasharray="2 10" />
				{/* 内側の太陽系（だんだん点に） */}
				<ellipse cx={SUN.x} cy={SUN.y} rx={R1} ry={R1 * 0.5} stroke={C.mintDim} strokeWidth={1.5} fill="none" />
				<ellipse cx={SUN.x} cy={SUN.y} rx={R2} ry={R2 * 0.5} stroke={C.ref} strokeOpacity={0.5} strokeWidth={1.5} fill="none" />
				<circle cx={SUN.x} cy={SUN.y} r={interpolate(shrink, [0, 1], [18, 6])} fill={C.amber} />
				<circle cx={SUN.x} cy={SUN.y} r={40} fill={C.amber} opacity={0.1} />
				{/* ボイジャー1号への道 */}
				<line x1={SUN.x} y1={SUN.y} x2={vx} y2={vy} stroke={C.textDim} strokeWidth={1.5} strokeDasharray="3 9" opacity={vAppear} />
				{/* 光：地球から1日かけて届く */}
				{c > 0 ? (
					<g>
						<line x1={SUN.x} y1={SUN.y} x2={light.x} y2={light.y} stroke={C.mint} strokeWidth={3} opacity={0.75} />
						<circle cx={light.x} cy={light.y} r={done ? 0 : 16} fill={C.mint} opacity={0.35} />
						<circle cx={light.x} cy={light.y} r={done ? 0 : 5} fill="#fff" />
					</g>
				) : null}
				<g opacity={vAppear}>
					<circle cx={vx} cy={vy} r={done ? 40 * pulse + 12 : 16} fill={done ? C.mint : C.amber} opacity={0.25} />
					<circle cx={vx} cy={vy} r={7} fill="#fff" />
				</g>
			</svg>

			<div style={{position: 'absolute', left: vx - 20, top: vy - 150, opacity: vAppear, fontFamily: F.mono, color: C.amber}}>
				<div style={{fontSize: 30, letterSpacing: 4}}>VOYAGER 1</div>
				<div style={{fontSize: 20, letterSpacing: 3, color: C.textDim}}>LAUNCH {facts.voyager.launchIso}</div>
				<div style={{fontFamily: F.body, fontSize: 22, color: C.text, marginTop: 4, opacity: helio}}>恒星間空間</div>
			</div>
			<div style={{position: 'absolute', left: SUN.x - 30, top: SUN.y + 40, fontFamily: F.body, fontSize: 24, color: C.mint}}>太陽・地球</div>
			<div style={{position: 'absolute', left: SUN.x - 250, top: SUN.y - 600, opacity: helio, fontFamily: F.body, fontSize: 22, color: C.ref}}>太陽圏（模式）</div>

			{/* 計器：光の時間と距離 */}
			<div style={{position: 'absolute', left: 1140, top: 200, opacity: counting, fontFamily: F.mono}}>
				<div style={{fontSize: 20, letterSpacing: 4, color: C.textDim}}>LIGHT TIME FROM EARTH</div>
				<div style={{fontSize: 64, fontWeight: 700, color: done ? C.amber : C.mint}}>
					{pad(hours)}:{pad((hours * 60) % 60)}:{pad((hours * 3600) % 60)}
				</div>
				<div style={{fontSize: 20, letterSpacing: 4, color: C.textDim, marginTop: 24}}>DISTANCE</div>
				<div style={{fontSize: 56, fontWeight: 700, color: done ? C.amber : C.mint}}>
					<span style={{fontFamily: F.body, fontSize: 30, color: C.textDim, marginRight: 8}}>約</span>
					{Math.round(facts.voyager.lightDayOku * c)}
					<span style={{fontFamily: F.body, fontSize: 34, marginLeft: 8}}>億 km</span>
				</div>
			</div>

			<Captions lines={b.lines} />
			<Hud label="INTERSTELLAR" right="CH-03" note={b.schematicNote} />
		</AbsoluteFill>
	);
};
