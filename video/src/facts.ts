// 動画に出す事実は、すべて curation/ のカードから直接読む（手で写さない）。
// カードを直せば、次のレンダリングで動画も変わる。出典は sources にまとめて最後の画面に出す。
import iss from '../../curation/spacecraft/iss.json';
import himawari from '../../curation/spacecraft/himawari-9.json';
import mmx from '../../curation/probes/mmx.json';
import mmxLaunch from '../../curation/events/mmx-launch.json';
import voyager from '../../curation/probes/voyager-1.json';
import voyagerLightDay from '../../curation/events/voyager-1-one-light-day.json';

const jst = (iso: string) => {
	// UTC の ISO 文字列を日本時間に直す（Intl に頼らず、描画環境で結果が変わらないように）
	const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
	return {
		y: d.getUTCFullYear(),
		mo: d.getUTCMonth() + 1,
		d: d.getUTCDate(),
		h: d.getUTCHours(),
		mi: d.getUTCMinutes(),
		s: d.getUTCSeconds(),
	};
};
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (iso: string) => {
	const [y, m, d] = iso.split('-').map(Number);
	return {y, m, d};
};

const mmxT = jst(mmxLaunch.when.value.at);
const voyL = ymd(voyager.launch_date.value);
const ldT = jst(voyagerLightDay.when.value.at);

// 光の速さ（定義値）× 1日。NASA の「約259億 km」と合うことを確かめるために使う
export const LIGHT_DAY_KM = 299792.458 * 86400;

// 地球の平均半径（NASA Earth Fact Sheet の volumetric mean radius）。軌道の大きさの比を出すためだけに使う
export const EARTH_RADIUS_KM = 6371;
const EARTH_FACT_SHEET = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html';

export const facts = {
	iss: {
		altitudeKm: iss.stats.altitude_km.value,
		speedKmS: iss.stats.speed_km_s.value,
		periodMin: iss.stats.period_min.value,
	},
	himawari: {
		altitudeKm: himawari.stats.altitude_km.value,
	},
	mmx: {
		launchJst: `${mmxT.y}-${pad(mmxT.mo)}-${pad(mmxT.d)} ${pad(mmxT.h)}:${pad(mmxT.mi)}:${pad(mmxT.s)} JST`,
		launchJa: `${mmxT.y}年${mmxT.mo}月${mmxT.d}日 ${mmxT.h}時${mmxT.mi}分`,
		vehicle: mmxLaunch.vehicle.value,
		site: mmxLaunch.site.label,
		sitePos: mmxLaunch.site.position.value,
		// カードの要約「2031年度に、人類初の火星圏からのサンプルリターンをめざす」から年度を取り出す
		returnFy: Number(/(\d{4})年度/.exec(mmxLaunch.summary.value)![1]),
	},
	voyager: {
		launchYear: voyL.y,
		launchIso: voyager.launch_date.value,
		lightDayJa: `${ldT.y}年${ldT.mo}月${ldT.d}日`,
		lightDayIso: `${ldT.y}-${pad(ldT.mo)}-${pad(ldT.d)}`,
		lightDayOku: Math.round(LIGHT_DAY_KM / 1e8), // 259（億 km）
	},
};

export const sources: {label: string; url: string}[] = [
	{label: '地球の半径（NASA Earth Fact Sheet）', url: EARTH_FACT_SHEET},
	{label: '国際宇宙ステーションの高さ（NASA）', url: iss.stats.altitude_km.source},
	{label: '国際宇宙ステーションの速さ（NASA）', url: iss.stats.speed_km_s.source},
	{label: '国際宇宙ステーションの周回時間（NASA）', url: iss.stats.period_min.source},
	{label: 'ひまわり9号の高さ（気象庁）', url: himawari.stats.altitude_km.source},
	{label: 'ひまわり9号の仕事（気象庁）', url: himawari.mission.source},
	{label: 'MMX の打ち上げ日時（JAXA）', url: mmxLaunch.when.source},
	{label: 'MMX の打ち上げの確認（JAXA の中継）', url: mmxLaunch.status.source},
	{label: 'MMX のロケットと 2031年度の帰還（JAXA 打上げ計画書）', url: mmxLaunch.summary.source},
	{label: 'MMX のミッション（JAXA）', url: mmx.mission.source},
	{label: 'ボイジャー1号の打ち上げ（NASA）', url: voyager.launch_date.source},
	{label: 'ボイジャー1号が1光日に届く日（NASA）', url: voyagerLightDay.when.source},
];
