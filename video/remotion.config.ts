import {Config} from '@remotion/cli/config';
import {webpackOverride} from './webpack-override.mjs';

// 描画はブラウザ（Chromium）で1フレームずつ。CI やクラウドでは入っている Chromium を使う：
//   REMOTION_BROWSER=/path/to/chrome REMOTION_CHROME_MODE=chrome-for-testing npm run render
// （ふつうの Chrome/Chromium は chrome-for-testing、headless_shell なら指定しない）
if (process.env.REMOTION_BROWSER) {
	Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
if (process.env.REMOTION_CHROME_MODE === 'chrome-for-testing') {
	Config.setChromeMode('chrome-for-testing');
}
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(4);
Config.overrideWebpackConfig(webpackOverride);
