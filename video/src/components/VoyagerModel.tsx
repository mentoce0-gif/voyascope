// ボイジャー1号：NASA の3D模型（NASA Science「Voyager 3D Model」、クレジット NASA VTAD）を three.js で描く
//   模型のファイルは npm run assets で public/assets/voyager-nasa-vtad.glb に取ってくる（リポジトリには入れない）
//   光の当て方は演出（太陽の側からの主光・青みの補助光・輪郭の光、光が届いた瞬間のミントの光）
import React, {useEffect, useMemo, useState} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {continueRender, delayRender, staticFile} from 'remotion';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODEL_URL = staticFile('assets/voyager-nasa-vtad.glb');

// 模型を一度だけ読む（全コマで使い回す）
let cache: Promise<THREE.Group> | null = null;
const loadModel = () => {
	if (!cache) {
		cache = new Promise((resolve, reject) => {
			new GLTFLoader().load(
				MODEL_URL,
				(g) => {
					const root = g.scene;
					// 中心を原点に、いちばん長い向きの長さを 1 に
					const box = new THREE.Box3().setFromObject(root);
					const size = box.getSize(new THREE.Vector3());
					const center = box.getCenter(new THREE.Vector3());
					root.position.sub(center);
					const wrap = new THREE.Group();
					wrap.add(root);
					wrap.scale.setScalar(1 / Math.max(size.x, size.y, size.z));
					root.traverse((o) => {
						const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
						if (m && 'metalness' in m) {
							m.envMapIntensity = 1;
						}
					});
					resolve(wrap);
				},
				undefined,
				reject,
			);
		});
	}
	return cache;
};

// 金属の材質は、まわりの景色（環境マップ）がないと黒くつぶれる。やわらかい部屋の光を映りこみに使う
const Env: React.FC<{intensity: number}> = ({intensity}) => {
	const {gl, scene} = useThree();
	useEffect(() => {
		const pm = new THREE.PMREMGenerator(gl);
		const tex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
		scene.environment = tex;
		scene.environmentIntensity = intensity;
		return () => {
			tex.dispose();
			pm.dispose();
		};
	}, [gl, scene, intensity]);
	return null;
};

// 模型を置いたら、その場で1回描き直してから描き出しを進める（Remotion の three.js は、コマが進んだときだけ描き直すため）
const ReadyAfterDraw: React.FC<{ready: boolean; onDone: () => void}> = ({ready, onDone}) => {
	const advance = useThree((s) => s.advance);
	useEffect(() => {
		if (!ready) return;
		advance(performance.now());
		requestAnimationFrame(() => onDone());
	}, [ready, advance, onDone]);
	return null;
};

export const VoyagerModel: React.FC<{
	width: number;
	height: number;
	cx: number; // 画面の上の位置（px）
	cy: number;
	size: number; // 模型のいちばん長いところの、画面の上の長さ（px）
	yaw: number; // 向き（ラジアン）
	pitch: number;
	roll?: number;
	arrive: number; // 光が届いた瞬間からの経過（0〜1。届く前は -1）
	opacity?: number;
}> = ({width, height, cx, cy, size, yaw, pitch, roll = 0, arrive, opacity = 1}) => {
	const [model, setModel] = useState<THREE.Group | null>(null);
	const [handle] = useState(() => delayRender('ボイジャー1号の模型を読む'));
	useEffect(() => {
		loadModel()
			.then((m) => setModel(m.clone(true)))
			.catch((e) => {
				console.error(e);
				continueRender(handle);
			});
	}, [handle]);
	const [released, setReleased] = useState(false);
	const release = React.useCallback(() => {
		if (!released) {
			setReleased(true);
			continueRender(handle);
		}
	}, [released, handle]);

	// 画面の位置（px）→ 3D の位置。カメラは z=10 から原点を見る、縦の視野 30°
	const FOV = 30;
	const DIST = 10;
	const halfH = Math.tan(((FOV / 2) * Math.PI) / 180) * DIST; // 画面の高さの半分にあたる長さ
	const unit = halfH / (height / 2); // 1px あたりの長さ
	const pos = useMemo(() => new THREE.Vector3((cx - width / 2) * unit, -(cy - height / 2) * unit, 0), [cx, cy, width, height, unit]);
	const scale = size * unit;

	// 光が届いた瞬間：ミントの光が模型の表面をなでる（左上 → 右下へ動く点光源）
	const sweep = arrive >= 0 ? Math.min(1, arrive) : -1;
	const sweepPos: [number, number, number] = [pos.x + (-1.2 + 2.4 * Math.max(0, sweep)) * scale, pos.y + (0.8 - 1.6 * Math.max(0, sweep)) * scale, 1.2 * scale];
	const sweepI = sweep < 0 ? 0 : Math.sin(Math.PI * sweep) * 60;

	return (
		<ThreeCanvas
			width={width}
			height={height}
			style={{position: 'absolute', left: 0, top: 0, opacity}}
			camera={{fov: FOV, position: [0, 0, DIST], near: 0.1, far: 100}}
			gl={{antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace}}
		>
			{/* 太陽の側（カメラのうしろ・左上）からの暖かい主光 */}
			<directionalLight position={[-6, 5, 8]} intensity={2.6} color="#fff1d6" />
			{/* 青みの補助光（下・右） */}
			<directionalLight position={[5, -3, 2]} intensity={0.5} color="#7fa8ff" />
			{/* 輪郭の光（うしろから） */}
			<directionalLight position={[2, 3, -8]} intensity={1.8} color="#bfe6ff" />
			<ambientLight intensity={0.12} color="#9fb6d8" />
			<Env intensity={0.55} />
			<ReadyAfterDraw ready={!!model} onDone={release} />
			{sweepI > 0 ? <pointLight position={sweepPos} intensity={sweepI} distance={scale * 4} color="#5ef2c2" /> : null}
			{model ? (
				<group position={pos} scale={scale} rotation={[pitch, yaw, roll]}>
					{/* 模型の皿は +y を向いている → こちら（+z）へ向ける。ボイジャー1号の皿は通信のため地球を向いていて、
					    地球から光を追ってきたカメラから見ると、皿がこちらを向く */}
					<group rotation={[Math.PI / 2, 0, 0]}>
						<primitive object={model} />
					</group>
				</group>
			) : null}
		</ThreeCanvas>
	);
};
