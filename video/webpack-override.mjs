// Remotion の webpack に足す設定：サイトの陸地のデータ（web/data/land-110m.geojson）を JSON として読む
export const webpackOverride = (config) => ({
	...config,
	module: {
		...config.module,
		rules: [...(config.module?.rules ?? []), {test: /\.geojson$/, type: 'json'}],
	},
});
