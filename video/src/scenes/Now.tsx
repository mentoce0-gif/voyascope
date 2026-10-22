import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions, Readout, Scrim, Space, Tag, clamp, prog} from '../components/ui';
import {Globe, orbitPoint, splitPath} from '../components/Globe';
import {beats} from '../script';
import {EARTH_RADIUS_KM, facts} from '../facts';
import {C} from '../theme';

const b = beats.now;
const ISS_R = (EARTH_RADIUS_KM + facts.iss.altitudeKm) / EARTH_RADIUS_KM;
export const NOW_EARTH = {x: 1180, y: 500, r: 230}; // 次の場面（Near）もここから始まる

// ビート1「いま」：星の中に地球。照準が合って、ISS の光が回っている
export const Now: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const {x: cx, y: cy, r} = NOW_EARTH;
	const appear = prog(frame, 0, 1.6);
	const lock = prog(frame, b.lockOn.from, b.lockOn.to);
	const spin = -150 + frame * 0.06;
	const issAngle = frame * (360 / (5 * 30)) + 140;
	const orbit = Array.from({length: 181}, (_, i) => orbitPoint(r * ISS_R, i * 2, 51.6, 40, spin, 20));
	const iss = orbitPoint(r * ISS_R, issAngle, 51.6, 40, spin, 20);
	const issVis = iss.z >= 0 || Math.hypot(iss.x, iss.y) > r;
	// 照準：大きく開いた四隅のかぎが、地球に合わせて閉じる
	const box = interpolate(lock, [0, 1], [r * 2.4, r * 1.28]);
	const k = 46;
	const corner = (sx: number, sy: number) => (
		<path
			key={`${sx}${sy}`}
			d={`M${sx * box} ${sy * box - sy * k} L${sx * box} ${sy * box} L${sx * box - sx * k} ${sy * box}`}
			stroke={lock >= 1 ? C.amber : C.mint}
			strokeWidth={3}
			fill="none"
		/>
	);
	const lockedFlash = interpolate(frame, [36 + 36, 36 + 46], [1, 0], clamp) * (lock >= 1 ? 1 : 0);

	return (
		<AbsoluteFill>
			<Space />
			<svg width={width} height={height} style={{position: 'absolute', opacity: appear}}>
				<g transform={`translate(${cx} ${cy})`}>
					<path d={splitPath(orbit, false, r)} stroke={C.mintFaint} strokeWidth={2} fill="none" />
					<Globe r={r} spin={spin} tilt={20} />
					<path d={splitPath(orbit, true, r)} stroke={C.mintDim} strokeWidth={2} fill="none" />
					{issVis ? <circle cx={iss.x} cy={iss.y} r={6} fill={C.text} /> : null}
					<g opacity={interpolate(frame, [20, 36], [0, 1], clamp)}>
						{corner(-1, -1)}
						{corner(1, -1)}
						{corner(-1, 1)}
						{corner(1, 1)}
					</g>
					<circle r={r * 1.28 * 1.25} fill="none" stroke={C.amber} strokeWidth={3} opacity={lockedFlash * 0.6} />
				</g>
			</svg>
			<Tag x={cx + r * 1.28} y={cy - r * 1.28} dx={50} dy={-34} text="TARGET · EARTH" color={C.amber} opacity={lock >= 1 ? interpolate(frame, [72, 84], [0, 1], clamp) : 0} size={24} />
			<Scrim />
			<Readout k={b.readout.key} value={b.readout.value} opacity={appear} />
			<Captions items={b.captions} />
		</AbsoluteFill>
	);
};
