import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Beacon, Captions, Pill, Readout, Scrim, Space, Tag, TmRow, clamp, easeInOut, prog} from '../components/ui';
import {Globe, orbitPoint, project, splitPath} from '../components/Globe';
import {NOW_EARTH} from './Now';
import {beats, sec} from '../script';
import {EARTH_RADIUS_KM, facts} from '../facts';
import {C} from '../theme';

const b = beats.near;
// 軌道の半径（地球の半径を1とした比）。カードの高さと地球の半径から計算するので、比は本物どおり
const ISS_R = (EARTH_RADIUS_KM + facts.iss.altitudeKm) / EARTH_RADIUS_KM;
const GEO_R = (EARTH_RADIUS_KM + facts.himawari.altitudeKm) / EARTH_RADIUS_KM;
const TILT = 20;
const ISS_INCL = 51.6; // 見た目の傾き（画面に数字は出さない）
const JAPAN = {lat: 36, lon: 138};
const n = (v: number) => v.toLocaleString('en-US');

// ビート2「すぐ上」：ISS が地球すれすれを回る → 静止軌道まで引く
export const Near: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const push = prog(frame, b.pushIn.from, b.pushIn.to, easeInOut);
	const z = prog(frame, b.zoomOut.from, b.zoomOut.to, easeInOut);
	const r = interpolate(z, [0, 1], [interpolate(push, [0, 1], [NOW_EARTH.r, 340]), 66]);
	const cx = interpolate(z, [0, 1], [interpolate(push, [0, 1], [NOW_EARTH.x, 1240]), 1240]);
	const cy = interpolate(z, [0, 1], [interpolate(push, [0, 1], [NOW_EARTH.y, 540]), 520]);
	const spin = -150 + (frame + sec(beats.now.seconds)) * 0.06;

	// ISS：アニメーションでは約5秒で1周（本物は約90分）
	const issAngle = frame * (360 / (5 * 30)) + 220;
	const orbitPts = Array.from({length: 181}, (_, i) => orbitPoint(r * ISS_R, i * 2, ISS_INCL, 40, spin, TILT));
	const iss = orbitPoint(r * ISS_R, issAngle, ISS_INCL, 40, spin, TILT);
	const issVisible = iss.z >= 0 || Math.hypot(iss.x, iss.y) > r;
	const trail = Array.from({length: 30}, (_, i) => orbitPoint(r * ISS_R, issAngle - i * 1.5, ISS_INCL, 40, spin, TILT));

	// 静止軌道：赤道の上の円。ひまわり9号は地球と一緒に回るので、日本の経度の上に止まって見える
	const geoAppear = prog(frame, b.zoomOut.from + 1.0, b.zoomOut.to + 0.6);
	const geoPts = Array.from({length: 181}, (_, i) => project(0, i * 2, r * GEO_R, spin, TILT));
	const hima = project(0, JAPAN.lon + 2, r * GEO_R, spin, TILT);
	const japan = project(JAPAN.lat, JAPAN.lon, r, spin, TILT);

	const nearUi = interpolate(frame, [sec(b.zoomOut.from) - 12, sec(b.zoomOut.from) + 4], [1, 0], clamp);
	const farUi = interpolate(frame, [sec(b.zoomOut.to) - 6, sec(b.zoomOut.to) + 10], [0, 1], clamp);

	return (
		<AbsoluteFill>
			<Space drift={0.1} />
			<svg width={width} height={height} style={{position: 'absolute'}}>
				<g transform={`translate(${cx} ${cy})`}>
					<path d={splitPath(geoPts, false, r)} stroke={C.amberDim} strokeWidth={2} strokeDasharray="6 10" fill="none" opacity={geoAppear * 0.5} />
					<path d={splitPath(orbitPts, false, r)} stroke={C.mintFaint} strokeWidth={2} fill="none" />
					<Globe r={r} spin={spin} tilt={TILT} />
					{japan.z > 0 ? <circle cx={japan.x} cy={japan.y} r={Math.max(3, r * 0.02)} fill={C.amber} /> : null}
					<path d={splitPath(orbitPts, true, r)} stroke={C.mintDim} strokeWidth={2.5} fill="none" />
					{issVisible ? (
						<g>
							<path d={splitPath(trail, true, r)} stroke={C.text} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.7} />
							<Beacon x={iss.x} y={iss.y} color={C.mint} r={7} />
						</g>
					) : null}
					<g opacity={geoAppear}>
						<path d={splitPath(geoPts, true, r)} stroke={C.amber} strokeWidth={2.5} strokeDasharray="6 10" fill="none" />
						<line x1={hima.x} y1={hima.y} x2={japan.x} y2={japan.y} stroke={C.amberDim} strokeWidth={1.5} strokeDasharray="2 6" />
						<Beacon x={hima.x} y={hima.y} color={C.amber} r={8} />
					</g>
				</g>
			</svg>

			<Tag
				x={cx + iss.x}
				y={cy + iss.y}
				dx={iss.x > 0 ? 70 : -70}
				dy={-70}
				text={b.labels.iss}
				sub="ISS"
				opacity={issVisible ? nearUi * interpolate(frame, [sec(1.2), sec(1.6)], [0, 1], clamp) : 0}
			/>
			<Tag x={cx + hima.x} y={cy + hima.y} dx={90} dy={40} text={b.labels.himawari} sub="HIMAWARI-9" color={C.amber} opacity={prog(frame, b.zoomOut.to - 0.3, b.zoomOut.to + 0.5)} />
			<Tag x={cx + japan.x} y={cy + japan.y} dx={-60} dy={-50} text={b.labels.japan} color={C.amber} size={24} opacity={farUi} />

			<Scrim />
			{/* 左上の計器：ISS の高さ → ひまわり9号の高さ */}
			<Readout k="ALT" value={`${n(facts.iss.altitudeKm)} km`} opacity={nearUi} changeAt={0.6} />
			<Readout k="ALT" value={`${n(facts.himawari.altitudeKm)} km`} color={C.amber} opacity={farUi} changeAt={b.zoomOut.to - 0.2} />
			<TmRow
				at={4.2}
				opacity={nearUi}
				items={[
					{k: 'VELOCITY', unit: 'km/s', v: `約${facts.iss.speedKmS}`},
					{k: 'PERIOD', unit: 'min', v: `約${facts.iss.periodMin}`},
					{k: 'TARGET', v: 'ISS'},
				]}
			/>
			<TmRow at={b.zoomOut.to} opacity={farUi} items={[{k: 'ORBIT', v: 'GEO', color: C.amber}, {k: 'TARGET', v: 'HIMAWARI-9', color: C.amber}]} />
			<div style={{position: 'absolute', right: 72, top: 116, opacity: interpolate(frame, [sec(2), sec(2.6)], [0, 1], clamp)}}>
				<Pill color={C.mint}>{b.badgeNear}</Pill>
			</div>
			<Captions items={b.captions} />
		</AbsoluteFill>
	);
};
