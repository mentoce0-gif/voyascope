// ボイジャー1号の模型（形はイメージ。公式の写真の見た目を参考に、図形で組んだもの。寸法の数字は出さない）
// 皿型のアンテナ・副反射鏡の支柱・10角形の本体・磁力計のブーム（長い格子）・原子力電池の腕・観測装置の台
// 3D の点を回して、正射影で描く。単位は皿の半径＝1
import React from 'react';
import {C} from '../theme';

type P3 = [number, number, number];

const rot = (p: P3, yaw: number, pitch: number, roll: number): P3 => {
	// yaw（縦軸まわり）→ pitch（横軸まわり）→ roll（視線まわり）
	let [x, y, z] = p;
	[x, z] = [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
	[y, z] = [y * Math.cos(pitch) - z * Math.sin(pitch), y * Math.sin(pitch) + z * Math.cos(pitch)];
	[x, y] = [x * Math.cos(roll) - y * Math.sin(roll), x * Math.sin(roll) + y * Math.cos(roll)];
	return [x, y, z];
};

const DISH_DEPTH = 0.32;
const dishZ = (r: number) => -DISH_DEPTH * (1 - r * r); // 皿のふちが z=0、中心がいちばん奥

export const Voyager: React.FC<{
	x: number;
	y: number;
	s: number; // 皿の半径（px）
	yaw: number;
	pitch: number;
	roll?: number;
	sheen?: number; // 届いた光が皿の上を走る位置（0〜1。範囲外なら出さない）
	glow?: number; // 光に照らされた明るさ（0〜1）
	id: string;
}> = ({x, y, s, yaw, pitch, roll = 0, sheen = -1, glow = 0, id}) => {
	const P = (p: P3) => {
		const q = rot(p, yaw, pitch, roll);
		return {x: x + q[0] * s, y: y - q[1] * s, z: q[2]};
	};
	const path = (pts: P3[], close = false) =>
		pts
			.map((p, i) => {
				const q = P(p);
				return `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
			})
			.join(' ') + (close ? ' Z' : '');
	const ring = (r: number, n = 48): P3[] => Array.from({length: n}, (_, i) => [r * Math.cos((i / n) * Math.PI * 2), r * Math.sin((i / n) * Math.PI * 2), dishZ(r)]);
	const lw = Math.max(0.8, s * 0.018);

	// 皿の向き：法線（+z）がこちらを向いているか（見えているのは表か裏か）
	const facing = rot([0, 0, 1], yaw, pitch, roll)[2];
	const front = facing > 0;

	// 本体（10角形の柱）
	const bus = (zz: number): P3[] => Array.from({length: 10}, (_, i) => [0.42 * Math.cos((i / 10) * Math.PI * 2 + 0.3), 0.42 * Math.sin((i / 10) * Math.PI * 2 + 0.3) - 0.05, zz]);
	const busTop = bus(-0.42);
	const busBot = bus(-0.78);

	// ブーム
	const magA: P3 = [0.35, -0.15, -0.62];
	const magB: P3 = [6.2, -0.55, -0.9]; // 磁力計のブーム（長い）
	const rtgA: P3 = [-0.38, -0.25, -0.62];
	const rtgB: P3 = [-2.3, -0.75, -0.62];
	const sciA: P3 = [0.15, -0.45, -0.66];
	const sciB: P3 = [1.65, -1.55, -0.62];
	const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

	// 磁力計のブーム：2本の細い線と、はしごの横木
	const mag = (() => {
		const off: P3 = [0, 0.05, 0];
		const a1 = lerp3(magA, magB, 0);
		const lines: React.ReactNode[] = [];
		const A = P(a1);
		const B = P(magB);
		const A2 = P([a1[0] + off[0], a1[1] + off[1], a1[2] + off[2]]);
		const B2 = P([magB[0] + off[0], magB[1] + off[1], magB[2] + off[2]]);
		lines.push(<line key="m1" x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#a9b6c7" strokeWidth={lw * 0.9} />);
		lines.push(<line key="m2" x1={A2.x} y1={A2.y} x2={B2.x} y2={B2.y} stroke="#a9b6c7" strokeWidth={lw * 0.6} opacity={0.8} />);
		for (let i = 1; i < 26; i++) {
			const t = i / 26;
			const p = P(lerp3(magA, magB, t));
			const q = P(lerp3([magA[0] + off[0], magA[1] + off[1], magA[2] + off[2]], [magB[0] + off[0], magB[1] + off[1], magB[2] + off[2]], t));
			lines.push(<line key={`r${i}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#a9b6c7" strokeWidth={lw * 0.5} opacity={0.7} />);
		}
		const tip = P(magB);
		lines.push(<circle key="mt" cx={tip.x} cy={tip.y} r={Math.max(1.2, s * 0.045)} fill="#c9d3df" />);
		return lines;
	})();

	// 原子力電池（3つの円柱が並ぶ）
	const rtg = (() => {
		const out: React.ReactNode[] = [];
		const A = P(rtgA);
		const B = P(rtgB);
		out.push(<line key="ra" x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#8d99aa" strokeWidth={lw * 1.4} />);
		for (let i = 0; i < 3; i++) {
			const c0 = P(lerp3(rtgA, rtgB, 0.55 + i * 0.15));
			const c1 = P(lerp3(rtgA, rtgB, 0.55 + i * 0.15 + 0.11));
			out.push(<line key={`rc${i}`} x1={c0.x} y1={c0.y} x2={c1.x} y2={c1.y} stroke="#5b6576" strokeWidth={s * 0.16} strokeLinecap="round" />);
			out.push(<line key={`rh${i}`} x1={c0.x} y1={c0.y} x2={c1.x} y2={c1.y} stroke="#9aa6b6" strokeWidth={s * 0.05} strokeLinecap="round" opacity={0.7} />);
		}
		return out;
	})();

	// 観測装置の台（腕の先の箱）
	const sci = (() => {
		const A = P(sciA);
		const B = P(sciB);
		const box: P3[] = [
			[-0.22, -0.16, -0.2],
			[0.22, -0.16, -0.2],
			[0.22, 0.16, -0.2],
			[-0.22, 0.16, -0.2],
		].map((p) => [sciB[0] + p[0], sciB[1] + p[1], sciB[2] + p[2]] as P3);
		const box2: P3[] = box.map((p) => [p[0], p[1], p[2] + 0.3] as P3);
		return (
			<g>
				<line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#8d99aa" strokeWidth={lw * 1.3} />
				<path d={path(box2, true)} fill="#3d4757" stroke="#9aa6b6" strokeWidth={lw * 0.6} />
				<path d={path(box, true)} fill="#4a5568" stroke="#b9c4d2" strokeWidth={lw * 0.6} />
			</g>
		);
	})();

	// 皿：ふち・等高線（深さが見える）・中心
	const rimPts = ring(1);
	const dishPath = path(rimPts, true);
	const contours = [0.82, 0.6, 0.36].map((r) => path(ring(r), true));
	const center = P([0, 0, dishZ(0)]);
	const rimC = P([0, 0, 0]);
	// 副反射鏡（焦点の小さな皿）と3本の支柱
	const focus = P([0, 0, 0.42]);
	const struts = [90, 210, 330].map((deg) => {
		const a = (deg * Math.PI) / 180;
		const p = P([0.92 * Math.cos(a), 0.92 * Math.sin(a), dishZ(0.92)]);
		return <line key={deg} x1={p.x} y1={p.y} x2={focus.x} y2={focus.y} stroke="#c3cdd9" strokeWidth={lw * 0.7} />;
	});
	const sub = path(Array.from({length: 24}, (_, i) => [0.1 * Math.cos((i / 24) * Math.PI * 2), 0.1 * Math.sin((i / 24) * Math.PI * 2), 0.42] as P3), true);

	// 光の帯：皿の上を斜めに走る
	const sheenOn = sheen > -0.2 && sheen < 1.2;

	return (
		<g>
			<defs>
				<radialGradient id={`${id}-dish`} cx={((center.x - (rimC.x - s)) / (2 * s)).toFixed(3)} cy="0.5" r="0.75">
					<stop offset="0" stopColor={front ? '#8a97a8' : '#3a4352'} />
					<stop offset="0.6" stopColor={front ? '#d5dde7' : '#59626f'} />
					<stop offset="1" stopColor={front ? '#f4f7fb' : '#7c8694'} />
				</radialGradient>
				<linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
					<stop offset={Math.max(0, sheen - 0.18)} stopColor="#ffffff" stopOpacity="0" />
					<stop offset={Math.min(1, Math.max(0, sheen))} stopColor="#e9fff7" stopOpacity="0.85" />
					<stop offset={Math.min(1, sheen + 0.18)} stopColor="#ffffff" stopOpacity="0" />
				</linearGradient>
				<clipPath id={`${id}-clip`}>
					<path d={dishPath} />
				</clipPath>
			</defs>
			{/* 奥のもの → 手前のもの */}
			{rtg}
			{sci}
			<path d={path(busBot, true)} fill="#2c3443" stroke="#7d899a" strokeWidth={lw * 0.6} />
			{busTop.map((p, i) => {
				const q = busBot[i];
				const a = P(p);
				const b = P(q);
				return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#6c7889" strokeWidth={lw * 0.6} />;
			})}
			<path d={path(busTop, true)} fill="#3a4454" stroke="#8d99aa" strokeWidth={lw * 0.6} />
			{mag}
			<path d={dishPath} fill={`url(#${id}-dish)`} stroke="#ffffff" strokeWidth={lw * 1.2} />
			{front ? contours.map((d, i) => <path key={i} d={d} fill="none" stroke="#9fb0c4" strokeWidth={lw * 0.5} opacity={0.55} />) : null}
			{front ? <circle cx={center.x} cy={center.y} r={Math.max(1.5, s * 0.05)} fill="#8996a8" /> : null}
			{/* 光に照らされた明るさと、走る光の帯 */}
			<path d={dishPath} fill={C.mint} opacity={0.18 * glow} />
			{sheenOn ? <rect x={x - s * 1.6} y={y - s * 1.6} width={s * 3.2} height={s * 3.2} fill={`url(#${id}-sheen)`} clipPath={`url(#${id}-clip)`} /> : null}
			<path d={dishPath} fill="none" stroke={C.mint} strokeWidth={lw * 1.6} opacity={0.7 * glow} />
			{front ? struts : null}
			{front ? <path d={sub} fill="#dfe6ee" stroke="#ffffff" strokeWidth={lw * 0.5} /> : null}
		</g>
	);
};
