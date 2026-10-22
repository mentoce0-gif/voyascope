import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions, Hud, Readout, Space, clamp, prog} from '../components/ui';
import {Globe, orbitPoint, project, splitPath} from '../components/Globe';
import {beats, sec} from '../script';
import {EARTH_RADIUS_KM, facts} from '../facts';
import {C, F} from '../theme';

const b = beats.near;
// 軌道の半径（地球の半径を1とした比）。カードの高さから計算するので、比は本物どおり
const ISS_R = (EARTH_RADIUS_KM + facts.iss.altitudeKm) / EARTH_RADIUS_KM;
const GEO_R = (EARTH_RADIUS_KM + facts.himawari.altitudeKm) / EARTH_RADIUS_KM;
const TILT = 20;
const ISS_INCL = 51.6; // 見た目の傾き（画面に数字は出さない）
const JAPAN = {lat: 36, lon: 138};

// ビート2「すぐ上」：ISS が地球すれすれを回る → 静止軌道まで引く
export const Near: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const z = prog(frame, b.zoomOut.from, b.zoomOut.to);
	const r = interpolate(z, [0, 1], [330, 68]);
	const cx = interpolate(z, [0, 1], [780, 960]);
	const cy = interpolate(z, [0, 1], [560, 540]);
	const spin = -150 + frame * 0.06;

	// ISS：アニメーションでは約5秒で1周（本物は約90分）
	const issAngle = frame * (360 / (5 * 30)) + 200;
	const orbitPts = Array.from({length: 181}, (_, i) => orbitPoint(r * ISS_R, i * 2, ISS_INCL, 40, spin, TILT));
	const iss = orbitPoint(r * ISS_R, issAngle, ISS_INCL, 40, spin, TILT);
	const issVisible = iss.z >= 0 || Math.hypot(iss.x, iss.y) > r;
	const trail = Array.from({length: 30}, (_, i) => orbitPoint(r * ISS_R, issAngle - i * 1.5, ISS_INCL, 40, spin, TILT));

	// 静止軌道：赤道の上の円。ひまわり9号は地球と一緒に回るので、日本の経度の上に止まって見える
	const geoAppear = prog(frame, b.zoomOut.from + 1.2, b.zoomOut.to + 1.2);
	const geoPts = Array.from({length: 181}, (_, i) => project(0, i * 2, r * GEO_R, spin, TILT));
	const hima = project(0, JAPAN.lon + 2, r * GEO_R, spin, TILT);
	const japan = project(JAPAN.lat, JAPAN.lon, r, spin, TILT);

	const nearUi = interpolate(frame, [sec(b.zoomOut.from) - 10, sec(b.zoomOut.from) + 10], [1, 0], clamp);
	const farUi = interpolate(frame, [sec(b.zoomOut.to) - 10, sec(b.zoomOut.to) + 10], [0, 1], clamp);
	const pulse = 0.6 + 0.4 * Math.sin(frame / 6);

	return (
		<AbsoluteFill>
			<Space drift={0.1} />
			<svg width={width} height={height} style={{position: 'absolute'}}>
				<g transform={`translate(${cx} ${cy})`}>
					{/* 静止軌道（奥） */}
					<path d={splitPath(geoPts, false, r)} stroke={C.amberDim} strokeWidth={1.5} strokeDasharray="6 10" fill="none" opacity={geoAppear * 0.5} />
					{/* ISS の軌道（奥） */}
					<path d={splitPath(orbitPts, false, r)} stroke={C.mintFaint} strokeWidth={2} fill="none" />
					<Globe r={r} spin={spin} tilt={TILT} />
					{japan.z > 0 ? <circle cx={japan.x} cy={japan.y} r={Math.max(3, r * 0.022)} fill={C.amber} opacity={0.9} /> : null}
					{/* ISS の軌道（手前） */}
					<path d={splitPath(orbitPts, true, r)} stroke={C.mintDim} strokeWidth={2} fill="none" />
					{issVisible ? (
						<g>
							<path d={splitPath(trail, true, r)} stroke={C.text} strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.7} />
							<circle cx={iss.x} cy={iss.y} r={18 * pulse} fill={C.mint} opacity={0.18} />
							<circle cx={iss.x} cy={iss.y} r={6} fill={C.text} />
						</g>
					) : null}
					{/* 静止軌道（手前）とひまわり9号 */}
					<g opacity={geoAppear}>
						<path d={splitPath(geoPts, true, r)} stroke={C.amber} strokeWidth={2} strokeDasharray="6 10" fill="none" />
						<circle cx={hima.x} cy={hima.y} r={20 * pulse} fill={C.amber} opacity={0.2} />
						<circle cx={hima.x} cy={hima.y} r={7} fill={C.amber} />
						<line x1={hima.x} y1={hima.y} x2={japan.x} y2={japan.y} stroke={C.amberDim} strokeWidth={1} strokeDasharray="2 6" />
					</g>
				</g>
			</svg>

			{/* ラベル */}
			{issVisible ? (
				<div style={{position: 'absolute', left: cx + iss.x + 22, top: cy + iss.y - 46, opacity: nearUi, fontFamily: F.body, fontSize: 26, color: C.text}}>
					{b.labels.iss}
				</div>
			) : null}
			<div style={{position: 'absolute', left: cx + hima.x + 26, top: cy + hima.y - 20, opacity: geoAppear, fontFamily: F.body, fontSize: 28, color: C.amber}}>
				{b.labels.himawari}
			</div>

			{/* 計器 */}
			<div style={{position: 'absolute', inset: 0, opacity: nearUi}}>
				<Readout label="ISS / ALTITUDE" value={facts.iss.altitudeKm} unit="km" from={0.6} to={2.6} x={1360} y={250} />
				<Readout label="ISS / VELOCITY" value={facts.iss.speedKmS} decimals={1} unit="km/s" from={4.6} to={6.2} x={1360} y={410} />
				<Readout label="ISS / PERIOD" value={facts.iss.periodMin} unit="min" from={5.4} to={7.2} x={1360} y={570} />
			</div>
			<div style={{position: 'absolute', inset: 0, opacity: farUi}}>
				<Readout label="HIMAWARI-9 / ALTITUDE" value={facts.himawari.altitudeKm} unit="km" from={10.6} to={13.0} x={1420} y={250} color={C.amber} />
			</div>

			<Captions lines={b.lines} />
			<Hud label="LOW EARTH ORBIT → GEO" right="CH-01" note={farUi > 0.01 ? b.scaleNote : undefined} />
		</AbsoluteFill>
	);
};
