/**
 * Creates the shared world-space terrain material from the EZ-Tree ground texture set.
 * Grass and dirt blending follows the deterministic per-vertex ground-cover field across chunks.
 */

import { MeshStandardMaterial } from 'three';
import type { GroundTextureAssets } from '../assets/landscape-assets';

export function createTerrainMaterial(textures: GroundTextureAssets): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    normalMap: textures.dirtNormal,
    roughness: 0.96,
    metalness: 0,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrassTexture = { value: textures.grass };
    shader.uniforms.uDirtTexture = { value: textures.dirtColor };
    shader.vertexShader = `attribute float aGroundCover;\nvarying vec3 vTerrainWorldPosition;\nvarying float vGroundCover;\n${shader.vertexShader}`;
    shader.fragmentShader = `uniform sampler2D uGrassTexture;\nuniform sampler2D uDirtTexture;\nvarying vec3 vTerrainWorldPosition;\nvarying float vGroundCover;\n${shader.fragmentShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', worldPositionShader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', groundColorShader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', groundNormalShader);
  };
  material.customProgramCacheKey = () => 'endless-wilds-terrain-v2';
  return material;
}

const worldPositionShader = /* glsl */ `
#include <worldpos_vertex>
vTerrainWorldPosition = worldPosition.xyz;
vGroundCover = aGroundCover;
`;

const groundColorShader = /* glsl */ `
vec2 terrainUv = vTerrainWorldPosition.xz / 18.0;
vec3 grassColor = texture2D(uGrassTexture, terrainUv).rgb;
vec3 dirtColor = texture2D(uDirtTexture, terrainUv).rgb;
vec3 terrainNormal = normalize(cross(dFdx(vTerrainWorldPosition), dFdy(vTerrainWorldPosition)));
float steepness = 1.0 - abs(terrainNormal.y);
float sparseGround = 1.0 - smoothstep(0.34, 0.68, vGroundCover);
float slopeDirt = smoothstep(0.12, 0.48, steepness);
float highlandDirt = smoothstep(135.0, 235.0, vTerrainWorldPosition.y) * 0.35;
float dirtMix = clamp(sparseGround * 0.72 + slopeDirt * 0.82 + highlandDirt, 0.0, 1.0);
diffuseColor.rgb = mix(grassColor, dirtColor, dirtMix) * mix(0.94, 1.08, vGroundCover);
`;

const groundNormalShader = /* glsl */ `
vec3 mapN = texture2D(normalMap, terrainUv).xyz * 2.0 - 1.0;
mapN.xy *= normalScale * (0.32 + dirtMix * 0.68);
normal = normalize(tbn * mapN);
`;
