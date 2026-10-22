// 横（1920×1080）か縦（1080×1920。スマホ・ショート向け）か。Root が Composition ごとに渡す
// 縦では、X・TikTok・ショートの画面の下と右に出るボタンを避けて、文字を上と真ん中に寄せる
import React, {createContext, useContext} from 'react';

export type Layout = {
	vertical: boolean;
	W: number;
	H: number;
	pad: number; // 左右の余白
	readoutTop: number; // 左上の大きな計器の数字
	tmTop: number; // その下の値の行
	badgeTop: number; // 場面ごとの注記（模式図・早送り など）
	capBottom: number; // 字幕のブロックの下の端（画面の下から）
	capTitle: number; // 字幕の太字の大きさ
	capSub: number;
	arcY: number; // 下の目盛りの線の高さ
};

export const H_LAYOUT: Layout = {vertical: false, W: 1920, H: 1080, pad: 80, readoutTop: 112, tmTop: 206, badgeTop: 116, capBottom: 190, capTitle: 64, capSub: 30, arcY: 1022};
export const V_LAYOUT: Layout = {vertical: true, W: 1080, H: 1920, pad: 64, readoutTop: 150, tmTop: 250, badgeTop: 410, capBottom: 380, capTitle: 58, capSub: 27, arcY: 1690};

const Ctx = createContext<Layout>(H_LAYOUT);
export const LayoutProvider: React.FC<{layout: Layout; children: React.ReactNode}> = ({layout, children}) => <Ctx.Provider value={layout}>{children}</Ctx.Provider>;
export const useLayout = () => useContext(Ctx);
// 横と縦で値を出し分ける
export const pick = <T,>(L: Layout, h: T, v: T) => (L.vertical ? v : h);
