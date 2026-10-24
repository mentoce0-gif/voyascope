import {Config} from '@remotion/cli/config';
import {webpackOverride} from './webpack-override.mjs';

// 描画はブラウザで1フレームずつ。ふつうは Remotion が用意する描き出し専用のブラウザ（headless shell）を使う。
// 入っているものを使うときは：REMOTION_BROWSER=/path/to/headless_shell npm run render
// （ふつうの Chrome/Chromium を使うなら REMOTION_CHROME_MODE=chrome-for-testing も。
//   ただし、描き終わる前のコマが撮られて画面が欠けることがあったので、headless shell をすすめる。2026-10-24）
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
// three.js（ボイジャー1号の3D模型）を描くための WebGL
Config.setChromiumOpenGlRenderer('angle');
