// 台本：言葉・秒数・数字の出し方は、すべてここで変える。
// 「◯◯の言葉を変えて」「ビート3を2秒長く」などは、このファイル（と timing.json）だけ直せばよい。
// 秒は各ビートの頭からの秒数。事実の値は facts.ts（curation/ のカード）から来る。
// 字幕は MMX いまどこ と同じ3段：key（小さな計器の字）／title（太字。\n で改行）／sub（補足。**ではさむ**と計器の色の数字）
import T from './timing.json';
import {facts} from './facts';

export const FPS = T.fps;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const TRANSITION = T.transition; // 場面のつなぎ（フレーム。重ねて溶かす）

const n = (v: number) => v.toLocaleString('en-US');

export type Caption = {from: number; to: number; key: string; title: string; sub?: string};

export const beats = {
	now: {
		seconds: T.beats.now,
		readout: {key: 'NOW', value: '2026-10-22'},
		lockOn: {from: 0.8, to: 2.4}, // 照準が地球に合う
		captions: [
			{from: 0.8, to: 4.4, key: 'OBS-FEED', title: 'いま、この瞬間も。'},
			{from: 4.6, to: 8.8, key: 'VOYASCOPE', title: '宇宙は、動いている。', sub: '地球のまわりから、太陽系の外まで'},
		] as Caption[],
	},
	near: {
		seconds: T.beats.near,
		pushIn: {from: 0, to: 1.6},
		zoomOut: {from: 8.4, to: 11.4}, // ISS の近さ → 静止軌道まで引く
		captions: [
			{
				from: 0.6,
				to: 8.2,
				key: 'ISS · 国際宇宙ステーション',
				title: `頭の上、\n約${n(facts.iss.altitudeKm)} km。`,
				sub: `秒速 **約${facts.iss.speedKmS} km**。**約${facts.iss.periodMin}分**で地球を1周`,
			},
			{
				from: 11.0,
				to: 17.6,
				key: 'HIMAWARI-9 · ひまわり9号',
				title: `さらに遠く、\n約${n(facts.himawari.altitudeKm)} km。`,
				sub: '日本と東アジアの天気を見はる',
			},
		] as Caption[],
		labels: {iss: '国際宇宙ステーション', himawari: 'ひまわり9号', japan: '日本'},
		badgeNear: '地球と軌道の大きさの比は本物どおり',
	},
	depart: {
		seconds: T.beats.depart,
		liftoff: T.cues.liftoff[1] as number,
		separation: T.cues.separation[1] as number, // 早送りで、ここで分離の時刻になる
		toSolar: {from: T.cues.toSolar[1] as number, to: (T.cues.toSolar[1] as number) + 2},
		cruise: {from: 10.6, to: 15.4},
		captions: [
			{
				from: 0.5,
				to: 8.2,
				key: 'MMX · 火星衛星探査機',
				title: `${facts.mmx.launchJa}、\n${facts.mmx.site}から火星へ。`,
				sub: `${facts.mmx.vehicle}。**${facts.mmx.sepJst}ごろ**ロケットから分離`,
			},
			{from: 10.6, to: 14.6, key: 'MISSION', title: '火星の衛星フォボスの砂を、\n地球へ持ち帰る。'},
			{
				from: 14.8,
				to: 19.6,
				key: 'SAMPLE RETURN',
				title: `帰ってくるのは、\n${facts.mmx.returnFy}年度の予定。`,
				sub: '人類初の、火星圏からのサンプルリターンをめざす',
			},
		] as Caption[],
		badgeFast: '早送り',
		badgeSchematic: '模式図：軌道の形・位置は実際のものではありません',
	},
	far: {
		seconds: T.beats.far,
		count: {from: T.cues.lightStart[1] as number, to: T.cues.lightArrive[1] as number},
		captions: [
			{from: 0.6, to: 5.6, key: 'VOYAGER 1 · ボイジャー1号', title: `${facts.voyager.launchYear}年に旅立ち、\nいまは恒星間空間を飛ぶ。`},
			{
				from: 6.0,
				to: 11.8,
				key: facts.voyager.lightDayIso,
				title: '光でも24時間かかる\n距離に届く。',
				sub: `地球から光で1日＝**約${facts.voyager.lightDayOku}億 km**`,
			},
			{from: 12.2, to: 17.6, key: '1 LIGHT-DAY', title: '人がつくったもので、\nはじめて。', sub: `${facts.voyager.lightDayJa}（NASA の発表）`},
		] as Caption[],
		badge: '模式図：距離の比は実際のものではありません',
	},
	logo: {
		seconds: T.beats.logo,
		tagline: {from: 0.3, to: 3.0, text: '宇宙の「いま」を、のぞこう。'},
		ring: T.cues.ring[1] as number, // 光が金の輪を描きはじめる
		reveal: T.cues.logoReveal[1] as number, // 本物のロゴに重なる
		url: 'voyascope.org',
		disclaimer: '非公式のファンメイド作品です。宇宙機関・運用者とは関係ありません',
	},
	sources: {
		seconds: T.beats.sources,
		title: '出典',
		footer: '数字は 2026年10月22日時点の VOYASCOPE のカードから。最新の情報は、公式のページで確かめてください。',
		credit: '音楽・映像：コードで生成（VOYASCOPE / 151Me）。非公式のファンメイド作品です。',
	},
};

// 画面の上の帯と、下の「地球からの距離」の目盛り（すべての場面で共通）
export const chrome = {
	pill: '非公式のファンメイド作品・出典は最後に',
	arcTitle: 'DISTANCE FROM EARTH',
	arcNote: '目盛りの間かくは模式',
	ticks: [
		{label: 'EARTH', sub: ''},
		{label: 'ISS', sub: `${n(facts.iss.altitudeKm)} km`},
		{label: 'HIMAWARI-9', sub: `${n(facts.himawari.altitudeKm)} km`},
		{label: 'MARS', sub: 'MMX'},
		{label: 'VOYAGER 1', sub: '1 LIGHT-DAY'},
	],
	// [ビート, 秒, 目盛りの位置（0〜4）]：この点を結んで、いまの場所の印が進む
	arcKeys: [
		['now', 0, 0],
		['near', 0.6, 0],
		['near', 2.0, 1],
		['near', 8.4, 1],
		['near', 11.4, 2],
		['depart', 10.6, 2],
		['depart', 15.4, 3],
		['far', T.cues.lightStart[1], 3],
		['far', T.cues.lightArrive[1], 4],
	] as [BeatKey, number, number][],
};

export const ORDER = ['now', 'near', 'depart', 'far', 'logo', 'sources'] as const;
export type BeatKey = (typeof ORDER)[number];

export const sec = (s: number) => Math.round(s * FPS);
// ビートの頭のフレーム（つなぎのぶん重なる）
export const beatStart = (k: BeatKey) => {
	let at = 0;
	for (const b of ORDER) {
		if (b === k) return at;
		at += sec(beats[b].seconds) - TRANSITION;
	}
	return at;
};
export const TOTAL_FRAMES = beatStart('sources') + sec(beats.sources.seconds);
