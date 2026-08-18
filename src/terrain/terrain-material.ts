/**
 * Creates the shared seven-surface terrain material from one fixed 3x3 texture atlas.
 * Only the two strongest interpolated layers are sampled; PICO reads one normal and desktop blends two.
 */

import { MeshStandardMaterial, Vector3, Vector4 } from 'three';
import type { GroundTextureAssets } from '../assets/landscape-assets';
import { RENDERING } from '../config';

const ATLAS_GUTTER_PIXELS = 8;

export function createTerrainMaterial(textures: GroundTextureAssets): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    normalMap: textures.normalAtlas,
    roughness: 1,
    metalness: 0,
  });
  material.normalScale.setScalar(0.58);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTerrainAlbedoAtlas = { value: textures.albedoAtlas };
    shader.uniforms.uTerrainRoughnessA = { value: new Vector4(...textures.roughness.slice(0, 4)) };
    shader.uniforms.uTerrainRoughnessB = { value: new Vector3(...textures.roughness.slice(4)) };
    shader.uniforms.uTerrainTileMetersA = { value: new Vector4(...textures.tileMeters.slice(0, 4)) };
    shader.uniforms.uTerrainTileMetersB = { value: new Vector3(...textures.tileMeters.slice(4)) };
    shader.uniforms.uTerrainAtlasGutter = { value: ATLAS_GUTTER_PIXELS / textures.atlasSize };
    shader.vertexShader = `${terrainVertexHeader}\n${shader.vertexShader}`;
    shader.fragmentShader = `${terrainFragmentHeader}\n${shader.fragmentShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', worldPositionShader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', groundColorShader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', groundRoughnessShader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', createGroundNormalShader());
  };
  material.customProgramCacheKey = () => `endless-wilds-terrain-atlas-${RENDERING.blendTerrainNormals ? 'dual' : 'single'}`;
  return material;
}

const terrainVertexHeader = /* glsl */ `
attribute vec4 aMaterialWeightsA;
attribute vec3 aMaterialWeightsB;
varying vec3 vTerrainWorldPosition;
varying vec4 vTerrainMaterialWeightsA;
varying vec3 vTerrainMaterialWeightsB;
`;

const terrainFragmentHeader = /* glsl */ `
uniform sampler2D uTerrainAlbedoAtlas;
uniform vec4 uTerrainRoughnessA;
uniform vec3 uTerrainRoughnessB;
uniform vec4 uTerrainTileMetersA;
uniform vec3 uTerrainTileMetersB;
uniform float uTerrainAtlasGutter;
varying vec3 vTerrainWorldPosition;
varying vec4 vTerrainMaterialWeightsA;
varying vec3 vTerrainMaterialWeightsB;

vec2 getTerrainAtlasUv(float layer, vec2 repeatedUv) {
  float column = mod(layer, 3.0);
  float row = 2.0 - floor(layer / 3.0);
  float cellSize = 1.0 / 3.0;
  float contentSize = cellSize - uTerrainAtlasGutter * 2.0;
  return vec2(column, row) * cellSize + vec2(uTerrainAtlasGutter) + repeatedUv * contentSize;
}

float getTerrainRoughness(float layer) {
  if (layer < 0.5) return uTerrainRoughnessA.x;
  if (layer < 1.5) return uTerrainRoughnessA.y;
  if (layer < 2.5) return uTerrainRoughnessA.z;
  if (layer < 3.5) return uTerrainRoughnessA.w;
  if (layer < 4.5) return uTerrainRoughnessB.x;
  if (layer < 5.5) return uTerrainRoughnessB.y;
  return uTerrainRoughnessB.z;
}

float getTerrainTileMeters(float layer) {
  if (layer < 0.5) return uTerrainTileMetersA.x;
  if (layer < 1.5) return uTerrainTileMetersA.y;
  if (layer < 2.5) return uTerrainTileMetersA.z;
  if (layer < 3.5) return uTerrainTileMetersA.w;
  if (layer < 4.5) return uTerrainTileMetersB.x;
  if (layer < 5.5) return uTerrainTileMetersB.y;
  return uTerrainTileMetersB.z;
}

vec2 getTerrainRepeatedUv(float layer) {
  vec2 rotation;
  if (layer < 0.5) rotation = vec2(0.93232735, 0.36161543);
  else if (layer < 1.5) rotation = vec2(0.28671521, 0.95801586);
  else if (layer < 2.5) rotation = vec2(-0.58038686, 0.81434089);
  else if (layer < 3.5) rotation = vec2(-0.99913515, 0.04158066);
  else if (layer < 4.5) rotation = vec2(-0.64604304, -0.76330098);
  else if (layer < 5.5) rotation = vec2(0.20612281, -0.97852613);
  else rotation = vec2(0.89905704, -0.43783152);
  vec2 rotated = mat2(rotation.x, -rotation.y, rotation.y, rotation.x) * vTerrainWorldPosition.xz;
  vec2 tiled = rotated / getTerrainTileMeters(layer);
  return 1.0 - abs(mod(tiled, 2.0) - 1.0);
}

float getTerrainTrailMask() {
  float along = vTerrainWorldPosition.x * 0.72 + vTerrainWorldPosition.z * 0.69;
  float across = vTerrainWorldPosition.x * -0.69 + vTerrainWorldPosition.z * 0.72;
  float warp = sin(across * 0.011 + 0.7) * 38.0 + sin(across * 0.027 - 1.1) * 14.0;
  float spacing = 310.0;
  float repeated = mod(along + warp + spacing * 0.5, spacing);
  float distanceToTrail = abs(repeated - spacing * 0.5);
  return 1.0 - smoothstep(2.0, 7.0, distanceToTrail);
}

void considerTerrainLayer(
  float weight,
  float layer,
  inout float firstWeight,
  inout float firstLayer,
  inout float secondWeight,
  inout float secondLayer
) {
  if (weight > firstWeight) {
    secondWeight = firstWeight;
    secondLayer = firstLayer;
    firstWeight = weight;
    firstLayer = layer;
  } else if (weight > secondWeight) {
    secondWeight = weight;
    secondLayer = layer;
  }
}
`;

const worldPositionShader = /* glsl */ `
#include <worldpos_vertex>
vTerrainWorldPosition = worldPosition.xyz;
vTerrainMaterialWeightsA = aMaterialWeightsA;
vTerrainMaterialWeightsB = aMaterialWeightsB;
`;

const groundColorShader = /* glsl */ `
float terrainFirstWeight = -1.0;
float terrainFirstLayer = 0.0;
float terrainSecondWeight = -1.0;
float terrainSecondLayer = 0.0;
float terrainTrailWeight = vTerrainMaterialWeightsB.z;
if (terrainTrailWeight > 0.0001) terrainTrailWeight *= getTerrainTrailMask();
considerTerrainLayer(vTerrainMaterialWeightsA.x, 0.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsA.y, 1.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsA.z, 2.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsA.w, 3.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsB.x, 4.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsB.y, 5.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(terrainTrailWeight, 6.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
float terrainLayerMix = terrainSecondWeight / max(terrainFirstWeight + terrainSecondWeight, 0.0001);
vec2 terrainFirstRepeatedUv = getTerrainRepeatedUv(terrainFirstLayer);
vec2 terrainSecondRepeatedUv = getTerrainRepeatedUv(terrainSecondLayer);
vec2 terrainFirstUv = getTerrainAtlasUv(terrainFirstLayer, terrainFirstRepeatedUv);
vec2 terrainSecondUv = getTerrainAtlasUv(terrainSecondLayer, terrainSecondRepeatedUv);
vec3 terrainFirstColor = texture2D(uTerrainAlbedoAtlas, terrainFirstUv).rgb;
vec3 terrainSecondColor = texture2D(uTerrainAlbedoAtlas, terrainSecondUv).rgb;
diffuseColor.rgb *= mix(terrainFirstColor, terrainSecondColor, terrainLayerMix);
`;

const groundRoughnessShader = /* glsl */ `
float roughnessFactor = mix(
  getTerrainRoughness(terrainFirstLayer),
  getTerrainRoughness(terrainSecondLayer),
  terrainLayerMix
);
`;

function createGroundNormalShader(): string {
  if (!RENDERING.blendTerrainNormals) {
    return /* glsl */ `
vec3 mapN = texture2D(normalMap, terrainFirstUv).xyz * 2.0 - 1.0;
mapN.xy *= normalScale;
normal = normalize(tbn * mapN);
`;
  }
  return /* glsl */ `
vec3 firstMapN = texture2D(normalMap, terrainFirstUv).xyz * 2.0 - 1.0;
vec3 secondMapN = texture2D(normalMap, terrainSecondUv).xyz * 2.0 - 1.0;
vec3 mapN = normalize(mix(firstMapN, secondMapN, terrainLayerMix));
mapN.xy *= normalScale;
normal = normalize(tbn * mapN);
`;
}
