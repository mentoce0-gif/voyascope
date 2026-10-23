import React from 'react';
import {AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {Badges, Captions, Pill, Readout, Scrim, Space, Tag, TmRow, clamp, easeInOut} from '../components/ui';
import {Globe} from '../components/Globe';
import {beats} from '../script';
import {facts} from '../facts';
import {C, F} from '../theme';
import {useLayout} from '../layout';

const b = beats.far;
const pad = (v: number) => String(Math.floor(v)).padStart(2, '0');
const lerp = (a: number, c: number, t: number) => a + (c - a) * t;

// --- 3D の世界（大きさ・距離の比は模式）。太陽は原点、地球は x=1、光は +x へ進んでボイジャー1号へ
type V3 = [number, number, number];
const SUN: V3 = [0, 0, 0];
const EARTH: V3 = [1, 0, 0];
const EARTH_R = 0.02; // 地球の半径（模式）
const D = 400; // 地球 → ボイジャー1号（模式）
const VGR: V3 = [1 + D, 0, 0];
const HELIO_P = 0.55; // 太陽圏のはて（模式）を、道のどこでくぐるか
const sub3 = (a: V3, c: V3): V3 => [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
const dot = (a: V3, c: V3) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
const cross = (a: V3, c: V3): V3 => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
const norm = (a: V3): V3 => {
	const l = Math.hypot(...a);
	return [a[0] / l, a[1] / l, a[2] / l];
};

// 光の進み（0〜1）：timing.json の lightCurve を結ぶ。計器の時間・距離もこれに比例（光の速さは一定）
const lightAt = (t: number) => {
	const k = b.lightCurve;
	if (t <= k[0][0]) return 0;
	for (let i = 0; i < k.length - 1; i++) {
		const [t0, p0] = k[i];
		const [t1, p1] = k[i + 1];
		if (t <= t1) return lerp(p0, p1, easeInOut((t - t0) / (t1 - t0)));
	}
	return 1;
};
// 地球の手前（太陽から地球まで）の光：見せるための動き（時間の数字は出さない）
const nearLight = (t: number) => interpolate(t, [0.5, b.count.from], [0, 1], clamp); // 0＝太陽、1＝地球

// ビート4「いちばん遠く」：逆光の地球を光が越えていく → ぐるんと振り向いて光を追う → ワープ → ボイジャー1号に届く
export const Far: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const L = useLayout();
	const t = frame / 30;
	const p = lightAt(t);
	const headX = t < b.count.from ? nearLight(t) : 1 + p * D; // 光の先頭（x）

	// --- カメラ
	// A：地球のうしろ（太陽の反対側）から、太陽と地球をななめに見る（地球は逆光）
	const C0: V3 = [1.1, 0.026, 0.095];
	const yaw0 = Math.atan2(0 - C0[2], 0.55 - C0[0]); // 太陽と地球のあいだ（x=0.55）を見る向き
	// B：ぐるんと振り向いて、光の進む向き（+x）へ。C：光の少しうしろについて追う
	const swing = interpolate(t, [b.swing, b.warp], [0, 1], {...clamp, easing: easeInOut});
	const chase: V3 = [headX - 0.35, 0.02, 0];
	// D：届いたあとは、ボイジャー1号のまわりをゆっくり回る
	const after = interpolate(t, [b.count.to, b.seconds], [0, 1], clamp);
	let cam: V3;
	let yaw: number;
	if (t < b.count.to) {
		cam = [lerp(C0[0], chase[0], swing), lerp(C0[1], chase[1], swing), lerp(C0[2], chase[2], swing)];
		// 向き：yaw0（太陽のほう）から 2π（+x）まで、地球のほうを通って回る
		const y0 = yaw0 < 0 ? yaw0 + Math.PI * 2 : yaw0;
		yaw = lerp(y0, Math.PI * 2, swing);
	} else {
		const ph = 0.15 + after * 0.45;
		cam = [VGR[0] - 0.35 * Math.cos(ph), 0.02 + after * 0.04, -0.35 * Math.sin(ph)];
		yaw = Math.atan2(VGR[2] - cam[2], VGR[0] - cam[0]);
	}
	// 曲がる感じ：ワープ中は機体ごと少し傾ける（星の筋はまっすぐのまま。MMX いまどこ と同じ考え）
	const warpOn = interpolate(t, [b.warp - 0.4, b.warp + 0.4, b.count.to - 1.0, b.count.to], [0, 1, 1, 0], clamp);
	const roll = Math.sin(t * 0.9) * 0.07 * warpOn;
	const fwd = norm([Math.cos(yaw), -0.02, Math.sin(yaw)]);
	const right = norm(cross(fwd, [0, 1, 0]));
	const up0 = cross(right, fwd);
	const right2: V3 = [right[0] * Math.cos(roll) + up0[0] * Math.sin(roll), right[1] * Math.cos(roll) + up0[1] * Math.sin(roll), right[2] * Math.cos(roll) + up0[2] * Math.sin(roll)];
	const up = cross(right2, fwd);
	const FOC = L.vertical ? width * 0.95 : width * 0.55;
	const CX = width / 2;
	const CY = L.vertical ? height * 0.46 : height * 0.5;
	const proj = (P: V3) => {
		const d = sub3(P, cam);
		const z = dot(d, fwd);
		return {x: CX + (dot(d, right2) / z) * FOC, y: CY - (dot(d, up) / z) * FOC, z};
	};

	// --- 太陽・地球（A・B）
	const sun = proj(SUN);
	const earth = proj(EARTH);
	const earthR = earth.z > 0 ? (EARTH_R / earth.z) * FOC : 0;
	const sunR = sun.z > 0 ? (0.05 / sun.z) * FOC : 0;
	const nearOn = interpolate(t, [b.warp - 0.2, b.warp + 0.6], [1, 0], clamp);
	// 逆光：太陽の側の縁が光る（地球の中心から見た太陽の向き）
	const rimAng = Math.atan2(sun.y - earth.y, sun.x - earth.x);
	// 光：太陽から出て地球を越える、明るい筋
	const beamA = proj([Math.max(0, headX - 0.35), 0, 0]);
	const beamB = proj([headX, 0, 0]);
	const passFlash = interpolate(t, [b.count.from - 0.1, b.count.from + 0.15, b.count.from + 0.9], [0, 1, 0], clamp);

	// --- ワープ（C）：向かう先から放射するまっすぐの筋。速さで長さが変わる
	const speed = (lightAt(t + 1 / 30) - p) * D * 30; // 1秒あたりに進む世界の長さ
	const vp = proj([headX + 1000, 0, 0]); // 消失点（向かう先）
	const streakK = Math.min(1, speed / 140) * warpOn;
	const travel = (headX - 1) * 0.06;
	const streaks =
		streakK > 0.01
			? Array.from({length: 260}, (_, i) => {
					const ang = random(`wa${i}`) * Math.PI * 2;
					const z0 = random(`wz${i}`);
					const zz = 1 - ((z0 + travel * (0.6 + random(`ws${i}`))) % 1); // 1（遠い）→ 0（近い）
					const r1 = 40 / Math.max(0.04, zz);
					const r0 = r1 * (1 - 0.55 * streakK);
					const cs = Math.cos(ang);
					const sn = Math.sin(ang);
					const a = Math.min(1, (1 - zz) * 1.4) * streakK;
					return (
						<line
							key={i}
							x1={vp.x + cs * r0}
							y1={vp.y + sn * r0}
							x2={vp.x + cs * r1}
							y2={vp.y + sn * r1}
							stroke={i % 7 === 0 ? C.amber : i % 3 === 0 ? C.mint : '#e8f1ff'}
							strokeWidth={1 + (1 - zz) * 2.2}
							strokeLinecap="round"
							opacity={a * 0.9}
						/>
					);
				})
			: null;
	// 太陽圏のはて（模式）：道の途中の大きな輪。くぐると画面の外へ広がって消える
	const helioX = 1 + HELIO_P * D;
	const helioDist = helioX - cam[0];
	const helioR = helioDist > 0.05 ? (60 / helioDist) * FOC : 0;
	const helioOn = helioDist > 0 && helioR < width * 1.6 ? interpolate(helioR, [10, 60, width * 0.9, width * 1.6], [0, 1, 1, 0], clamp) * warpOn : 0;
	const crossed = interpolate(-helioDist, [0, 15, 90, 160], [0, 1, 1, 0], clamp) * warpOn; // くぐったあと、しばらく

	// --- ボイジャー1号（D）
	const v = proj(VGR);
	const vS = v.z > 0.05 ? (0.022 / v.z) * FOC : 0;
	const vOn = interpolate(p, [0.9, 0.97], [0, 1], clamp);
	const arrive = interpolate(t, [b.count.to, b.count.to + 0.9], [0, 1], clamp);
	const hours = 24 * p;
	const counting = interpolate(t, [b.count.from, b.count.from + 0.3], [0, 1], clamp);
	const done = p >= 1;

	return (
		<AbsoluteFill>
			<Space drift={0.04} density={340} />
			<svg width={width} height={height} style={{position: 'absolute'}}>
				<defs>
					<radialGradient id="sun-g">
						<stop offset="0" stopColor="#fff8e6" />
						<stop offset="0.25" stopColor="#ffd27a" stopOpacity="0.9" />
						<stop offset="1" stopColor="#ffb547" stopOpacity="0" />
					</radialGradient>
					<radialGradient id="rim-g" cx="0.5" cy="0.5" r="0.5">
						<stop offset="0.86" stopColor="#ffd27a" stopOpacity="0" />
						<stop offset="0.97" stopColor="#ffe9b8" stopOpacity="0.95" />
						<stop offset="1" stopColor="#ffffff" stopOpacity="0" />
					</radialGradient>
					<mask id="rim-mask">
						{/* 縁の光は太陽の側だけ */}
						<rect x={0} y={0} width={width} height={height} fill="#000" />
						<circle cx={earth.x + Math.cos(rimAng) * earthR * 0.9} cy={earth.y + Math.sin(rimAng) * earthR * 0.9} r={earthR * 1.25} fill="#fff" />
					</mask>
				</defs>

				{/* A・B：太陽と逆光の地球 */}
				<g opacity={nearOn}>
					{sun.z > 0 ? (
						<g>
							<circle cx={sun.x} cy={sun.y} r={sunR * 7} fill="url(#sun-g)" opacity={0.55} />
							<circle cx={sun.x} cy={sun.y} r={sunR * 1.6} fill="url(#sun-g)" />
							<circle cx={sun.x} cy={sun.y} r={sunR * 0.6} fill="#fff8e6" />
						</g>
					) : null}
					{t < b.swing + 0.6 && beamB.z > 0.05 && beamA.z > 0.05 ? (
						<g>
							<line x1={beamA.z > 0 ? beamA.x : beamB.x} y1={beamA.z > 0 ? beamA.y : beamB.y} x2={beamB.x} y2={beamB.y} stroke="#fff8e6" strokeWidth={10} strokeLinecap="round" opacity={0.25} />
							<line x1={beamA.z > 0 ? beamA.x : beamB.x} y1={beamA.z > 0 ? beamA.y : beamB.y} x2={beamB.x} y2={beamB.y} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
							<circle cx={beamB.x} cy={beamB.y} r={9} fill="#fff" />
							<circle cx={beamB.x} cy={beamB.y} r={30} fill="url(#sun-g)" />
						</g>
					) : null}
					{earth.z > 0 && earthR > 1 ? (
						<g>
							<g transform={`translate(${earth.x} ${earth.y})`} opacity={0.55}>
								<Globe r={earthR} spin={-40 + frame * 0.05} tilt={10} glow={0.3} />
							</g>
							{/* 夜の側：影を重ねる */}
							<circle cx={earth.x} cy={earth.y} r={earthR} fill={C.navy900} opacity={0.6} />
							{/* 太陽の側の縁が光る（逆光） */}
							<circle cx={earth.x} cy={earth.y} r={earthR * 1.05} fill="url(#rim-g)" mask="url(#rim-mask)" />
							<circle cx={earth.x} cy={earth.y} r={earthR * 1.6} fill="#ffd27a" opacity={0.25 * passFlash} />
						</g>
					) : null}
				</g>

				{/* C：ワープ */}
				{streaks}
				{helioOn > 0 ? (
					<g opacity={helioOn}>
						<circle cx={vp.x} cy={vp.y} r={helioR} fill="none" stroke={C.ref} strokeWidth={3} strokeDasharray="4 14" />
						<circle cx={vp.x} cy={vp.y} r={helioR} fill="rgba(168,188,224,0.05)" />
					</g>
				) : null}
				{t >= b.warp && t < b.count.to ? (
					<g>
						{/* 追いかけている光の先頭 */}
						<circle cx={proj([headX, 0, 0]).x} cy={proj([headX, 0, 0]).y} r={34} fill="url(#sun-g)" opacity={0.9} />
						<circle cx={proj([headX, 0, 0]).x} cy={proj([headX, 0, 0]).y} r={6} fill="#fff" />
					</g>
				) : null}

				{/* D：ボイジャー1号（形はイメージ。アンテナの皿・本体・のびた腕） */}
				{v.z > 0.05 && vOn > 0 ? (
					<g opacity={vOn} transform={`translate(${v.x} ${v.y})`}>
						<line x1={-vS * 0.1} y1={vS * 0.1} x2={-vS * 2.4} y2={vS * 0.9} stroke={C.textDim} strokeWidth={Math.max(1, vS * 0.03)} />
						<line x1={vS * 0.1} y1={vS * 0.15} x2={vS * 1.3} y2={vS * 1.1} stroke={C.textDim} strokeWidth={Math.max(1, vS * 0.04)} />
						<circle cx={vS * 1.3} cy={vS * 1.1} r={vS * 0.1} fill={C.textDim} />
						<rect x={-vS * 0.25} y={vS * 0.05} width={vS * 0.5} height={vS * 0.32} fill="#3a4a63" stroke={C.text} strokeWidth={1} />
						<ellipse cx={0} cy={0} rx={vS} ry={vS * 0.62} fill="#dfe8f2" stroke="#fff" strokeWidth={1.5} />
						<ellipse cx={0} cy={0} rx={vS * 0.75} ry={vS * 0.46} fill="none" stroke="#9fb2c8" strokeWidth={1} />
						<circle cx={0} cy={-vS * 0.02} r={vS * 0.06} fill="#9fb2c8" />
						{/* 光が届いた */}
						<circle cx={0} cy={0} r={vS * (1.2 + arrive * 4)} fill="none" stroke={C.mint} strokeWidth={4} opacity={done ? 1 - arrive : 0} />
						<circle cx={0} cy={0} r={vS * 1.8} fill={C.mint} opacity={done ? 0.12 * (1 - arrive) : 0} />
					</g>
				) : null}
			</svg>

			{/* タグ */}
			<Tag x={sun.x} y={sun.y} dx={-60} dy={-80} text="太陽" color={C.amber} opacity={sun.z > 0 ? nearOn * interpolate(t, [0.3, 0.9, b.swing, b.swing + 0.4], [0, 1, 1, 0], clamp) : 0} size={26} />
			<Tag
				x={earth.x}
				y={earth.y + earthR * 0.7}
				dx={L.vertical ? -40 : 60}
				dy={90}
				text="地球"
				sub="EARTH"
				opacity={earth.z > 0 ? nearOn * interpolate(t, [0.6, 1.2, b.swing, b.swing + 0.4], [0, 1, 1, 0], clamp) : 0}
				size={26}
			/>
			<Tag x={beamB.x} y={beamB.y} dx={50} dy={-60} text="光" sub="LIGHT" color="#fff8e6" opacity={beamB.z > 0 ? interpolate(t, [0.9, 1.4, b.swing - 0.2, b.swing + 0.2], [0, 1, 1, 0], clamp) : 0} size={26} />
			{helioOn > 0.05 ? (
				<div
					style={{
						position: 'absolute',
						left: vp.x,
						top: vp.y - helioR - 46,
						transform: 'translateX(-50%)',
						opacity: helioOn,
						fontFamily: F.body,
						fontSize: 24,
						color: C.ref,
						whiteSpace: 'nowrap',
						textShadow: `0 0 12px ${C.navy900}`,
					}}
				>
					太陽圏のはて（模式）
				</div>
			) : null}
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: CY - 160,
					textAlign: 'center',
					opacity: crossed,
					fontFamily: F.body,
					fontWeight: 700,
					fontSize: 30,
					color: C.text,
					textShadow: `0 0 16px ${C.navy900}`,
				}}
			>
				ここから先は「恒星間空間」
			</div>
			<Tag x={v.x} y={v.y} dx={L.vertical ? -60 : -110} dy={-90} text="ボイジャー1号" sub="VOYAGER 1 · 形はイメージ" color={C.amber} opacity={v.z > 0.05 ? vOn * interpolate(t, [b.count.to - 0.6, b.count.to], [0, 1], clamp) : 0} />

			<Scrim />
			<Readout k="LIGHT" value={`${pad(hours)}:${pad((hours * 60) % 60)}:${pad((hours * 3600) % 60)}`} color={done ? C.amber : C.text} opacity={counting} />
			<Readout k="TARGET" value="VOYAGER 1" color={C.amber} opacity={interpolate(t, [b.count.from - 0.45, b.count.from - 0.1], [1, 0], clamp)} />
			<TmRow
				at={0.4}
				items={[
					{k: 'LAUNCH', v: facts.voyager.launchIso},
					{k: 'LIGHT TRAVEL', unit: '億 km', v: p > 0 ? `約${Math.round(facts.voyager.lightDayOku * p)}` : '—', color: done ? C.amber : C.mint},
				]}
			/>
			<Badges>
				<Pill>{b.badge}</Pill>
			</Badges>
			<Captions items={b.captions} />
		</AbsoluteFill>
	);
};
