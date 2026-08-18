/**
 * Adapts EZ-Tree materials for instanced forests.
 * Bark stays static; leaf crowns receive the shared low-cost world-space wind field.
 */

import { MeshPhongMaterial } from 'three';
import { WIND_INSTANCE_GLSL, WIND_WAVE_GLSL } from '../wind/shader-chunks';
import { bindWindUniforms, type WindUniforms } from '../wind/wind-field';

export function createBranchMaterial(source: MeshPhongMaterial): MeshPhongMaterial {
  const material = source.clone();
  material.emissive.set('#211a14');
  material.emissiveIntensity = 0.04;
  material.shininess = 2;
  material.vertexColors = true;
  return material;
}

export function createLeafMaterial(source: MeshPhongMaterial, wind: WindUniforms): MeshPhongMaterial {
  const material = source.clone();
  material.emissive.set('#182314');
  material.emissiveIntensity = 0.07;
  material.shininess = 1;
  material.alphaToCoverage = true;
  material.dithering = true;
  material.vertexColors = true;
  material.onBeforeCompile = (shader) => {
    bindWindUniforms(shader.uniforms, wind);
    shader.vertexShader = `${WIND_INSTANCE_GLSL}\n${WIND_WAVE_GLSL}\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', leafProjectionShader);
  };
  material.customProgramCacheKey = () => 'endless-wilds-tree-leaf-v3';
  return material;
}

const leafProjectionShader = /* glsl */ `
vec4 instancePosition = instanceMatrix * vec4(transformed, 1.0);
vec4 treeWorldPosition = modelMatrix * instancePosition;
float heightFactor = smoothstep(0.02, 0.98, position.y);
float wave = windWaveAt(treeWorldPosition.xz, uTime, uGlobalWindScale, uGlobalWindDirection, aWindPhase);
vec2 sway = uGlobalWindDirection * wave * uGlobalWindAmplitude * uGlobalGust
  * aWindStrength * (0.35 + heightFactor * 0.65);
instancePosition.xz += sway;
vec4 mvPosition = modelViewMatrix * instancePosition;
gl_Position = projectionMatrix * mvPosition;
`;
