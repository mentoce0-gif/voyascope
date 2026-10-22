import React from 'react';
import {C} from '../theme';

// 線画の地球（正射図法）。spin は経度方向の回転（度）、tilt は手前への傾き（度）
const D = Math.PI / 180;

export type Vec = {x: number; y: number; z: number};

// 緯度・経度（度）→ 画面上の点（中心 0,0、半径 r）。z > 0 が手前
export const project = (lat: number, lon: number, r: number, spin: number, tilt: number): Vec => {
	const la = lat * D;
	const lo = (lon + spin) * D;
	const x = Math.cos(la) * Math.sin(lo);
	const y = Math.sin(la);
	const z = Math.cos(la) * Math.cos(lo);
	const t = tilt * D;
	return {x: x * r, y: -(y * Math.cos(t) - z * Math.sin(t)) * r, z: y * Math.sin(t) + z * Math.cos(t)};
};

// 赤道面に対して傾いた円軌道の上の点（radius は地球半径の何倍か × r）。angle は軌道上の角度（度）
export const orbitPoint = (radius: number, angle: number, incl: number, node: number, spin: number, tilt: number): Vec => {
	const a = angle * D;
	// 軌道面の上の点 → 傾き incl で赤道面から起こす → 経度 node だけ回す
	const px = Math.cos(a);
	const py = Math.sin(a) * Math.sin(incl * D);
	const pz = Math.sin(a) * Math.cos(incl * D);
	const lo = (node + spin) * D;
	const x = px * Math.cos(lo) + pz * Math.sin(lo);
	const z = -px * Math.sin(lo) + pz * Math.cos(lo);
	const t = tilt * D;
	return {x: x * radius, y: -(py * Math.cos(t) - z * Math.sin(t)) * radius, z: py * Math.sin(t) + z * Math.cos(t)};
};

// 点の列を、手前（z>0）と奥で分けた path にする
export const splitPath = (pts: Vec[], front: boolean, occludeR = Infinity) => {
	let d = '';
	let pen = false;
	for (const p of pts) {
		// 見える＝手前にある、または地球の円盤（半径 occludeR）の外にある
		const visible = p.z >= 0 || Math.hypot(p.x, p.y) > occludeR;
		if (visible === front) {
			d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
			pen = true;
		} else pen = false;
	}
	return d;
};

export const Globe: React.FC<{r: number; spin: number; tilt?: number; glow?: number}> = ({r, spin, tilt = 18, glow = 1}) => {
	const lines: React.ReactNode[] = [];
	for (let lon = 0; lon < 360; lon += 20) {
		const pts = Array.from({length: 61}, (_, i) => project(-90 + i * 3, lon, r, spin, tilt));
		lines.push(<path key={`m${lon}`} d={splitPath(pts, true)} stroke={C.mintDim} strokeWidth={1.3} fill="none" />);
	}
	for (let lat = -60; lat <= 60; lat += 20) {
		const pts = Array.from({length: 121}, (_, i) => project(lat, i * 3, r, spin, tilt));
		lines.push(
			<path key={`p${lat}`} d={splitPath(pts, true)} stroke={lat === 0 ? C.mint : C.mintDim} strokeWidth={lat === 0 ? 1.8 : 1.3} fill="none" />,
		);
	}
	return (
		<g>
			<defs>
				<radialGradient id="globeFill" cx="40%" cy="35%" r="75%">
					<stop offset="0%" stopColor={C.navy600} />
					<stop offset="70%" stopColor={C.navy700} />
					<stop offset="100%" stopColor={C.navy900} />
				</radialGradient>
				<radialGradient id="globeGlow" cx="50%" cy="50%" r="50%">
					<stop offset="80%" stopColor={C.mint} stopOpacity={0} />
					<stop offset="88%" stopColor={C.mint} stopOpacity={0.18 * glow} />
					<stop offset="100%" stopColor={C.mint} stopOpacity={0} />
				</radialGradient>
			</defs>
			<circle r={r * 1.14} fill="url(#globeGlow)" />
			<circle r={r} fill="url(#globeFill)" />
			{lines}
			<circle r={r} fill="none" stroke={C.mint} strokeWidth={2} opacity={0.9} />
		</g>
	);
};
