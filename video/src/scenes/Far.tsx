import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Beacon, Captions, Pill, Readout, Scrim, Space, Tag, TmRow, clamp, easeInOut, prog} from '../components/ui';
import {beats, sec} from '../script';
import {facts} from '../facts';
import {C, F} from '../theme';

const b = beats.far;
const SUN = {x: 1560, y: 640};
const VGR = {x: 760, y: 430};
const HELIO = 520; // 太陽圏のはて（模式）
const pad = (v: number) => String(Math.floor(v)).padStart(2, '0');

// ビート4「いちばん遠く」：太陽系が点になるまで引き、光がボイジャー1号まで1日かけて届く
export const Far: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const shrink = prog(frame, 0, 2.6, easeInOut);
	const R1 = interpolate(shrink, [0, 1], [280, 6]);
	const R2 = interpolate(shrink, [0, 1], [430, 10]);
	const sunX = interpolate(shrink, [0, 1], [1180, SUN.x]);
	const sunY = interpolate(shrink, [0, 1], [470, SUN.y]);
	const helio = prog(frame, 1.8, 4.0);
	const vAppear = prog(frame, 0.6, 2.2);
	const c = prog(frame, b.count.from, b.count.to, (x) => x); // 光：時間に比例して進む
	const hours = 24 * c;
	const light = {x: SUN.x + (VGR.x - SUN.x) * c, y: SUN.y + (VGR.y - SUN.y) * c};
	const done = c >= 1;
	const arrive = interpolate(frame, [sec(b.count.to), sec(b.count.to) + 20], [1, 0], clamp);
	const counting = interpolate(frame, [sec(b.count.from) - 8, sec(b.count.from) + 4], [0, 1], clamp);

	return (
		<AbsoluteFill>
			<Space drift={0.04} density={340} />
			<svg width={width} height={height} style={{position: 'absolute'}}>
				{/* 太陽圏のはて（模式）。外側が恒星間空間 */}
				<circle cx={SUN.x} cy={SUN.y} r={HELIO} fill="rgba(168,188,224,0.04)" stroke={C.ref} strokeOpacity={0.45 * helio} strokeWidth={2} strokeDasharray="3 10" opacity={helio} />
				<ellipse cx={sunX} cy={sunY} rx={R1} ry={R1 * 0.42} stroke={C.mintDim} strokeWidth={2} fill="none" />
				<ellipse cx={sunX} cy={sunY} rx={R2} ry={R2 * 0.42} stroke={C.ref} strokeOpacity={0.55} strokeWidth={2} fill="none" />
				<circle cx={sunX} cy={sunY} r={50} fill={C.amber} opacity={0.12} />
				<circle cx={sunX} cy={sunY} r={interpolate(shrink, [0, 1], [22, 9])} fill={C.amber} />
				{/* ボイジャー1号への道 */}
				<line x1={SUN.x} y1={SUN.y} x2={VGR.x} y2={VGR.y} stroke={C.textDim} strokeWidth={2} strokeDasharray="3 9" opacity={vAppear} />
				{/* 光：時間に比例して進む */}
				{c > 0 ? (
					<g>
						<line x1={SUN.x} y1={SUN.y} x2={light.x} y2={light.y} stroke={C.mint} strokeWidth={5} opacity={0.25} />
						<line x1={SUN.x} y1={SUN.y} x2={light.x} y2={light.y} stroke={C.mint} strokeWidth={2.5} />
						{!done ? <Beacon x={light.x} y={light.y} color={C.mint} r={6} ring={false} /> : null}
					</g>
				) : null}
				<g opacity={vAppear}>
					<Beacon x={VGR.x} y={VGR.y} color={done ? C.mint : C.amber} r={8} />
					<circle cx={VGR.x} cy={VGR.y} r={20 + (1 - arrive) * 90} fill="none" stroke={C.mint} strokeWidth={3} opacity={done ? arrive : 0} />
				</g>
			</svg>

			<Tag x={VGR.x} y={VGR.y} dx={-70} dy={-70} text="ボイジャー1号" sub="VOYAGER 1" color={C.amber} opacity={vAppear} />
			<Tag x={SUN.x} y={SUN.y} dx={60} dy={70} text="太陽・地球" opacity={prog(frame, 1.6, 2.4)} size={26} />
			<div
				style={{
					position: 'absolute',
					left: SUN.x - HELIO * 0.7 - 10,
					top: SUN.y - HELIO * 0.7 - 30,
					transform: 'translate(-100%, 0)',
					opacity: helio,
					fontFamily: F.body,
					fontSize: 24,
					color: C.ref,
					textAlign: 'right',
					whiteSpace: 'nowrap',
				}}
			>
				太陽圏のはて（模式）
				<div style={{fontSize: 22, color: C.text, opacity: 0.85}}>← この外が「恒星間空間」</div>
			</div>

			<Scrim />
			<Readout k="LIGHT" value={`${pad(hours)}:${pad((hours * 60) % 60)}:${pad((hours * 3600) % 60)}`} color={done ? C.amber : C.text} opacity={counting} />
			<Readout k="TARGET" value="VOYAGER 1" color={C.amber} opacity={1 - counting} />
			<TmRow
				at={0.4}
				items={[
					{k: 'LAUNCH', v: facts.voyager.launchIso},
					{k: 'LIGHT TRAVEL', unit: '億 km', v: c > 0 ? `約${Math.round(facts.voyager.lightDayOku * c)}` : '—', color: done ? C.amber : C.mint},
				]}
			/>
			<div style={{position: 'absolute', right: 72, top: 116}}>
				<Pill>{b.badge}</Pill>
			</div>
			<Captions items={b.captions} />
		</AbsoluteFill>
	);
};
