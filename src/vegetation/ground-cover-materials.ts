/**
 * Creates shared flower and rock materials for instanced ground-cover batches.
 * Flower materials bind to the global wind uniforms; rock materials retain imported PBR maps.
 */

import { DoubleSide, MeshStandardMaterial } from 'three';
import { VEGETATION } from '../config';
import type { WindUniforms } from '../wind/wind-field';
import { WIND_NOISE_GLSL } from '../wind/shader-chunks';

export function createFlowerMaterial(source: MeshStandardMaterial, wind: WindUniforms): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    map: source.map,
    color: source.color,
    alphaMap: source.alphaMap,
    alphaTest: source.alphaTest,
    transparent: source.transparent,
    opacity: source.opacity,
    side: DoubleSide,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
  });
  material.alphaHash = true;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind.time;
    shader.uniforms.uGlobalWindDirection = wind.direction;
    shader.uniforms.uGlobalWindAmplitude = wind.amplitude;
    shader.uniforms.uGlobalGust = wind.gust;
    shader.uniforms.uGlobalWindScale = wind.spatialScale;
    shader.uniforms.uFlowerFadeStart = { value: VEGETATION.flowerDistance - 55 };
    shader.uniforms.uFlowerFadeEnd = { value: VEGETATION.flowerDistance };
    shader.vertexShader = `${flowerDeclarations}\n${WIND_NOISE_GLSL}\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', flowerWindShader);
    shader.fragmentShader = `varying float vFlowerOpacity;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <alphahash_fragment>',
      'diffuseColor.a *= vFlowerOpacity;\n#include <alphahash_fragment>',
    );
  };
  material.customProgramCacheKey = () => 'endless-wilds-flower-v2';
  return material;
}

export function createRockMaterial(source: MeshStandardMaterial): MeshStandardMaterial {
  const material = source.clone();
  material.roughness = 0.94;
  material.metalness = 0;
  material.vertexColors = true;
  return material;
}

const flowerDeclarations = /* glsl */ `
attribute float aWindPhase;
attribute float aWindStrength;
uniform float uTime;
uniform vec2 uGlobalWindDirection;
uniform float uGlobalWindAmplitude;
uniform float uGlobalGust;
uniform float uGlobalWindScale;
uniform float uFlowerFadeStart;
uniform float uFlowerFadeEnd;
varying float vFlowerOpacity;
`;

const flowerWindShader = /* glsl */ `
vec4 instancePosition = instanceMatrix * vec4(transformed, 1.0);
vec4 flowerWorldPosition = modelMatrix * instancePosition;
vFlowerOpacity = 1.0 - smoothstep(uFlowerFadeStart, uFlowerFadeEnd, distance(flowerWorldPosition.xyz, cameraPosition));
float heightFactor = smoothstep(0.08, 1.35, position.y);
float spatialPhase = windPhaseAt(flowerWorldPosition.xz, uTime, uGlobalWindScale, uGlobalWindDirection);
float localGust = windGustAt(flowerWorldPosition.xz, uTime, uGlobalWindScale, uGlobalWindDirection);
float wave = 0.7 * sin(uTime * 0.72 + aWindPhase + spatialPhase * 6.2831)
  + 0.3 * sin(uTime * 1.37 + aWindPhase * 1.6);
instancePosition.xz += uGlobalWindDirection * wave * heightFactor * heightFactor
  * aWindStrength * uGlobalWindAmplitude * uGlobalGust * localGust * 0.24;
vec4 mvPosition = modelViewMatrix * instancePosition;
gl_Position = projectionMatrix * mvPosition;
`;
