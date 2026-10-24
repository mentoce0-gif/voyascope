import React from 'react';
import {AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {Badges, Captions, Pill, Readout, Scrim, Space, Tag, TmRow, clamp, ease, easeInOut} from '../components/ui';
import {Globe} from '../components/Globe';
import {VoyagerModel} from '../components/VoyagerModel';
import {beats} from '../script';
import {facts} from '../facts';
import {C, F} from '../theme';
import {useLayout} from '../layout';

const b = beats.far;
const pad = (v: number) => String(Math.floor(v)).padStart(2, '0');
const lerp = (a: number, c: number, t: number) => a + (c - a) * t;
const D = 400; // 地球 → ボイジャー1号（模式の長さ）
const HELIO_P = 0.55; // 太陽圏のはて（模式）を、道のどこでくぐるか

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

// ビート4「いちばん遠く」
//  A 日の出の構図：夜の地球の縁の向こうから太陽。光の波面が広がり、地球に届くと大気の縁が燃える
//  B 光がカメラに届いて画面が光に包まれ、ぐるんと振り向く（地球と星が流れる）
//  C ワープ：光を追って24時間を早送り（向かう先から放射するまっすぐの星の筋）。太陽圏のはて（模式）をくぐる
//  D 減速して、ボイジャー1号（形はイメージ）。光が皿の上を走って届く
export const Far: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const L = useLayout();
	const t = frame / 30;
	const p = lightAt(t);
	const diag = Math.hypot(width, height);

	// ===== A：日の出の構図 =====
	const E = L.vertical ? {x: 820, y: 1150, R: 560} : {x: 1420, y: 1050, R: 620};
	const sd = {x: -0.62, y: -0.78}; // 地球の中心から見た太陽の向き（左上）
	const SUN = {x: E.x + sd.x * E.R * 1.012, y: E.y + sd.y * E.R * 1.012};
	const push = 1 + 0.05 * interpolate(t, [0, b.swing], [0, 1], clamp); // ゆっくり寄る
	// 光の波面：太陽から広がり、地球に届く（count.from）→ カメラに届く（画面が光に包まれる）
	const reachEarth = Math.hypot(E.x - SUN.x, E.y - SUN.y);
	const waveR = interpolate(t, [0.5, b.count.from, b.swing + 0.05], [0, reachEarth, diag * 1.25], clamp);
	const waveOn = interpolate(t, [0.5, 0.8, b.swing, b.swing + 0.1], [0, 1, 1, 0], clamp);
	const ignite = interpolate(t, [b.count.from - 0.15, b.count.from + 0.1, b.count.from + 1.4], [0, 1, 0.35], clamp); // 大気の縁が燃える
	const sunUp = interpolate(t, [0, 1.2], [0.55, 1], clamp);
	const flash = interpolate(t, [b.swing - 0.25, b.swing + 0.05, b.swing + 0.8], [0, 0.9, 0], clamp);

	// ===== B：ぐるんと振り向く（素早いパン） =====
	const wp = interpolate(t, [b.swing, b.warp - 0.3], [0, 1], {...clamp, easing: easeInOut});
	const whipSpeed = Math.sin(Math.PI * wp); // 0 → 1 → 0
	const aShift = -wp * width * 1.7;
	const aRoll = -9 * wp;
	const aOn = interpolate(t, [b.warp - 0.6, b.warp - 0.1], [1, 0], clamp);

	// ===== C：ワープ =====
	const headX = 1 + p * D;
	const camX = headX - 0.35;
	const warpOn = interpolate(t, [b.warp - 0.5, b.warp + 0.3, b.count.to - 1.0, b.count.to], [0, 1, 1, 0], clamp);
	const speed = (lightAt(t + 1 / 30) - p) * D * 30;
	const VP = {x: width / 2 + Math.sin(t * 0.7) * 24 * warpOn, y: (L.vertical ? height * 0.44 : height * 0.5) + Math.cos(t * 0.5) * 14 * warpOn};
	const roll = Math.sin(t * 0.9) * 4 * warpOn; // 機体ごと少し傾く（度）
	const FOC = L.vertical ? width * 0.95 : width * 0.55;
	const streakK = Math.min(1, speed / 140) * warpOn;
	const travel = (headX - 1) * 0.06;
	const streaks =
		streakK > 0.01
			? Array.from({length: 280}, (_, i) => {
					const ang = random(`wa${i}`) * Math.PI * 2;
					const z0 = random(`wz${i}`);
					const zz = 1 - ((z0 + travel * (0.6 + random(`ws${i}`))) % 1);
					const r1 = 40 / Math.max(0.04, zz);
					const r0 = r1 * (1 - 0.55 * streakK);
					const cs = Math.cos(ang);
					const sn = Math.sin(ang);
					const a = Math.min(1, (1 - zz) * 1.4) * streakK;
					return (
						<line
							key={i}
							x1={VP.x + cs * r0}
							y1={VP.y + sn * r0}
							x2={VP.x + cs * r1}
							y2={VP.y + sn * r1}
							stroke={i % 7 === 0 ? C.amber : i % 3 === 0 ? C.mint : '#e8f1ff'}
							strokeWidth={1 + (1 - zz) * 2.2}
							strokeLinecap="round"
							opacity={a * 0.9}
						/>
					);
				})
			: null;
	const helioDist = 1 + HELIO_P * D - camX;
	const helioR = helioDist > 0.05 ? (60 / helioDist) * FOC : 0;
	const helioOn = helioDist > 0 && helioR < width * 1.6 ? interpolate(helioR, [10, 60, width * 0.9, width * 1.6], [0, 1, 1, 0], clamp) * warpOn : 0;
	const crossed = interpolate(-helioDist, [0, 15, 90, 160], [0, 1, 1, 0], clamp) * warpOn;

	// ===== D：ボイジャー1号 =====
	const vDist = Math.max(0.35, 1 + D - camX);
	const sFinal = L.vertical ? width * 0.16 : height * 0.15;
	const after = interpolate(t, [b.count.to, b.seconds], [0, 1], clamp);
	const vScale = ((sFinal * 0.35) / vDist) * (1 + 0.08 * ease(after));
	const vOn = interpolate(p, [0.9, 0.975], [0, 1], clamp);
	// 模型は消失点（光の向かう先）から現れ、近づくにつれて定位置へ。皿が斜めに見え、磁力計のブームが右へのびる向き
	const vk = vScale / sFinal; // 0 → 1（着いたとき）→ 1.08
	const vTarget = L.vertical ? {x: 880, y: 900} : {x: 1500, y: 620}; // 模型の中心（皿はその左上にくる）
	const vSize = (L.vertical ? 1180 : 1350) * vk;
	const vX = VP.x + (vTarget.x - VP.x) * Math.min(1, vk) - after * width * 0.02;
	const vY = VP.y + (vTarget.y - VP.y) * Math.min(1, vk);
	const dish = {x: vX - 0.23 * vSize, y: vY - 0.09 * vSize}; // 皿のあたり
	const yaw = lerp(0.9, 1.22, easeInOut(after)) - (1 - vOn) * 0.3; // ゆっくり回りこむ
	// 追いかけている光の先頭：ふだんは消失点、ボイジャー1号が近づくと皿へ（届く）
	const hk = Math.min(1, vk) * vOn;
	const headScr = {x: VP.x + (dish.x - VP.x) * hk, y: VP.y + (dish.y - VP.y) * hk};
	const vGlow = interpolate(t, [b.count.to, b.count.to + 0.25, b.count.to + 2.5], [0, 1, 0.25], clamp);
	const hours = 24 * p;
	const counting = interpolate(t, [b.count.from, b.count.from + 0.3], [0, 1], clamp);
	const done = p >= 1;

	// ゴースト（レンズの映りこみ）：太陽から画面の中心を通る線の上
	const gc = {x: width / 2, y: height / 2};
	const ghosts = [
		{k: 0.55, r: 26, c: C.mint, o: 0.18},
		{k: 0.85, r: 64, c: '#9fd8ff', o: 0.08},
		{k: 1.25, r: 18, c: C.amber, o: 0.22},
		{k: 1.6, r: 110, c: C.mint, o: 0.05},
	];

	return (
		<AbsoluteFill>
			<Space drift={0.03} density={360} />
			<svg width={width} height={height} style={{position: 'absolute'}}>
				<defs>
					<filter id="far-blur-s" x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur stdDeviation="6" />
					</filter>
					<filter id="far-blur-m" x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur stdDeviation="18" />
					</filter>
					<filter id="far-whip" x="-20%" y="-20%" width="140%" height="140%">
						<feGaussianBlur stdDeviation={`${2 + whipSpeed * 70} ${1 + whipSpeed * 4}`} />
					</filter>
					<radialGradient id="sun-core">
						<stop offset="0" stopColor="#ffffff" />
						<stop offset="0.25" stopColor="#fff4d6" />
						<stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
					</radialGradient>
					<radialGradient id="sun-halo">
						<stop offset="0" stopColor="#ffe3a8" stopOpacity="0.55" />
						<stop offset="0.35" stopColor="#ffb547" stopOpacity="0.16" />
						<stop offset="1" stopColor="#ffb547" stopOpacity="0" />
					</radialGradient>
					<radialGradient id="earth-night" cx={0.5 + sd.x * 0.32} cy={0.5 + sd.y * 0.32} r="0.75">
						<stop offset="0" stopColor="#0a1a30" />
						<stop offset="0.5" stopColor="#040b17" />
						<stop offset="1" stopColor="#010309" />
					</radialGradient>
					{/* 大気の縁の明るさ：太陽に近いほど明るい */}
					<radialGradient id="limb-mask-g" gradientUnits="userSpaceOnUse" cx={SUN.x} cy={SUN.y} r={E.R * 1.5}>
						<stop offset="0" stopColor="#fff" />
						<stop offset="0.45" stopColor="#888" />
						<stop offset="1" stopColor="#000" />
					</radialGradient>
					<radialGradient id="limb-mask-t" gradientUnits="userSpaceOnUse" cx={SUN.x} cy={SUN.y} r={E.R * 0.75}>
						<stop offset="0" stopColor="#fff" />
						<stop offset="1" stopColor="#000" />
					</radialGradient>
					<mask id="limb-mask">
						<rect width={width} height={height} fill="url(#limb-mask-g)" />
					</mask>
					<mask id="limb-mask-tight">
						<rect width={width} height={height} fill="url(#limb-mask-t)" />
					</mask>
					<clipPath id="earth-clip">
						<circle cx={E.x} cy={E.y} r={E.R} />
					</clipPath>
					<linearGradient id="flare-h" x1="0" y1="0" x2="1" y2="0">
						<stop offset="0" stopColor="#9fd8ff" stopOpacity="0" />
						<stop offset="0.5" stopColor="#d9f4ff" stopOpacity="0.55" />
						<stop offset="1" stopColor="#9fd8ff" stopOpacity="0" />
					</linearGradient>
					<radialGradient id="far-vignette" cx="0.5" cy="0.5" r="0.75">
						<stop offset="0.6" stopColor="#000" stopOpacity="0" />
						<stop offset="1" stopColor="#000" stopOpacity="0.5" />
					</radialGradient>
					<radialGradient id="far-flash" cx="0.42" cy="0.4" r="0.85">
						<stop offset="0" stopColor="#ffffff" stopOpacity="1" />
						<stop offset="0.5" stopColor="#f2fffb" stopOpacity="0.85" />
						<stop offset="1" stopColor="#bfeee0" stopOpacity="0.55" />
					</radialGradient>
					<filter id="far-grain">
						<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed={frame % 60} />
						<feColorMatrix type="saturate" values="0" />
					</filter>
				</defs>

				{/* ===== A・B：日の出の構図（B では左へ流れて消える） ===== */}
				{aOn > 0 ? (
					<g opacity={aOn} filter={whipSpeed > 0.02 ? 'url(#far-whip)' : undefined} transform={`translate(${aShift} 0) rotate(${aRoll} ${width / 2} ${height / 2})`}>
						<g transform={`translate(${SUN.x} ${SUN.y}) scale(${push}) translate(${-SUN.x} ${-SUN.y})`}>
							{/* 太陽（地球の向こう） */}
							<circle cx={SUN.x} cy={SUN.y} r={E.R * 1.1} fill="url(#sun-halo)" opacity={sunUp} />
							<circle cx={SUN.x} cy={SUN.y} r={E.R * 0.16} fill="url(#sun-core)" opacity={sunUp} />
							{/* 光の波面：地球のうしろを回りこんで広がる */}
							{waveR > 0 && waveOn > 0 ? (
								<g opacity={waveOn}>
									<circle cx={SUN.x} cy={SUN.y} r={waveR} fill="none" stroke="#d9fff4" strokeWidth={30} opacity={0.35} filter="url(#far-blur-m)" />
									<circle cx={SUN.x} cy={SUN.y} r={waveR} fill="none" stroke="#ffffff" strokeWidth={2.2} opacity={0.85} />
									<circle cx={SUN.x} cy={SUN.y} r={waveR * 0.985} fill="none" stroke={C.mint} strokeWidth={1.2} opacity={0.5} />
								</g>
							) : null}
							{/* 夜の地球（陸地の線はかすかに） */}
							<circle cx={E.x} cy={E.y} r={E.R} fill="url(#earth-night)" />
							<g clipPath="url(#earth-clip)" opacity={0.22}>
								<g transform={`translate(${E.x} ${E.y})`}>
									<Globe r={E.R} spin={-20 + frame * 0.02} tilt={18} glow={0} />
								</g>
							</g>
							<circle cx={E.x} cy={E.y} r={E.R} fill="url(#earth-night)" opacity={0.8} />
							{/* 大気の縁（逆光）：太い光のにじみ＋細い明るい弧。光が届くと燃える */}
							<g mask="url(#limb-mask)">
								<circle cx={E.x} cy={E.y} r={E.R * 1.012} fill="none" stroke="#7fc8ff" strokeWidth={E.R * 0.05} opacity={0.5 + 0.5 * ignite} filter="url(#far-blur-m)" />
								<circle cx={E.x} cy={E.y} r={E.R * 1.004} fill="none" stroke="#bfe6ff" strokeWidth={6 + 8 * ignite} opacity={0.75} filter="url(#far-blur-s)" />
							</g>
							<g mask="url(#limb-mask-tight)">
								<circle cx={E.x} cy={E.y} r={E.R * 1.001} fill="none" stroke="#fff6dc" strokeWidth={2.5 + 2 * ignite} />
							</g>
							{/* 地球の縁から出る太陽の光芒（レンズの効果なので、地球より手前に） */}
							<g opacity={sunUp * (0.75 + 0.25 * ignite)}>
								<circle cx={SUN.x} cy={SUN.y} r={E.R * 0.06} fill="url(#sun-core)" />
								{Array.from({length: 6}, (_, i) => {
									const a = (i / 6) * Math.PI * 2 + 0.25 + t * 0.03;
									const len = E.R * (i % 2 ? 0.55 : 0.9) * (1 + 0.4 * ignite);
									return (
										<line
											key={i}
											x1={SUN.x}
											y1={SUN.y}
											x2={SUN.x + Math.cos(a) * len}
											y2={SUN.y + Math.sin(a) * len}
											stroke="#fff4d6"
											strokeWidth={1.6}
											opacity={0.55}
											filter="url(#far-blur-s)"
										/>
									);
								})}
								<ellipse cx={SUN.x} cy={SUN.y} rx={E.R * 1.4} ry={4} fill="url(#flare-h)" opacity={0.8} />
							</g>
							{/* 光が地球を越えたあとの光の筋 */}
							{ignite > 0
								? Array.from({length: 14}, (_, i) => {
										const a = Math.atan2(sd.y, sd.x) + Math.PI + (random(`gr${i}`) - 0.5) * 1.6;
										const len = E.R * (1.2 + random(`gl${i}`) * 1.4);
										return (
											<line
												key={i}
												x1={SUN.x}
												y1={SUN.y}
												x2={SUN.x - Math.cos(a) * len}
												y2={SUN.y - Math.sin(a) * len}
												stroke="#fff4d6"
												strokeWidth={10 + random(`gw${i}`) * 26}
												opacity={0.05 * ignite}
												filter="url(#far-blur-m)"
											/>
										);
									})
								: null}
						</g>
						{/* レンズのゴースト */}
						{ghosts.map((g, i) => {
							const gx = SUN.x + (gc.x - SUN.x) * g.k * 2;
							const gy = SUN.y + (gc.y - SUN.y) * g.k * 2;
							return <circle key={i} cx={gx} cy={gy} r={g.r} fill={g.c} opacity={g.o * sunUp} stroke={g.c} strokeOpacity={g.o * 1.5} />;
						})}
					</g>
				) : null}

				{/* B：振り向くあいだ、星が横に流れる */}
				{whipSpeed > 0.02
					? Array.from({length: 160}, (_, i) => {
							const y = random(`hy${i}`) * height;
							const x = ((((random(`hx${i}`) * width * 1.4 - wp * width * 2.4) % (width * 1.4)) + width * 1.4) % (width * 1.4)) - width * 0.2;
							const len = 40 + whipSpeed * (200 + random(`hl${i}`) * 380);
							return (
								<line
									key={i}
									x1={x}
									y1={y}
									x2={x + len}
									y2={y + len * 0.04}
									stroke="#e8f1ff"
									strokeWidth={1 + random(`hw${i}`) * 1.5}
									opacity={0.5 * whipSpeed}
									strokeLinecap="round"
								/>
							);
						})
					: null}

				{/* ===== C：ワープ ===== */}
				<g transform={`rotate(${roll} ${VP.x} ${VP.y})`}>
					{streaks}
					{helioOn > 0 ? (
						<g opacity={helioOn}>
							<circle cx={VP.x} cy={VP.y} r={helioR} fill="rgba(168,188,224,0.05)" />
							<circle cx={VP.x} cy={VP.y} r={helioR} fill="none" stroke={C.ref} strokeWidth={10} opacity={0.25} filter="url(#far-blur-s)" />
							<circle cx={VP.x} cy={VP.y} r={helioR} fill="none" stroke={C.ref} strokeWidth={2} strokeDasharray="3 12" />
						</g>
					) : null}
					{t >= b.warp - 0.3 && t < b.count.to + 0.1 ? (
						<g opacity={interpolate(t, [b.warp - 0.3, b.warp + 0.2, b.count.to - 0.1, b.count.to + 0.1], [0, 1, 1, 0], clamp)}>
							<circle cx={headScr.x} cy={headScr.y} r={70} fill="url(#sun-core)" opacity={0.5} />
							<circle cx={headScr.x} cy={headScr.y} r={5} fill="#fff" />
						</g>
					) : null}
				</g>

				{/* ===== D：ボイジャー1号 ===== */}
				{vOn > 0 ? (
					<g opacity={vOn}>
						{done ? (
							<circle
								cx={dish.x}
								cy={dish.y}
								r={vSize * 0.12 * (1.2 + interpolate(t, [b.count.to, b.count.to + 1.2], [0, 5], clamp))}
								fill="none"
								stroke={C.mint}
								strokeWidth={2}
								opacity={interpolate(t, [b.count.to, b.count.to + 1.2], [0.8, 0], clamp)}
							/>
						) : null}
						<circle cx={dish.x} cy={dish.y} r={vSize * 0.3} fill={C.mint} opacity={0.06 * vGlow} filter="url(#far-blur-m)" />
					</g>
				) : null}

				{/* 光に包まれる（真ん中ほど強い光） */}
				<rect width={width} height={height} fill="url(#far-flash)" opacity={flash} />
				{/* 周辺減光と、ごく薄いフィルムの粒子 */}
				<rect width={width} height={height} fill="url(#far-vignette)" />
				<rect width={width} height={height} filter="url(#far-grain)" opacity={0.045} />
			</svg>

			{/* ボイジャー1号：NASA の3D模型 */}
			{vOn > 0 ? (
				<VoyagerModel
					width={width}
					height={height}
					cx={vX}
					cy={vY}
					size={vSize}
					yaw={yaw}
					pitch={0.5}
					roll={0.9}
					arrive={t >= b.count.to ? (t - b.count.to) / 1.4 : -1}
					opacity={vOn}
				/>
			) : null}
			{/* タグ */}
			<Tag x={SUN.x} y={SUN.y} dx={-70} dy={-90} text="太陽" color={C.amber} opacity={aOn * interpolate(t, [0.4, 1.0, b.swing - 0.3, b.swing], [0, 1, 1, 0], clamp)} size={26} />
			<Tag
				x={E.x - E.R * 0.25}
				y={E.y - E.R * 0.55}
				dx={-60}
				dy={L.vertical ? 260 : 180}
				text="地球"
				sub="EARTH"
				opacity={aOn * interpolate(t, [0.8, 1.4, b.swing - 0.3, b.swing], [0, 1, 1, 0], clamp)}
				size={26}
			/>
			<Tag
				x={SUN.x + waveR * 0.72}
				y={SUN.y - waveR * 0.69}
				dx={60}
				dy={-40}
				text="光"
				sub="LIGHT"
				color="#f2fffb"
				opacity={interpolate(t, [0.9, 1.3, b.count.from - 0.3, b.count.from], [0, 1, 1, 0], clamp)}
				size={26}
			/>
			{helioOn > 0.05 ? (
				<div
					style={{
						position: 'absolute',
						left: VP.x,
						top: VP.y - helioR - 46,
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
					top: VP.y - 160,
					textAlign: 'center',
					opacity: crossed,
					fontFamily: F.body,
					fontWeight: 700,
					fontSize: 30,
					letterSpacing: '.08em',
					color: C.text,
					textShadow: `0 0 16px ${C.navy900}`,
				}}
			>
				ここから先は「恒星間空間」
			</div>
			<Tag
				x={dish.x - vSize * 0.06}
				y={dish.y + vSize * 0.1}
				dx={L.vertical ? -40 : 60}
				dy={L.vertical ? 110 : 190}
				text="ボイジャー1号"
				sub="VOYAGER 1 · 3D模型：NASA"
				color={C.amber}
				opacity={vOn * interpolate(t, [b.count.to - 0.4, b.count.to + 0.2], [0, 1], clamp)}
			/>

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
