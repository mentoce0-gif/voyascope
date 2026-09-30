// 写実的な地球：昼は NASA Blue Marble、夜は NASA Black Marble（街の明かり）
// 太陽が真上にある地点から昼と夜の境目を計算し、観測時刻に合わせて動かす。
// 画像：NASA（米国では原則として著作権の対象外。出典の表示が必要。docs/design/target-gap.md）
import { subsolarPoint } from "./passes.js";

const DAY_URL = "assets/earth/day-2048.jpg";
const NIGHT_URL = "assets/earth/night-2048.jpg";

// globe.gl の地球の材質（MeshPhongMaterial）に、夜の明かりと昼夜の境目を足す
// 地球の球は画像の向きを合わせるために回転しているので、境目は回転後の座標（modelMatrix）で比べる
export function setupEarth(globe) {
  const uniforms = { nightMap: { value: null }, sunDir: { value: { x: 0, y: 0, z: 1 } } };
  const mat = globe.globeMaterial();
  mat.color.set("#ffffff");
  if ("shininess" in mat) mat.shininess = 6;
  if (mat.specular) mat.specular.set("#1a2b44");

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vEarthPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvEarthPos = (modelMatrix * vec4(position, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D nightMap;\nuniform vec3 sunDir;\nvarying vec3 vEarthPos;\nfloat earthDay;\nvec3 earthNight;",
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        earthDay = smoothstep(-0.10, 0.12, dot(normalize(vEarthPos), sunDir));
        earthNight = texture2D(nightMap, vMapUv).rgb;
        diffuseColor.rgb *= mix(0.06, 1.0, earthDay);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += earthNight * (1.0 - earthDay) * 1.15;`,
      );
  };

  globe.globeImageUrl(DAY_URL);

  // 夜の画像は、昼の画像の Texture と同じ型で作る（three.js を別に読み込まないため）
  const loadNight = () => {
    if (!mat.map) return false;
    const img = new Image();
    img.onload = () => {
      const tex = new mat.map.constructor(img);
      tex.colorSpace = mat.map.colorSpace;
      tex.anisotropy = mat.map.anisotropy;
      tex.needsUpdate = true;
      uniforms.nightMap.value = tex;
      mat.needsUpdate = true;
    };
    img.src = NIGHT_URL;
    return true;
  };
  const wait = setInterval(() => loadNight() && clearInterval(wait), 200);

  // 観測時刻に合わせて昼と夜の境目を動かす
  return (date) => {
    const { lat, lng } = subsolarPoint(date);
    const p = globe.getCoords(lat, lng, 0);
    const r = Math.hypot(p.x, p.y, p.z);
    uniforms.sunDir.value = { x: p.x / r, y: p.y / r, z: p.z / r };
  };
}
