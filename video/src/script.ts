// 台本：言葉・秒数・数字の出し方は、すべてここで変える。
// 「◯◯の言葉を変えて」「ビート3を2秒長く」などは、このファイルだけ直せばよい。
// 秒は各ビートの頭からの秒数。事実の値は facts.ts（curation/ のカード）から来る。
import {facts} from './facts';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

const n = (v: number) => v.toLocaleString('en-US');

export type Line = {text: string; from: number; to: number; size?: 'l' | 'm' | 'xl'};

export const beats = {
	now: {
		seconds: 10,
		clock: '2026-10-22  NOW',
		lines: [
			{text: 'いま、この瞬間も。', from: 1.2, to: 5.2},
			{text: '宇宙は、動いている。', from: 5.4, to: 9.6, size: 'xl'},
		] as Line[],
	},
	near: {
		seconds: 18,
		zoomOut: {from: 8.4, to: 11.4}, // ISS の近さ → 静止軌道まで引く
		lines: [
			{text: `頭の上、約${n(facts.iss.altitudeKm)} km。`, from: 0.6, to: 4.4},
			{text: `秒速 約${facts.iss.speedKmS} km。約${facts.iss.periodMin}分で地球を1周。`, from: 4.6, to: 8.4},
			{text: `さらに遠く、約${n(facts.himawari.altitudeKm)} km。`, from: 10.6, to: 14.0},
			{text: 'ひまわり9号が、日本と東アジアの天気を見はる。', from: 14.2, to: 17.6},
		] as Line[],
		labels: {iss: '国際宇宙ステーション', himawari: 'ひまわり9号'},
		scaleNote: '地球と軌道の大きさの比は、本物どおり',
	},
	depart: {
		seconds: 20,
		toSolar: {from: 8.2, to: 10.2}, // 地球のアップ → 太陽系の模式図
		lines: [
			{text: `${facts.mmx.launchJa}。`, from: 0.6, to: 4.0},
			{text: `MMX が、${facts.mmx.site}から火星へ。`, from: 4.2, to: 8.0},
			{text: '火星の衛星フォボスの砂を、地球へ持ち帰る。', from: 10.4, to: 14.4},
			{text: `帰ってくるのは、${facts.mmx.returnFy}年度の予定。`, from: 14.6, to: 19.4},
		] as Line[],
		schematicNote: '模式図：軌道の形・位置は実際のものではありません',
	},
	far: {
		seconds: 18,
		lines: [
			{text: `${facts.voyager.launchYear}年に旅立った、ボイジャー1号。`, from: 0.6, to: 4.2},
			{text: `${facts.voyager.lightDayJa}、`, from: 4.4, to: 7.4},
			{text: '光でも24時間かかる距離に届く。', from: 7.6, to: 11.4},
			{text: `約${facts.voyager.lightDayOku}億 km。人がつくったもので、はじめて。`, from: 11.6, to: 17.6},
		] as Line[],
		count: {from: 6.0, to: 12.0}, // 距離と光の時間のカウンタが回る区間
		schematicNote: '模式図：距離の比は実際のものではありません',
	},
	cta: {
		seconds: 14,
		gather: {from: 3.0, to: 4.6}, // 4つの窓が1つに集まる
		lines: [{text: '宇宙の「いま」を、のぞこう。', from: 3.6, to: 6.6, size: 'xl'}] as Line[],
		wordmarkFrom: 6.8,
		url: 'voyascope.org',
		disclaimer: '※非公式のファンメイド作品です。宇宙機関・運用者とは関係ありません。',
	},
	sources: {
		seconds: 6,
		title: '出典',
		footer: '数字は 2026年10月22日時点のカードから。最新の情報は、公式のページで確かめてください。',
	},
};

export const ORDER = ['now', 'near', 'depart', 'far', 'cta', 'sources'] as const;
export const DIP = 8; // ビートの区切りの暗転（フレーム）

export const sec = (s: number) => Math.round(s * FPS);
export const TOTAL_FRAMES = ORDER.reduce((a, k) => a + sec(beats[k].seconds), 0);
