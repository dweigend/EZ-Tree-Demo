/**
 * Creates the shared eight-surface terrain material from one fixed 3x3 texture atlas.
 * Two albedo layers blend zone edges while one packed surface sample supplies normal and roughness detail.
 */

import { MeshStandardMaterial, Vector4 } from 'three';
import type { GroundTextureAssets } from '../assets/landscape-assets';
import { TERRAIN_SURFACE_IDS, TERRAIN_TEXTURE_CONFIG } from './terrain-texture-config';

const ATLAS_GUTTER_PIXELS = 8;

export function createTerrainMaterial(textures: GroundTextureAssets): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    normalMap: textures.normalAtlas,
    roughness: 1,
    metalness: 0,
  });
  material.normalScale.setScalar(0.55);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTerrainAlbedoAtlas = { value: textures.albedoAtlas };
    shader.uniforms.uTerrainTileMetersA = { value: new Vector4(...textures.tileMeters.slice(0, 4)) };
    shader.uniforms.uTerrainTileMetersB = { value: new Vector4(...textures.tileMeters.slice(4)) };
    shader.uniforms.uTerrainAtlasGutter = { value: ATLAS_GUTTER_PIXELS / textures.atlasSize };
    shader.vertexShader = `${terrainVertexHeader}\n${shader.vertexShader}`;
    shader.fragmentShader = `${terrainFragmentHeader}\n${shader.fragmentShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', worldPositionShader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `${groundColorShader}\n${groundSurfaceSampleShader}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      groundRoughnessShader,
    );
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', groundNormalShader);
  };
  material.customProgramCacheKey = () => 'endless-wilds-terrain-atlas-eight-surface';
  return material;
}

const terrainVertexHeader = /* glsl */ `
attribute vec4 aMaterialWeightsA;
attribute vec4 aMaterialWeightsB;
varying vec3 vTerrainWorldPosition;
varying vec4 vTerrainMaterialWeightsA;
varying vec4 vTerrainMaterialWeightsB;
`;

const terrainFragmentHeader = /* glsl */ `
uniform sampler2D uTerrainAlbedoAtlas;
uniform vec4 uTerrainTileMetersA;
uniform vec4 uTerrainTileMetersB;
uniform float uTerrainAtlasGutter;
varying vec3 vTerrainWorldPosition;
varying vec4 vTerrainMaterialWeightsA;
varying vec4 vTerrainMaterialWeightsB;

vec2 getTerrainAtlasUv(float layer, vec2 repeatedUv) {
  float column = mod(layer, 3.0);
  float row = 2.0 - floor(layer / 3.0);
  float cellSize = 1.0 / 3.0;
  float contentSize = cellSize - uTerrainAtlasGutter * 2.0;
  return vec2(column, row) * cellSize + vec2(uTerrainAtlasGutter) + repeatedUv * contentSize;
}

float getTerrainTileMeters(float layer) {
  if (layer < 0.5) return uTerrainTileMetersA.x;
  if (layer < 1.5) return uTerrainTileMetersA.y;
  if (layer < 2.5) return uTerrainTileMetersA.z;
  if (layer < 3.5) return uTerrainTileMetersA.w;
  if (layer < 4.5) return uTerrainTileMetersB.x;
  if (layer < 5.5) return uTerrainTileMetersB.y;
  if (layer < 6.5) return uTerrainTileMetersB.z;
  return uTerrainTileMetersB.w;
}

vec2 getTerrainUvRotation(float layer) {
  vec2 rotation;
  if (layer < 0.5) rotation = vec2(0.93232735, 0.36161543);
  else if (layer < 1.5) rotation = vec2(0.28671521, 0.95801586);
  else if (layer < 2.5) rotation = vec2(-0.58038686, 0.81434089);
  else if (layer < 3.5) rotation = vec2(-0.99913515, 0.04158066);
  else if (layer < 4.5) rotation = vec2(-0.64604304, -0.76330098);
  else if (layer < 5.5) rotation = vec2(0.20612281, -0.97852613);
  else if (layer < 6.5) rotation = vec2(0.89905704, -0.43783152);
  else rotation = vec2(0.73508732, 0.67797244);
  return rotation;
}

void getTerrainLayerUv(float layer, out vec2 repeatedUv, out vec2 mirrorSign, out vec2 rotation) {
  rotation = getTerrainUvRotation(layer);
  vec2 rotated = mat2(rotation.x, -rotation.y, rotation.y, rotation.x) * vTerrainWorldPosition.xz;
  vec2 tiled = rotated / getTerrainTileMeters(layer);
  vec2 wrapped = mod(tiled, 2.0);
  mirrorSign = mix(vec2(1.0), vec2(-1.0), step(vec2(1.0), wrapped));
  repeatedUv = 1.0 - abs(wrapped - 1.0);
}

vec3 decodeTerrainNormal(vec4 surface, vec2 mirrorSign, vec2 rotation) {
  vec2 uvNormal = (surface.xy * 2.0 - 1.0) * mirrorSign;
  vec2 terrainNormal = vec2(
    rotation.x * uvNormal.x - rotation.y * uvNormal.y,
    -(rotation.y * uvNormal.x + rotation.x * uvNormal.y)
  );
  return vec3(terrainNormal, surface.z * 2.0 - 1.0);
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

${createTerrainBaseColorShader()}

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
float terrainTrailWeight = vTerrainMaterialWeightsB.w;
if (terrainTrailWeight > 0.0001) terrainTrailWeight *= getTerrainTrailMask();
considerTerrainLayer(vTerrainMaterialWeightsA.x, 0.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsA.y, 1.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsA.z, 2.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsA.w, 3.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsB.x, 4.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsB.y, 5.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsB.z, 6.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(terrainTrailWeight, 7.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
vec2 terrainFirstRepeatedUv;
vec2 terrainFirstMirrorSign;
vec2 terrainFirstRotation;
getTerrainLayerUv(terrainFirstLayer, terrainFirstRepeatedUv, terrainFirstMirrorSign, terrainFirstRotation);
vec2 terrainFirstUv = getTerrainAtlasUv(terrainFirstLayer, terrainFirstRepeatedUv);
vec2 terrainSecondRepeatedUv;
vec2 terrainSecondMirrorSign;
vec2 terrainSecondRotation;
getTerrainLayerUv(terrainSecondLayer, terrainSecondRepeatedUv, terrainSecondMirrorSign, terrainSecondRotation);
vec2 terrainSecondUv = getTerrainAtlasUv(terrainSecondLayer, terrainSecondRepeatedUv);
float terrainSurfaceMix = terrainSecondWeight / max(terrainFirstWeight + terrainSecondWeight, 0.0001);
vec3 terrainTextureColor = mix(
  texture2D(uTerrainAlbedoAtlas, terrainFirstUv).rgb,
  texture2D(uTerrainAlbedoAtlas, terrainSecondUv).rgb,
  terrainSurfaceMix
);
vec3 terrainBaseColor = (
  getTerrainBaseColor(0.0) * vTerrainMaterialWeightsA.x
  + getTerrainBaseColor(1.0) * vTerrainMaterialWeightsA.y
  + getTerrainBaseColor(2.0) * vTerrainMaterialWeightsA.z
  + getTerrainBaseColor(3.0) * vTerrainMaterialWeightsA.w
  + getTerrainBaseColor(4.0) * vTerrainMaterialWeightsB.x
  + getTerrainBaseColor(5.0) * vTerrainMaterialWeightsB.y
  + getTerrainBaseColor(6.0) * vTerrainMaterialWeightsB.z
  + getTerrainBaseColor(7.0) * terrainTrailWeight
);
float terrainTotalWeight = max(
  vTerrainMaterialWeightsA.x + vTerrainMaterialWeightsA.y + vTerrainMaterialWeightsA.z + vTerrainMaterialWeightsA.w
  + vTerrainMaterialWeightsB.x + vTerrainMaterialWeightsB.y + vTerrainMaterialWeightsB.z + terrainTrailWeight,
  0.0001
);
terrainBaseColor /= terrainTotalWeight;
float terrainDistanceDetail = 1.0 - smoothstep(140.0, 520.0, length(vViewPosition));
float terrainDetailStrength = (1.0 - smoothstep(70.0, 300.0, length(vViewPosition))) * 0.55;
vec3 terrainColor = mix(terrainBaseColor, terrainTextureColor, terrainDistanceDetail * 0.82);
diffuseColor.rgb *= terrainColor * 0.85;
`;

// The two dominant real surfaces blend symmetrically, so a layer-order change cannot draw a hard zone contour.
const groundSurfaceSampleShader = /* glsl */ `
vec4 terrainFirstSurface = texture2D(normalMap, terrainFirstUv);
vec4 terrainSecondSurface = texture2D(normalMap, terrainSecondUv);
`;

const groundRoughnessShader = /* glsl */ `
float terrainSurfaceRoughness = mix(terrainFirstSurface.a, terrainSecondSurface.a, terrainSurfaceMix);
float roughnessFactor = roughness * mix(0.92, terrainSurfaceRoughness, terrainDetailStrength);
`;

const groundNormalShader = /* glsl */ `
vec3 terrainFirstNormal = decodeTerrainNormal(terrainFirstSurface, terrainFirstMirrorSign, terrainFirstRotation);
vec3 terrainSecondNormal = decodeTerrainNormal(terrainSecondSurface, terrainSecondMirrorSign, terrainSecondRotation);
vec3 mapN = normalize(mix(terrainFirstNormal, terrainSecondNormal, terrainSurfaceMix));
mapN.xy *= normalScale * terrainDetailStrength;
normal = normalize(tbn * mapN);
`;

function createTerrainBaseColorShader(): string {
  const conditions = TERRAIN_SURFACE_IDS.slice(0, -1).map((surface, index) => {
    return `if (layer < ${(index + 0.5).toFixed(1)}) return ${toGlslColor(surface)};`;
  });
  return `vec3 getTerrainBaseColor(float layer) {\n  ${conditions.join('\n  ')}\n  return ${toGlslColor('trail')};\n}`;
}

function toGlslColor(surface: (typeof TERRAIN_SURFACE_IDS)[number]): string {
  const color = TERRAIN_TEXTURE_CONFIG.baseColors[surface];
  return `vec3(${color.map((channel) => channel.toFixed(4)).join(', ')})`;
}
