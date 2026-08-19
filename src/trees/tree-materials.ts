/**
 * Preserves EZ-Tree PBR maps and rounded canopy lighting while adapting leaves to instanced world wind.
 * Material identity stays template-owned; this layer only adds instance colour and motion support.
 */

import { MeshStandardMaterial, ShaderChunk } from 'three';
import { WIND_INSTANCE_GLSL, WIND_WAVE_GLSL } from '../wind/shader-chunks';
import { bindWindUniforms, type WindUniforms } from '../wind/wind-field';

export function createBranchMaterial(source: MeshStandardMaterial): MeshStandardMaterial {
  const material = source.clone();
  material.vertexColors = true;
  return material;
}

export function createLeafMaterial(
  source: MeshStandardMaterial,
  wind: WindUniforms,
  roundedNormals: boolean,
): MeshStandardMaterial {
  const material = source.clone();
  material.emissive.set('#385332');
  material.emissiveIntensity = 0.16;
  material.alphaToCoverage = true;
  material.dithering = true;
  material.vertexColors = true;
  material.onBeforeCompile = (shader) => {
    bindWindUniforms(shader.uniforms, wind);
    shader.uniforms.uCustomNormals = { value: roundedNormals };
    shader.vertexShader = `${WIND_INSTANCE_GLSL}\n${WIND_WAVE_GLSL}\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', leafProjectionShader);
    shader.fragmentShader = `uniform bool uCustomNormals;\n${shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      ShaderChunk.normal_fragment_begin.replace(
        'normal *= faceDirection;',
        'if (!uCustomNormals) { normal *= faceDirection; }',
      ),
    )}`;
  };
  material.customProgramCacheKey = () => `endless-wilds-ez-tree-leaf-v5-${roundedNormals}`;
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
