/**
 * Creates the shared eight-surface terrain material from one fixed 3x3 texture atlas.
 * Height-aware base layers receive packed normal, cavity, roughness, and a final trail overlay.
 */

import { MeshStandardMaterial, Vector4 } from 'three';
import type { GroundTextureAssets } from '../assets/landscape-assets';
import { TERRAIN_SURFACE_IDS, TERRAIN_TEXTURE_CONFIG } from './terrain-texture-config';

const ATLAS_GUTTER_PIXELS = 8;

export function createTerrainMaterial(textures: GroundTextureAssets): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    normalMap: textures.surfaceAtlas,
    roughness: 1,
    metalness: 0,
  });
  material.normalScale.setScalar(0.85);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTerrainAlbedoAtlas = { value: textures.albedoAtlas };
    shader.uniforms.uTerrainTileMetersA = { value: new Vector4(...textures.tileMeters.slice(0, 4)) };
    shader.uniforms.uTerrainTileMetersB = { value: new Vector4(...textures.tileMeters.slice(4)) };
    shader.uniforms.uTerrainAtlasGutter = { value: ATLAS_GUTTER_PIXELS / textures.atlasSize };
    shader.uniforms.uTerrainParallaxMeters = { value: textures.parallaxMeters };
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
uniform float uTerrainParallaxMeters;
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
  float normalZ = sqrt(max(1.0 - dot(uvNormal, uvNormal), 0.0001));
  return vec3(terrainNormal, normalZ);
}

float getTerrainTrailMask() {
  float along = vTerrainWorldPosition.x * 0.72 + vTerrainWorldPosition.z * 0.69;
  float across = vTerrainWorldPosition.x * -0.69 + vTerrainWorldPosition.z * 0.72;
  float warp = sin(across * 0.011 + 0.7) * 38.0 + sin(across * 0.027 - 1.1) * 14.0;
  float spacing = 310.0;
  float repeated = mod(along + warp + spacing * 0.5, spacing);
  float distanceToTrail = abs(repeated - spacing * 0.5);
  return 1.0 - smoothstep(8.0, 20.0, distanceToTrail);
}

float getTerrainHeightMix(float firstWeight, float secondWeight, float firstHeight, float secondHeight) {
  const float blendDepth = 0.22;
  vec2 scores = vec2(firstWeight + firstHeight * blendDepth, secondWeight + secondHeight * blendDepth);
  float threshold = max(scores.x, scores.y) - blendDepth;
  vec2 blend = max(scores - threshold, 0.0);
  return blend.y / max(blend.x + blend.y, 0.0001);
}

vec2 getTerrainParallaxUv(
  float layer,
  vec2 repeatedUv,
  vec2 mirrorSign,
  vec2 rotation,
  float height
) {
  if (uTerrainParallaxMeters <= 0.0) return repeatedUv;
  vec3 viewDirection = normalize(cameraPosition - vTerrainWorldPosition);
  vec2 worldOffset = viewDirection.xz / max(viewDirection.y, 0.3);
  vec2 rotatedOffset = mat2(rotation.x, -rotation.y, rotation.y, rotation.x) * worldOffset;
  vec2 uvOffset = rotatedOffset * ((height - 0.5) * uTerrainParallaxMeters / getTerrainTileMeters(layer));
  return clamp(repeatedUv - uvOffset * mirrorSign, vec2(0.0), vec2(1.0));
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
considerTerrainLayer(vTerrainMaterialWeightsA.x, 0.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsA.y, 1.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsA.z, 2.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsA.w, 3.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsB.x, 4.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsB.y, 5.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
considerTerrainLayer(vTerrainMaterialWeightsB.z, 6.0, terrainFirstWeight, terrainFirstLayer, terrainSecondWeight, terrainSecondLayer);
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
vec4 terrainFirstSurface = texture2D(normalMap, terrainFirstUv);
vec4 terrainSecondSurface = texture2D(normalMap, terrainSecondUv);
float terrainSurfaceMix = getTerrainHeightMix(
  terrainFirstWeight,
  terrainSecondWeight,
  terrainFirstSurface.b,
  terrainSecondSurface.b
);
if (uTerrainParallaxMeters > 0.0) {
  terrainFirstRepeatedUv = getTerrainParallaxUv(
    terrainFirstLayer,
    terrainFirstRepeatedUv,
    terrainFirstMirrorSign,
    terrainFirstRotation,
    terrainFirstSurface.b
  );
  terrainSecondRepeatedUv = getTerrainParallaxUv(
    terrainSecondLayer,
    terrainSecondRepeatedUv,
    terrainSecondMirrorSign,
    terrainSecondRotation,
    terrainSecondSurface.b
  );
  terrainFirstUv = getTerrainAtlasUv(terrainFirstLayer, terrainFirstRepeatedUv);
  terrainSecondUv = getTerrainAtlasUv(terrainSecondLayer, terrainSecondRepeatedUv);
  terrainFirstSurface = texture2D(normalMap, terrainFirstUv);
  terrainSecondSurface = texture2D(normalMap, terrainSecondUv);
}
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
);
float terrainTotalWeight = max(
  vTerrainMaterialWeightsA.x + vTerrainMaterialWeightsA.y + vTerrainMaterialWeightsA.z + vTerrainMaterialWeightsA.w
  + vTerrainMaterialWeightsB.x + vTerrainMaterialWeightsB.y + vTerrainMaterialWeightsB.z,
  0.0001
);
terrainBaseColor /= terrainTotalWeight;
float terrainDistanceDetail = 1.0 - smoothstep(140.0, 520.0, length(vViewPosition));
float terrainDetailStrength = (1.0 - smoothstep(70.0, 300.0, length(vViewPosition))) * 0.55;
vec3 terrainColor = mix(terrainBaseColor, terrainTextureColor, terrainDistanceDetail * 0.82);
float terrainHeight = mix(terrainFirstSurface.b, terrainSecondSurface.b, terrainSurfaceMix);
float terrainCavity = 1.0 - smoothstep(0.2, 0.62, terrainHeight);
terrainColor *= mix(1.0, 0.82, terrainCavity * terrainDistanceDetail);

float terrainTrailMix = smoothstep(
  0.0,
  0.65,
  clamp(vTerrainMaterialWeightsB.w * getTerrainTrailMask() * 1.45, 0.0, 1.0)
);
vec4 terrainTrailSurface = terrainFirstSurface;
vec2 terrainTrailMirrorSign = vec2(1.0);
vec2 terrainTrailRotation = vec2(1.0, 0.0);
if (terrainTrailMix > 0.0001) {
  vec2 terrainTrailRepeatedUv;
  getTerrainLayerUv(7.0, terrainTrailRepeatedUv, terrainTrailMirrorSign, terrainTrailRotation);
  vec2 terrainTrailUv = getTerrainAtlasUv(7.0, terrainTrailRepeatedUv);
  terrainTrailSurface = texture2D(normalMap, terrainTrailUv);
  if (uTerrainParallaxMeters > 0.0) {
    terrainTrailRepeatedUv = getTerrainParallaxUv(
      7.0,
      terrainTrailRepeatedUv,
      terrainTrailMirrorSign,
      terrainTrailRotation,
      terrainTrailSurface.b
    );
    terrainTrailUv = getTerrainAtlasUv(7.0, terrainTrailRepeatedUv);
    terrainTrailSurface = texture2D(normalMap, terrainTrailUv);
  }
  vec3 terrainTrailColor = texture2D(uTerrainAlbedoAtlas, terrainTrailUv).rgb;
  float terrainTrailCavity = 1.0 - smoothstep(0.2, 0.62, terrainTrailSurface.b);
  terrainTrailColor *= mix(1.0, 0.82, terrainTrailCavity * terrainDistanceDetail);
  float baseLuminance = dot(terrainColor, vec3(0.2126, 0.7152, 0.0722));
  float trailLuminance = max(dot(terrainTrailColor, vec3(0.2126, 0.7152, 0.0722)), 0.0001);
  float contrastDirection = step(baseLuminance, trailLuminance);
  float contrastLuminance = mix(baseLuminance * 0.76, baseLuminance * 1.24, contrastDirection);
  float targetLuminance = mix(
    min(trailLuminance, contrastLuminance),
    max(trailLuminance, contrastLuminance),
    contrastDirection
  );
  terrainTrailColor *= targetLuminance / trailLuminance;
  terrainColor = mix(terrainColor, terrainTrailColor, terrainTrailMix);
}
diffuseColor.rgb *= terrainColor * 0.85;
`;

const groundSurfaceSampleShader = '';

const groundRoughnessShader = /* glsl */ `
float terrainSurfaceRoughness = mix(terrainFirstSurface.a, terrainSecondSurface.a, terrainSurfaceMix);
terrainSurfaceRoughness = mix(terrainSurfaceRoughness, terrainTrailSurface.a, terrainTrailMix);
float roughnessFactor = roughness * mix(0.92, terrainSurfaceRoughness, terrainDetailStrength);
`;

const groundNormalShader = /* glsl */ `
vec3 terrainFirstNormal = decodeTerrainNormal(terrainFirstSurface, terrainFirstMirrorSign, terrainFirstRotation);
vec3 terrainSecondNormal = decodeTerrainNormal(terrainSecondSurface, terrainSecondMirrorSign, terrainSecondRotation);
vec3 mapN = normalize(mix(terrainFirstNormal, terrainSecondNormal, terrainSurfaceMix));
vec3 terrainTrailNormal = decodeTerrainNormal(terrainTrailSurface, terrainTrailMirrorSign, terrainTrailRotation);
mapN = normalize(mix(mapN, terrainTrailNormal, terrainTrailMix));
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
