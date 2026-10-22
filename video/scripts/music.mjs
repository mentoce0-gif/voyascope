// 動画の音楽を、コードで合成して public/music/theme.wav に書き出す（サンプルや既存の曲は使わない）。
// 映像のきっかけ（打ち上げ・光が届く・ロゴ）は src/timing.json から読むので、秒を変えたら作り直すだけで合う。
//   node scripts/music.mjs            … すべての版（public/music/theme-<版>.wav）
//   node scripts/music.mjs sky        … 流星群版だけ
// 曲の形：D の音階。静かな和音 → 計器の刻み → 打ち上げで鼓動 → 遠くで鐘 → ロゴで長調に着地
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const T = JSON.parse(readFileSync(path.join(root, 'src/timing.json'), 'utf8'));
const VARIANT = process.argv[2];
if (!VARIANT) {
	// 版を指定しなければ、すべての版を順に作る
	for (const v of Object.keys(T.variants)) execFileSync(process.execPath, [import.meta.filename, v], {stdio: 'inherit'});
	process.exit(0);
}
const ORDER = T.variants[VARIANT].order;
const secOf = (k) => T.variants[VARIANT].beats[k] ?? T.beats[k];
const OVER = T.transition / T.fps;
const start = {};
let acc = 0;
ORDER.forEach((k, i) => {
	start[k] = acc;
	acc += secOf(k) - (i < ORDER.length - 1 ? OVER : 0);
});
const next = (k) => start[ORDER[ORDER.indexOf(k) + 1]]; // 次のビートの頭
const DUR = acc;
const cue = (name) => start[T.cues[name][0]] + T.cues[name][1];

const SR = 48000;
const N = Math.ceil(DUR * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
const sendL = new Float32Array(N); // リバーブへ送る分
const sendR = new Float32Array(N);

// 決まった乱数（毎回同じ音になるように）
let seed = 151;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const TAU = Math.PI * 2;

// 帯域を制限したノコギリ波の表（倍音16まで）
const TAB = 4096;
const saw = new Float32Array(TAB);
for (let i = 0; i < TAB; i++) for (let h = 1; h <= 16; h++) saw[i] += Math.sin((TAU * h * i) / TAB) / h;
const tab = (t, ph) => {
	const x = (ph % 1) * TAB;
	const i = x | 0;
	return t[i] + (t[(i + 1) % TAB] - t[i]) * (x - i);
};

const put = (i, l, r, send = 0.35) => {
	if (i < 0 || i >= N) return;
	L[i] += l;
	R[i] += r;
	sendL[i] += l * send;
	sendR[i] += r * send;
};

// --- 和音（パッド）：ゆっくり立ち上がり、ゆっくり消える
const pad = (t0, t1, notes, gain, {bright = 0.25, att = 1.6, rel = 2.2} = {}) => {
	const s0 = Math.floor(t0 * SR);
	const s1 = Math.floor((t1 + rel) * SR);
	notes.forEach((m, ni) => {
		[-0.09, 0, 0.08].forEach((det, di) => {
			const f = hz(m + det);
			let ph = Math.abs(rnd());
			let lp = 0;
			const pan = ((ni + di) % 3) / 2 - 0.5;
			for (let s = s0; s < s1 && s < N; s++) {
				const t = s / SR;
				const env = Math.min(1, (t - t0) / att) * (t > t1 ? Math.max(0, 1 - (t - t1) / rel) : 1);
				ph += f / SR;
				const cut = bright * (0.8 + 0.2 * Math.sin(TAU * 0.07 * t + ni));
				lp += cut * (tab(saw, ph) - lp);
				const v = lp * env * gain * 0.06;
				put(s, v * (0.6 - pan * 0.4), v * (0.6 + pan * 0.4), 0.5);
			}
		});
	});
};

// --- 音の粒（アルペジオ・刻み）
const pluck = (t, m, gain, dec = 0.35, pan = 0) => {
	const s0 = Math.floor(t * SR);
	const f = hz(m);
	const len = Math.floor(dec * 5 * SR);
	for (let k = 0; k < len; k++) {
		const tt = k / SR;
		const env = Math.exp(-tt / dec) * Math.min(1, tt / 0.004);
		const v = (Math.sin(TAU * f * tt) + 0.3 * Math.sin(TAU * 2 * f * tt) * Math.exp(-tt / (dec * 0.4))) * env * gain;
		put(s0 + k, v * (1 - pan) * 0.7, v * (1 + pan) * 0.7, 0.45);
	}
};

// --- 鐘（FM）
const bell = (t, m, gain, dec = 2.4, pan = 0) => {
	const s0 = Math.floor(t * SR);
	const f = hz(m);
	const len = Math.floor(dec * 4 * SR);
	for (let k = 0; k < len; k++) {
		const tt = k / SR;
		const env = Math.exp(-tt / dec) * Math.min(1, tt / 0.002);
		const mod = Math.sin(TAU * f * 3.5 * tt) * 2.2 * Math.exp(-tt / (dec * 0.3));
		const v = Math.sin(TAU * f * tt + mod) * env * gain;
		put(s0 + k, v * (1 - pan) * 0.7, v * (1 + pan) * 0.7, 0.7);
	}
};

// --- 鼓動（やわらかいキック）
const kick = (t, gain) => {
	const s0 = Math.floor(t * SR);
	let ph = 0;
	for (let k = 0; k < 0.5 * SR; k++) {
		const tt = k / SR;
		const f = 45 + 75 * Math.exp(-tt / 0.04);
		ph += f / SR;
		const v = Math.sin(TAU * ph) * Math.exp(-tt / 0.16) * gain;
		put(s0 + k, v, v, 0.05);
	}
};

// --- 計器の刻み（短い電子音）
const tick = (t, gain, f = 2100, pan = 0) => {
	const s0 = Math.floor(t * SR);
	for (let k = 0; k < 0.03 * SR; k++) {
		const tt = k / SR;
		const v = Math.sin(TAU * f * tt) * Math.exp(-tt / 0.008) * gain;
		put(s0 + k, v * (1 - pan), v * (1 + pan), 0.3);
	}
};

// --- 上がっていく風の音（ノイズを帯域フィルタで掃く）
const riser = (t0, t1, gain, f0 = 300, f1 = 5000) => {
	const s0 = Math.floor(t0 * SR);
	const s1 = Math.floor(t1 * SR);
	let low = 0;
	let band = 0;
	for (let s = s0; s < s1; s++) {
		const p = (s - s0) / (s1 - s0);
		const f = f0 * (f1 / f0) ** p;
		const F = 2 * Math.sin((Math.PI * f) / SR);
		const high = rnd() - low - 0.5 * band;
		band += F * high;
		low += F * band;
		const v = band * gain * p * p * 0.5;
		put(s, v, v * 0.9, 0.6);
	}
};

// --- 衝撃（キック＋低い音のうねり＋ノイズ）
const impact = (t, gain) => {
	kick(t, gain);
	const s0 = Math.floor(t * SR);
	let lp = 0;
	for (let k = 0; k < 2.5 * SR; k++) {
		const tt = k / SR;
		lp += 0.04 * (rnd() - lp);
		const sub = Math.sin(TAU * 36.7 * tt) * Math.exp(-tt / 0.9);
		const v = (sub * 0.8 + lp * 2.5 * Math.exp(-tt / 0.35)) * gain;
		put(s0 + k, v, v, 0.5);
	}
};

// ============ 曲 ============
const D3 = 50;
const chords = {
	Dm9: [D3, 57, 60, 64, 65],
	Bbmaj7: [46, 53, 57, 62, 65],
	F: [41, 53, 57, 60, 65],
	Csus: [48, 55, 60, 62, 67],
	Gm9: [43, 55, 58, 62, 69],
	Dmaj9: [38, 50, 57, 61, 64, 66],
};
const BPM = 84;
const beat = 60 / BPM;

// 1. いま：静かな和音と、きらめき
pad(0, start.near + 1, [D3, 57, 64], 1.0, {bright: 0.12, att: 3.5});
[1.2, 3.4, 5.8].forEach((t, i) => bell(t, [81, 76, 86][i], 0.05, 2.0, [-0.5, 0.4, 0][i]));

// 2. すぐ上：和音が進み、計器の刻み（8分）が入る
const prog = ['Dm9', 'Bbmaj7', 'F', 'Csus'];
{
	let t = start.near;
	let i = 0;
	while (t < next('near') - 0.5) {
		const len = Math.min(beat * 8, next('near') - t);
		pad(t, t + len, chords[prog[i % 4]], 0.9, {bright: 0.18, att: 1.2, rel: 1.6});
		i++;
		t += beat * 8;
	}
	const arp = [74, 69, 72, 76, 74, 69, 77, 72];
	for (let k = 0, tt = start.near + 0.6; tt < next('near') - 0.8; k++, tt += beat / 2) {
		pluck(tt, arp[k % arp.length], 0.07, 0.18, k % 2 ? 0.35 : -0.35);
	}
}

// 2'. 星空（流星群版だけ）：刻みが止み、静かな夜の和音。流れ星ごとに「ひゅっ」と高い鈴
const whoosh = (t, gain, pan) => {
	const s0 = Math.floor(t * SR);
	let low = 0;
	let band = 0;
	for (let k = 0; k < 0.6 * SR; k++) {
		const p = k / (0.6 * SR);
		const f = 6000 * (1 - p) + 900 * p; // 高いところから下りる
		const F = 2 * Math.sin((Math.PI * f) / SR);
		const high = rnd() - low - 0.4 * band;
		band += F * high;
		low += F * band;
		const v = band * gain * Math.sin(Math.PI * p) ** 2;
		put(s0 + k, v * (1 - pan) * 0.8, v * (1 + pan) * 0.8, 0.6);
	}
};
if (start.sky !== undefined) {
	pad(start.sky - 0.3, next('sky'), [38, 50, 57, 62, 69], 1.0, {bright: 0.09, att: 2.2, rel: 1.8});
	pad(start.sky + 1, start.sky + T.beats.sky * 0.62, [74, 78, 81], 0.5, {bright: 0.07, att: 2.5, rel: 1.5}); // 夜空
	T.meteors.forEach((m, i) => {
		const t = start.sky + m;
		whoosh(t, 0.22, ((i % 5) - 2) / 3);
		bell(t + 0.05, [86, 88, 90, 93, 86, 90, 88, 93, 86, 90][i % 10], 0.04, 1.4, ((i % 3) - 1) / 2);
	});
	// ハレー彗星の軌道へ引くところ：低い和音がふくらむ
	pad(start.sky + 10, next('sky'), [36, 43, 50, 55], 0.9, {bright: 0.12, att: 2.0, rel: 1.0});
	riser(next('sky') - 2.2, next('sky') + 0.4, 0.25, 300, 3000);
}

// 3. 出発：打ち上げの前に風が上がり、打ち上げで衝撃、そこから鼓動
const lift = cue('liftoff');
riser(lift - 2.6, lift, 0.5);
impact(lift, 0.9);
{
	const dprog = ['Dm9', 'Bbmaj7', 'F', 'Csus', 'Gm9', 'Bbmaj7'];
	let t = start.depart;
	let i = 0;
	while (t < start.far) {
		const len = Math.min(beat * 4, start.far - t);
		pad(t, t + len, chords[dprog[i % dprog.length]], 1.0, {bright: 0.24, att: 0.6, rel: 1.4});
		i++;
		t += beat * 4;
	}
	for (let tt = lift + beat; tt < start.far - 1.2; tt += beat) kick(tt, 0.45);
	const bass = [38, 38, 34, 34, 41, 41, 36, 36];
	for (let k = 0, tt = lift; tt < start.far - 1.2; k++, tt += beat * 2) pluck(tt, bass[k % 8], 0.16, 0.5, 0);
	for (let k = 0, tt = lift + beat / 2; tt < start.far - 1.2; k++, tt += beat / 2) tick(tt, 0.025, k % 4 ? 2100 : 2800, k % 2 ? 0.4 : -0.4);
	bell(cue('separation'), 81, 0.07, 1.6, 0.3); // 分離
	impact(cue('toSolar') + 0.4, 0.35);
}

// 4. いちばん遠く：鼓動が消え、広い和音。光が進むあいだ、1時間ごとに刻み（24回）、届いたら鐘
pad(start.far, start.logo, [38, 50, 57, 64, 69], 1.0, {bright: 0.1, att: 2.5, rel: 2.5});
pad(start.far + 4, start.logo, [74, 81], 0.6, {bright: 0.08, att: 3});
{
	const a = cue('lightStart');
	const b = cue('lightArrive');
	for (let h = 1; h <= 24; h++) tick(a + ((b - a) * h) / 24, 0.03 + 0.002 * h, 1800 + h * 30, ((h % 5) - 2) / 4);
	bell(b, 74, 0.12, 3.5, 0);
	bell(b + 0.02, 81, 0.07, 3.0, 0.3);
}

// 5. ロゴ：風が上がり、輪が描かれ、長調の和音に着地
pad(start.logo - 0.5, cue('logoReveal'), [38, 45, 50, 57], 0.8, {bright: 0.1, att: 1.5, rel: 0.6}); // 着地までのつなぎ
riser(cue('ring') - 2.4, cue('logoReveal'), 0.35, 400, 7000);
[0, 1, 2, 3].forEach((k) => pluck(cue('ring') + k * 0.28, [69, 74, 78, 81][k], 0.08, 0.4, (k - 1.5) / 3));
impact(cue('logoReveal'), 0.7);
pad(cue('logoReveal'), DUR - 2.5, chords.Dmaj9, 1.25, {bright: 0.2, att: 0.4, rel: 3});
bell(cue('logoReveal'), 86, 0.08, 3.5, -0.3);
bell(cue('logoReveal') + 0.18, 90, 0.05, 3.5, 0.3);

// ============ リバーブ（Schroeder）と仕上げ ============
const reverb = (inp, out, combs, aps) => {
	const cb = combs.map((d) => ({buf: new Float32Array(d), i: 0, lp: 0}));
	const ab = aps.map((d) => ({buf: new Float32Array(d), i: 0}));
	for (let s = 0; s < N; s++) {
		let acc2 = 0;
		for (const c of cb) {
			const y = c.buf[c.i];
			c.lp = y * 0.7 + c.lp * 0.3;
			c.buf[c.i] = inp[s] + c.lp * 0.86;
			c.i = (c.i + 1) % c.buf.length;
			acc2 += y;
		}
		let x = acc2 / cb.length;
		for (const a of ab) {
			const y = a.buf[a.i];
			a.buf[a.i] = x + y * 0.5;
			a.i = (a.i + 1) % a.buf.length;
			x = y - x * 0.5;
		}
		out[s] += x * 0.9;
	}
};
reverb(sendL, L, [1557, 1617, 1491, 1422, 1277, 1356].map((d) => d * 2), [225, 556]);
reverb(sendR, R, [1580, 1640, 1514, 1445, 1300, 1379].map((d) => d * 2), [248, 579]);

let peak = 0;
for (let s = 0; s < N; s++) {
	const t = s / SR;
	const fade = Math.min(1, t / 0.8) * Math.min(1, (DUR - t) / 3);
	L[s] = Math.tanh(L[s] * 1.2) * fade;
	R[s] = Math.tanh(R[s] * 1.2) * fade;
	peak = Math.max(peak, Math.abs(L[s]), Math.abs(R[s]));
}
const norm = 0.89 / peak; // -1 dBFS
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(N * 4, 40);
for (let s = 0; s < N; s++) {
	buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[s] * norm)) * 32767), 44 + s * 4);
	buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[s] * norm)) * 32767), 46 + s * 4);
}
mkdirSync(path.join(root, 'public/music'), {recursive: true});
writeFileSync(path.join(root, `public/music/theme-${VARIANT}.wav`), buf);
console.log(`public/music/theme-${VARIANT}.wav（${DUR.toFixed(2)} 秒）`);
