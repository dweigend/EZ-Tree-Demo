/**
 * Creates shared flower and rock materials for instanced ground-cover batches.
 * Flowers bind to the common wind field; rocks retain their imported PBR maps.
 */

import { DoubleSide, MeshStandardMaterial } from 'three';
import { WIND_WAVE_GLSL } from '../wind/shader-chunks';
import { bindWindUniforms, type WindUniforms } from '../wind/wind-field';

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
  material.onBeforeCompile = (shader) => {
    bindWindUniforms(shader.uniforms, wind);
    shader.vertexShader = `${flowerDeclarations}\n${WIND_WAVE_GLSL}\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', flowerWindShader);
  };
  material.customProgramCacheKey = () => 'endless-wilds-flower-v3';
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
`;

const flowerWindShader = /* glsl */ `
vec4 instancePosition = instanceMatrix * vec4(transformed, 1.0);
vec4 flowerWorldPosition = modelMatrix * instancePosition;
float heightFactor = smoothstep(0.08, 1.35, position.y);
float wave = windWaveAt(flowerWorldPosition.xz, uTime, uGlobalWindScale, uGlobalWindDirection, aWindPhase);
instancePosition.xz += uGlobalWindDirection * wave * heightFactor * heightFactor
  * aWindStrength * uGlobalWindAmplitude * uGlobalGust * 0.24;
vec4 mvPosition = modelViewMatrix * instancePosition;
gl_Position = projectionMatrix * mvPosition;
`;
