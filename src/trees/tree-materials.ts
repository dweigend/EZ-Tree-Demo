/**
 * Instancing-compatible extensions for EZ-Tree's bark and leaf materials.
 * Leaves retain EZ-Tree's simplex wind foundation while both materials consume the shared wind field.
 */

import { MeshPhongMaterial, Vector3 } from 'three';
import type { WindUniforms } from '../wind/wind-field';
import { WIND_NOISE_GLSL } from '../wind/shader-chunks';

const INSTANCE_UNIFORMS = /* glsl */ `
attribute float aWindPhase;
attribute float aWindStrength;
uniform vec2 uGlobalWindDirection;
uniform float uGlobalWindAmplitude;
uniform float uGlobalGust;
uniform float uGlobalWindScale;
`;

export function createBranchMaterial(source: MeshPhongMaterial, wind: WindUniforms): MeshPhongMaterial {
  const material = source.clone();
  material.color.set('#e1d4bd');
  material.emissive.set('#3d3024');
  material.emissiveIntensity = 0.12;
  material.shininess = 2;
  material.vertexColors = true;
  material.onBeforeCompile = (shader) => {
    bindSharedUniforms(shader.uniforms, wind);
    shader.vertexShader = `${INSTANCE_UNIFORMS}\nuniform float uTime;\n${WIND_NOISE_GLSL}\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', branchProjectionShader);
  };
  material.customProgramCacheKey = () => 'endless-wilds-tree-branch-v1';
  return material;
}

export function createLeafMaterial(source: MeshPhongMaterial, wind: WindUniforms): MeshPhongMaterial {
  const material = source.clone();
  material.color.set('#d5e3b4');
  material.emissive.set('#3b552c');
  material.emissiveIntensity = 0.2;
  material.shininess = 1;
  material.dithering = true;
  const compileEzTreeWind = source.onBeforeCompile.bind(source);
  material.vertexColors = true;
  material.onBeforeCompile = (shader, renderer) => {
    compileEzTreeWind(shader, renderer);
    bindSharedUniforms(shader.uniforms, wind);
    shader.vertexShader = `${INSTANCE_UNIFORMS}\n${WIND_NOISE_GLSL}\n${shader.vertexShader}`;
    shader.vertexShader = replaceEzTreeProjection(shader.vertexShader, leafProjectionShader);
  };
  material.customProgramCacheKey = () => 'endless-wilds-tree-leaf-v1';
  return material;
}

function bindSharedUniforms(uniforms: Record<string, { value: unknown }>, wind: WindUniforms): void {
  uniforms.uTime = wind.time;
  uniforms.uGlobalWindDirection = wind.direction;
  uniforms.uGlobalWindAmplitude = wind.amplitude;
  uniforms.uGlobalGust = wind.gust;
  uniforms.uGlobalWindScale = wind.spatialScale;
  uniforms.uWindScale = wind.spatialScale;
  uniforms.uWindStrength = { value: new Vector3() };
}

function replaceEzTreeProjection(shader: string, replacement: string): string {
  const startToken = 'vec4 mvPosition = vec4(transformed, 1.0);';
  const endToken = 'gl_Position = projectionMatrix * mvPosition;';
  const start = shader.indexOf(startToken);
  const end = shader.indexOf(endToken, start);
  if (start < 0 || end < 0) throw new Error('EZ-Tree wind shader structure changed.');
  return `${shader.slice(0, start)}${replacement}${shader.slice(end + endToken.length)}`;
}

const branchProjectionShader = /* glsl */ `
vec4 instancePosition = instanceMatrix * vec4(transformed, 1.0);
vec4 treeWorldPosition = modelMatrix * instancePosition;
float heightFactor = smoothstep(0.04, 1.0, position.y);
float spatialPhase = windPhaseAt(treeWorldPosition.xz, uTime, uGlobalWindScale, uGlobalWindDirection);
float localGust = windGustAt(treeWorldPosition.xz, uTime, uGlobalWindScale, uGlobalWindDirection);
float wave = 0.62 * sin(uTime * 0.55 + aWindPhase + spatialPhase * 6.2831)
  + 0.25 * sin(uTime * 1.17 + aWindPhase * 1.7)
  + 0.13 * sin(uTime * 2.31 + spatialPhase * 3.1);
vec2 sway = uGlobalWindDirection * wave * uGlobalWindAmplitude * uGlobalGust
  * aWindStrength * heightFactor * heightFactor * localGust * 0.72;
instancePosition.xz += sway;
vec4 mvPosition = modelViewMatrix * instancePosition;
gl_Position = projectionMatrix * mvPosition;
`;

const leafProjectionShader = /* glsl */ `
vec4 instancePosition = instanceMatrix * vec4(transformed, 1.0);
vec4 treeWorldPosition = modelMatrix * instancePosition;
float heightFactor = smoothstep(0.02, 0.98, position.y);
float spatialPhase = windPhaseAt(treeWorldPosition.xz, uTime, uGlobalWindScale, uGlobalWindDirection);
float localGust = windGustAt(treeWorldPosition.xz, uTime, uGlobalWindScale, uGlobalWindDirection);
float wave = 0.52 * sin(uTime * 0.53 + aWindPhase + spatialPhase * 5.4)
  + 0.3 * sin(uTime * 1.09 + aWindPhase * 1.4)
  + 0.18 * sin(uTime * 2.47 + spatialPhase * 4.2);
vec2 sway = uGlobalWindDirection * wave * uGlobalWindAmplitude * uGlobalGust
  * aWindStrength * (0.35 + heightFactor * 0.65) * localGust;
instancePosition.xz += sway;
vec4 mvPosition = modelViewMatrix * instancePosition;
gl_Position = projectionMatrix * mvPosition;
`;
