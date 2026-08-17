/**
 * Prepares EZ-Tree grass geometry and its shared wind material.
 * Bend weights derive from geometry height so roots stay pinned regardless of asset UV layout.
 */

import { BufferAttribute, BufferGeometry, DoubleSide, MathUtils, MeshPhongMaterial, MeshStandardMaterial } from 'three';
import type { WindUniforms } from '../wind/wind-field';
import { WIND_NOISE_GLSL } from '../wind/shader-chunks';

export function prepareGrassGeometry(source: BufferGeometry): BufferGeometry {
  const geometry = source.clone();
  geometry.computeBoundingBox();
  const positions = geometry.getAttribute('position');
  const minimumY = geometry.boundingBox?.min.y ?? 0;
  const height = Math.max((geometry.boundingBox?.max.y ?? 1) - minimumY, Number.EPSILON);
  const bendWeights = new Float32Array(positions.count);
  for (let index = 0; index < positions.count; index += 1) {
    const relativeHeight = MathUtils.clamp((positions.getY(index) - minimumY) / height, 0, 1);
    bendWeights[index] = relativeHeight * relativeHeight;
  }
  geometry.setAttribute('aBendWeight', new BufferAttribute(bendWeights, 1));
  return geometry;
}

export function createGrassMaterial(source: MeshStandardMaterial, wind: WindUniforms): MeshPhongMaterial {
  const material = new MeshPhongMaterial({
    map: source.map,
    color: '#dce7b8',
    emissive: '#42673b',
    emissiveIntensity: 0.15,
    alphaTest: 0.45,
    shininess: 1,
    side: DoubleSide,
    vertexColors: true,
  });
  material.alphaToCoverage = true;
  material.dithering = true;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind.time;
    shader.uniforms.uGlobalWindDirection = wind.direction;
    shader.uniforms.uGlobalWindAmplitude = wind.amplitude;
    shader.uniforms.uGlobalGust = wind.gust;
    shader.uniforms.uGlobalWindScale = wind.spatialScale;
    shader.vertexShader = `${grassDeclarations}\n${WIND_NOISE_GLSL}\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', grassBendShader);
  };
  material.customProgramCacheKey = () => 'endless-wilds-grass-v2';
  return material;
}

const grassDeclarations = /* glsl */ `
attribute float aRotation;
attribute float aWindPhase;
attribute float aWindStrength;
attribute float aBendWeight;
uniform float uTime;
uniform vec2 uGlobalWindDirection;
uniform float uGlobalWindAmplitude;
uniform float uGlobalGust;
uniform float uGlobalWindScale;
`;

const grassBendShader = /* glsl */ `
vec3 transformed = vec3(position);
float cosine = cos(aRotation);
float sine = sin(aRotation);
transformed.xz = mat2(cosine, -sine, sine, cosine) * transformed.xz;
vec4 bladeRoot = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float spatialPhase = windPhaseAt(bladeRoot.xz, uTime, uGlobalWindScale, uGlobalWindDirection);
float localGust = windGustAt(bladeRoot.xz, uTime, uGlobalWindScale, uGlobalWindDirection);
float wave = 0.62 * sin(uTime * 0.72 + aWindPhase + spatialPhase * 6.2831)
  + 0.25 * sin(uTime * 1.43 + aWindPhase * 1.8)
  + 0.13 * sin(uTime * 2.91 + spatialPhase * 3.7);
vec2 bend = uGlobalWindDirection * wave * aBendWeight * aWindStrength
  * uGlobalWindAmplitude * uGlobalGust * localGust * 1.35;
transformed.xz += bend;
transformed.y -= length(bend) * aBendWeight * 0.08;
`;
