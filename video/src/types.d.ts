declare module '*.geojson' {
	const value: {features: {geometry: {type: string; coordinates: unknown}}[]};
	export default value;
}
declare module '*.webp' {
	const src: string;
	export default src;
}
declare module '*/launch-plan.js' {
	export const LAUNCH_PLANS: Record<string, {source: string; sourceLabel: string; steps: {t: number; en: string; label: string; alt: string; vel: string; separation?: boolean}[]}>;
}
