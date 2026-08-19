/**
 * Normalises imported grass geometry and creates its shared GPU-wind material.
 * Source proportions and colours remain intact; roots stay pinned through height-based bend weights.
 */

import { BufferAttribute, BufferGeometry, MathUtils, MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WIND_INSTANCE_GLSL, WIND_WAVE_GLSL } from '../wind/shader-chunks';
import { bindWindUniforms, type WindUniforms } from '../wind/wind-field';

export function prepareGrassGeometry(source: BufferGeometry): BufferGeometry {
  const geometry = source.clone();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) throw new Error('Grass geometry has no bounds.');
  const height = Math.max(bounds.max.y - bounds.min.y, Number.EPSILON);
  const centerX = (bounds.min.x + bounds.max.x) * 0.5;
  const centerZ = (bounds.min.z + bounds.max.z) * 0.5;
  geometry.translate(-centerX, -bounds.min.y, -centerZ);
  geometry.scale(1 / height, 1 / height, 1 / height);
  geometry.computeBoundingBox();
  const positions = geometry.getAttribute('position');
  const bendWeights = new Float32Array(positions.count);
  for (let index = 0; index < positions.count; index += 1) {
    const relativeHeight = MathUtils.clamp(positions.getY(index), 0, 1);
    bendWeights[index] = relativeHeight * relativeHeight;
  }
  geometry.setAttribute('aBendWeight', new BufferAttribute(bendWeights, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export function prepareMeadowGeometry(source: BufferGeometry): BufferGeometry {
  const base = prepareGrassGeometry(source);
  const left = base.clone().scale(0.88, 0.82, 0.88).rotateY(2.1).translate(2.35, 0, 1.15);
  const right = base.clone().scale(1.04, 0.92, 0.96).rotateY(-0.82).translate(-2.15, 0, 1.7);
  const parts = [base, left, right];
  const meadow = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!meadow) throw new Error('Grass patch geometry could not be combined.');
  meadow.computeBoundingBox();
  meadow.computeBoundingSphere();
  return meadow;
}

export function createGrassMaterial(source: MeshStandardMaterial, wind: WindUniforms): MeshStandardMaterial {
  const material = source.clone();
  material.color.set('#d1d8ad');
  material.emissive.set('#283523');
  material.emissiveIntensity = 0.08;
  material.metalness = 0;
  material.roughness = 1;
  material.vertexColors = true;
  material.alphaToCoverage = source.alphaTest > 0;
  material.dithering = true;
  material.onBeforeCompile = (shader) => {
    bindWindUniforms(shader.uniforms, wind);
    shader.vertexShader = `${WIND_INSTANCE_GLSL}\nattribute float aRotation;\nattribute float aBendWeight;\n${WIND_WAVE_GLSL}\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', grassBendShader);
  };
  material.customProgramCacheKey = () => 'endless-wilds-grass-v7';
  return material;
}

const grassBendShader = /* glsl */ `
vec3 transformed = vec3(position);
float cosine = cos(aRotation);
float sine = sin(aRotation);
transformed.xz = mat2(cosine, -sine, sine, cosine) * transformed.xz;
vec4 bladeRoot = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float wave = windWaveAt(bladeRoot.xz, uTime, uGlobalWindScale, uGlobalWindDirection, aWindPhase);
vec2 bend = uGlobalWindDirection * wave * aBendWeight * aWindStrength
  * uGlobalWindAmplitude * uGlobalGust * 1.35;
transformed.xz += bend;
transformed.y -= length(bend) * aBendWeight * 0.08;
`;
