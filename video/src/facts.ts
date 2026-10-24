// 動画に出す事実は、すべて curation/ のカードから直接読む（手で写さない）。
// カードを直せば、次のレンダリングで動画も変わる。出典は sources にまとめて最後の画面に出す。
import iss from '../../curation/spacecraft/iss.json';
import himawari from '../../curation/spacecraft/himawari-9.json';
import mmx from '../../curation/probes/mmx.json';
import mmxLaunch from '../../curation/events/mmx-launch.json';
import voyager from '../../curation/probes/voyager-1.json';
import voyagerLightDay from '../../curation/events/voyager-1-one-light-day.json';
import orionids from '../../curation/events/orionids-2026.json';
// 打ち上げの日の計画（JAXA 打上げ計画書［2026年10月改訂版］の表2）。サイトの地球の画面と同じデータ
import {LAUNCH_PLANS} from '../../web/js/launch-plan.js';

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

const plan = LAUNCH_PLANS['mmx-launch'];

// 計画書の図3「ロケットの飛行経路」（10月20日に打ち上げた場合）の地上の経路。
// 図から読み取った点なので、度の値はおおよそ（経度は東経。360 を超えたら1周の先）。時刻（秒）は表2の事象のもの
const PLAN_PDF_FIG3 = plan.source;
export const GROUND_TRACK: {t: number; lon: number; lat: number}[] = [
	{t: 0, lon: 131.0, lat: 30.4}, // リフトオフ（種子島）
	{t: 197, lon: 134.0, lat: 30.6}, // 衛星フェアリング分離
	{t: 292, lon: 137.0, lat: 30.4}, // 第1段エンジン燃焼停止
	{t: 640, lon: 158.5, lat: 26.5}, // 第2段 第1回燃焼停止（SECO1）→ ここから慣性飛行
	{t: 1020, lon: 182, lat: 16}, // 慣性飛行（太平洋）
	{t: 1500, lon: 210, lat: 1}, // 赤道を南へ
	{t: 2050, lon: 245, lat: -19},
	{t: 2600, lon: 275, lat: -28.5},
	{t: 2950, lon: 297, lat: -30}, // 南米の南
	{t: 3400, lon: 328, lat: -25},
	{t: 3837, lon: 355, lat: -15}, // 第2段 第2回推力立上がり（SELI2。大西洋）
	{t: 4221, lon: 381, lat: 0}, // 第2段 第2回燃焼停止（SECO2）
	{t: 4272, lon: 385, lat: 2.5}, // MMX 分離（アフリカの上空）
];

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
		// 分離の時刻：カードの status の note「…5:52 ごろ H3 ロケットから分離（JAXA の打上げライブ中継で確認）」から
		sepJst: /(\d{1,2}:\d{2}) ?ごろ/.exec(mmx.status.note)![1],
		// 打ち上げから分離までの分（分離の時刻は「ごろ」なので、分の単位まで）
		sepElapsedMin: (() => {
			const [h, m] = /(\d{1,2}):(\d{2}) ?ごろ/.exec(mmx.status.note)!.slice(1).map(Number);
			return Math.round(h * 60 + m - (mmxT.h * 60 + mmxT.mi + mmxT.s / 60));
		})(),
		// カードの要約「2031年度に、人類初の火星圏からのサンプルリターンをめざす」から年度を取り出す
		returnFy: Number(/(\d{4})年度/.exec(mmxLaunch.summary.value)![1]),
		// 計画の流れ（表2）：t はミリ秒、alt は km、vel は km/s（どれも計画の値。範囲は「224〜329」のような文字）
		planSteps: plan.steps as {t: number; en: string; label: string; alt: string; vel: string; separation?: boolean}[],
	},
	orionids: {
		peakIso: orionids.when.value.date, // 2026-10-22（極大）
		peakJa: `${Number(orionids.when.value.date.slice(5, 7))}月${Number(orionids.when.value.date.slice(8, 10))}日`,
		rate: /(\d+〜\d+)個/.exec(orionids.rate.value)![1], // 5〜10（暗い空・見ごろ・1時間に）
		radiant: orionids.radiant.value, // 赤経・赤緯（度）
		stars: orionids.constellation.stars.value,
		lines: orionids.constellation.lines as [number, number][],
		parent: orionids.parent.name.value, // ハレー彗星（1P/Halley）
		orbit: orionids.parent.orbit.value, // e, a, q, i, om, w（JPL SBDB）
		solarLon: Number(/太陽黄経 ([\d.]+)°/.exec(orionids.radiant.note)![1]), // 209.5（極大のころ）
	},
	voyager: {
		launchYear: voyL.y,
		launchIso: voyager.launch_date.value,
		lightDayJa: `${ldT.y}年${ldT.mo}月${ldT.d}日`,
		lightDayIso: `${ldT.y}-${pad(ldT.mo)}-${pad(ldT.d)}`,
		lightDayOku: Math.round(LIGHT_DAY_KM / 1e8), // 259（億 km）
	},
};

type Source = {label: string; url: string; only?: 'himawari' | 'sky'};
const ALL_SOURCES: Source[] = [
	{label: '地球の半径（NASA Earth Fact Sheet）', url: EARTH_FACT_SHEET},
	{label: '国際宇宙ステーションの高さ（NASA）', url: iss.stats.altitude_km.source},
	{label: '国際宇宙ステーションの速さ（NASA）', url: iss.stats.speed_km_s.source},
	{label: '国際宇宙ステーションの周回時間（NASA）', url: iss.stats.period_min.source},
	{label: 'ひまわり9号の高さ（気象庁）', url: himawari.stats.altitude_km.source, only: 'himawari'},
	{label: 'ひまわり9号の仕事（気象庁）', url: himawari.mission.source, only: 'himawari'},
	{label: 'オリオン座流星群の極大・数の目安（国立天文台）', url: orionids.when.source, only: 'sky'},
	{label: 'オリオン座流星群の母天体（国立天文台）', url: orionids.parent.name.source, only: 'sky'},
	{label: '放射点（IAU 流星データセンター）', url: orionids.radiant.source, only: 'sky'},
	{label: 'オリオン座の星の位置（IAU）', url: orionids.constellation.stars.source, only: 'sky'},
	{label: 'ハレー彗星の軌道（JPL SBDB）', url: orionids.parent.orbit.source, only: 'sky'},
	{label: 'MMX の打ち上げ日時（JAXA）', url: mmxLaunch.when.source},
	{label: 'MMX の飛行計画・飛行経路（JAXA 打上げ計画書 改訂版 表2・図3）', url: PLAN_PDF_FIG3},
	{label: 'MMX の打ち上げと分離の確認（JAXA の中継）', url: mmx.status.source},
	{label: 'MMX のロケットと 2031年度の帰還（JAXA 打上げ計画書）', url: mmxLaunch.summary.source},
	{label: 'MMX のミッション（JAXA）', url: mmx.mission.source},
	{label: 'ボイジャー1号の打ち上げ（NASA）', url: voyager.launch_date.source},
	{label: 'ボイジャー1号が1光日に届く日（NASA）', url: voyagerLightDay.when.source},
	{label: 'ボイジャー1号の3D模型（NASA Science「Voyager 3D Model」・NASA VTAD）', url: 'https://science.nasa.gov/resource/voyager-3d-model/'},
];
export const sourcesFor = (v: 'himawari' | 'sky') => ALL_SOURCES.filter((x) => !x.only || x.only === v);
