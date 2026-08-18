/**
 * Shared habitat sampling for the existing landscape distributions and terrain colour.
 * It owns only common ecology fields; concrete placement thresholds remain with their distributions.
 */

import { MathUtils, type Vector3, type Vector4 } from 'three';
import type { HeightField } from '../core/height-field';

export interface LandscapeSurfaceSample {
  x: number;
  z: number;
  height: number;
  slope: number;
}

export interface LandscapeMaterialWeights {
  readonly first: Vector4;
  readonly second: Vector3;
}

export function getMoisture(heightField: HeightField, x: number, z: number, height: number): number {
  const broad = heightField.getNoise01(x * 0.0011 + 81, z * 0.0011 - 57, 3);
  const drainage = 1 - MathUtils.smoothstep(height, 92, 205);
  return MathUtils.clamp(broad * 0.72 + drainage * 0.28, 0, 1);
}

export function getGroundCover(heightField: HeightField, x: number, z: number, height: number): number {
  const moisture = getMoisture(heightField, x, z, height);
  const meadow = heightField.getNoise01((x - 210) * 0.0052, (z + 80) * 0.0052, 2);
  return MathUtils.clamp(meadow * 0.66 + moisture * 0.34, 0, 1);
}

export function getWoodland(heightField: HeightField, x: number, z: number): number {
  return heightField.getNoise01((x + 240) * 0.00185, (z - 170) * 0.00185, 3);
}

export function writeLandscapeMaterialWeights(
  heightField: HeightField,
  surface: LandscapeSurfaceSample,
  target: LandscapeMaterialWeights,
): LandscapeMaterialWeights {
  const warpX = (heightField.getNoise01(surface.x * 0.0021 + 73, surface.z * 0.0021 - 31, 2) - 0.5) * 110;
  const warpZ = (heightField.getNoise01(surface.x * 0.0021 - 47, surface.z * 0.0021 + 89, 2) - 0.5) * 110;
  const moisture = getMoisture(heightField, surface.x + warpX, surface.z + warpZ, surface.height);
  const woodland = getWoodland(heightField, surface.x + warpX, surface.z + warpZ);
  const flatness = 1 - MathUtils.smoothstep(surface.slope, 0.08, 0.62);
  const lowland = 1 - MathUtils.smoothstep(surface.height, 35, 125);
  const highland = MathUtils.smoothstep(surface.height, 95, 210);
  const mudNoise = heightField.getNoise01((surface.x - 370) * 0.011, (surface.z + 120) * 0.011, 2);
  const mud = MathUtils.smoothstep(moisture * lowland, 0.46, 0.8) * flatness * (0.68 + mudNoise * 0.32);
  const rock = Math.max(MathUtils.smoothstep(surface.slope, 0.18, 0.62), highland * (1 - moisture * 0.42));
  const forest = MathUtils.smoothstep(woodland, 0.4, 0.82) * flatness * (1 - rock * 0.78) * (1 - mud * 0.5);
  const forestVariation = heightField.getNoise01((surface.x + 510) * 0.007, (surface.z - 260) * 0.007, 2);
  const dryForest = forest * (1 - moisture) * (0.56 + (1 - forestVariation) * 0.44);
  const mossForest = forest * moisture * (0.52 + forestVariation * 0.48);
  const forestGround = forest * (0.62 + (1 - Math.abs(forestVariation - 0.5) * 2) * 0.38);
  const meadow = (1 - forest * 0.9) * (1 - rock * 0.88) * (1 - mud * 0.72) * flatness * (0.5 + moisture * 0.34);
  const trail = getTrailEnvelope(surface) * (1 - mud * 0.55) * (1 - rock * 0.38) * 0.95;
  target.first.set(meadow + 0.01, mud, dryForest, mossForest);
  target.second.set(forestGround, rock, trail);
  return normaliseWeights(target);
}

function getTrailEnvelope(surface: LandscapeSurfaceSample): number {
  const along = surface.x * 0.72 + surface.z * 0.69;
  const across = surface.x * -0.69 + surface.z * 0.72;
  const warp = Math.sin(across * 0.011 + 0.7) * 38 + Math.sin(across * 0.027 - 1.1) * 14;
  const spacing = 310;
  const repeated = ((along + warp + spacing * 0.5) % spacing + spacing) % spacing;
  const distance = Math.abs(repeated - spacing * 0.5);
  const path = 1 - MathUtils.smoothstep(distance, 3, 28);
  return path * (1 - MathUtils.smoothstep(surface.slope, 0.18, 0.58));
}

function normaliseWeights(weights: LandscapeMaterialWeights): LandscapeMaterialWeights {
  const first = weights.first;
  const second = weights.second;
  const total = first.x + first.y + first.z + first.w + second.x + second.y + second.z;
  if (total <= 0) {
    first.set(1, 0, 0, 0);
    second.set(0, 0, 0);
    return weights;
  }
  first.multiplyScalar(1 / total);
  second.multiplyScalar(1 / total);
  return weights;
}
