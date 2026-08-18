/**
 * Creates the shared four-surface terrain material from one fixed 2x2 texture atlas.
 * PICO keeps the former three-sample cost while desktop blends a second normal for fidelity.
 */

import { MeshStandardMaterial, Vector4 } from 'three';
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
    shader.uniforms.uTerrainRoughness = { value: new Vector4(...textures.roughness) };
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
attribute vec4 aMaterialWeights;
varying vec3 vTerrainWorldPosition;
varying vec4 vTerrainMaterialWeights;
`;

const terrainFragmentHeader = /* glsl */ `
uniform sampler2D uTerrainAlbedoAtlas;
uniform vec4 uTerrainRoughness;
uniform float uTerrainAtlasGutter;
varying vec3 vTerrainWorldPosition;
varying vec4 vTerrainMaterialWeights;

vec2 getTerrainAtlasUv(float layer, vec2 repeatedUv) {
  float column = mod(layer, 2.0);
  float row = layer < 2.0 ? 1.0 : 0.0;
  float contentSize = 0.5 - uTerrainAtlasGutter * 2.0;
  return vec2(column, row) * 0.5 + vec2(uTerrainAtlasGutter) + repeatedUv * contentSize;
}

float getTerrainRoughness(float layer) {
  if (layer < 0.5) return uTerrainRoughness.x;
  if (layer < 1.5) return uTerrainRoughness.y;
  if (layer < 2.5) return uTerrainRoughness.z;
  return uTerrainRoughness.w;
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
vTerrainMaterialWeights = aMaterialWeights;
`;

const groundColorShader = /* glsl */ `
vec2 terrainRepeatedUv = fract(vTerrainWorldPosition.xz / 18.0);
float terrainFirstWeight = -1.0;
float terrainFirstLayer = 0.0;
float terrainSecondWeight = -1.0;
float terrainSecondLayer = 0.0;
considerTerrainLayer(vTerrainMaterialWeights.x, 0.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeights.y, 1.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeights.z, 2.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeights.w, 3.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
float terrainLayerMix = terrainSecondWeight / max(terrainFirstWeight + terrainSecondWeight, 0.0001);
vec2 terrainFirstUv = getTerrainAtlasUv(terrainFirstLayer, terrainRepeatedUv);
vec2 terrainSecondUv = getTerrainAtlasUv(terrainSecondLayer, terrainRepeatedUv);
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
